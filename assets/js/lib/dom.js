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

/**
 * Sostituisce il contenuto di un nodo conservando il fuoco: le schede si
 * ridisegnano a ogni modifica, e senza questo chi sta scrivendo in un campo
 * se lo vedrebbe sfilare da sotto le dita a ogni tasto.
 */
export function rimpiazza(host, ...figli) {
  const memoria = fuocoDa(host);
  host.replaceChildren();
  aggiungi(host, figli);
  if (memoria) ripristinaFuoco(host, memoria);
  return host;
}

function fuocoDa(host) {
  const attivo = document.activeElement;
  if (!attivo || attivo === document.body || !host.contains(attivo)) return null;
  let inizio = null;
  let fine = null;
  // su alcuni tipi di campo leggere la selezione solleva un'eccezione
  try { inizio = attivo.selectionStart; fine = attivo.selectionEnd; } catch { /* senza selezione */ }
  return {
    chiave: attivo.dataset?.chiave || null,
    via: percorso(attivo, host),
    tag: attivo.tagName,
    tipo: attivo.type || null,
    inizio, fine,
  };
}

function ripristinaFuoco(host, m) {
  let bersaglio = m.chiave ? host.querySelector(`[data-chiave="${CSS.escape(m.chiave)}"]`) : null;
  if (!bersaglio && m.via) {
    // senza chiave si ritrova il campo per posizione, ma solo se nello stesso
    // posto c'è davvero un campo dello stesso tipo
    const candidato = seguiPercorso(host, m.via);
    if (candidato?.tagName === m.tag && (candidato.type || null) === m.tipo) bersaglio = candidato;
  }
  if (typeof bersaglio?.focus !== 'function') return;
  bersaglio.focus({ preventScroll: true });
  if (m.inizio != null) {
    try { bersaglio.setSelectionRange(m.inizio, m.fine); } catch { /* senza selezione */ }
  }
}

function percorso(nodo, radice) {
  const via = [];
  let n = nodo;
  while (n && n !== radice) {
    const genitore = n.parentNode;
    if (!genitore) return null;
    via.push([...genitore.childNodes].indexOf(n));
    n = genitore;
  }
  return n === radice ? via.reverse() : null;
}

function seguiPercorso(radice, via) {
  let n = radice;
  for (const i of via) {
    n = n?.childNodes[i];
    if (!n) return null;
  }
  return n;
}

export const q = (sel, radice = document) => radice.querySelector(sel);
export const qq = (sel, radice = document) => [...radice.querySelectorAll(sel)];

/* ---------------------------------------------------------- componenti */

export function campoNumero({ etichetta, valore, onInput, passo = 1, min, max, nota, unita, id, chiave }) {
  return h('div', { class: 'campo' },
    etichetta ? h('label', { for: id }, etichetta, unita ? h('span', { class: 'tenue' }, ` (${unita})`) : null) : null,
    h('input', {
      type: 'number', value: valore ?? '', step: passo, id,
      min: min ?? null, max: max ?? null,
      dataset: chiave ? { chiave } : null,
      oninput: (e) => {
        const n = e.target.value === '' ? null : Number(e.target.value);
        onInput(Number.isFinite(n) ? n : null);
      },
    }),
    nota ? h('span', { class: 'nota' }, nota) : null,
  );
}

export function campoTesto({ etichetta, valore, onInput, segnaposto, id, chiave }) {
  return h('div', { class: 'campo' },
    etichetta ? h('label', { for: id }, etichetta) : null,
    h('input', {
      type: 'text', value: valore ?? '', placeholder: segnaposto, id,
      dataset: chiave ? { chiave } : null,
      oninput: (e) => onInput(e.target.value),
    }),
  );
}

export function campoScelta({ etichetta, valore, opzioni, onInput, id, nota, chiave }) {
  return h('div', { class: 'campo' },
    etichetta ? h('label', { for: id }, etichetta) : null,
    h('select', { id, dataset: chiave ? { chiave } : null, onchange: (e) => onInput(e.target.value) },
      ...opzioni.map((o) => h('option', { value: o.valore, selected: String(o.valore) === String(valore) }, o.nome))),
    nota ? h('span', { class: 'nota' }, nota) : null,
  );
}

/**
 * Cursore con la cifra accanto all'etichetta e, se servono, le tacche di
 * riferimento sotto: le tacche stanno al loro posto sulla scala, non a
 * distanze uguali.
 */
export function campoCursore({ etichetta, valore, min = 0, max = 100, passo = 1, onInput, nota, marche, testoValore, id, chiave }) {
  const v = Number.isFinite(valore) ? valore : min;
  const intervallo = max - min || 1;
  const testo = (x) => (typeof testoValore === 'function' ? testoValore(x) : testoValore);
  const cifra = testoValore != null ? h('span', { class: 'cifra-cursore' }, testo(v)) : null;
  return h('div', { class: 'campo cursore' },
    etichetta ? h('label', { for: id }, etichetta, cifra) : null,
    h('input', {
      type: 'range', id, min, max, step: passo, value: v,
      dataset: chiave ? { chiave } : null,
      // mentre si trascina si aggiorna solo la cifra accanto all'etichetta:
      // ridisegnare la scheda a ogni pixel interromperebbe il trascinamento
      oninput: (e) => { if (cifra) cifra.textContent = testo(Number(e.target.value)); },
      onchange: (e) => onInput(Number(e.target.value)),
    }),
    marche?.length
      ? h('div', { class: 'marche' }, ...marche.map((m) => h('span', {
          style: { left: `${((m.valore - min) / intervallo) * 100}%` },
          class: m.tono || null,
        }, m.testo)))
      : null,
    nota ? h('span', { class: 'nota' }, nota) : null,
  );
}

/** Scelta fra pochi valori, tutti visibili: un gruppo di pulsanti collegati. */
export function segmenti({ valore, opzioni, onInput, etichetta }) {
  return h('div', { class: 'gruppo-segmenti' },
    etichetta ? h('span', { class: 'etichetta-segmenti' }, etichetta) : null,
    h('div', { class: 'segmenti', role: 'group', 'aria-label': etichetta || null },
      ...opzioni.map((o) => h('button', {
        type: 'button',
        'aria-pressed': String(o.valore) === String(valore) ? 'true' : 'false',
        onclick: () => onInput(o.valore),
      }, o.nome)),
    ),
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
