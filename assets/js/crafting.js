// crafting.js - Recetas y lista de crafteo
// Se craftea desde una lista de recetas: al hacer clic en una, se gastan los materiales del
// inventario y se recibe el resultado. Las marcadas con "table" necesitan una mesa de crafteo.

const RECIPES = [
  // --- A mano (menú de inventario) ---
  { out: { id: Blocks.PLANKS, count: 4 },         in: [{ id: Blocks.WOOD, count: 1 }],   table: false },
  { out: { id: Items.STICK, count: 4 },           in: [{ id: Blocks.PLANKS, count: 2 }], table: false },
  { out: { id: Blocks.CRAFTING_TABLE, count: 1 }, in: [{ id: Blocks.PLANKS, count: 4 }], table: false },
  { out: { id: Blocks.STONE_BRICKS, count: 4 },   in: [{ id: Blocks.STONE, count: 4 }],  table: false },
  { out: { id: Blocks.SANDSTONE, count: 1 },      in: [{ id: Blocks.SAND, count: 4 }],   table: false },
  // --- Con mesa de crafteo: herramientas ---
  { out: { id: Items.WOOD_PICKAXE, count: 1 },  in: [{ id: Blocks.PLANKS, count: 3 }, { id: Items.STICK, count: 2 }], table: true },
  { out: { id: Items.WOOD_AXE, count: 1 },      in: [{ id: Blocks.PLANKS, count: 3 }, { id: Items.STICK, count: 2 }], table: true },
  { out: { id: Items.WOOD_SHOVEL, count: 1 },   in: [{ id: Blocks.PLANKS, count: 1 }, { id: Items.STICK, count: 2 }], table: true },
  { out: { id: Items.WOOD_SWORD, count: 1 },    in: [{ id: Blocks.PLANKS, count: 2 }, { id: Items.STICK, count: 1 }], table: true },
  { out: { id: Items.STONE_PICKAXE, count: 1 }, in: [{ id: Blocks.STONE, count: 3 }, { id: Items.STICK, count: 2 }],  table: true },
  { out: { id: Items.STONE_AXE, count: 1 },     in: [{ id: Blocks.STONE, count: 3 }, { id: Items.STICK, count: 2 }],  table: true },
  { out: { id: Items.STONE_SHOVEL, count: 1 },  in: [{ id: Blocks.STONE, count: 1 }, { id: Items.STICK, count: 2 }],  table: true },
  { out: { id: Items.STONE_SWORD, count: 1 },   in: [{ id: Blocks.STONE, count: 2 }, { id: Items.STICK, count: 1 }],  table: true }
];

const Crafting = {
  recipes: RECIPES,

  // ¿Hay materiales suficientes en el inventario?
  has(inv, recipe) { return recipe.in.every(r => inv.count(r.id) >= r.count); },

  // Intenta craftear. Devuelve "ok", "table" (falta la mesa), "missing" (faltan materiales) o "full" (no cabe).
  craft(inv, recipe, atTable) {
    if (recipe.table && !atTable) return "table";
    if (!this.has(inv, recipe)) return "missing";
    // Se prueba primero en una copia, para no perder materiales si el resultado no cabe
    const sim = new Inventory();
    sim.loadData(inv.toData());
    for (const r of recipe.in) sim.remove(r.id, r.count);
    if (sim.add(recipe.out.id, recipe.out.count) > 0) return "full";
    for (const r of recipe.in) inv.remove(r.id, r.count);
    inv.add(recipe.out.id, recipe.out.count);
    return "ok";
  }
};

function makeMiniSlot(id, count, atlas) {
  const el = document.createElement("div");
  el.className = "slot mini";
  const c = document.createElement("canvas");
  c.width = TILE; c.height = TILE;
  el.appendChild(c);
  const label = document.createElement("span");
  label.textContent = count > 1 ? count : "";
  el.appendChild(label);
  Items.drawIcon(c.getContext("2d"), id, atlas);
  el.title = Items.name(id);
  return el;
}

class CraftingUI {
  constructor(inventory, atlas, listEl, onCraft) {
    this.inv = inventory;
    this.rows = [];
    for (const recipe of RECIPES) {
      const row = document.createElement("div");
      row.className = "recipe";
      row.title = Items.name(recipe.out.id) + (recipe.table ? " (requiere mesa de crafteo)" : "");
      row.appendChild(makeMiniSlot(recipe.out.id, recipe.out.count, atlas));
      const name = document.createElement("span");
      name.className = "rname";
      name.textContent = Items.name(recipe.out.id);
      row.appendChild(name);
      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = "←";
      row.appendChild(arrow);
      const ings = recipe.in.map(r => {
        const slot = makeMiniSlot(r.id, r.count, atlas);
        row.appendChild(slot);
        return slot;
      });
      if (recipe.table) {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = "Mesa";
        row.appendChild(tag);
      }
      row.addEventListener("mousedown", e => { e.preventDefault(); onCraft(recipe); });
      listEl.appendChild(row);
      this.rows.push({ recipe, row, ings });
    }
  }

  // Marca cada receta: disponible, sin materiales (rojo en lo que falta) o bloqueada (necesita mesa)
  render(atTable) {
    for (const { recipe, row, ings } of this.rows) {
      const locked = recipe.table && !atTable;
      row.classList.toggle("lock", locked);
      row.classList.toggle("ok", !locked && Crafting.has(this.inv, recipe));
      recipe.in.forEach((r, i) => ings[i].classList.toggle("lack", this.inv.count(r.id) < r.count));
    }
  }
}