// =========================================================
// BLACKLINE // OPS — First-Person Operator & Movement System
// =========================================================
import * as THREE from "three";

export class PlayerController {
  constructor(camera, physics, audio, perk) {
    this.camera = camera;
    this.physics = physics;
    this.audio = audio;
    this.perk = perk;

    this.radius = 0.44;
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);

    this.yaw = 0;
    this.pitch = 0;
    this.baseFov = 82;
    this.currentFov = 82;

    this.alive = true;
    this.onGround = false;
    this.coyoteTimer = 0;
    this.crouched = false;
    this.sprinting = false;
    this.sliding = false;
    this.slideTimer = 0;
    this.slideDir = new THREE.Vector3();
    this.slideSide = 1;

    this.currentEyeY = 1.62;
    this.headbobPhase = 0;
    this.currentBobAmp = 0;
    this.lastStepCycle = 0;
    this.landingDip = 0;
    this.sprintExhausted = false;

    // Recoil & Screen Shake
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.recoilRecovery = 12;
    this.flinchPitch = 0;
    this.shakeIntensity = 0;

    // Vitals
    this.maxHealth = 100;
    this.health = 100;
    this.maxArmor = 50 + (perk?.extraArmor || 0);
    this.armor = this.maxArmor;
    this.stamina = 100;
    this.regenDelay = 0;
    this.stimCooldown = 0;
    this.spawnProtection = 0;
    this.overdriveTimer = 0;

    this.onDamageTaken = null; // callback(amount, sourcePos)
    this.camera.rotation.order = "YXZ";
  }

  setPerk(perk) {
    this.perk = perk;
    this.maxArmor = 50 + (perk?.extraArmor || 0);
    this.armor = Math.min(this.armor, this.maxArmor);
  }

  spawn(x, y, z, yaw = 0) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.flinchPitch = 0;
    this.shakeIntensity = 0;
    this.alive = true;
    this.crouched = false;
    this.sprinting = false;
    this.sliding = false;
    this.slideTimer = 0;
    this.currentEyeY = 1.62;
    this.headbobPhase = 0;
    this.currentBobAmp = 0;
    this.lastStepCycle = 0;
    this.sprintExhausted = false;
    this.health = this.maxHealth;
    this.armor = this.maxArmor;
    this.stamina = 100;
    this.regenDelay = 0;
    this.stimCooldown = 0;
    this.spawnProtection = 1.5;
    this.overdriveTimer = 0;
    this._syncCamera(0);
  }

  onMouseMove(dx, dy, sensitivity, adsProgress = 0, isSniper = false, adsZoomStep = 0) {
    if (!this.alive) return;
    const extraZoomSens = adsZoomStep === 2 ? 0.56 : adsZoomStep === 1 ? 0.74 : 1.0;
    const stepMult = 1 - adsProgress * (1 - extraZoomSens);
    const zoomSensMult = (1 - adsProgress * (isSniper ? 0.68 : 0.34)) * stepMult;
    const scale = 0.0021 * sensitivity * zoomSensMult;
    this.yaw -= dx * scale;
    this.pitch -= dy * scale;
    const limit = Math.PI * 0.47;
    if (this.pitch > limit) this.pitch = limit;
    if (this.pitch < -limit) this.pitch = -limit;
  }

  addRecoil(pitchKick, yawKick, recovery = 12) {
    this.recoilPitch = Math.min(0.32, this.recoilPitch + pitchKick);
    this.recoilYaw += yawKick;
    this.recoilRecovery = recovery;
  }

  addCameraShake(amount) {
    this.shakeIntensity = Math.min(0.14, this.shakeIntensity + amount);
  }

  useStim() {
    if (!this.alive || this.stimCooldown > 0 || this.health >= this.maxHealth) return false;
    this.health = Math.min(this.maxHealth, this.health + 48);
    this.regenDelay = 0;
    this.stimCooldown = 16;
    this.audio.playPickup();
    return true;
  }

  resupply() {
    this.armor = this.maxArmor;
    this.health = Math.min(this.maxHealth, this.health + 35);
    this.stamina = 100;
  }

  takeDamage(amount, sourcePos = null) {
    if (!this.alive || this.spawnProtection > 0) {
      return { killed: false, damageApplied: 0 };
    }

    let remaining = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, remaining * 0.68);
      this.armor -= absorbed;
      remaining -= absorbed;
    }

    this.health = Math.max(0, this.health - remaining);
    this.regenDelay = 4.2;
    this.flinchPitch = Math.min(0.1, this.flinchPitch + 0.035);
    this.addCameraShake(Math.min(0.045, amount * 0.0012));
    this.audio.playHurt();

    if (this.onDamageTaken) {
      this.onDamageTaken(amount, sourcePos);
    }

    if (this.health <= 0) {
      this.alive = false;
      this.sprinting = false;
      this.sliding = false;
      return { killed: true, damageApplied: amount };
    }
    return { killed: false, damageApplied: amount };
  }

  getEyePosition(out = new THREE.Vector3()) {
    return out.set(this.position.x, this.position.y + this.currentEyeY, this.position.z);
  }

  getAimDirection(out = new THREE.Vector3()) {
    return this.camera.getWorldDirection(out).normalize();
  }

  getSpeed2D() {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  getStanceLabel() {
    if (this.sliding) return "SLIDE";
    if (this.crouched) return "CROUCH";
    if (this.sprinting) return "SPRINT";
    return "STAND";
  }

  update(dt, keys, weaponSpec, adsProgress, isAiming, adsZoomStep = 0) {
    if (this.spawnProtection > 0) this.spawnProtection = Math.max(0, this.spawnProtection - dt);
    if (this.stimCooldown > 0) this.stimCooldown = Math.max(0, this.stimCooldown - dt);
    if (this.overdriveTimer > 0) this.overdriveTimer = Math.max(0, this.overdriveTimer - dt);

    if (!this.alive) {
      this._syncCamera(dt);
      return;
    }

    // Health auto-regen
    if (this.regenDelay > 0) {
      this.regenDelay -= dt;
    } else if (this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + 24 * dt);
    }

    // Input direction relative to yaw (yaw=0 faces -Z)
    let moveF = 0;
    let moveR = 0;
    if (keys.KeyW || keys.ArrowUp) moveF += 1;
    if (keys.KeyS || keys.ArrowDown) moveF -= 1;
    if (keys.KeyD || keys.ArrowRight) moveR += 1;
    if (keys.KeyA || keys.ArrowLeft) moveR -= 1;

    const inputLen = Math.hypot(moveF, moveR);
    if (inputLen > 0) {
      moveF /= inputLen;
      moveR /= inputLen;
    }

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const fwdX = -sinY;
    const fwdZ = -cosY;
    const rightX = cosY;
    const rightZ = -sinY;

    const wishX = fwdX * moveF + rightX * moveR;
    const wishZ = fwdZ * moveF + rightZ * moveR;

    const wantsCrouch = !!(keys.KeyC || keys.ControlLeft || keys.ControlRight);
    const wantsSprint = !!(keys.ShiftLeft || keys.ShiftRight) && moveF > 0.25 && !isAiming && !wantsCrouch;

    const perkSpeed = (this.perk?.speedMult || 1.0) * (this.overdriveTimer > 0 ? 1.18 : 1.0);
    const wpnSpeed = weaponSpec?.moveSpeedMult || 1.0;

    // Trigger tactical slide (uses stamina as slide charge)
    if (wantsCrouch && this.sprinting && this.onGround && !this.sliding && this.stamina >= 28) {
      this.sliding = true;
      this.slideTimer = 0.56;
      this.stamina -= 28;
      this.slideSide = Math.random() > 0.5 ? 1 : -1;
      const spd = Math.hypot(wishX, wishZ) > 0.1 ? new THREE.Vector3(wishX, 0, wishZ).normalize() : new THREE.Vector3(fwdX, 0, fwdZ);
      this.slideDir.copy(spd);
      const burst = 15.8 * perkSpeed;
      this.velocity.x = this.slideDir.x * burst;
      this.velocity.z = this.slideDir.z * burst;
      this.audio.playFootstep(true, true);
    }

    if (this.sliding) {
      this.slideTimer -= dt;
      this.velocity.x *= Math.max(0, 1 - 2.35 * dt);
      this.velocity.z *= Math.max(0, 1 - 2.35 * dt);
      if (this.slideTimer <= 0 || !this.onGround) {
        this.sliding = false;
      }
    } else {
      this.crouched = wantsCrouch;
      this.sprinting = wantsSprint;
      this.stamina = Math.min(100, this.stamina + 34 * dt);

      let maxSpeed = 5.55;
      if (this.crouched) maxSpeed = 3.15;
      else if (isAiming) maxSpeed = 3.4;
      else if (this.sprinting) maxSpeed = 10.85;

      maxSpeed *= perkSpeed * wpnSpeed;

      const accel = this.onGround ? 52.0 : 14.0;
      const friction = this.onGround ? 12.5 : 1.8;

      // Friction
      const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      if (horizSpeed > 0.01) {
        const drop = horizSpeed * friction * dt;
        const newSpd = Math.max(0, horizSpeed - drop) / horizSpeed;
        this.velocity.x *= newSpd;
        this.velocity.z *= newSpd;
      }

      // Accelerate toward wish direction
      const targetVx = wishX * maxSpeed;
      const targetVz = wishZ * maxSpeed;
      const dvx = targetVx - this.velocity.x;
      const dvz = targetVz - this.velocity.z;
      const dvLen = Math.hypot(dvx, dvz);
      const maxDv = accel * dt;
      if (dvLen > maxDv && dvLen > 0.0001) {
        this.velocity.x += (dvx / dvLen) * maxDv;
        this.velocity.z += (dvz / dvLen) * maxDv;
      } else {
        this.velocity.x = targetVx;
        this.velocity.z = targetVz;
      }
    }

    // Jump + Coyote time
    if (this.onGround) this.coyoteTimer = 0.1;
    else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

    if (keys.Space && this.coyoteTimer > 0) {
      this.velocity.y = 7.4;
      this.onGround = false;
      this.coyoteTimer = 0;
      this.sliding = false;
      this.crouched = false;
    }

    // Gravity
    this.velocity.y -= 21.5 * dt;

    // Move & Collide
    const prevYVel = this.velocity.y;
    const colHeight = this.sliding ? 1.1 : this.crouched ? 1.22 : 1.78;
    const wasGrounded = this.onGround;
    this.onGround = this.physics.moveCharacter(
      this.position,
      this.velocity,
      this.radius,
      colHeight,
      dt,
      wasGrounded
    );

    if (!wasGrounded && this.onGround && prevYVel < -4.5) {
      this.landingDip = Math.min(0.18, Math.abs(prevYVel) * 0.015);
      this.audio.playFootstep(true, false);
    }

    // Smooth camera eye height
    const targetEyeY = this.sliding ? 0.8 : this.crouched ? 1.04 : 1.62;
    this.currentEyeY += (targetEyeY - this.currentEyeY) * Math.min(1, dt * 15);
    this.landingDip *= Math.max(0, 1 - dt * 12);

    // Headbob & Footsteps (smooth modular phase, zero reverse wind-back)
    const speed2D = this.getSpeed2D();
    const isMovingGround = this.onGround && speed2D > 0.9 && !this.sliding;
    const targetBobAmp = isMovingGround ? Math.min(1, speed2D / 7.5) : 0;
    this.currentBobAmp += (targetBobAmp - this.currentBobAmp) * Math.min(1, dt * 10);

    if (isMovingGround) {
      const bobFreq = this.sprinting ? 10.4 : this.crouched ? 5.6 : 7.4;
      this.headbobPhase += dt * bobFreq;
      if (this.headbobPhase >= Math.PI * 2) {
        this.headbobPhase -= Math.PI * 2;
        this.lastStepCycle -= 2;
      }
      const cycle = Math.floor(this.headbobPhase / Math.PI);
      if (cycle !== this.lastStepCycle) {
        this.lastStepCycle = cycle;
        if (!this.crouched) {
          this.audio.playFootstep(this.sprinting, false);
        }
      }
    }

    // Dynamic FOV (Sprint / Slide / ADS Zoom)
    let targetFov = this.baseFov;
    if (this.sliding) targetFov += 9;
    else if (this.sprinting) targetFov += 6;

    if (adsProgress > 0.01 && weaponSpec) {
      const baseScale = weaponSpec.adsZoomScale || 0.74;
      const stepFactor = weaponSpec.isSniper
        ? (adsZoomStep === 2 ? 0.45 : adsZoomStep === 1 ? 0.65 : 1.0)
        : (adsZoomStep === 2 ? 0.54 : adsZoomStep === 1 ? 0.72 : 1.0);
      const adsTarget = this.baseFov * baseScale * stepFactor;
      targetFov = targetFov + (adsTarget - targetFov) * adsProgress;
    }

    if (Math.abs(this.currentFov - targetFov) > 0.02) {
      this.currentFov += (targetFov - this.currentFov) * Math.min(1, dt * 16);
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    this._syncCamera(dt, adsProgress, moveR);
  }

  _syncCamera(dt, adsProgress = 0, strafeInput = 0) {
    // Recoil & flinch recovery
    const recLerp = Math.min(1, dt * this.recoilRecovery);
    this.recoilPitch += (0 - this.recoilPitch) * recLerp;
    this.recoilYaw += (0 - this.recoilYaw) * recLerp;
    this.flinchPitch *= Math.max(0, 1 - dt * 14);
    this.shakeIntensity *= Math.max(0, 1 - dt * 10);

    const bobAmp = this.currentBobAmp * (1 - adsProgress * 0.88);
    const bobY = Math.sin(this.headbobPhase * 2) * 0.02 * bobAmp;
    const bobX = Math.cos(this.headbobPhase) * 0.01 * bobAmp;

    const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
    const shakeY = (Math.random() - 0.5) * this.shakeIntensity;

    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    this.camera.position.set(
      this.position.x + rightX * bobX,
      this.position.y + this.currentEyeY + bobY - this.landingDip,
      this.position.z + rightZ * bobX
    );

    const totalPitch = Math.max(
      -Math.PI * 0.48,
      Math.min(Math.PI * 0.48, this.pitch + this.recoilPitch + this.flinchPitch + shakeY)
    );
    const totalYaw = this.yaw + this.recoilYaw + shakeX;
    const slideTilt = this.sliding ? 0.08 * this.slideSide : -strafeInput * 0.018;

    this.camera.rotation.y = totalYaw;
    this.camera.rotation.x = totalPitch;
    this.camera.rotation.z += (slideTilt - this.camera.rotation.z) * Math.min(1, dt * 12);
  }
}
