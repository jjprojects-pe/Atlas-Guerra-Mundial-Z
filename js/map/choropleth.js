// Countries painted by intensity (general and phase modes) or flat (narrative mode).

import { html, plural } from '../utils/text.js';
import { hrefFor } from '../router.js';
import { intensityLevel } from '../data/query.js';

const L = window.L;
const OPACITY = [0, 0.16, 0.28, 0.4, 0.52, 0.64];

export function createChoropleth(map, store) {
  const steps = store.config.map.intensitySteps;
  let model = null;
  // Colours come from the CSS theme, so switching theme only needs a re-render.
  let colors = readColors();

  const layer = L.geoJSON(store.countries, {
    style: () => baseStyle(),
    onEachFeature: (feature, countryLayer) => {
      countryLayer.bindTooltip('', { sticky: true, className: 'country-tip', opacity: 1 });
      countryLayer.on('click', (ev) => {
        const content = popupFor(feature.properties.iso);
        if (content) L.popup({ className: 'atlas-popup', maxWidth: 300 }).setLatLng(ev.latlng).setContent(content).openOn(map);
      });
    },
  }).addTo(map);

  function readColors() {
    const css = getComputedStyle(document.documentElement);
    return {
      accent: css.getPropertyValue('--map-accent').trim() || '#a0521d',
      line: css.getPropertyValue('--country-line').trim() || '#6d5a3d',
    };
  }

  function baseStyle() {
    return { color: colors.line, weight: 0.5, opacity: 0.35, fillColor: colors.accent, fillOpacity: 0 };
  }

  function styleFor(iso) {
    const entry = model?.countries.get(iso);
    if (!entry) return baseStyle();
    if (model.mode === 'narrative') {
      return { color: colors.accent, weight: 1.2, opacity: 0.9, fillColor: colors.accent, fillOpacity: 0.32 };
    }
    const level = intensityLevel(entry.direct.size, steps);
    if (!level) return { ...baseStyle(), color: colors.accent, opacity: 0.55, weight: 0.8, dashArray: '3 3' };
    return { color: colors.accent, weight: 0.8, opacity: 0.7, fillColor: colors.accent, fillOpacity: OPACITY[level] };
  }

  function tooltipFor(iso, name) {
    const entry = model?.countries.get(iso);
    if (!entry) return html`<strong>${name}</strong><br><span class="muted">Sin narraciones con los filtros actuales</span>`;
    const regionalNames = [...new Set([...entry.regional.values()].flat())];
    if (model.mode === 'narrative') {
      return html`<strong>${name}</strong><br>Escenario de esta narración${regionalNames.length ? html`<br><span class="muted">Por región: ${regionalNames.join(', ')}</span>` : ''}`;
    }
    const regionalOnly = [...entry.regional.keys()].filter((id) => !entry.direct.has(id)).length;
    return html`<strong>${name}</strong> — ${plural(entry.direct.size, 'narración', 'narraciones')}
      ${regionalOnly ? html`<br><span class="muted">Además, ${plural(regionalOnly, 'narración', 'narraciones')} en una región de este país (${regionalNames.join(', ')}), no ${regionalOnly === 1 ? 'incluida' : 'incluidas'} en la cuenta</span>` : ''}`;
  }

  function popupFor(iso) {
    const entry = model?.countries.get(iso);
    if (!entry) return null;
    const ids = [...new Set([...entry.direct, ...entry.regional.keys()])];
    const items = ids.map((id) => {
      const n = store.get(id);
      const note = entry.direct.has(id) ? '' : ` (por región: ${entry.regional.get(id).join(', ')})`;
      return html`<li><a href="${hrefFor('narrative', id)}">${n.title}</a><span class="muted"> · ${store.narrativeMeta(n)}${note}</span></li>`;
    });
    return String(html`<div class="pop"><p class="pop__kicker">País</p><h3 class="pop__title">${store.countryName(iso)}</h3><ul class="pop__list">${items}</ul></div>`);
  }

  return {
    render(nextModel) {
      model = nextModel;
      colors = readColors();
      layer.eachLayer((countryLayer) => {
        const { iso, name } = countryLayer.feature.properties;
        countryLayer.setStyle(styleFor(iso));
        countryLayer.setTooltipContent(String(tooltipFor(iso, name)));
      });
    },
    bounds(isoList) {
      const bounds = L.latLngBounds([]);
      layer.eachLayer((countryLayer) => {
        if (isoList.includes(countryLayer.feature.properties.iso)) bounds.extend(countryLayer.getBounds());
      });
      return bounds;
    },
  };
}
