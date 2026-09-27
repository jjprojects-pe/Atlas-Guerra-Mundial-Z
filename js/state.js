// Single source of truth for what the user is looking at. Views subscribe and re-render.

export const DEFAULT_FILTERS = Object.freeze({
  showScenes: true,
  showInterviews: true,
  onlyWithEvents: false,
  categories: [],
  bookSection: '',
  narrativeId: '',
  precision: ['exact', 'approximate', 'regional'],
  location: 'all',
});

const state = {
  selection: null, // { kind, id }
  phaseId: null,
  filters: { ...DEFAULT_FILTERS, categories: [], precision: [...DEFAULT_FILTERS.precision] },
  navTab: 'narratives',
  drawerOpen: false,
  panelCollapsed: false,
  theme: document.documentElement.dataset.theme || 'print',
};

const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function update(patch) {
  Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
  listeners.forEach((listener) => listener(state));
}

export function updateFilters(patch) {
  update({ filters: { ...state.filters, ...patch } });
}

export function resetFilters() {
  update({ filters: { ...DEFAULT_FILTERS, categories: [], precision: [...DEFAULT_FILTERS.precision] } });
}

export function activeFilterCount(filters = state.filters) {
  let count = 0;
  if (!filters.showScenes) count++;
  if (!filters.showInterviews) count++;
  if (filters.onlyWithEvents) count++;
  if (filters.categories.length) count++;
  if (filters.bookSection) count++;
  if (filters.narrativeId) count++;
  if (filters.precision.length !== DEFAULT_FILTERS.precision.length) count++;
  if (filters.location !== 'all') count++;
  return count;
}

// "general", "narrative" or "phase": decides how the map is drawn.
export function mapMode(current = state) {
  if (current.selection?.kind === 'narrative') return 'narrative';
  if (current.phaseId) return 'phase';
  return 'general';
}
