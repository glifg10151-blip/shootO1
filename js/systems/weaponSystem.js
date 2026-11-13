// =========================================================
// BLACKLINE // OPS — Weapon Mechanics, Ballistics & Melee
// =========================================================
import * as THREE from "three";
import { WEAPONS } from "../config/weapons.js";
import { WeaponViewModel } from "../entities/weaponModel.js";

export class WeaponSystem {
  constructor(camera, physics, particles, audio, player) {
    this.camera = camera;
    this.physics = physics;
    this.particles = particles;
    this.audio = audio;
    this.player = player;

    this.viewModel = new WeaponViewModel();
    this.camera.add(this.viewModel.root);

    this.perk = null;
    this.slots = [null, null];
    this.activeSlot = 0;

    this.adsProgress = 0;
    this.adsZoomStep = 0;
    this.isAiming = false;
    this.isScoped = false;

    this.fireTimer = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.reloadDuration = 1.8;

    this.swapTimer = 0;
    this.meleeTimer = 0;
    this.meleeCooldown = 0;
    this.sprintBlend = 0;
    this.sprintFireSuppress = 0;
    this.reloadCueStep = 0;

    this.recoilZ = 0;
    this.recoilRotX = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.bloomSpread = 0;
    this.currentSpread = 0.03;

    this.frags = 2;
    this.flashes = 2;
    this.grenadeThrowAnim = 0;

    // Match accuracy telemetry
    this.shotsFired = 0;
    this.shotsHit = 0;
  }

  equipLoadout(primaryId, secondaryId, perk) {
    this.perk = perk;
    const pSpec = WEAPONS[primaryId] || WEAPONS.m4a1;
    const sSpec = WEAPONS[secondaryId] || WEAPONS.deagle;

    this.slots[0] = {
      id: pSpec.id,
      spec: pSpec,
      mag: pSpec.magSize,
      reserve: pSpec.maxReserve
    };
    this.slots[1] = {
      id: sSpec.id,
      spec: sSpec,
      mag: sSpec.magSize,
      reserve: sSpec.maxReserve
    };

    this.activeSlot = 0;
    this.reloading = false;
    this.reloadCueStep = 0;
    this.adsProgress = 0;
    this.adsZoomStep = 0;
    this.isScoped = false;
    this.frags = 2;
    this.flashes = 2;
    this.viewModel.resetReloadParts();
    this.viewModel.buildWeapon(this.slots[0].id);
    this.viewModel.setScopeHidden(false);
  }

  resetForRespawn() {
    for (const s of this.slots) {
      if (!s) continue;
      s.mag = s.spec.magSize;
      s.reserve = s.spec.maxReserve;
    }
    this.activeSlot = 0;
    this.reloading = false;
    this.reloadCueStep = 0;
    this.adsProgress = 0;
    this.adsZoomStep = 0;
    this.isScoped = false;
    this.meleeTimer = 0;
    this.frags = 2;
    this.viewModel.resetReloadParts();
    this.flashes = 2;
    this.viewModel.buildWeapon(this.slots[0].id);
    this.viewModel.setScopeHidden(false);
    this.viewModel.knifeGroup.visible = false;
  }

  resupplyAll() {
    for (const s of this.slots) {
      if (!s) continue;
      s.reserve = s.spec.maxReserve;
    }
    this.frags = 2;
    this.flashes = 2;
  }

  onScavengerKill() {
    const active = this.getActiveSlot();
    if (active) {
      active.reserve = Math.min(active.spec.maxReserve, active.reserve + active.spec.magSize);
    }
    this.frags = Math.min(2, this.frags + 1);
    this.flashes = Math.min(2, this.flashes + 1);
  }

  getActiveSlot() {
    return this.slots[this.activeSlot];
  }

  getActiveSpec() {
    return this.slots[this.activeSlot]?.spec || WEAPONS.m4a1;
  }

  switchSlot(index) {
    if (index !== 0 && index !== 1) return;
    if (index === this.activeSlot || !this.slots[index]) return;
    this.activeSlot = index;
    this.reloading = false;
    this.reloadCueStep = 0;
    this.adsProgress = 0;
    this.adsZoomStep = 0;
    this.isScoped = false;
    this.swapTimer = 0.24;
    this.viewModel.resetReloadParts();
    this.viewModel.buildWeapon(this.slots[index].id);
    this.viewModel.setScopeHidden(false);
    this.audio.playReload("start");
  }

  adjustAdsZoom(delta) {
    if (!this.isAiming) return false;
    const next = Math.max(0, Math.min(2, this.adsZoomStep + delta));
    if (next !== this.adsZoomStep) {
      this.adsZoomStep = next;
      this.audio.playDryFire();
      return true;
    }
    return false;
  }

  startReload() {
    const slot = this.getActiveSlot();
    if (!slot || this.reloading || this.meleeTimer > 0) return;
    if (slot.mag >= slot.spec.magSize || slot.reserve <= 0) return;

    this.reloading = true;
    this.reloadCueStep = 0;
    const perkMult = this.perk?.reloadMult || 1.0;
    const overdriveMult = this.player.overdriveTimer > 0 ? 0.65 : 1.0;
    this.reloadDuration = slot.spec.reloadTime * perkMult * overdriveMult;
    this.reloadTimer = this.reloadDuration;
    this.audio.playReload("start");
  }

  addMouseSway(dx, dy) {
    this.swayX = Math.max(-0.04, Math.min(0.04, this.swayX - dx * 0.00018));
    this.swayY = Math.max(-0.04, Math.min(0.04, this.swayY + dy * 0.00018));
  }

  triggerThrowAnim() {
    this.grenadeThrowAnim = 0.28;
    this.reloading = false;
    this.viewModel.resetReloadParts();
  }

  tryMelee(bots, onHitBot) {
    if (!this.player.alive || this.meleeCooldown > 0) return false;
    this.meleeTimer = 0.34;
    this.meleeCooldown = 0.62;
    this.reloading = false;
    this.viewModel.resetReloadParts();
    this.adsProgress = 0;

    const origin = this.player.getEyePosition();
    const dir = this.player.getAimDirection();
    let hitAny = false;

    let closestBot = null;
    let closestDist = 2.45;
    for (const bot of bots) {
      if (!bot.alive || bot.isFriendly) continue;
      const dx = bot.position.x - origin.x;
      const dy = bot.position.y + 1.15 - origin.y;
      const dz = bot.position.z - origin.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > closestDist) continue;
      const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / Math.max(0.01, dist);
      if (dot > 0.52) {
        // Check wall isn't blocking melee
        const bPos = new THREE.Vector3(bot.position.x, bot.position.y + 1.15, bot.position.z);
        if (this.physics.hasLineOfSight(origin, bPos)) {
          closestDist = dist;
          closestBot = bot;
        }
      }
    }

    if (closestBot) {
      hitAny = true;
      const hp = new THREE.Vector3(closestBot.position.x, closestBot.position.y + 1.25, closestBot.position.z);
      this.particles.spawnImpact(hp, null, "flesh", true);
      if (onHitBot) {
        onHitBot(closestBot, 145, "torso", hp, { shortName: "KNIFE", id: "knife", suppressed: true });
      }
    }

    this.audio.playKnife(hitAny);
    return true;
  }

  _fireSingleShot(slot, bots, onHitBot, onShotFired) {
    const spec = slot.spec;
    const isOverdrive = this.player.overdriveTimer > 0;

    if (!isOverdrive) {
      slot.mag -= 1;
    }

    const rpmMult = isOverdrive ? 1.28 : 1.0;
    this.fireTimer = 60 / (spec.rpm * rpmMult);

    this.audio.playGunshot(spec.audioProfile, true, 0, 0);
    this.viewModel.triggerMuzzleFlash(spec.suppressed);

    // Camera recoil & viewmodel kick
    const adsRecoilReduction = 1 - this.adsProgress * 0.25;
    const yawRand = (Math.random() - 0.5) * 2 * spec.recoilYaw * adsRecoilReduction;
    const pitchKick = spec.recoilPitch * adsRecoilReduction;
    this.player.addRecoil(pitchKick, yawRand, spec.recoilRecovery);

    this.recoilZ = Math.min(0.14, this.recoilZ + spec.recoilKickZ);
    this.recoilRotX = Math.min(0.22, this.recoilRotX + spec.recoilKickZ * 1.8);
    this.bloomSpread = Math.min(0.032, this.bloomSpread + (spec.isSniper ? 0.02 : 0.0045));

    // Eject spinning brass casing
    const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const upVec = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const fwdVec = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const muzzleWorld = new THREE.Vector3();
    if (this.isScoped) {
      this.player.getEyePosition(muzzleWorld).addScaledVector(fwdVec, 0.55).addScaledVector(upVec, -0.06);
    } else {
      this.viewModel.getWorldMuzzlePosition(muzzleWorld);
      const ejectPos = muzzleWorld.clone().addScaledVector(fwdVec, -0.35).addScaledVector(rightVec, 0.06);
      this.particles.spawnShellCasing(ejectPos, rightVec, upVec, fwdVec);
    }

    const eyeOrigin = this.player.getEyePosition();
    const baseAimDir = this.player.getAimDirection();

    this.shotsFired += 1;
    let shotLandedOnEnemy = false;

    const spreadAngle = this.currentSpread;
    const pellets = spec.pellets || 1;

    for (let pIdx = 0; pIdx < pellets; pIdx++) {
      // Uniform cone perturbation around baseAimDir
      const dir = baseAimDir.clone();
      if (spreadAngle > 0.0001) {
        const theta = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * spreadAngle;
        dir
          .addScaledVector(rightVec, Math.cos(theta) * r)
          .addScaledVector(upVec, Math.sin(theta) * r)
          .normalize();
      }

      const worldHit = this.physics.raycastWorld(eyeOrigin, dir, 180);
      let maxDist = worldHit.hit ? worldHit.distance : 180;

      let bestBot = null;
      let bestBotHit = null;

      for (let b = 0; b < bots.length; b++) {
        const bot = bots[b];
        if (!bot.alive || bot.isFriendly) continue;
        const hit = this.physics.raycastOperator(eyeOrigin, dir, maxDist, bot.position, bot.crouched);
        if (hit && hit.distance < maxDist) {
          maxDist = hit.distance;
          bestBot = bot;
          bestBotHit = hit;
        }
      }

      let endPoint;
      if (bestBot && bestBotHit) {
        endPoint = bestBotHit.point;
        shotLandedOnEnemy = true;

        // Distance damage falloff
        let falloffMult = 1.0;
        if (bestBotHit.distance > spec.rangeFalloffStart) {
          const t = Math.min(
            1,
            (bestBotHit.distance - spec.rangeFalloffStart) /
              Math.max(1, spec.rangeFalloffEnd - spec.rangeFalloffStart)
          );
          falloffMult = 1 - t * (1 - spec.minDamageMult);
        }

        let zoneMult = 1.0;
        if (bestBotHit.zone === "head") zoneMult = spec.headMult;
        else if (bestBotHit.zone === "limb") zoneMult = spec.limbMult;

        const finalDamage = spec.damage * falloffMult * zoneMult * (isOverdrive ? 1.25 : 1.0);
        this.particles.spawnImpact(bestBotHit.point, null, "flesh", true);
        if (onHitBot) {
          onHitBot(bestBot, finalDamage, bestBotHit.zone, bestBotHit.point, spec);
        }
      } else if (worldHit.hit) {
        endPoint = worldHit.point;
        this.particles.spawnImpact(worldHit.point, worldHit.normal, worldHit.mat, false);
      } else {
        endPoint = eyeOrigin.clone().addScaledVector(dir, 140);
      }

      // Visual tracer every shot (all pellets for shotgun, every bullet otherwise)
      if (!spec.suppressed || Math.random() < 0.55) {
        this.particles.spawnTracer(muzzleWorld, endPoint, spec.tracerColor, spec.isSniper ? 1.5 : 1.0);
      }
    }

    if (shotLandedOnEnemy) {
      this.shotsHit += 1;
    }

    if (onShotFired) {
      onShotFired(spec);
    }

    // Auto-reload when magazine hits 0
    if (slot.mag <= 0 && slot.reserve > 0) {
      this.startReload();
    }
  }

  update(dt, input, bots, onHitBot, onShotFired) {
    this.viewModel.updateFlash(dt);
    if (this.fireTimer > 0) this.fireTimer = Math.max(0, this.fireTimer - dt);
    if (this.meleeCooldown > 0) this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
    if (this.swapTimer > 0) this.swapTimer = Math.max(0, this.swapTimer - dt);
    if (this.grenadeThrowAnim > 0) this.grenadeThrowAnim = Math.max(0, this.grenadeThrowAnim - dt);
    if (this.sprintFireSuppress > 0) this.sprintFireSuppress = Math.max(0, this.sprintFireSuppress - dt);

    const slot = this.getActiveSlot();
    if (!slot) return;
    const spec = slot.spec;

    if (!this.player.alive) {
      this.viewModel.root.visible = false;
      this.isScoped = false;
      return;
    }
    this.viewModel.root.visible = true;

    // Handle Reloading Timer & Synced Mechanical Audio Cues
    if (this.reloading) {
      this.reloadTimer -= dt;
      const rProg = 1 - this.reloadTimer / Math.max(0.05, this.reloadDuration);

      if (slot.id === "spas12") {
        if (rProg >= 0.18 && this.reloadCueStep < 1) {
          this.audio.playReload("shell");
          this.reloadCueStep = 1;
        } else if (rProg >= 0.45 && this.reloadCueStep < 2) {
          this.audio.playReload("shell");
          this.reloadCueStep = 2;
        } else if (rProg >= 0.74 && this.reloadCueStep < 3) {
          this.audio.playReload("rack");
          this.reloadCueStep = 3;
        }
      } else {
        if (rProg >= 0.21 && this.reloadCueStep < 1) {
          this.audio.playReload("magOut");
          this.reloadCueStep = 1;
        } else if (rProg >= 0.68 && this.reloadCueStep < 2) {
          this.audio.playReload("magIn");
          this.reloadCueStep = 2;
        } else if (rProg >= 0.79 && this.reloadCueStep < 3) {
          this.audio.playReload("rack");
          this.reloadCueStep = 3;
        }
      }

      if (this.reloadTimer <= 0) {
        const needed = spec.magSize - slot.mag;
        const take = Math.min(needed, slot.reserve);
        slot.mag += take;
        slot.reserve -= take;
        this.reloading = false;
        this.viewModel.resetReloadParts();
      }
    }

    // Handle Melee Animation Timer
    if (this.meleeTimer > 0) {
      this.meleeTimer = Math.max(0, this.meleeTimer - dt);
      const t = 1 - this.meleeTimer / 0.34;
      this.viewModel.gunContainer.visible = false;
      this.viewModel.knifeGroup.visible = true;
      this.viewModel.knifeGroup.position.set(0.24 - Math.sin(t * Math.PI) * 0.38, -0.18 + Math.sin(t * Math.PI) * 0.08, -0.35 - Math.sin(t * Math.PI) * 0.24);
      this.viewModel.knifeGroup.rotation.set(-0.3 - t * 1.1, 0.4 + t * 1.3, 0.7);
      this.isScoped = false;
      return;
    } else {
      this.viewModel.knifeGroup.visible = false;
    }

    // ADS State (aiming overrides sprint cleanly like CoD sprint-to-ADS)
    const canAim = !this.reloading && this.swapTimer <= 0 && this.grenadeThrowAnim <= 0;
    this.isAiming = !!input.aimHeld && canAim;
    if (this.isAiming) {
      this.player.sprinting = false;
    }
    const adsStep = dt / Math.max(0.05, spec.adsTime);
    if (this.isAiming) {
      this.adsProgress = Math.min(1, this.adsProgress + adsStep);
    } else {
      this.adsProgress = Math.max(0, this.adsProgress - adsStep * 1.2);
      if (this.adsProgress <= 0.02) this.adsZoomStep = 0;
    }

    this.isScoped = spec.isSniper && this.adsProgress > 0.88;
    this.viewModel.setScopeHidden(this.isScoped);
    this.viewModel.updateReticleScale(this.camera.fov, this.player.baseFov);

    // Calculate Dynamic Spread
    this.bloomSpread *= Math.max(0, 1 - dt * 8.5);
    const baseSpread = spec.hipSpread + (spec.adsSpread - spec.hipSpread) * this.adsProgress;
    const speedFrac = Math.min(1, this.player.getSpeed2D() / 8.0);
    const movePenalty = spec.moveSpreadPenalty * speedFrac * (1 - this.adsProgress * 0.7);
    const airPenalty = this.player.onGround ? 0 : 0.032 * (1 - this.adsProgress * 0.5);
    const crouchBonus = this.player.crouched ? 0.75 : 1.0;
    this.currentSpread = (baseSpread + movePenalty + airPenalty) * crouchBonus + this.bloomSpread;

    // Firing Trigger
    const wantsFire = spec.auto ? input.fireHeld : input.fireJustPressed;
    if (wantsFire && this.fireTimer <= 0 && this.swapTimer <= 0 && this.grenadeThrowAnim <= 0) {
      if (this.reloading) {
        // Cancel reload only if bullets still remain in magazine
        if (slot.mag > 0) {
          this.reloading = false;
          this.viewModel.resetReloadParts();
          this.sprintFireSuppress = 0.24;
          this._fireSingleShot(slot, bots, onHitBot, onShotFired);
        }
      } else if (slot.mag > 0) {
        this.sprintFireSuppress = 0.24;
        this._fireSingleShot(slot, bots, onHitBot, onShotFired);
      } else if (input.fireJustPressed) {
        this.audio.playDryFire();
        if (slot.reserve > 0) this.startReload();
      }
    }

    // Viewmodel Transform Animation (Hip <-> ADS + Sway + Sprint + Reload + Kick)
    this.recoilZ *= Math.max(0, 1 - dt * 16);
    this.recoilRotX *= Math.max(0, 1 - dt * 15);
    this.swayX *= Math.max(0, 1 - dt * 10);
    this.swayY *= Math.max(0, 1 - dt * 10);

    const targetSprint =
      this.player.sprinting && !this.isAiming && !this.reloading && this.sprintFireSuppress <= 0 ? 1 : 0;
    this.sprintBlend += (targetSprint - this.sprintBlend) * Math.min(1, dt * 10);

    const pos = new THREE.Vector3().lerpVectors(this.viewModel.hipPos, this.viewModel.adsPos, this.adsProgress);
    const bobAmp = this.player.currentBobAmp ?? Math.min(1, this.player.getSpeed2D() / 7.5);
    const bobScale = (1 - this.adsProgress * 0.9) * bobAmp;
    const swayAmtX = this.sprintBlend > 0.2 ? 0.013 : 0.007;
    const swayAmtY = this.sprintBlend > 0.2 ? 0.009 : 0.005;

    pos.x += Math.cos(this.player.headbobPhase) * swayAmtX * bobScale + this.swayX * (1 - this.adsProgress * 0.6);
    pos.y += Math.sin(this.player.headbobPhase * 2) * swayAmtY * bobScale + this.swayY * (1 - this.adsProgress * 0.6);
    pos.z += this.recoilZ;

    let rotX = this.recoilRotX;
    let rotY = 0;
    let rotZ = 0;

    if (this.sprintBlend > 0.005) {
      const sb = this.sprintBlend * (1 - this.adsProgress);
      pos.x -= 0.045 * sb;
      pos.y -= 0.03 * sb;
      rotY += 0.36 * sb;
      rotX -= 0.11 * sb;
      rotZ += 0.14 * sb;
    }

    if (this.reloading) {
      const rProg = 1 - this.reloadTimer / Math.max(0.05, this.reloadDuration);
      const pose = this.viewModel.applyReloadPose(rProg, slot.id);
      pos.x += pose.posOff.x;
      pos.y += pose.posOff.y;
      pos.z += pose.posOff.z;
      rotX += pose.rotOff.x;
      rotY += pose.rotOff.y;
      rotZ += pose.rotOff.z;
    } else {
      this.viewModel.resetReloadParts();
    }

    if (this.swapTimer > 0) {
      pos.y -= (this.swapTimer / 0.24) * 0.22;
      rotX -= (this.swapTimer / 0.24) * 0.45;
    }

    if (this.grenadeThrowAnim > 0) {
      pos.y -= Math.sin((this.grenadeThrowAnim / 0.28) * Math.PI) * 0.25;
    }

    this.viewModel.root.position.lerp(pos, Math.min(1, dt * 24));
    this.viewModel.root.rotation.set(rotX, rotY, rotZ);
  }

  dispose() {
    this.camera.remove(this.viewModel.root);
    this.viewModel.dispose();
  }
}
