# Minecraft Web (WebGL nativo)

## Estado: Etapa 2 - Terreno de chunks y cámara en primera persona

### Cómo ejecutarlo en Windows
1. Descarga la carpeta `minecraft-web` y descomprímela si viene en ZIP.
2. Haz doble clic en `index.html` (se abre en Chrome, Edge o Firefox).
3. Opcional: en VS Code instala "Live Server" y pulsa "Go Live".

No necesita Node.js ni instalar nada.

### Cómo comprobar que funciona
- Ves un cubo de césped pixelado (césped arriba, tierra abajo, lados mixtos) y el cielo azul.
- La cámara gira alrededor del cubo y el contador muestra FPS.
- Abre la consola (F12): no debe haber errores en rojo.
- Si aparece un mensaje rojo, tu navegador o GPU no soporta WebGL.

### Etapa 2: qué comprobar
- Al abrir `index.html` aparece "Haz clic para jugar". Haz clic en la pantalla.
- Mueve el ratón para mirar; W/A/S/D para moverte; Espacio sube y Shift baja (vuelo libre temporal).
- Ves colinas de césped, tierra, piedra y arena en las zonas bajas, con caras sombreadas.
- Esc libera el ratón. FPS arriba a la izquierda. Consola (F12) sin errores.
- El cubo de la etapa 1 sigue disponible: `renderer.render(view)` sin lista de mallas lo dibuja.