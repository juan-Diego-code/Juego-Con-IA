// player.js - Jugador en primera persona con gravedad, salto y colisiones (Etapa 3)
// "pos" son los PIES del jugador. La cámara está a EYE_HEIGHT sobre los pies.

const PLAYER_RADIUS = 0.3;   // mide 0.6 de ancho
const PLAYER_HEIGHT = 1.8;
const EYE_HEIGHT = 1.62;
const GRAVITY = 25;
const JUMP_SPEED = 8.5;      // salta ~1.4 bloques: suficiente para subir 1 bloque
const WALK_SPEED = 4.5;
const FLY_SPEED = 10;
const MAX_FALL_SPEED = 40;

class Player {
  constructor(canvas, world, x, y, z) {
    this.canvas = canvas;
    this.world = world;
    this.pos = [x, y, z];
    this.vy = 0;
    this.onGround = false;
    this.flying = false;
    this.yaw = 0;
    this.pitch = 0;
    this.keys = {};
    this.locked = false;
    this.sensitivity = 0.0025;

    document.addEventListener("keydown", e => {
      this.keys[e.code] = true;
      if (e.code === "KeyF" && this.locked) { this.flying = !this.flying; this.vy = 0; }
    });
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

  // ¿La caja del jugador en (x,y,z) toca algún bloque sólido?
  collides(x, y, z) {
    const x0 = Math.floor(x - PLAYER_RADIUS), x1 = Math.floor(x + PLAYER_RADIUS);
    const y0 = Math.floor(y),                 y1 = Math.floor(y + PLAYER_HEIGHT);
    const z0 = Math.floor(z - PLAYER_RADIUS), z1 = Math.floor(z + PLAYER_RADIUS);
    for (let bx = x0; bx <= x1; bx++)
      for (let by = y0; by <= y1; by++)
        for (let bz = z0; bz <= z1; bz++)
          if (this.world.isSolidAt(bx, by, bz)) return true;
    return false;
  }

  // Mueve un solo eje; si choca, pega al jugador contra el bloque
  moveAxis(axis, delta) {
    if (delta === 0) return;
    const p = this.pos;
    p[axis] += delta;
    if (!this.collides(p[0], p[1], p[2])) return;
    const eps = 0.001;
    if (axis === 1) {
      if (delta > 0) p[1] = Math.floor(p[1] + PLAYER_HEIGHT) - PLAYER_HEIGHT - eps;
      else { p[1] = Math.floor(p[1]) + 1 + eps; this.onGround = true; }
      this.vy = 0;
    } else if (delta > 0) {
      p[axis] = Math.floor(p[axis] + PLAYER_RADIUS) - PLAYER_RADIUS - eps;
    } else {
      p[axis] = Math.floor(p[axis] - PLAYER_RADIUS) + 1 + PLAYER_RADIUS + eps;
    }
  }

  // Mueve en pasos pequeños para no atravesar bloques a gran velocidad
  move(dx, dy, dz) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.2));
    for (let i = 0; i < steps; i++) {
      this.moveAxis(0, dx / steps);
      this.moveAxis(2, dz / steps);
      this.moveAxis(1, dy / steps);
    }
  }

  update(dt) {
    if (!this.locked) return;
    dt = Math.min(dt, 0.05);
    const k = this.keys;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw); // adelante
    const rx = Math.cos(this.yaw),  rz = -Math.sin(this.yaw); // derecha
    let mx = 0, mz = 0;
    if (k.KeyW) { mx += fx; mz += fz; }
    if (k.KeyS) { mx -= fx; mz -= fz; }
    if (k.KeyD) { mx += rx; mz += rz; }
    if (k.KeyA) { mx -= rx; mz -= rz; }
    const len = Math.hypot(mx, mz) || 1;
    const speed = this.flying ? FLY_SPEED : WALK_SPEED;
    mx = (mx / len) * speed;
    mz = (mz / len) * speed;

    this.onGround = false;
    if (this.flying) {
      let my = 0;
      if (k.Space) my += FLY_SPEED;
      if (k.ShiftLeft) my -= FLY_SPEED;
      this.move(mx * dt, my * dt, mz * dt);
    } else {
      if (k.Space && this.wasOnGround) this.vy = JUMP_SPEED;
      this.vy = Math.max(this.vy - GRAVITY * dt, -MAX_FALL_SPEED);
      this.move(mx * dt, this.vy * dt, mz * dt);
    }
    this.wasOnGround = this.onGround;
  }

  get lookDir() {
    const cp = Math.cos(this.pitch);
    return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
  }

  // ¿El bloque (bx,by,bz) se solaparía con el cuerpo del jugador?
  intersectsBlock(bx, by, bz) {
    const p = this.pos;
    return p[0] + PLAYER_RADIUS > bx && p[0] - PLAYER_RADIUS < bx + 1 &&
           p[1] + PLAYER_HEIGHT > by && p[1] < by + 1 &&
           p[2] + PLAYER_RADIUS > bz && p[2] - PLAYER_RADIUS < bz + 1;
  }

  get eye() { return [this.pos[0], this.pos[1] + EYE_HEIGHT, this.pos[2]]; }

  getViewMatrix() {
    const eye = this.eye, dir = this.lookDir;
    return Mat4.lookAt(eye, [eye[0] + dir[0], eye[1] + dir[1], eye[2] + dir[2]], [0, 1, 0]);
  }
}