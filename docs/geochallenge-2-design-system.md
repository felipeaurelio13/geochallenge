# GeoChallenge 2: sistema visual

## Principio

El mundo es la interfaz. Las superficies ordenan; las banderas, mapas, siluetas, lugares y progreso aportan identidad. Cada pantalla deja una acción principal visible y elimina la decoración que no entrega estado ni contexto.

## Color

Los tokens semánticos son la única fuente de color para UI:

- `--color-bg-app`: fondo de lectura.
- `--color-bg-shell`: marco del producto.
- `--color-surface` y `--color-surface-muted`: dos planos de contenido.
- `--color-primary-*`: verde azulado GeoChallenge para navegación y acción.
- `--color-success-*`, `--color-error-*` y `--color-warning-*`: feedback funcional.
- `--color-text-primary`, `--color-text-secondary` y `--color-text-muted`: jerarquía tipográfica.

El tema oscuro se define de forma explícita, no por inversión. Los fondos cálidos claros pasan a verdes muy oscuros; texto, bordes y feedback mantienen contraste. Las banderas conservan un contenedor neutro.

## Tipografía y espaciado

La UI usa la pila del sistema. La escala de lectura se limita a texto auxiliar, cuerpo, título de sección y título de pantalla. La escala de espacio usa incrementos de 4 px, con 8, 12, 16, 20, 24, 32 y 48 px como decisiones habituales. `clamp` solo se usa en game shells que deben acomodar altura dinámica.

## Superficies, radios y elevación

Hay tres radios: 8 px para controles, 12 px para bloques y 16 px para áreas protagonistas. Los aliases mayores se mantienen solo para compatibilidad de clases heredadas y mapean al radio grande. Las superficies se separan principalmente por color; el único nivel de elevación es una sombra corta y suave para un modal o una bandeja fija.

## Controles

- Primary: fondo GeoChallenge, texto blanco, mínimo táctil de 48 px.
- Secondary: superficie secundaria con borde sobrio.
- Quiet/icon: transparente hasta hover o focus.
- Answer: índice estable, etiqueta y estado legible. Correcta e incorrecta muestran símbolo además de color; eliminada usa tachado; bloqueada reduce énfasis.

## Iconografía y marca

La marca `GeoMark` es un SVG propio: un meridiano abierto que forma una G y una coordenada central. Se usa en favicon, headers, home y auth. Los iconos de interfaz son trazos SVG simples. No se añaden dependencias ni una librería de iconos.

## Motion

Tap: 80 ms. Selección y feedback: 140–180 ms. Cambio de pregunta: 180 ms. Hitos y resultados: hasta 240 ms. Las transiciones informan una selección, respuesta o cambio de estado; no bloquean la interacción. `prefers-reduced-motion` reduce duración y elimina repetición.

## Responsive y accesibilidad

El diseño parte en iPhone SE. `100dvh`, safe areas, grilla de cuatro alternativas y bandeja en flujo son contratos de gameplay. No se usa scroll horizontal. Los focos visibles tienen 2 px de color principal; los targets interactivos tienen 44 px o más. Las combinaciones success/error se comunican con icono, texto y color.

## Migración

Los primitives compartidos se actualizan antes que páginas específicas. Una ruta no debe crear nuevos tokens ni una variante visual equivalente. Las pantallas de meta game consumen las mismas superficies y botones cuando se migren.
