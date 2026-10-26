// world.js - Mundo infinito por chunks: terreno, árboles y mallas

const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 48;
const SEA_LEVEL = 18;

// ----- Ruido de valor (value noise) determinista -----
function hash2(x, z, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const fx = x - xi, fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz); // suavizado
  const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sz;
}

// Caras: vértices (0..1) en sentido antihorario visto desde fuera, vecino, sombreado y tipo de textura
const FACE_DEFS = [
  { dir: [0, 1, 0],  shade: 1.0,  tex: "top",    v: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
  { dir: [0, -1, 0], shade: 0.5,  tex: "bottom", v: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
  { dir: [0, 0, 1],  shade: 0.8,  tex: "side",   v: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },
  { dir: [0, 0, -1], shade: 0.8,  tex: "side",   v: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]] },
  { dir: [1, 0, 0],  shade: 0.65, tex: "side",   v: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]] },
  { dir: [-1, 0, 0], shade: 0.65, tex: "side",   v: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]] }
];

// UV de las esquinas con un pequeño margen para que no se cuelen píxeles del tile vecino
const UV_INSET = CORNER_UV.map(c => c.map(v => Math.min(Math.max(v, 0.001), 0.999)));
const QUAD_ORDER = [0, 1, 2, 0, 2, 3];

class World {
  constructor(seed) {
    this.seed = seed;
    this.chunks = new Map();      // clave numérica -> Uint8Array con los bloques del chunk
    this.modified = new Set();    // chunks que el jugador cambió (para guardar en la etapa 7)
    this._lastKey = null;         // caché del último chunk consultado (acelera getBlock)
    this._lastChunk = null;
  }

  key(cx, cz) { return cx * 65536 + cz; }

  // ----- Terreno -----
  getTerrainHeight(x, z) {
    const n = valueNoise(x / 40, z / 40, this.seed) * 14 +
              valueNoise(x / 14, z / 14, this.seed + 1) * 6 +
              valueNoise(x / 6, z / 6, this.seed + 2) * 2;
    return Math.floor(10 + n);
  }

  // ¿Hay un árbol con raíz en esta columna? Devuelve la altura del tronco (0 = no hay).
  // Depende solo de (x, z): así un árbol que cruza el borde de dos chunks queda completo.
  treeTrunkHeight(x, z) {
    if (hash2(x, z, this.seed + 7) > 0.01) return 0;
    if (this.getTerrainHeight(x, z) <= SEA_LEVEL + 1) return 0; // no en la playa
    return 4 + Math.floor(hash2(x, z, this.seed + 8) * 2);     // 4 o 5 bloques
  }

  generateChunk(cx, cz) {
    const data = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    const ox = cx * CHUNK_SIZE, oz = cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const h = this.getTerrainHeight(ox + lx, oz + lz);
        const beach = h <= SEA_LEVEL + 1;
        for (let y = 0; y <= h && y < WORLD_HEIGHT; y++) {
          let id = Blocks.STONE;
          if (y === h) id = beach ? Blocks.SAND : Blocks.GRASS;
          else if (y >= h - 3) id = beach ? Blocks.SAND : Blocks.DIRT;
          data[(lx * WORLD_HEIGHT + y) * CHUNK_SIZE + lz] = id;
        }
      }
    }

    // Escribe un bloque si cae dentro de este chunk (y solo sobre aire)
    const put = (x, y, z, id) => {
      const lx = x - ox, lz = z - oz;
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT) return;
      const i = (lx * WORLD_HEIGHT + y) * CHUNK_SIZE + lz;
      if (data[i] === Blocks.AIR) data[i] = id;
    };

    // Se revisan también 2 bloques fuera del chunk: las hojas de un árbol vecino pueden entrar aquí
    for (let pass = 0; pass < 2; pass++) {
      for (let x = ox - 2; x < ox + CHUNK_SIZE + 2; x++) {
        for (let z = oz - 2; z < oz + CHUNK_SIZE + 2; z++) {
          const t = this.treeTrunkHeight(x, z);
          if (!t) continue;
          const h = this.getTerrainHeight(x, z), top = h + t;
          if (pass === 0) { // 1.ª pasada: troncos
            for (let y = h + 1; y <= top; y++) put(x, y, z, Blocks.WOOD);
          } else {          // 2.ª pasada: copa de hojas (4 capas)
            for (let dy = -2; dy <= 1; dy++) {
              const r = dy <= -1 ? 2 : 1;
              for (let dx = -r; dx <= r; dx++) {
                for (let dz = -r; dz <= r; dz++) {
                  if (Math.abs(dx) === r && Math.abs(dz) === r && (r === 2 || dy === 1)) continue; // esquinas redondeadas
                  put(x + dx, top + dy, z + dz, Blocks.LEAVES);
                }
              }
            }
          }
        }
      }
    }
    return data;
  }

  // Devuelve el chunk; si todavía no existe, lo genera
  getChunk(cx, cz) {
    const k = this.key(cx, cz);
    if (k === this._lastKey) return this._lastChunk;
    let chunk = this.chunks.get(k);
    if (!chunk) {
      chunk = this.generateChunk(cx, cz);
      this.chunks.set(k, chunk);
    }
    this._lastKey = k;
    this._lastChunk = chunk;
    return chunk;
  }

  // ----- Acceso a bloques con coordenadas globales -----
  getBlock(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return Blocks.AIR;
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    return chunk[((x - cx * CHUNK_SIZE) * WORLD_HEIGHT + y) * CHUNK_SIZE + (z - cz * CHUNK_SIZE)];
  }

  // Cambia un bloque. Devuelve la lista de chunks [cx,cz] que hay que reconstruir (o null si no es válido)
  setBlock(x, y, z, id) {
    if (y < 0 || y >= WORLD_HEIGHT) return null;
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE;
    this.getChunk(cx, cz)[(lx * WORLD_HEIGHT + y) * CHUNK_SIZE + lz] = id;
    this.modified.add(this.key(cx, cz));
    const dirty = [[cx, cz]];
    // En el borde del chunk, el vecino también cambia sus caras visibles
    if (lx === 0) dirty.push([cx - 1, cz]);
    if (lx === CHUNK_SIZE - 1) dirty.push([cx + 1, cz]);
    if (lz === 0) dirty.push([cx, cz - 1]);
    if (lz === CHUNK_SIZE - 1) dirty.push([cx, cz + 1]);
    return dirty;
  }

  // Rayo que atraviesa la cuadrícula de bloques (algoritmo DDA de Amanatides y Woo).
  // Devuelve {x,y,z,normal:[nx,ny,nz]} del primer bloque sólido, o null.
  raycast(origin, dir, maxDist) {
    const cell = [Math.floor(origin[0]), Math.floor(origin[1]), Math.floor(origin[2])];
    const step = [], tDelta = [], tMax = [];
    for (let i = 0; i < 3; i++) {
      step[i] = dir[i] > 0 ? 1 : -1;
      tDelta[i] = dir[i] === 0 ? Infinity : Math.abs(1 / dir[i]);
      const next = dir[i] > 0 ? cell[i] + 1 - origin[i] : origin[i] - cell[i];
      tMax[i] = dir[i] === 0 ? Infinity : next * tDelta[i];
    }
    let normal = [0, 0, 0], t = 0;
    while (t <= maxDist) {
      if (Blocks.isSolid(this.getBlock(cell[0], cell[1], cell[2])))
        return { x: cell[0], y: cell[1], z: cell[2], normal };
      const axis = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : (tMax[1] < tMax[2] ? 1 : 2);
      t = tMax[axis];
      tMax[axis] += tDelta[axis];
      cell[axis] += step[axis];
      normal = [0, 0, 0];
      normal[axis] = -step[axis]; // cara por la que entró el rayo
    }
    return null;
  }

  // Para colisiones (el mundo es infinito en horizontal; solo el fondo es sólido)
  isSolidAt(x, y, z) {
    if (y < 0) return true;
    return Blocks.isSolid(this.getBlock(x, y, z));
  }

  // Altura del bloque sólido más alto en una columna
  getSurfaceY(x, z) {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--)
      if (Blocks.isSolid(this.getBlock(x, y, z))) return y;
    return 0;
  }

  // Busca un lugar de inicio en tierra firme, sin árboles encima
  findSpawn() {
    for (let k = 0; k < 200; k++) {
      const x = 8 + k * 3, z = 8;
      const h = this.getTerrainHeight(x, z);
      let free = h > SEA_LEVEL + 1;
      for (let dy = 1; dy <= 4 && free; dy++) // espacio libre para el cuerpo (1.8) y el salto
        if (this.getBlock(x, h + dy, z) !== Blocks.AIR) free = false;
      if (free) return [x + 0.5, h + 2, z + 0.5];
    }
    return [8.5, this.getSurfaceY(8, 8) + 2, 8.5];
  }

  // ----- Malla del chunk: solo caras visibles (vecino = aire) -----
  buildChunkMesh(cx, cz) {
    const out = [];
    const ox = cx * CHUNK_SIZE, oz = cz * CHUNK_SIZE;
    const data = this.getChunk(cx, cz);

    // Altura máxima con bloques: arriba de eso solo hay aire y no hace falta revisarlo
    let maxY = 0;
    for (let i = 0; i < data.length; i++)
      if (data[i] !== Blocks.AIR) { const y = Math.floor(i / CHUNK_SIZE) % WORLD_HEIGHT; if (y > maxY) maxY = y; }
    maxY = Math.min(maxY + 1, WORLD_HEIGHT - 1);

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let y = 0; y <= maxY; y++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const id = data[(lx * WORLD_HEIGHT + y) * CHUNK_SIZE + lz];
          if (id === Blocks.AIR) continue;
          const x = ox + lx, z = oz + lz, info = Blocks.data[id];
          for (const f of FACE_DEFS) {
            if (Blocks.isSolid(this.getBlock(x + f.dir[0], y + f.dir[1], z + f.dir[2]))) continue;
            const tile = info[f.tex];
            for (const i of QUAD_ORDER) { // 2 triángulos por cara
              const p = f.v[i], uv = UV_INSET[i];
              out.push(x + p[0], y + p[1], z + p[2], (tile + uv[0]) / ATLAS_TILES, uv[1], f.shade);
            }
          }
        }
      }
    }
    return new Float32Array(out);
  }
}