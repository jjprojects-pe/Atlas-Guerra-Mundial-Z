// Collapsible legend explaining symbols, precision and the intensity scale.

import { html, plural } from '../utils/text.js';

const L = window.L;

export function createLegend(map, store, { onShowUnlocated }) {
  const control = L.control({ position: 'bottomright' });
  let container;
  let open = window.matchMedia('(min-width: 1200px) and (min-height: 820px)').matches;

  control.onAdd = () => {
    container = L.DomUtil.create('div', 'legend');
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    container.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-legend-toggle]')) {
        open = !open;
        draw();
      }
      if (ev.target.closest('[data-show-unlocated]')) onShowUnlocated();
    });
    draw();
    fitHeight();
    map.on('resize', fitHeight);
    return container;
  };

  // The legend never grows taller than the map; extra content scrolls.
  function fitHeight() {
    if (container) container.style.maxHeight = `${Math.max(120, map.getSize().y - 24)}px`;
  }

  function draw() {
    const unlocated = store.narratives.filter((n) => !store.narrativeHasLocation(n)).length;
    const groups = Object.entries(store.config.typeGroups).filter(([id]) => id !== 'entrevista');
    const steps = store.config.map.intensitySteps;
    const stepLabels = steps.map((s, i) => (i === steps.length - 1 ? `${s}+` : steps[i + 1] - 1 === s ? `${s}` : `${s}–${steps[i + 1] - 1}`));

    container.innerHTML = String(html`
      <button class="legend__toggle" type="button" data-legend-toggle aria-expanded="${open}">
        Leyenda <span aria-hidden="true">${open ? '▾' : '▸'}</span>
      </button>
      ${open ? html`<div class="legend__body">
        <p class="legend__title">Lugares (color = tipo)</p>
        <ul class="legend__list">
          ${groups.map(([, g]) => html`<li><span class="lg-dot" style="--mk-color:${g.color};--mk-color-dark:${g.colorDark ?? g.color}"></span>${g.label}</li>`)}
          <li><span class="lg-int">🎙️</span>Entrevista (posguerra)</li>
          <li><span class="lg-dot lg-dot--num">1</span>Parada con orden conocido</li>
        </ul>
        <p class="legend__title">Precisión</p>
        <ul class="legend__list">
          <li><span class="lg-dot" style="--mk-color:var(--muted)"></span>Exacta</li>
          <li><span class="lg-dot lg-dot--approx" style="--mk-color:var(--muted)"></span>Aproximada (con halo)</li>
          <li><span class="lg-label">Nombre</span>Regional (solo etiqueta)</li>
        </ul>
        <p class="legend__title">Narraciones por país</p>
        <div class="legend__scale">
          ${stepLabels.map((label, i) => html`<span class="lg-step" style="--step:${0.16 + i * 0.12}">${label}</span>`)}
        </div>
        <p class="legend__hint">Las regiones no suman: se indican aparte al pasar el cursor.</p>
        ${unlocated ? html`<button class="legend__unlocated" type="button" data-show-unlocated>${plural(unlocated, 'narración', 'narraciones')} sin ubicación definida →</button>` : ''}
      </div>` : ''}
    `);
  }

  control.addTo(map);
  return control;
}
