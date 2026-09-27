// Phase selector: one block per phase, in order. Clicking the active phase returns to the general map.

import { html } from '../utils/text.js';
import { hrefFor, HOME_HREF } from '../router.js';

export function createPhases(root, store) {
  function render(state) {
    root.innerHTML = String(html`
      <span class="phases__label">Fases</span>
      <ol class="phases__list">
        ${store.phases.map((p) => {
          const active = state.phaseId === p.id;
          const count = store.eventsOfPhase(p.id).length;
          return html`<li><a class="phase${active ? ' is-active' : ''}${count ? '' : ' is-empty'}" href="${active ? HOME_HREF : hrefFor('phase', p.id)}"
            title="${active ? 'Volver al mapa general' : `${p.name}: ${count} acontecimientos`}" ${active ? html`aria-current="true"` : ''}>
            <span class="phase__num">${p.order}</span><span class="phase__name">${p.name}</span></a></li>`;
        })}
      </ol>`);
  }
  return { render };
}
