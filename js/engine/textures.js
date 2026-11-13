// =========================================================
// BLACKLINE // OPS — Procedural PBR Texture & Sky Generator
// =========================================================
import * as THREE from "three";

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

export class TextureManager {
  constructor(maxAnisotropy = 4) {
    this.maxAnisotropy = Math.min(8, Math.max(1, maxAnisotropy));
    this.baseTextures = new Map();
    this.materials = new Map();
    this.disposables = [];
  }

  _makeCanvas(size, drawFn) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    drawFn(ctx, size);
    return canvas;
  }

  _createCanvasTexture(canvas, isSRGB = true) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = this.maxAnisotropy;
    if (isSRGB) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    tex.needsUpdate = true;
    this.disposables.push(tex);
    return tex;
  }

  _cloneWithRepeat(baseTex, rx, ry) {
    const t = baseTex.clone();
    t.repeat.set(rx, ry);
    t.needsUpdate = true;
    this.disposables.push(t);
    return t;
  }

  _getBaseSet(matKey) {
    if (this.baseTextures.has(matKey)) {
      return this.baseTextures.get(matKey);
    }

    let set;
    switch (matKey) {
      case "asphalt":
        set = this._buildAsphalt();
        break;
      case "concreteDesert":
        set = this._buildDesertConcrete();
        break;
      case "concreteWall":
        set = this._buildConcreteWall("#4c535d", "#333942", 101);
        break;
      case "bunkerWall":
        set = this._buildConcreteWall("#857b6c", "#5d5548", 202);
        break;
      case "containerBlue":
        set = this._buildContainer("#1d4e7a", "#143757", "#38bdf8", 301);
        break;
      case "containerRed":
        set = this._buildContainer("#872d2d", "#5c1b1b", "#f87171", 302);
        break;
      case "containerOlive":
        set = this._buildContainer("#415238", "#2b3824", "#a3b18a", 303);
        break;
      case "containerCharcoal":
        set = this._buildContainer("#2c333d", "#1c2129", "#94a3b8", 304);
        break;
      case "woodCrate":
        set = this._buildWoodCrate();
        break;
      case "metalDeck":
        set = this._buildMetalDeck();
        break;
      case "hazardMetal":
        set = this._buildHazardMetal();
        break;
      default:
        set = this._buildConcreteWall("#525866", "#353b45", 404);
    }

    this.baseTextures.set(matKey, set);
    return set;
  }

  _buildAsphalt() {
    const rand = mulberry32(11);
    const diffCanvas = this._makeCanvas(512, (ctx, s) => {
      ctx.fillStyle = "#242830";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 6500; i++) {
        const x = rand() * s;
        const y = rand() * s;
        const v = Math.floor(26 + rand() * 34);
        ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
        ctx.fillRect(x, y, 2, 2);
      }
      // Subtle weathered expansion grid seams
      ctx.strokeStyle = "rgba(10, 13, 18, 0.55)";
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, s - 3, s - 3);
      ctx.beginPath();
      ctx.moveTo(s / 2, 0);
      ctx.lineTo(s / 2, s);
      ctx.moveTo(0, s / 2);
      ctx.lineTo(s, s / 2);
      ctx.stroke();

      // Faded yellow tactical yard line
      ctx.fillStyle = "rgba(217, 165, 32, 0.22)";
      ctx.fillRect(0, s * 0.485, s, 8);
    });

    const bumpCanvas = this._makeCanvas(256, (ctx, s) => {
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 3500; i++) {
        const g = Math.floor(90 + rand() * 80);
        ctx.fillStyle = `rgb(${g},${g},${g})`;
        ctx.fillRect(rand() * s, rand() * s, 2, 2);
      }
    });

    return {
      map: this._createCanvasTexture(diffCanvas, true),
      bumpMap: this._createCanvasTexture(bumpCanvas, false),
      bumpScale: 0.04,
      roughness: 0.88,
      metalness: 0.06
    };
  }

  _buildDesertConcrete() {
    const rand = mulberry32(22);
    const diffCanvas = this._makeCanvas(512, (ctx, s) => {
      ctx.fillStyle = "#7a6f5e";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 5500; i++) {
        const r = Math.floor(105 + rand() * 38);
        const g = Math.floor(r * 0.91);
        const b = Math.floor(r * 0.77);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(rand() * s, rand() * s, 2.5, 2.5);
      }
      ctx.strokeStyle = "rgba(52, 44, 34, 0.45)";
      ctx.lineWidth = 3;
      for (let k = 0; k < 2; k++) {
        for (let m = 0; m < 2; m++) {
          ctx.strokeRect(k * (s / 2), m * (s / 2), s / 2, s / 2);
        }
      }
    });

    const bumpCanvas = this._makeCanvas(256, (ctx, s) => {
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 3000; i++) {
        const g = Math.floor(95 + rand() * 70);
        ctx.fillStyle = `rgb(${g},${g},${g})`;
        ctx.fillRect(rand() * s, rand() * s, 2, 2);
      }
    });

    return {
      map: this._createCanvasTexture(diffCanvas, true),
      bumpMap: this._createCanvasTexture(bumpCanvas, false),
      bumpScale: 0.045,
      roughness: 0.92,
      metalness: 0.03
    };
  }

  _buildConcreteWall(baseHex, seamHex, seed) {
    const rand = mulberry32(seed);
    const diffCanvas = this._makeCanvas(512, (ctx, s) => {
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, s, s);

      for (let i = 0; i < 3800; i++) {
        const alpha = 0.04 + rand() * 0.08;
        ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
        ctx.fillRect(rand() * s, rand() * s, 3, 3);
      }

      // Vertical weather streaks
      for (let i = 0; i < 24; i++) {
        const x = rand() * s;
        const w = 6 + rand() * 18;
        const grad = ctx.createLinearGradient(x, 0, x, s * 0.65);
        grad.addColorStop(0, "rgba(0,0,0,0.18)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, w, s * 0.65);
      }

      // Panel joints & tie-rod holes
      ctx.strokeStyle = seamHex;
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, s - 4, s - 4);
      ctx.beginPath();
      ctx.moveTo(0, s / 2);
      ctx.lineTo(s, s / 2);
      ctx.moveTo(s / 2, 0);
      ctx.lineTo(s / 2, s);
      ctx.stroke();

      ctx.fillStyle = "rgba(15, 20, 28, 0.55)";
      const dots = [42, s / 2 - 42, s / 2 + 42, s - 42];
      for (const dx of dots) {
        for (const dy of dots) {
          ctx.beginPath();
          ctx.arc(dx, dy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    const bumpCanvas = this._makeCanvas(256, (ctx, s) => {
      ctx.fillStyle = "#888888";
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = "#353535";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, s - 4, s - 4);
      ctx.beginPath();
      ctx.moveTo(0, s / 2);
      ctx.lineTo(s, s / 2);
      ctx.moveTo(s / 2, 0);
      ctx.lineTo(s / 2, s);
      ctx.stroke();
    });

    return {
      map: this._createCanvasTexture(diffCanvas, true),
      bumpMap: this._createCanvasTexture(bumpCanvas, false),
      bumpScale: 0.05,
      roughness: 0.86,
      metalness: 0.08
    };
  }

  _buildContainer(primaryHex, darkHex, stripeHex, seed) {
    const rand = mulberry32(seed);
    const diffCanvas = this._makeCanvas(512, (ctx, s) => {
      ctx.fillStyle = primaryHex;
      ctx.fillRect(0, 0, s, s);

      // Corrugated steel ribs
      const ribs = 16;
      const rw = s / ribs;
      for (let i = 0; i < ribs; i++) {
        const x = i * rw;
        ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
        ctx.fillRect(x, 0, rw * 0.34, s);
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fillRect(x + rw * 0.34, 0, rw * 0.18, s);
      }

      // Top/bottom steel frame rails
      ctx.fillStyle = darkHex;
      ctx.fillRect(0, 0, s, 26);
      ctx.fillRect(0, s - 26, s, 26);

      // Stencil cargo stripe & ID block
      ctx.fillStyle = stripeHex;
      ctx.globalAlpha = 0.72;
      ctx.fillRect(28, 52, 86, 12);
      ctx.fillRect(s - 114, s - 64, 86, 12);
      ctx.globalAlpha = 1;

      // Subtle rust & edge wear
      for (let i = 0; i < 420; i++) {
        ctx.fillStyle = rand() > 0.65 ? "rgba(120, 53, 15, 0.18)" : "rgba(255, 255, 255, 0.04)";
        ctx.fillRect(rand() * s, rand() * s, 4 + rand() * 8, 2);
      }
    });

    const bumpCanvas = this._makeCanvas(256, (ctx, s) => {
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, s, s);
      const ribs = 16;
      const rw = s / ribs;
      for (let i = 0; i < ribs; i++) {
        ctx.fillStyle = "#484848";
        ctx.fillRect(i * rw, 0, rw * 0.38, s);
        ctx.fillStyle = "#b8b8b8";
        ctx.fillRect(i * rw + rw * 0.38, 0, rw * 0.25, s);
      }
    });

    return {
      map: this._createCanvasTexture(diffCanvas, true),
      bumpMap: this._createCanvasTexture(bumpCanvas, false),
      bumpScale: 0.06,
      roughness: 0.56,
      metalness: 0.42
    };
  }

  _buildWoodCrate() {
    const rand = mulberry32(55);
    const diffCanvas = this._makeCanvas(512, (ctx, s) => {
      ctx.fillStyle = "#7c5c38";
      ctx.fillRect(0, 0, s, s);

      // Horizontal planks
      const planks = 6;
      const ph = s / planks;
      for (let i = 0; i < planks; i++) {
        ctx.fillStyle = i % 2 === 0 ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)";
        ctx.fillRect(0, i * ph, s, ph);
        ctx.fillStyle = "#3f2c17";
        ctx.fillRect(0, i * ph, s, 3);
      }

      // Wood grain streaks
      for (let i = 0; i < 380; i++) {
        ctx.fillStyle = "rgba(45, 28, 10, 0.14)";
        ctx.fillRect(rand() * s, rand() * s, 26 + rand() * 55, 2);
      }

      // Heavy outer frame & diagonal cross brace
      ctx.strokeStyle = "#563d21";
      ctx.lineWidth = 34;
      ctx.strokeRect(17, 17, s - 34, s - 34);
      ctx.beginPath();
      ctx.moveTo(28, 28);
      ctx.lineTo(s - 28, s - 28);
      ctx.stroke();

      // Metal corner brackets
      ctx.fillStyle = "#262b33";
      const b = 36;
      ctx.fillRect(0, 0, b, b);
      ctx.fillRect(s - b, 0, b, b);
      ctx.fillRect(0, s - b, b, b);
      ctx.fillRect(s - b, s - b, b, b);
    });

    const bumpCanvas = this._makeCanvas(256, (ctx, s) => {
      ctx.fillStyle = "#888888";
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = "#c8c8c8";
      ctx.lineWidth = 18;
      ctx.strokeRect(9, 9, s - 18, s - 18);
    });

    return {
      map: this._createCanvasTexture(diffCanvas, true),
      bumpMap: this._createCanvasTexture(bumpCanvas, false),
      bumpScale: 0.045,
      roughness: 0.85,
      metalness: 0.08
    };
  }

  _buildMetalDeck() {
    const diffCanvas = this._makeCanvas(256, (ctx, s) => {
      ctx.fillStyle = "#363e4a";
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
      ctx.lineWidth = 2;
      const step = 32;
      for (let y = 0; y < s; y += step) {
        for (let x = 0; x < s; x += step) {
          ctx.beginPath();
          ctx.moveTo(x + 6, y + 6);
          ctx.lineTo(x + 14, y + 14);
          ctx.moveTo(x + 22, y + 14);
          ctx.lineTo(x + 14, y + 22);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = "#1e242c";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, s - 4, s - 4);
    });

    const bumpCanvas = this._makeCanvas(256, (ctx, s) => {
      ctx.fillStyle = "#707070";
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = "#c8c8c8";
      const step = 32;
      for (let y = 0; y < s; y += step) {
        for (let x = 0; x < s; x += step) {
          ctx.fillRect(x + 8, y + 8, 6, 6);
          ctx.fillRect(x + 20, y + 20, 6, 6);
        }
      }
    });

    return {
      map: this._createCanvasTexture(diffCanvas, true),
      bumpMap: this._createCanvasTexture(bumpCanvas, false),
      bumpScale: 0.035,
      roughness: 0.42,
      metalness: 0.68
    };
  }

  _buildHazardMetal() {
    const diffCanvas = this._makeCanvas(256, (ctx, s) => {
      ctx.fillStyle = "#222730";
      ctx.fillRect(0, 0, s, s);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, s, s * 0.35);
      ctx.clip();
      ctx.fillStyle = "#eab308";
      ctx.fillRect(0, 0, s, s * 0.35);
      ctx.fillStyle = "#111827";
      for (let x = -s; x < s * 2; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 20, 0);
        ctx.lineTo(x - 20, s * 0.35);
        ctx.lineTo(x - 40, s * 0.35);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    });

    return {
      map: this._createCanvasTexture(diffCanvas, true),
      bumpMap: null,
      bumpScale: 0,
      roughness: 0.48,
      metalness: 0.52
    };
  }

  getGroundMaterial(matKey, halfW, halfD) {
    const rx = Math.max(4, Math.round((halfW * 2) / 5));
    const ry = Math.max(4, Math.round((halfD * 2) / 5));
    const cacheKey = `ground_${matKey}_${rx}_${ry}`;
    if (this.materials.has(cacheKey)) {
      return this.materials.get(cacheKey);
    }

    const base = this._getBaseSet(matKey);
    const map = this._cloneWithRepeat(base.map, rx, ry);
    const bumpMap = base.bumpMap ? this._cloneWithRepeat(base.bumpMap, rx, ry) : null;

    const mat = new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: base.bumpScale,
      roughness: base.roughness,
      metalness: base.metalness
    });
    this.materials.set(cacheKey, mat);
    this.disposables.push(mat);
    return mat;
  }

  getBoxMaterial(matKey, w, h, d) {
    const spanU = Math.max(w, d);
    const rx = Math.max(1, Math.round(spanU / 3.2));
    const ry = Math.max(1, Math.round(h / 2.8));
    const cacheKey = `${matKey}_${rx}_${ry}`;
    if (this.materials.has(cacheKey)) {
      return this.materials.get(cacheKey);
    }

    const base = this._getBaseSet(matKey);
    const map = rx === 1 && ry === 1 ? base.map : this._cloneWithRepeat(base.map, rx, ry);
    const bumpMap = base.bumpMap
      ? (rx === 1 && ry === 1 ? base.bumpMap : this._cloneWithRepeat(base.bumpMap, rx, ry))
      : null;

    const mat = new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: base.bumpScale,
      roughness: base.roughness,
      metalness: base.metalness
    });
    this.materials.set(cacheKey, mat);
    this.disposables.push(mat);
    return mat;
  }

  createSkyDome(topHex, horizonHex) {
    const geo = new THREE.SphereGeometry(240, 24, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(topHex) },
        horizonColor: { value: new THREE.Color(horizonHex) }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          float t = pow(clamp(h * 1.35 + 0.08, 0.0, 1.0), 0.72);
          vec3 col = mix(horizonColor, topColor, t);
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    this.disposables.push(geo, mat);
    return new THREE.Mesh(geo, mat);
  }

  dispose() {
    for (const item of this.disposables) {
      if (item && typeof item.dispose === "function") {
        item.dispose();
      }
    }
    this.baseTextures.clear();
    this.materials.clear();
    this.disposables.length = 0;
  }
}
