# Minecraft Web — juego de bloques 3D con WebGL

Videojuego de exploración, construcción y supervivencia ligera inspirado en Minecraft, hecho con
**HTML5, CSS3 y JavaScript puro**. Los gráficos 3D usan **WebGL nativo** (sin Three.js ni otras
librerías) y todas las texturas se dibujan con código (Canvas), sin imágenes externas.

## Cómo ejecutarlo (Windows)

1. Descomprime la carpeta `minecraft-web`.
2. Haz doble clic en `index.html` (Chrome, Edge o Firefox actualizados).
3. Pulsa **Jugar**. No necesita instalar nada ni Node.js.

> Mantén juntos `index.html`, `style.css` y la carpeta `js/`. Si el juego se ve sin formato,
> falta `style.css` junto a `index.html`. Tras actualizar archivos, recarga con **Ctrl+F5**.

## Controles

| Acción | Tecla |
|---|---|
| Moverse | W A S D |
| Mirar | Ratón |
| Saltar | Espacio |
| Destruir bloque | Clic izquierdo |
| Colocar bloque | Clic derecho |
| Elegir bloque de la barra | 1–9 o rueda del ratón |
| Inventario | E |
| Volar / caminar (modo prueba) | F (Espacio sube, Shift baja) |
| Pausa y menú | Esc |

## Características

- Mundo 3D en primera persona, **infinito**, generado con ruido procedural: césped, tierra, piedra, arena, madera y hojas.
- **Árboles** distribuidos por el terreno, con tronco y copa.
- Movimiento con **gravedad, salto y colisiones**.
- **Destruir y colocar bloques**; no se puede colocar un bloque dentro del jugador.
- **Inventario** de 36 huecos y barra de acceso rápido de 9; los bloques destruidos se recogen (pilas de hasta 64).
- **Menú principal** (Jugar, Crear mundo con semilla, Configuración), **menú de pausa** y contador de FPS opcional.
- **Guardado en LocalStorage** (manual, automático cada 30 s y al cerrar la pestaña).
- Iluminación simple por cara, niebla y cielo.

## Estructura del proyecto

```
minecraft-web/
├── index.html        Estructura de la página y los menús
├── style.css         Estilos de menús, barra e inventario
├── README.md
└── js/
    ├── main.js       Bucle del juego, menús, entrada del ratón y teclado
    ├── renderer.js   WebGL: shaders, texturas, matrices, dibujo y recorte de pantalla
    ├── world.js      Terreno, árboles, chunks, rayos y mallas
    ├── player.js     Cámara, gravedad, salto y colisiones
    ├── blocks.js     Tipos de bloque y sus texturas
    ├── inventory.js  Inventario y barra de acceso rápido
    └── storage.js    Guardado/carga con LocalStorage y configuración
```

## Cómo funciona

- **Render WebGL**: la geometría se sube a la GPU como buffers; dos shaders pequeños dibujan cada
  vértice (posición × matriz de cámara) y cada píxel (textura × brillo de la cara × niebla). El filtro
  `NEAREST` da el aspecto pixelado.
- **Chunks**: el mundo se divide en bloques de 16×48×16. Cada chunk se convierte en **una sola malla**
  (un solo dibujo por chunk) en lugar de miles de cubos.
- **Solo caras visibles**: al construir la malla se omite toda cara que toque otro bloque sólido.
- **Rendimiento**: los chunks se crean y dibujan según la distancia al jugador, se reparten en el
  tiempo (máx. 8 ms por fotograma), no se dibujan los que están fuera de la pantalla (*frustum culling*)
  y se libera la memoria de los lejanos que no cambiaron.
- **Árboles entre chunks**: la posición de cada árbol depende solo de sus coordenadas, así un árbol
  en el borde de dos chunks sale completo.
- **Colisiones**: la caja del jugador (0.6×1.8) se mueve eje por eje en pasos pequeños.
- **Apuntar**: un rayo recorre la cuadrícula de bloques (algoritmo DDA) para saber qué bloque y qué cara miras.
- **Guardado**: solo se guardan la semilla, la posición, el inventario y los chunks modificados
  (comprimidos con RLE + base64); lo demás se regenera desde la semilla.

## Pruebas realizadas

- 24 000 fotogramas de movimiento aleatorio con saltos, vuelo y fotogramas lentos: el jugador nunca queda dentro de un bloque.
- 3 000 acciones aleatorias de construir/destruir: el jugador nunca queda atrapado.
- Comparación del mallador optimizado contra la versión anterior: mismas caras, incluidos los bordes de chunk.
- Guardar → cargar: los bloques, el inventario y la posición quedan idénticos; guardados dañados no rompen el juego.
- Descargar y regenerar chunks lejanos da exactamente el mismo mundo.
- Comprobación del recorte de pantalla (frustum) y del flujo completo de menús.

## Limitaciones conocidas

- Las hojas son opacas y no hay agua, cuevas ni enemigos.
- LocalStorage tiene un límite (~5 MB): si se llena, el juego avisa al guardar.
- Una distancia de dibujado alta (7–8) puede bajar los FPS en equipos modestos.

## Ideas para mejorar

Oclusión ambiental (sombras suaves en las esquinas), ciclo de día y noche, agua, cuevas, herramientas
con durabilidad, crafteo, sonidos con Web Audio y carga de chunks en un Web Worker.

## Solución de problemas

- **Pantalla pequeña o sin formato**: falta `style.css` junto a `index.html`.
- **Pantalla azul sin menú**: abre la consola (F12) y revisa el mensaje; comprueba que existan todos los `.js`.
- **Mensaje de WebGL**: actualiza el navegador o los controladores de la tarjeta gráfica.
- **El ratón no se captura**: haz clic en «Continuar»; si acabas de pulsar Esc, espera un segundo.