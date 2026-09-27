// Builds lookup indexes and every inverse relation from the raw JSON.
// Views only talk to the store, never to the raw files.

import { normalize } from '../utils/text.js';

const PREFIX_KIND = {
  'nar-': 'narrative',
  'per-': 'character',
  'loc-': 'location',
  'reg-': 'region',
  'evt-': 'event',
  'fase-': 'phase',
};

export function kindOf(id) {
  const prefix = Object.keys(PREFIX_KIND).find((p) => String(id).startsWith(p));
  return prefix ? PREFIX_KIND[prefix] : null;
}

const pushTo = (map, key, value) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
};

const uniqueBy = (list, key = (x) => x) => {
  const seen = new Set();
  return list.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

export function createStore(data) {
  const { config } = data;
  const phases = [...data.phases].sort((a, b) => a.order - b.order);
  const narratives = [...data.narratives].sort((a, b) => (a.bookOrder ?? 999) - (b.bookOrder ?? 999));
  const characters = [...data.characters].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const locations = [...data.locations].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const regions = [...data.regions];
  const events = [...data.events];

  const byId = new Map();
  [narratives, characters, locations, regions, events, phases].forEach((list) => list.forEach((r) => byId.set(r.id, r)));
  const get = (id) => byId.get(id) ?? null;

  const countryNames = new Map(data.countries.features.map((f) => [f.properties.iso, f.properties.name]));
  const countryName = (iso) => config.extraCountryNames?.[iso] ?? countryNames.get(iso) ?? iso;

  // ---- inverse indexes ------------------------------------------------------
  const narrativesByCharacter = new Map();
  const narrativesByPlace = new Map();
  const narrativesByEvent = new Map();
  const eventsByPlace = new Map();
  const eventsByCharacter = new Map();
  const eventsByPhase = new Map();

  for (const n of narratives) {
    (n.narratorIds || []).forEach((id) => pushTo(narrativesByCharacter, id, { narrative: n, role: 'narrador' }));
    (n.mentionedCharacterIds || []).forEach((id) => pushTo(narrativesByCharacter, id, { narrative: n, role: 'mencionado' }));
    (n.places || []).forEach((p) => pushTo(narrativesByPlace, p.ref, { narrative: n, role: 'escenario', order: p.order ?? null }));
    if (n.interview?.locationId) pushTo(narrativesByPlace, n.interview.locationId, { narrative: n, role: 'entrevista' });
    if (n.epilogue?.interviewLocationId && n.epilogue.interviewLocationId !== n.interview?.locationId) {
      pushTo(narrativesByPlace, n.epilogue.interviewLocationId, { narrative: n, role: 'despedida' });
    }
    if (n.vesselId) pushTo(narrativesByPlace, n.vesselId, { narrative: n, role: 'embarcación' });
    (n.eventIds || []).forEach((id) => pushTo(narrativesByEvent, id, n));
  }
  for (const e of events) {
    (e.places || []).forEach((p) => pushTo(eventsByPlace, p.ref, e));
    (e.characterIds || []).forEach((id) => pushTo(eventsByCharacter, id, e));
    pushTo(eventsByPhase, e.phaseId ?? null, e);
  }

  // ---- basic helpers --------------------------------------------------------
  const typeInfo = (loc) => {
    const type = config.locationTypes[loc?.type] ?? config.locationTypes.otro;
    const group = config.typeGroups[type.group] ?? { label: '', color: '#999' };
    return { ...type, groupId: type.group, groupLabel: group.label, color: group.color, colorDark: group.colorDark ?? group.color };
  };
  const emojiFor = (loc) => loc?.emoji || typeInfo(loc).emoji;
  const isMappable = (record) => {
    if (!record) return false;
    if (kindOf(record.id) === 'region') return Array.isArray(record.labelCoords);
    return Array.isArray(record.coords);
  };

  const narratorsOf = (n) => (n.narratorIds || []).map(get).filter(Boolean);
  const narratorNames = (n) => narratorsOf(n).map((c) => c.name).join(', ');
  const sectionLabel = (n) => config.bookSections.find((s) => s.id === n.bookSection)?.label ?? '';
  // Titles repeat (several interviews in Denver), so lists always add narrator and book section.
  const narrativeMeta = (n) => [narratorNames(n), sectionLabel(n)].filter(Boolean).join(' · ');
  const eventsOf = (n) => (n.eventIds || []).map(get).filter(Boolean);
  const phaseOf = (e) => (e?.phaseId ? get(e.phaseId) : null);

  const narrativePhases = (n) =>
    uniqueBy(eventsOf(n).map(phaseOf).filter(Boolean), (p) => p.id).sort((a, b) => a.order - b.order);

  const narrativeHasLocation = (n) =>
    (n.countries || []).length > 0 || (n.places || []).some((p) => isMappable(get(p.ref)));

  // Countries of a list of place refs, split into direct (a concrete place or an
  // explicit country) and regional (only known through a region).
  const countriesOfPlaces = (placeRefs, explicit = []) => {
    const direct = new Set(explicit);
    const regional = new Map();
    for (const ref of placeRefs) {
      const record = get(ref);
      if (!record) continue;
      if (kindOf(ref) === 'region') {
        (record.countries || []).forEach((iso) => pushTo(regional, iso, record));
      } else if (record.country && isMappable(record)) {
        direct.add(record.country);
      }
    }
    return { direct, regional };
  };

  const narrativeCountries = (n) => countriesOfPlaces((n.places || []).map((p) => p.ref), n.countries || []);
  const eventCountries = (e) => countriesOfPlaces((e.places || []).map((p) => p.ref), e.countries || []);
  const eventHasLocation = (e) => (e.countries || []).length > 0 || (e.places || []).some((p) => isMappable(get(p.ref)));

  // ---- relations used by the fichas -----------------------------------------
  const narrativesOfCharacter = (id) => narrativesByCharacter.get(id) ?? [];
  const eventsOfCharacter = (id) => eventsByCharacter.get(id) ?? [];
  const narrativesOfPlace = (id) => narrativesByPlace.get(id) ?? [];
  const eventsOfPlace = (id) => eventsByPlace.get(id) ?? [];
  const narrativesOfEvent = (id) => narrativesByEvent.get(id) ?? [];
  const eventsOfPhase = (id) => eventsByPhase.get(id) ?? [];
  const narrativesOfPhase = (id) => narratives.filter((n) => eventsOf(n).some((e) => e.phaseId === id));

  const characterPlaces = (id) => {
    const refs = [];
    for (const { narrative, role } of narrativesOfCharacter(id)) {
      (narrative.places || []).forEach((p) => refs.push(p.ref));
      if (role === 'narrador' && narrative.interview?.locationId) refs.push(narrative.interview.locationId);
    }
    eventsOfCharacter(id).forEach((e) => (e.places || []).forEach((p) => refs.push(p.ref)));
    return uniqueBy(refs).map(get).filter(Boolean);
  };

  const placeCharacters = (id) => {
    const list = [];
    narrativesOfPlace(id).forEach(({ narrative }) => list.push(...narratorsOf(narrative)));
    eventsOfPlace(id).forEach((e) => list.push(...(e.characterIds || []).map(get).filter(Boolean)));
    return uniqueBy(list, (c) => c.id);
  };

  // Other narratives that share a place, a character or an event with `n`.
  const connections = (n) => {
    const shared = new Map();
    const add = (other, item) => {
      if (other.id === n.id) return;
      if (!shared.has(other.id)) shared.set(other.id, { narrative: other, items: [] });
      const entry = shared.get(other.id);
      if (!entry.items.some((i) => i.id === item.id)) entry.items.push(item);
    };
    (n.places || []).forEach((p) => {
      const place = get(p.ref);
      if (!place) return;
      narrativesOfPlace(p.ref)
        .filter((x) => x.role === 'escenario')
        .forEach((x) => add(x.narrative, { id: place.id, label: place.name, kind: kindOf(place.id) }));
    });
    [...(n.narratorIds || []), ...(n.mentionedCharacterIds || [])].forEach((cid) => {
      const person = get(cid);
      if (!person) return;
      narrativesOfCharacter(cid).forEach((x) => add(x.narrative, { id: cid, label: person.name, kind: 'character' }));
    });
    eventsOf(n).forEach((e) => {
      narrativesOfEvent(e.id).forEach((other) => add(other, { id: e.id, label: e.name, kind: 'event' }));
    });
    return [...shared.values()].sort((a, b) => b.items.length - a.items.length);
  };

  // ---- search -----------------------------------------------------------------
  const searchIndex = [
    ...narratives.map((n) => ({
      kind: 'narrative',
      record: n,
      text: normalize([n.title, narratorNames(n), ...(n.tags || [])].join(' ')),
    })),
    ...characters.map((c) => ({ kind: 'character', record: c, text: normalize([c.name, c.role, c.nationality].join(' ')) })),
    ...locations.map((l) => ({
      kind: 'location',
      record: l,
      text: normalize([l.name, l.bookName, countryName(l.country), typeInfo(l).label].join(' ')),
    })),
    ...regions.map((r) => ({ kind: 'region', record: r, text: normalize([r.name, r.bookName, ...(r.countries || []).map(countryName)].join(' ')) })),
    ...events.map((e) => ({ kind: 'event', record: e, text: normalize([e.name, e.description].join(' ')) })),
  ];

  const search = (query) => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return searchIndex.filter((entry) => terms.every((t) => entry.text.includes(t)));
  };

  return {
    config,
    phases,
    narratives,
    characters,
    locations,
    regions,
    events,
    countries: data.countries,
    get,
    kindOf,
    countryName,
    typeInfo,
    emojiFor,
    isMappable,
    narratorsOf,
    narratorNames,
    sectionLabel,
    narrativeMeta,
    eventsOf,
    phaseOf,
    narrativePhases,
    narrativeHasLocation,
    narrativeCountries,
    eventCountries,
    eventHasLocation,
    narrativesOfCharacter,
    eventsOfCharacter,
    narrativesOfPlace,
    eventsOfPlace,
    narrativesOfEvent,
    eventsOfPhase,
    narrativesOfPhase,
    characterPlaces,
    placeCharacters,
    connections,
    search,
  };
}
