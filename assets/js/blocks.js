// blocks.js - Definición de los tipos de bloque
// Los números de "top", "side" y "bottom" son índices en el atlas de texturas.

const Blocks = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WOOD: 5,
  LEAVES: 6,

  data: {
    1: { name: "Césped", top: 0, side: 1, bottom: 2 },
    2: { name: "Tierra", top: 2, side: 2, bottom: 2 },
    3: { name: "Piedra", top: 3, side: 3, bottom: 3 },
    4: { name: "Arena",  top: 4, side: 4, bottom: 4 },
    5: { name: "Madera", top: 6, side: 5, bottom: 6 },
    6: { name: "Hojas",  top: 7, side: 7, bottom: 7 }
  },

  isSolid(id) { return id !== Blocks.AIR; }
};