// main.js - Punto de entrada y bucle del juego (Etapa 5)

(function () {
  const canvas = document.getElementById("gameCanvas");
  const fpsLabel = document.getElementById("fps");
  const overlay = document.getElementById("overlay");
  const inventoryEl = document.getElementById("inventory");
  const blockLabel = document.getElementById("blockLabel");
  const REACH = 6; // alcance en bloques
  let renderer;

  try {
    renderer = new Renderer(canvas);
  } catch (e) {
    const box = document.getElementById("error");
    box.textContent = "Error: " + e.message;
    box.hidden = false;
    return;
  }

  // ----- Mundo: 6x6 chunks (96x96 bloques) -----
  const world = new World(6, 1234);
  world.generateAll();

  const chunkMeshes = new Map(); // "cx,cz" -> malla en la GPU
  let meshList = [];

  function rebuildChunk(cx, cz) {
    const key = world.key(cx, cz);
    const old = chunkMeshes.get(key);
    if (old) { renderer.deleteMesh(old); chunkMeshes.delete(key); }
    const verts = world.buildChunkMesh(cx, cz);
    if (verts.length > 0) chunkMeshes.set(key, renderer.createChunkMesh(verts));
  }
  for (let cx = 0; cx < world.size; cx++)
    for (let cz = 0; cz < world.size; cz++) rebuildChunk(cx, cz);
  meshList = Array.from(chunkMeshes.values());

  // ----- Jugador e inventario -----
  const sx = Math.floor(world.size * CHUNK_SIZE / 2), sz = sx;
  const player = new Player(canvas, world, sx + 0.5, world.getSurfaceY(sx, sz) + 2, sz + 0.5);
  const inventory = new Inventory();
  const ui = new InventoryUI(inventory, createAtlasCanvas());
  let inventoryOpen = false;
  let labelTimer = 0;

  function showSelectedName() {
    const s = inventory.getSelected();
    blockLabel.textContent = s ? Blocks.data[s.id].name : "";
    blockLabel.hidden = !s;
    labelTimer = 2; // se oculta a los 2 segundos
  }
  function updateOverlay() { overlay.hidden = player.locked || inventoryOpen; }

  function selectSlot(i) {
    inventory.selected = (i + HOTBAR_SIZE) % HOTBAR_SIZE;
    ui.render();
    showSelectedName();
  }

  function toggleInventory() {
    inventoryOpen = !inventoryOpen;
    inventoryEl.hidden = !inventoryOpen;
    if (inventoryOpen) {
      document.exitPointerLock();
    } else {
      ui.returnCursor();
      showSelectedName();
      canvas.requestPointerLock();
    }
    updateOverlay();
  }

  document.addEventListener("keydown", e => {
    if (e.code === "KeyE" && (player.locked || inventoryOpen)) { toggleInventory(); return; }
    if (e.code === "Escape" && inventoryOpen) { toggleInventory(); return; }
    if (!player.locked) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) selectSlot(n - 1);
  });
  document.addEventListener("wheel", e => {
    if (player.locked) selectSlot(inventory.selected + (e.deltaY > 0 ? 1 : -1));
  });

  // ----- Clics: izquierdo destruye (y recoge), derecho coloca (y gasta) -----
  let target = null; // bloque que miramos

  function applyChange(x, y, z, id) {
    const dirty = world.setBlock(x, y, z, id);
    if (!dirty) return;
    for (const [cx, cz] of dirty) rebuildChunk(cx, cz);
    meshList = Array.from(chunkMeshes.values());
  }

  document.addEventListener("mousedown", e => {
    if (!player.locked || !target) return;
    if (e.button === 0) {
      if (target.y === 0) return; // y=0 es el fondo del mundo
      const id = world.getBlock(target.x, target.y, target.z);
      applyChange(target.x, target.y, target.z, Blocks.AIR);
      inventory.add(id); // recoger el bloque destruido
      ui.render();
    } else if (e.button === 2) {
      const item = inventory.getSelected();
      if (!item) return; // hueco vacío
      const n = target.normal;
      if (n[0] === 0 && n[1] === 0 && n[2] === 0) return;
      const bx = target.x + n[0], by = target.y + n[1], bz = target.z + n[2];
      if (Blocks.isSolid(world.getBlock(bx, by, bz))) return;
      if (player.intersectsBlock(bx, by, bz)) return; // no colocar dentro del jugador
      applyChange(bx, by, bz, item.id);
      inventory.consumeSelected();
      ui.render();
    }
  });
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  inventoryEl.addEventListener("contextmenu", e => e.preventDefault());

  // Clic para capturar el ratón (Escape lo libera)
  canvas.addEventListener("click", () => { if (!player.locked && !inventoryOpen) canvas.requestPointerLock(); });
  document.addEventListener("pointerlockchange", updateOverlay);
  showSelectedName();

  // ----- Bucle -----
  let last = performance.now(), frames = 0, fpsTimer = 0;
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    player.update(dt);
    target = player.locked ? world.raycast(player.eye, player.lookDir, REACH) : null;
    renderer.render(player.getViewMatrix(), meshList, target);

    if (labelTimer > 0) { labelTimer -= dt; if (labelTimer <= 0) blockLabel.hidden = true; }
    frames++;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      fpsLabel.textContent = Math.round(frames / fpsTimer);
      frames = 0;
      fpsTimer = 0;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();