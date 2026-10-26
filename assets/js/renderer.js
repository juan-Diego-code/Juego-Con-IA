// renderer.js - Renderizador WebGL nativo (sin librerías externas)

// ---------- Matemáticas de matrices 4x4 (column-major, como pide WebGL) ----------
const Mat4 = {
  identity() {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  },
  perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const m = new Float32Array(16);
    m[0] = f / aspect;
    m[5] = f;
    m[10] = (far + near) / (near - far);
    m[11] = -1;
    m[14] = (2 * far * near) / (near - far);
    return m;
  },
  lookAt(eye, target, up) {
    let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    const m = new Float32Array(16);
    m[0] = xx; m[1] = yx; m[2] = zx;
    m[4] = xy; m[5] = yy; m[6] = zy;
    m[8] = xz; m[9] = yz; m[10] = zz;
    m[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    m[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    m[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    m[15] = 1;
    return m;
  },
  multiply(a, b) { // a * b
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
    }
    return o;
  }
};

// ---------- Shaders (se ejecutan en la GPU) ----------
const VERTEX_SHADER = `
attribute vec3 aPos;
attribute vec2 aUV;
attribute float aShade;
uniform mat4 uMVP;
varying vec2 vUV;
varying float vShade;
void main() {
  vUV = aUV;
  vShade = aShade;
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D uAtlas;
varying vec2 vUV;
varying float vShade;
void main() {
  vec4 color = texture2D(uAtlas, vUV);
  gl_FragColor = vec4(color.rgb * vShade, 1.0);
}`;

// ---------- Atlas de texturas creado con Canvas (sin imágenes externas) ----------
const TILE = 16;
const ATLAS_TILES = 4; // 0 césped(arriba), 1 césped(lado), 2 tierra, 3 piedra

function rand(seed) { // generador pseudoaleatorio sencillo
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

function drawPixelTile(ctx, index, baseColor, variation, seed, topColor, topRows) {
  const r = rand(seed);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      let base = (topColor && y < topRows) ? topColor : baseColor;
      const v = (r() - 0.5) * variation;
      const c = base.map(ch => Math.max(0, Math.min(255, ch + v)));
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.fillRect(index * TILE + x, y, 1, 1);
    }
  }
}

function createAtlasCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = TILE * ATLAS_TILES;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d");
  const GREEN = [90, 160, 60], DIRT = [134, 96, 67], STONE = [125, 125, 125];
  drawPixelTile(ctx, 0, GREEN, 40, 11);
  drawPixelTile(ctx, 1, DIRT, 40, 22, GREEN, 4);
  drawPixelTile(ctx, 2, DIRT, 40, 33);
  drawPixelTile(ctx, 3, STONE, 50, 44);
  return canvas;
}

// ---------- Geometría del cubo: 6 caras, 4 vértices cada una ----------
// Cada cara: sombreado fijo (simula luz), tile del atlas y 4 esquinas CCW vistas desde fuera.
const CUBE_FACES = [
  { shade: 1.0, tile: 0, v: [[-.5, .5, .5], [.5, .5, .5], [.5, .5, -.5], [-.5, .5, -.5]] },   // arriba
  { shade: 0.5, tile: 2, v: [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5]] }, // abajo
  { shade: 0.8, tile: 1, v: [[-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]] },   // +Z
  { shade: 0.8, tile: 1, v: [[.5, -.5, -.5], [-.5, -.5, -.5], [-.5, .5, -.5], [.5, .5, -.5]] }, // -Z
  { shade: 0.65, tile: 1, v: [[.5, -.5, .5], [.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5]] },   // +X
  { shade: 0.65, tile: 1, v: [[-.5, -.5, -.5], [-.5, -.5, .5], [-.5, .5, .5], [-.5, .5, -.5]] } // -X
];
// Coordenadas UV de las 4 esquinas: abajo-izq, abajo-der, arriba-der, arriba-izq (v=0 es arriba de la imagen)
const CORNER_UV = [[0, 1], [1, 1], [1, 0], [0, 0]];

function buildCubeMesh() {
  const vertices = []; // por vértice: x,y,z,u,v,shade
  const indices = [];
  const eps = 0.001;
  CUBE_FACES.forEach((face, f) => {
    face.v.forEach((p, i) => {
      const u = (face.tile + Math.min(Math.max(CORNER_UV[i][0], eps), 1 - eps)) / ATLAS_TILES;
      const v = Math.min(Math.max(CORNER_UV[i][1], eps), 1 - eps);
      vertices.push(p[0], p[1], p[2], u, v, face.shade);
    });
    const b = f * 4;
    indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}

// ---------- Clase Renderer ----------
class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext("webgl");
    if (!gl) throw new Error("Tu navegador no soporta WebGL.");
    this.gl = gl;
    this.canvas = canvas;
    this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
    this.loc = {
      aPos: gl.getAttribLocation(this.program, "aPos"),
      aUV: gl.getAttribLocation(this.program, "aUV"),
      aShade: gl.getAttribLocation(this.program, "aShade"),
      uMVP: gl.getUniformLocation(this.program, "uMVP"),
      uAtlas: gl.getUniformLocation(this.program, "uAtlas")
    };
    this.atlas = this.createTexture(createAtlasCanvas());
    this.cube = this.createMesh(buildCubeMesh());

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE); // no dibuja las caras traseras
    gl.clearColor(0.53, 0.81, 0.92, 1); // color de cielo
  }

  compile(type, source) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  createProgram(vs, fs) {
    const gl = this.gl;
    const p = gl.createProgram();
    gl.attachShader(p, this.compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  createTexture(canvas) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    // NEAREST = sin suavizar, da el aspecto pixelado
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  createMesh(data) {
    const gl = this.gl;
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.STATIC_DRAW);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
    return { vbo, ibo, count: data.indices.length };
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(this.canvas.clientWidth * dpr);
    const h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }

  // Dibuja una malla con la matriz viewProj
  drawMesh(mesh, mvp) {
    const gl = this.gl, L = this.loc, stride = 6 * 4;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(L.uMVP, false, mvp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.uniform1i(L.uAtlas, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.enableVertexAttribArray(L.aPos);
    gl.vertexAttribPointer(L.aPos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(L.aUV);
    gl.vertexAttribPointer(L.aUV, 2, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(L.aShade);
    gl.vertexAttribPointer(L.aShade, 1, gl.FLOAT, false, stride, 20);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  render(view) {
    const gl = this.gl;
    this.resize();
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const aspect = this.canvas.width / this.canvas.height;
    const proj = Mat4.perspective(Math.PI / 3, aspect, 0.1, 100);
    this.drawMesh(this.cube, Mat4.multiply(proj, view));
  }
}