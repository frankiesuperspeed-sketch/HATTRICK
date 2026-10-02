/** Costruzione di nodi DOM senza librerie. */

const NS_SVG = 'http://www.w3.org/2000/svg';

export function h(tag, props, ...figli) {
  const el = document.createElement(tag);
  applica(el, props, false);
  aggiungi(el, figli);
  return el;
}

export function s(tag, props, ...figli) {
  const el = document.createElementNS(NS_SVG, tag);
  applica(el, props, true);
  aggiungi(el, figli);
  return el;
}

function applica(el, props, svg) {
  if (!props) return;
  for (const [chiave, valore] of Object.entries(props)) {
    if (valore == null || valore === false) continue;
    if (chiave === 'class') el.setAttribute('class', valore);
    else if (chiave === 'style' && typeof valore === 'object') Object.assign(el.style, valore);
    else if (chiave === 'dataset') Object.assign(el.dataset, valore);
    else if (chiave.startsWith('on') && typeof valore === 'function') el.addEventListener(chiave.slice(2).toLowerCase(), valore);
    else if (!svg && chiave === 'value' && 'value' in el) el.value = valore;
    else if (!svg && ['checked', 'disabled', 'selected'].includes(chiave)) el[chiave] = !!valore;
    else el.setAttribute(chiave, valore === true ? '' : valore);
  }
}

function aggiungi(el, figli) {
  for (const figlio of figli.flat(Infinity)) {
    if (figlio == null || figlio === false) continue;
    el.appendChild(figlio instanceof Node ? figlio : document.createTextNode(String(figlio)));
  }
}

export function rimpiazza(host, ...figli) {
  host.replaceChildren();
  aggiungi(host, figli);
  return host;
}

export const q = (sel, radice = document) => radice.querySelector(sel);
export const qq = (sel, radice = document) => [...radice.querySelectorAll(sel)];

/* ---------------------------------------------------------- componenti */

export function campoNumero({ etichetta, valore, onInput, passo = 1, min, max, nota, unita, id }) {
  return h('div', { class: 'campo' },
    etichetta ? h('label', { for: id }, etichetta, unita ? h('span', { class: 'tenue' }, ` (${unita})`) : null) : null,
    h('input', {
      type: 'number', value: valore ?? '', step: passo, id,
      min: min ?? null, max: max ?? null,
      oninput: (e) => {
        const n = e.target.value === '' ? null : Number(e.target.value);
        onInput(Number.isFinite(n) ? n : null);
      },
    }),
    nota ? h('span', { class: 'nota' }, nota) : null,
  );
}

export function campoTesto({ etichetta, valore, onInput, segnaposto, id }) {
  return h('div', { class: 'campo' },
    etichetta ? h('label', { for: id }, etichetta) : null,
    h('input', { type: 'text', value: valore ?? '', placeholder: segnaposto, id, oninput: (e) => onInput(e.target.value) }),
  );
}

export function campoScelta({ etichetta, valore, opzioni, onInput, id, nota }) {
  return h('div', { class: 'campo' },
    etichetta ? h('label', { for: id }, etichetta) : null,
    h('select', { id, onchange: (e) => onInput(e.target.value) },
      ...opzioni.map((o) => h('option', { value: o.valore, selected: String(o.valore) === String(valore) }, o.nome))),
    nota ? h('span', { class: 'nota' }, nota) : null,
  );
}

export function tabella({ intestazione, righe, piede, classeRiga }) {
  return h('div', { class: 'scorri' },
    h('table', null,
      h('thead', null, h('tr', null, ...intestazione.map((c, i) => h('th', { class: i === 0 ? null : 'num' }, c)))),
      h('tbody', null, ...righe.map((celle, i) => h('tr', { class: classeRiga ? classeRiga(i) : null },
        ...celle.map((c, j) => h('td', { class: j === 0 ? null : 'num' }, c))))),
      piede ? h('tfoot', null, h('tr', null, ...piede.map((c, j) => h('td', { class: j === 0 ? null : 'num' }, c)))) : null,
    ),
  );
}

export function valore({ etichetta, cifra, sotto, tono, grande }) {
  return h('div', { class: `valore${grande ? ' grande' : ''}` },
    h('div', { class: 'etichetta' }, etichetta),
    h('div', { class: `cifra${tono ? ' ' + tono : ''}` }, cifra),
    sotto ? h('div', { class: 'sotto' }, sotto) : null,
  );
}

export function riquadro({ titolo, sottotitolo, azioni, figli }) {
  return h('section', { class: 'riquadro' },
    titolo || sottotitolo || azioni
      ? h('header', null,
          h('div', null, titolo ? h('h2', null, titolo) : null, sottotitolo ? h('p', null, sottotitolo) : null),
          azioni || null)
      : null,
    ...[].concat(figli).filter(Boolean),
  );
}

/** Più avvisi in un riquadro solo: uno in fila, molti come elenco. */
export function avvisi(elenco) {
  if (!elenco?.length) return null;
  if (elenco.length === 1) return h('p', { class: 'avviso' }, elenco[0].testo);
  return h('div', { class: 'avviso' }, h('ul', null, ...elenco.map((a) => h('li', null, a.testo))));
}
