// items.js - Objetos que no son bloques (palo y herramientas) y utilidades comunes a bloques y objetos.
// Los ids de bloques van de 1 a 99 y los de objetos empiezan en 100.

const ITEM_ID_START = 100;

const Items = {
  STICK: 100,
  WOOD_PICKAXE: 101, WOOD_AXE: 102, WOOD_SHOVEL: 103, WOOD_SWORD: 104,
  STONE_PICKAXE: 105, STONE_AXE: 106, STONE_SHOVEL: 107, STONE_SWORD: 108,

  // power = cuántas veces más rápido rompe los bloques de su tipo
  data: {
    100: { name: "Palo" },
    101: { name: "Pico de madera",  tool: "pickaxe", material: "wood",  power: 2 },
    102: { name: "Hacha de madera", tool: "axe",     material: "wood",  power: 2 },
    103: { name: "Pala de madera",  tool: "shovel",  material: "wood",  power: 2 },
    104: { name: "Espada de madera", tool: "sword",  material: "wood",  power: 2 },
    105: { name: "Pico de piedra",  tool: "pickaxe", material: "stone", power: 4 },
    106: { name: "Hacha de piedra", tool: "axe",     material: "stone", power: 4 },
    107: { name: "Pala de piedra",  tool: "shovel",  material: "stone", power: 4 },
    108: { name: "Espada de piedra", tool: "sword",  material: "stone", power: 4 }
  },

  isBlock(id) { return id > 0 && id < ITEM_ID_START; },
  info(id) { return id < ITEM_ID_START ? Blocks.data[id] : this.data[id]; },
  exists(id) { return !!this.info(id); },
  name(id) { const i = this.info(id); return i ? i.name : "?"; },
  maxStack(id) { const i = this.data[id]; return i && i.tool ? 1 : 64; }, // las herramientas no se apilan

  // Todos los ids que existen en el juego (para el menú creativo)
  all() { return Object.keys(Blocks.data).map(Number).concat(Object.keys(this.data).map(Number)); },

  // Segundos para romper un bloque con el objeto que lleva el jugador en la mano
  breakTime(blockId, heldId) {
    const b = Blocks.data[blockId];
    if (!b) return Infinity;
    const held = this.data[heldId];
    return held && held.tool === b.tool ? b.hardness / held.power : b.hardness;
  },

  // ----- Iconos de objetos: pixel art generado con código (16x16) -----
  // Devuelve una matriz 16x16 de colores [r,g,b] o null (transparente).
  artGrid(id) {
    const g = Array.from({ length: 16 }, () => new Array(16).fill(null));
    const set = (x, y, c) => { if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = c; };
    const STICK = [124, 90, 50], STICK_HI = [158, 118, 66];
    const info = this.data[id];

    if (id === this.STICK) {
      for (let i = 3; i <= 12; i++) { set(i, 15 - i, STICK); set(i + 1, 15 - i, STICK_HI); }
      return g;
    }
    const head = info.material === "stone" ? [136, 136, 136] : [176, 136, 78];
    const dark = head.map(v => Math.round(v * 0.7));

    if (info.tool === "sword") {
      for (let i = 5; i <= 13; i++) { set(i, 15 - i, head); set(i + 1, 15 - i, dark); } // hoja
      set(14, 1, head);
      for (let i = 2; i <= 4; i++) set(i, 15 - i, STICK);                                // empuñadura
      for (let k = -2; k <= 2; k++) set(5 + k, 10 + k + 0, dark);                         // guarda
      return g;
    }
    for (let i = 2; i <= 12; i++) set(i, 15 - i, STICK);                                   // mango
    if (info.tool === "pickaxe") {
      for (let y = 0; y < 10; y++) for (let x = 3; x < 16; x++) {
        const dx = x - 10.5, dy = y - 4.5, d = Math.hypot(dx, dy);
        if (d >= 2.8 && d <= 4.7 && (-dx + dy) < 2.2) set(x, y, d > 3.9 ? dark : head);
      }
    } else if (info.tool === "axe") {
      for (let y = 1; y <= 7; y++) for (let x = 7; x <= 14; x++) {
        if (x + y >= 12 && x + y <= 17 && x - y >= 4) set(x, y, x - y >= 9 ? dark : head);
      }
    } else if (info.tool === "shovel") {
      for (let y = 0; y < 8; y++) for (let x = 8; x < 16; x++) {
        const dx = (x - 11.5) / 2.1, dy = (y - 3.5) / 2.8;
        if (dx * dx + dy * dy <= 1) set(x, y, dx + dy > 0.5 ? dark : head);
      }
    }
    return g;
  },

  _icons: {},
  iconCanvas(id) { // se dibuja una sola vez y se reutiliza
    if (!this._icons[id]) {
      const c = document.createElement("canvas");
      c.width = TILE; c.height = TILE;
      const ctx = c.getContext("2d"), grid = this.artGrid(id);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const px = grid[y][x];
        if (px) { ctx.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`; ctx.fillRect(x, y, 1, 1); }
      }
      this._icons[id] = c;
    }
    return this._icons[id];
  },

  // Dibuja el icono de un bloque (desde el atlas) o de un objeto en un canvas 2D de 16x16
  drawIcon(ctx, id, atlas) {
    if (this.isBlock(id)) {
      ctx.drawImage(atlas, Blocks.data[id].side * TILE, 0, TILE, TILE, 0, 0, TILE, TILE);
    } else {
      ctx.drawImage(this.iconCanvas(id), 0, 0);
    }
  }
};