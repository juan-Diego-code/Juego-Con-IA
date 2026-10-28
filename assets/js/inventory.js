// inventory.js - Datos del inventario (36 huecos), interfaz de inventario y menú creativo

const HOTBAR_SIZE = 9;
const INVENTORY_SIZE = 36; // huecos 0-8 = barra de acceso rápido, 9-35 = mochila

class Inventory {
  constructor() {
    this.slots = new Array(INVENTORY_SIZE).fill(null); // cada hueco: null o {id, count}
    this.selected = 0; // hueco activo de la barra (0-8)
  }

  // Guarda objetos: primero completa pilas existentes y luego usa huecos vacíos.
  // Devuelve cuántos no cupieron.
  add(id, count = 1) {
    const max = Items.maxStack(id);
    for (let i = 0; i < INVENTORY_SIZE && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < max) {
        const n = Math.min(count, max - s.count);
        s.count += n;
        count -= n;
      }
    }
    for (let i = 0; i < INVENTORY_SIZE && count > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(count, max);
        this.slots[i] = { id, count: n };
        count -= n;
      }
    }
    return count;
  }

  // Cuántos objetos de este tipo hay en total
  count(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  // Quita "count" objetos de este tipo (primero de la mochila, luego de la barra). Devuelve true si pudo.
  remove(id, count) {
    if (this.count(id) < count) return false;
    const order = [];
    for (let i = INVENTORY_SIZE - 1; i >= 0; i--) order.push(i);
    for (const i of order) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const n = Math.min(count, s.count);
      s.count -= n;
      count -= n;
      if (s.count <= 0) this.slots[i] = null;
      if (count === 0) break;
    }
    return true;
  }

  // Datos para guardar la partida
  toData() {
    return { slots: this.slots.map(s => (s ? { id: s.id, count: s.count } : null)), selected: this.selected };
  }

  // Carga datos guardados (o vacía el inventario si d es null); valida cada hueco
  loadData(d) {
    this.slots = new Array(INVENTORY_SIZE).fill(null);
    this.selected = 0;
    if (!d || !Array.isArray(d.slots)) return;
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const e = d.slots[i];
      if (e && Items.exists(e.id) && Number.isInteger(e.count) && e.count >= 1 && e.count <= Items.maxStack(e.id))
        this.slots[i] = { id: e.id, count: e.count };
    }
    if (Number.isInteger(d.selected) && d.selected >= 0 && d.selected < HOTBAR_SIZE) this.selected = d.selected;
  }

  getSelected() { return this.slots[this.selected]; }

  // Gasta un objeto del hueco activo. Devuelve false si estaba vacío.
  consumeSelected() {
    const s = this.slots[this.selected];
    if (!s) return false;
    s.count--;
    if (s.count <= 0) this.slots[this.selected] = null;
    return true;
  }

  // Clic en un hueco llevando (o no) un objeto en el cursor. Devuelve el nuevo objeto del cursor.
  clickSlot(i, cursor) {
    const s = this.slots[i];
    if (!cursor) { this.slots[i] = null; return s; }          // recoger
    if (!s) { this.slots[i] = cursor; return null; }          // soltar en hueco vacío
    if (s.id === cursor.id) {                                  // juntar pilas
      const n = Math.min(cursor.count, Items.maxStack(s.id) - s.count);
      s.count += n;
      cursor.count -= n;
      return cursor.count > 0 ? cursor : null;
    }
    this.slots[i] = cursor;                                    // intercambiar
    return s;
  }
}

// ---------- Interfaz del inventario (modo supervivencia) y de la barra de acceso rápido ----------
class InventoryUI {
  constructor(inventory, atlasCanvas, onCraft) {
    this.inv = inventory;
    this.atlas = atlasCanvas;
    this.cursor = null;
    this.showCounts = true;   // en modo creativo no se muestran cantidades
    this.atTable = false;     // ¿se abrió desde una mesa de crafteo?
    this.creative = null;     // menú creativo (se asigna desde fuera)
    this.entries = []; // {el, index, inHotbar}
    this.hotbarEl = document.getElementById("hotbar");
    this.gridEl = document.getElementById("invGrid");
    this.invHotbarEl = document.getElementById("invHotbar");
    this.cursorEl = document.getElementById("cursorItem");
    for (let i = 0; i < HOTBAR_SIZE; i++) this.makeSlot(i, this.hotbarEl, false);
    for (let i = HOTBAR_SIZE; i < INVENTORY_SIZE; i++) this.makeSlot(i, this.gridEl, true);
    for (let i = 0; i < HOTBAR_SIZE; i++) this.makeSlot(i, this.invHotbarEl, true);
    this.cursorEl.appendChild(this.makeIcon());
    this.cursorEl.appendChild(document.createElement("span"));
    this.crafting = new CraftingUI(inventory, atlasCanvas, document.getElementById("recipeList"), onCraft);
    document.addEventListener("mousemove", e => {
      this.cursorEl.style.left = e.clientX + "px";
      this.cursorEl.style.top = e.clientY + "px";
    });
    this.render();
  }

  makeIcon() {
    const c = document.createElement("canvas");
    c.width = TILE; c.height = TILE; // el CSS lo agranda con aspecto pixelado
    return c;
  }

  makeSlot(index, parent, clickable) {
    const el = document.createElement("div");
    el.className = "slot";
    el.appendChild(this.makeIcon());
    el.appendChild(document.createElement("span"));
    if (clickable) {
      el.addEventListener("mousedown", e => {
        e.preventDefault();
        this.cursor = this.inv.clickSlot(index, this.cursor);
        this.render();
      });
    }
    parent.appendChild(el);
    this.entries.push({ el, index, inHotbar: parent === this.hotbarEl });
  }

  drawItem(el, item) {
    const canvas = el.querySelector("canvas"), label = el.querySelector("span");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, TILE, TILE);
    if (item) {
      Items.drawIcon(ctx, item.id, this.atlas);
      label.textContent = this.showCounts && item.count > 1 ? item.count : "";
      el.title = Items.name(item.id);
    } else {
      label.textContent = "";
      el.title = "";
    }
  }

  render() {
    for (const e of this.entries) {
      this.drawItem(e.el, this.inv.slots[e.index]);
      if (e.inHotbar) e.el.classList.toggle("selected", e.index === this.inv.selected);
    }
    this.drawItem(this.cursorEl, this.cursor);
    this.cursorEl.hidden = !this.cursor;
    this.crafting.render(this.atTable);
    if (this.creative) this.creative.render();
  }

  // Al cerrar el menú, el objeto del cursor vuelve a la mochila
  returnCursor() {
    if (this.cursor) { this.inv.add(this.cursor.id, this.cursor.count); this.cursor = null; }
    this.render();
  }
}

// ---------- Menú del modo creativo: todos los bloques y objetos del juego ----------
class CreativeUI {
  constructor(inventory, atlasCanvas, ui) {
    this.inv = inventory;
    this.atlas = atlasCanvas;
    this.ui = ui;
    this.hotbarSlots = [];
    this.nameEl = document.getElementById("creativeName");
    const palette = document.getElementById("creativePalette");
    const hotbar = document.getElementById("creativeHotbar");

    for (const id of Items.all()) { // paleta con todo lo que existe
      const el = this.makeSlot();
      Items.drawIcon(el.querySelector("canvas").getContext("2d"), id, atlasCanvas);
      el.title = Items.name(id);
      el.addEventListener("mousedown", e => { e.preventDefault(); this.pick(id); });
      el.addEventListener("mouseenter", () => { this.nameEl.textContent = Items.name(id); });
      palette.appendChild(el);
    }
    for (let i = 0; i < HOTBAR_SIZE; i++) { // la barra de acceso rápido, editable
      const el = this.makeSlot();
      el.addEventListener("mousedown", e => {
        e.preventDefault();
        if (e.button === 2) this.inv.slots[i] = null; // clic derecho: vaciar el hueco
        this.inv.selected = i;
        this.ui.render();
      });
      hotbar.appendChild(el);
      this.hotbarSlots.push(el);
    }
    ui.creative = this;
    this.render();
  }

  makeSlot() {
    const el = document.createElement("div");
    el.className = "slot";
    const c = document.createElement("canvas");
    c.width = TILE; c.height = TILE;
    el.appendChild(c);
    el.appendChild(document.createElement("span"));
    return el;
  }

  // Clic en un objeto de la paleta: si ya está en la barra se selecciona; si no, va al hueco activo
  pick(id) {
    const found = this.inv.slots.findIndex((s, i) => i < HOTBAR_SIZE && s && s.id === id);
    if (found >= 0) this.inv.selected = found;
    else this.inv.slots[this.inv.selected] = { id, count: Items.maxStack(id) };
    this.ui.render();
  }

  render() {
    this.hotbarSlots.forEach((el, i) => {
      const item = this.inv.slots[i];
      const ctx = el.querySelector("canvas").getContext("2d");
      ctx.clearRect(0, 0, TILE, TILE);
      if (item) Items.drawIcon(ctx, item.id, this.atlas);
      el.title = item ? Items.name(item.id) : "";
      el.classList.toggle("selected", i === this.inv.selected);
    });
  }
}