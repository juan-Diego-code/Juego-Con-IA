// world.js - Generación del terreno y mallas por chunks

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

class World {
  constructor(sizeInChunks, seed) {
    this.size = sizeInChunks; // el mundo mide size x size chunks
    this.seed = seed;
    this.chunks = new Map();
  }

  key(cx, cz) { return cx + "," + cz; }

  // ----- Generación del terreno -----
  getTerrainHeight(x, z) {
    const n = valueNoise(x / 40, z / 40, this.seed) * 14 +
              valueNoise(x / 14, z / 14, this.seed + 1) * 6 +
              valueNoise(x / 6, z / 6, this.seed + 2) * 2;
    return Math.floor(10 + n);
  }

  generateChunk(cx, cz) {
    const data = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const h = this.getTerrainHeight(cx * CHUNK_SIZE + lx, cz * CHUNK_SIZE + lz);
        const beach = h <= SEA_LEVEL + 1;
        for (let y = 0; y <= h && y < WORLD_HEIGHT; y++) {
          let id = Blocks.STONE;
          if (y === h) id = beach ? Blocks.SAND : Blocks.GRASS;
          else if (y >= h - 3) id = beach ? Blocks.SAND : Blocks.DIRT;
          data[(lx * WORLD_HEIGHT + y) * CHUNK_SIZE + lz] = id;
        }
      }
    }
    this.chunks.set(this.key(cx, cz), data);
  }

  generateAll() {
    for (let cx = 0; cx < this.size; cx++)
      for (let cz = 0; cz < this.size; cz++) this.generateChunk(cx, cz);
  }

  // ----- Acceso a bloques con coordenadas globales -----
  getBlock(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return Blocks.AIR;
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(this.key(cx, cz));
    if (!chunk) return Blocks.AIR;
    const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE;
    return chunk[(lx * WORLD_HEIGHT + y) * CHUNK_SIZE + lz];
  }

  // Para colisiones: fuera del mundo (horizontal) cuenta como muro
  isSolidAt(x, y, z) {
    const limit = this.size * CHUNK_SIZE;
    if (x < 0 || z < 0 || x >= limit || z >= limit || y < 0) return true;
    return Blocks.isSolid(this.getBlock(x, y, z));
  }

  // Altura del bloque sólido más alto en una columna
  getSurfaceY(x, z) {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--)
      if (Blocks.isSolid(this.getBlock(x, y, z))) return y;
    return 0;
  }

  // ----- Malla del chunk: solo caras visibles (vecino = aire) -----
  buildChunkMesh(cx, cz) {
    const out = [];
    const eps = 0.001, ox = cx * CHUNK_SIZE, oz = cz * CHUNK_SIZE;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const x = ox + lx, z = oz + lz;
          const id = this.getBlock(x, y, z);
          if (id === Blocks.AIR) continue;
          const info = Blocks.data[id];
          for (const f of FACE_DEFS) {
            if (Blocks.isSolid(this.getBlock(x + f.dir[0], y + f.dir[1], z + f.dir[2]))) continue;
            const tile = info[f.tex];
            const quad = f.v.map((p, i) => {
              const cu = Math.min(Math.max(CORNER_UV[i][0], eps), 1 - eps);
              const cv = Math.min(Math.max(CORNER_UV[i][1], eps), 1 - eps);
              return [x + p[0], y + p[1], z + p[2], (tile + cu) / ATLAS_TILES, cv, f.shade];
            });
            for (const i of [0, 1, 2, 0, 2, 3]) out.push(...quad[i]);
          }
        }
      }
    }
    return new Float32Array(out);
  }
}