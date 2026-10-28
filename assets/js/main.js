// main.js - Punto de entrada: menús, bucle del juego y guardado (Etapa 7)

(function () {
  const $ = id => document.getElementById(id);
  const canvas = $("gameCanvas"), hud = $("hud"), fpsLabel = $("fps"), posLabel = $("pos");
  const blockLabel = $("blockLabel"), inventoryEl = $("inventory"), toastEl = $("toast");
  const screens = { main: $("mainMenu"), create: $("createMenu"), settings: $("settingsMenu"), pause: $("pauseMenu") };
  const REACH = 6;            // alcance en bloques
  const AUTOSAVE_MS = 30000;  // autoguardado cada 30 s
  let renderer;

  try {
    renderer = new Renderer(canvas);
  } catch (e) {
    const box = $("error");
    box.textContent = "Error: " + e.message;
    box.hidden = false;
    return;
  }

  // ===== Estado general =====
  const settings = GameStorage.loadSettings();
  let world = null;
  let state = "menu";          // "menu" (sin partida) o "playing"
  let screen = "main";         // pantalla visible: main, create, settings, pause o none (jugando)
  let settingsReturn = "main"; // a dónde vuelve el botón "Volver" de Configuración
  let inventoryOpen = false, labelTimer = 0, toastTimer = null, lastSave = Date.now();
  let target = null;           // bloque que miramos

  // Chunks dibujados
  const chunkMeshes = new Map(); // clave -> {cx, cz, mesh}
  let meshList = [], meshListDirty = true, pending = [], lastCX = null, lastCZ = null;

  // Jugador, inventario e interfaz: se crean una sola vez y se reinician al empezar una partida
  const player = new Player(canvas, null, 0, 0, 0);
  const inventory = new Inventory();
  const ui = new InventoryUI(inventory, createAtlasCanvas());

  // ===== Pantallas y avisos =====
  function showScreen(name) {
    screen = name;
    for (const key in screens) screens[key].hidden = key !== name;
    document.body.classList.toggle("playing", state === "playing");
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2500);
  }

  function updateSaveInfo() {
    const info = GameStorage.getSaveInfo();
    $("saveInfo").textContent = info
      ? "Mundo guardado · semilla " + info.seed + " · " + new Date(info.savedAt).toLocaleString()
      : "Todavía no hay un mundo guardado";
  }

  // ===== Configuración =====
  function applySettings() {
    const rd = settings.renderDistance;
    player.sensitivity = settings.sensitivity * 0.0005; // 5 -> 0.0025
    renderer.fov = settings.fov * Math.PI / 180;
    renderer.setFog(rd * 16 * 0.6, rd * 16 - 2);
    hud.classList.toggle("off", !settings.showFps);
    lastCX = null; // obliga a recalcular qué chunks se ven
  }

  const rdInput = $("rdInput"), fovInput = $("fovInput"), sensInput = $("sensInput"), fpsInput = $("fpsInput");
  function syncSettingsUI() {
    rdInput.value = settings.renderDistance; fovInput.value = settings.fov;
    sensInput.value = settings.sensitivity; fpsInput.checked = settings.showFps;
    $("rdValue").textContent = settings.renderDistance;
    $("fovValue").textContent = settings.fov;
    $("sensValue").textContent = settings.sensitivity;
  }
  function onSettingChange() {
    settings.renderDistance = +rdInput.value;
    settings.fov = +fovInput.value;
    settings.sensitivity = +sensInput.value;
    settings.showFps = fpsInput.checked;
    syncSettingsUI();
    GameStorage.saveSettings(settings);
    applySettings();
  }
  [rdInput, fovInput, sensInput, fpsInput].forEach(el => el.addEventListener("input", onSettingChange));

  // ===== Chunks: crear, dibujar y descargar según la posición del jugador =====
  function rebuildChunk(cx, cz) {
    const key = world.key(cx, cz);
    const old = chunkMeshes.get(key);
    if (old && old.mesh) renderer.deleteMesh(old.mesh);
    const verts = world.buildChunkMesh(cx, cz);
    const bounds = { x0: cx * CHUNK_SIZE, x1: (cx + 1) * CHUNK_SIZE, y0: 0, y1: WORLD_HEIGHT, z0: cz * CHUNK_SIZE, z1: (cz + 1) * CHUNK_SIZE };
    chunkMeshes.set(key, { cx, cz, mesh: verts.length > 0 ? renderer.createChunkMesh(verts, bounds) : null });
    meshListDirty = true;
  }

  function clearMeshes() {
    for (const e of chunkMeshes.values()) if (e.mesh) renderer.deleteMesh(e.mesh);
    chunkMeshes.clear();
    meshList = []; pending = [];
    meshListDirty = true;
    lastCX = lastCZ = null;
  }

  function updateStreaming() {
    const R = settings.renderDistance;
    const pcx = Math.floor(player.pos[0] / CHUNK_SIZE), pcz = Math.floor(player.pos[2] / CHUNK_SIZE);
    if (pcx === lastCX && pcz === lastCZ) return;
    lastCX = pcx; lastCZ = pcz;
    for (const [key, e] of chunkMeshes) {
      if (Math.max(Math.abs(e.cx - pcx), Math.abs(e.cz - pcz)) > R + 1) {
        if (e.mesh) renderer.deleteMesh(e.mesh);
        chunkMeshes.delete(key); // los datos del chunk se conservan en world.chunks
        meshListDirty = true;
      }
    }
    world.unloadFar(pcx, pcz, R + 3); // libera memoria de chunks lejanos sin cambios
    pending = [];
    for (let dx = -R; dx <= R; dx++)
      for (let dz = -R; dz <= R; dz++)
        if (!chunkMeshes.has(world.key(pcx + dx, pcz + dz))) pending.push([pcx + dx, pcz + dz, dx * dx + dz * dz]);
    pending.sort((a, b) => a[2] - b[2]); // primero los más cercanos
  }

  function processPending(budgetMs) {
    const t0 = performance.now();
    while (pending.length > 0 && performance.now() - t0 < budgetMs) {
      const [cx, cz] = pending.shift();
      if (!chunkMeshes.has(world.key(cx, cz))) rebuildChunk(cx, cz);
    }
  }

  // ===== Ratón bloqueado =====
  function requestLock() {
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(onLockFailed);
  }
  function onLockFailed() { // el navegador puede rechazarlo si acabas de pulsar Esc
    if (state === "playing" && !player.locked && !inventoryOpen && screen === "none") showScreen("pause");
  }
  document.addEventListener("pointerlockerror", onLockFailed);

  document.addEventListener("pointerlockchange", () => {
    if (state !== "playing") return;
    if (player.locked) showScreen("none");
    else if (screen === "none" && !inventoryOpen) showScreen("pause"); // Esc: menú de pausa
  });

  canvas.addEventListener("click", () => {
    if (state === "playing" && screen === "none" && !player.locked && !inventoryOpen) requestLock();
  });

  // ===== Guardar y cargar =====
  function saveGame(silent) {
    if (!world || state !== "playing") return false;
    if (ui.cursor) ui.returnCursor(); // el objeto que lleva el cursor vuelve a la mochila
    const ok = GameStorage.saveGame({
      seed: world.seed,
      player: { x: player.pos[0], y: player.pos[1], z: player.pos[2], yaw: player.yaw, pitch: player.pitch, flying: player.flying },
      inventory: inventory.toData(),
      chunks: world.exportModified()
    });
    lastSave = Date.now();
    if (ok) { if (!silent) toast("Mundo guardado"); }
    else toast("No se pudo guardar: el almacenamiento del navegador está lleno");
    updateSaveInfo();
    return ok;
  }

  function startGame(seed, saved) {
    clearMeshes();
    world = new World(seed);
    if (saved) {
      for (const c of saved.chunks) world.importChunk(c.cx, c.cz, c.data);
      inventory.loadData(saved.inventory);
      const p = saved.player;
      player.reset(world, p.x, p.y, p.z, p.yaw, p.pitch, p.flying);
    } else {
      inventory.loadData(null);
      const sp = world.findSpawn();
      player.reset(world, sp[0], sp[1], sp[2], 0, 0, false);
    }
    ui.cursor = null;
    ui.render();
    inventoryOpen = false;
    inventoryEl.hidden = true;
    state = "playing";
    showScreen("none");
    updateStreaming();
    for (let i = 0; i < 9 && pending.length > 0; i++) { // los más cercanos listos antes de empezar
      const [cx, cz] = pending.shift();
      rebuildChunk(cx, cz);
    }
    showSelectedName();
    lastSave = Date.now();
    requestLock();
  }

  function goToMainMenu() {
    saveGame(true);
    state = "menu";
    world = null;
    clearMeshes();
    inventoryOpen = false;
    inventoryEl.hidden = true;
    blockLabel.hidden = true;
    document.exitPointerLock();
    showScreen("main");
    updateSaveInfo();
  }

  // ===== Botones de los menús =====
  $("btnPlay").addEventListener("click", () => {
    if (GameStorage.getSaveInfo()) {
      const saved = GameStorage.loadGame();
      if (saved) { startGame(saved.seed, saved); return; }
      toast("El guardado estaba dañado: se creó un mundo nuevo");
    }
    startGame(GameStorage.parseSeed(""), null);
  });
  $("btnCreate").addEventListener("click", () => { $("seedInput").value = ""; showScreen("create"); });
  $("btnCreateBack").addEventListener("click", () => showScreen("main"));
  $("btnCreateGo").addEventListener("click", () => {
    if (GameStorage.getSaveInfo() && !confirm("Ya existe un mundo guardado. ¿Quieres reemplazarlo por uno nuevo?")) return;
    GameStorage.deleteGame();
    startGame(GameStorage.parseSeed($("seedInput").value), null);
  });
  $("btnSettings").addEventListener("click", () => { settingsReturn = "main"; syncSettingsUI(); showScreen("settings"); });
  $("btnPauseSettings").addEventListener("click", () => { settingsReturn = "pause"; syncSettingsUI(); showScreen("settings"); });
  $("btnSettingsBack").addEventListener("click", () => showScreen(settingsReturn));
  $("btnResume").addEventListener("click", requestLock);
  $("btnSave").addEventListener("click", () => saveGame(false));
  $("btnExit").addEventListener("click", goToMainMenu);

  // Autoguardado y guardado al cerrar la pestaña
  window.addEventListener("beforeunload", () => saveGame(true));
  document.addEventListener("visibilitychange", () => { if (document.hidden) saveGame(true); });

  // ===== Inventario y barra de acceso rápido =====
  function showSelectedName() {
    const s = inventory.getSelected();
    blockLabel.textContent = s ? Blocks.data[s.id].name : "";
    blockLabel.hidden = !s;
    labelTimer = 2; // se oculta a los 2 segundos
  }

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
      requestLock();
    }
  }

  document.addEventListener("keydown", e => {
    if (state !== "playing") return;
    if (e.code === "KeyE" && (player.locked || inventoryOpen)) { toggleInventory(); return; }
    if (e.code === "Escape" && inventoryOpen) { toggleInventory(); return; }
    if (!player.locked) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) selectSlot(n - 1);
  });
  document.addEventListener("wheel", e => {
    if (state === "playing" && player.locked) selectSlot(inventory.selected + (e.deltaY > 0 ? 1 : -1));
  });

  // ===== Clics: izquierdo destruye (y recoge), derecho coloca (y gasta) =====
  function applyChange(x, y, z, id) {
    const dirty = world.setBlock(x, y, z, id);
    if (!dirty) return;
    for (const [cx, cz] of dirty) rebuildChunk(cx, cz);
  }

  document.addEventListener("mousedown", e => {
    if (state !== "playing" || !player.locked || !target) return;
    if (e.button === 0) {
      if (target.y === 0) return; // y=0 es el fondo del mundo
      const id = world.getBlock(target.x, target.y, target.z);
      applyChange(target.x, target.y, target.z, Blocks.AIR);
      if (inventory.add(id) > 0) toast("Inventario lleno"); // recoger el bloque destruido
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

  // ===== Bucle principal =====
  let last = performance.now(), frames = 0, fpsTimer = 0;
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    if (state === "playing") {
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
        posLabel.textContent = "X:" + Math.floor(player.pos[0]) + " Y:" + Math.floor(player.pos[1]) + " Z:" + Math.floor(player.pos[2]) +
          " · Chunks: " + renderer.stats.drawn + "/" + renderer.stats.total;
        frames = 0;
        fpsTimer = 0;
      }
      if (Date.now() - lastSave > AUTOSAVE_MS) saveGame(true);
    } else {
      target = null;
      renderer.render(Mat4.identity(), [], null); // solo el cielo detrás del menú
    }
    requestAnimationFrame(loop);
  }

  // ===== Inicio =====
  applySettings();
  syncSettingsUI();
  updateSaveInfo();
  showScreen("main");
  requestAnimationFrame(loop);
})();