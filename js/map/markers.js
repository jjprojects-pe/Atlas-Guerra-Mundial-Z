// Leaflet icons and popups. Every marker is plain HTML: an emoji inside a styled badge.

import { html, plural } from '../utils/text.js';
import { hrefFor } from '../router.js';

const L = window.L;

function stateClass(ref, highlight) {
  if (!highlight) return '';
  return highlight.has(ref) ? ' is-highlighted' : ' is-dimmed';
}

export function placeIcon(store, entry, highlight) {
  const { record, order, vessel } = entry;
  const isRegion = store.kindOf(record.id) === 'region';
  const cls = stateClass(record.id, highlight);

  if (isRegion || record.precision === 'regional') {
    const emoji = isRegion ? '🗺️' : store.emojiFor(record);
    const text = isRegion ? `${record.name} (región)` : record.label || record.name;
    const markup = html`<div class="mk-label${cls}">${order != null ? html`<span class="mk-label__num">${order}</span>` : ''}<span aria-hidden="true">${emoji}</span> ${text}</div>`;
    return L.divIcon({ className: 'mk-wrap', html: String(markup), iconSize: null, iconAnchor: [0, 12] });
  }

  const info = store.typeInfo(record);
  const emoji = vessel ? store.emojiFor(vessel) : store.emojiFor(record);
  const markup = html`<div class="mk mk--${record.precision}${cls}" style="--mk-color:${info.color};--mk-color-dark:${info.colorDark}">
      <span class="mk__emoji" aria-hidden="true">${emoji}</span>
      ${order != null ? html`<span class="mk__num">${order}</span>` : ''}
    </div>`;
  return L.divIcon({ className: 'mk-wrap', html: String(markup), iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -14] });
}

export function interviewIcon(store, entry, { highlight, showLabel, offset }) {
  const count = entry.narratives.length;
  const cls = stateClass(entry.record.id, highlight);
  const label = store.config.interviewMarker.label;
  const markup = html`<div class="mk-int${cls}">
      <span class="mk-int__emoji" aria-hidden="true">${store.config.interviewMarker.emoji}</span>
      ${count > 1 ? html`<span class="mk-int__count">${count}</span>` : ''}
      ${showLabel ? html`<span class="mk-int__label">${label}</span>` : ''}
    </div>`;
  // Interviews sit up-left of their point so they never hide a place marker on the same spot.
  const anchor = offset ? [34, 34] : [15, 15];
  return L.divIcon({ className: 'mk-wrap', html: String(markup), iconSize: [30, 30], iconAnchor: anchor, popupAnchor: [0, -14] });
}

const linkList = (items) => html`<ul class="pop__list">${items}</ul>`;

export function placePopup(store, record) {
  const isRegion = store.kindOf(record.id) === 'region';
  const kind = isRegion ? 'region' : 'location';
  const links = store.narrativesOfPlace(record.id);
  const scenes = links.filter((x) => x.role === 'escenario' || x.role === 'embarcación');
  const interviews = links.filter((x) => x.role === 'entrevista' || x.role === 'despedida');
  const events = store.eventsOfPlace(record.id);
  const precision = isRegion ? store.config.precision.regional : store.config.precision[record.precision];
  const typeLabel = isRegion ? 'Región' : store.typeInfo(record).label;

  return String(html`<div class="pop">
    <p class="pop__kicker">${typeLabel} · ${precision?.label ?? ''}</p>
    <h3 class="pop__title">${isRegion ? '🗺️' : store.emojiFor(record)} ${record.name}</h3>
    ${isRegion && record.note ? html`<p class="pop__note">${record.note}</p>` : ''}
    ${scenes.length ? html`<p class="pop__label">Narraciones que ocurren aquí</p>${linkList(scenes.map((x) => narrativeLink(store, x.narrative, x.order)))}` : ''}
    ${interviews.length ? html`<p class="pop__label">Entrevistas realizadas aquí</p>${linkList(interviews.map((x) => narrativeLink(store, x.narrative)))}` : ''}
    ${events.length ? html`<p class="pop__label">Acontecimientos</p>${linkList(events.map((e) => html`<li><a href="${hrefFor('event', e.id)}">${eventEmoji(store, e)} ${e.name}</a></li>`))}` : ''}
    <a class="pop__cta" href="${hrefFor(kind, record.id)}">Ver ficha</a>
  </div>`);
}

export function interviewPopup(store, entry) {
  return String(html`<div class="pop">
    <p class="pop__kicker">${store.config.interviewMarker.label}</p>
    <h3 class="pop__title">🎙️ ${entry.record.name}</h3>
    <p class="pop__note">${plural(entry.narratives.length, 'entrevista realizada aquí después de la guerra', 'entrevistas realizadas aquí después de la guerra')}.</p>
    ${linkList(entry.narratives.map((n) => narrativeLink(store, n)))}
    <a class="pop__cta" href="${hrefFor('location', entry.record.id)}">Ver ficha del lugar</a>
  </div>`);
}

function narrativeLink(store, narrative, order = null) {
  return html`<li><a href="${hrefFor('narrative', narrative.id)}">${order != null ? html`<span class="num">${order}</span> ` : ''}${narrative.title}</a><span class="muted"> · ${store.narrativeMeta(narrative)}</span></li>`;
}

export function eventEmoji(store, event) {
  return store.config.eventCategories[event.category]?.emoji ?? '📌';
}
