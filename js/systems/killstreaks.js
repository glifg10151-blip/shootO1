// =========================================================
// BLACKLINE // OPS — Grenades, Killstreaks & Supply Crates
// =========================================================
import * as THREE from "three";
import { KILLSTREAKS } from "../config/weapons.js";

export class KillstreakSystem {
  constructor(scene, physics, particles, audio, mapData) {
    this.scene = scene;
    this.physics = physics;
    this.particles = particles;
    this.audio = audio;
    this.mapData = mapData;

    this.currentStreak = 0;
    this.ready = [false, false, false];
    this.unlockedThisLife = [false, false, false];

    this.uavTimer = 0;
    this.uavPingTimer = 0;
    this.gunshipTimer = 0;
    this.gunshipShotTimer = 0;

    this.grenades = [];
    this.airstrikes = [];
    this.crateCooldowns = (mapData.supplyCrates || []).map(() => 0);

    this.fragGeo = new THREE.SphereGeometry(0.09, 10, 10);
    this.fragMat = new THREE.MeshStandardMaterial({ color: 0x3b4d2b, roughness: 0.6, metalness: 0.35 });
    this.flashGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10);
    this.flashMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.7 });
  }

  resetForNewMatch() {
    this.currentStreak = 0;
    this.ready = [false, false, false];
    this.unlockedThisLife = [false, false, false];
    this.uavTimer = 0;
    this.gunshipTimer = 0;
    this.clearProjectiles();
  }

  onPlayerDeath() {
    this.currentStreak = 0;
    this.unlockedThisLife = [false, false, false];
  }

  onPlayerKill(onAnnounce) {
    this.currentStreak += 1;
    for (let i = 0; i < KILLSTREAKS.length; i++) {
      const ks = KILLSTREAKS[i];
      if (!this.unlockedThisLife[i] && this.currentStreak >= ks.cost) {
        this.unlockedThisLife[i] = true;
        this.ready[i] = true;
        this.audio.playStreakReady();
        if (onAnnounce) {
          onAnnounce(`${ks.name} READY — PRESS [${i + 4}]`);
        }
      }
    }
  }

  throwGrenade(type, player, weaponSystem) {
    if (!player.alive) return false;
    if (type === "frag" && weaponSystem.frags <= 0) return false;
    if (type === "flash" && weaponSystem.flashes <= 0) return false;

    if (type === "frag") weaponSystem.frags -= 1;
    else weaponSystem.flashes -= 1;

    weaponSystem.triggerThrowAnim();

    const origin = player.getEyePosition();
    const dir = player.getAimDirection();
    const spawnPos = origin.clone().addScaledVector(dir, 0.55);

    const vel = dir.clone().multiplyScalar(20.5);
    vel.y += 3.8;

    const mesh = new THREE.Mesh(
      type === "frag" ? this.fragGeo : this.flashGeo,
      type === "frag" ? this.fragMat : this.flashMat
    );
    mesh.position.copy(spawnPos);
    this.scene.add(mesh);

    this.grenades.push({
      type,
      mesh,
      pos: spawnPos,
      vel,
      fuse: type === "frag" ? 1.85 : 1.2
    });
    return true;
  }

  launchAirstrikeAt(worldX, worldZ, strikeAngleRad, player, onAnnounce) {
    if (!player.alive || !this.ready[1]) return false;
    this.ready[1] = false;

    const tx = Math.max(-this.mapData.halfW + 4, Math.min(this.mapData.halfW - 4, worldX));
    const tz = Math.max(-this.mapData.halfD + 4, Math.min(this.mapData.halfD - 4, worldZ));
    const targetPos = new THREE.Vector3(tx, 0, tz);

    const axis = new THREE.Vector3(Math.cos(strikeAngleRad), 0, Math.sin(strikeAngleRad)).normalize();
    const perp = new THREE.Vector3(-axis.z, 0, axis.x);

    const flightSpan = Math.max(this.mapData.halfW, this.mapData.halfD) + 55;
    const jetStart1 = targetPos.clone().addScaledVector(axis, -flightSpan).add(new THREE.Vector3(0, 36, 0));
    const jetEnd1 = targetPos.clone().addScaledVector(axis, flightSpan).add(new THREE.Vector3(0, 36, 0));
    const jetStart2 = jetStart1.clone().addScaledVector(perp, 6.5);
    const jetEnd2 = jetEnd1.clone().addScaledVector(perp, 6.5);

    this.particles.spawnJetFlyover(jetStart1, jetEnd1, 2.3);
    this.particles.spawnJetFlyover(jetStart2, jetEnd2, 2.45);
    this.audio.playAirstrikeJet();

    const bombs = [];
    for (let i = 0; i < 6; i++) {
      const offset = (i - 2.5) * 4.4;
      const bx = targetPos.x + axis.x * offset + (Math.random() - 0.5) * 2.2;
      const bz = targetPos.z + axis.z * offset + (Math.random() - 0.5) * 2.2;
      const by = this.physics.getSurfaceHeightAt(bx, bz, 12);
      bombs.push({
        pos: new THREE.Vector3(bx, by + 0.15, bz),
        delay: 0.72 + i * 0.18,
        detonated: false
      });
    }

    this.airstrikes.push({
      center: targetPos,
      axis,
      bombs,
      life: 2.8
    });

    if (onAnnounce) onAnnounce("PRECISION AIRSTRIKE INBOUND ON TARGET!");
    return true;
  }

  activateStreak(slotIdx, player, onAnnounce) {
    if (!player.alive || !this.ready[slotIdx]) return false;
    this.ready[slotIdx] = false;

    if (slotIdx === 0) {
      // UAV Recon
      this.uavTimer = KILLSTREAKS[0].duration;
      this.uavPingTimer = 0;
      this.audio.playUavPing();
      if (onAnnounce) onAnnounce("UAV RECON ONLINE — HOSTILES REVEALED");
      return true;
    }

    if (slotIdx === 1) {
      // Fallback raycast strike if triggered directly without map tablet
      const eye = player.getEyePosition();
      const dir = player.getAimDirection();
      const hit = this.physics.raycastWorld(eye, dir, 95);
      const tx = hit.hit ? hit.point.x : player.position.x + dir.x * 26;
      const tz = hit.hit ? hit.point.z : player.position.z + dir.z * 26;
      this.ready[1] = true; // launchAirstrikeAt consumes ready[1]
      return this.launchAirstrikeAt(tx, tz, -player.yaw, player, onAnnounce);
    }

    if (slotIdx === 2) {
      // Gunship Overdrive
      this.gunshipTimer = KILLSTREAKS[2].duration;
      this.gunshipShotTimer = 0.35;
      player.overdriveTimer = KILLSTREAKS[2].duration;
      player.armor = player.maxArmor;
      player.health = player.maxHealth;
      this.audio.playStreakReady();
      if (onAnnounce) onAnnounce("AC-130 GUNSHIP & OVERDRIVE DEPLOYED!");
      return true;
    }

    return false;
  }

  checkNearbySupply(playerPos) {
    const crates = this.mapData.supplyCrates || [];
    for (let i = 0; i < crates.length; i++) {
      const c = crates[i];
      const dist = Math.hypot(playerPos.x - c.x, playerPos.z - c.z);
      if (dist <= 2.7 && Math.abs(playerPos.y - c.y) < 1.5) {
        return { index: i, cooldown: this.crateCooldowns[i] };
      }
    }
    return null;
  }

  tryUseSupply(player, weaponSystem) {
    const near = this.checkNearbySupply(player.position);
    if (!near || near.cooldown > 0) return false;
    this.crateCooldowns[near.index] = 14.0;
    player.resupply();
    weaponSystem.resupplyAll();
    this.audio.playPickup();
    return true;
  }

  _detonateExplosion(pos, radius, maxDamage, weaponShort, player, botMgr, onDamageBot, onPlayerHit) {
    this.particles.spawnExplosion(pos, radius / 6.5);

    const distToPlayer = pos.distanceTo(player.position);
    const toPos = new THREE.Vector3().subVectors(pos, player.position);
    const rightVec = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const pan = distToPlayer > 0.1 ? rightVec.dot(toPos.normalize()) : 0;

    this.audio.playExplosion(distToPlayer, pan);
    if (distToPlayer < 24) {
      player.addCameraShake(Math.max(0.01, (1 - distToPlayer / 24) * 0.11));
    }

    // Damage hostile bots with LOS occlusion
    const blastOrigin = new THREE.Vector3(pos.x, pos.y + 0.35, pos.z);
    for (const bot of botMgr.bots) {
      if (!bot.alive || bot.isFriendly) continue;
      const d = bot.position.distanceTo(pos);
      if (d <= radius) {
        const botMid = new THREE.Vector3(bot.position.x, bot.position.y + 1.0, bot.position.z);
        if (this.physics.hasLineOfSight(blastOrigin, botMid) || d < 2.2) {
          const dmg = maxDamage * (1 - (d / radius) * 0.72);
          if (onDamageBot) onDamageBot(bot, dmg, "torso", botMid, { shortName: weaponShort, id: weaponShort });
        }
      }
    }

    // Self-damage on close player frag (capped for fairness)
    if (weaponShort === "FRAG" && player.alive && distToPlayer < radius * 0.75) {
      const pEye = player.getEyePosition();
      if (this.physics.hasLineOfSight(blastOrigin, pEye)) {
        const selfDmg = 62 * (1 - distToPlayer / (radius * 0.75));
        const res = player.takeDamage(selfDmg, pos);
        if (onPlayerHit) onPlayerHit(res, { callsign: "SELF" }, "FRAG");
      }
    }
  }

  update(dt, player, botMgr, hud, onDamageBot, onPlayerHit) {
    // Crate cooldowns
    for (let i = 0; i < this.crateCooldowns.length; i++) {
      if (this.crateCooldowns[i] > 0) this.crateCooldowns[i] = Math.max(0, this.crateCooldowns[i] - dt);
    }

    // UAV Timer
    if (this.uavTimer > 0) {
      this.uavTimer = Math.max(0, this.uavTimer - dt);
      this.uavPingTimer -= dt;
      if (this.uavPingTimer <= 0) {
        this.uavPingTimer = 3.8;
        this.audio.playUavPing();
      }
    }

    // Gunship Overdrive Automated Barrage
    if (this.gunshipTimer > 0) {
      this.gunshipTimer = Math.max(0, this.gunshipTimer - dt);
      this.gunshipShotTimer -= dt;
      if (this.gunshipShotTimer <= 0) {
        this.gunshipShotTimer = 1.45;
        const enemies = botMgr.bots.filter((b) => b.alive && !b.isFriendly);
        if (enemies.length > 0) {
          const target = enemies[Math.floor(Math.random() * enemies.length)];
          const impact = target.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.4, 0.2, (Math.random() - 0.5) * 1.4));
          const skyOrigin = impact.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, 36, (Math.random() - 0.5) * 8));
          this.particles.spawnTracer(skyOrigin, impact, 0x38bdf8, 3.2);
          this._detonateExplosion(impact, 6.2, 145, "AC-130", player, botMgr, onDamageBot, onPlayerHit);
        }
      }
    }

    // Update Active Grenades
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.vel.y -= 19.5 * dt;
      const res = this.physics.stepProjectile(g.pos, g.vel, 0.1, dt, 0.48);
      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x += g.vel.z * dt * 2;
      g.mesh.rotation.z -= g.vel.x * dt * 2;

      if (res.bounced && res.speed > 2.2) {
        const d = g.pos.distanceTo(player.position);
        this.audio.playGrenadeBounce(d, 0);
      }

      g.fuse -= dt;
      if (g.fuse <= 0) {
        this.scene.remove(g.mesh);
        if (g.type === "frag") {
          this._detonateExplosion(g.pos, 7.6, 170, "FRAG", player, botMgr, onDamageBot, onPlayerHit);
        } else {
          // Flashbang detonation
          const d = g.pos.distanceTo(player.position);
          this.audio.playFlashbang(d);
          const stunned = botMgr.stunBotsInRadius(g.pos, 9.5);
          if (stunned > 0 && hud) {
            hud.triggerHitmarker(false, false, false);
          }
          if (d < 8.5) {
            const pEye = player.getEyePosition();
            if (this.physics.hasLineOfSight(g.pos, pEye) && hud) {
              hud.triggerFlash(Math.max(0.25, 1 - d / 8.5) * 0.85);
            }
          }
        }
        this.grenades.splice(i, 1);
      }
    }

    // Update Airstrikes
    for (let i = this.airstrikes.length - 1; i >= 0; i--) {
      const a = this.airstrikes[i];
      a.life -= dt;
      for (const b of a.bombs) {
        if (!b.detonated) {
          b.delay -= dt;
          if (b.delay <= 0) {
            b.detonated = true;
            this._detonateExplosion(b.pos, 8.8, 195, "AIRSTRIKE", player, botMgr, onDamageBot, onPlayerHit);
          }
        }
      }
      if (a.life <= 0) {
        this.airstrikes.splice(i, 1);
      }
    }
  }

  clearProjectiles() {
    for (const g of this.grenades) {
      this.scene.remove(g.mesh);
    }
    this.grenades.length = 0;
    this.airstrikes.length = 0;
  }

  dispose() {
    this.clearProjectiles();
    this.fragGeo.dispose();
    this.fragMat.dispose();
    this.flashGeo.dispose();
    this.flashMat.dispose();
  }
}
