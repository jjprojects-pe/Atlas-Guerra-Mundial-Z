// Small text helpers shared by every view.

export function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Markup that is already safe. `html` templates return it, so they can be nested freely.
class SafeHtml {
  constructor(markup) {
    this.markup = markup;
  }
  toString() {
    return this.markup;
  }
}

export function raw(markup) {
  return new SafeHtml(markup);
}

// Tagged template: escapes every interpolated value except nested SafeHtml.
export function html(strings, ...values) {
  const out = strings.reduce((acc, chunk, i) => acc + chunk + (i < values.length ? toHtml(values[i]) : ''), '');
  return new SafeHtml(out);
}

function toHtml(value) {
  if (value == null || value === false) return '';
  if (Array.isArray(value)) return value.map(toHtml).join('');
  if (value instanceof SafeHtml) return value.markup;
  return escapeHtml(value);
}

export function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}
