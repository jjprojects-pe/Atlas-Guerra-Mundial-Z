// Information panel: one "ficha" per entity kind, plus an overview when nothing is selected.

import { html, raw, plural } from '../utils/text.js';
import { hrefFor } from '../router.js';
import { eventEmoji } from '../map/markers.js';
import { update } from '../state.js';

export function createPanel(root, store, { issues }) {
  const body = root.querySelector('[data-panel-body]');
  const toggle = root.querySelector('[data-panel-toggle]');

  toggle.addEventListener('click', () => update((s) => ({ panelCollapsed: !s.panelCollapsed })));

  function render(state) {
    root.classList.toggle('is-collapsed', state.panelCollapsed);
    toggle.setAttribute('aria-expanded', String(!state.panelCollapsed));
    toggle.querySelector('span').textContent = state.panelCollapsed ? 'Mostrar ficha' : 'Ocultar ficha';

    const sel = state.selection;
    let markup;
    if (sel) markup = fichaFor(sel.kind, store.get(sel.id));
    else if (state.phaseId) markup = phaseFicha(store.get(state.phaseId));
    else markup = overview();
    body.innerHTML = String(markup);
    body.scrollTop = 0;
  }

  // ---------- shared fragments -------------------------------------------------
  const link = (kind, record, label = null) =>
    html`<a class="elink elink--${kind}" href="${hrefFor(kind, record.id)}">${label ?? record.name ?? record.title}</a>`;

  // Spoiler protection: summaries stay blurred until the reader asks for them.
  // Revealed keys live only in memory for this visit.
  const revealed = new Set();
  const spoiler = (key, content, label) => {
    const open = revealed.has(key);
    return html`<div class="spoiler${open ? ' is-revealed' : ''}" data-spoiler="${key}">
      ${open
        ? html`<button type="button" class="spoiler__btn spoiler__btn--hide" data-spoiler-toggle>Ocultar</button>`
        : html`<button type="button" class="spoiler__btn" data-spoiler-toggle>${label}</button>`}
      <div class="spoiler__content" tabindex="-1"${open ? '' : raw(' aria-hidden="true" inert')}>${content}</div>
    </div>`;
  };

  const pending = (what = 'Pendiente') => html`<span class="pending" title="Dato por completar">${what}</span>`;

  const statusBadge = (record) => {
    if (!record?.status || record.status === 'confirmado') return '';
    const info = store.config.status[record.status];
    return html`<span class="badge badge--${record.status}" title="${info?.hint ?? ''}">${info?.label ?? record.status}</span>`;
  };
  const demoBadge = (record) => (record?.demo ? html`<span class="badge badge--demo">DEMO</span>` : '');

  const section = (title, content, { always = false } = {}) => {
    const empty = content == null || content === '' || (Array.isArray(content) && !content.length);
    if (empty && !always) return '';
    return html`<section class="ficha__section"><h3 class="ficha__h">${title}</h3>${content}</section>`;
  };
  const list = (items) => (items.length ? html`<ul class="ficha__list">${items}</ul>` : '');

  const precisionTag = (record) => {
    if (store.kindOf(record.id) === 'region') return html`<span class="tag">región</span>`;
    if (record.precision === 'exact') return '';
    const label = { approximate: 'aproximada', regional: 'regional', mobile: 'móvil', none: 'sin ubicación' }[record.precision];
    return html`<span class="tag tag--${record.precision}" title="${store.config.precision[record.precision]?.hint ?? ''}">${label}</span>`;
  };

  const placeItem = (record, order = null) => {
    const kind = store.kindOf(record.id);
    const emoji = kind === 'region' ? '🗺️' : store.emojiFor(record);
    return html`<li>${order != null ? html`<span class="num">${order}</span>` : ''}<span class="emo" aria-hidden="true">${emoji}</span>${link(kind, record)} ${precisionTag(record)}
      ${kind === 'region' && record.note ? html`<p class="ficha__note">${record.note}</p>` : ''}</li>`;
  };

  const phaseChip = (event) => {
    const phase = store.phaseOf(event);
    return phase
      ? html`<a class="chip chip--phase" href="${hrefFor('phase', phase.id)}">${phase.name}</a>`
      : html`<span class="chip chip--nophase" title="El libro no permite asignar una fase con seguridad">Fase sin determinar</span>`;
  };

  const eventItem = (event) => html`<li><span class="emo" aria-hidden="true">${eventEmoji(store, event)}</span>${link('event', event)} ${statusBadge(event)}
    <div class="ficha__meta">${phaseChip(event)}${event.timeNote ? html`<span class="muted"> ${event.timeNote}</span>` : ''}</div></li>`;

  const narrativeItem = (narrative, extra = '') => html`<li>${link('narrative', narrative)}<span class="muted"> · ${store.narrativeMeta(narrative)}${extra}</span></li>`;

  const header = (kicker, title, { emoji = '', subtitle = '', badges = '' } = {}) => html`
    <header class="ficha__head">
      <p class="ficha__kicker">${kicker}</p>
      <h2 class="ficha__title">${emoji ? html`<span class="emo" aria-hidden="true">${emoji}</span>` : ''}${title}</h2>
      ${subtitle ? html`<p class="ficha__subtitle">${subtitle}</p>` : ''}
      ${badges ? html`<div class="ficha__badges">${badges}</div>` : ''}
    </header>`;

  const sourceLine = (record) => (record?.source?.section ? html`<p class="ficha__source">Fuente: ${record.source.section}</p>` : '');

  const unlocatedNotice = (text) => html`<p class="notice"><span aria-hidden="true">📍</span> ${text}</p>`;

  // ---------- fichas ------------------------------------------------------------
  function fichaFor(kind, record) {
    if (!record) return html`<p class="empty">Este elemento no existe o se ha eliminado de los datos.</p>`;
    switch (kind) {
      case 'narrative': return narrativeFicha(record);
      case 'character': return characterFicha(record);
      case 'location': return locationFicha(record);
      case 'region': return regionFicha(record);
      case 'event': return eventFicha(record);
      case 'phase': return phaseFicha(record);
      default: return overview();
    }
  }

  function narrativeFicha(n) {
    const sectionLabel = store.config.bookSections.find((s) => s.id === n.bookSection)?.label ?? '';
    const narrators = store.narratorsOf(n);
    const places = (n.places || []).map((p) => ({ record: store.get(p.ref), order: p.order ?? null })).filter((p) => p.record);
    const ordered = places.filter((p) => p.order != null).sort((a, b) => a.order - b.order);
    const unordered = places.filter((p) => p.order == null);
    const located = store.narrativeHasLocation(n);
    const { direct, regional } = store.narrativeCountries(n);
    const interview = n.interview?.locationId ? store.get(n.interview.locationId) : null;
    const vessel = n.vesselId ? store.get(n.vesselId) : null;
    const mentioned = (n.mentionedCharacterIds || []).map(store.get).filter(Boolean);
    const connections = store.connections(n);
    const categories = (n.categories || []).map((c) => html`<span class="chip">${store.config.categories[c]?.label ?? c}</span>`);

    const placesBlock = html`
      ${!located ? unlocatedNotice('Ubicación no definida en el libro: esta narración no aparece pintada en el mapa.') : ''}
      ${ordered.length ? html`<p class="ficha__label">Recorrido en orden</p>${list(ordered.map((p) => placeItem(p.record, p.order)))}` : ''}
      ${unordered.length ? html`${ordered.length ? html`<p class="ficha__label">Otros lugares</p>` : ''}${list(unordered.map((p) => placeItem(p.record)))}` : ''}`;

    const countryChips = [
      ...[...direct].map((iso) => html`<span class="chip">${store.countryName(iso)}</span>`),
      ...[...regional.entries()]
        .filter(([iso]) => !direct.has(iso))
        .map(([iso, regs]) => html`<span class="chip chip--regional" title="Solo se sabe la región">${store.countryName(iso)} (región: ${regs.map((r) => r.name).join(', ')})</span>`),
    ];

    return html`
      ${header(`Narración · ${sectionLabel}`, n.title, {
        subtitle: narrators.length ? html`Narra ${narrators.map((c, i) => html`${i ? ', ' : ''}${link('character', c)}`)}` : '',
        badges: html`${statusBadge(n)}${demoBadge(n)}${categories}`,
      })}
      ${section('Resumen', n.summary ? spoiler(`${n.id}:summary`, html`<p>${n.summary}</p>`, 'Mostrar resumen (contiene spoilers)') : pending('Resumen pendiente'), { always: true })}
      ${section('Contexto', n.context ? html`<p>${n.context}</p>` : pending('Contexto pendiente'), { always: true })}
      ${interview ? section('Entrevista', html`<p><span class="emo" aria-hidden="true">🎙️</span>${link('location', interview)} <span class="muted">· posguerra</span> ${precisionTag(interview)}</p>`) : ''}
      ${section('Lugares del relato', placesBlock, { always: true })}
      ${section('Países', countryChips.length ? html`<div class="chips">${countryChips}</div>` : '')}
      ${vessel ? section('Embarcación', html`<p><span class="emo" aria-hidden="true">${store.emojiFor(vessel)}</span>${link('location', vessel)} <span class="muted">· sus paradas están numeradas en el mapa</span></p>`) : ''}
      ${section('Acontecimientos', list(store.eventsOf(n).map(eventItem)))}
      ${section('Personajes mencionados', list(mentioned.map((c) => html`<li>${link('character', c)}<span class="muted"> · ${c.role ?? ''}</span></li>`)))}
      ${n.epilogue ? section('Despedida', html`
        ${n.epilogue.interviewLocationId ? html`<p class="muted">Reencuentro en ${link('location', store.get(n.epilogue.interviewLocationId))}</p>` : ''}
        ${n.epilogue.summary ? spoiler(`${n.id}:epilogue`, html`<p>${n.epilogue.summary}</p>`, 'Mostrar despedida (contiene spoilers)') : pending('Resumen de la despedida pendiente')}`) : ''}
      ${section('Conexiones con otras narraciones', connections.length
        ? list(connections.map((c) => html`<li>${link('narrative', c.narrative)}<span class="muted"> · ${store.narrativeMeta(c.narrative)}</span>
            <div class="ficha__meta">Comparten: ${c.items.map((i, idx) => html`${idx ? ', ' : ''}<a href="${hrefFor(i.kind, i.id)}">${i.label}</a>`)}</div></li>`))
        : html`<p class="muted">Todavía no comparte lugares, personajes ni acontecimientos con otras narraciones cargadas.</p>`, { always: true })}
      ${section('Etiquetas', (n.tags || []).length ? html`<div class="chips">${n.tags.map((t) => html`<span class="chip chip--tag">${t}</span>`)}</div>` : '')}
      ${sourceLine(n)}`;
  }

  function characterFicha(c) {
    const narratives = store.narrativesOfCharacter(c.id);
    const events = store.eventsOfCharacter(c.id);
    const places = store.characterPlaces(c.id);
    return html`
      ${header('Personaje', c.name, { subtitle: c.role, badges: html`${statusBadge(c)}${demoBadge(c)}` })}
      ${c.nationality ? html`<p class="ficha__fact"><span class="muted">Nacionalidad:</span> ${c.nationality}</p>` : ''}
      ${section('Descripción', c.description ? html`<p>${c.description}</p>` : pending('Descripción pendiente'), { always: true })}
      ${section('Narraciones', list(narratives.map((x) => narrativeItem(x.narrative, x.role === 'narrador' ? ' · la narra' : ' · aparece mencionado'))))}
      ${section('Acontecimientos', list(events.map(eventItem)))}
      ${section('Lugares relacionados', places.length ? list(places.map((p) => placeItem(p))) : '')}
      ${sourceLine(c)}`;
  }

  function locationFicha(l) {
    const info = store.typeInfo(l);
    const links = store.narrativesOfPlace(l.id);
    const scenes = links.filter((x) => x.role === 'escenario');
    const interviews = links.filter((x) => x.role === 'entrevista' || x.role === 'despedida');
    const vesselOf = links.filter((x) => x.role === 'embarcación');
    const events = store.eventsOfPlace(l.id);
    const people = store.placeCharacters(l.id);
    const precision = store.config.precision[l.precision];
    return html`
      ${header(info.label, l.name, { emoji: store.emojiFor(l), badges: html`${statusBadge(l)}${demoBadge(l)}` })}
      ${l.bookName && l.bookName !== l.name ? html`<p class="ficha__fact"><span class="muted">En el libro:</span> «${l.bookName}»</p>` : ''}
      <p class="ficha__fact"><span class="muted">Precisión:</span> ${precision?.label ?? l.precision} ${precision?.hint ? html`<span class="muted">— ${precision.hint}</span>` : ''}</p>
      ${l.country ? html`<p class="ficha__fact"><span class="muted">País:</span> ${store.countryName(l.country)}</p>` : ''}
      ${l.precision === 'none' ? unlocatedNotice('Sin ubicación en el mapa.') : ''}
      ${section('Descripción', l.description ? html`<p>${l.description}</p>` : pending('Descripción pendiente'), { always: true })}
      ${section('Narraciones que ocurren aquí', list(scenes.map((x) => narrativeItem(x.narrative, x.order != null ? ` · parada ${x.order}` : ''))))}
      ${section('Narraciones de las que es la embarcación', list(vesselOf.map((x) => narrativeItem(x.narrative))))}
      ${section('Entrevistas realizadas aquí (posguerra)', list(interviews.map((x) => narrativeItem(x.narrative, x.role === 'despedida' ? ' · despedida' : ''))))}
      ${section('Acontecimientos', list(events.map(eventItem)))}
      ${section('Personajes relacionados', list(people.map((c) => html`<li>${link('character', c)}<span class="muted"> · ${c.role ?? ''}</span></li>`)))}`;
  }

  function regionFicha(r) {
    const narratives = store.narrativesOfPlace(r.id);
    const events = store.eventsOfPlace(r.id);
    return html`
      ${header('Región', r.name, { emoji: '🗺️', badges: html`${statusBadge(r)}${demoBadge(r)}` })}
      ${r.bookName ? html`<p class="ficha__fact"><span class="muted">En el libro:</span> «${r.bookName}»</p>` : ''}
      ${r.note ? html`<p class="notice notice--info">${r.note}</p>` : ''}
      ${section('Países que abarca', html`<div class="chips">${(r.countries || []).map((iso) => html`<span class="chip">${store.countryName(iso)}</span>`)}</div>`)}
      <p class="muted small">Las regiones no suman a la intensidad del mapa general; solo se muestran con su etiqueta.</p>
      ${section('Narraciones', list(narratives.map((x) => narrativeItem(x.narrative))))}
      ${section('Acontecimientos', list(events.map(eventItem)))}`;
  }

  function eventFicha(e) {
    const category = store.config.eventCategories[e.category];
    const places = (e.places || []).map((p) => store.get(p.ref)).filter(Boolean);
    const people = (e.characterIds || []).map(store.get).filter(Boolean);
    const narratives = store.narrativesOfEvent(e.id);
    const located = store.eventHasLocation(e);
    const eventCountryChips = (e.countries || []).map((iso) => html`<span class="chip">${store.countryName(iso)}</span>`);
    return html`
      ${header(`Acontecimiento · ${category?.label ?? ''}`, e.name, { emoji: eventEmoji(store, e), badges: html`${statusBadge(e)}${demoBadge(e)}` })}
      <div class="ficha__meta ficha__meta--lead">${phaseChip(e)}${e.timeNote ? html`<span class="muted"> ${e.timeNote}</span>` : ''}</div>
      ${section('Descripción', e.description ? html`<p>${e.description}</p>` : pending('Descripción pendiente'), { always: true })}
      ${section('Dónde', html`${!located ? unlocatedNotice('Ubicación no definida en el libro.') : ''}${list(places.map((p) => placeItem(p)))}${eventCountryChips.length ? html`<div class="chips">${eventCountryChips}</div>` : ''}`, { always: true })}
      ${section('Personajes', list(people.map((c) => html`<li>${link('character', c)}<span class="muted"> · ${c.role ?? ''}</span></li>`)))}
      ${section('Narraciones', list(narratives.map((n) => narrativeItem(n))))}
      ${sourceLine(e)}`;
  }

  function phaseFicha(p) {
    if (!p) return overview();
    const events = store.eventsOfPhase(p.id);
    const narratives = store.narrativesOfPhase(p.id);
    return html`
      ${header(`Fase ${p.order} de ${store.phases.length}`, p.name)}
      ${p.description ? html`<p>${p.description}</p>` : ''}
      <p class="muted small">El mapa muestra solo los lugares de los acontecimientos de esta fase. Pulsa de nuevo la fase para volver al mapa general.</p>
      ${section('Acontecimientos en esta fase', events.length ? list(events.map(eventItem)) : html`<p class="empty">Todavía no hay acontecimientos cargados en esta fase.</p>`, { always: true })}
      ${section('Narraciones', list(narratives.map((n) => narrativeItem(n))))}`;
  }

  function overview() {
    const unlocated = store.narratives.filter((n) => !store.narrativeHasLocation(n));
    const noPhase = store.eventsOfPhase(null);
    return html`
      ${header('Atlas interactivo', 'Explora el mundo de Guerra Mundial Z')}
      <p>Cada narración del libro está conectada con sus lugares, personajes y acontecimientos. Elige una narración o pulsa un marcador del mapa para empezar.</p>
      <ul class="howto">
        <li><strong>Mapa:</strong> los países más oscuros tienen más narraciones. 🎙️ marca dónde se hizo cada entrevista después de la guerra.</li>
        <li><strong>Fases:</strong> la barra superior muestra qué ocurría en cada etapa de la guerra.</li>
        <li><strong>Buscador:</strong> encuentra lugares, personajes o acontecimientos por su nombre.</li>
      </ul>
      <div class="stats">
        <a class="stat" href="#/" data-open-tab="narratives"><strong>${store.narratives.length}</strong><span>narraciones</span></a>
        <a class="stat" href="#/" data-open-tab="characters"><strong>${store.characters.length}</strong><span>personajes</span></a>
        <a class="stat" href="#/" data-open-tab="places"><strong>${store.locations.length + store.regions.length}</strong><span>lugares</span></a>
        <a class="stat" href="#/" data-open-tab="events"><strong>${store.events.length}</strong><span>acontecimientos</span></a>
      </div>
      ${unlocated.length ? section('Narraciones sin ubicación definida', list(unlocated.map((n) => narrativeItem(n)))) : ''}
      ${noPhase.length ? html`<p class="muted small">${plural(noPhase.length, 'acontecimiento no tiene', 'acontecimientos no tienen')} fase asignada todavía.</p>` : ''}
      ${issues.length ? html`<details class="issues"><summary>${plural(issues.length, 'aviso', 'avisos')} en los datos</summary><ul>${issues.map((i) => html`<li>${i}</li>`)}</ul></details>` : ''}
      <p class="ficha__source">${store.config.project.sourceNote}</p>`;
  }

  body.addEventListener('click', (ev) => {
    const spoilerBtn = ev.target.closest('[data-spoiler-toggle]');
    if (spoilerBtn) {
      const box = spoilerBtn.closest('[data-spoiler]');
      const key = box.dataset.spoiler;
      const open = !revealed.has(key);
      if (open) revealed.add(key); else revealed.delete(key);
      box.classList.toggle('is-revealed', open);
      const content = box.querySelector('.spoiler__content');
      content.toggleAttribute('inert', !open);
      if (open) content.removeAttribute('aria-hidden'); else content.setAttribute('aria-hidden', 'true');
      spoilerBtn.classList.toggle('spoiler__btn--hide', open);
      spoilerBtn.textContent = open ? 'Ocultar' : (key.endsWith(':epilogue') ? 'Mostrar despedida (contiene spoilers)' : 'Mostrar resumen (contiene spoilers)');
      if (open) content.focus?.();
      return;
    }
    const tabLink = ev.target.closest('[data-open-tab]');
    if (tabLink) {
      ev.preventDefault();
      update({ navTab: tabLink.dataset.openTab, drawerOpen: true });
    }
  });

  return { render };
}
