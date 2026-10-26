# Minecraft Web (WebGL nativo)

## Estado: Etapa 5 - Inventario y barra de acceso rápido

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

### Etapa 3: qué comprobar
- Caes al suelo al empezar y ya no atraviesas el terreno.
- W/A/S/D caminan; Espacio salta (puedes subir bloques de 1 de alto, no de 2).
- Chocas contra paredes de bloques y no puedes salir del mundo (los bordes son muros).
- F activa/desactiva el vuelo (Espacio sube, Shift baja); en vuelo también hay colisiones.
- Las etapas 1 y 2 siguen funcionando: cubo (`renderer.render(view)`) y terreno por chunks.

### Etapa 4: qué comprobar
- Al apuntar a un bloque (hasta 6 de distancia) aparece un contorno negro.
- Clic izquierdo lo destruye; clic derecho coloca el bloque seleccionado en la cara que miras.
- Teclas 1-4 cambian el bloque (césped, tierra, piedra, arena); el nombre aparece abajo.
- No puedes colocar un bloque donde estás parado (haz la prueba mirando tus pies).
- El bloque del fondo del mundo (y=0) no se puede destruir.
- Etapas 1 a 3 siguen funcionando. Todavía no se recogen bloques: eso llega con el inventario (etapa 5).

### Etapa 5: qué comprobar
- Empiezas con las manos vacías: destruye bloques y aparecen en la barra de abajo (se apilan hasta 64).
- Teclas 1-9 o rueda del ratón cambian el hueco activo (borde blanco); su nombre aparece unos segundos.
- Clic derecho coloca el bloque activo y gasta uno; con el hueco vacío no coloca nada.
- E abre el inventario (36 huecos). Clic coge una pila, clic en otro hueco la suelta, junta o intercambia. E o Esc lo cierra.
- Si la pantalla no ocupa toda la ventana: asegúrate de que `style.css` esté en la misma carpeta que `index.html` y recarga con Ctrl+F5.