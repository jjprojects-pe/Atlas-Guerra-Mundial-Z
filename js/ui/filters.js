// Combinable filters. The form is built once; on each state change only its values are synced,
// so typing or clicking never loses focus.

import { html } from '../utils/text.js';
import { updateFilters, resetFilters, activeFilterCount } from '../state.js';

export function createFilters(root, store) {
  const { config } = store;
  const form = root.querySelector('[data-filters-form]');
  const counter = root.querySelector('[data-filters-count]');

  const check = (name, value, label) =>
    html`<label class="check"><input type="checkbox" name="${name}" value="${value}"> <span>${label}</span></label>`;

  form.innerHTML = String(html`
    <fieldset>
      <legend>Mostrar en el mapa</legend>
      <label class="check"><input type="checkbox" name="showScenes"> <span>Lugares del relato</span></label>
      <label class="check"><input type="checkbox" name="showInterviews"> <span>Lugares de entrevista 🎙️</span></label>
      <label class="check"><input type="checkbox" name="onlyWithEvents"> <span>Solo lugares con acontecimientos</span></label>
    </fieldset>
    <fieldset>
      <legend>Categoría</legend>
      ${Object.entries(config.categories).map(([id, c]) => check('categories', id, c.label))}
    </fieldset>
    <fieldset>
      <legend>Precisión de la ubicación</legend>
      ${check('precision', 'exact', 'Exacta')}
      ${check('precision', 'approximate', 'Aproximada')}
      ${check('precision', 'regional', 'Regional')}
    </fieldset>
    <fieldset>
      <legend>Ubicación de la narración</legend>
      <label class="check"><input type="radio" name="location" value="all"> <span>Todas</span></label>
      <label class="check"><input type="radio" name="location" value="with"> <span>Con ubicación</span></label>
      <label class="check"><input type="radio" name="location" value="without"> <span>Sin ubicación definida</span></label>
    </fieldset>
    <label class="field"><span>Sección del libro</span>
      <select name="bookSection"><option value="">Todas</option>${config.bookSections.map((s) => html`<option value="${s.id}">${s.label}</option>`)}</select>
    </label>
    <label class="field"><span>Narración</span>
      <select name="narrativeId"><option value="">Todas</option>${store.narratives.map((n) => html`<option value="${n.id}">${n.title} — ${store.narrativeMeta(n)}</option>`)}</select>
    </label>
    <button type="button" class="btn btn--ghost" data-reset>Quitar filtros</button>
  `);

  form.addEventListener('change', (ev) => {
    const { name } = ev.target;
    if (!name) return;
    if (name === 'categories' || name === 'precision') {
      const values = [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);
      updateFilters({ [name]: values });
    } else if (ev.target.type === 'checkbox') {
      updateFilters({ [name]: ev.target.checked });
    } else {
      updateFilters({ [name]: ev.target.value });
    }
  });
  form.querySelector('[data-reset]').addEventListener('click', resetFilters);

  function render(state) {
    const f = state.filters;
    form.showScenes.checked = f.showScenes;
    form.showInterviews.checked = f.showInterviews;
    form.onlyWithEvents.checked = f.onlyWithEvents;
    form.querySelectorAll('input[name="categories"]').forEach((i) => (i.checked = f.categories.includes(i.value)));
    form.querySelectorAll('input[name="precision"]').forEach((i) => (i.checked = f.precision.includes(i.value)));
    form.querySelectorAll('input[name="location"]').forEach((i) => (i.checked = i.value === f.location));
    form.bookSection.value = f.bookSection;
    form.narrativeId.value = f.narrativeId;
    const count = activeFilterCount(f);
    counter.textContent = count ? String(count) : '';
    counter.hidden = !count;
  }

  return { render };
}
