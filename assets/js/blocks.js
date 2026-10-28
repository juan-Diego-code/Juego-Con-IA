// blocks.js - Definición de los tipos de bloque
// "top", "side" y "bottom" son índices en el atlas de texturas.
// "hardness" = segundos para romperlo con la mano; "tool" = herramienta que lo rompe más rápido.

const Blocks = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WOOD: 5,
  LEAVES: 6,
  PLANKS: 7,
  STONE_BRICKS: 8,
  SANDSTONE: 9,
  CRAFTING_TABLE: 10,

  data: {
    1:  { name: "Césped",              top: 0,  side: 1,  bottom: 2,  hardness: 0.6,  tool: "shovel" },
    2:  { name: "Tierra",              top: 2,  side: 2,  bottom: 2,  hardness: 0.5,  tool: "shovel" },
    3:  { name: "Piedra",              top: 3,  side: 3,  bottom: 3,  hardness: 3.0,  tool: "pickaxe" },
    4:  { name: "Arena",               top: 4,  side: 4,  bottom: 4,  hardness: 0.5,  tool: "shovel" },
    5:  { name: "Madera",              top: 6,  side: 5,  bottom: 6,  hardness: 2.0,  tool: "axe" },
    6:  { name: "Hojas",               top: 7,  side: 7,  bottom: 7,  hardness: 0.25, tool: "axe" },
    7:  { name: "Tablones",            top: 8,  side: 8,  bottom: 8,  hardness: 1.5,  tool: "axe" },
    8:  { name: "Ladrillos de piedra", top: 9,  side: 9,  bottom: 9,  hardness: 3.0,  tool: "pickaxe" },
    9:  { name: "Arenisca",            top: 10, side: 10, bottom: 10, hardness: 2.0,  tool: "pickaxe" },
    10: { name: "Mesa de crafteo",     top: 11, side: 12, bottom: 8,  hardness: 1.5,  tool: "axe" }
  },

  isSolid(id) { return id !== Blocks.AIR; }
};