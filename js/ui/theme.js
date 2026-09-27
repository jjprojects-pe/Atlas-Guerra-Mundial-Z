// Switches between the "Impreso" (paper atlas) and dark themes and remembers the choice.

import { update } from '../state.js';

const STORAGE_KEY = 'gmz-theme';
const LABELS = {
  print: '<span aria-hidden="true">☾</span><span class="hide-sm"> Modo oscuro</span>',
  dark: '<span aria-hidden="true">☀</span><span class="hide-sm"> Modo impreso</span>',
};

export function createThemeToggle(button) {
  const apply = (theme) => {
    document.documentElement.dataset.theme = theme;
    button.innerHTML = LABELS[theme];
    button.setAttribute('aria-label', theme === 'dark' ? 'Cambiar al modo impreso' : 'Cambiar al modo oscuro');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Private windows may block storage: the theme still changes for this visit.
    }
    update({ theme });
  };

  button.addEventListener('click', () => {
    apply(document.documentElement.dataset.theme === 'dark' ? 'print' : 'dark');
  });
  button.innerHTML = LABELS[document.documentElement.dataset.theme === 'dark' ? 'dark' : 'print'];
}
