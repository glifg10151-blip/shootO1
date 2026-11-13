// =========================================================
// BLACKLINE // OPS — Main Orchestrator & Game Loop
// =========================================================
import * as THREE from "three";
import { WEAPONS, PERKS } from "./config/weapons.js";
import { MAPS } from "./config/maps.js";
import { TextureManager } from "./engine/textures.js";
import { SoundEngine } from "./engine/audio.js";
import { PhysicsWorld } from "./engine/physics.js";
import { MapBuilder } from "./systems/mapBuilder.js";
import { ParticleSystem } from "./systems/particles.js";
import { PlayerController } from "./systems/player.js";
import { WeaponSystem } from "./systems/weaponSystem.js";
import { BotManager } from "./systems/botAI.js";
import { KillstreakSystem } from "./systems/killstreaks.js";
import { HudManager } from "./systems/hud.js";
import { GameModeManager, loadCareer, getRankProgress } from "./systems/gameMode.js";

const viewport = document.getElementById("viewport");
const lobbyScreen = document.getElementById("lobby-screen");
const pauseScreen = document.getElementById("pause-screen");
const gameoverScreen = document.getElementById("gameover-screen");
const airstrikeModal = document.getElementById("airstrike-modal");
const airstrikeCanvas = document.getElementById("airstrike-canvas");
const btnCancelAirstrike = document.getElementById("btn-cancel-airstrike");

// Lobby controls
const selectMap = document.getElementById("select-map");
const selectMode = document.getElementById("select-mode");
const selectDiff = document.getElementById("select-difficulty");
const selectPrimary = document.getElementById("select-primary");
const selectSecondary = document.getElementById("select-secondary");
const selectPerk = document.getElementById("select-perk");
const primaryStatsBox = document.getElementById("primary-stats");
const inputSens = document.getElementById("input-sens");
const sensVal = document.getElementById("sens-val");
const inputFov = document.getElementById("input-fov");
const fovVal = document.getElementById("fov-val");
const selectQuality = document.getElementById("select-quality");
const btnDeploy = document.getElementById("btn-deploy");

// Career badge
const careerRankTitle = document.getElementById("career-rank-title");
const careerStatsLine = document.getElementById("career-stats-line");
const careerXpFill = document.getElementById("career-xp-fill");

// Pause controls
const pauseSens = document.getElementById("pause-sens");
const pauseSensVal = document.getElementById("pause-sens-val");
const pauseFov = document.getElementById("pause-fov");
const pauseFovVal = document.getElementById("pause-fov-val");
const pauseVol = document.getElementById("pause-volume");
const pauseVolVal = document.getElementById("pause-vol-val");
const pausePrimary = document.getElementById("pause-primary");
const pauseSecondary = document.getElementById("pause-secondary");
const btnResume = document.getElementById("btn-resume");
const btnRestart = document.getElementById("btn-restart");
const btnQuitLobby = document.getElementById("btn-quit-lobby");

// Game Over controls
const goResult = document.getElementById("gameover-result");
const goSub = document.getElementById("gameover-sub");
const goStats = document.getElementById("gameover-stats");
const goScoreboard = document.getElementById("gameover-scoreboard");
const btnPlayAgain = document.getElementById("btn-play-again");
const btnBackLobby = document.getElementById("btn-back-lobby");

// Core Engine State
const audio = new SoundEngine();
const hud = new HudManager();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(82, window.innerWidth / window.innerHeight, 0.08, 320);

const settings = {
  sensitivity: 1.0,
  fov: 82,
  volume: 0.8,
  quality: "high"
};

let activeMatch = null;
let paused = false;
let airstrikeOpen = false;
let airstrikeHover = { x: 0, z: 0 };
let airstrikeAngle = 0;
let lastFrameTime = performance.now();

const keys = {};
const mouseState = {
  fireHeld: false,
  fireJustPressed: false,
  aimHeld: false,
  tabHeld: false
};

// ---------------- Lobby UI & Stat Preview ----------------

function refreshCareerUI() {
  const c = loadCareer();
  const prog = getRankProgress(c.xp);
  careerRankTitle.textContent = `RANK ${prog.current.level} // ${prog.current.title}`;
  careerStatsLine.textContent = `${c.kills} KILLS • ${c.bestStreak} BEST STREAK • ${c.wins} WINS`;
  careerXpFill.style.width = `${prog.pct.toFixed(1)}%`;
}

function renderWeaponBars(weaponId) {
  const w = WEAPONS[weaponId] || WEAPONS.m4a1;
  const rows = [
    ["DAMAGE", w.uiBars.damage],
    ["FIRE RATE", w.uiBars.fireRate],
    ["RANGE", w.uiBars.range],
    ["MOBILITY", w.uiBars.mobility]
  ];
  primaryStatsBox.innerHTML = rows
    .map(
      ([lbl, val]) => `
      <div class="stat-bar-row">
        <span>${lbl}</span>
        <div class="stat-track"><div class="stat-fill" style="width:${val}%"></div></div>
        <span>${val}</span>
      </div>
    `
    )
    .join("");
}

selectPrimary.addEventListener("change", () => renderWeaponBars(selectPrimary.value));

inputSens.addEventListener("input", () => {
  settings.sensitivity = parseFloat(inputSens.value);
  sensVal.textContent = settings.sensitivity.toFixed(2);
  pauseSens.value = inputSens.value;
  pauseSensVal.textContent = settings.sensitivity.toFixed(2);
});

inputFov.addEventListener("input", () => {
  settings.fov = parseInt(inputFov.value, 10);
  fovVal.textContent = settings.fov;
  pauseFov.value = inputFov.value;
  pauseFovVal.textContent = settings.fov;
});

pauseSens.addEventListener("input", () => {
  settings.sensitivity = parseFloat(pauseSens.value);
  pauseSensVal.textContent = settings.sensitivity.toFixed(2);
  inputSens.value = pauseSens.value;
  sensVal.textContent = settings.sensitivity.toFixed(2);
});

pauseFov.addEventListener("input", () => {
  settings.fov = parseInt(pauseFov.value, 10);
  pauseFovVal.textContent = settings.fov;
  inputFov.value = pauseFov.value;
  fovVal.textContent = settings.fov;
  if (activeMatch) activeMatch.player.baseFov = settings.fov;
});

pauseVol.addEventListener("input", () => {
  const v = parseInt(pauseVol.value, 10);
  pauseVolVal.textContent = v;
  settings.volume = v / 100;
  audio.setVolume(settings.volume);
});

// ---------------- Match Lifecycle ----------------

function openAirstrikeTablet() {
  if (!activeMatch || paused || activeMatch.gameMode.matchEnded) return;
  const { player, killstreaks } = activeMatch;
  if (!player.alive || !killstreaks.ready[1]) return;

  airstrikeOpen = true;
  airstrikeHover = { x: player.position.x, z: player.position.z };
  airstrikeAngle = Math.atan2(-Math.cos(player.yaw), -Math.sin(player.yaw));

  mouseState.fireHeld = false;
  mouseState.aimHeld = false;
  mouseState.tabHeld = false;
  for (const k of Object.keys(keys)) keys[k] = false;

  airstrikeModal.classList.remove("hidden");
  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock?.();
  }
}

function closeAirstrikeTablet(relock = true) {
  if (!airstrikeOpen) return;
  airstrikeOpen = false;
  airstrikeModal.classList.add("hidden");
  if (relock && activeMatch && !paused && !activeMatch.gameMode.matchEnded) {
    requestLockSafe();
  }
}

function cleanupMatch() {
  airstrikeOpen = false;
  airstrikeModal.classList.add("hidden");
  if (!activeMatch) return;
  activeMatch.mapBuilder.dispose();
  activeMatch.texMgr.dispose();
  activeMatch.particles.dispose();
  activeMatch.botMgr.dispose();
  activeMatch.weaponSystem.dispose();
  activeMatch.killstreaks.dispose();
  scene.remove(camera);
  activeMatch = null;
}

function startMatch() {
  cleanupMatch();
  audio.unlock();
  audio.setVolume(settings.volume);

  const mapData = MAPS[selectMap.value] || MAPS.killhouse;
  const mode = selectMode.value || "tdm";
  const diff = selectDiff.value || "regular";
  const primaryId = selectPrimary.value || "m4a1";
  const secondaryId = selectSecondary.value || "deagle";
  const perk = PERKS[selectPerk.value] || PERKS.sleight;
  settings.quality = selectQuality.value || "high";

  pausePrimary.value = primaryId;
  pauseSecondary.value = secondaryId;

  renderer.shadowMap.enabled = settings.quality !== "low";
  renderer.shadowMap.needsUpdate = true;

  const texMgr = new TextureManager(renderer.capabilities.getMaxAnisotropy());
  const mapBuilder = new MapBuilder(scene, texMgr, settings.quality);
  mapBuilder.build(mapData);

  const physics = new PhysicsWorld(mapData);
  const particles = new ParticleSystem(scene);

  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
  scene.add(camera);

  const player = new PlayerController(camera, physics, audio, perk);
  player.baseFov = settings.fov;
  player.currentFov = settings.fov;

  const weaponSystem = new WeaponSystem(camera, physics, particles, audio, player);
  weaponSystem.equipLoadout(primaryId, secondaryId, perk);

  const botMgr = new BotManager(scene, physics, particles, audio, mapData);
  const killstreaks = new KillstreakSystem(scene, physics, particles, audio, mapData);
  const gameMode = new GameModeManager(mode, mapData);

  // Spawn Player at safest initial team/FFA spawn
  const initPool = mode === "ffa" || mode === "survival" ? mapData.spawns.ffa : mapData.spawns.blue;
  const sp = initPool[Math.floor(Math.random() * initPool.length)];
  player.spawn(sp.x, sp.y, sp.z, sp.yaw || 0);

  botMgr.spawnSquad(mode, diff, player.position);

  // Damage direction indicator hook
  player.onDamageTaken = (amount, sourcePos) => {
    if (amount > 0 && sourcePos) {
      hud.showDamageDirection(sourcePos, player.position, player.yaw);
    }
  };

  activeMatch = {
    mapData,
    mode,
    diff,
    perk,
    pendingPrimary: primaryId,
    pendingSecondary: secondaryId,
    texMgr,
    mapBuilder,
    physics,
    particles,
    player,
    weaponSystem,
    botMgr,
    killstreaks,
    gameMode
  };

  paused = false;
  hud.clearFeeds();
  hud.setVisible(true);
  lobbyScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  gameoverScreen.classList.add("hidden");
  hud.showStreakBanner(`${mapData.name} — WEAPONS FREE`);

  requestLockSafe();
}

function requestLockSafe() {
  if (document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock?.();
  }
}

function showGameOverScreen() {
  if (!activeMatch) return;
  const { gameMode, weaponSystem, botMgr } = activeMatch;
  airstrikeOpen = false;
  airstrikeModal.classList.add("hidden");
  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock?.();
  }
  hud.setVisible(false);
  pauseScreen.classList.add("hidden");
  gameoverScreen.classList.remove("hidden");

  const res = gameMode.result || { victory: true, title: "MATCH COMPLETE", subtitle: "" };
  goResult.textContent = res.title;
  goResult.className = `gameover-title ${res.victory ? "victory" : "defeat"}`;
  goSub.textContent = res.subtitle;

  const acc =
    weaponSystem.shotsFired > 0
      ? Math.round((weaponSystem.shotsHit / weaponSystem.shotsFired) * 100)
      : 0;
  const kd =
    gameMode.playerDeaths > 0
      ? (gameMode.playerKills / gameMode.playerDeaths).toFixed(2)
      : gameMode.playerKills.toFixed(2);

  const { xpEarned } = gameMode.commitCareerStats(acc);
  refreshCareerUI();

  const stats = [
    ["ELIMINATIONS", gameMode.playerKills],
    ["DEATHS", gameMode.playerDeaths],
    ["K/D RATIO", kd],
    ["HEADSHOTS", gameMode.playerHeadshots],
    ["ACCURACY", `${acc}%`],
    ["XP EARNED", `+${xpEarned}`]
  ];
  goStats.innerHTML = stats
    .map(
      ([lbl, val]) => `
      <div class="go-stat-box">
        <div class="go-stat-val">${val}</div>
        <div class="go-stat-lbl">${lbl}</div>
      </div>
    `
    )
    .join("");

  const rows = gameMode.getScoreboardRows(botMgr);
  goScoreboard.innerHTML = `
    <table class="score-table">
      <thead>
        <tr><th>OPERATOR</th><th>TEAM</th><th>KILLS</th><th>DEATHS</th><th>SCORE</th></tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr class="${r.isPlayer ? "row-you" : r.team === "blue" ? "row-blue" : "row-red"}">
            <td>${r.name}</td>
            <td>${r.teamLabel}</td>
            <td>${r.kills}</td>
            <td>${r.deaths}</td>
            <td>${r.score}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

// ---------------- Combat Callbacks ----------------

function handleBotKilled(bot, attacker, weaponShort, isHeadshot) {
  if (!activeMatch) return;
  const { gameMode, killstreaks, weaponSystem, perk } = activeMatch;
  if (attacker && attacker.isPlayer) {
    gameMode.recordPlayerKill(bot, weaponShort, isHeadshot, killstreaks, hud, perk);
    if (perk.scavenger) {
      weaponSystem.onScavengerKill();
    }
  } else if (attacker) {
    gameMode.recordBotKill(attacker, bot, weaponShort, isHeadshot, hud);
  }
}

function handlePlayerHitBot(bot, dmg, zone, hitPoint, weaponSpec) {
  if (!activeMatch) return;
  const { botMgr, player } = activeMatch;
  const attackerTag = { isPlayer: true, position: player.position };
  const res = botMgr.damageBot(bot, dmg, zone, attackerTag, weaponSpec.shortName, handleBotKilled);
  hud.triggerHitmarker(zone === "head", res.brokeArmor, res.killed);
  audio.playHitmarker(zone === "head", res.brokeArmor, res.killed);
}

function handleBotHitPlayer(res, attackerBot, weaponShort) {
  if (!activeMatch) return;
  if (res.killed) {
    const { gameMode, killstreaks, botMgr, player } = activeMatch;
    botMgr.spawnAmmoDrop(player.position);
    gameMode.recordPlayerDeath(
      attackerBot?.callsign || "HOSTILE",
      weaponShort,
      killstreaks,
      hud,
      attackerBot?.callsign !== "SELF" ? attackerBot : null
    );
  }
}

// ---------------- Event Listeners ----------------

btnDeploy.addEventListener("click", startMatch);

btnResume.addEventListener("click", () => {
  if (!activeMatch || activeMatch.gameMode.matchEnded) return;
  paused = false;
  pauseScreen.classList.add("hidden");
  requestLockSafe();
});

btnRestart.addEventListener("click", () => {
  startMatch();
});

btnQuitLobby.addEventListener("click", () => {
  paused = false;
  cleanupMatch();
  hud.setVisible(false);
  pauseScreen.classList.add("hidden");
  lobbyScreen.classList.remove("hidden");
  refreshCareerUI();
});

btnPlayAgain.addEventListener("click", () => {
  startMatch();
});

btnBackLobby.addEventListener("click", () => {
  cleanupMatch();
  gameoverScreen.classList.add("hidden");
  lobbyScreen.classList.remove("hidden");
  refreshCareerUI();
});

pausePrimary.addEventListener("change", () => {
  if (activeMatch) activeMatch.pendingPrimary = pausePrimary.value;
});
pauseSecondary.addEventListener("change", () => {
  if (activeMatch) activeMatch.pendingSecondary = pauseSecondary.value;
});

btnCancelAirstrike.addEventListener("click", () => closeAirstrikeTablet(true));

airstrikeCanvas.addEventListener("mousemove", (e) => {
  if (!airstrikeOpen || !activeMatch) return;
  airstrikeHover = hud.airstrikeCanvasToWorld(e.clientX, e.clientY, airstrikeCanvas, activeMatch.mapData);
});

airstrikeCanvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (!airstrikeOpen) return;
  airstrikeAngle += Math.PI / 6;
});

airstrikeCanvas.addEventListener("mousedown", (e) => {
  if (!airstrikeOpen || !activeMatch) return;
  if (e.button === 0) {
    const pos = hud.airstrikeCanvasToWorld(e.clientX, e.clientY, airstrikeCanvas, activeMatch.mapData);
    activeMatch.killstreaks.launchAirstrikeAt(
      pos.x,
      pos.z,
      airstrikeAngle,
      activeMatch.player,
      (msg) => hud.showStreakBanner(msg)
    );
    closeAirstrikeTablet(true);
  }
});

document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === renderer.domElement;
  if (!locked && activeMatch && !activeMatch.gameMode.matchEnded && !paused && !airstrikeOpen) {
    paused = true;
    mouseState.fireHeld = false;
    mouseState.aimHeld = false;
    mouseState.tabHeld = false;
    for (const k of Object.keys(keys)) keys[k] = false;
    pauseScreen.classList.remove("hidden");
  }
});

renderer.domElement.addEventListener("mousedown", (e) => {
  if (!activeMatch || paused || activeMatch.gameMode.matchEnded) return;
  audio.unlock();
  if (document.pointerLockElement !== renderer.domElement) {
    requestLockSafe();
    return;
  }
  if (e.button === 0) {
    mouseState.fireHeld = true;
    mouseState.fireJustPressed = true;
  } else if (e.button === 2) {
    mouseState.aimHeld = true;
  }
});

window.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseState.fireHeld = false;
  else if (e.button === 2) mouseState.aimHeld = false;
});

renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("mousemove", (e) => {
  if (!activeMatch || paused || document.pointerLockElement !== renderer.domElement) return;
  const spec = activeMatch.weaponSystem.getActiveSpec();
  activeMatch.player.onMouseMove(
    e.movementX,
    e.movementY,
    settings.sensitivity,
    activeMatch.weaponSystem.adsProgress,
    spec.isSniper,
    activeMatch.weaponSystem.adsZoomStep
  );
  activeMatch.weaponSystem.addMouseSway(e.movementX, e.movementY);
});

window.addEventListener("wheel", (e) => {
  if (airstrikeOpen && activeMatch) {
    e.preventDefault();
    airstrikeAngle += (e.deltaY > 0 ? 1 : -1) * (Math.PI / 12);
    return;
  }
  if (!activeMatch || paused || document.pointerLockElement !== renderer.domElement) return;
  if (Math.abs(e.deltaY) > 4) {
    if (activeMatch.weaponSystem.isAiming) {
      e.preventDefault();
      activeMatch.weaponSystem.adjustAdsZoom(e.deltaY < 0 ? 1 : -1);
    } else {
      activeMatch.weaponSystem.switchSlot(activeMatch.weaponSystem.activeSlot === 0 ? 1 : 0);
    }
  }
}, { passive: false });

window.addEventListener("keydown", (e) => {
  audio.unlock();
  if (airstrikeOpen) {
    if (e.code === "Digit5" || e.code === "Escape") {
      e.preventDefault();
      closeAirstrikeTablet(true);
    } else if (e.code === "KeyR") {
      airstrikeAngle += Math.PI / 6;
    }
    return;
  }

  if (e.code === "Tab") {
    e.preventDefault();
    mouseState.tabHeld = true;
    return;
  }

  keys[e.code] = true;
  if (!activeMatch || paused || activeMatch.gameMode.matchEnded) return;

  const { player, weaponSystem, botMgr, killstreaks } = activeMatch;

  if (e.code === "Digit1") weaponSystem.switchSlot(0);
  else if (e.code === "Digit2") weaponSystem.switchSlot(1);
  else if (e.code === "KeyR") weaponSystem.startReload();
  else if (e.code === "KeyV") weaponSystem.tryMelee(botMgr.bots, handlePlayerHitBot);
  else if (e.code === "KeyG") killstreaks.throwGrenade("frag", player, weaponSystem);
  else if (e.code === "KeyQ") killstreaks.throwGrenade("flash", player, weaponSystem);
  else if (e.code === "KeyX") player.useStim();
  else if (e.code === "KeyE") {
    if (killstreaks.tryUseSupply(player, weaponSystem)) {
      hud.pushXpPopup("+RESUPPLIED AMMO & ARMOR");
    }
  } else if (e.code === "Digit4") {
    killstreaks.activateStreak(0, player, (msg) => hud.showStreakBanner(msg));
  } else if (e.code === "Digit5") {
    openAirstrikeTablet();
  } else if (e.code === "Digit6") {
    killstreaks.activateStreak(2, player, (msg) => hud.showStreakBanner(msg));
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Tab") {
    mouseState.tabHeld = false;
    return;
  }
  keys[e.code] = false;
});

window.addEventListener("blur", () => {
  mouseState.fireHeld = false;
  mouseState.aimHeld = false;
  mouseState.tabHeld = false;
  for (const k of Object.keys(keys)) keys[k] = false;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------- Main Game Loop ----------------

function tick(now) {
  requestAnimationFrame(tick);
  const rawDt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  const dt = Math.min(0.05, Math.max(0.0001, rawDt));

  if (!activeMatch) return;

  const {
    mapData,
    mapBuilder,
    particles,
    player,
    weaponSystem,
    botMgr,
    killstreaks,
    gameMode
  } = activeMatch;

  if (!paused && !gameMode.matchEnded) {
    const activeSpec = weaponSystem.getActiveSpec();
    player.update(dt, keys, activeSpec, weaponSystem.adsProgress, weaponSystem.isAiming, weaponSystem.adsZoomStep);

    weaponSystem.update(
      dt,
      {
        fireHeld: mouseState.fireHeld,
        fireJustPressed: mouseState.fireJustPressed,
        aimHeld: mouseState.aimHeld
      },
      botMgr.bots,
      handlePlayerHitBot,
      (firedSpec) => {
        if (!firedSpec.suppressed) {
          botMgr.alertNearbyBots(player.position, 24, "blue");
        }
      }
    );
    mouseState.fireJustPressed = false;

    const activeHp = gameMode.getActiveHardpoint();
    botMgr.update(dt, player, activeHp, handleBotHitPlayer, handleBotKilled, weaponSystem, hud);
    killstreaks.update(dt, player, botMgr, hud, handlePlayerHitBot, handleBotHitPlayer);
    particles.update(dt);
    mapBuilder.update(dt, gameMode.elapsed);

    gameMode.update(dt, player, botMgr, mapBuilder, hud, (sp) => {
      // Apply pending loadout swaps on respawn
      const pId = activeMatch.pendingPrimary;
      const sId = activeMatch.pendingSecondary;
      if (
        weaponSystem.slots[0]?.id !== pId ||
        weaponSystem.slots[1]?.id !== sId
      ) {
        weaponSystem.equipLoadout(pId, sId, activeMatch.perk);
      } else {
        weaponSystem.resetForRespawn();
      }
      player.spawn(sp.x, sp.y, sp.z, sp.yaw || 0);
    });

    if (!player.alive && airstrikeOpen) {
      closeAirstrikeTablet(false);
    }

    if (gameMode.matchEnded) {
      showGameOverScreen();
      return;
    }

    if (airstrikeOpen) {
      hud.renderAirstrikeMap(
        airstrikeCanvas,
        mapData,
        player,
        botMgr,
        activeHp,
        airstrikeHover,
        airstrikeAngle
      );
    }

    const nearSupply = player.alive ? killstreaks.checkNearbySupply(player.position) : null;
    const supplyPrompt = nearSupply
      ? nearSupply.cooldown > 0
        ? `SUPPLY COOLING DOWN (${Math.ceil(nearSupply.cooldown)}s)`
        : "[E] RESUPPLY AMMO & ARMOR"
      : null;

    const matchInfo = gameMode.getHudMatchInfo(botMgr);
    hud.update(dt, {
      player,
      weaponSystem,
      killstreaks,
      botMgr,
      mapData,
      matchInfo,
      supplyPrompt
    });
    hud.updateScoreboard(mouseState.tabHeld, matchInfo.modeLabel, gameMode.getScoreboardRows(botMgr));
  }

  renderer.render(scene, camera);
}

// Boot Lobby
renderWeaponBars(selectPrimary.value);
refreshCareerUI();
requestAnimationFrame(tick);
