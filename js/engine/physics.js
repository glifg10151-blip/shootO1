// =========================================================
// BLACKLINE // OPS — 3D Collision, Ramps & Ballistics Engine
// =========================================================
import * as THREE from "three";

export class PhysicsWorld {
  constructor(mapData) {
    this.halfW = mapData.halfW;
    this.halfD = mapData.halfD;

    this.solids = (mapData.solids || []).map((s) => ({
      minX: s.x - s.w * 0.5,
      maxX: s.x + s.w * 0.5,
      minY: s.yBase,
      maxY: s.yBase + s.h,
      minZ: s.z - s.d * 0.5,
      maxZ: s.z + s.d * 0.5,
      cx: s.x,
      cz: s.z,
      w: s.w,
      h: s.h,
      d: s.d,
      mat: s.mat
    }));

    this.ramps = (mapData.ramps || []).map((r) => {
      const minX = r.x - r.w * 0.5;
      const maxX = r.x + r.w * 0.5;
      const minZ = r.z - r.d * 0.5;
      const maxZ = r.z + r.d * 0.5;
      // Compute plane normal for sloped ramp surface
      const p0 = new THREE.Vector3();
      const p1 = new THREE.Vector3();
      const p2 = new THREE.Vector3();
      if (r.axis === "x") {
        const yMinX = r.dir === 1 ? r.yStart : r.yEnd;
        const yMaxX = r.dir === 1 ? r.yEnd : r.yStart;
        p0.set(minX, yMinX, minZ);
        p1.set(maxX, yMaxX, minZ);
        p2.set(minX, yMinX, maxZ);
      } else {
        const yMinZ = r.dir === 1 ? r.yStart : r.yEnd;
        const yMaxZ = r.dir === 1 ? r.yEnd : r.yStart;
        p0.set(minX, yMinZ, minZ);
        p1.set(maxX, yMinZ, minZ);
        p2.set(minX, yMaxZ, maxZ);
      }
      const e1 = new THREE.Vector3().subVectors(p1, p0);
      const e2 = new THREE.Vector3().subVectors(p2, p0);
      const normal = new THREE.Vector3().crossVectors(e2, e1).normalize();
      if (normal.y < 0) normal.negate();

      return {
        minX,
        maxX,
        minZ,
        maxZ,
        yStart: r.yStart,
        yEnd: r.yEnd,
        axis: r.axis,
        dir: r.dir,
        mat: r.mat,
        planePoint: p0,
        normal
      };
    });
  }

  getRampHeightAt(ramp, x, z, margin = 0) {
    if (
      x < ramp.minX - margin ||
      x > ramp.maxX + margin ||
      z < ramp.minZ - margin ||
      z > ramp.maxZ + margin
    ) {
      return null;
    }
    let t = 0;
    if (ramp.axis === "x") {
      t = (x - ramp.minX) / Math.max(0.001, ramp.maxX - ramp.minX);
    } else {
      t = (z - ramp.minZ) / Math.max(0.001, ramp.maxZ - ramp.minZ);
    }
    t = Math.max(0, Math.min(1, t));
    if (ramp.dir !== 1) t = 1 - t;
    return ramp.yStart + t * (ramp.yEnd - ramp.yStart);
  }

  _hasVerticalOverlap(py, height, box) {
    return py + height > box.minY + 0.02 && py < box.maxY - 0.02;
  }

  _canStepOnto(pos, radius, height, box) {
    const stepNeeded = box.maxY - pos.y;
    if (stepNeeded <= 0 || stepNeeded > 0.46) return false;
    // Verify headroom above box.maxY
    for (let i = 0; i < this.solids.length; i++) {
      const other = this.solids[i];
      if (other === box) continue;
      if (
        pos.x + radius > other.minX &&
        pos.x - radius < other.maxX &&
        pos.z + radius > other.minZ &&
        pos.z - radius < other.maxZ
      ) {
        if (other.minY >= box.maxY && other.minY < box.maxY + height) {
          return false;
        }
      }
    }
    return true;
  }

  moveCharacter(pos, vel, radius, height, dt, wasOnGround = false) {
    const stepHeightAllow = 0.45;

    // 1. Horizontal X
    pos.x += vel.x * dt;
    for (let i = 0; i < this.solids.length; i++) {
      const b = this.solids[i];
      if (
        pos.x + radius > b.minX &&
        pos.x - radius < b.maxX &&
        pos.z + radius > b.minZ &&
        pos.z - radius < b.maxZ &&
        this._hasVerticalOverlap(pos.y, height, b)
      ) {
        if (this._canStepOnto(pos, radius, height, b)) {
          pos.y = b.maxY;
        } else {
          if (vel.x > 0) pos.x = b.minX - radius - 0.0005;
          else if (vel.x < 0) pos.x = b.maxX + radius + 0.0005;
          vel.x = 0;
        }
      }
    }

    // 2. Horizontal Z
    pos.z += vel.z * dt;
    for (let i = 0; i < this.solids.length; i++) {
      const b = this.solids[i];
      if (
        pos.x + radius > b.minX &&
        pos.x - radius < b.maxX &&
        pos.z + radius > b.minZ &&
        pos.z - radius < b.maxZ &&
        this._hasVerticalOverlap(pos.y, height, b)
      ) {
        if (this._canStepOnto(pos, radius, height, b)) {
          pos.y = b.maxY;
        } else {
          if (vel.z > 0) pos.z = b.minZ - radius - 0.0005;
          else if (vel.z < 0) pos.z = b.maxZ + radius + 0.0005;
          vel.z = 0;
        }
      }
    }

    // Clamp to map arena limits
    const maxX = this.halfW - radius;
    const maxZ = this.halfD - radius;
    if (pos.x < -maxX) { pos.x = -maxX; vel.x = Math.max(0, vel.x); }
    if (pos.x > maxX) { pos.x = maxX; vel.x = Math.min(0, vel.x); }
    if (pos.z < -maxZ) { pos.z = -maxZ; vel.z = Math.max(0, vel.z); }
    if (pos.z > maxZ) { pos.z = maxZ; vel.z = Math.min(0, vel.z); }

    // 3. Support floor & ceiling detection
    let floorY = 0;
    let ceilingY = Infinity;
    const footR = radius * 0.85;

    for (let i = 0; i < this.solids.length; i++) {
      const b = this.solids[i];
      if (
        pos.x + footR > b.minX &&
        pos.x - footR < b.maxX &&
        pos.z + footR > b.minZ &&
        pos.z - footR < b.maxZ
      ) {
        if (b.maxY <= pos.y + stepHeightAllow) {
          if (b.maxY > floorY) floorY = b.maxY;
        }
        if (b.minY >= pos.y + height - 0.15) {
          if (b.minY < ceilingY) ceilingY = b.minY;
        }
      }
    }

    for (let i = 0; i < this.ramps.length; i++) {
      const ry = this.getRampHeightAt(this.ramps[i], pos.x, pos.z, radius * 0.35);
      if (ry !== null && ry <= pos.y + 0.55) {
        if (ry > floorY) floorY = ry;
      }
    }

    // 4. Vertical integration
    const nextY = pos.y + vel.y * dt;
    let onGround = false;

    if (nextY <= floorY && vel.y <= 0.1) {
      pos.y = floorY;
      vel.y = 0;
      onGround = true;
    } else if (wasOnGround && vel.y <= 0 && pos.y - floorY <= 0.35) {
      // Stick smoothly when descending stairs/ramps
      pos.y = floorY;
      vel.y = 0;
      onGround = true;
    } else if (nextY + height > ceilingY) {
      pos.y = ceilingY - height;
      vel.y = Math.min(0, vel.y);
    } else {
      pos.y = nextY;
    }

    return onGround;
  }

  getSurfaceHeightAt(x, z, currentY = 10) {
    let h = 0;
    for (let i = 0; i < this.solids.length; i++) {
      const b = this.solids[i];
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && b.maxY <= currentY + 0.5) {
        if (b.maxY > h) h = b.maxY;
      }
    }
    for (let i = 0; i < this.ramps.length; i++) {
      const ry = this.getRampHeightAt(this.ramps[i], x, z, 0);
      if (ry !== null && ry <= currentY + 0.6 && ry > h) h = ry;
    }
    return h;
  }

  raycastWorld(origin, dir, maxDist = 180) {
    let bestT = maxDist;
    let hitMat = null;
    const hitNormal = new THREE.Vector3(0, 1, 0);
    let hit = false;

    // Ground plane y = 0
    if (dir.y < -1e-5 && origin.y > 0) {
      const tGround = -origin.y / dir.y;
      if (tGround > 0.001 && tGround < bestT) {
        bestT = tGround;
        hitNormal.set(0, 1, 0);
        hitMat = "ground";
        hit = true;
      }
    }

    // Solids (slab method)
    const invX = Math.abs(dir.x) > 1e-7 ? 1 / dir.x : 1e9;
    const invY = Math.abs(dir.y) > 1e-7 ? 1 / dir.y : 1e9;
    const invZ = Math.abs(dir.z) > 1e-7 ? 1 / dir.z : 1e9;

    for (let i = 0; i < this.solids.length; i++) {
      const b = this.solids[i];
      const tx1 = (b.minX - origin.x) * invX;
      const tx2 = (b.maxX - origin.x) * invX;
      let tmin = Math.min(tx1, tx2);
      let tmax = Math.max(tx1, tx2);
      let nx = tx1 < tx2 ? -1 : 1;
      let ny = 0;
      let nz = 0;

      const ty1 = (b.minY - origin.y) * invY;
      const ty2 = (b.maxY - origin.y) * invY;
      const tyMin = Math.min(ty1, ty2);
      const tyMax = Math.max(ty1, ty2);
      if (tyMin > tmin) {
        tmin = tyMin;
        nx = 0;
        ny = ty1 < ty2 ? -1 : 1;
        nz = 0;
      }
      tmax = Math.min(tmax, tyMax);

      const tz1 = (b.minZ - origin.z) * invZ;
      const tz2 = (b.maxZ - origin.z) * invZ;
      const tzMin = Math.min(tz1, tz2);
      const tzMax = Math.max(tz1, tz2);
      if (tzMin > tmin) {
        tmin = tzMin;
        nx = 0;
        ny = 0;
        nz = tz1 < tz2 ? -1 : 1;
      }
      tmax = Math.min(tmax, tzMax);

      if (tmax >= Math.max(0.001, tmin) && tmin < bestT && tmin > 0.001) {
        bestT = tmin;
        hitNormal.set(nx, ny, nz);
        hitMat = b.mat;
        hit = true;
      }
    }

    // Ramps (sloped surface plane clipped to bounds)
    for (let i = 0; i < this.ramps.length; i++) {
      const r = this.ramps[i];
      const denom = r.normal.dot(dir);
      if (Math.abs(denom) < 1e-5) continue;
      const diffX = r.planePoint.x - origin.x;
      const diffY = r.planePoint.y - origin.y;
      const diffZ = r.planePoint.z - origin.z;
      const t = (r.normal.x * diffX + r.normal.y * diffY + r.normal.z * diffZ) / denom;
      if (t > 0.001 && t < bestT) {
        const hx = origin.x + dir.x * t;
        const hz = origin.z + dir.z * t;
        if (hx >= r.minX && hx <= r.maxX && hz >= r.minZ && hz <= r.maxZ) {
          bestT = t;
          hitNormal.copy(r.normal);
          if (denom > 0) hitNormal.negate();
          hitMat = r.mat;
          hit = true;
        }
      }
    }

    if (!hit) {
      return { hit: false, distance: maxDist, point: null, normal: null, mat: null };
    }

    return {
      hit: true,
      distance: bestT,
      point: new THREE.Vector3(
        origin.x + dir.x * bestT,
        origin.y + dir.y * bestT,
        origin.z + dir.z * bestT
      ),
      normal: hitNormal,
      mat: hitMat
    };
  }

  hasLineOfSight(fromVec, toVec) {
    const dx = toVec.x - fromVec.x;
    const dy = toVec.y - fromVec.y;
    const dz = toVec.z - fromVec.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.05) return true;
    const inv = 1 / dist;
    const res = this.raycastWorld(fromVec, { x: dx * inv, y: dy * inv, z: dz * inv }, dist - 0.15);
    return !res.hit;
  }

  _raySphere(origin, dir, cx, cy, cz, r, maxDist) {
    const ocX = origin.x - cx;
    const ocY = origin.y - cy;
    const ocZ = origin.z - cz;
    const b = ocX * dir.x + ocY * dir.y + ocZ * dir.z;
    const c = ocX * ocX + ocY * ocY + ocZ * ocZ - r * r;
    const disc = b * b - c;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    if (t > 0.001 && t < maxDist) return t;
    return null;
  }

  _rayAABB(origin, dir, minX, maxX, minY, maxY, minZ, maxZ, maxDist) {
    const invX = Math.abs(dir.x) > 1e-7 ? 1 / dir.x : 1e9;
    const invY = Math.abs(dir.y) > 1e-7 ? 1 / dir.y : 1e9;
    const invZ = Math.abs(dir.z) > 1e-7 ? 1 / dir.z : 1e9;

    const tx1 = (minX - origin.x) * invX;
    const tx2 = (maxX - origin.x) * invX;
    let tmin = Math.min(tx1, tx2);
    let tmax = Math.max(tx1, tx2);

    const ty1 = (minY - origin.y) * invY;
    const ty2 = (maxY - origin.y) * invY;
    tmin = Math.max(tmin, Math.min(ty1, ty2));
    tmax = Math.min(tmax, Math.max(ty1, ty2));

    const tz1 = (minZ - origin.z) * invZ;
    const tz2 = (maxZ - origin.z) * invZ;
    tmin = Math.max(tmin, Math.min(tz1, tz2));
    tmax = Math.min(tmax, Math.max(tz1, tz2));

    if (tmax >= Math.max(0.001, tmin) && tmin > 0.001 && tmin < maxDist) {
      return tmin;
    }
    return null;
  }

  raycastOperator(origin, dir, maxDist, opPos, isCrouching = false) {
    const headY = opPos.y + (isCrouching ? 1.04 : 1.56);
    const torsoTop = opPos.y + (isCrouching ? 0.94 : 1.38);
    const torsoBot = opPos.y + 0.64;

    let bestT = maxDist;
    let zone = null;

    // Head sphere
    const tHead = this._raySphere(origin, dir, opPos.x, headY, opPos.z, 0.22, bestT);
    if (tHead !== null && tHead < bestT) {
      bestT = tHead;
      zone = "head";
    }

    // Torso box
    const tTorso = this._rayAABB(
      origin,
      dir,
      opPos.x - 0.3,
      opPos.x + 0.3,
      torsoBot,
      torsoTop,
      opPos.z - 0.3,
      opPos.z + 0.3,
      bestT
    );
    if (tTorso !== null && tTorso < bestT) {
      bestT = tTorso;
      zone = "torso";
    }

    // Legs box
    const tLegs = this._rayAABB(
      origin,
      dir,
      opPos.x - 0.25,
      opPos.x + 0.25,
      opPos.y,
      torsoBot,
      opPos.z - 0.25,
      opPos.z + 0.25,
      bestT
    );
    if (tLegs !== null && tLegs < bestT) {
      bestT = tLegs;
      zone = "limb";
    }

    if (!zone) return null;
    return {
      distance: bestT,
      zone,
      point: new THREE.Vector3(
        origin.x + dir.x * bestT,
        origin.y + dir.y * bestT,
        origin.z + dir.z * bestT
      )
    };
  }

  stepProjectile(pos, vel, radius, dt, restitution = 0.48) {
    let bounced = false;
    let impactSpeed = 0;

    const prevX = pos.x;
    const prevY = pos.y;
    const prevZ = pos.z;

    pos.x += vel.x * dt;
    pos.y += vel.y * dt;
    pos.z += vel.z * dt;

    // Ground bounce
    if (pos.y < radius) {
      pos.y = radius;
      if (vel.y < -0.5) {
        impactSpeed = Math.abs(vel.y);
        vel.y = -vel.y * restitution;
        vel.x *= 0.78;
        vel.z *= 0.78;
        bounced = true;
      } else {
        vel.y = 0;
        vel.x *= 0.88;
        vel.z *= 0.88;
      }
    }

    // Arena boundary walls
    if (pos.x < -this.halfW + radius || pos.x > this.halfW - radius) {
      pos.x = Math.max(-this.halfW + radius, Math.min(this.halfW - radius, pos.x));
      impactSpeed = Math.abs(vel.x);
      vel.x = -vel.x * restitution;
      bounced = true;
    }
    if (pos.z < -this.halfD + radius || pos.z > this.halfD - radius) {
      pos.z = Math.max(-this.halfD + radius, Math.min(this.halfD - radius, pos.z));
      impactSpeed = Math.abs(vel.z);
      vel.z = -vel.z * restitution;
      bounced = true;
    }

    // Solid boxes
    for (let i = 0; i < this.solids.length; i++) {
      const b = this.solids[i];
      if (
        pos.x + radius > b.minX &&
        pos.x - radius < b.maxX &&
        pos.y + radius > b.minY &&
        pos.y - radius < b.maxY &&
        pos.z + radius > b.minZ &&
        pos.z - radius < b.maxZ
      ) {
        // Determine axis of entry using previous position
        if (prevY - radius >= b.maxY) {
          pos.y = b.maxY + radius;
          impactSpeed = Math.max(impactSpeed, Math.abs(vel.y));
          vel.y = -vel.y * restitution;
          vel.x *= 0.78;
          vel.z *= 0.78;
        } else if (prevY + radius <= b.minY) {
          pos.y = b.minY - radius;
          impactSpeed = Math.max(impactSpeed, Math.abs(vel.y));
          vel.y = -vel.y * restitution;
        } else if (prevX + radius <= b.minX || prevX - radius >= b.maxX) {
          pos.x = prevX < b.cx ? b.minX - radius : b.maxX + radius;
          impactSpeed = Math.max(impactSpeed, Math.abs(vel.x));
          vel.x = -vel.x * restitution;
        } else {
          pos.z = prevZ < b.cz ? b.minZ - radius : b.maxZ + radius;
          impactSpeed = Math.max(impactSpeed, Math.abs(vel.z));
          vel.z = -vel.z * restitution;
        }
        bounced = true;
      }
    }

    return { bounced, speed: impactSpeed };
  }
}
