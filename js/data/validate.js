// Checks referential integrity. Problems are reported, never thrown, so one bad record
// cannot take the whole atlas down.

export function validate(data) {
  const issues = [];
  const ids = new Map();

  const register = (list, file) => {
    for (const item of list) {
      if (!item.id) {
        issues.push(`${file}: hay un registro sin "id".`);
        continue;
      }
      if (ids.has(item.id)) issues.push(`${file}: el id "${item.id}" está repetido (ya existe en ${ids.get(item.id)}).`);
      ids.set(item.id, file);
    }
  };

  register(data.narratives, 'narratives.json');
  register(data.characters, 'characters.json');
  register(data.locations, 'locations.json');
  register(data.regions, 'regions.json');
  register(data.events, 'events.json');
  register(data.phases, 'phases.json');

  const isoCodes = new Set(data.countries.features.map((f) => f.properties.iso));
  const types = data.config.locationTypes;

  const expect = (id, prefix, where) => {
    if (id == null) return;
    if (!ids.has(id) || !id.startsWith(prefix)) issues.push(`${where}: la referencia "${id}" no existe.`);
  };
  const expectPlace = (ref, where) => {
    if (!ref || !(ref.startsWith('loc-') || ref.startsWith('reg-')) || !ids.has(ref)) {
      issues.push(`${where}: el lugar o región "${ref}" no existe.`);
    }
  };
  const expectCountry = (iso, where) => {
    if (iso && !isoCodes.has(iso)) issues.push(`${where}: el país "${iso}" no está en countries.geojson (no se pintará).`);
  };

  for (const n of data.narratives) {
    const where = `Narración ${n.id}`;
    if (!n.title) issues.push(`${where}: falta el título.`);
    (n.narratorIds || []).forEach((id) => expect(id, 'per-', where));
    (n.mentionedCharacterIds || []).forEach((id) => expect(id, 'per-', where));
    (n.eventIds || []).forEach((id) => expect(id, 'evt-', where));
    (n.places || []).forEach((p) => expectPlace(p.ref, where));
    (n.countries || []).forEach((iso) => expectCountry(iso, where));
    expect(n.interview?.locationId, 'loc-', where);
    expect(n.vesselId, 'loc-', where);
    expect(n.epilogue?.interviewLocationId, 'loc-', where);
  }

  for (const e of data.events) {
    const where = `Acontecimiento ${e.id}`;
    expect(e.phaseId, 'fase-', where);
    (e.characterIds || []).forEach((id) => expect(id, 'per-', where));
    (e.places || []).forEach((p) => expectPlace(p.ref, where));
    (e.countries || []).forEach((iso) => expectCountry(iso, where));
    if (e.category && !data.config.eventCategories[e.category]) issues.push(`${where}: categoría "${e.category}" desconocida.`);
  }

  for (const l of data.locations) {
    const where = `Lugar ${l.id}`;
    if (!types[l.type]) issues.push(`${where}: tipo "${l.type}" no definido en config.json.`);
    if (l.coords && (l.coords.length !== 2 || l.coords.some((c) => typeof c !== 'number'))) {
      issues.push(`${where}: "coords" debe ser [latitud, longitud].`);
    }
    // A location's country may be missing from the simplified map (small islands);
    // the marker still shows, only the country is not painted, so it is not reported.
  }

  for (const r of data.regions) {
    (r.countries || []).forEach((iso) => expectCountry(iso, `Región ${r.id}`));
  }

  return issues;
}
