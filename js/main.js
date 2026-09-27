// Entry point: load data, build the store, mount the views and connect them to the state.

import { loadAll } from './data/loader.js';
import { validate } from './data/validate.js';
import { createStore } from './data/store.js';
import { getState, subscribe, update, mapMode } from './state.js';
import { startRouter, goHome, hrefFor } from './router.js';
import { createMap } from './map/map.js';
import { createNav } from './ui/nav.js';
import { createPanel } from './ui/panel.js';
import { createFilters } from './ui/filters.js';
import { createPhases } from './ui/phases.js';
import { createSearch } from './ui/search.js';
import { createThemeToggle } from './ui/theme.js';
import { html } from './utils/text.js';

const $ = (selector) => document.querySelector(selector);

async function start() {
  const loading = $('[data-loading]');
  let data;
  try {
    data = await loadAll();
  } catch (error) {
    showError(error);
    return;
  }

  const issues = validate(data);
  if (issues.length) console.warn(`[Atlas] ${issues.length} avisos en los datos:\n- ${issues.join('\n- ')}`);

  const store = createStore(data);
  const map = createMap($('[data-map]'), store);
  const views = [
    map,
    createNav($('[data-nav]'), store),
    createPanel($('[data-panel]'), store, { issues }),
    createFilters($('[data-filters]'), store),
    createPhases($('[data-phases]'), store),
  ];
  createSearch($('[data-search]'), store);
  createThemeToggle($('[data-theme-toggle]'));

  const homeButton = $('[data-home]');
  homeButton.addEventListener('click', goHome);
  const context = $('[data-map-context]');
  $('[data-drawer-close]').addEventListener('click', () => update({ drawerOpen: false }));
  $('[data-backdrop]').addEventListener('click', () => update({ drawerOpen: false }));

  let lastLayoutKey = '';
  const render = (state) => {
    views.forEach((view) => view.render(state));
    const mode = mapMode(state);
    homeButton.hidden = mode === 'general' && !state.selection;
    renderContext(context, store, state, mode);
    document.body.classList.toggle('drawer-open', state.drawerOpen);

    // Leaflet must re-measure when the space around it changes.
    const layoutKey = `${state.panelCollapsed}|${state.drawerOpen}`;
    if (layoutKey !== lastLayoutKey) {
      lastLayoutKey = layoutKey;
      setTimeout(map.invalidate, 260);
    }
  };

  subscribe(render);
  startRouter(store);
  render(getState());
  loading.hidden = true;
  document.body.classList.add('is-ready');
}

function renderContext(el, store, state, mode) {
  let label = null;
  if (mode === 'narrative') {
    const n = store.get(state.selection.id);
    label = html`<span class="ctx__kind">Narración</span> <a href="${hrefFor('narrative', n.id)}">${n.title}</a> <span class="muted">· ${store.narratorNames(n)}</span>`;
  } else if (mode === 'phase') {
    label = html`<span class="ctx__kind">Fase</span> ${store.get(state.phaseId).name}`;
  } else if (state.selection) {
    const record = store.get(state.selection.id);
    const kindLabel = store.config.entityLabels[state.selection.kind];
    label = html`<span class="ctx__kind">${kindLabel}</span> ${record?.name ?? record?.title ?? ''}`;
  }
  el.hidden = !label;
  el.innerHTML = label ? String(html`<p>${label}</p><a class="ctx__close" href="#/" aria-label="Volver al mapa general">×</a>`) : '';
}

function showError(error) {
  const loading = $('[data-loading]');
  loading.hidden = false;
  loading.classList.add('is-error');
  loading.innerHTML = String(html`
    <div class="loading__box">
      <p class="loading__title">No se pudo cargar el atlas</p>
      <p>${error.message}</p>
      ${error.file ? html`<p class="muted">Archivo: ${error.file}</p>` : ''}
      <button type="button" class="btn" onclick="location.reload()">Reintentar</button>
    </div>`);
  console.error(error);
}

start();
