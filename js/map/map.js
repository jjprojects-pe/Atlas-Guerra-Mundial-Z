// Creates the Leaflet map and redraws its layers whenever the state changes.

import { buildMapModel } from '../data/query.js';
import { createChoropleth } from './choropleth.js';
import { createLegend } from './legend.js';
import { placeIcon, interviewIcon, placePopup, interviewPopup } from './markers.js';
import { update, updateFilters } from '../state.js';

const L = window.L;

export function createMap(element, store) {
  const { map: settings } = store.config;
  const map = L.map(element, {
    center: settings.center,
    zoom: settings.zoom,
    minZoom: settings.minZoom,
    maxZoom: settings.maxZoom,
    worldCopyJump: true,
    zoomControl: false,
  });
  L.control.zoom({ position: 'bottomleft', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map);

  L.tileLayer(settings.tileUrl, {
    attribution: settings.tileAttribution,
    className: 'tiles-themed',
    maxZoom: settings.maxZoom,
  }).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');

  const choropleth = createChoropleth(map, store);
  const halos = L.layerGroup().addTo(map);
  const markers = L.layerGroup().addTo(map);
  const banner = element.parentElement.querySelector('[data-map-banner]');

  createLegend(map, store, {
    onShowUnlocated: () => {
      updateFilters({ location: 'without' });
      update({ navTab: 'narratives', drawerOpen: true });
    },
  });

  let lastFocusKey = null;

  function render(state) {
    const model = buildMapModel(store, state);
    choropleth.render(model);
    halos.clearLayers();
    markers.clearLayers();

    const radius = settings.approximateRadiusKm * 1000;
    const focus = [];

    for (const entry of model.places.values()) {
      const { record } = entry;
      const isRegion = store.kindOf(record.id) === 'region';
      const latlng = isRegion ? record.labelCoords : record.coords;
      const highlighted = model.highlight?.has(record.id);
      if (!isRegion && record.precision === 'approximate') {
        L.circle(latlng, {
          radius,
          interactive: false,
          className: `halo${model.highlight && !highlighted ? ' is-dimmed' : ''}`,
        }).addTo(halos);
      }
      const marker = L.marker(latlng, {
        icon: placeIcon(store, entry, model.highlight),
        keyboard: true,
        title: record.name,
        zIndexOffset: highlighted || entry.order != null ? 500 : 0,
        riseOnHover: true,
      });
      marker.bindPopup(() => placePopup(store, record), { className: 'atlas-popup', maxWidth: 300 });
      marker.addTo(markers);
      if (model.mode === 'narrative' || highlighted) focus.push(latlng);
    }

    for (const entry of model.interviews.values()) {
      const sharesSpot = model.places.has(entry.record.id);
      const highlighted = model.highlight?.has(entry.record.id);
      const marker = L.marker(entry.record.coords, {
        icon: interviewIcon(store, entry, { highlight: model.highlight, showLabel: model.mode === 'narrative', offset: sharesSpot }),
        title: `Entrevista: ${entry.record.name}`,
        zIndexOffset: 800,
        riseOnHover: true,
      });
      marker.bindPopup(() => interviewPopup(store, entry), { className: 'atlas-popup', maxWidth: 300 });
      marker.addTo(markers);
      if (model.mode === 'narrative' || highlighted) focus.push(entry.record.coords);
    }

    if (banner) {
      banner.hidden = !model.banner;
      banner.textContent = model.banner ?? '';
    }

    refocus(state, model, focus);
  }

  // Moves the camera only when the thing being looked at changes, not on every filter tweak.
  function refocus(state, model, focus) {
    const key = `${model.mode}|${state.selection?.kind ?? ''}|${state.selection?.id ?? ''}|${state.phaseId ?? ''}`;
    if (key === lastFocusKey) return;
    lastFocusKey = key;

    if (focus.length) return fit(L.latLngBounds(focus));
    if (model.mode === 'narrative' && model.countries.size) {
      const countryBounds = choropleth.bounds([...model.countries.keys()]);
      if (countryBounds.isValid()) return fit(countryBounds);
    }
    if (!state.selection) map.flyTo(settings.center, settings.zoom, { duration: 0.8 });
  }

  function fit(bounds) {
    const narrow = window.matchMedia('(max-width: 899px)').matches;
    const pad = narrow ? 30 : 60;
    // Keep markers out from under the legend when it is expanded on the right.
    const legend = map.getContainer().querySelector('.legend');
    const mapWidth = map.getSize().x;
    const legendWidth = legend && legend.offsetWidth < mapWidth * 0.45 ? legend.offsetWidth + 24 : 0;
    map.flyToBounds(bounds, {
      paddingTopLeft: [pad, pad + 40], // room for the context chip and interview labels
      paddingBottomRight: [Math.max(pad, legendWidth), pad],
      maxZoom: 6,
      duration: 0.8,
    });
  }

  return {
    render,
    invalidate: () => map.invalidateSize(),
  };
}
