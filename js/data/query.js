// Turns the store + current state into what the map must draw.
// Pure functions: no Leaflet, no DOM.

import { mapMode } from '../state.js';

export function passingNarratives(store, state) {
  const f = state.filters;
  return store.narratives.filter((n) => {
    if (f.narrativeId && n.id !== f.narrativeId) return false;
    if (f.bookSection && n.bookSection !== f.bookSection) return false;
    if (f.categories.length && !(n.categories || []).some((c) => f.categories.includes(c))) return false;
    const located = store.narrativeHasLocation(n);
    if (f.location === 'with' && !located) return false;
    if (f.location === 'without' && located) return false;
    if (state.phaseId && !store.eventsOf(n).some((e) => e.phaseId === state.phaseId)) return false;
    return true;
  });
}

// Places (locations or regions) related to the current non-narrative selection.
export function relatedRefs(store, selection) {
  if (!selection) return null;
  const { kind, id } = selection;
  if (kind === 'location' || kind === 'region') return new Set([id]);
  if (kind === 'event') return new Set((store.get(id)?.places || []).map((p) => p.ref));
  if (kind === 'character') return new Set(store.characterPlaces(id).map((p) => p.id));
  return null;
}

export function buildMapModel(store, state) {
  const mode = mapMode(state);
  const model = {
    mode,
    places: new Map(), // ref -> { record, order, vessel }
    interviews: new Map(), // locationId -> { record, narratives: [] }
    countries: new Map(), // iso -> { direct: Set(narrativeId), regional: Map(narrativeId -> [region names]) }
    highlight: null,
    banner: null,
    narrative: null,
  };

  const addPlace = (ref, extra = {}) => {
    const record = store.get(ref);
    if (!record || !store.isMappable(record)) return;
    const existing = model.places.get(ref);
    if (existing) {
      if (extra.order != null && existing.order == null) Object.assign(existing, extra);
      return;
    }
    model.places.set(ref, { record, order: null, vessel: null, ...extra });
  };
  const addInterview = (locationId, narrative) => {
    const record = store.get(locationId);
    if (!record || !store.isMappable(record)) return;
    if (!model.interviews.has(locationId)) model.interviews.set(locationId, { record, narratives: [] });
    const entry = model.interviews.get(locationId);
    if (!entry.narratives.includes(narrative)) entry.narratives.push(narrative);
  };
  const countCountries = (narrative, { direct, regional }) => {
    const bucket = (iso) => {
      if (!model.countries.has(iso)) model.countries.set(iso, { direct: new Set(), regional: new Map() });
      return model.countries.get(iso);
    };
    direct.forEach((iso) => bucket(iso).direct.add(narrative.id));
    regional.forEach((regionsList, iso) => {
      const entry = bucket(iso);
      entry.regional.set(narrative.id, regionsList.map((r) => r.name));
    });
  };

  if (mode === 'narrative') {
    const n = store.get(state.selection.id);
    model.narrative = n;
    const vessel = n.vesselId ? store.get(n.vesselId) : null;
    (n.places || []).forEach((p) => addPlace(p.ref, { order: p.order ?? null, vessel: p.order != null ? vessel : null }));
    store.eventsOf(n).forEach((e) => (e.places || []).forEach((p) => addPlace(p.ref)));
    if (n.interview?.locationId) addInterview(n.interview.locationId, n);
    if (n.epilogue?.interviewLocationId) addInterview(n.epilogue.interviewLocationId, n);
    countCountries(n, store.narrativeCountries(n));
    if (!store.narrativeHasLocation(n)) {
      model.banner = model.places.size
        ? 'Los hechos que vive el narrador no tienen ubicación definida en el libro. El mapa muestra solo los acontecimientos relacionados que sí la tienen.'
        : 'Los hechos de esta narración no tienen ubicación definida en el libro.';
    }
    return model;
  }

  const f = state.filters;
  const narratives = passingNarratives(store, state);
  const precisionOk = (record) => store.kindOf(record.id) === 'region' ? f.precision.includes('regional') : f.precision.includes(record.precision);

  for (const n of narratives) {
    if (mode === 'phase') {
      const phaseEvents = store.eventsOf(n).filter((e) => e.phaseId === state.phaseId);
      if (f.showScenes) phaseEvents.forEach((e) => (e.places || []).forEach((p) => addPlace(p.ref)));
      phaseEvents.forEach((e) => countCountries(n, store.eventCountries(e)));
      const isPostwar = state.phaseId === 'fase-posguerra';
      if (isPostwar && f.showInterviews && n.interview?.locationId) addInterview(n.interview.locationId, n);
    } else {
      if (f.showScenes) {
        (n.places || []).forEach((p) => addPlace(p.ref));
        store.eventsOf(n).forEach((e) => (e.places || []).forEach((p) => addPlace(p.ref)));
      }
      if (f.showInterviews && n.interview?.locationId) addInterview(n.interview.locationId, n);
      countCountries(n, store.narrativeCountries(n));
    }
  }

  for (const [ref, entry] of model.places) {
    const drop = !precisionOk(entry.record) || (f.onlyWithEvents && !store.eventsOfPlace(ref).length);
    if (drop) model.places.delete(ref);
  }

  // A selected place, event or character is always visible, whatever the filters say.
  const related = relatedRefs(store, state.selection);
  if (related) {
    related.forEach((ref) => {
      const links = store.narrativesOfPlace(ref);
      const interviewLinks = links.filter((x) => x.role === 'entrevista' || x.role === 'despedida');
      interviewLinks.forEach((x) => addInterview(ref, x.narrative));
      const isScene = links.some((x) => x.role === 'escenario') || store.eventsOfPlace(ref).length > 0;
      if (isScene || !interviewLinks.length) addPlace(ref);
    });
    model.highlight = related;
    if (![...related].some((ref) => store.isMappable(store.get(ref)))) {
      model.banner = 'Este elemento no tiene ubicación definida en el libro.';
    }
  }

  return model;
}

// 0 = no narratives, 1..steps.length = darker each step.
export function intensityLevel(count, steps) {
  if (!count) return 0;
  return steps.filter((threshold) => count >= threshold).length;
}
