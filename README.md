# Guerra Mundial Z · Atlas interactivo

Atlas web del mundo de *Guerra Mundial Z* (Max Brooks). Cada narración del libro está conectada con sus lugares, personajes, acontecimientos y fases de la guerra, y el mapa funciona como mecanismo de navegación.

La web **no reproduce el texto del libro**: solo contiene resúmenes propios, datos geográficos y relaciones entre elementos.

## Objetivo

Poder responder preguntas como:

- ¿Dónde ocurrió este acontecimiento?
- ¿Qué lugares aparecen en esta narración y en qué orden?
- ¿Qué otras narraciones pasan por este lugar?
- ¿Qué estaba ocurriendo en el mundo durante una fase concreta de la guerra?
- ¿Qué conecta a dos narraciones que se leen por separado?

## Tecnologías

- HTML5, CSS3 y JavaScript con módulos nativos. Sin frameworks ni paso de compilación.
- [Leaflet 1.9.4](https://leafletjs.com), copiado en `vendor/leaflet/` (licencia BSD-2).
- Teselas de [OpenStreetMap](https://www.openstreetmap.org/copyright), oscurecidas con un filtro CSS.
- Contornos de países de [Natural Earth](https://www.naturalearthdata.com) (dominio público), escala 1:110m.
- Tipografía IBM Plex desde Google Fonts. Si no carga, se usan las fuentes del sistema.

## Temas de color

El atlas tiene dos temas: **Impreso** (papel envejecido, el predeterminado) y **Oscuro**. El botón de la barra superior cambia entre ellos y el navegador recuerda la elección.

- Todos los colores están en `css/base.css`: el bloque `:root` es el tema impreso y `:root[data-theme="dark"]` el oscuro.
- El tono del mapa de OpenStreetMap se ajusta con la variable `--tiles-filter`.
- Los colores de los marcadores por tipo están en `config.json › typeGroups` (`color` para el impreso, `colorDark` para el oscuro).

## Estructura de carpetas

```
/
├── index.html              portada
├── atlas.html              la aplicación
├── css/
│   ├── base.css            colores, tipografía, reset
│   ├── layout.css          tres zonas y versión móvil
│   ├── map.css             marcadores, etiquetas, popups, leyenda
│   └── components.css      buscador, fases, listas, filtros, fichas, portada
├── js/
│   ├── main.js             arranque: carga, valida y monta las vistas
│   ├── state.js            selección, fase y filtros activos
│   ├── router.js           la selección vive en la URL (#/lugar/loc-qingdao)
│   ├── data/
│   │   ├── loader.js       descarga los JSON
│   │   ├── validate.js     avisa de IDs inexistentes o repetidos
│   │   ├── store.js        índices y relaciones inversas
│   │   └── query.js        decide qué dibuja el mapa en cada modo
│   ├── map/
│   │   ├── map.js          mapa, capas y encuadre
│   │   ├── choropleth.js   países pintados por intensidad o por narración
│   │   ├── markers.js      marcadores con emoji y ventanas emergentes
│   │   └── legend.js       leyenda
│   ├── ui/
│   │   ├── nav.js          pestañas y listas
│   │   ├── panel.js        fichas de cada entidad
│   │   ├── search.js       buscador global
│   │   ├── filters.js      filtros combinables
│   │   ├── phases.js       selector de fases
│   │   └── theme.js        botón de tema impreso / oscuro
│   └── utils/text.js       plantillas HTML seguras y búsqueda sin tildes
├── data/                   TODO el contenido del atlas
│   ├── config.json         tipos de lugar, emojis, colores, categorías, secciones
│   ├── phases.json         fases de la cronología
│   ├── narratives.json
│   ├── characters.json
│   ├── locations.json
│   ├── regions.json        zonas que no son un país (Siberia, Amazonas…)
│   └── events.json
├── geo/countries.geojson   contornos de países (código ISO de 3 letras)
├── vendor/leaflet/
├── assets/favicon.svg
└── vercel.json
```

La lógica (`js/`) decide **cómo** se muestran los datos; los JSON (`data/`) deciden **qué** datos existen. Para añadir contenido nunca hace falta tocar el JavaScript.

## Ejecutarlo en local

El navegador no deja leer JSON si abres `atlas.html` con doble clic, así que hace falta un servidor sencillo. Desde la carpeta del proyecto:

```bash
python3 -m http.server 8000
# o bien
npx serve .
```

Luego abre <http://localhost:8000>.

## Conceptos clave

**Fiabilidad de cada dato.** Todos los registros llevan:

| Campo | Valores | Para qué sirve |
| --- | --- | --- |
| `status` | `confirmado`, `aproximado`, `pendiente` | La ficha muestra una etiqueta si no está confirmado |
| `pending` | lista de campos, p. ej. `["summary"]` | Esos campos aparecen como «pendiente» |
| `demo` | `true` (opcional) | Marca el registro con la etiqueta DEMO |
| `source.section` | sección del libro | Para poder revisar el dato |

**Precisión de un lugar** (`precision`):

| Valor | En el mapa |
| --- | --- |
| `exact` | Círculo con borde continuo |
| `approximate` | Borde discontinuo y un halo alrededor |
| `regional` | Solo una etiqueta de texto (típico de océanos) |
| `mobile` | Barco o submarino: sin punto propio; su emoji aparece en las paradas numeradas |
| `none` | No aparece en el mapa (p. ej. la Estación Espacial) |

**Coordenadas.** Nunca se sacan del libro: son las de lugares reales en un nomenclátor. Si el libro no precisa el sitio, se marca la localidad más cercana con `approximate`.

**Narraciones sin ubicación.** Si una narración no tiene ningún lugar con coordenadas ni países en `countries`, la app la detecta sola: no pinta nada, muestra un aviso y la lista en el grupo «Sin ubicación definida».

**Intensidad del mapa.** Cada país se oscurece según cuántas narraciones tienen ahí un lugar (o lo citan en `countries`). Las regiones **no suman**: se indican aparte al pasar el cursor. Los umbrales están en `config.json › map.intensitySteps`.

## Cómo agregar una narración

1. Crea los personajes, lugares y acontecimientos que necesite (ver secciones siguientes).
2. Añade un objeto a `data/narratives.json`:

```json
{
  "id": "nar-apellido-tema",
  "title": "Encabezado de lugar tal como aparece en el libro",
  "bookSection": "gran-panico",
  "bookOrder": 14,
  "narratorIds": ["per-nombre"],
  "mentionedCharacterIds": [],
  "interview": { "locationId": "loc-lugar-entrevista" },
  "places": [
    { "ref": "loc-primera-parada", "order": 1 },
    { "ref": "loc-segunda-parada", "order": 2 },
    { "ref": "reg-siberia" },
    { "ref": "loc-lugar-sin-orden" }
  ],
  "countries": [],
  "vesselId": null,
  "eventIds": ["evt-algo"],
  "categories": ["civil", "supervivencia"],
  "tags": ["etiqueta"],
  "summary": null,
  "context": null,
  "epilogue": null,
  "status": "confirmado",
  "pending": ["summary", "context"],
  "source": { "section": "El Gran Pánico" }
}
```

- `bookSection`: uno de los `id` de `config.json › bookSections`.
- `bookOrder`: posición de la entrevista en el libro (1 a 45); ordena las listas.
- `places`: solo los sitios donde **ocurre** la acción. Pon `order` únicamente si el libro deja claro el orden.
- `countries`: códigos ISO de países mencionados sin un lugar más concreto (`["ESP"]`).
- `vesselId`: si hay un barco o submarino, su lugar de tipo `barco` o `submarino`.
- `epilogue`: la despedida del narrador, si tiene: `{ "interviewLocationId": "loc-…", "summary": null }`.

## Cómo agregar un lugar

Añade un objeto a `data/locations.json`:

```json
{
  "id": "loc-nombre",
  "name": "Nombre visible",
  "bookName": "Cómo aparece escrito en el libro",
  "type": "ciudad",
  "emoji": null,
  "coords": [40.4168, -3.7038],
  "precision": "exact",
  "country": "ESP",
  "description": "Qué ocurre aquí.",
  "status": "confirmado"
}
```

- `type`: una clave de `config.json › locationTypes` (define emoji por defecto y color).
- `emoji`: `null` usa el del tipo; pon uno propio para destacarlo (`"⛩️"`). Evita las banderas: en Windows se ven como letras.
- `coords`: `[latitud, longitud]`, o `null` si no tiene lugar fijo.
- Para un océano usa `"type": "oceano"`, `"precision": "regional"`, `"country": null` y un `"label"` como «Sucede en el océano Índico».
- Para una **región** que no es un país (Siberia, Himalayas) usa `data/regions.json`:

```json
{
  "id": "reg-siberia",
  "name": "Siberia",
  "countries": ["RUS"],
  "labelCoords": [62, 100],
  "note": "Esto ocurre en Siberia.",
  "status": "confirmado"
}
```

## Cómo agregar un acontecimiento

Añade un objeto a `data/events.json` y su `id` al `eventIds` de las narraciones donde aparece:

```json
{
  "id": "evt-nombre",
  "name": "Nombre del acontecimiento",
  "category": "conflicto",
  "phaseId": "fase-gran-panico",
  "timeNote": "Referencia temporal tal como la da el libro",
  "places": [{ "ref": "loc-lugar" }],
  "characterIds": ["per-nombre"],
  "description": "Una frase propia.",
  "status": "confirmado",
  "pending": []
}
```

- `category`: una clave de `config.json › eventCategories`.
- `phaseId`: una fase de `phases.json`, o `null` si el libro no permite saberla (aparece como «Fase sin determinar»).
- `timeNote`: nunca una fecha inventada; copia la referencia relativa del libro («dos semanas después de Yonkers»).

## Cómo agregar una ruta

Las rutas no se dibujan como líneas. Un recorrido es simplemente el orden de los lugares de una narración:

1. Crea cada parada en `locations.json` (o `regions.json`).
2. En la narración, dales `order` 1, 2, 3… dentro de `places`. El mapa las numera.
3. Si el recorrido lo hace un barco o submarino, crea un lugar de tipo `barco`/`submarino` con `"precision": "mobile"` y `"coords": null`, y ponlo en `vesselId`. Sus paradas mostrarán su emoji.

## Cómo agregar un personaje

```json
{
  "id": "per-nombre",
  "name": "Nombre",
  "nationality": "País",
  "role": "Cargo o profesión",
  "description": null,
  "status": "confirmado",
  "pending": ["description"]
}
```

Sus narraciones, lugares y acontecimientos no se escriben aquí: se calculan a partir de las narraciones y los acontecimientos.

## Comprobar los datos

Al cargar, `validate.js` revisa que cada ID referenciado exista y no esté repetido. Los problemas aparecen en la consola del navegador y en la ficha inicial del atlas («avisos en los datos»). Un error de sintaxis en un JSON muestra una pantalla que indica qué archivo falla.

## Desplegar en Vercel

1. Sube la carpeta a un repositorio de GitHub.
2. En [vercel.com](https://vercel.com), **Add New › Project** e importa el repositorio.
3. Framework preset: **Other**. Deja vacíos el comando de build y el directorio de salida.
4. Pulsa **Deploy**. Cada `git push` a la rama principal publica una versión nueva.

`vercel.json` activa URLs limpias (`/atlas`) y evita que los JSON de `data/` queden en caché, para que los cambios de contenido se vean al momento.

## Contenido actual

El atlas contiene **todo el libro**: las 45 narraciones en el orden de sus secciones, con resumen y contexto propios, y las 13 despedidas integradas como epílogo de la narración original.

| Datos | Cantidad |
| --- | --- |
| Narraciones | 45 |
| Personajes (solo los relevantes) | 58 |
| Lugares | 131 |
| Regiones | 6 |
| Acontecimientos | 68 |

**Spoilers.** Los resúmenes y las despedidas aparecen difuminados hasta que el lector pulsa «Mostrar resumen». Lo que se desvela solo se recuerda durante la visita. El buscador no indexa los resúmenes, así que tampoco adelanta nada.

**Decisiones que conviene conocer:**

- Las fases de los acontecimientos se deducen del contexto del libro. Cuando la deducción no es segura el acontecimiento lleva `status: "aproximado"`, y si no hay pistas suficientes queda con `phaseId: null` (sale en «Fase sin determinar»).
- Tres narraciones no tienen ubicación en la guerra y se listan aparte: Sharon (Topeka), Terry Knox (Estación Espacial) y el general D'Ambrosia en «Guerra total».
- Tres entrevistas no se sitúan en el mapa porque el libro no da el sitio: el poblado de Siberia del padre Ryzhkov, la granja secreta de André Renard en Quebec y el barco de la despedida de Michael Choi.
- La despedida de Kioto la narra Kondo Tatsumi, así que es el epílogo de su narración (no de la de Tomonaga).
- Emile Renard (agregado naval en Honolulu) y Emil Renard (hermano de André) se guardan como personajes distintos: el libro no confirma que sean la misma persona.

Para revisar qué falta, busca en los JSON los registros con `pending` no vacío o `status` distinto de `confirmado`.

## Créditos

Proyecto personal sin fines comerciales basado en *Guerra Mundial Z* de Max Brooks. Mapa © colaboradores de OpenStreetMap. Contornos de Natural Earth.
