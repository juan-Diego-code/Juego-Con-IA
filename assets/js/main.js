// main.js - Punto de entrada y bucle del juego (Etapa 6)

(function () {
  const canvas = document.getElementById("gameCanvas");
  const fpsLabel = document.getElementById("fps");
  const posLabel = document.getElementById("pos");
  const overlay = document.getElementById("overlay");
  const inventoryEl = document.getElementById("inventory");
  const blockLabel = document.getElementById("blockLabel");
  const REACH = 6;            // alcance en bloques
  const RENDER_DISTANCE = 4;  // chunks visibles alrededor del jugador (radio)
  let renderer;

  try {
    renderer = new Renderer(canvas);
  } catch (e) {
    const box = document.getElementById("error");
    box.textContent = "Error: " + e.message;
    box.hidden = false;
    return;
  }

  // ----- Mundo infinito: los chunks se crean y se dibujan según la posición del jugador -----
  const world = new World(1234);
  renderer.setFog(RENDER_DISTANCE * 16 - 28, RENDER_DISTANCE * 16 - 4);

  const chunkMeshes = new Map(); // clave -> {cx, cz, mesh}
  let meshList = [], meshListDirty = true;
  let pending = [], lastCX = null, lastCZ = null;

  function rebuildChunk(cx, cz) {
    const key = world.key(cx, cz);
    const old = chunkMeshes.get(key);
    if (old && old.mesh) renderer.deleteMesh(old.mesh);
    const verts = world.buildChunkMesh(cx, cz);
    chunkMeshes.set(key, { cx, cz, mesh: verts.length > 0 ? renderer.createChunkMesh(verts) : null });
    meshListDirty = true;
  }

  // Si el jugador cambió de chunk: descarga mallas lejanas y prepara la cola de las cercanas
  function updateStreaming() {
    const pcx = Math.floor(player.pos[0] / CHUNK_SIZE), pcz = Math.floor(player.pos[2] / CHUNK_SIZE);
    if (pcx === lastCX && pcz === lastCZ) return;
    lastCX = pcx; lastCZ = pcz;
    for (const [key, e] of chunkMeshes) {
      if (Math.max(Math.abs(e.cx - pcx), Math.abs(e.cz - pcz)) > RENDER_DISTANCE + 1) {
        if (e.mesh) renderer.deleteMesh(e.mesh);
        chunkMeshes.delete(key); // los datos del chunk se conservan en world.chunks
        meshListDirty = true;
      }
    }
    pending = [];
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++)
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++)
        if (!chunkMeshes.has(world.key(pcx + dx, pcz + dz))) pending.push([pcx + dx, pcz + dz, dx * dx + dz * dz]);
    pending.sort((a, b) => a[2] - b[2]); // primero los más cercanos
  }

  // Construye mallas pendientes sin pasarse de un tiempo por fotograma (evita tirones)
  function processPending(budgetMs) {
    const t0 = performance.now();
    while (pending.length > 0 && performance.now() - t0 < budgetMs) {
      const [cx, cz] = pending.shift();
      if (!chunkMeshes.has(world.key(cx, cz))) rebuildChunk(cx, cz);
    }
  }

  // ----- Jugador e inventario -----
  const spawn = world.findSpawn();
  const player = new Player(canvas, world, spawn[0], spawn[1], spawn[2]);
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
      const r = canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => {});
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
  // El clic puede caer en el canvas o en el mensaje "Haz clic para jugar" (que lo cubre): se escuchan ambos
  function requestPlay() {
    if (player.locked || inventoryOpen) return;
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => {}); // el navegador puede rechazarlo si acabas de pulsar Esc
  }
  canvas.addEventListener("click", requestPlay);
  overlay.addEventListener("click", requestPlay);
  document.addEventListener("pointerlockchange", updateOverlay);
  showSelectedName();

  // Primeros chunks (los más cercanos) listos antes de empezar; el resto se carga poco a poco
  updateStreaming();
  for (let i = 0; i < 9 && pending.length > 0; i++) {
    const [cx, cz] = pending.shift();
    rebuildChunk(cx, cz);
  }

  // ----- Bucle -----
  let last = performance.now(), frames = 0, fpsTimer = 0;
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    player.update(dt);
    updateStreaming();
    processPending(8);
    if (meshListDirty) {
      meshList = Array.from(chunkMeshes.values()).filter(e => e.mesh).map(e => e.mesh);
      meshListDirty = false;
    }
    target = player.locked ? world.raycast(player.eye, player.lookDir, REACH) : null;
    renderer.render(player.getViewMatrix(), meshList, target, player.eye);

    if (labelTimer > 0) { labelTimer -= dt; if (labelTimer <= 0) blockLabel.hidden = true; }
    frames++;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      fpsLabel.textContent = Math.round(frames / fpsTimer);
      posLabel.textContent = "X:" + Math.floor(player.pos[0]) + " Y:" + Math.floor(player.pos[1]) + " Z:" + Math.floor(player.pos[2]);
      frames = 0;
      fpsTimer = 0;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();