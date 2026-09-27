// Keeps the selection in the URL (#/lugar/loc-qingdao) so Back and shared links work.

import { update } from './state.js';

const SLUGS = {
  narrative: 'narracion',
  character: 'personaje',
  location: 'lugar',
  region: 'region',
  event: 'acontecimiento',
  phase: 'fase',
};
const KINDS = Object.fromEntries(Object.entries(SLUGS).map(([kind, slug]) => [slug, kind]));

export function hrefFor(kind, id) {
  return `#/${SLUGS[kind]}/${encodeURIComponent(id)}`;
}

export const HOME_HREF = '#/';

export function goTo(kind, id) {
  location.hash = hrefFor(kind, id);
}

export function goHome() {
  location.hash = HOME_HREF;
}

function parse(hash) {
  const [, slug, id] = hash.replace(/^#/, '').split('/');
  const kind = KINDS[slug];
  return kind && id ? { kind, id: decodeURIComponent(id) } : null;
}

export function startRouter(store) {
  const apply = () => {
    const target = parse(location.hash);
    if (!target || !store.get(target.id)) {
      update({ selection: null, phaseId: null });
      return;
    }
    if (target.kind === 'phase') {
      update({ selection: null, phaseId: target.id });
    } else if (target.kind === 'narrative') {
      update({ selection: target, phaseId: null, drawerOpen: false, panelCollapsed: false });
    } else {
      update({ selection: target, drawerOpen: false, panelCollapsed: false });
    }
  };
  window.addEventListener('hashchange', apply);
  apply();
}
