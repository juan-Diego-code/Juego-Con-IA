// main.js - Punto de entrada y bucle del juego (Etapa 1)

(function () {
  const canvas = document.getElementById("gameCanvas");
  const fpsLabel = document.getElementById("fps");
  let renderer;

  try {
    renderer = new Renderer(canvas);
  } catch (e) {
    const box = document.getElementById("error");
    box.textContent = "Error: " + e.message;
    box.hidden = false;
    return;
  }

  let angle = 0;
  let last = performance.now();
  let frames = 0, fpsTimer = 0;

  function loop(now) {
    const dt = (now - last) / 1000;
    last = now;

    // La cámara orbita alrededor del cubo
    angle += dt * 0.8;
    const eye = [Math.cos(angle) * 2.5, 1.5, Math.sin(angle) * 2.5];
    const view = Mat4.lookAt(eye, [0, 0, 0], [0, 1, 0]);
    renderer.render(view);

    // Contador de FPS
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