// Navigation panel: four tabs listing every entity, grouped so the lists read like an index.

import { html, plural } from '../utils/text.js';
import { hrefFor } from '../router.js';
import { update, resetFilters, activeFilterCount } from '../state.js';
import { passingNarratives } from '../data/query.js';
import { eventEmoji } from '../map/markers.js';

const TABS = [
  { id: 'narratives', label: 'Narraciones' },
  { id: 'characters', label: 'Personajes' },
  { id: 'places', label: 'Lugares' },
  { id: 'events', label: 'Acontecimientos' },
];

export function createNav(root, store) {
  const tabBar = root.querySelector('[data-nav-tabs]');
  const listEl = root.querySelector('[data-nav-list]');
  const mobileTabs = document.querySelector('[data-mobile-tabs]');

  tabBar.innerHTML = String(html`${TABS.map((t) => html`<button type="button" role="tab" class="tab" data-tab="${t.id}">${t.label}</button>`)}`);
  if (mobileTabs) {
    mobileTabs.innerHTML = String(html`${TABS.map((t) => html`<button type="button" class="mtab" data-tab="${t.id}">${t.label}</button>`)}`);
  }

  const onTab = (ev) => {
    const button = ev.target.closest('[data-tab]');
    if (!button) return;
    const fromMobile = Boolean(ev.target.closest('[data-mobile-tabs]'));
    update((s) => ({
      navTab: button.dataset.tab,
      drawerOpen: fromMobile ? !(s.drawerOpen && s.navTab === button.dataset.tab) : s.drawerOpen,
    }));
  };
  tabBar.addEventListener('click', onTab);
  mobileTabs?.addEventListener('click', onTab);

  listEl.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-reset-filters]')) resetFilters();
  });

  function render(state) {
    for (const button of document.querySelectorAll('[data-tab]')) {
      const active = button.dataset.tab === state.navTab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    }
    root.classList.toggle('is-open', state.drawerOpen);
    root.querySelector('[data-nav-title]').textContent = TABS.find((t) => t.id === state.navTab)?.label ?? '';
    const markup = {
      narratives: narrativesList,
      characters: charactersList,
      places: placesList,
      events: eventsList,
    }[state.navTab](state);
    listEl.innerHTML = String(markup);
  }

  const isCurrent = (state, id) => state.selection?.id === id || state.phaseId === id;
  const item = (state, kind, record, title, meta = '', emoji = '') => html`
    <li><a class="nav-item${isCurrent(state, record.id) ? ' is-current' : ''}" href="${hrefFor(kind, record.id)}" ${isCurrent(state, record.id) ? html`aria-current="true"` : ''}>
      ${emoji ? html`<span class="emo" aria-hidden="true">${emoji}</span>` : ''}
      <span class="nav-item__text"><span class="nav-item__title">${title}</span>${meta ? html`<span class="nav-item__meta">${meta}</span>` : ''}</span>
    </a></li>`;
  const group = (title, items, count = null) =>
    items.length ? html`<div class="nav-group"><h3 class="nav-group__title">${title}${count != null ? html` <span class="muted">${count}</span>` : ''}</h3><ul>${items}</ul></div>` : '';

  function narrativesList(state) {
    const visible = passingNarratives(store, state);
    const filtersOn = activeFilterCount(state.filters) > 0 || state.phaseId;
    if (!visible.length) {
      return html`<div class="empty"><p>Ninguna narración coincide con los filtros actuales.</p>
        ${activeFilterCount(state.filters) ? html`<button type="button" class="btn btn--ghost" data-reset-filters>Quitar filtros</button>` : ''}</div>`;
    }
    const narrativeMeta = (n) =>
      html`${store.narratorNames(n)}${store.narrativeHasLocation(n) ? '' : html` · <span class="tag tag--none">sin ubicación</span>`}`;
    const groups = store.config.bookSections.map((sec) => {
      const items = visible.filter((n) => n.bookSection === sec.id);
      return group(sec.label, items.map((n) => item(state, 'narrative', n, n.title, narrativeMeta(n))));
    });
    const unlocated = visible.filter((n) => !store.narrativeHasLocation(n));
    return html`
      ${filtersOn ? html`<p class="nav-note">Mostrando ${visible.length} de ${store.narratives.length} narraciones${state.phaseId ? ` (fase: ${store.get(state.phaseId).name})` : ''}.</p>` : ''}
      ${groups}
      ${group('📍 Sin ubicación definida', unlocated.map((n) => item(state, 'narrative', n, n.title, store.narratorNames(n))), unlocated.length)}`;
  }

  function charactersList(state) {
    const narrators = store.characters.filter((c) => store.narrativesOfCharacter(c.id).some((x) => x.role === 'narrador'));
    const others = store.characters.filter((c) => !narrators.includes(c));
    const meta = (c) => html`${c.role ?? ''} · ${plural(store.narrativesOfCharacter(c.id).length, 'narración', 'narraciones')}`;
    return html`
      ${group('Narradores', narrators.map((c) => item(state, 'character', c, c.name, meta(c))), narrators.length)}
      ${group('Mencionados', others.map((c) => item(state, 'character', c, c.name, meta(c))), others.length)}`;
  }

  function placesList(state) {
    const byCountry = new Map();
    const noCountry = [];
    const unlocated = [];
    for (const l of store.locations) {
      if (!store.isMappable(l)) unlocated.push(l);
      else if (!l.country) noCountry.push(l);
      else {
        const name = store.countryName(l.country);
        if (!byCountry.has(name)) byCountry.set(name, []);
        byCountry.get(name).push(l);
      }
    }
    const placeMeta = (l) => {
      const links = store.narrativesOfPlace(l.id);
      const parts = [store.typeInfo(l).label];
      if (links.some((x) => x.role === 'entrevista')) parts.push('entrevista');
      if (l.precision === 'approximate') parts.push('aproximada');
      if (l.precision === 'regional') parts.push('regional');
      return parts.join(' · ');
    };
    const countries = [...byCountry.keys()].sort((a, b) => a.localeCompare(b, 'es'));
    return html`
      ${countries.map((name) => group(name, byCountry.get(name).map((l) => item(state, 'location', l, l.name, placeMeta(l), store.emojiFor(l))), byCountry.get(name).length))}
      ${group('Mares y océanos', noCountry.map((l) => item(state, 'location', l, l.name, placeMeta(l), store.emojiFor(l))))}
      ${group('Regiones', store.regions.map((r) => item(state, 'region', r, r.name, `${plural((r.countries || []).length, 'país', 'países')}`, '🗺️')))}
      ${group('Sin lugar fijo en el mapa', unlocated.map((l) => item(state, 'location', l, l.name, placeMeta(l), store.emojiFor(l))))}`;
  }

  function eventsList(state) {
    const eventItem = (e) => item(state, 'event', e, e.name, e.timeNote ?? '', eventEmoji(store, e));
    const phaseGroups = store.phases.map((p) => {
      const events = store.eventsOfPhase(p.id);
      return group(html`<a href="${hrefFor('phase', p.id)}">${p.order}. ${p.name}</a>`, events.map(eventItem), events.length);
    });
    const noPhase = store.eventsOfPhase(null);
    return html`${phaseGroups}${group('Fase sin determinar', noPhase.map(eventItem), noPhase.length)}`;
  }

  return { render };
}
