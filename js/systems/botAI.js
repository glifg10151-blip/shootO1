// =========================================================
// BLACKLINE // OPS — Tactical Squad AI, Hunting & Loot Drops
// =========================================================
import * as THREE from "three";
import { WEAPONS, DIFFICULTIES, BOT_CALLSIGNS } from "../config/weapons.js";
import { BotModel } from "../entities/botModel.js";

const BOT_WEAPONS = ["m4a1", "ak47", "mp5", "m249", "spas12"];

export class BotManager {
  constructor(scene, physics, particles, audio, mapData) {
    this.scene = scene;
    this.physics = physics;
    this.particles = particles;
    this.audio = audio;
    this.mapData = mapData;

    this.bots = [];
    this.ammoDrops = [];
    this.difficulty = DIFFICULTIES.regular;
    this.mode = "tdm";

    this.cellSize = 2.0;
    this.gridW = 0;
    this.gridD = 0;
    this.navGrid = null;
    this.walkableCells = [];

    // Shared geometries/materials for dropped bullet packs
    this.dropBoxGeo = new THREE.BoxGeometry(0.36, 0.2, 0.24);
    this.dropBulletGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6);
    this.dropRingGeo = new THREE.RingGeometry(0.42, 0.52, 20);
    this.dropBoxMat = new THREE.MeshStandardMaterial({ color: 0x364a2d, roughness: 0.55, metalness: 0.35 });
    this.dropBrassMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.65,
      roughness: 0.25,
      metalness: 0.85
    });
    this.dropRingMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this._buildNavGrid();
  }

  _buildNavGrid() {
    const hw = this.mapData.halfW;
    const hd = this.mapData.halfD;
    this.gridW = Math.floor((hw * 2) / this.cellSize);
    this.gridD = Math.floor((hd * 2) / this.cellSize);
    this.navGrid = new Uint8Array(this.gridW * this.gridD);
    this.walkableCells = [];

    for (let gz = 0; gz < this.gridD; gz++) {
      for (let gx = 0; gx < this.gridW; gx++) {
        const wx = -hw + (gx + 0.5) * this.cellSize;
        const wz = -hd + (gz + 0.5) * this.cellSize;
        const idx = gz * this.gridW + gx;

        if (Math.abs(wx) > hw - 1.1 || Math.abs(wz) > hd - 1.1) {
          this.navGrid[idx] = 0;
          continue;
        }

        let floorY = 0;
        for (const r of this.physics.ramps) {
          const ry = this.physics.getRampHeightAt(r, wx, wz, 0.25);
          if (ry !== null) floorY = Math.max(floorY, ry);
        }

        let blocked = false;
        const checkR = 0.62;
        for (const s of this.physics.solids) {
          if (
            wx + checkR > s.minX &&
            wx - checkR < s.maxX &&
            wz + checkR > s.minZ &&
            wz - checkR < s.maxZ
          ) {
            if (s.maxY <= floorY + 0.4) {
              floorY = Math.max(floorY, s.maxY);
            } else if (s.minY < floorY + 1.75 && s.maxY > floorY + 0.45) {
              blocked = true;
              break;
            }
          }
        }

        if (!blocked) {
          this.navGrid[idx] = 1;
          this.walkableCells.push({ gx, gz, wx, wz, y: floorY });
        }
      }
    }
  }

  _worldToGrid(x, z) {
    const gx = Math.max(0, Math.min(this.gridW - 1, Math.floor((x + this.mapData.halfW) / this.cellSize)));
    const gz = Math.max(0, Math.min(this.gridD - 1, Math.floor((z + this.mapData.halfD) / this.cellSize)));
    return { gx, gz };
  }

  _gridToWorld(gx, gz) {
    return new THREE.Vector3(
      -this.mapData.halfW + (gx + 0.5) * this.cellSize,
      0,
      -this.mapData.halfD + (gz + 0.5) * this.cellSize
    );
  }

  _nearestWalkable(gx, gz) {
    if (this.navGrid[gz * this.gridW + gx] === 1) return { gx, gz };
    for (let rad = 1; rad <= 5; rad++) {
      for (let dz = -rad; dz <= rad; dz++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const nx = gx + dx;
          const nz = gz + dz;
          if (nx >= 0 && nx < this.gridW && nz >= 0 && nz < this.gridD) {
            if (this.navGrid[nz * this.gridW + nx] === 1) return { gx: nx, gz: nz };
          }
        }
      }
    }
    return { gx, gz };
  }

  findPath(fromPos, toPos) {
    const sRaw = this._worldToGrid(fromPos.x, fromPos.z);
    const gRaw = this._worldToGrid(toPos.x, toPos.z);
    const start = this._nearestWalkable(sRaw.gx, sRaw.gz);
    const goal = this._nearestWalkable(gRaw.gx, gRaw.gz);

    if (start.gx === goal.gx && start.gz === goal.gz) {
      return [toPos.clone()];
    }

    const total = this.gridW * this.gridD;
    const gScore = new Float32Array(total).fill(1e9);
    const fScore = new Float32Array(total).fill(1e9);
    const cameFrom = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);
    const open = [];

    const startIdx = start.gz * this.gridW + start.gx;
    const goalIdx = goal.gz * this.gridW + goal.gx;

    gScore[startIdx] = 0;
    fScore[startIdx] = Math.hypot(goal.gx - start.gx, goal.gz - start.gz);
    open.push(startIdx);

    const dirs = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, 1.414], [-1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414]
    ];

    let iterations = 0;
    let bestFallback = startIdx;
    let bestH = fScore[startIdx];

    while (open.length > 0 && iterations < 460) {
      iterations++;
      let bestPos = 0;
      for (let i = 1; i < open.length; i++) {
        if (fScore[open[i]] < fScore[open[bestPos]]) bestPos = i;
      }
      const curr = open[bestPos];
      open.splice(bestPos, 1);

      if (curr === goalIdx) {
        bestFallback = curr;
        break;
      }

      closed[curr] = 1;
      const cx = curr % this.gridW;
      const cz = Math.floor(curr / this.gridW);
      const ch = Math.hypot(goal.gx - cx, goal.gz - cz);
      if (ch < bestH) {
        bestH = ch;
        bestFallback = curr;
      }

      for (const [dx, dz, cost] of dirs) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nx >= this.gridW || nz < 0 || nz >= this.gridD) continue;
        const nIdx = nz * this.gridW + nx;
        if (closed[nIdx] || this.navGrid[nIdx] === 0) continue;
        if (dx !== 0 && dz !== 0) {
          if (this.navGrid[cz * this.gridW + nx] === 0 || this.navGrid[nz * this.gridW + cx] === 0) {
            continue;
          }
        }

        const tentativeG = gScore[curr] + cost;
        if (tentativeG < gScore[nIdx]) {
          cameFrom[nIdx] = curr;
          gScore[nIdx] = tentativeG;
          fScore[nIdx] = tentativeG + Math.hypot(goal.gx - nx, goal.gz - nz);
          if (!open.includes(nIdx)) open.push(nIdx);
        }
      }
    }

    const path = [];
    let trace = bestFallback;
    while (trace !== -1 && trace !== startIdx) {
      const tx = trace % this.gridW;
      const tz = Math.floor(trace / this.gridW);
      path.push(this._gridToWorld(tx, tz));
      trace = cameFrom[trace];
    }
    path.reverse();
    if (path.length === 0) path.push(toPos.clone());
    return path;
  }

  _pickSpawnPoint(team, playerPos) {
    let pool = this.mapData.spawns.ffa;
    if (team === "blue" && this.mapData.spawns.blue) pool = this.mapData.spawns.blue;
    else if (team === "red" && this.mapData.spawns.red) pool = this.mapData.spawns.red;

    if (playerPos) {
      const sorted = [...pool].sort((a, b) => {
        const da = (a.x - playerPos.x) ** 2 + (a.z - playerPos.z) ** 2;
        const db = (b.x - playerPos.x) ** 2 + (b.z - playerPos.z) ** 2;
        return db - da;
      });
      const top = sorted.slice(0, Math.min(3, sorted.length));
      return top[Math.floor(Math.random() * top.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  spawnSquad(mode, difficultyId, playerPos) {
    this.clearBots();
    this.mode = mode;
    this.difficulty = DIFFICULTIES[difficultyId] || DIFFICULTIES.regular;

    const names = [...BOT_CALLSIGNS].sort(() => Math.random() - 0.5);
    let nameIdx = 0;

    if (mode === "tdm" || mode === "hardpoint") {
      for (let i = 0; i < 4; i++) {
        this._createBot(names[nameIdx++], "blue", true, false, playerPos, i);
      }
      for (let i = 0; i < 5; i++) {
        this._createBot(names[nameIdx++], "red", false, false, playerPos, i);
      }
    } else if (mode === "ffa") {
      for (let i = 0; i < 7; i++) {
        this._createBot(names[nameIdx++], `ffa_${i}`, false, false, playerPos, i);
      }
    } else if (mode === "survival") {
      this.spawnSurvivalWave(1, playerPos);
    }
  }

  spawnSurvivalWave(waveNum, playerPos) {
    this.clearBots();
    const count = Math.min(10, 4 + waveNum * 2);
    const names = [...BOT_CALLSIGNS].sort(() => Math.random() - 0.5);

    for (let i = 0; i < count; i++) {
      const isHeavy = waveNum >= 3 && i % 3 === 2;
      const callsign = `${names[i % names.length]}-${waveNum}`;
      const bot = this._createBot(callsign, "red", false, isHeavy, playerPos, i);
      const waveScale = 1 + (waveNum - 1) * 0.14;
      bot.maxHealth = Math.round((isHeavy ? 155 : 105) * waveScale);
      bot.health = bot.maxHealth;
      bot.maxArmor = isHeavy ? 65 : waveNum >= 2 ? 25 : 0;
      bot.armor = bot.maxArmor;
    }
  }

  _createBot(callsign, team, isFriendly, isHeavy, playerPos, squadSlot = 0) {
    const wId = BOT_WEAPONS[Math.floor(Math.random() * BOT_WEAPONS.length)];
    const weapon = WEAPONS[wId];
    const sp = this._pickSpawnPoint(isFriendly ? "blue" : "red", playerPos);

    const model = new BotModel(isFriendly ? "blue" : "red", isHeavy);
    this.scene.add(model.root);

    const bot = {
      id: `bot_${Math.random().toString(36).slice(2, 8)}`,
      callsign,
      team,
      isFriendly,
      isHeavy,
      squadSlot,
      weapon,
      model,
      position: new THREE.Vector3(sp.x, sp.y, sp.z),
      velocity: new THREE.Vector3(),
      yaw: sp.yaw || 0,
      aimPitch: 0,
      crouched: false,
      crouchTimer: 0,
      onGround: true,
      alive: true,
      maxHealth: isHeavy ? 150 : 100,
      health: isHeavy ? 150 : 100,
      maxArmor: isHeavy ? 50 : 25,
      armor: isHeavy ? 50 : 25,
      mag: weapon.magSize,
      reloadTimer: 0,
      fireTimer: 0,
      reactionTimer: this.difficulty.reactionTime,
      aimLockTime: 0,
      aimTargetPos: new THREE.Vector3(),
      hasAimTarget: false,
      burstShotsLeft: 0,
      burstPauseTimer: 0,
      strafeDir: Math.random() > 0.5 ? 1 : -1,
      strafeTimer: 0.7 + Math.random() * 0.6,
      jumpCooldown: 2.0 + Math.random() * 2.0,
      coverSpot: null,
      path: [],
      pathIndex: 0,
      repathTimer: Math.random() * 0.4,
      targetEntity: null,
      lastThreatPos: null,
      threatMemoryTimer: 0,
      investigatePos: null,
      investigateTimer: 0,
      radarRevealTimer: 0,
      stunTimer: 0,
      respawnTimer: 0,
      deathHideTimer: 0,
      spawnProtection: 1.0,
      kills: 0,
      deaths: 0,
      score: 0
    };

    model.root.position.copy(bot.position);
    model.root.rotation.y = bot.yaw;
    this.bots.push(bot);
    return bot;
  }

  respawnBot(bot, playerPos) {
    const sp = this._pickSpawnPoint(bot.isFriendly ? "blue" : this.mode === "ffa" ? "ffa" : "red", playerPos);
    bot.position.set(sp.x, sp.y, sp.z);
    bot.velocity.set(0, 0, 0);
    bot.yaw = sp.yaw || 0;
    bot.alive = true;
    bot.health = bot.maxHealth;
    bot.armor = bot.maxArmor;
    bot.mag = bot.weapon.magSize;
    bot.reloadTimer = 0;
    bot.stunTimer = 0;
    bot.crouched = false;
    bot.crouchTimer = 0;
    bot.aimLockTime = 0;
    bot.hasAimTarget = false;
    bot.spawnProtection = 1.0;
    bot.path = [];
    bot.lastThreatPos = null;
    bot.threatMemoryTimer = 0;
    bot.coverSpot = null;
    bot.targetEntity = null;
    bot.model.resetPose(bot.isFriendly);
    bot.model.root.position.copy(bot.position);
  }

  spawnAmmoDrop(pos) {
    if (this.ammoDrops.length >= 16) {
      const oldest = this.ammoDrops.shift();
      this.scene.remove(oldest.group);
    }

    const group = new THREE.Group();
    const yFloor = this.physics.getSurfaceHeightAt(pos.x, pos.z, pos.y + 0.5);

    const spinGroup = new THREE.Group();
    spinGroup.position.y = 0.34;

    const crate = new THREE.Mesh(this.dropBoxGeo, this.dropBoxMat);
    spinGroup.add(crate);

    // 3 gleaming brass cartridges angled on top of pouch
    for (let i = -1; i <= 1; i++) {
      const b = new THREE.Mesh(this.dropBulletGeo, this.dropBrassMat);
      b.position.set(i * 0.08, 0.14, 0);
      b.rotation.z = 0.28;
      b.rotation.x = 0.3;
      spinGroup.add(b);
    }

    const ring = new THREE.Mesh(this.dropRingGeo, this.dropRingMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;

    group.add(spinGroup, ring);
    group.position.set(pos.x, yFloor, pos.z);
    this.scene.add(group);

    this.ammoDrops.push({
      group,
      spinGroup,
      pos: new THREE.Vector3(pos.x, yFloor, pos.z),
      life: 24.0
    });
  }

  alertNearbyBots(noisePos, radius = 30, onlyTeam = null) {
    for (const bot of this.bots) {
      if (!bot.alive) continue;
      if (onlyTeam && bot.team === onlyTeam) continue;
      const dist = bot.position.distanceTo(noisePos);
      if (dist <= radius) {
        bot.investigatePos = noisePos.clone();
        bot.investigateTimer = 5.5;
        if (!bot.lastThreatPos) {
          bot.repathTimer = Math.min(bot.repathTimer, 0.25);
        }
      }
    }
  }

  stunBotsInRadius(center, radius = 9.0) {
    let hitCount = 0;
    for (const bot of this.bots) {
      if (!bot.alive || bot.isFriendly) continue;
      const dist = bot.position.distanceTo(center);
      if (dist <= radius) {
        const eye = new THREE.Vector3(bot.position.x, bot.position.y + 1.45, bot.position.z);
        if (this.physics.hasLineOfSight(center, eye)) {
          bot.stunTimer = Math.max(bot.stunTimer, 3.6 * (1 - (dist / radius) * 0.45));
          hitCount++;
        }
      }
    }
    return hitCount;
  }

  damageBot(bot, amount, zone = "torso", attackerInfo = null, weaponShort = "M4A1", onKilled = null) {
    if (!bot.alive || bot.spawnProtection > 0) {
      return { killed: false, brokeArmor: false };
    }

    let remaining = amount;
    let hitArmor = false;
    if (bot.armor > 0) {
      hitArmor = true;
      const absorbed = Math.min(bot.armor, remaining * 0.65);
      bot.armor -= absorbed;
      remaining -= absorbed;
    }

    bot.health = Math.max(0, bot.health - remaining);
    bot.model.triggerFlinch();

    // Immediately snap awareness toward attacker when hit
    if (attackerInfo && attackerInfo.position) {
      bot.lastThreatPos = attackerInfo.position.clone();
      bot.threatMemoryTimer = 7.0;
      bot.investigatePos = attackerInfo.position.clone();
      bot.investigateTimer = 6.0;
      bot.reactionTimer = Math.min(bot.reactionTimer, 0.08);
      bot.repathTimer = Math.min(bot.repathTimer, 0.15);

      const dx = attackerInfo.position.x - bot.position.x;
      const dz = attackerInfo.position.z - bot.position.z;
      bot.yaw = Math.atan2(-dx, -dz);
    }

    if (bot.health <= 0) {
      bot.alive = false;
      bot.deaths += 1;
      bot.respawnTimer = this.mode === "survival" ? 9999 : 3.2;
      bot.deathHideTimer = 2.4;
      bot.model.fallDir = Math.random() > 0.5 ? 1 : -1;
      this.spawnAmmoDrop(bot.position);
      if (onKilled) onKilled(bot, attackerInfo, weaponShort, zone === "head");
      return { killed: true, brokeArmor: hitArmor };
    }

    return { killed: false, brokeArmor: hitArmor };
  }

  _getEnemiesForBot(bot, player) {
    const list = [];
    if (player.alive) {
      if (this.mode === "ffa" || this.mode === "survival" || !bot.isFriendly) {
        list.push({
          isPlayer: true,
          position: player.position,
          velocity: player.velocity,
          crouched: player.crouched,
          sliding: !!player.sliding,
          onGround: !!player.onGround,
          alive: player.alive,
          team: "blue",
          ref: player
        });
      }
    }
    for (const other of this.bots) {
      if (other === bot || !other.alive) continue;
      if (this.mode === "ffa") {
        list.push({
          isPlayer: false,
          position: other.position,
          velocity: other.velocity,
          crouched: other.crouched,
          sliding: false,
          onGround: other.onGround,
          alive: true,
          team: other.team,
          ref: other
        });
      } else if (other.team !== bot.team) {
        list.push({
          isPlayer: false,
          position: other.position,
          velocity: other.velocity,
          crouched: other.crouched,
          sliding: false,
          onGround: other.onGround,
          alive: true,
          team: other.team,
          ref: other
        });
      }
    }
    return list;
  }

  _findCoverNear(bot, threatPos) {
    if (!threatPos || this.walkableCells.length === 0) return null;
    const threatEye = new THREE.Vector3(threatPos.x, threatPos.y + 1.5, threatPos.z);
    let best = null;
    let bestScore = Infinity;

    for (let i = 0; i < 16; i++) {
      const cell = this.walkableCells[Math.floor(Math.random() * this.walkableCells.length)];
      const dBot = Math.hypot(cell.wx - bot.position.x, cell.wz - bot.position.z);
      if (dBot < 2.5 || dBot > 14) continue;
      const cellEye = new THREE.Vector3(cell.wx, cell.y + 1.45, cell.wz);
      if (!this.physics.hasLineOfSight(cellEye, threatEye)) {
        if (dBot < bestScore) {
          bestScore = dBot;
          best = new THREE.Vector3(cell.wx, cell.y, cell.wz);
        }
      }
    }
    return best;
  }

  _fireAtTarget(bot, target, player, onPlayerHit, onBotKilled) {
    const spec = bot.weapon;
    bot.mag -= 1;
    const rateScale = this.difficulty.id === "veteran" ? 0.92 : this.difficulty.id === "regular" ? 1.05 : 1.35;
    bot.fireTimer = Math.max(this.difficulty.burstInterval * rateScale, 60 / spec.rpm);
    bot.model.triggerMuzzleFlash();
    if (!spec.suppressed) {
      bot.radarRevealTimer = 2.4;
    }

    const toBot = new THREE.Vector3().subVectors(bot.position, player.position);
    const dist = toBot.length();
    const rightVec = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const pan = dist > 0.1 ? rightVec.dot(toBot.normalize()) : 0;
    this.audio.playGunshot(spec.audioProfile, false, pan, dist);

    const muzzlePos = new THREE.Vector3(bot.position.x, bot.position.y + (bot.crouched ? 0.98 : 1.38), bot.position.z);
    // Fire along lagged aimTargetPos (never instant-snapped to fast sliding/jumping targets)
    const dir = new THREE.Vector3().subVectors(bot.aimTargetPos, muzzlePos).normalize();

    const tSpeed = Math.hypot(target.velocity?.x || 0, target.velocity?.z || 0);
    const evasionPenalty =
      (target.sliding ? 0.065 : 0) +
      (!target.onGround ? 0.048 : 0) +
      Math.max(0, tSpeed - 5.5) * 0.006;

    const lockFactor = Math.max(0.62, 1 - bot.aimLockTime * 0.3);
    const spread = (this.difficulty.aimSpread * 1.35 * lockFactor + evasionPenalty) * (bot.stunTimer > 0 ? 3.4 : 1.0);
    dir.x += (Math.random() - 0.5) * 2.0 * spread;
    dir.y += (Math.random() - 0.5) * 1.5 * spread;
    dir.z += (Math.random() - 0.5) * 2.0 * spread;
    dir.normalize();

    const pellets = spec.pellets ? Math.min(5, spec.pellets) : 1;
    for (let p = 0; p < pellets; p++) {
      const pDir = dir.clone();
      if (pellets > 1) {
        pDir.x += (Math.random() - 0.5) * 0.085;
        pDir.y += (Math.random() - 0.5) * 0.065;
        pDir.z += (Math.random() - 0.5) * 0.085;
        pDir.normalize();
      }

      const worldHit = this.physics.raycastWorld(muzzlePos, pDir, 120);
      const maxDist = worldHit.hit ? worldHit.distance : 120;
      const isLow = !!(target.crouched || target.sliding);
      const opHit = this.physics.raycastOperator(muzzlePos, pDir, maxDist, target.position, isLow);

      if (opHit) {
        this.particles.spawnTracer(muzzlePos, opHit.point, spec.tracerColor, 0.95);
        const baseScale = pellets > 1 ? 0.42 : 0.65;
        const dmg = Math.round(
          spec.damage * baseScale * this.difficulty.damageMult * (opHit.zone === "head" ? 1.35 : 1.0)
        );
        if (target.isPlayer) {
          const res = player.takeDamage(dmg, bot.position);
          if (onPlayerHit) onPlayerHit(res, bot, spec.shortName);
        } else {
          this.particles.spawnImpact(opHit.point, null, "flesh", true);
          this.damageBot(target.ref, dmg * 1.35, opHit.zone, bot, spec.shortName, onBotKilled);
        }
      } else if (worldHit.hit) {
        this.particles.spawnTracer(muzzlePos, worldHit.point, spec.tracerColor, 0.95);
        this.particles.spawnImpact(worldHit.point, worldHit.normal, worldHit.mat, false);
      } else {
        this.particles.spawnTracer(muzzlePos, muzzlePos.clone().addScaledVector(pDir, 75), spec.tracerColor, 0.95);
      }
    }

    if (bot.mag <= 0) {
      bot.reloadTimer = spec.reloadTime * 1.05;
    }
  }

  _pickHuntGoal(bot, player, activeHardpoint) {
    // 1. Pursue recently spotted enemy around cover (last known position, NOT live wallhack)
    if (bot.threatMemoryTimer > 0 && bot.lastThreatPos) {
      return bot.lastThreatPos.clone();
    }

    // 2. Investigate nearby heard gunfire or footsteps
    if (bot.investigateTimer > 0 && bot.investigatePos) {
      return bot.investigatePos.clone();
    }

    // 3. Hardpoint prioritizes objective area
    if (this.mode === "hardpoint" && activeHardpoint && Math.random() < 0.72) {
      return new THREE.Vector3(
        activeHardpoint.x + (Math.random() - 0.5) * 6.0,
        activeHardpoint.y,
        activeHardpoint.z + (Math.random() - 0.5) * 6.0
      );
    }

    // 4. Survival enemies search general sector (with scatter so no pinpoint wallhack)
    if (this.mode === "survival" && player.alive) {
      const scatter = 9.0;
      return new THREE.Vector3(
        Math.max(-this.mapData.halfW + 2, Math.min(this.mapData.halfW - 2, player.position.x + (Math.random() - 0.5) * scatter * 2)),
        0,
        Math.max(-this.mapData.halfD + 2, Math.min(this.mapData.halfD - 2, player.position.z + (Math.random() - 0.5) * scatter * 2))
      );
    }

    // 5. Friendly teammates patrol tactical mid-lanes or escort near player's forward flank
    if (bot.isFriendly && player.alive && Math.random() < 0.55) {
      const fwdX = -Math.sin(player.yaw);
      const fwdZ = -Math.cos(player.yaw);
      const side = bot.squadSlot % 2 === 0 ? 1 : -1;
      const rightX = Math.cos(player.yaw) * side;
      const rightZ = -Math.sin(player.yaw) * side;
      return new THREE.Vector3(
        Math.max(-this.mapData.halfW + 3, Math.min(this.mapData.halfW - 3, player.position.x + fwdX * 10 + rightX * 8)),
        0,
        Math.max(-this.mapData.halfD + 3, Math.min(this.mapData.halfD - 3, player.position.z + fwdZ * 10 + rightZ * 8))
      );
    }

    // 6. Natural tactical lane patrol (biases toward central skirmish lanes & opposing territory without knowing exact positions)
    if (this.walkableCells.length > 0) {
      const laneX = ((bot.squadSlot % 3) - 1) * (this.mapData.halfW * 0.5);
      const targetZ =
        this.mode === "ffa"
          ? (Math.random() - 0.5) * this.mapData.halfD * 1.4
          : bot.isFriendly
          ? 4 + Math.random() * (this.mapData.halfD * 0.6)
          : -4 - Math.random() * (this.mapData.halfD * 0.6);

      // Pick a walkable cell near the chosen lane checkpoint
      let bestCell = this.walkableCells[Math.floor(Math.random() * this.walkableCells.length)];
      let bestD = Infinity;
      for (let k = 0; k < 14; k++) {
        const c = this.walkableCells[Math.floor(Math.random() * this.walkableCells.length)];
        const d = Math.hypot(c.wx - laneX, c.wz - targetZ);
        if (d < bestD && Math.hypot(c.wx - bot.position.x, c.wz - bot.position.z) > 8) {
          bestD = d;
          bestCell = c;
        }
      }
      return new THREE.Vector3(bestCell.wx, bestCell.y, bestCell.wz);
    }
    return null;
  }

  _updateAmmoDrops(dt, player, weaponSystem, hud) {
    const now = performance.now() * 0.003;
    for (let i = this.ammoDrops.length - 1; i >= 0; i--) {
      const drop = this.ammoDrops[i];
      drop.life -= dt;
      drop.spinGroup.rotation.y += dt * 2.2;
      drop.spinGroup.position.y = 0.34 + Math.sin(now + i) * 0.05;

      // Player pickup check
      if (player.alive && weaponSystem) {
        const d = Math.hypot(player.position.x - drop.pos.x, player.position.z - drop.pos.z);
        if (d < 1.85 && Math.abs(player.position.y - drop.pos.y) < 1.6) {
          const pri = weaponSystem.slots[0];
          const sec = weaponSystem.slots[1];
          if (pri) pri.reserve = Math.min(pri.spec.maxReserve, pri.reserve + pri.spec.magSize);
          if (sec) sec.reserve = Math.min(sec.spec.maxReserve, sec.reserve + Math.ceil(sec.spec.magSize * 0.6));
          if (player.perk?.scavenger) {
            player.armor = Math.min(player.maxArmor, player.armor + 15);
          }
          this.audio.playPickup();
          if (hud) hud.pushXpPopup("+AMMO PICKUP");
          this.scene.remove(drop.group);
          this.ammoDrops.splice(i, 1);
          continue;
        }
      }

      if (drop.life <= 0) {
        this.scene.remove(drop.group);
        this.ammoDrops.splice(i, 1);
      }
    }
  }

  update(dt, player, activeHardpoint, onPlayerHit, onBotKilled, weaponSystem = null, hud = null) {
    this._updateAmmoDrops(dt, player, weaponSystem, hud);

    // Footstep sound sensing: sprinting or sliding alerts nearby hostiles (crouch-walking stays silent!)
    if (player.alive && !player.crouched && (player.sprinting || player.sliding)) {
      const hearRadius = player.sliding ? 13.5 : 10.5;
      for (const b of this.bots) {
        if (!b.alive || (this.mode !== "ffa" && this.mode !== "survival" && b.isFriendly)) continue;
        if (b.position.distanceTo(player.position) <= hearRadius) {
          b.investigatePos = player.position.clone();
          b.investigateTimer = 3.0;
        }
      }
    }

    for (let i = 0; i < this.bots.length; i++) {
      const bot = this.bots[i];

      if (!bot.alive) {
        bot.model.updateAnimation(dt, 0, false, false, 0, false);
        bot.deathHideTimer -= dt;
        if (bot.deathHideTimer <= 0) {
          bot.model.root.visible = false;
        }
        if (this.mode !== "survival") {
          bot.respawnTimer -= dt;
          if (bot.respawnTimer <= 0) {
            this.respawnBot(bot, player.position);
          }
        }
        continue;
      }

      if (bot.spawnProtection > 0) bot.spawnProtection = Math.max(0, bot.spawnProtection - dt);
      if (bot.radarRevealTimer > 0) bot.radarRevealTimer = Math.max(0, bot.radarRevealTimer - dt);
      if (bot.stunTimer > 0) bot.stunTimer = Math.max(0, bot.stunTimer - dt);
      if (bot.fireTimer > 0) bot.fireTimer = Math.max(0, bot.fireTimer - dt);
      if (bot.investigateTimer > 0) bot.investigateTimer = Math.max(0, bot.investigateTimer - dt);
      if (bot.threatMemoryTimer > 0) bot.threatMemoryTimer = Math.max(0, bot.threatMemoryTimer - dt);
      if (bot.jumpCooldown > 0) bot.jumpCooldown = Math.max(0, bot.jumpCooldown - dt);

      if (bot.crouchTimer > 0) {
        bot.crouchTimer -= dt;
        if (bot.crouchTimer <= 0) bot.crouched = false;
      }

      if (bot.reloadTimer > 0) {
        bot.reloadTimer -= dt;
        if (bot.reloadTimer <= 0) bot.mag = bot.weapon.magSize;
      }

      // Target acquisition: real 128-degree forward Vision Cone + Close Proximity Sense + Line-of-Sight
      const botEye = new THREE.Vector3(bot.position.x, bot.position.y + 1.5, bot.position.z);
      const fwdX = -Math.sin(bot.yaw);
      const fwdZ = -Math.cos(bot.yaw);
      const candidates = this._getEnemiesForBot(bot, player);
      let visibleTarget = null;
      let bestScore = Infinity;

      for (const c of candidates) {
        const dx = c.position.x - bot.position.x;
        const dz = c.position.z - bot.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > this.difficulty.detectRange + 4) continue;

        // Forward vision cone check (dot >= 0.44 => ~128 deg total FOV; within 3.2m peripheral unless crouched)
        const dirX = dx / Math.max(0.01, dist);
        const dirZ = dz / Math.max(0.01, dist);
        const dot = fwdX * dirX + fwdZ * dirZ;
        const inFrontCone = dot >= 0.44;
        const closeSense = dist <= (c.crouched ? 1.6 : 3.4);
        const recentlyAlerted = bot.investigateTimer > 3.5 && dot >= -0.15;

        if (!inFrontCone && !closeSense && !recentlyAlerted) continue;

        const tEye = new THREE.Vector3(c.position.x, c.position.y + (c.crouched || c.sliding ? 0.9 : 1.5), c.position.z);
        if (this.physics.hasLineOfSight(botEye, tEye)) {
          const score = dist * (c.isPlayer ? 0.92 : 1.0);
          if (score < bestScore) {
            bestScore = score;
            visibleTarget = c;
          }
        }
      }

      const sprintSpeed = bot.isHeavy ? 4.6 : 6.45;
      const combatSpeed = bot.isHeavy ? 3.2 : 4.35;
      let moveDirX = 0;
      let moveDirZ = 0;
      let desiredSpeed = 0;
      let isSprinting = false;

      if (bot.stunTimer > 0) {
        desiredSpeed = 1.1;
        moveDirX = Math.cos(bot.yaw);
        moveDirZ = -Math.sin(bot.yaw);
        bot.aimLockTime = 0;
        bot.hasAimTarget = false;
      } else if (visibleTarget) {
        const tSpeed = Math.hypot(visibleTarget.velocity?.x || 0, visibleTarget.velocity?.z || 0);
        if (visibleTarget.sliding || !visibleTarget.onGround || tSpeed > 7.2) {
          bot.aimLockTime = Math.max(0, bot.aimLockTime - dt * 2.2);
        } else {
          bot.aimLockTime = Math.min(1.3, bot.aimLockTime + dt);
        }

        const desiredAimY = visibleTarget.position.y + (visibleTarget.sliding ? 0.68 : visibleTarget.crouched ? 0.92 : 1.32);
        if (!bot.hasAimTarget) {
          bot.hasAimTarget = true;
          bot.aimTargetPos.set(
            visibleTarget.position.x + (Math.random() - 0.5) * 1.1,
            desiredAimY + (Math.random() - 0.5) * 0.45,
            visibleTarget.position.z + (Math.random() - 0.5) * 1.1
          );
        } else {
          const trackRate =
            this.difficulty.id === "veteran" ? 10.5 : this.difficulty.id === "regular" ? 7.4 : 4.8;
          const evasiveSlowdown = visibleTarget.sliding || !visibleTarget.onGround ? 0.62 : 1.0;
          const lerpAmt = Math.min(1, dt * trackRate * evasiveSlowdown);
          bot.aimTargetPos.x += (visibleTarget.position.x - bot.aimTargetPos.x) * lerpAmt;
          bot.aimTargetPos.y += (desiredAimY - bot.aimTargetPos.y) * lerpAmt;
          bot.aimTargetPos.z += (visibleTarget.position.z - bot.aimTargetPos.z) * lerpAmt;
        }

        bot.lastThreatPos = visibleTarget.position.clone();
        bot.threatMemoryTimer = 6.5;

        const dx = visibleTarget.position.x - bot.position.x;
        const dz = visibleTarget.position.z - bot.position.z;
        const dy = (visibleTarget.position.y + (visibleTarget.crouched ? 0.95 : 1.35)) - (bot.position.y + 1.4);
        const dist = Math.hypot(dx, dz);

        bot.aimPitch = Math.max(-0.6, Math.min(0.6, Math.atan2(dy, Math.max(0.1, dist))));

        const targetYaw = Math.atan2(-dx, -dz);
        let diff = targetYaw - bot.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        bot.yaw += diff * Math.min(1, dt * 13);

        const lowHealth = bot.health < bot.maxHealth * 0.34;
        if ((lowHealth || bot.reloadTimer > 0) && dist > 5) {
          // Seek real cover or back-strafe
          if (!bot.coverSpot) {
            bot.coverSpot = this._findCoverNear(bot, visibleTarget.position);
          }
          if (bot.coverSpot) {
            const cx = bot.coverSpot.x - bot.position.x;
            const cz = bot.coverSpot.z - bot.position.z;
            const cd = Math.hypot(cx, cz);
            if (cd > 1.0) {
              moveDirX = cx / cd;
              moveDirZ = cz / cd;
              desiredSpeed = sprintSpeed * 0.92;
            }
          } else {
            const rx = -dz / Math.max(0.1, dist);
            const rz = dx / Math.max(0.1, dist);
            moveDirX = (-dx / Math.max(0.1, dist)) * 0.7 + rx * bot.strafeDir * 0.6;
            moveDirZ = (-dz / Math.max(0.1, dist)) * 0.7 + rz * bot.strafeDir * 0.6;
            desiredSpeed = combatSpeed;
          }
        } else {
          bot.coverSpot = null;
          // Smooth timed tactical strafe & occasional crouch/jump-peek (zero per-frame random flickering)
          bot.strafeTimer -= dt;
          if (bot.strafeTimer <= 0) {
            bot.strafeDir = Math.random() < 0.45 ? -bot.strafeDir : (Math.random() > 0.5 ? 1 : -1);
            bot.strafeTimer = 0.65 + Math.random() * 0.75;

            if (
              this.difficulty.id !== "recruit" &&
              dist > 6 &&
              dist < 26 &&
              !bot.crouched &&
              Math.random() < 0.28
            ) {
              bot.crouched = true;
              bot.crouchTimer = 0.55 + Math.random() * 0.45;
            }

            if (
              this.difficulty.id !== "recruit" &&
              bot.onGround &&
              bot.jumpCooldown <= 0 &&
              dist > 5 &&
              dist < 18 &&
              Math.random() < 0.25
            ) {
              bot.velocity.y = 6.7;
              bot.onGround = false;
              bot.jumpCooldown = 3.5;
            }
          }

          desiredSpeed = bot.crouched ? 2.4 : combatSpeed;
          const rx = -dz / Math.max(0.1, dist);
          const rz = dx / Math.max(0.1, dist);
          // Aggressive push if shotgun/SMG or far away; maintain spacing if very close
          const idealMin = bot.weapon.id === "spas12" ? 4.5 : 8.5;
          const push = dist > idealMin + 5 ? 0.55 : dist < idealMin - 2 ? -0.45 : 0.12;
          moveDirX = rx * bot.strafeDir + (dx / Math.max(0.1, dist)) * push;
          moveDirZ = rz * bot.strafeDir + (dz / Math.max(0.1, dist)) * push;
        }

        // Reaction & burst fire
        if (bot.reloadTimer <= 0) {
          if (bot.reactionTimer > 0) {
            bot.reactionTimer -= dt;
          } else if (bot.burstPauseTimer > 0) {
            bot.burstPauseTimer -= dt;
          } else if (bot.fireTimer <= 0) {
            if (bot.burstShotsLeft <= 0) {
              bot.burstShotsLeft = this.difficulty.id === "veteran" ? 5 + Math.floor(Math.random() * 5) : 4 + Math.floor(Math.random() * 4);
            }
            this._fireAtTarget(bot, visibleTarget, player, onPlayerHit, onBotKilled);
            bot.burstShotsLeft--;
            if (bot.burstShotsLeft <= 0) {
              bot.burstPauseTimer = this.difficulty.id === "veteran" ? 0.14 : 0.22 + Math.random() * 0.18;
            }
          }
        }
      } else {
        bot.aimLockTime = 0;
        bot.hasAimTarget = false;
        bot.aimPitch *= Math.max(0, 1 - dt * 10);
        bot.reactionTimer = Math.min(bot.reactionTimer, this.difficulty.reactionTime * 0.75);
        bot.repathTimer -= dt;

        if (bot.repathTimer <= 0 || bot.pathIndex >= bot.path.length) {
          bot.repathTimer = 0.75 + Math.random() * 0.55;
          const goal = this._pickHuntGoal(bot, player, activeHardpoint);
          if (goal) {
            bot.path = this.findPath(bot.position, goal);
            bot.pathIndex = 0;
          }
        }

        if (bot.path.length > 0 && bot.pathIndex < bot.path.length) {
          const wp = bot.path[bot.pathIndex];
          const dx = wp.x - bot.position.x;
          const dz = wp.z - bot.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 1.1) {
            bot.pathIndex++;
          } else {
            moveDirX = dx / dist;
            moveDirZ = dz / dist;
            // Walk cautiously when investigating nearby gunfire; sprint when traversing lanes
            const cautious = bot.investigateTimer > 0 && dist < 8;
            desiredSpeed = cautious ? combatSpeed * 0.92 : sprintSpeed;
            isSprinting = !cautious;
            const scanOffset = cautious ? Math.sin(performance.now() * 0.004 + bot.squadSlot) * 0.35 : 0;
            const targetYaw = Math.atan2(-moveDirX, -moveDirZ) + scanOffset;
            let diff = targetYaw - bot.yaw;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            bot.yaw += diff * Math.min(1, dt * 8);
          }
        }
      }

      // Soft bot-to-bot & teammate-to-player separation so squads don't stack
      let sepX = 0;
      let sepZ = 0;
      for (let j = 0; j < this.bots.length; j++) {
        if (i === j || !this.bots[j].alive) continue;
        const ox = bot.position.x - this.bots[j].position.x;
        const oz = bot.position.z - this.bots[j].position.z;
        const d2 = ox * ox + oz * oz;
        if (d2 > 0.001 && d2 < 1.35) {
          const d = Math.sqrt(d2);
          const f = (1.16 - d) * 2.4;
          sepX += (ox / d) * f;
          sepZ += (oz / d) * f;
        }
      }
      if (bot.isFriendly && player.alive) {
        const px = bot.position.x - player.position.x;
        const pz = bot.position.z - player.position.z;
        const pd2 = px * px + pz * pz;
        if (pd2 > 0.001 && pd2 < 5.5) {
          const pd = Math.sqrt(pd2);
          const f = (2.35 - pd) * 2.2;
          sepX += (px / pd) * f;
          sepZ += (pz / pd) * f;
        }
      }

      // Smooth acceleration steering
      const mLen = Math.hypot(moveDirX, moveDirZ);
      let targetVx = sepX;
      let targetVz = sepZ;
      if (mLen > 0.01 && desiredSpeed > 0) {
        targetVx += (moveDirX / mLen) * desiredSpeed;
        targetVz += (moveDirZ / mLen) * desiredSpeed;
      }

      const steerRate = bot.onGround ? 12.0 : 4.0;
      bot.velocity.x += (targetVx - bot.velocity.x) * Math.min(1, dt * steerRate);
      bot.velocity.z += (targetVz - bot.velocity.z) * Math.min(1, dt * steerRate);
      bot.velocity.y -= 21.5 * dt;

      const colH = bot.crouched ? 1.22 : 1.78;
      bot.onGround = this.physics.moveCharacter(bot.position, bot.velocity, 0.42, colH, dt, bot.onGround);

      if (!visibleTarget && desiredSpeed > 1.5 && Math.hypot(bot.velocity.x, bot.velocity.z) < 0.5) {
        bot.repathTimer = Math.min(bot.repathTimer, 0.12);
      }

      const spd2D = Math.hypot(bot.velocity.x, bot.velocity.z);
      const rightX = Math.cos(bot.yaw);
      const rightZ = -Math.sin(bot.yaw);
      const strafeInput = spd2D > 0.4 ? (bot.velocity.x * rightX + bot.velocity.z * rightZ) / Math.max(1, spd2D) : 0;

      bot.model.root.position.copy(bot.position);
      bot.model.root.rotation.y = bot.yaw;
      bot.model.updateAnimation(dt, spd2D, bot.crouched, true, bot.aimPitch, bot.stunTimer > 0, {
        isAiming: !!visibleTarget,
        isSprinting: isSprinting && spd2D > 4.2,
        strafeInput
      });
    }
  }

  clearBots() {
    for (const b of this.bots) {
      this.scene.remove(b.model.root);
      b.model.dispose();
    }
    this.bots.length = 0;

    for (const d of this.ammoDrops) {
      this.scene.remove(d.group);
    }
    this.ammoDrops.length = 0;
  }

  dispose() {
    this.clearBots();
    this.dropBoxGeo.dispose();
    this.dropBulletGeo.dispose();
    this.dropRingGeo.dispose();
    this.dropBoxMat.dispose();
    this.dropBrassMat.dispose();
    this.dropRingMat.dispose();
  }
}
