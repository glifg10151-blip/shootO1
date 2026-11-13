// =========================================================
// BLACKLINE // OPS — 3D Map Builder & Objective Beacons
// =========================================================
import * as THREE from "three";

export class MapBuilder {
  constructor(scene, texMgr, quality = "high") {
    this.scene = scene;
    this.texMgr = texMgr;
    this.quality = quality;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.disposables = [];
    this.supplyVisuals = [];
    this.hardpointGroup = null;
    this.hardpointRingMat = null;
    this.hardpointBeamMat = null;
  }

  _track(obj) {
    this.disposables.push(obj);
    return obj;
  }

  build(mapData) {
    const theme = mapData.theme;
    const enableShadows = this.quality !== "low";
    const shadowSize = this.quality === "high" ? 2048 : 1024;

    // Atmosphere & Sky
    this.scene.fog = new THREE.FogExp2(theme.fogColor, theme.fogDensity);
    const sky = this.texMgr.createSkyDome(theme.skyTop, theme.skyHorizon);
    this.group.add(sky);

    // Lighting Rig
    const hemi = new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, theme.hemiIntensity);
    this.group.add(hemi);

    const sun = new THREE.DirectionalLight(theme.sunColor, theme.sunIntensity);
    sun.position.set(theme.sunPos[0], theme.sunPos[1], theme.sunPos[2]);
    if (enableShadows) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(shadowSize, shadowSize);
      const frustum = Math.max(mapData.halfW, mapData.halfD) + 8;
      sun.shadow.camera.left = -frustum;
      sun.shadow.camera.right = frustum;
      sun.shadow.camera.top = frustum;
      sun.shadow.camera.bottom = -frustum;
      sun.shadow.camera.near = 5;
      sun.shadow.camera.far = 220;
      sun.shadow.bias = -0.0005;
      sun.shadow.normalBias = 0.025;
    }
    this.group.add(sun);

    if (this.quality !== "low" && mapData.lights) {
      for (const l of mapData.lights) {
        const pt = new THREE.PointLight(l.color, l.intensity, l.distance, 1.6);
        pt.position.set(l.x, l.y, l.z);
        this.group.add(pt);
      }
    }

    // Ground Floor
    const groundW = mapData.halfW * 2 + 12;
    const groundD = mapData.halfD * 2 + 12;
    const groundGeo = this._track(new THREE.PlaneGeometry(groundW, groundD));
    const groundMat = this.texMgr.getGroundMaterial(theme.groundMat, mapData.halfW, mapData.halfD);
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = enableShadows;
    this.group.add(groundMesh);

    // Map-specific ground markings
    if (mapData.id === "blacksite") {
      this._buildHelipadDecal(46, 0);
    } else if (mapData.id === "killhouse") {
      this._buildCrosswalkLines();
    }

    // Solid Obstacles & Buildings
    for (const s of mapData.solids) {
      const geo = this._track(new THREE.BoxGeometry(s.w, s.h, s.d));
      const mat = this.texMgr.getBoxMaterial(s.mat, s.w, s.h, s.d);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(s.x, s.yBase + s.h * 0.5, s.z);
      mesh.castShadow = enableShadows && s.h >= 0.8;
      mesh.receiveShadow = enableShadows;
      this.group.add(mesh);
    }

    // Walkable Ramps
    for (const r of mapData.ramps || []) {
      const run = r.axis === "x" ? r.w : r.d;
      const rise = r.yEnd - r.yStart;
      const slopeLen = Math.hypot(run, rise);
      const angle = Math.atan2(rise, run);

      const deckW = r.axis === "x" ? slopeLen : r.w;
      const deckD = r.axis === "x" ? r.d : slopeLen;
      const geo = this._track(new THREE.BoxGeometry(deckW, 0.16, deckD));
      const mat = this.texMgr.getBoxMaterial(r.mat || "metalDeck", deckW, 0.4, deckD);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(r.x, (r.yStart + r.yEnd) * 0.5 - 0.08, r.z);

      if (r.axis === "x") {
        mesh.rotation.z = r.dir === 1 ? angle : -angle;
      } else {
        mesh.rotation.x = r.dir === 1 ? -angle : angle;
      }

      mesh.castShadow = enableShadows;
      mesh.receiveShadow = enableShadows;
      this.group.add(mesh);

      // Support pillar under high end
      const strutH = Math.max(0.2, r.yEnd - 0.15);
      const strutGeo = this._track(new THREE.BoxGeometry(0.28, strutH, 0.28));
      const strutMat = this.texMgr.getBoxMaterial("hazardMetal", 0.5, strutH, 0.5);
      const off = (run * 0.5 - 0.25) * (r.dir === 1 ? 1 : -1);
      const sx = r.axis === "x" ? r.x + off : r.x;
      const sz = r.axis === "z" ? r.z + off : r.z;
      const strut = new THREE.Mesh(strutGeo, strutMat);
      strut.position.set(sx, strutH * 0.5, sz);
      this.group.add(strut);
    }

    // Supply Crates
    for (const c of mapData.supplyCrates || []) {
      this._buildSupplyStation(c.x, c.y, c.z, enableShadows);
    }

    // Hardpoint Objective Marker (hidden unless Hardpoint mode)
    this._buildHardpointMarker();
  }

  _buildHelipadDecal(hx, hz) {
    const padMat = this._track(
      new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.72, depthWrite: false })
    );
    const ringGeo = this._track(new THREE.RingGeometry(4.2, 4.65, 36));
    const ring = new THREE.Mesh(ringGeo, padMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(hx, 0.02, hz);
    this.group.add(ring);

    const bar1 = new THREE.Mesh(this._track(new THREE.PlaneGeometry(0.55, 3.6)), padMat);
    bar1.rotation.x = -Math.PI / 2;
    bar1.position.set(hx - 1.1, 0.02, hz);
    const bar2 = new THREE.Mesh(this._track(new THREE.PlaneGeometry(0.55, 3.6)), padMat);
    bar2.rotation.x = -Math.PI / 2;
    bar2.position.set(hx + 1.1, 0.02, hz);
    const cross = new THREE.Mesh(this._track(new THREE.PlaneGeometry(2.2, 0.55)), padMat);
    cross.rotation.x = -Math.PI / 2;
    cross.position.set(hx, 0.02, hz);
    this.group.add(bar1, bar2, cross);
  }

  _buildCrosswalkLines() {
    const lineMat = this._track(
      new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.25, depthWrite: false })
    );
    for (let i = -40; i <= 40; i += 8) {
      const strip = new THREE.Mesh(this._track(new THREE.PlaneGeometry(0.28, 3.2)), lineMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(i, 0.015, 0);
      this.group.add(strip);
    }
  }

  _buildSupplyStation(x, y, z, enableShadows) {
    const crateMat = this._track(
      new THREE.MeshStandardMaterial({ color: 0x2f4530, roughness: 0.65, metalness: 0.25 })
    );
    const trimMat = this._track(
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.85, roughness: 0.3 })
    );
    const holoMat = this._track(
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.82, wireframe: true })
    );

    const crate = new THREE.Mesh(this._track(new THREE.BoxGeometry(1.3, 0.62, 0.85)), crateMat);
    crate.position.set(x, y + 0.31, z);
    crate.castShadow = enableShadows;
    crate.receiveShadow = enableShadows;

    const stripe = new THREE.Mesh(this._track(new THREE.BoxGeometry(1.32, 0.08, 0.87)), trimMat);
    stripe.position.set(x, y + 0.52, z);

    const holo = new THREE.Mesh(this._track(new THREE.OctahedronGeometry(0.28, 0)), holoMat);
    holo.position.set(x, y + 1.2, z);

    const ringGeo = this._track(new THREE.RingGeometry(1.25, 1.42, 24));
    const ringMat = this._track(
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
    );
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.03, z);

    this.group.add(crate, stripe, holo, ring);
    this.supplyVisuals.push({ holo, baseY: y + 1.2, ringMat });
  }

  _buildHardpointMarker() {
    this.hardpointGroup = new THREE.Group();
    this.hardpointGroup.visible = false;

    this.hardpointRingMat = this._track(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    const ring = new THREE.Mesh(this._track(new THREE.RingGeometry(0.92, 1.0, 40)), this.hardpointRingMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;

    this.hardpointBeamMat = this._track(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    const beam = new THREE.Mesh(this._track(new THREE.CylinderGeometry(1.0, 1.0, 14, 24, 1, true)), this.hardpointBeamMat);
    beam.position.y = 7;

    this.hardpointGroup.add(ring, beam);
    this.group.add(this.hardpointGroup);
  }

  updateHardpointVisual(zone, ownerState) {
    if (!this.hardpointGroup) return;
    if (!zone) {
      this.hardpointGroup.visible = false;
      return;
    }
    this.hardpointGroup.visible = true;
    this.hardpointGroup.position.set(zone.x, zone.y, zone.z);
    this.hardpointGroup.scale.set(zone.radius, 1, zone.radius);

    let col = 0xe2e8f0; // neutral
    if (ownerState === "blue") col = 0x38bdf8;
    else if (ownerState === "red") col = 0xf43f5e;
    else if (ownerState === "contested") col = 0xf59e0b;

    this.hardpointRingMat.color.setHex(col);
    this.hardpointBeamMat.color.setHex(col);
  }

  update(dt, elapsed) {
    for (let i = 0; i < this.supplyVisuals.length; i++) {
      const sv = this.supplyVisuals[i];
      sv.holo.rotation.y += dt * 1.9;
      sv.holo.position.y = sv.baseY + Math.sin(elapsed * 3.2 + i) * 0.1;
      sv.ringMat.opacity = 0.35 + 0.18 * Math.sin(elapsed * 4 + i);
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.scene.fog = null;
    for (const d of this.disposables) {
      if (d && typeof d.dispose === "function") d.dispose();
    }
    this.disposables.length = 0;
    this.supplyVisuals.length = 0;
  }
}
