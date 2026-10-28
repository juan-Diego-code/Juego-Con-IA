// main.js - Punto de entrada: menús, modos de juego, minería, crafteo y bucle principal (Etapa 9)

(function () {
  const $ = id => document.getElementById(id);
  const canvas = $("gameCanvas"), hud = $("hud"), fpsLabel = $("fps"), posLabel = $("pos");
  const modeLabel = $("modeLabel"), blockLabel = $("blockLabel"), toastEl = $("toast");
  const inventoryEl = $("inventory"), creativeEl = $("creativeMenu");
  const mineBar = $("mineBar"), mineFill = $("mineFill");
  const screens = { main: $("mainMenu"), create: $("createMenu"), settings: $("settingsMenu"), pause: $("pauseMenu") };
  const REACH = 6;            // alcance en bloques
  const AUTOSAVE_MS = 30000;  // autoguardado cada 30 s
  const MODE_NAMES = { survival: "Supervivencia", creative: "Creativo" };
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
  let gameMode = "survival";   // "survival" o "creative"
  let inventoryOpen = false, openPanel = null, atTable = false;
  let labelTimer = 0, toastTimer = null, lastSave = Date.now();
  let target = null;           // bloque que miramos
  let leftHeld = false, mining = null, breakCooldown = 0; // minería (clic izquierdo mantenido)

  // Chunks dibujados
  const chunkMeshes = new Map(); // clave -> {cx, cz, mesh}
  let meshList = [], meshListDirty = true, pending = [], lastCX = null, lastCZ = null;

  // Jugador, inventario e interfaz: se crean una sola vez y se reinician al empezar una partida
  const player = new Player(canvas, null, 0, 0, 0);
  const inventory = new Inventory();
  const atlas = createAtlasCanvas();
  const ui = new InventoryUI(inventory, atlas, recipe => craftRecipe(recipe));
  new CreativeUI(inventory, atlas, ui);

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

  // ===== Modo de juego =====
  function setMode(mode) {
    gameMode = mode;
    player.canFly = mode === "creative";         // solo en creativo se puede volar
    if (!player.canFly) player.flying = false;
    ui.showCounts = mode === "survival";         // en creativo no se muestran cantidades
    modeLabel.textContent = MODE_NAMES[mode];
    $("btnMode").textContent = "Modo: " + MODE_NAMES[mode];
    leftHeld = false; mining = null; mineBar.hidden = true;
    ui.render();
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
    leftHeld = false; mining = null; mineBar.hidden = true;
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
      mode: gameMode,
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

  function closePanels() {
    inventoryOpen = false;
    atTable = false;
    ui.atTable = false;
    openPanel = null;
    inventoryEl.hidden = true;
    creativeEl.hidden = true;
  }

  function startGame(seed, saved, mode) {
    clearMeshes();
    closePanels();
    world = new World(seed);
    setMode(saved ? saved.mode : mode); // antes de colocar al jugador (define si puede volar)
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
    closePanels();
    blockLabel.hidden = true;
    mineBar.hidden = true;
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
    startGame(GameStorage.parseSeed(""), null, "survival");
  });
  $("btnCreate").addEventListener("click", () => { $("seedInput").value = ""; showScreen("create"); });
  $("btnCreateBack").addEventListener("click", () => showScreen("main"));
  $("btnCreateGo").addEventListener("click", () => {
    if (GameStorage.getSaveInfo() && !confirm("Ya existe un mundo guardado. ¿Quieres reemplazarlo por uno nuevo?")) return;
    GameStorage.deleteGame();
    startGame(GameStorage.parseSeed($("seedInput").value), null, $("modeSelect").value === "creative" ? "creative" : "survival");
  });
  $("btnSettings").addEventListener("click", () => { settingsReturn = "main"; syncSettingsUI(); showScreen("settings"); });
  $("btnPauseSettings").addEventListener("click", () => { settingsReturn = "pause"; syncSettingsUI(); showScreen("settings"); });
  $("btnSettingsBack").addEventListener("click", () => showScreen(settingsReturn));
  $("btnResume").addEventListener("click", requestLock);
  $("btnMode").addEventListener("click", () => {
    setMode(gameMode === "survival" ? "creative" : "survival");
    toast("Modo " + MODE_NAMES[gameMode]);
  });
  $("btnSave").addEventListener("click", () => saveGame(false));
  $("btnExit").addEventListener("click", goToMainMenu);

  // Autoguardado y guardado al cerrar la pestaña
  window.addEventListener("beforeunload", () => saveGame(true));
  document.addEventListener("visibilitychange", () => { if (document.hidden) saveGame(true); });

  // ===== Inventario, menú creativo y crafteo =====
  function showSelectedName() {
    const s = inventory.getSelected();
    blockLabel.textContent = s ? Items.name(s.id) : "";
    blockLabel.hidden = !s;
    labelTimer = 2; // se oculta a los 2 segundos
  }

  function selectSlot(i) {
    inventory.selected = (i + HOTBAR_SIZE) % HOTBAR_SIZE;
    ui.render();
    showSelectedName();
  }

  // table = true: se abre desde una mesa de crafteo (siempre muestra el inventario con recetas)
  function openInventory(table) {
    atTable = !!table;
    ui.atTable = atTable;
    openPanel = (gameMode === "creative" && !table) ? creativeEl : inventoryEl;
    $("invTitle").textContent = atTable ? "Mesa de crafteo" : "Inventario";
    ui.render();
    openPanel.hidden = false;
    inventoryOpen = true;
    document.exitPointerLock();
  }

  function closeInventory() {
    closePanels();
    ui.returnCursor();
    showSelectedName();
    requestLock();
  }

  function toggleInventory() { if (inventoryOpen) closeInventory(); else openInventory(false); }

  function craftRecipe(recipe) {
    const result = Crafting.craft(inventory, recipe, atTable);
    if (result === "ok") { ui.render(); showSelectedName(); }
    else if (result === "table") toast("Necesitas una mesa de crafteo");
    else if (result === "missing") toast("Faltan materiales");
    else if (result === "full") toast("Inventario lleno");
  }

  document.addEventListener("keydown", e => {
    if (state !== "playing") return;
    if (e.code === "KeyE" && (player.locked || inventoryOpen)) { toggleInventory(); return; }
    if (e.code === "Escape" && inventoryOpen) { closeInventory(); return; }
    if (!player.locked) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) selectSlot(n - 1);
  });
  document.addEventListener("wheel", e => {
    if (state === "playing" && player.locked) selectSlot(inventory.selected + (e.deltaY > 0 ? 1 : -1));
  });
  creativeEl.addEventListener("contextmenu", e => e.preventDefault());
  inventoryEl.addEventListener("contextmenu", e => e.preventDefault());
  canvas.addEventListener("contextmenu", e => e.preventDefault());

  // ===== Romper y colocar bloques =====
  function applyChange(x, y, z, id) {
    const dirty = world.setBlock(x, y, z, id);
    if (!dirty) return;
    for (const [cx, cz] of dirty) rebuildChunk(cx, cz);
  }

  // Rompe el bloque apuntado. En supervivencia se recoge; en creativo desaparece sin más.
  function breakBlock(t) {
    if (t.y === 0) return false; // y=0 es el fondo del mundo
    const id = world.getBlock(t.x, t.y, t.z);
    if (id === Blocks.AIR) return false;
    applyChange(t.x, t.y, t.z, Blocks.AIR);
    if (gameMode === "survival") {
      if (inventory.add(id) > 0) toast("Inventario lleno");
      ui.render();
    }
    return true;
  }

  function placeBlock(t) {
    const tid = world.getBlock(t.x, t.y, t.z);
    // Clic derecho sobre una mesa de crafteo la abre (con Shift se coloca un bloque a su lado)
    if (tid === Blocks.CRAFTING_TABLE && !player.keys.ShiftLeft) { openInventory(true); return; }
    const item = inventory.getSelected();
    if (!item || !Items.isBlock(item.id)) return; // hueco vacío o herramienta
    const n = t.normal;
    if (n[0] === 0 && n[1] === 0 && n[2] === 0) return;
    const bx = t.x + n[0], by = t.y + n[1], bz = t.z + n[2];
    if (Blocks.isSolid(world.getBlock(bx, by, bz))) return;
    if (player.intersectsBlock(bx, by, bz)) return; // no colocar dentro del jugador
    applyChange(bx, by, bz, item.id);
    if (gameMode === "survival") { inventory.consumeSelected(); ui.render(); } // en creativo es infinito
  }

  document.addEventListener("mousedown", e => {
    if (state !== "playing" || !player.locked) return;
    if (e.button === 0) {
      leftHeld = true;
      if (gameMode === "creative" && target) { breakBlock(target); breakCooldown = 0.25; }
    } else if (e.button === 2 && target) {
      placeBlock(target);
    }
  });
  document.addEventListener("mouseup", e => {
    if (e.button === 0) { leftHeld = false; mining = null; mineBar.hidden = true; }
  });

  // Minería mantenida. Creativo: un bloque cada 0.25 s. Supervivencia: hay que mantener el clic
  // el tiempo que tarde ese bloque con la herramienta que llevas (ver Items.breakTime).
  function updateMining(dt) {
    if (!leftHeld || !target) { mining = null; mineBar.hidden = true; return; }
    if (gameMode === "creative") {
      breakCooldown -= dt;
      if (breakCooldown <= 0) { breakBlock(target); breakCooldown = 0.25; }
      return;
    }
    if (target.y === 0) { mining = null; mineBar.hidden = true; return; }
    if (!mining || mining.x !== target.x || mining.y !== target.y || mining.z !== target.z)
      mining = { x: target.x, y: target.y, z: target.z, t: 0 };
    const id = world.getBlock(target.x, target.y, target.z);
    if (id === Blocks.AIR) { mining = null; return; }
    const held = inventory.getSelected();
    mining.t += dt / Items.breakTime(id, held ? held.id : 0);
    mineBar.hidden = false;
    mineFill.style.width = Math.min(100, mining.t * 100) + "%";
    if (mining.t >= 1) { breakBlock(target); mining = null; mineBar.hidden = true; }
  }

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
      updateMining(dt);
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
  modeLabel.textContent = MODE_NAMES[gameMode];
  showScreen("main");
  requestAnimationFrame(loop);
})();