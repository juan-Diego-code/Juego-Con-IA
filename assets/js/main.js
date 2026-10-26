// main.js - Punto de entrada y bucle del juego (Etapa 2)

(function () {
  const canvas = document.getElementById("gameCanvas");
  const fpsLabel = document.getElementById("fps");
  const overlay = document.getElementById("overlay");
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
  const meshes = [];
  for (let cx = 0; cx < world.size; cx++) {
    for (let cz = 0; cz < world.size; cz++) {
      const verts = world.buildChunkMesh(cx, cz);
      if (verts.length > 0) meshes.push(renderer.createChunkMesh(verts));
    }
  }

  // ----- Jugador en el centro, sobre el terreno -----
  const sx = Math.floor(world.size * CHUNK_SIZE / 2), sz = sx;
  const player = new Player(canvas, sx + 0.5, world.getSurfaceY(sx, sz) + 4, sz + 0.5);

  // Clic para capturar el ratón (Escape lo libera)
  canvas.addEventListener("click", () => { if (!player.locked) canvas.requestPointerLock(); });
  document.addEventListener("pointerlockchange", () => {
    overlay.hidden = player.locked;
  });

  // ----- Bucle -----
  let last = performance.now(), frames = 0, fpsTimer = 0;
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    player.update(dt);
    renderer.render(player.getViewMatrix(), meshes);

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