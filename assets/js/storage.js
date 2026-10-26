// storage.js - Guardado del mundo y de la configuración con LocalStorage
// (el nombre "Storage" ya existe en el navegador, por eso la clase se llama GameStorage)
//
// Solo se guardan los chunks que el jugador modificó; el resto se vuelve a generar
// desde la semilla. Cada chunk se comprime (RLE) y se codifica en base64.

const GameStorage = {
  SAVE_KEY: "mcweb_save_v1",
  META_KEY: "mcweb_meta_v1",
  SETTINGS_KEY: "mcweb_settings_v1",
  defaults: { renderDistance: 4, fov: 60, sensitivity: 5, showFps: true },

  // ----- Utilidades de compresión -----
  rleEncode(data) { // [valor, repeticiones, valor, repeticiones, ...]
    const out = [];
    let i = 0;
    while (i < data.length) {
      const v = data[i];
      let n = 1;
      while (i + n < data.length && data[i + n] === v && n < 255) n++;
      out.push(v, n);
      i += n;
    }
    return new Uint8Array(out);
  },

  rleDecode(bytes, length) {
    const out = new Uint8Array(length);
    let p = 0;
    for (let i = 0; i + 1 < bytes.length && p < length; i += 2) {
      out.fill(bytes[i], p, Math.min(length, p + bytes[i + 1]));
      p += bytes[i + 1];
    }
    return out;
  },

  toBase64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 8192)
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(s);
  },

  fromBase64(str) {
    const s = atob(str);
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  },

  num(v, min, max, def) {
    v = Number(v);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
  },

  // Convierte el texto de "semilla" en un número (vacío = aleatoria)
  parseSeed(text) {
    text = (text || "").trim();
    if (!text) return (Math.random() * 2147483647) | 0;
    if (/^-?\d{1,9}$/.test(text)) return parseInt(text, 10);
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = (Math.imul(h, 33) ^ text.charCodeAt(i)) | 0;
    return h;
  },

  // ----- Configuración -----
  loadSettings() {
    const d = this.defaults, s = { ...d };
    try {
      const raw = localStorage.getItem(this.SETTINGS_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        s.renderDistance = Math.round(this.num(o.renderDistance, 2, 8, d.renderDistance));
        s.fov = Math.round(this.num(o.fov, 50, 100, d.fov));
        s.sensitivity = this.num(o.sensitivity, 1, 10, d.sensitivity);
        s.showFps = typeof o.showFps === "boolean" ? o.showFps : d.showFps;
      }
    } catch (e) { /* si está dañada se usan los valores por defecto */ }
    return s;
  },

  saveSettings(s) {
    try { localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* sin espacio */ }
  },

  // ----- Mundo -----
  // data: {seed, player:{x,y,z,yaw,pitch,flying}, inventory, chunks:[{cx,cz,data:Uint8Array}]}
  saveGame(data) {
    try {
      const save = {
        version: 1,
        seed: data.seed,
        player: data.player,
        inventory: data.inventory,
        chunks: data.chunks.map(c => ({ cx: c.cx, cz: c.cz, d: this.toBase64(this.rleEncode(c.data)) }))
      };
      localStorage.setItem(this.SAVE_KEY, JSON.stringify(save));
      localStorage.setItem(this.META_KEY, JSON.stringify({ seed: data.seed, savedAt: Date.now() }));
      return true;
    } catch (e) {
      return false; // normalmente: almacenamiento lleno
    }
  },

  loadGame() {
    try {
      const raw = localStorage.getItem(this.SAVE_KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      const p = o.player;
      if (o.version !== 1 || !Number.isFinite(o.seed) || !p) return null;
      for (const k of ["x", "y", "z", "yaw", "pitch"]) if (!Number.isFinite(p[k])) return null;
      const size = CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE;
      const chunks = [];
      for (const c of o.chunks || []) {
        const data = this.rleDecode(this.fromBase64(c.d), size);
        if (Number.isInteger(c.cx) && Number.isInteger(c.cz)) chunks.push({ cx: c.cx, cz: c.cz, data });
      }
      return { seed: o.seed | 0, player: p, inventory: o.inventory, chunks };
    } catch (e) {
      return null;
    }
  },

  getSaveInfo() { // datos rápidos para mostrar en el menú
    try {
      const raw = localStorage.getItem(this.META_KEY);
      if (!raw || localStorage.getItem(this.SAVE_KEY) === null) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  },

  deleteGame() {
    try { localStorage.removeItem(this.SAVE_KEY); localStorage.removeItem(this.META_KEY); } catch (e) {}
  }
};