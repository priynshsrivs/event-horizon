import { finite } from "./constants.js";

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.set(x, y, z);
  }
  set(x, y, z) {
    this.x = finite(x);
    this.y = finite(y);
    this.z = finite(z);
    return this;
  }
  copy(v) {
    return this.set(v.x, v.y, v.z);
  }
  clone() {
    return new Vector3(this.x, this.y, this.z);
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  addScaledVector(v, s) {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }
  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  divideScalar(s) {
    return this.multiplyScalar(s ? 1 / s : 0);
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  cross(v) {
    const { x, y, z } = this;
    return this.set(y * v.z - z * v.y, z * v.x - x * v.z, x * v.y - y * v.x);
  }
  lengthSq() {
    return this.dot(this);
  }
  length() {
    return Math.sqrt(this.lengthSq());
  }
  normalize() {
    return this.divideScalar(this.length());
  }
  distanceToSquared(v) {
    return (this.x - v.x) ** 2 + (this.y - v.y) ** 2 + (this.z - v.z) ** 2;
  }
  distanceTo(v) {
    return Math.sqrt(this.distanceToSquared(v));
  }
  setLength(n) {
    return this.normalize().multiplyScalar(n);
  }
  negate() {
    return this.multiplyScalar(-1);
  }
  lerp(v, t) {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    this.z += (v.z - this.z) * t;
    return this;
  }
  toArray() {
    return [this.x, this.y, this.z];
  }
  fromArray(a) {
    return this.set(a[0], a[1], a[2]);
  }
  static from(v) {
    return Array.isArray(v)
      ? new Vector3().fromArray(v)
      : new Vector3(v?.x, v?.y, v?.z);
  }
}

export default Vector3;
