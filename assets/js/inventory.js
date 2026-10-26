// inventory.js - Datos del inventario (36 huecos) e interfaz (barra rápida + menú)

const MAX_STACK = 64;
const HOTBAR_SIZE = 9;
const INVENTORY_SIZE = 36; // huecos 0-8 = barra de acceso rápido, 9-35 = mochila

class Inventory {
  constructor() {
    this.slots = new Array(INVENTORY_SIZE).fill(null); // cada hueco: null o {id, count}
    this.selected = 0; // hueco activo de la barra (0-8)
  }

  // Guarda bloques: primero completa pilas existentes y luego usa huecos vacíos.
  // Devuelve cuántos no cupieron.
  add(id, count = 1) {
    for (let i = 0; i < INVENTORY_SIZE && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < MAX_STACK) {
        const n = Math.min(count, MAX_STACK - s.count);
        s.count += n;
        count -= n;
      }
    }
    for (let i = 0; i < INVENTORY_SIZE && count > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(count, MAX_STACK);
        this.slots[i] = { id, count: n };
        count -= n;
      }
    }
    return count;
  }

  getSelected() { return this.slots[this.selected]; }

  // Gasta un bloque del hueco activo. Devuelve false si estaba vacío.
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
      const n = Math.min(cursor.count, MAX_STACK - s.count);
      s.count += n;
      cursor.count -= n;
      return cursor.count > 0 ? cursor : null;
    }
    this.slots[i] = cursor;                                    // intercambiar
    return s;
  }
}

class InventoryUI {
  constructor(inventory, atlasCanvas) {
    this.inv = inventory;
    this.atlas = atlasCanvas;
    this.cursor = null;
    this.entries = []; // {el, index}
    this.hotbarEl = document.getElementById("hotbar");
    this.gridEl = document.getElementById("invGrid");
    this.invHotbarEl = document.getElementById("invHotbar");
    this.cursorEl = document.getElementById("cursorItem");
    for (let i = 0; i < HOTBAR_SIZE; i++) this.makeSlot(i, this.hotbarEl, false);
    for (let i = HOTBAR_SIZE; i < INVENTORY_SIZE; i++) this.makeSlot(i, this.gridEl, true);
    for (let i = 0; i < HOTBAR_SIZE; i++) this.makeSlot(i, this.invHotbarEl, true);
    this.cursorEl.appendChild(this.makeIcon());
    this.cursorEl.appendChild(document.createElement("span"));
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
      ctx.drawImage(this.atlas, Blocks.data[item.id].side * TILE, 0, TILE, TILE, 0, 0, TILE, TILE);
      label.textContent = item.count > 1 ? item.count : "";
      el.title = Blocks.data[item.id].name;
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
  }

  // Al cerrar el menú, el objeto del cursor vuelve a la mochila
  returnCursor() {
    if (this.cursor) { this.inv.add(this.cursor.id, this.cursor.count); this.cursor = null; }
    this.render();
  }
}