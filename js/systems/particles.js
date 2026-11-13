// =========================================================
// BLACKLINE // OPS — High-Performance Combat VFX & Tracers
// =========================================================
import * as THREE from "three";

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.tracers = [];
    this.decals = [];
    this.jets = [];

    this.maxDecals = 48;
    this.maxParticles = 180;

    // Shared base geometries
    this.boxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.sphereGeo = new THREE.SphereGeometry(1, 7, 7);
    this.shellGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.032, 6);
    this.decalGeo = new THREE.PlaneGeometry(0.14, 0.14);
    this.ringGeo = new THREE.RingGeometry(0.6, 1.0, 24);
    this.tracerGeo = new THREE.CylinderGeometry(0.015, 0.015, 1, 5);
    this.tracerGeo.rotateX(Math.PI / 2);

    this.shellMat = new THREE.MeshStandardMaterial({ color: 0xd9a841, roughness: 0.25, metalness: 0.9 });
    this.decalMat = new THREE.MeshBasicMaterial({
      color: 0x0b0e14,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1
    });

    this.upVec = new THREE.Vector3(0, 1, 0);
  }

  _addParticle(mesh, vel, life, gravity = 9.8, scaleGrow = 0, bounceGround = false) {
    if (this.particles.length >= this.maxParticles) {
      const oldest = this.particles.shift();
      this.scene.remove(oldest.mesh);
      if (oldest.disposeMat) oldest.mesh.material.dispose();
    }
    this.scene.add(mesh);
    this.particles.push({
      mesh,
      vel,
      life,
      maxLife: life,
      gravity,
      scaleGrow,
      bounceGround,
      rotSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14
      )
    });
  }

  spawnTracer(start, end, colorHex = 0xffd27d, radiusScale = 1.0) {
    const dir = new THREE.Vector3().subVectors(end, start);
    const totalDist = dir.length();
    if (totalDist < 0.2) return;
    dir.normalize();

    const segLen = Math.min(3.4, totalDist * 0.65);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(this.tracerGeo, mat);
    mesh.scale.set(radiusScale, radiusScale, segLen);
    mesh.position.copy(start).addScaledVector(dir, segLen * 0.5);
    mesh.lookAt(end);
    this.scene.add(mesh);

    this.tracers.push({
      mesh,
      mat,
      start: start.clone(),
      dir,
      traveled: segLen * 0.5,
      totalDist,
      speed: 175
    });
  }

  spawnShellCasing(pos, rightVec, upVec, forwardVec) {
    const mesh = new THREE.Mesh(this.shellGeo, this.shellMat);
    mesh.position.copy(pos);
    const vel = new THREE.Vector3()
      .addScaledVector(rightVec, 1.9 + Math.random() * 0.9)
      .addScaledVector(upVec, 1.4 + Math.random() * 0.7)
      .addScaledVector(forwardVec, (Math.random() - 0.5) * 0.7);
    this._addParticle(mesh, vel, 1.4, 11.5, 0, true);
  }

  spawnImpact(point, normal, matType = "concrete", isFlesh = false) {
    if (isFlesh) {
      for (let i = 0; i < 6; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xb91c1c, transparent: true, opacity: 0.9 });
        const mesh = new THREE.Mesh(this.sphereGeo, mat);
        const s = 0.035 + Math.random() * 0.03;
        mesh.scale.set(s, s, s);
        mesh.position.copy(point);
        const vel = new THREE.Vector3(
          (Math.random() - 0.5) * 4.2,
          1.2 + Math.random() * 2.5,
          (Math.random() - 0.5) * 4.2
        );
        this._addParticle(mesh, vel, 0.34, 12.0, 0.4, false);
      }
      return;
    }

    const isMetal =
      matType &&
      (matType.startsWith("container") || matType === "metalDeck" || matType === "hazardMetal");

    // Bullet hole decal on wall/ground
    if (normal) {
      if (this.decals.length >= this.maxDecals) {
        const old = this.decals.shift();
        this.scene.remove(old.mesh);
      }
      const decal = new THREE.Mesh(this.decalGeo, this.decalMat);
      decal.position.copy(point).addScaledVector(normal, 0.015);
      const target = decal.position.clone().add(normal);
      decal.lookAt(target);
      decal.rotation.z = Math.random() * Math.PI * 2;
      this.scene.add(decal);
      this.decals.push({ mesh: decal, life: 7.5 });
    }

    const n = normal ? normal.clone() : new THREE.Vector3(0, 1, 0);
    if (isMetal) {
      // Bright welding-style sparks
      for (let i = 0; i < 6; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.95 });
        const mesh = new THREE.Mesh(this.boxGeo, mat);
        mesh.scale.set(0.03, 0.03, 0.08);
        mesh.position.copy(point);
        const vel = new THREE.Vector3(
          n.x * 3.2 + (Math.random() - 0.5) * 5.0,
          n.y * 3.2 + 1.0 + Math.random() * 3.2,
          n.z * 3.2 + (Math.random() - 0.5) * 5.0
        );
        this._addParticle(mesh, vel, 0.28, 15.0, 0, true);
      }
    } else {
      // Concrete / wood dust puff
      const dustCol = matType === "woodCrate" ? 0xa17d53 : 0x9ca3af;
      for (let i = 0; i < 4; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: dustCol, transparent: true, opacity: 0.6 });
        const mesh = new THREE.Mesh(this.sphereGeo, mat);
        const s = 0.055 + Math.random() * 0.04;
        mesh.scale.set(s, s, s);
        mesh.position.copy(point);
        const vel = new THREE.Vector3(
          n.x * 1.4 + (Math.random() - 0.5) * 2.0,
          n.y * 1.4 + 0.8 + Math.random() * 1.5,
          n.z * 1.4 + (Math.random() - 0.5) * 2.0
        );
        this._addParticle(mesh, vel, 0.42, 3.0, 2.2, false);
      }
    }
  }

  spawnExplosion(pos, scale = 1.0) {
    // Fireball core
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xff8c24, transparent: true, opacity: 0.95 });
    const fire = new THREE.Mesh(this.sphereGeo, fireMat);
    fire.scale.set(0.5 * scale, 0.5 * scale, 0.5 * scale);
    fire.position.copy(pos);
    this._addParticle(fire, new THREE.Vector3(0, 1.4, 0), 0.36, -1.0, 9.5 * scale, false);

    // Ground shockwave ring
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const ring = new THREE.Mesh(this.ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, Math.max(0.06, pos.y + 0.06), pos.z);
    ring.scale.set(0.6 * scale, 0.6 * scale, 1);
    this._addParticle(ring, new THREE.Vector3(0, 0, 0), 0.35, 0, 18 * scale, false);

    // Billowing dark smoke & hot shrapnel debris
    for (let i = 0; i < 8; i++) {
      const smokeMat = new THREE.MeshBasicMaterial({ color: 0x262930, transparent: true, opacity: 0.72 });
      const smoke = new THREE.Mesh(this.sphereGeo, smokeMat);
      const s = (0.35 + Math.random() * 0.25) * scale;
      smoke.scale.set(s, s, s);
      smoke.position.set(
        pos.x + (Math.random() - 0.5) * 1.1,
        pos.y + 0.2,
        pos.z + (Math.random() - 0.5) * 1.1
      );
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 3.5,
        2.6 + Math.random() * 3.4,
        (Math.random() - 0.5) * 3.5
      );
      this._addParticle(smoke, vel, 1.1 + Math.random() * 0.4, -0.5, 2.2 * scale, false);
    }

    for (let i = 0; i < 10; i++) {
      const emberMat = new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.95 });
      const ember = new THREE.Mesh(this.boxGeo, emberMat);
      ember.scale.set(0.08, 0.08, 0.14);
      ember.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 14 * scale,
        5 + Math.random() * 9 * scale,
        (Math.random() - 0.5) * 14 * scale
      );
      this._addParticle(ember, vel, 0.75, 18.0, 0, true);
    }
  }

  spawnJetFlyover(startPos, endPos, duration = 2.4) {
    const jet = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.8 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 5.2), bodyMat);
    const wings = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.12, 1.8), bodyMat);
    wings.position.z = 0.4;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 1.2), bodyMat);
    tail.position.set(0, 0.6, 1.9);
    const burnerL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), glowMat);
    burnerL.position.set(-0.28, 0, 2.65);
    const burnerR = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), glowMat);
    burnerR.position.set(0.28, 0, 2.65);

    jet.add(fuselage, wings, tail, burnerL, burnerR);
    jet.position.copy(startPos);
    jet.lookAt(endPos);
    this.scene.add(jet);

    this.jets.push({
      mesh: jet,
      start: startPos.clone(),
      end: endPos.clone(),
      elapsed: 0,
      duration
    });
  }

  update(dt) {
    // Update bullet tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.traveled += tr.speed * dt;
      if (tr.traveled >= tr.totalDist) {
        this.scene.remove(tr.mesh);
        tr.mat.dispose();
        this.tracers.splice(i, 1);
      } else {
        tr.mesh.position.copy(tr.start).addScaledVector(tr.dir, tr.traveled);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        if (p.mesh.material && p.mesh.material !== this.shellMat) {
          p.mesh.material.dispose();
        }
        this.particles.splice(i, 1);
        continue;
      }

      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.rotSpeed.x * dt;
      p.mesh.rotation.y += p.rotSpeed.y * dt;

      if (p.bounceGround && p.mesh.position.y < 0.02) {
        p.mesh.position.y = 0.02;
        p.vel.y = Math.abs(p.vel.y) * 0.42;
        p.vel.x *= 0.72;
        p.vel.z *= 0.72;
      }

      if (p.scaleGrow !== 0) {
        const g = p.scaleGrow * dt;
        p.mesh.scale.x += g;
        p.mesh.scale.y += g;
        if (p.mesh.geometry !== this.ringGeo) {
          p.mesh.scale.z += g;
        }
      }

      if (p.mesh.material && p.mesh.material.transparent) {
        p.mesh.material.opacity = Math.max(0, (p.life / p.maxLife) * 0.9);
      }
    }

    // Update bullet hole decals
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        this.decals.splice(i, 1);
      }
    }

    // Update flyover jets
    for (let i = this.jets.length - 1; i >= 0; i--) {
      const j = this.jets[i];
      j.elapsed += dt;
      const t = j.elapsed / j.duration;
      if (t >= 1) {
        this.scene.remove(j.mesh);
        j.mesh.traverse((child) => {
          if (child.isMesh) {
            child.geometry.dispose();
            child.material.dispose();
          }
        });
        this.jets.splice(i, 1);
      } else {
        j.mesh.position.lerpVectors(j.start, j.end, t);
      }
    }
  }

  dispose() {
    for (const tr of this.tracers) {
      this.scene.remove(tr.mesh);
      tr.mat.dispose();
    }
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      if (p.mesh.material && p.mesh.material !== this.shellMat) p.mesh.material.dispose();
    }
    for (const d of this.decals) {
      this.scene.remove(d.mesh);
    }
    for (const j of this.jets) {
      this.scene.remove(j.mesh);
    }
    this.tracers.length = 0;
    this.particles.length = 0;
    this.decals.length = 0;
    this.jets.length = 0;

    this.boxGeo.dispose();
    this.sphereGeo.dispose();
    this.shellGeo.dispose();
    this.decalGeo.dispose();
    this.ringGeo.dispose();
    this.tracerGeo.dispose();
    this.shellMat.dispose();
    this.decalMat.dispose();
  }
}
