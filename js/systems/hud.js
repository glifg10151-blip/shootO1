// =========================================================
// BLACKLINE // OPS — Tactical HUD, UAV Minimap & Scoreboard
// =========================================================
import { KILLSTREAKS } from "../config/weapons.js";

export class HudManager {
  constructor() {
    this.hudEl = document.getElementById("hud");
    this.damageVignette = document.getElementById("damage-vignette");
    this.flashOverlay = document.getElementById("flash-overlay");
    this.dmgDirContainer = document.getElementById("damage-direction-container");
    this.sniperScope = document.getElementById("sniper-scope");

    // Minimap
    this.minimapCanvas = document.getElementById("minimap-canvas");
    this.minimapCtx = this.minimapCanvas.getContext("2d");
    this.minimapFrame = document.querySelector(".minimap-frame");
    this.minimapLabel = document.getElementById("minimap-zone-label");

    // Header
    this.modeBadge = document.getElementById("hud-mode-badge");
    this.leftTag = document.getElementById("hud-left-tag");
    this.rightTag = document.getElementById("hud-right-tag");
    this.scoreLeft = document.getElementById("hud-score-left");
    this.scoreRight = document.getElementById("hud-score-right");
    this.timerEl = document.getElementById("hud-timer");
    this.scoreLimitEl = document.getElementById("hud-score-limit");
    this.objBanner = document.getElementById("objective-banner");

    // Center
    this.killfeedEl = document.getElementById("killfeed");
    this.crosshairEl = document.getElementById("crosshair");
    this.hitmarkerEl = document.getElementById("hitmarker");
    this.interactPrompt = document.getElementById("interact-prompt");
    this.xpFeedEl = document.getElementById("xp-feed");
    this.streakBanner = document.getElementById("streak-banner");

    // Bottom Left
    this.stanceLabel = document.getElementById("stance-label");
    this.staminaBar = document.getElementById("stamina-bar-fill");
    this.armorVal = document.getElementById("armor-value");
    this.armorBar = document.getElementById("armor-bar-fill");
    this.hpVal = document.getElementById("hp-value");
    this.hpBar = document.getElementById("hp-bar-fill");
    this.ksSlots = [0, 1, 2].map((i) => document.getElementById(`ks-slot-${i}`));

    // Bottom Right
    this.weaponName = document.getElementById("weapon-name");
    this.weaponFiremode = document.getElementById("weapon-firemode");
    this.ammoMag = document.getElementById("ammo-mag");
    this.ammoReserve = document.getElementById("ammo-reserve");
    this.reloadInd = document.getElementById("reload-indicator");
    this.slot1Badge = document.getElementById("slot-1-badge");
    this.slot2Badge = document.getElementById("slot-2-badge");
    this.fragCount = document.getElementById("frag-count");
    this.flashCount = document.getElementById("flash-count");
    this.stimStatus = document.getElementById("stim-status");

    // Respawn & Scoreboard
    this.respawnOverlay = document.getElementById("respawn-overlay");
    this.respawnKiller = document.getElementById("respawn-killer");
    this.respawnWeapon = document.getElementById("respawn-weapon");
    this.respawnTimer = document.getElementById("respawn-timer");
    this.scoreboardOverlay = document.getElementById("scoreboard-overlay");
    this.scoreboardTitle = document.getElementById("scoreboard-title");
    this.scoreboardTbody = document.getElementById("scoreboard-tbody");

    this.hitmarkerTimer = 0;
    this.flashAlpha = 0;
    this.bannerTimer = 0;
    this.radarSweepAngle = 0;
    this.dmgArrows = [];
  }

  setVisible(visible) {
    this.hudEl.classList.toggle("hidden", !visible);
    if (!visible) {
      this.sniperScope.classList.add("hidden");
      this.respawnOverlay.classList.add("hidden");
      this.scoreboardOverlay.classList.add("hidden");
      this.damageVignette.style.opacity = "0";
      this.flashOverlay.style.opacity = "0";
    }
  }

  clearFeeds() {
    this.killfeedEl.innerHTML = "";
    this.xpFeedEl.innerHTML = "";
    this.dmgDirContainer.innerHTML = "";
    this.dmgArrows.length = 0;
    this.streakBanner.classList.add("hidden");
  }

  triggerHitmarker(isHeadshot = false, isArmor = false, isKill = false) {
    this.hitmarkerTimer = isKill ? 0.2 : 0.13;
    this.hitmarkerEl.classList.remove("headshot", "armor", "kill");
    this.hitmarkerEl.classList.add("active");
    if (isHeadshot) this.hitmarkerEl.classList.add("headshot");
    else if (isArmor) this.hitmarkerEl.classList.add("armor");
    if (isKill) this.hitmarkerEl.classList.add("kill");
  }

  triggerFlash(alpha = 0.85) {
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  }

  showStreakBanner(text) {
    this.streakBanner.textContent = text;
    this.streakBanner.classList.remove("hidden");
    this.bannerTimer = 3.2;
  }

  pushXpPopup(text, isBonus = false) {
    const div = document.createElement("div");
    div.className = `xp-item${isBonus ? " bonus" : ""}`;
    div.textContent = text;
    this.xpFeedEl.appendChild(div);
    while (this.xpFeedEl.children.length > 5) {
      this.xpFeedEl.firstChild.remove();
    }
    setTimeout(() => div.remove(), 1350);
  }

  pushKillfeed(killerName, killerTeam, victimName, victimTeam, weaponShort, isHeadshot) {
    const row = document.createElement("div");
    row.className = "kf-item";

    const kClass = killerTeam === "you" ? "kf-you" : killerTeam === "blue" ? "kf-blue" : "kf-red";
    const vClass = victimTeam === "you" ? "kf-you" : victimTeam === "blue" ? "kf-blue" : "kf-red";

    const kSpan = document.createElement("span");
    kSpan.className = kClass;
    kSpan.textContent = killerName;

    const wSpan = document.createElement("span");
    wSpan.className = "kf-weapon";
    wSpan.textContent = weaponShort;

    const vSpan = document.createElement("span");
    vSpan.className = vClass;
    vSpan.textContent = victimName;

    row.appendChild(kSpan);
    row.appendChild(wSpan);
    if (isHeadshot) {
      const hs = document.createElement("span");
      hs.className = "kf-hs";
      hs.textContent = "HS";
      row.appendChild(hs);
    }
    row.appendChild(vSpan);

    this.killfeedEl.prepend(row);
    while (this.killfeedEl.children.length > 6) {
      this.killfeedEl.lastChild.remove();
    }

    setTimeout(() => row.classList.add("fading"), 4500);
    setTimeout(() => row.remove(), 4900);
  }

  showDamageDirection(sourcePos, playerPos, playerYaw) {
    if (!sourcePos) return;
    const dx = sourcePos.x - playerPos.x;
    const dz = sourcePos.z - playerPos.z;
    const fwdX = -Math.sin(playerYaw);
    const fwdZ = -Math.cos(playerYaw);
    const rightX = Math.cos(playerYaw);
    const rightZ = -Math.sin(playerYaw);

    const localF = dx * fwdX + dz * fwdZ;
    const localR = dx * rightX + dz * rightZ;
    const deg = (Math.atan2(localR, localF) * 180) / Math.PI;

    const el = document.createElement("div");
    el.className = "dmg-arrow";
    el.style.transform = `rotate(${deg.toFixed(1)}deg)`;
    this.dmgDirContainer.appendChild(el);
    this.dmgArrows.push({ el, life: 0.85 });
  }

  updateScoreboard(visible, modeTitle, rows) {
    this.scoreboardOverlay.classList.toggle("hidden", !visible);
    if (!visible) return;
    this.scoreboardTitle.textContent = `${modeTitle} — SCOREBOARD`;
    this.scoreboardTbody.innerHTML = "";

    for (const r of rows) {
      const tr = document.createElement("tr");
      tr.className = r.isPlayer ? "row-you" : r.team === "blue" ? "row-blue" : "row-red";
      const kd = r.deaths > 0 ? (r.kills / r.deaths).toFixed(2) : r.kills.toFixed(2);
      tr.innerHTML = `
        <td>${r.name}</td>
        <td>${r.teamLabel}</td>
        <td>${r.kills}</td>
        <td>${r.deaths}</td>
        <td>${kd}</td>
        <td>${r.score}</td>
      `;
      this.scoreboardTbody.appendChild(tr);
    }
  }

  update(dt, state) {
    const {
      player,
      weaponSystem,
      killstreaks,
      botMgr,
      mapData,
      matchInfo,
      supplyPrompt
    } = state;

    // Hitmarker decay
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= dt;
      if (this.hitmarkerTimer <= 0) {
        this.hitmarkerEl.classList.remove("active", "headshot", "armor", "kill");
      }
    }

    // Flashbang whiteout decay
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 0.52);
      this.flashOverlay.style.opacity = this.flashAlpha.toFixed(3);
    }

    // Banner decay
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.streakBanner.classList.add("hidden");
    }

    // Directional damage indicators
    for (let i = this.dmgArrows.length - 1; i >= 0; i--) {
      const a = this.dmgArrows[i];
      a.life -= dt;
      if (a.life <= 0) {
        a.el.remove();
        this.dmgArrows.splice(i, 1);
      } else {
        a.el.style.opacity = Math.min(1, a.life / 0.85).toFixed(2);
      }
    }

    // Damage / Low-health blood vignette
    const hpRatio = player.health / player.maxHealth;
    const lowHpAlpha = player.alive && hpRatio < 0.45 ? (1 - hpRatio / 0.45) * 0.72 : 0;
    const pulse = lowHpAlpha > 0 ? 0.85 + 0.15 * Math.sin(performance.now() * 0.01) : 1;
    this.damageVignette.style.opacity = (lowHpAlpha * pulse).toFixed(2);

    // Sniper Scope & Crosshair
    this.sniperScope.classList.toggle("hidden", !weaponSystem.isScoped);
    const chOpacity = player.alive && !weaponSystem.isScoped ? Math.max(0, 1 - weaponSystem.adsProgress * 1.3) : 0;
    this.crosshairEl.style.opacity = chOpacity.toFixed(2);
    const gapPx = Math.min(58, Math.max(5, Math.round(weaponSystem.currentSpread * 520)));
    this.crosshairEl.style.setProperty("--ch-gap", `${gapPx}px`);

    // Supply Crate prompt
    if (supplyPrompt) {
      this.interactPrompt.textContent = supplyPrompt;
      this.interactPrompt.classList.remove("hidden");
    } else {
      this.interactPrompt.classList.add("hidden");
    }

    // Respawn Overlay
    if (!player.alive && matchInfo.respawnLeft > 0) {
      this.respawnOverlay.classList.remove("hidden");
      this.respawnKiller.textContent = matchInfo.lastKillerName;
      this.respawnWeapon.textContent = matchInfo.lastKillerWeapon;
      this.respawnTimer.textContent = matchInfo.respawnLeft.toFixed(1);
    } else {
      this.respawnOverlay.classList.add("hidden");
    }

    // Header Scores & Timer
    this.modeBadge.textContent = matchInfo.modeLabel;
    this.leftTag.textContent = matchInfo.leftTag;
    this.rightTag.textContent = matchInfo.rightTag;
    this.scoreLeft.textContent = matchInfo.leftScore;
    this.scoreRight.textContent = matchInfo.rightScore;
    this.scoreLimitEl.textContent = matchInfo.limitLabel;

    const totalSec = Math.max(0, Math.ceil(matchInfo.timeLeft));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    this.timerEl.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    if (matchInfo.objectiveText) {
      this.objBanner.textContent = matchInfo.objectiveText;
      this.objBanner.classList.remove("hidden", "contested", "danger");
      if (matchInfo.objectiveState === "contested") this.objBanner.classList.add("contested");
      else if (matchInfo.objectiveState === "danger") this.objBanner.classList.add("danger");
    } else {
      this.objBanner.classList.add("hidden");
    }

    // Vitals
    this.stanceLabel.textContent = player.overdriveTimer > 0 ? "OVERDRIVE" : player.getStanceLabel();
    this.staminaBar.style.width = `${Math.round(player.stamina)}%`;
    this.armorVal.textContent = Math.ceil(player.armor);
    this.armorBar.style.width = `${Math.round((player.armor / Math.max(1, player.maxArmor)) * 100)}%`;
    this.hpVal.textContent = Math.ceil(player.health);
    this.hpBar.style.width = `${Math.round((player.health / player.maxHealth) * 100)}%`;
    this.hpBar.classList.toggle("low-hp", player.health < 35);

    // Killstreak Slots
    for (let i = 0; i < KILLSTREAKS.length; i++) {
      const ks = KILLSTREAKS[i];
      const slotEl = this.ksSlots[i];
      const fill = slotEl.querySelector(".ks-fill");
      const isReady = killstreaks.ready[i];
      const isActive = (i === 0 && killstreaks.uavTimer > 0) || (i === 2 && killstreaks.gunshipTimer > 0);
      const pct = isReady ? 100 : Math.min(100, (killstreaks.currentStreak / ks.cost) * 100);
      fill.style.width = `${pct}%`;
      slotEl.classList.toggle("ready", isReady);
      slotEl.classList.toggle("active", isActive);
    }

    // Weapon & Equipment
    const activeSlot = weaponSystem.getActiveSlot();
    if (activeSlot) {
      this.weaponName.textContent = activeSlot.spec.name;
      this.weaponFiremode.textContent = activeSlot.spec.fireModeLabel;
      this.ammoMag.textContent = player.overdriveTimer > 0 ? "∞" : activeSlot.mag;
      this.ammoMag.classList.toggle("low-ammo", activeSlot.mag <= Math.ceil(activeSlot.spec.magSize * 0.25));
      this.ammoReserve.textContent = activeSlot.reserve;
      this.reloadInd.classList.toggle("hidden", !weaponSystem.reloading);
      this.slot1Badge.classList.toggle("active", weaponSystem.activeSlot === 0);
      this.slot2Badge.classList.toggle("active", weaponSystem.activeSlot === 1);
    }

    this.fragCount.textContent = weaponSystem.frags;
    this.flashCount.textContent = weaponSystem.flashes;
    const stimParent = this.stimStatus.parentElement;
    if (player.stimCooldown > 0) {
      this.stimStatus.textContent = `${Math.ceil(player.stimCooldown)}s`;
      stimParent.classList.add("cooldown");
    } else {
      this.stimStatus.textContent = "RDY";
      stimParent.classList.remove("cooldown");
    }

    // Render Tactical Minimap
    this._renderMinimap(dt, player, botMgr, killstreaks, mapData, matchInfo.activeHardpoint);
  }

  _renderMinimap(dt, player, botMgr, killstreaks, mapData, activeHardpoint) {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const scale = 3.0; // pixels per meter (~35m radar radius)

    const uavActive = killstreaks.uavTimer > 0;
    this.minimapFrame.classList.toggle("uav-active", uavActive);
    this.minimapLabel.textContent = uavActive
      ? `UAV ACTIVE // ${Math.ceil(killstreaks.uavTimer)}s`
      : killstreaks.gunshipTimer > 0
      ? `GUNSHIP // ${Math.ceil(killstreaks.gunshipTimer)}s`
      : "RADAR // ACTIVE";

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(8, 13, 21, 0.94)";
    ctx.fillRect(0, 0, w, h);

    // Subtle radar rings
    ctx.strokeStyle = "rgba(56, 189, 248, 0.12)";
    ctx.lineWidth = 1;
    for (const r of [35, 70, 100]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Transform into player-relative rotated space (up = player forward)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(player.yaw);

    // Helper: world (wx, wz) -> canvas local before yaw rotation
    // Note: at yaw=0, forward is -Z (up on canvas => -Y), right is +X (right on canvas => +X)
    const toLocal = (wx, wz) => ({
      x: (wx - player.position.x) * scale,
      y: (wz - player.position.z) * scale
    });

    // Draw map walls & containers
    ctx.fillStyle = "rgba(100, 116, 139, 0.45)";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
    ctx.lineWidth = 1;
    for (const s of mapData.solids) {
      if (s.yBase >= 3.3) continue; // skip rooftop parapets cluttering ground radar
      const p = toLocal(s.x, s.z);
      const bw = s.w * scale;
      const bd = s.d * scale;
      ctx.fillRect(p.x - bw * 0.5, p.y - bd * 0.5, bw, bd);
    }

    // Hardpoint zone circle
    if (activeHardpoint) {
      const hp = toLocal(activeHardpoint.x, activeHardpoint.z);
      ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
      ctx.fillStyle = "rgba(245, 158, 11, 0.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, activeHardpoint.radius * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Supply Crates
    ctx.fillStyle = "#38bdf8";
    for (const c of mapData.supplyCrates || []) {
      const sp = toLocal(c.x, c.z);
      ctx.fillRect(sp.x - 4, sp.y - 1.5, 8, 3);
      ctx.fillRect(sp.x - 1.5, sp.y - 4, 3, 8);
    }

    // Incoming Airstrike danger zones
    for (const strike of killstreaks.airstrikes) {
      const ap = toLocal(strike.center.x, strike.center.z);
      ctx.strokeStyle = "rgba(244, 63, 94, 0.9)";
      ctx.fillStyle = "rgba(244, 63, 94, 0.2)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ap.x, ap.y, 12 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Live Grenades
    ctx.fillStyle = "#facc15";
    for (const g of killstreaks.grenades) {
      const gp = toLocal(g.pos.x, g.pos.z);
      ctx.beginPath();
      ctx.arc(gp.x, gp.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bots (Allies always shown; Enemies shown on UAV, Gunfire, or close Survival pulse)
    for (const bot of botMgr.bots) {
      if (!bot.alive) continue;
      const bp = toLocal(bot.position.x, bot.position.z);
      const distMeters = Math.hypot(bot.position.x - player.position.x, bot.position.z - player.position.z);

      if (bot.isFriendly) {
        ctx.save();
        ctx.translate(bp.x, bp.y);
        ctx.rotate(-bot.yaw);
        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(4.5, 4.5);
        ctx.lineTo(-4.5, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        const revealed =
          uavActive ||
          bot.radarRevealTimer > 0 ||
          (botMgr.mode === "survival" && distMeters < 20);
        if (!revealed) continue;

        ctx.save();
        ctx.translate(bp.x, bp.y);
        if (uavActive) {
          ctx.rotate(-bot.yaw);
          ctx.fillStyle = "#f43f5e";
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(4.5, 4.5);
          ctx.lineTo(-4.5, 4.5);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillStyle = "#f43f5e";
          ctx.beginPath();
          ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    ctx.restore();

    // UAV Sweeping Pulse Ring
    if (uavActive) {
      this.radarSweepAngle = (this.radarSweepAngle + dt * 2.6) % (Math.PI * 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.radarSweepAngle);
      const grad = ctx.createLinearGradient(0, 0, 0, -105);
      grad.addColorStop(0, "rgba(245, 158, 11, 0.35)");
      grad.addColorStop(1, "rgba(245, 158, 11, 0)");
      ctx.strokeStyle = "rgba(245, 158, 11, 0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -105);
      ctx.stroke();
      ctx.restore();
    }

    // Player Center Marker & Vision Cone
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "rgba(250, 204, 21, 0.14)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 42, -Math.PI * 0.72, -Math.PI * 0.28);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  airstrikeCanvasToWorld(clientX, clientY, canvas, mapData) {
    const rect = canvas.getBoundingClientRect();
    const mx = ((clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
    const my = ((clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
    const pad = 20;
    const drawSpan = canvas.width - pad * 2;
    const scale = drawSpan / (Math.max(mapData.halfW, mapData.halfD) * 2);
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.5;

    const wx = Math.max(-mapData.halfW + 4, Math.min(mapData.halfW - 4, (mx - cx) / scale));
    const wz = Math.max(-mapData.halfD + 4, Math.min(mapData.halfD - 4, (my - cy) / scale));
    return { x: wx, z: wz };
  }

  renderAirstrikeMap(canvas, mapData, player, botMgr, activeHardpoint, hoverWorld, strikeAngle) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const pad = 20;
    const drawSpan = w - pad * 2;
    const scale = drawSpan / (Math.max(mapData.halfW, mapData.halfD) * 2);
    const cx = w * 0.5;
    const cy = h * 0.5;
    const toPx = (wx, wz) => ({ x: cx + wx * scale, y: cy + wz * scale });

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#060d17";
    ctx.fillRect(0, 0, w, h);

    // Tactical grid & sector markings
    const arenaW = mapData.halfW * 2 * scale;
    const arenaD = mapData.halfD * 2 * scale;
    const left = cx - arenaW * 0.5;
    const top = cy - arenaD * 0.5;

    ctx.strokeStyle = "rgba(56, 189, 248, 0.12)";
    ctx.lineWidth = 1;
    const stepM = 14;
    for (let x = -mapData.halfW; x <= mapData.halfW; x += stepM) {
      const px = cx + x * scale;
      ctx.beginPath();
      ctx.moveTo(px, top);
      ctx.lineTo(px, top + arenaD);
      ctx.stroke();
    }
    for (let z = -mapData.halfD; z <= mapData.halfD; z += stepM) {
      const py = cy + z * scale;
      ctx.beginPath();
      ctx.moveTo(left, py);
      ctx.lineTo(left + arenaW, py);
      ctx.stroke();
    }

    // Arena outline
    ctx.strokeStyle = "rgba(56, 189, 248, 0.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, arenaW, arenaD);

    // Map geometry (walls, containers, decks)
    for (const s of mapData.solids) {
      const pt = toPx(s.x, s.z);
      const bw = s.w * scale;
      const bd = s.d * scale;
      if (s.yBase >= 2.5) {
        ctx.fillStyle = "rgba(148, 163, 184, 0.35)";
        ctx.strokeStyle = "rgba(226, 232, 240, 0.4)";
      } else {
        ctx.fillStyle = "rgba(51, 65, 85, 0.85)";
        ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
      }
      ctx.lineWidth = 1;
      ctx.fillRect(pt.x - bw * 0.5, pt.y - bd * 0.5, bw, bd);
      ctx.strokeRect(pt.x - bw * 0.5, pt.y - bd * 0.5, bw, bd);
    }

    // Ramps
    ctx.fillStyle = "rgba(245, 158, 11, 0.25)";
    for (const r of mapData.ramps || []) {
      const pt = toPx(r.x, r.z);
      ctx.fillRect(pt.x - (r.w * scale) * 0.5, pt.y - (r.d * scale) * 0.5, r.w * scale, r.d * scale);
    }

    // Hardpoint zone
    if (activeHardpoint) {
      const hp = toPx(activeHardpoint.x, activeHardpoint.z);
      ctx.fillStyle = "rgba(245, 158, 11, 0.16)";
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, activeHardpoint.radius * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Supply Crates
    ctx.fillStyle = "#38bdf8";
    for (const c of mapData.supplyCrates || []) {
      const sp = toPx(c.x, c.z);
      ctx.fillRect(sp.x - 4, sp.y - 1.5, 8, 3);
      ctx.fillRect(sp.x - 1.5, sp.y - 4, 3, 8);
    }

    // Friendly & Enemy Operators (CAS Recon sweep reveals live targets on tablet)
    const pulse = 0.65 + 0.35 * Math.sin(performance.now() * 0.01);
    for (const bot of botMgr.bots) {
      if (!bot.alive) continue;
      const bp = toPx(bot.position.x, bot.position.z);
      if (bot.isFriendly) {
        ctx.save();
        ctx.translate(bp.x, bp.y);
        ctx.rotate(-bot.yaw);
        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(4.5, 4.5);
        ctx.lineTo(-4.5, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = `rgba(244, 63, 94, ${pulse.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, 4.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(254, 205, 211, 0.85)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, 7.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Player Marker
    const pp = toPx(player.position.x, player.position.z);
    ctx.save();
    ctx.translate(pp.x, pp.y);
    ctx.rotate(-player.yaw);
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 5.5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-5.5, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Precision Airstrike Interactive Target Corridor Preview
    if (hoverWorld) {
      const hp = toPx(hoverWorld.x, hoverWorld.z);
      const runLenPx = 24 * scale;
      const runWidPx = 11 * scale;

      ctx.save();
      ctx.translate(hp.x, hp.y);
      ctx.rotate(strikeAngle);

      // Killzone corridor box
      ctx.fillStyle = "rgba(244, 63, 94, 0.2)";
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.fillRect(-runLenPx * 0.5, -runWidPx * 0.5, runLenPx, runWidPx);
      ctx.strokeRect(-runLenPx * 0.5, -runWidPx * 0.5, runLenPx, runWidPx);
      ctx.setLineDash([]);

      // 6 Bomb drop impact points along flight axis
      for (let i = 0; i < 6; i++) {
        const bx = (i - 2.5) * 4.4 * scale;
        ctx.strokeStyle = "rgba(251, 191, 36, 0.9)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(bx, 0, 4.2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Flight direction arrow
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-runLenPx * 0.68, 0);
      ctx.lineTo(runLenPx * 0.68, 0);
      ctx.lineTo(runLenPx * 0.68 - 9, -6);
      ctx.moveTo(runLenPx * 0.68, 0);
      ctx.lineTo(runLenPx * 0.68 - 9, 6);
      ctx.stroke();
      ctx.restore();

      // Target coordinates badge
      ctx.fillStyle = "rgba(6, 10, 18, 0.85)";
      ctx.fillRect(left + 6, top + 6, 152, 20);
      ctx.fillStyle = "#fde047";
      ctx.font = "bold 11px monospace";
      ctx.fillText(
        `STRIKE: ${hoverWorld.x >= 0 ? "+" : ""}${hoverWorld.x.toFixed(0)}m, ${hoverWorld.z >= 0 ? "+" : ""}${hoverWorld.z.toFixed(0)}m`,
        left + 12,
        top + 20
      );
    }
  }
}
