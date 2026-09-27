// Global search: accent-insensitive, results grouped by kind, full keyboard support.

import { html } from '../utils/text.js';
import { hrefFor } from '../router.js';
import { eventEmoji } from '../map/markers.js';

const GROUPS = [
  { kind: 'narrative', label: 'Narraciones' },
  { kind: 'character', label: 'Personajes' },
  { kind: 'location', label: 'Lugares' },
  { kind: 'region', label: 'Regiones' },
  { kind: 'event', label: 'Acontecimientos' },
];
const MAX_PER_GROUP = 6;

export function createSearch(root, store) {
  const input = root.querySelector('input');
  const results = root.querySelector('[data-search-results]');
  let activeIndex = -1;

  const emojiFor = (entry) => {
    if (entry.kind === 'location') return store.emojiFor(entry.record);
    if (entry.kind === 'region') return '🗺️';
    if (entry.kind === 'event') return eventEmoji(store, entry.record);
    return '';
  };
  const titleOf = (entry) => entry.record.title ?? entry.record.name;
  const metaOf = (entry) => {
    const r = entry.record;
    if (entry.kind === 'narrative') return store.narrativeMeta(r);
    if (entry.kind === 'character') return r.role ?? '';
    if (entry.kind === 'location') return [store.typeInfo(r).label, r.country ? store.countryName(r.country) : ''].filter(Boolean).join(' · ');
    if (entry.kind === 'region') return 'Región';
    if (entry.kind === 'event') return store.phaseOf(r)?.name ?? 'Fase sin determinar';
    return '';
  };

  function show(query) {
    const q = query.trim();
    activeIndex = -1;
    if (!q) {
      close();
      return;
    }
    const found = store.search(q);
    if (!found.length) {
      results.innerHTML = String(html`<p class="search__empty">Sin resultados para «${q}». Prueba con otra palabra o revisa la escritura.</p>`);
    } else {
      results.innerHTML = String(html`${GROUPS.map((g) => {
        const items = found.filter((e) => e.kind === g.kind).slice(0, MAX_PER_GROUP);
        if (!items.length) return '';
        return html`<div class="search__group"><p class="search__label">${g.label}</p><ul>${items.map((e) => html`
          <li><a class="search__item" href="${hrefFor(e.kind, e.record.id)}">
            ${emojiFor(e) ? html`<span class="emo" aria-hidden="true">${emojiFor(e)}</span>` : ''}
            <span><span class="search__title">${titleOf(e)}</span><span class="search__meta">${metaOf(e)}</span></span>
          </a></li>`)}</ul></div>`;
      })}`);
    }
    results.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function close() {
    results.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  }

  function items() {
    return [...results.querySelectorAll('.search__item')];
  }

  input.addEventListener('input', () => show(input.value));
  input.addEventListener('focus', () => input.value && show(input.value));
  input.addEventListener('keydown', (ev) => {
    const list = items();
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      if (!list.length) return;
      ev.preventDefault();
      activeIndex = (activeIndex + (ev.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
      list.forEach((el, i) => el.classList.toggle('is-active', i === activeIndex));
      list[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (ev.key === 'Enter') {
      const target = list[activeIndex] ?? list[0];
      if (target) {
        ev.preventDefault();
        location.hash = target.getAttribute('href');
        finish();
      }
    } else if (ev.key === 'Escape') {
      finish();
    }
  });
  results.addEventListener('click', (ev) => {
    if (ev.target.closest('.search__item')) finish();
  });
  document.addEventListener('click', (ev) => {
    if (!root.contains(ev.target)) close();
  });

  function finish() {
    close();
    input.value = '';
    input.blur();
  }
}
