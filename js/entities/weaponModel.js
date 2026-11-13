// =========================================================
// BLACKLINE // OPS — 3D PBR Weapon Viewmodels & Textures
// =========================================================
import * as THREE from "three";

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smooth(t) {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

function seg(p, a, b) {
  return clamp01((p - a) / Math.max(0.0001, b - a));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let SHARED_TEX = null;

function makeCanvasTex(size, drawFn, isSRGB = true, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  drawFn(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (isSRGB) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function getSharedWeaponTextures() {
  if (SHARED_TEX) return SHARED_TEX;

  // Procedural sky-studio reflection map so metals & scopes gleam cleanly
  const envCanvas = document.createElement("canvas");
  envCanvas.width = 256;
  envCanvas.height = 128;
  const ectx = envCanvas.getContext("2d");
  const envGrad = ectx.createLinearGradient(0, 0, 0, 128);
  envGrad.addColorStop(0.0, "#7dd3fc");
  envGrad.addColorStop(0.38, "#cbd5e1");
  envGrad.addColorStop(0.5, "#f8fafc");
  envGrad.addColorStop(0.54, "#334155");
  envGrad.addColorStop(1.0, "#0f172a");
  ectx.fillStyle = envGrad;
  ectx.fillRect(0, 0, 256, 128);
  // Crisp overhead light strips for realistic brushed-metal highlights
  ectx.fillStyle = "rgba(255, 245, 220, 0.85)";
  ectx.fillRect(28, 16, 62, 14);
  ectx.fillRect(156, 20, 72, 12);
  const envMap = new THREE.CanvasTexture(envCanvas);
  envMap.mapping = THREE.EquirectangularReflectionMapping;
  envMap.colorSpace = THREE.SRGBColorSpace;
  envMap.needsUpdate = true;

  // 1. Anodized Gunmetal (brushed metal grain + subtle edge wear + micro-scratches)
  const r1 = mulberry32(1001);
  const metalMap = makeCanvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#343d4b";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1600; i++) {
      const v = Math.floor(42 + r1() * 34);
      ctx.fillStyle = `rgba(${v},${v + 6},${v + 15},0.35)`;
      ctx.fillRect(r1() * s, r1() * s, 14 + r1() * 34, 1.5);
    }
    // Subtle brushed edge highlights & machining seams
    ctx.strokeStyle = "rgba(180, 198, 220, 0.16)";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, s - 4, s - 4);
    for (let i = 0; i < 45; i++) {
      ctx.fillStyle = "rgba(210, 225, 245, 0.12)";
      ctx.fillRect(r1() * s, r1() * s, 6 + r1() * 16, 1);
    }
  });
  const metalBump = makeCanvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) {
      const g = Math.floor(105 + r1() * 48);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(r1() * s, r1() * s, 16 + r1() * 28, 1.5);
    }
  }, false);

  // 2. Machined Picatinny Rail / Shroud Grooves
  const railMap = makeCanvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#485466";
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 24) {
      ctx.fillStyle = "#222933";
      ctx.fillRect(0, y, s, 9);
      ctx.fillStyle = "rgba(203, 213, 225, 0.22)";
      ctx.fillRect(0, y + 9, s, 2);
    }
  }, true, 1, 2);
  const railBump = makeCanvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#d0d0d0";
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 24) {
      ctx.fillStyle = "#202020";
      ctx.fillRect(0, y, s, 9);
    }
  }, false, 1, 2);

  // 3. Brushed Stainless / Titanium Steel (Deagle slide, barrels, bolts)
  const r3 = mulberry32(3003);
  const steelMap = makeCanvasTex(256, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, "#9aa6b8");
    g.addColorStop(0.5, "#b7c3d4");
    g.addColorStop(1, "#7f8c9f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = r3() > 0.5 ? "rgba(255,255,255,0.09)" : "rgba(15,23,42,0.09)";
      ctx.fillRect(0, r3() * s, s, 1);
    }
  });
  const steelBump = makeCanvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const v = Math.floor(110 + r3() * 35);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, r3() * s, s, 1);
    }
  }, false);

  // 4. Stippled Tactical Polymer (Grips, Forends, Stocks)
  const r4 = mulberry32(4004);
  const polyMap = makeCanvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#222832";
    ctx.fillRect(0, 0, s, s);
    const step = 8;
    for (let y = 0; y < s; y += step) {
      for (let x = 0; x < s; x += step) {
        const shade = Math.floor(24 + r4() * 20);
        ctx.fillStyle = `rgb(${shade},${shade + 4},${shade + 9})`;
        ctx.fillRect(x + 1, y + 1, step - 2, step - 2);
      }
    }
  }, true, 2, 2);
  const polyBump = makeCanvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#505050";
    ctx.fillRect(0, 0, s, s);
    const step = 8;
    for (let y = 0; y < s; y += step) {
      for (let x = 0; x < s; x += step) {
        const v = Math.floor(150 + r4() * 75);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x + 1, y + 1, step - 3, step - 3);
      }
    }
  }, false, 2, 2);

  // 5. FDE Coyote Cerakote with Digital Hex Tactical Camo
  const r5 = mulberry32(5005);
  const fdeMap = makeCanvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#9b8463";
    ctx.fillRect(0, 0, s, s);
    const palette = ["#877051", "#ad9674", "#705b40", "#b8a382"];
    for (let i = 0; i < 360; i++) {
      ctx.fillStyle = palette[Math.floor(r5() * palette.length)];
      ctx.globalAlpha = 0.48;
      ctx.fillRect(Math.floor(r5() * 32) * 8, Math.floor(r5() * 32) * 8, (1 + Math.floor(r5() * 3)) * 8, 8);
    }
    ctx.globalAlpha = 1;
    // Fine Cerakote matte speckle
    for (let i = 0; i < 1200; i++) {
      ctx.fillStyle = r5() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
      ctx.fillRect(r5() * s, r5() * s, 2, 2);
    }
  });

  // 6. AK-47 Laminated Wood Grain
  const r6 = mulberry32(6006);
  const woodMap = makeCanvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#804d26";
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 3) {
      const wave = Math.sin(y * 0.14) * 14 + (r6() - 0.5) * 12;
      ctx.fillStyle = y % 6 === 0 ? "rgba(52, 26, 8, 0.34)" : "rgba(186, 122, 62, 0.18)";
      ctx.fillRect(0, y, s, 2 + (wave > 0 ? 1 : 0));
    }
    for (let i = 0; i < 240; i++) {
      ctx.fillStyle = "rgba(42, 20, 6, 0.25)";
      ctx.fillRect(r6() * s, r6() * s, 24 + r6() * 55, 1.5);
    }
  });
  const woodBump = makeCanvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#888888";
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) {
      const g = Math.floor(110 + Math.sin(y * 0.2) * 35 + r6() * 20);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(0, y, s, 2);
    }
  }, false);

  // 7. Olive Drab Woodland Camo (M249 Ammo Box)
  const r7 = mulberry32(7007);
  const oliveMap = makeCanvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#48593d";
    ctx.fillRect(0, 0, s, s);
    const cols = ["#36442d", "#586b4a", "#30382a", "#697754"];
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = cols[Math.floor(r7() * cols.length)];
      ctx.globalAlpha = 0.55;
      ctx.fillRect(Math.floor(r7() * 16) * 16, Math.floor(r7() * 16) * 16, 16 + Math.floor(r7() * 2) * 16, 16);
    }
    ctx.globalAlpha = 1;
    // Stencil ammo warning line
    ctx.fillStyle = "rgba(250, 204, 21, 0.45)";
    ctx.fillRect(18, 22, 92, 10);
  });

  // 8. Tactical Ripstop Sleeve Fabric + Glove Micro-Weave
  const r8 = mulberry32(8008);
  const sleeveMap = makeCanvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#334155";
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(15, 23, 42, 0.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i < s; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, s);
      ctx.moveTo(0, i);
      ctx.lineTo(s, i);
      ctx.stroke();
    }
    // Subtle dark tactical camo patches on sleeve
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = r8() > 0.5 ? "rgba(30, 41, 59, 0.45)" : "rgba(71, 85, 105, 0.35)";
      ctx.fillRect(r8() * s, r8() * s, 18 + r8() * 28, 12 + r8() * 20);
    }
  }, true, 2, 2);

  const sleeveBump = makeCanvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "#585858";
    ctx.lineWidth = 1;
    for (let i = 0; i < s; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, s);
      ctx.moveTo(0, i);
      ctx.lineTo(s, i);
      ctx.stroke();
    }
  }, false, 2, 2);

  SHARED_TEX = {
    envMap,
    metalMap,
    metalBump,
    railMap,
    railBump,
    steelMap,
    steelBump,
    polyMap,
    polyBump,
    fdeMap,
    woodMap,
    woodBump,
    oliveMap,
    sleeveMap,
    sleeveBump
  };
  return SHARED_TEX;
}

export class WeaponViewModel {
  constructor() {
    this.tex = getSharedWeaponTextures();

    this.root = new THREE.Group();
    this.gunContainer = new THREE.Group();
    this.root.add(this.gunContainer);

    this.muzzleFlashGroup = new THREE.Group();
    this.muzzleLight = new THREE.PointLight(0xffb84d, 0, 7, 2);
    this.muzzleFlashGroup.add(this.muzzleLight);
    this._buildMuzzleFlashPlanes();

    this.knifeGroup = this._buildKnifeModel();
    this.knifeGroup.visible = false;
    this.root.add(this.knifeGroup);

    this.hipPos = new THREE.Vector3(0.23, -0.22, -0.44);
    this.adsPos = new THREE.Vector3(0, -0.085, -0.39);
    this.muzzleLocalPos = new THREE.Vector3(0, 0.03, -0.6);

    this.currentGroup = null;
    this.leftArmGroup = null;
    this.magGroup = null;
    this.boltGroup = null;
    this.coverGroup = null;
    this.holoReticle = null;

    this.flashTimer = 0;
    this.disposables = [];
  }

  _track(obj) {
    this.disposables.push(obj);
    return obj;
  }

  _pbr(opts) {
    return this._track(
      new THREE.MeshStandardMaterial({
        envMap: this.tex.envMap,
        envMapIntensity: opts.env ?? 0.95,
        color: opts.color ?? 0xffffff,
        map: opts.map ?? null,
        bumpMap: opts.bumpMap ?? null,
        bumpScale: opts.bumpScale ?? 0.004,
        roughness: opts.roughness ?? 0.45,
        metalness: opts.metalness ?? 0.65,
        emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissiveIntensity ?? 0
      })
    );
  }

  _box(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const geo = this._track(new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    if (rx || ry || rz) mesh.rotation.set(rx, ry, rz);
    return mesh;
  }

  _cyl(rTop, rBot, len, segs, mat, x = 0, y = 0, z = 0, rx = Math.PI / 2, ry = 0, rz = 0) {
    const geo = this._track(new THREE.CylinderGeometry(rTop, rBot, len, segs));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    return mesh;
  }

  _addPicatinnyTeeth(group, yTop, zStart, zEnd, step, mat) {
    for (let z = zStart; z >= zEnd; z -= step) {
      group.add(this._box(0.022, 0.004, step * 0.48, mat, 0, yTop, z));
    }
  }

  _buildMuzzleFlashPlanes() {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffc663,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffeec2,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const pGeo = new THREE.PlaneGeometry(0.095, 0.03);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(pGeo, mat);
      m.rotation.z = (i * Math.PI) / 3;
      this.muzzleFlashGroup.add(m);
    }
    const cGeo = new THREE.SphereGeometry(0.015, 8, 8);
    const core = new THREE.Mesh(cGeo, coreMat);
    this.muzzleFlashGroup.add(core);
    this.muzzleFlashGroup.visible = false;
  }

  _buildKnifeModel() {
    const g = new THREE.Group();
    const handleMat = new THREE.MeshStandardMaterial({
      map: this.tex.polyMap,
      bumpMap: this.tex.polyBump,
      bumpScale: 0.005,
      roughness: 0.8,
      metalness: 0.15
    });
    const bladeMat = new THREE.MeshStandardMaterial({
      map: this.tex.steelMap,
      bumpMap: this.tex.steelBump,
      bumpScale: 0.002,
      envMap: this.tex.envMap,
      envMapIntensity: 1.3,
      roughness: 0.22,
      metalness: 0.92
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      envMap: this.tex.envMap,
      envMapIntensity: 1.4,
      roughness: 0.14,
      metalness: 0.96
    });

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.032, 0.12), handleMat);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.046, 0.012), handleMat);
    guard.position.set(0, 0, -0.062);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.032, 0.17), bladeMat);
    blade.position.set(0, 0.002, -0.15);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.048, 4), edgeMat);
    tip.rotation.x = -Math.PI / 2;
    tip.scale.set(0.35, 1, 1);
    tip.position.set(0, 0.002, -0.255);

    g.add(handle, guard, blade, tip);
    g.position.set(0.24, -0.22, -0.35);
    return g;
  }

  _addArms(group, isPistol = false) {
    const sleeveMat = this._pbr({
      map: this.tex.sleeveMap,
      bumpMap: this.tex.sleeveBump,
      bumpScale: 0.006,
      roughness: 0.88,
      metalness: 0.05,
      env: 0.25
    });
    const gloveMat = this._pbr({
      map: this.tex.polyMap,
      bumpMap: this.tex.polyBump,
      bumpScale: 0.006,
      color: 0xb0b8c4,
      roughness: 0.72,
      metalness: 0.12,
      env: 0.35
    });
    const knuckleMat = this._pbr({
      map: this.tex.metalMap,
      roughness: 0.45,
      metalness: 0.45,
      env: 0.6
    });

    // Right forearm & trigger glove (tucked safely ahead of near plane during ADS)
    const rArm = this._box(0.062, 0.062, 0.19, sleeveMat, 0.074, -0.125, 0.125, -0.22, -0.3, 0);
    const rGlove = this._box(0.048, 0.056, 0.075, gloveMat, 0.0, -0.055, 0.08, 0.22, 0, 0);
    group.add(rArm, rGlove);

    // Articulated left arm group
    const leftGroup = new THREE.Group();
    if (!isPistol) {
      const lArm = this._box(0.062, 0.062, 0.3, sleeveMat, -0.13, -0.115, -0.015, -0.18, 0.54, 0);
      const lGlove = this._box(0.052, 0.048, 0.08, gloveMat, -0.005, -0.035, -0.17, 0, 0.1, 0);
      const lGuard = this._box(0.048, 0.012, 0.032, knuckleMat, -0.006, -0.012, -0.17, 0, 0.1, 0);
      leftGroup.add(lArm, lGlove, lGuard);
    } else {
      const lArm = this._box(0.058, 0.058, 0.21, sleeveMat, -0.1, -0.13, 0.11, -0.22, 0.44, 0);
      const lGlove = this._box(0.048, 0.05, 0.07, gloveMat, -0.018, -0.062, 0.06, 0.15, 0.2, 0);
      leftGroup.add(lArm, lGlove);
    }
    group.add(leftGroup);
    this.leftArmGroup = leftGroup;
  }

  _addHoloOptic(group, yBase, zPos) {
    const opticMat = this._pbr({
      map: this.tex.metalMap,
      bumpMap: this.tex.metalBump,
      bumpScale: 0.004,
      color: 0x8b95a5,
      roughness: 0.35,
      metalness: 0.78,
      env: 1.15
    });
    const glassMat = this._track(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.14,
        depthWrite: false
      })
    );
    const dotMat = this._track(new THREE.MeshBasicMaterial({ color: 0xff2d2d }));

    const mount = this._box(0.04, 0.012, 0.068, opticMat, 0, yBase + 0.006, zPos);
    const leftWall = this._box(0.0045, 0.034, 0.054, opticMat, -0.02, yBase + 0.027, zPos);
    const rightWall = this._box(0.0045, 0.034, 0.054, opticMat, 0.02, yBase + 0.027, zPos);
    const topHood = this._box(0.044, 0.0045, 0.054, opticMat, 0, yBase + 0.044, zPos);
    const lens = this._box(0.035, 0.03, 0.002, glassMat, 0, yBase + 0.027, zPos - 0.01);
    const reticle = new THREE.Mesh(this._track(new THREE.SphereGeometry(0.0017, 8, 8)), dotMat);
    reticle.position.set(0, yBase + 0.027, zPos - 0.008);
    this.holoReticle = reticle;

    group.add(mount, leftWall, rightWall, topHood, lens, reticle);
    return yBase + 0.027;
  }

  _addIronSights(group, yBase, rearZ, frontZ, glowColor = 0x4ade80) {
    const metal = this._pbr({
      map: this.tex.metalMap,
      bumpMap: this.tex.metalBump,
      roughness: 0.36,
      metalness: 0.8,
      env: 1.1
    });
    const glow = this._pbr({
      color: glowColor,
      emissive: glowColor,
      emissiveIntensity: 1.85,
      roughness: 0.2,
      metalness: 0.1
    });

    group.add(this._box(0.007, 0.018, 0.014, metal, -0.01, yBase + 0.009, rearZ));
    group.add(this._box(0.007, 0.018, 0.014, metal, 0.01, yBase + 0.009, rearZ));
    group.add(this._box(0.003, 0.003, 0.004, glow, -0.01, yBase + 0.012, rearZ + 0.006));
    group.add(this._box(0.003, 0.003, 0.004, glow, 0.01, yBase + 0.012, rearZ + 0.006));

    group.add(this._box(0.004, 0.02, 0.01, metal, 0, yBase + 0.01, frontZ));
    group.add(this._box(0.0032, 0.0045, 0.004, glow, 0, yBase + 0.016, frontZ + 0.004));
    return yBase + 0.016;
  }

  buildWeapon(weaponId) {
    if (this.currentGroup) {
      this.gunContainer.remove(this.currentGroup);
      this.currentGroup = null;
    }
    for (const d of this.disposables) {
      if (d && typeof d.dispose === "function") d.dispose();
    }
    this.disposables.length = 0;
    this.magGroup = null;
    this.boltGroup = null;
    this.coverGroup = null;
    this.leftArmGroup = null;
    this.holoReticle = null;

    const g = new THREE.Group();

    const darkMetal = this._pbr({
      map: this.tex.metalMap,
      bumpMap: this.tex.metalBump,
      bumpScale: 0.004,
      roughness: 0.4,
      metalness: 0.72,
      env: 1.05
    });
    const gunMetal = this._pbr({
      map: this.tex.railMap,
      bumpMap: this.tex.railBump,
      bumpScale: 0.006,
      roughness: 0.36,
      metalness: 0.78,
      env: 1.15
    });
    const steel = this._pbr({
      map: this.tex.steelMap,
      bumpMap: this.tex.steelBump,
      bumpScale: 0.003,
      roughness: 0.24,
      metalness: 0.9,
      env: 1.35
    });
    const polymer = this._pbr({
      map: this.tex.polyMap,
      bumpMap: this.tex.polyBump,
      bumpScale: 0.006,
      roughness: 0.76,
      metalness: 0.14,
      env: 0.4
    });
    const tan = this._pbr({
      map: this.tex.fdeMap,
      bumpMap: this.tex.polyBump,
      bumpScale: 0.0035,
      roughness: 0.62,
      metalness: 0.22,
      env: 0.55
    });
    const wood = this._pbr({
      map: this.tex.woodMap,
      bumpMap: this.tex.woodBump,
      bumpScale: 0.006,
      roughness: 0.58,
      metalness: 0.08,
      env: 0.45
    });
    const olive = this._pbr({
      map: this.tex.oliveMap,
      bumpMap: this.tex.polyBump,
      bumpScale: 0.004,
      roughness: 0.64,
      metalness: 0.2,
      env: 0.5
    });
    const brass = this._pbr({
      color: 0xe3b34c,
      roughness: 0.22,
      metalness: 0.92,
      env: 1.35
    });

    let sightY = 0.068;
    let adsZ = -0.39;
    let muzzleZ = -0.58;
    let muzzleY = 0.025;

    switch (weaponId) {
      case "ak47": {
        g.add(this._box(0.044, 0.062, 0.28, darkMetal, 0, 0.01, 0.0));
        g.add(this._box(0.04, 0.045, 0.24, wood, 0, 0.008, -0.25));
        g.add(this._box(0.036, 0.055, 0.11, wood, 0, -0.014, 0.16, -0.1, 0, 0));
        g.add(this._box(0.03, 0.095, 0.036, polymer, 0, -0.055, 0.08, 0.32, 0, 0));

        const mag = new THREE.Group();
        mag.add(this._box(0.028, 0.11, 0.056, darkMetal, 0, -0.072, -0.06, -0.15, 0, 0));
        mag.add(this._box(0.028, 0.09, 0.052, darkMetal, 0, -0.145, -0.095, -0.42, 0, 0));
        g.add(mag);
        this.magGroup = mag;

        const bolt = new THREE.Group();
        bolt.add(this._box(0.024, 0.014, 0.06, steel, 0.026, 0.024, -0.02));
        bolt.add(this._box(0.02, 0.01, 0.014, steel, 0.04, 0.024, 0.004));
        g.add(bolt);
        this.boltGroup = bolt;

        g.add(this._cyl(0.011, 0.011, 0.32, 10, darkMetal, 0, 0.02, -0.45));
        g.add(this._cyl(0.009, 0.009, 0.22, 8, darkMetal, 0, 0.038, -0.26));
        g.add(this._cyl(0.014, 0.012, 0.04, 10, steel, 0, 0.02, -0.61));
        sightY = this._addIronSights(g, 0.041, 0.08, -0.54, 0xf59e0b);
        this._addArms(g, false);
        muzzleZ = -0.64;
        muzzleY = 0.02;
        adsZ = -0.39;
        break;
      }

      case "mp5": {
        g.add(this._box(0.042, 0.058, 0.26, polymer, 0, 0.01, 0.02));
        g.add(this._cyl(0.019, 0.019, 0.22, 12, darkMetal, 0, 0.034, -0.14));
        g.add(this._cyl(0.023, 0.023, 0.26, 14, gunMetal, 0, 0.024, -0.36));
        g.add(this._box(0.028, 0.09, 0.034, polymer, 0, -0.05, 0.08, 0.28, 0, 0));
        this._addPicatinnyTeeth(g, 0.046, 0.08, -0.08, 0.016, steel);

        const mag = new THREE.Group();
        mag.add(this._box(0.022, 0.14, 0.034, darkMetal, 0, -0.09, -0.06, -0.22, 0, 0));
        g.add(mag);
        this.magGroup = mag;

        const bolt = new THREE.Group();
        bolt.add(this._box(0.026, 0.012, 0.022, steel, -0.026, 0.038, -0.21));
        g.add(bolt);
        this.boltGroup = bolt;

        g.add(this._box(0.036, 0.04, 0.1, darkMetal, 0, 0.008, 0.16));
        sightY = this._addHoloOptic(g, 0.048, 0.01);
        this._addArms(g, false);
        muzzleZ = -0.51;
        muzzleY = 0.024;
        adsZ = -0.38;
        break;
      }

      case "spas12": {
        g.add(this._box(0.044, 0.064, 0.3, darkMetal, 0, 0.01, 0.02));
        g.add(this._cyl(0.014, 0.014, 0.48, 12, steel, 0, 0.03, -0.35));
        g.add(this._cyl(0.012, 0.012, 0.42, 10, darkMetal, 0, 0.002, -0.32));

        const pump = new THREE.Group();
        pump.add(this._box(0.046, 0.046, 0.2, polymer, 0, 0.0, -0.26));
        g.add(pump);
        this.boltGroup = pump;

        g.add(this._box(0.03, 0.095, 0.036, polymer, 0, -0.052, 0.1, 0.32, 0, 0));
        g.add(this._box(0.036, 0.012, 0.26, gunMetal, 0, 0.054, 0.06));
        sightY = this._addIronSights(g, 0.044, 0.09, -0.55, 0xf43f5e);
        this._addArms(g, false);
        muzzleZ = -0.61;
        muzzleY = 0.03;
        adsZ = -0.38;
        break;
      }

      case "m249": {
        g.add(this._box(0.062, 0.075, 0.36, darkMetal, 0, 0.015, 0.0));

        const cover = new THREE.Group();
        cover.position.set(0, 0.053, -0.11);
        cover.add(this._box(0.058, 0.018, 0.19, gunMetal, 0, 0.005, 0.09));
        sightY = this._addHoloOptic(cover, 0.014, 0.09);
        g.add(cover);
        this.coverGroup = cover;

        const mag = new THREE.Group();
        mag.add(this._box(0.095, 0.11, 0.12, olive, -0.035, -0.06, -0.05));
        for (let i = 0; i < 5; i++) {
          mag.add(this._cyl(0.004, 0.004, 0.03, 6, brass, -0.038 + i * 0.006, 0.015, -0.05, 0, 0, 1.35));
        }
        g.add(mag);
        this.magGroup = mag;

        const bolt = new THREE.Group();
        bolt.add(this._box(0.025, 0.014, 0.028, steel, 0.038, 0.022, 0.02));
        g.add(bolt);
        this.boltGroup = bolt;

        g.add(this._box(0.048, 0.052, 0.28, gunMetal, 0, 0.015, -0.3));
        g.add(this._cyl(0.013, 0.013, 0.36, 10, steel, 0, 0.022, -0.48));
        g.add(this._box(0.016, 0.016, 0.2, darkMetal, -0.026, -0.02, -0.38));
        g.add(this._box(0.016, 0.016, 0.2, darkMetal, 0.026, -0.02, -0.38));
        g.add(this._box(0.036, 0.06, 0.11, polymer, 0, 0.005, 0.17));
        g.add(this._box(0.03, 0.09, 0.038, polymer, 0, -0.055, 0.11, 0.28, 0, 0));
        this._addArms(g, false);
        sightY = 0.094;
        muzzleZ = -0.68;
        muzzleY = 0.022;
        adsZ = -0.4;
        break;
      }

      case "sniper": {
        g.add(this._box(0.048, 0.065, 0.36, tan, 0, 0.005, 0.0));
        g.add(this._box(0.042, 0.052, 0.11, darkMetal, 0, 0.005, 0.17));
        g.add(this._cyl(0.014, 0.012, 0.56, 12, steel, 0, 0.024, -0.44));
        g.add(this._box(0.034, 0.026, 0.065, darkMetal, 0, 0.024, -0.73));
        this._addPicatinnyTeeth(g, 0.04, 0.12, -0.15, 0.018, gunMetal);

        const mag = new THREE.Group();
        mag.add(this._box(0.03, 0.085, 0.065, darkMetal, 0, -0.06, -0.06));
        g.add(mag);
        this.magGroup = mag;

        g.add(this._box(0.03, 0.095, 0.036, polymer, 0, -0.055, 0.1, 0.3, 0, 0));

        const bolt = new THREE.Group();
        bolt.position.set(0.022, 0.022, 0.05);
        bolt.add(this._box(0.032, 0.012, 0.012, steel, 0.014, 0, 0));
        bolt.add(new THREE.Mesh(this._track(new THREE.SphereGeometry(0.009, 8, 8)), steel));
        bolt.children[1].position.set(0.03, 0, 0);
        g.add(bolt);
        this.boltGroup = bolt;

        g.add(this._box(0.032, 0.024, 0.025, darkMetal, 0, 0.048, -0.08));
        g.add(this._box(0.032, 0.024, 0.025, darkMetal, 0, 0.048, 0.05));
        g.add(this._cyl(0.018, 0.018, 0.26, 14, darkMetal, 0, 0.072, -0.02));
        g.add(this._cyl(0.024, 0.018, 0.08, 14, darkMetal, 0, 0.072, -0.17));
        g.add(this._cyl(0.022, 0.018, 0.07, 14, darkMetal, 0, 0.072, 0.12));
        sightY = 0.072;
        this._addArms(g, false);
        muzzleZ = -0.78;
        muzzleY = 0.024;
        adsZ = -0.36;
        break;
      }

      case "deagle": {
        g.add(this._box(0.032, 0.028, 0.24, polymer, 0, 0.008, -0.03));
        g.add(this._box(0.028, 0.095, 0.038, polymer, 0, -0.046, 0.05, 0.28, 0, 0));

        const slide = new THREE.Group();
        slide.add(this._box(0.034, 0.034, 0.245, steel, 0, 0.034, -0.032));
        sightY = this._addIronSights(slide, 0.051, 0.07, -0.14, 0x38bdf8);
        g.add(slide);
        this.boltGroup = slide;

        const mag = new THREE.Group();
        mag.add(this._box(0.022, 0.088, 0.03, darkMetal, 0, -0.05, 0.052, 0.28, 0, 0));
        g.add(mag);
        this.magGroup = mag;

        this._addArms(g, true);
        muzzleZ = -0.17;
        muzzleY = 0.032;
        adsZ = -0.39;
        break;
      }

      case "g18": {
        g.add(this._box(0.028, 0.024, 0.2, polymer, 0, 0.008, -0.02));
        g.add(this._box(0.026, 0.085, 0.034, polymer, 0, -0.044, 0.045, 0.28, 0, 0));

        const slide = new THREE.Group();
        slide.add(this._box(0.028, 0.028, 0.2, darkMetal, 0, 0.03, -0.02));
        sightY = this._addIronSights(slide, 0.044, 0.06, -0.11, 0x4ade80);
        g.add(slide);
        this.boltGroup = slide;

        const mag = new THREE.Group();
        mag.add(this._box(0.02, 0.125, 0.028, darkMetal, 0, -0.068, 0.048, 0.28, 0, 0));
        g.add(mag);
        this.magGroup = mag;

        g.add(this._cyl(0.01, 0.01, 0.055, 8, gunMetal, 0, -0.008, -0.08));
        this._addArms(g, true);
        muzzleZ = -0.14;
        muzzleY = 0.028;
        adsZ = -0.38;
        break;
      }

      case "m4a1":
      default: {
        g.add(this._box(0.044, 0.062, 0.26, darkMetal, 0, 0.012, 0.02));
        g.add(this._box(0.048, 0.048, 0.24, gunMetal, 0, 0.018, -0.22));
        g.add(this._box(0.052, 0.022, 0.18, tan, 0, 0.016, -0.22));
        this._addPicatinnyTeeth(g, 0.045, 0.12, -0.33, 0.018, darkMetal);
        g.add(this._cyl(0.012, 0.012, 0.075, 8, tan, 0, -0.036, -0.24, 0, 0, 0));
        g.add(this._box(0.028, 0.095, 0.036, polymer, 0, -0.05, 0.09, 0.28, 0, 0));

        const mag = new THREE.Group();
        mag.add(this._box(0.026, 0.125, 0.054, tan, 0, -0.078, -0.04, -0.14, 0, 0));
        g.add(mag);
        this.magGroup = mag;

        const bolt = new THREE.Group();
        bolt.add(this._box(0.036, 0.01, 0.025, steel, 0, 0.041, 0.125));
        g.add(bolt);
        this.boltGroup = bolt;

        g.add(this._cyl(0.015, 0.015, 0.11, 10, gunMetal, 0, 0.018, 0.155));
        g.add(this._box(0.042, 0.075, 0.1, tan, 0, -0.004, 0.17));
        g.add(this._cyl(0.011, 0.011, 0.24, 10, darkMetal, 0, 0.02, -0.42));
        g.add(this._cyl(0.014, 0.012, 0.05, 10, steel, 0, 0.02, -0.55));

        sightY = this._addHoloOptic(g, 0.044, 0.02);
        this._addArms(g, false);
        muzzleZ = -0.59;
        muzzleY = 0.02;
        adsZ = -0.39;
        break;
      }
    }

    this.muzzleLocalPos.set(0, muzzleY, muzzleZ);
    this.muzzleFlashGroup.position.copy(this.muzzleLocalPos);
    g.add(this.muzzleFlashGroup);

    this.adsPos.set(0, -sightY, adsZ);
    this.hipPos.set(weaponId === "deagle" || weaponId === "g18" ? 0.2 : 0.23, -0.22, -0.44);

    this.currentGroup = g;
    this.gunContainer.add(g);
  }

  resetReloadParts() {
    if (this.leftArmGroup) {
      this.leftArmGroup.position.set(0, 0, 0);
      this.leftArmGroup.rotation.set(0, 0, 0);
    }
    if (this.magGroup) {
      this.magGroup.visible = true;
      this.magGroup.position.set(0, 0, 0);
      this.magGroup.rotation.set(0, 0, 0);
    }
    if (this.boltGroup) {
      this.boltGroup.position.set(0, 0, 0);
      this.boltGroup.rotation.set(0, 0, 0);
    }
    if (this.coverGroup) {
      this.coverGroup.rotation.set(0, 0, 0);
    }
  }

  applyReloadPose(p, weaponId) {
    this.resetReloadParts();
    const isPistol = weaponId === "deagle" || weaponId === "g18";
    const isShotgun = weaponId === "spas12";

    let env = 1;
    if (p < 0.16) env = smooth(seg(p, 0, 0.16));
    else if (p > 0.88) env = 1 - smooth(seg(p, 0.88, 1.0));

    const posOff = {
      x: (isPistol ? -0.035 : -0.06) * env,
      y: (isPistol ? 0.025 : 0.015) * env,
      z: 0.02 * env
    };
    const rotOff = {
      x: (isPistol ? 0.24 : 0.16) * env,
      y: (isPistol ? 0.22 : 0.34) * env,
      z: (isPistol ? 0.56 : 0.42) * env
    };

    if (isShotgun) {
      if (this.leftArmGroup) {
        if (p < 0.7) {
          const cycle1 = Math.sin(seg(p, 0.14, 0.4) * Math.PI);
          const cycle2 = Math.sin(seg(p, 0.42, 0.68) * Math.PI);
          const feed = Math.max(cycle1, cycle2);
          this.leftArmGroup.position.set(0.02 * feed, -0.14 * feed, 0.14 * feed);
          this.leftArmGroup.rotation.x = -0.22 * feed;
          posOff.y += 0.015 * Math.pow(feed, 4);
        } else {
          const pumpPull = Math.sin(seg(p, 0.72, 0.88) * Math.PI);
          this.leftArmGroup.position.z = 0.075 * pumpPull;
          if (this.boltGroup) this.boltGroup.position.z = 0.075 * pumpPull;
          posOff.z += 0.018 * pumpPull;
        }
      }
      return { posOff, rotOff };
    }

    if (this.coverGroup) {
      let coverOpen = 0;
      if (p >= 0.14 && p < 0.26) coverOpen = smooth(seg(p, 0.14, 0.26));
      else if (p >= 0.26 && p < 0.72) coverOpen = 1;
      else if (p >= 0.72 && p < 0.8) coverOpen = 1 - smooth(seg(p, 0.72, 0.8));
      this.coverGroup.rotation.x = coverOpen * 0.78;
      if (p >= 0.77 && p <= 0.83) {
        const slam = Math.sin(seg(p, 0.77, 0.83) * Math.PI);
        posOff.y -= 0.022 * slam;
        rotOff.x -= 0.07 * slam;
      }
    }

    const magTargets = {
      m4a1: [0.005, -0.09, 0.115],
      ak47: [0.005, -0.095, 0.08],
      mp5: [0.005, -0.085, 0.1],
      m249: [-0.03, -0.055, 0.12],
      sniper: [0.005, -0.05, 0.11],
      deagle: [0.018, -0.032, 0.0],
      g18: [0.018, -0.038, 0.0]
    };
    const boltTargets = {
      m4a1: [0.005, 0.075, 0.29],
      ak47: [0.04, 0.058, 0.175],
      mp5: [-0.022, 0.072, -0.04],
      m249: [0.04, 0.056, 0.19],
      sniper: [0.04, 0.056, 0.22],
      deagle: [0.018, 0.095, -0.09],
      g18: [0.018, 0.09, -0.07]
    };
    const mt = magTargets[weaponId] || magTargets.m4a1;
    const bt = boltTargets[weaponId] || boltTargets.m4a1;

    if (this.magGroup) {
      if (p >= 0.2 && p < 0.42) {
        const t = smooth(seg(p, 0.2, 0.42));
        this.magGroup.position.set(-0.015 * t, -0.26 * t, 0.025 * t);
        this.magGroup.rotation.x = 0.24 * t;
      } else if (p >= 0.42 && p < 0.48) {
        this.magGroup.visible = false;
      } else if (p >= 0.48 && p < 0.69) {
        const t = smooth(seg(p, 0.48, 0.69));
        this.magGroup.visible = true;
        this.magGroup.position.set(-0.025 * (1 - t), -0.26 * (1 - t), 0.02 * (1 - t));
        this.magGroup.rotation.z = -0.12 * (1 - t);
      }
    }

    if (p >= 0.67 && p <= 0.76) {
      const slam = Math.sin(seg(p, 0.67, 0.76) * Math.PI);
      posOff.y += 0.028 * slam;
      rotOff.x += 0.095 * slam;
      rotOff.z -= 0.09 * slam;
    }

    const boltPull =
      p >= 0.77 && p <= 0.9
        ? p < 0.85
          ? smooth(seg(p, 0.77, 0.85))
          : 1 - smooth(seg(p, 0.85, 0.9))
        : 0;
    const boltTravel = isPistol ? 0.042 : 0.055;

    if (this.boltGroup && boltPull > 0) {
      this.boltGroup.position.z = boltTravel * boltPull;
      if (weaponId === "sniper") {
        this.boltGroup.rotation.z = 0.65 * boltPull;
      }
      posOff.z += 0.016 * boltPull;
      rotOff.x -= 0.045 * boltPull;
    }

    if (this.leftArmGroup) {
      if (p < 0.2) {
        const t = smooth(seg(p, 0.04, 0.2));
        this.leftArmGroup.position.set(mt[0] * t, mt[1] * t, mt[2] * t);
      } else if (p < 0.45) {
        const t = smooth(seg(p, 0.2, 0.42));
        this.leftArmGroup.position.set(mt[0] - 0.015 * t, mt[1] - 0.26 * t, mt[2] + 0.025 * t);
      } else if (p < 0.69) {
        const t = smooth(seg(p, 0.48, 0.69));
        this.leftArmGroup.position.set(
          mt[0] - 0.025 * (1 - t),
          mt[1] - 0.26 * (1 - t),
          mt[2] + 0.02 * (1 - t)
        );
      } else if (p < 0.77) {
        const t = smooth(seg(p, 0.69, 0.77));
        this.leftArmGroup.position.set(
          mt[0] + (bt[0] - mt[0]) * t,
          mt[1] + (bt[1] - mt[1]) * t,
          mt[2] + (bt[2] - mt[2]) * t
        );
      } else if (p <= 0.9) {
        this.leftArmGroup.position.set(bt[0], bt[1], bt[2] + boltTravel * boltPull);
      } else {
        const back = 1 - smooth(seg(p, 0.9, 1.0));
        this.leftArmGroup.position.set(bt[0] * back, bt[1] * back, bt[2] * back);
      }
    }

    return { posOff, rotOff };
  }

  triggerMuzzleFlash(suppressed = false) {
    this.flashTimer = suppressed ? 0.014 : 0.022;
    this.muzzleFlashGroup.visible = true;
    this.muzzleFlashGroup.rotation.z = Math.random() * Math.PI * 2;
    const s = suppressed ? 0.32 : 0.65 + Math.random() * 0.25;
    this.muzzleFlashGroup.scale.set(s, s, s);
    this.muzzleLight.intensity = suppressed ? 0.3 : 1.35;
  }

  updateFlash(dt) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.muzzleFlashGroup.visible = false;
        this.muzzleLight.intensity = 0;
      }
    }
  }

  getWorldMuzzlePosition(targetVec) {
    this.muzzleFlashGroup.getWorldPosition(targetVec);
    return targetVec;
  }

  updateReticleScale(currentFov, baseFov) {
    if (!this.holoReticle) return;
    const refRad = THREE.MathUtils.degToRad((baseFov * 0.72) * 0.5);
    const curRad = THREE.MathUtils.degToRad(Math.max(10, currentFov) * 0.5);
    const s = Math.max(0.25, Math.min(1.15, Math.tan(curRad) / Math.max(0.05, Math.tan(refRad))));
    this.holoReticle.scale.setScalar(s);
  }

  setScopeHidden(hide) {
    this.gunContainer.visible = !hide;
  }

  dispose() {
    for (const d of this.disposables) {
      if (d && typeof d.dispose === "function") d.dispose();
    }
    this.disposables.length = 0;
  }
}
