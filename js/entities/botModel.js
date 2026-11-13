// =========================================================
// BLACKLINE // OPS — Articulated 3D Tactical Operator Model
// =========================================================
import * as THREE from "three";

const SHARED_GEOS = {
  thigh: null,
  shin: null,
  kneepad: null,
  boot: null,
  torso: null,
  vest: null,
  pouch: null,
  pack: null,
  antenna: null,
  head: null,
  helmet: null,
  visor: null,
  upperArm: null,
  foreArm: null,
  gunBody: null,
  gunBarrel: null,
  gunMag: null,
  gunOptic: null,
  pauldron: null,
  chevron: null,
  flash: null
};

function ensureSharedGeos() {
  if (SHARED_GEOS.thigh) return;
  SHARED_GEOS.thigh = new THREE.BoxGeometry(0.165, 0.36, 0.175);
  SHARED_GEOS.shin = new THREE.BoxGeometry(0.145, 0.35, 0.155);
  SHARED_GEOS.kneepad = new THREE.BoxGeometry(0.155, 0.11, 0.05);
  SHARED_GEOS.boot = new THREE.BoxGeometry(0.16, 0.13, 0.25);
  SHARED_GEOS.torso = new THREE.BoxGeometry(0.42, 0.56, 0.24);
  SHARED_GEOS.vest = new THREE.BoxGeometry(0.46, 0.42, 0.29);
  SHARED_GEOS.pouch = new THREE.BoxGeometry(0.32, 0.14, 0.06);
  SHARED_GEOS.pack = new THREE.BoxGeometry(0.28, 0.36, 0.14);
  SHARED_GEOS.antenna = new THREE.CylinderGeometry(0.008, 0.008, 0.28, 6);
  SHARED_GEOS.head = new THREE.SphereGeometry(0.155, 12, 10);
  SHARED_GEOS.helmet = new THREE.SphereGeometry(0.186, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
  SHARED_GEOS.visor = new THREE.BoxGeometry(0.22, 0.075, 0.09);
  SHARED_GEOS.upperArm = new THREE.BoxGeometry(0.125, 0.27, 0.13);
  SHARED_GEOS.foreArm = new THREE.BoxGeometry(0.11, 0.27, 0.115);
  SHARED_GEOS.gunBody = new THREE.BoxGeometry(0.06, 0.095, 0.46);
  SHARED_GEOS.gunBarrel = new THREE.CylinderGeometry(0.015, 0.015, 0.36, 8);
  SHARED_GEOS.gunMag = new THREE.BoxGeometry(0.04, 0.15, 0.075);
  SHARED_GEOS.gunOptic = new THREE.BoxGeometry(0.046, 0.048, 0.1);
  SHARED_GEOS.pauldron = new THREE.BoxGeometry(0.18, 0.16, 0.22);
  SHARED_GEOS.chevron = new THREE.OctahedronGeometry(0.095, 0);
  SHARED_GEOS.flash = new THREE.SphereGeometry(0.1, 6, 6);
}

export class BotModel {
  constructor(team = "red", isHeavy = false) {
    ensureSharedGeos();
    this.team = team;
    this.isHeavy = isHeavy;

    this.root = new THREE.Group();
    this.bodyPivot = new THREE.Group();
    this.root.add(this.bodyPivot);

    const isBlue = team === "blue";
    const clothCol = isBlue ? 0x26384d : 0x2c2427;
    const armorCol = isHeavy ? 0x1e293b : isBlue ? 0x1d4ed8 : 0x881337;
    const helmetCol = isBlue ? 0x1e293b : 0x18181b;
    const visorCol = isBlue ? 0x38bdf8 : 0xf43f5e;

    this.mats = {
      cloth: new THREE.MeshStandardMaterial({ color: clothCol, roughness: 0.85, metalness: 0.08 }),
      armor: new THREE.MeshStandardMaterial({ color: armorCol, roughness: 0.52, metalness: 0.38 }),
      helmet: new THREE.MeshStandardMaterial({ color: helmetCol, roughness: 0.42, metalness: 0.42 }),
      skin: new THREE.MeshStandardMaterial({ color: 0x333942, roughness: 0.8, metalness: 0.1 }),
      visor: new THREE.MeshStandardMaterial({
        color: visorCol,
        emissive: visorCol,
        emissiveIntensity: 1.65,
        roughness: 0.2,
        metalness: 0.3
      }),
      gun: new THREE.MeshStandardMaterial({ color: 0x1f252e, roughness: 0.38, metalness: 0.82 }),
      flash: new THREE.MeshBasicMaterial({ color: 0xffd56b, transparent: true, opacity: 0.94 })
    };

    // Pelvis at hip height (0.74 standing)
    this.pelvis = new THREE.Group();
    this.pelvis.position.set(0, 0.74, 0);
    this.bodyPivot.add(this.pelvis);

    // Articulated Thigh + Knee + Shin/Boot Legs
    this.leftHip = this._buildLeg(-0.125);
    this.rightHip = this._buildLeg(0.125);
    this.pelvis.add(this.leftHip.hip, this.rightHip.hip);

    // Torso
    this.torsoPivot = new THREE.Group();
    this.torsoPivot.position.set(0, 0.04, 0);
    this.pelvis.add(this.torsoPivot);

    const torsoMesh = new THREE.Mesh(SHARED_GEOS.torso, this.mats.cloth);
    torsoMesh.position.set(0, 0.28, 0);
    torsoMesh.castShadow = true;

    const vestMesh = new THREE.Mesh(SHARED_GEOS.vest, this.mats.armor);
    vestMesh.position.set(0, 0.3, 0);
    vestMesh.castShadow = true;

    const pouchMesh = new THREE.Mesh(SHARED_GEOS.pouch, this.mats.helmet);
    pouchMesh.position.set(0, 0.2, -0.155);

    const packMesh = new THREE.Mesh(SHARED_GEOS.pack, this.mats.helmet);
    packMesh.position.set(0, 0.31, 0.17);

    const antMesh = new THREE.Mesh(SHARED_GEOS.antenna, this.mats.gun);
    antMesh.position.set(0.1, 0.56, 0.18);

    this.torsoPivot.add(torsoMesh, vestMesh, pouchMesh, packMesh, antMesh);

    if (isHeavy) {
      const lp = new THREE.Mesh(SHARED_GEOS.pauldron, this.mats.armor);
      lp.position.set(-0.29, 0.48, 0);
      const rp = new THREE.Mesh(SHARED_GEOS.pauldron, this.mats.armor);
      rp.position.set(0.29, 0.48, 0);
      this.torsoPivot.add(lp, rp);
    }

    // Head + Helmet + Glowing Tactical Visor
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.65, 0);
    this.torsoPivot.add(this.headPivot);

    const headMesh = new THREE.Mesh(SHARED_GEOS.head, this.mats.skin);
    headMesh.position.set(0, 0.11, 0);
    headMesh.castShadow = true;
    const helmetMesh = new THREE.Mesh(SHARED_GEOS.helmet, this.mats.helmet);
    helmetMesh.position.set(0, 0.13, 0);
    helmetMesh.castShadow = true;
    const visorMesh = new THREE.Mesh(SHARED_GEOS.visor, this.mats.visor);
    visorMesh.position.set(0, 0.115, -0.13);
    this.headPivot.add(headMesh, helmetMesh, visorMesh);

    // Weapon Rig + Articulated Shoulders
    this.gunPivot = new THREE.Group();
    this.gunPivot.position.set(0.21, 0.42, -0.26);
    this.torsoPivot.add(this.gunPivot);

    const gunBody = new THREE.Mesh(SHARED_GEOS.gunBody, this.mats.gun);
    const gunBarrel = new THREE.Mesh(SHARED_GEOS.gunBarrel, this.mats.gun);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0, 0.015, -0.36);
    const gunMag = new THREE.Mesh(SHARED_GEOS.gunMag, this.mats.helmet);
    gunMag.position.set(0, -0.095, -0.04);
    gunMag.rotation.x = -0.18;
    const gunOptic = new THREE.Mesh(SHARED_GEOS.gunOptic, this.mats.helmet);
    gunOptic.position.set(0, 0.065, 0.02);

    this.muzzleFlash = new THREE.Mesh(SHARED_GEOS.flash, this.mats.flash);
    this.muzzleFlash.position.set(0, 0.015, -0.56);
    this.muzzleFlash.visible = false;
    this.gunPivot.add(gunBody, gunBarrel, gunMag, gunOptic, this.muzzleFlash);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.27, 0.49, 0);
    const rUpper = new THREE.Mesh(SHARED_GEOS.upperArm, this.mats.cloth);
    rUpper.position.set(0, -0.12, -0.04);
    rUpper.rotation.x = 0.72;
    rUpper.castShadow = true;
    const rFore = new THREE.Mesh(SHARED_GEOS.foreArm, this.mats.cloth);
    rFore.position.set(-0.04, -0.14, -0.2);
    rFore.rotation.x = 1.48;
    this.rightArm.add(rUpper, rFore);

    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.27, 0.49, 0);
    const lUpper = new THREE.Mesh(SHARED_GEOS.upperArm, this.mats.cloth);
    lUpper.position.set(0.06, -0.12, -0.06);
    lUpper.rotation.set(0.75, 0, -0.36);
    lUpper.castShadow = true;
    const lFore = new THREE.Mesh(SHARED_GEOS.foreArm, this.mats.cloth);
    lFore.position.set(0.24, -0.14, -0.25);
    lFore.rotation.set(1.45, 0, -0.68);
    this.leftArm.add(lUpper, lFore);

    this.torsoPivot.add(this.rightArm, this.leftArm);

    // Floating Ally Chevron
    this.allyMarker = new THREE.Mesh(
      SHARED_GEOS.chevron,
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    this.allyMarker.position.set(0, 2.08, 0);
    this.allyMarker.visible = isBlue;
    this.root.add(this.allyMarker);

    this.walkPhase = Math.random() * Math.PI * 2;
    this.flashTimer = 0;
    this.flinchTimer = 0;
    this.recoilTimer = 0;
    this.sprintBlend = 0;
    this.crouchBlend = 0;
    this.strafeLean = 0;
    this.deathProgress = 0;
    this.fallDir = 1;
  }

  _buildLeg(xOffset) {
    const hip = new THREE.Group();
    hip.position.set(xOffset, 0, 0);

    const thigh = new THREE.Mesh(SHARED_GEOS.thigh, this.mats.cloth);
    thigh.position.set(0, -0.18, 0);
    thigh.castShadow = true;

    const knee = new THREE.Group();
    knee.position.set(0, -0.36, 0);

    const shin = new THREE.Mesh(SHARED_GEOS.shin, this.mats.cloth);
    shin.position.set(0, -0.17, 0);
    shin.castShadow = true;

    const kneepad = new THREE.Mesh(SHARED_GEOS.kneepad, this.mats.helmet);
    kneepad.position.set(0, -0.02, -0.075);

    const boot = new THREE.Mesh(SHARED_GEOS.boot, this.mats.helmet);
    boot.position.set(0, -0.32, -0.03);
    boot.castShadow = true;

    knee.add(shin, kneepad, boot);
    hip.add(thigh, knee);
    return { hip, knee };
  }

  triggerMuzzleFlash() {
    this.flashTimer = 0.055;
    this.recoilTimer = 0.11;
    this.muzzleFlash.visible = true;
    const s = 0.85 + Math.random() * 0.5;
    this.muzzleFlash.scale.set(s, s, s);
  }

  triggerFlinch() {
    this.flinchTimer = 0.15;
  }

  resetPose(isBlue) {
    this.deathProgress = 0;
    this.flinchTimer = 0;
    this.flashTimer = 0;
    this.recoilTimer = 0;
    this.sprintBlend = 0;
    this.crouchBlend = 0;
    this.strafeLean = 0;
    this.muzzleFlash.visible = false;
    this.bodyPivot.rotation.set(0, 0, 0);
    this.bodyPivot.position.set(0, 0, 0);
    this.root.visible = true;
    this.allyMarker.visible = isBlue;
  }

  updateAnimation(dt, speed, isCrouching, isAlive, aimPitch = 0, isStunned = false, animState = null) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.muzzleFlash.visible = false;
    }
    if (this.recoilTimer > 0) {
      this.recoilTimer = Math.max(0, this.recoilTimer - dt);
    }

    if (!isAlive) {
      this.allyMarker.visible = false;
      this.deathProgress = Math.min(1, this.deathProgress + dt * 3.8);
      const ease = 1 - Math.pow(1 - this.deathProgress, 2);
      this.bodyPivot.rotation.x = ease * (Math.PI * 0.48) * this.fallDir;
      this.bodyPivot.position.y = ease * 0.16;
      return;
    }

    const isAiming = animState?.isAiming ?? false;
    const isSprinting = (animState?.isSprinting ?? speed > 5.1) && !isAiming && !isCrouching;
    const strafeInput = animState?.strafeInput ?? 0;

    // Smooth stance blends
    this.crouchBlend += ((isCrouching ? 1 : 0) - this.crouchBlend) * Math.min(1, dt * 13);
    this.sprintBlend += ((isSprinting ? 1 : 0) - this.sprintBlend) * Math.min(1, dt * 10);
    this.strafeLean += (strafeInput * -0.075 - this.strafeLean) * Math.min(1, dt * 9);

    // Real bent-knee crouch lowers pelvis smoothly
    const basePelvisY = 0.74 - this.crouchBlend * 0.24;

    if (speed > 0.25) {
      this.walkPhase = (this.walkPhase + dt * speed * 1.95) % (Math.PI * 2);
      const amp = Math.min(0.75, speed * 0.115);

      const lSwing = Math.sin(this.walkPhase) * amp;
      const rSwing = -lSwing;

      // Knee bends smoothly backward as leg swings back & lifts
      const lKnee = -Math.max(0.08, Math.cos(this.walkPhase) * 0.42 + 0.35) * Math.min(1, speed / 4.5);
      const rKnee = -Math.max(0.08, -Math.cos(this.walkPhase) * 0.42 + 0.35) * Math.min(1, speed / 4.5);

      this.leftHip.hip.rotation.x = lSwing + this.crouchBlend * 0.62;
      this.rightHip.hip.rotation.x = rSwing + this.crouchBlend * 0.62;
      this.leftHip.knee.rotation.x = lKnee - this.crouchBlend * 0.85;
      this.rightHip.knee.rotation.x = rKnee - this.crouchBlend * 0.85;

      const strideBob = Math.abs(Math.cos(this.walkPhase)) * 0.032 * Math.min(1, speed / 5);
      this.pelvis.position.y = basePelvisY + strideBob;
      this.torsoPivot.rotation.y = Math.sin(this.walkPhase) * (0.06 + this.sprintBlend * 0.09);
    } else {
      const idleLerp = Math.min(1, dt * 12);
      this.leftHip.hip.rotation.x += (this.crouchBlend * 0.65 - this.leftHip.hip.rotation.x) * idleLerp;
      this.rightHip.hip.rotation.x += (this.crouchBlend * 0.58 - this.rightHip.hip.rotation.x) * idleLerp;
      this.leftHip.knee.rotation.x += (this.crouchBlend * -1.08 - this.leftHip.knee.rotation.x) * idleLerp;
      this.rightHip.knee.rotation.x += (this.crouchBlend * -1.02 - this.rightHip.knee.rotation.x) * idleLerp;
      this.pelvis.position.y = basePelvisY;
      this.torsoPivot.rotation.y *= Math.max(0, 1 - dt * 10);
    }

    this.bodyPivot.rotation.z = this.strafeLean;

    let flinchPitch = 0;
    if (this.flinchTimer > 0) {
      this.flinchTimer -= dt;
      flinchPitch = (this.flinchTimer / 0.15) * 0.24;
    }

    const recoilKick = this.recoilTimer > 0 ? Math.sin((this.recoilTimer / 0.11) * Math.PI) : 0;

    if (isStunned) {
      this.gunPivot.position.set(0.18, 0.34, -0.18);
      this.gunPivot.rotation.set(-0.4, 0.6, 0.4);
      this.rightArm.rotation.x = 0.85;
      this.leftArm.rotation.x = 0.95;
      this.headPivot.rotation.y = Math.sin(performance.now() * 0.018) * 0.35;
    } else {
      // Blend gun & arms between Tactical Sprint (across chest) and Shoulder Aim
      const sb = this.sprintBlend;
      this.gunPivot.position.set(
        0.21 - sb * 0.15,
        0.42 - sb * 0.07,
        -0.26 + sb * 0.05 + recoilKick * 0.055
      );
      this.gunPivot.rotation.set(
        aimPitch * (1 - sb) - sb * 0.24 + recoilKick * 0.14,
        sb * 0.58,
        sb * 0.18
      );

      this.rightArm.rotation.set(aimPitch * 0.6 * (1 - sb) - sb * 0.35 + recoilKick * 0.12, sb * 0.3, 0);
      this.leftArm.rotation.set(aimPitch * 0.55 * (1 - sb) - sb * 0.22 + recoilKick * 0.1, sb * 0.2, 0);
      this.headPivot.rotation.y = -this.torsoPivot.rotation.y * 0.7;
      this.headPivot.rotation.x = aimPitch * 0.5;
    }

    // Athletic forward lean while sprinting or crouching
    this.torsoPivot.rotation.x = flinchPitch - this.sprintBlend * 0.18 - this.crouchBlend * 0.16;

    if (this.allyMarker.visible) {
      this.allyMarker.rotation.y += dt * 2.2;
      this.allyMarker.position.y = (2.08 - this.crouchBlend * 0.42) + Math.sin(performance.now() * 0.005) * 0.05;
    }
  }

  dispose() {
    for (const k of Object.keys(this.mats)) {
      this.mats[k].dispose();
    }
    if (this.allyMarker.material) this.allyMarker.material.dispose();
  }
}
