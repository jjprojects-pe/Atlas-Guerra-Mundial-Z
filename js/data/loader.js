// Downloads every data file in parallel. Any failure stops the app with a clear message.

const FILES = {
  config: 'data/config.json',
  phases: 'data/phases.json',
  narratives: 'data/narratives.json',
  characters: 'data/characters.json',
  locations: 'data/locations.json',
  regions: 'data/regions.json',
  events: 'data/events.json',
  countries: 'geo/countries.geojson',
};

export class DataLoadError extends Error {
  constructor(message, file) {
    super(message);
    this.file = file;
  }
}

async function fetchJson(key, path) {
  let response;
  try {
    response = await fetch(path, { cache: 'no-cache' });
  } catch {
    throw new DataLoadError(`No se pudo descargar ${path}.`, path);
  }
  if (!response.ok) {
    throw new DataLoadError(`${path} respondió con el código ${response.status}.`, path);
  }
  try {
    return [key, await response.json()];
  } catch {
    throw new DataLoadError(`${path} no es un JSON válido. Revisa comas y comillas.`, path);
  }
}

export async function loadAll() {
  if (location.protocol === 'file:') {
    throw new DataLoadError(
      'El atlas no puede leer sus datos abriendo el archivo con doble clic. Arráncalo con un servidor local (ver README).',
      null,
    );
  }
  const entries = await Promise.all(Object.entries(FILES).map(([key, path]) => fetchJson(key, path)));
  return Object.fromEntries(entries);
}
