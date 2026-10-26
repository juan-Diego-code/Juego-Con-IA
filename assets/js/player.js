// player.js - Cámara en primera persona (Etapa 2: vuelo libre para explorar)
// En la etapa 3 se reemplaza el vuelo por gravedad, salto y colisiones.

class Player {
  constructor(canvas, x, y, z) {
    this.canvas = canvas;
    this.pos = [x, y, z];
    this.yaw = 0;
    this.pitch = 0;
    this.keys = {};
    this.locked = false;
    this.speed = 8;
    this.sensitivity = 0.0025;

    document.addEventListener("keydown", e => { this.keys[e.code] = true; });
    document.addEventListener("keyup", e => { this.keys[e.code] = false; });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.keys = {};
    });
    document.addEventListener("mousemove", e => {
      if (!this.locked) return;
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      const lim = Math.PI / 2 - 0.01;
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    });
  }

  update(dt) {
    if (!this.locked) return;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw); // adelante
    const rx = Math.cos(this.yaw),  rz = -Math.sin(this.yaw); // derecha
    let mx = 0, my = 0, mz = 0;
    if (this.keys.KeyW) { mx += fx; mz += fz; }
    if (this.keys.KeyS) { mx -= fx; mz -= fz; }
    if (this.keys.KeyD) { mx += rx; mz += rz; }
    if (this.keys.KeyA) { mx -= rx; mz -= rz; }
    if (this.keys.Space) my += 1;
    if (this.keys.ShiftLeft) my -= 1;
    const len = Math.hypot(mx, my, mz) || 1;
    this.pos[0] += (mx / len) * this.speed * dt;
    this.pos[1] += (my / len) * this.speed * dt;
    this.pos[2] += (mz / len) * this.speed * dt;
  }

  getViewMatrix() {
    const cp = Math.cos(this.pitch);
    const dir = [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
    const target = [this.pos[0] + dir[0], this.pos[1] + dir[1], this.pos[2] + dir[2]];
    return Mat4.lookAt(this.pos, target, [0, 1, 0]);
  }
}