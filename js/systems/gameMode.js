// =========================================================
// BLACKLINE // OPS — Match Modes, Medals & Career XP
// =========================================================
import { RANKS } from "../config/weapons.js";

const STORAGE_KEY = "blackline_ops_career_v1";

export function loadCareer() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        xp: parsed.xp || 0,
        kills: parsed.kills || 0,
        bestStreak: parsed.bestStreak || 0,
        wins: parsed.wins || 0,
        bestWave: parsed.bestWave || 0
      };
    }
  } catch {
    // ignore storage restrictions
  }
  return { xp: 0, kills: 0, bestStreak: 0, wins: 0, bestWave: 0 };
}

export function saveCareer(career) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(career));
  } catch {
    // ignore storage restrictions
  }
}

export function getRankProgress(xp) {
  let current = RANKS[0];
  let next = RANKS[1] || null;
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].xpNeeded) {
      current = RANKS[i];
      next = RANKS[i + 1] || null;
    }
  }
  let pct = 100;
  if (next) {
    pct = Math.max(0, Math.min(100, ((xp - current.xpNeeded) / (next.xpNeeded - current.xpNeeded)) * 100));
  }
  return { current, next, pct };
}

export class GameModeManager {
  constructor(mode, mapData) {
    this.mode = mode;
    this.mapData = mapData;

    this.timeLeft = mode === "hardpoint" ? 360 : mode === "survival" ? 9999 : 300;
    this.elapsed = 0;
    this.scoreLimit = mode === "tdm" ? 50 : mode === "ffa" ? 30 : mode === "hardpoint" ? 250 : 999;

    this.blueScore = 0;
    this.redScore = 0;

    // Player match stats
    this.playerKills = 0;
    this.playerDeaths = 0;
    this.playerHeadshots = 0;
    this.playerScore = 0;
    this.bestStreakThisMatch = 0;
    this.multiKillCount = 0;
    this.multiKillTimer = 0;

    this.respawnTimer = 0;
    this.lastKillerName = "";
    this.lastKillerWeapon = "";

    // Hardpoint state
    this.hpIndex = 0;
    this.hpRotateTimer = 42;
    this.hpTickAccum = 0;
    this.hpPlayerTick = 0;
    this.hpOwnerState = "neutral";

    // Survival state
    this.wave = 1;
    this.waveIntermission = 0;

    this.matchEnded = false;
    this.result = null; // { victory, title, subtitle }
  }

  getActiveHardpoint() {
    if (this.mode !== "hardpoint" || !this.mapData.hardpoints?.length) return null;
    return this.mapData.hardpoints[this.hpIndex % this.mapData.hardpoints.length];
  }

  recordPlayerKill(bot, weaponShort, isHeadshot, killstreaks, hud, perk) {
    this.playerKills += 1;
    if (isHeadshot) this.playerHeadshots += 1;

    let earned = 100;
    hud.pushXpPopup(`+100 ELIMINATION`);

    if (isHeadshot) {
      earned += 50;
      hud.pushXpPopup(`+50 HEADSHOT`, true);
    }

    this.multiKillCount = this.multiKillTimer > 0 ? this.multiKillCount + 1 : 1;
    this.multiKillTimer = 4.2;

    if (this.multiKillCount === 2) {
      earned += 50;
      hud.pushXpPopup("+50 DOUBLE KILL", true);
    } else if (this.multiKillCount === 3) {
      earned += 100;
      hud.pushXpPopup("+100 TRIPLE KILL", true);
    } else if (this.multiKillCount >= 4) {
      earned += 150;
      hud.pushXpPopup("+150 MEGA KILL!", true);
    }

    this.playerScore += earned;

    killstreaks.onPlayerKill((bannerText) => hud.showStreakBanner(bannerText));
    if (killstreaks.currentStreak > this.bestStreakThisMatch) {
      this.bestStreakThisMatch = killstreaks.currentStreak;
    }

    hud.pushKillfeed("YOU", "you", bot.callsign, "red", weaponShort, isHeadshot);

    if (this.mode === "tdm") {
      this.blueScore += 1;
    }
    return earned;
  }

  recordBotKill(killerBot, victimBot, weaponShort, isHeadshot, hud) {
    killerBot.kills += 1;
    killerBot.score += 100 + (isHeadshot ? 25 : 0);

    const kTeam = killerBot.isFriendly ? "blue" : "red";
    const vTeam = victimBot.isFriendly ? "blue" : "red";
    hud.pushKillfeed(killerBot.callsign, kTeam, victimBot.callsign, vTeam, weaponShort, isHeadshot);

    if (this.mode === "tdm") {
      if (killerBot.isFriendly) this.blueScore += 1;
      else this.redScore += 1;
    }
  }

  recordPlayerDeath(killerCallsign, weaponShort, killstreaks, hud, killerBot = null) {
    this.playerDeaths += 1;
    this.multiKillCount = 0;
    this.lastKillerName = killerCallsign || "HOSTILE";
    this.lastKillerWeapon = weaponShort || "RIFLE";
    killstreaks.onPlayerDeath();

    if (killerBot) {
      killerBot.kills += 1;
      killerBot.score += 100;
    }

    hud.pushKillfeed(
      this.lastKillerName,
      killerCallsign === "SELF" ? "you" : "red",
      "YOU",
      "you",
      this.lastKillerWeapon,
      false
    );

    if (this.mode === "tdm") {
      if (killerCallsign !== "SELF") this.redScore += 1;
    }

    if (this.mode === "survival") {
      this.endMatch(false, "OPERATIONAL DEFEAT", `SURVIVED TO WAVE ${this.wave}`);
    } else {
      this.respawnTimer = 3.0;
    }
  }

  pickSafeSpawnForPlayer(botMgr) {
    const pool =
      this.mode === "ffa" || this.mode === "survival"
        ? this.mapData.spawns.ffa
        : this.mapData.spawns.blue;
    const enemies = botMgr.bots.filter((b) => b.alive && !b.isFriendly);
    if (enemies.length === 0) {
      return pool[Math.floor(Math.random() * pool.length)];
    }

    let bestSpawn = pool[0];
    let bestMinDist = -1;
    for (const sp of pool) {
      let minDist = Infinity;
      for (const e of enemies) {
        const d = (e.position.x - sp.x) ** 2 + (e.position.z - sp.z) ** 2;
        if (d < minDist) minDist = d;
      }
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestSpawn = sp;
      }
    }
    return bestSpawn;
  }

  endMatch(victory, title, subtitle) {
    if (this.matchEnded) return;
    this.matchEnded = true;
    this.result = { victory, title, subtitle };
  }

  update(dt, player, botMgr, mapBuilder, hud, onRespawnPlayer) {
    if (this.matchEnded) return;

    this.elapsed += dt;
    if (this.multiKillTimer > 0) this.multiKillTimer = Math.max(0, this.multiKillTimer - dt);

    // Respawn countdown
    if (!player.alive && this.mode !== "survival") {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0 && onRespawnPlayer) {
        const sp = this.pickSafeSpawnForPlayer(botMgr);
        onRespawnPlayer(sp);
      }
    }

    // Match Clock
    if (this.mode !== "survival") {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        if (this.mode === "tdm" || this.mode === "hardpoint") {
          const win = this.blueScore >= this.redScore;
          this.endMatch(
            win,
            win ? "VICTORY" : "DEFEAT",
            win ? "TASK FORCE 141 DOMINATED THE SECTOR" : "HOSTILE FORCES SECURED THE SECTOR"
          );
        } else if (this.mode === "ffa") {
          const topBot = Math.max(0, ...botMgr.bots.map((b) => b.kills));
          const win = this.playerKills >= topBot;
          this.endMatch(
            win,
            win ? "VICTORY // #1 OPERATOR" : "MATCH COMPLETE",
            win ? "TOP SCORER IN FREE-FOR-ALL" : `LEADER FINISHED WITH ${topBot} KILLS`
          );
        }
        return;
      }
    }

    // Mode-specific scoring & objectives
    if (this.mode === "tdm") {
      if (this.blueScore >= this.scoreLimit) {
        this.endMatch(true, "VICTORY", "SCORE LIMIT REACHED — MISSION ACCOMPLISHED");
      } else if (this.redScore >= this.scoreLimit) {
        this.endMatch(false, "DEFEAT", "ENEMY SQUAD REACHED SCORE LIMIT");
      }
    } else if (this.mode === "ffa") {
      if (this.playerKills >= this.scoreLimit) {
        this.endMatch(true, "VICTORY // #1", "30 ELIMINATIONS REACHED");
      } else {
        for (const b of botMgr.bots) {
          if (b.kills >= this.scoreLimit) {
            this.endMatch(false, "DEFEAT", `${b.callsign} REACHED 30 ELIMINATIONS`);
            break;
          }
        }
      }
    } else if (this.mode === "hardpoint") {
      this.hpRotateTimer -= dt;
      if (this.hpRotateTimer <= 0) {
        this.hpRotateTimer = 42;
        this.hpIndex = (this.hpIndex + 1) % this.mapData.hardpoints.length;
        const nextZone = this.getActiveHardpoint();
        hud.showStreakBanner(`NEW HARDPOINT: ${nextZone.name}`);
      }

      const zone = this.getActiveHardpoint();
      let blueCount = 0;
      let redCount = 0;
      let playerInside = false;

      if (player.alive) {
        const dp = Math.hypot(player.position.x - zone.x, player.position.z - zone.z);
        if (dp <= zone.radius && Math.abs(player.position.y - zone.y) < 2.5) {
          blueCount++;
          playerInside = true;
        }
      }
      for (const b of botMgr.bots) {
        if (!b.alive) continue;
        const db = Math.hypot(b.position.x - zone.x, b.position.z - zone.z);
        if (db <= zone.radius && Math.abs(b.position.y - zone.y) < 2.5) {
          if (b.isFriendly) blueCount++;
          else redCount++;
        }
      }

      if (blueCount > 0 && redCount > 0) this.hpOwnerState = "contested";
      else if (blueCount > 0) this.hpOwnerState = "blue";
      else if (redCount > 0) this.hpOwnerState = "red";
      else this.hpOwnerState = "neutral";

      mapBuilder.updateHardpointVisual(zone, this.hpOwnerState);

      this.hpTickAccum += dt;
      if (this.hpTickAccum >= 1.0) {
        this.hpTickAccum -= 1.0;
        if (this.hpOwnerState === "blue") {
          this.blueScore += 2;
          if (playerInside) {
            this.playerScore += 25;
            hud.pushXpPopup("+25 HARDPOINT HOLD");
          }
        } else if (this.hpOwnerState === "red") {
          this.redScore += 2;
        }
      }

      if (this.blueScore >= this.scoreLimit) {
        this.endMatch(true, "VICTORY", "HARDPOINT TARGET SCORE REACHED");
      } else if (this.redScore >= this.scoreLimit) {
        this.endMatch(false, "DEFEAT", "HOSTILES CAPTURED THE SECTOR");
      }
    } else if (this.mode === "survival") {
      const aliveHostiles = botMgr.bots.filter((b) => b.alive).length;
      if (aliveHostiles === 0) {
        if (this.waveIntermission <= 0) {
          this.waveIntermission = 3.5;
          this.playerScore += this.wave * 150;
          hud.showStreakBanner(`WAVE ${this.wave} CLEARED — RESUPPLYING`);
          player.resupply();
        } else {
          this.waveIntermission -= dt;
          if (this.waveIntermission <= 0) {
            this.wave += 1;
            botMgr.spawnSurvivalWave(this.wave, player.position);
            hud.showStreakBanner(`WAVE ${this.wave} INBOUND!`);
          }
        }
      }
    }
  }

  getHudMatchInfo(botMgr) {
    if (this.mode === "tdm") {
      return {
        modeLabel: "TEAM DEATHMATCH",
        leftTag: "TF-141",
        rightTag: "SYNDICATE",
        leftScore: this.blueScore,
        rightScore: this.redScore,
        limitLabel: `TARGET ${this.scoreLimit}`,
        timeLeft: this.timeLeft,
        respawnLeft: this.respawnTimer,
        lastKillerName: this.lastKillerName,
        lastKillerWeapon: this.lastKillerWeapon,
        objectiveText: null,
        objectiveState: null,
        activeHardpoint: null
      };
    }

    if (this.mode === "ffa") {
      const topBot = Math.max(0, ...botMgr.bots.map((b) => b.kills));
      return {
        modeLabel: "FREE-FOR-ALL",
        leftTag: "YOU",
        rightTag: "LEADER",
        leftScore: this.playerKills,
        rightScore: Math.max(this.playerKills, topBot),
        limitLabel: `TARGET ${this.scoreLimit}`,
        timeLeft: this.timeLeft,
        respawnLeft: this.respawnTimer,
        lastKillerName: this.lastKillerName,
        lastKillerWeapon: this.lastKillerWeapon,
        objectiveText: null,
        objectiveState: null,
        activeHardpoint: null
      };
    }

    if (this.mode === "hardpoint") {
      const zone = this.getActiveHardpoint();
      const statusMap = {
        blue: `TF-141 HOLDING ${zone.name} • ROTATES ${Math.ceil(this.hpRotateTimer)}s`,
        red: `HOSTILES HOLDING ${zone.name} • ROTATES ${Math.ceil(this.hpRotateTimer)}s`,
        contested: `CONTESTED: ${zone.name} • ROTATES ${Math.ceil(this.hpRotateTimer)}s`,
        neutral: `CAPTURE ${zone.name} • ROTATES ${Math.ceil(this.hpRotateTimer)}s`
      };
      return {
        modeLabel: "HARDPOINT // 5v5",
        leftTag: "TF-141",
        rightTag: "SYNDICATE",
        leftScore: this.blueScore,
        rightScore: this.redScore,
        limitLabel: `TARGET ${this.scoreLimit}`,
        timeLeft: this.timeLeft,
        respawnLeft: this.respawnTimer,
        lastKillerName: this.lastKillerName,
        lastKillerWeapon: this.lastKillerWeapon,
        objectiveText: statusMap[this.hpOwnerState],
        objectiveState: this.hpOwnerState === "contested" ? "contested" : this.hpOwnerState === "red" ? "danger" : "normal",
        activeHardpoint: zone
      };
    }

    // Survival
    const aliveHostiles = botMgr.bots.filter((b) => b.alive).length;
    return {
      modeLabel: `SURVIVAL // WAVE ${this.wave}`,
      leftTag: "WAVE",
      rightTag: "HOSTILES",
      leftScore: this.wave,
      rightScore: aliveHostiles,
      limitLabel: `SCORE ${this.playerScore}`,
      timeLeft: this.elapsed,
      respawnLeft: 0,
      lastKillerName: this.lastKillerName,
      lastKillerWeapon: this.lastKillerWeapon,
      objectiveText:
        aliveHostiles > 0
          ? `ELIMINATE SQUAD — ${aliveHostiles} HOSTILES ACTIVE`
          : `NEXT WAVE IN ${Math.max(0, this.waveIntermission).toFixed(1)}s`,
      objectiveState: aliveHostiles > 0 ? "danger" : "normal",
      activeHardpoint: null
    };
  }

  getScoreboardRows(botMgr) {
    const rows = [
      {
        name: "YOU (OPERATOR)",
        team: "blue",
        teamLabel: this.mode === "ffa" ? "SOLO" : "TF-141",
        kills: this.playerKills,
        deaths: this.playerDeaths,
        score: this.playerScore,
        isPlayer: true
      }
    ];

    for (const b of botMgr.bots) {
      rows.push({
        name: b.callsign,
        team: b.isFriendly ? "blue" : "red",
        teamLabel: this.mode === "ffa" ? "SOLO" : b.isFriendly ? "TF-141" : "SYNDICATE",
        kills: b.kills,
        deaths: b.deaths,
        score: b.score,
        isPlayer: false
      });
    }

    rows.sort((a, b) => b.score - a.score || b.kills - a.kills);
    return rows;
  }

  commitCareerStats(accuracyPct) {
    const career = loadCareer();
    const xpEarned =
      this.playerScore +
      this.playerKills * 25 +
      (this.result?.victory ? 350 : 120) +
      Math.round(accuracyPct * 2);

    career.xp += xpEarned;
    career.kills += this.playerKills;
    if (this.bestStreakThisMatch > career.bestStreak) {
      career.bestStreak = this.bestStreakThisMatch;
    }
    if (this.result?.victory) {
      career.wins += 1;
    }
    if (this.mode === "survival" && this.wave > career.bestWave) {
      career.bestWave = this.wave;
    }

    saveCareer(career);
    return { xpEarned, career };
  }
}
