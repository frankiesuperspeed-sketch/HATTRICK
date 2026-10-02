/**
 * Barre orizzontali in SVG, scritte a mano.
 *
 * Regole tenute ferme: barre sottili con la punta arrotondata solo dal lato
 * del dato, 2px di stacco fatto di superficie tra barre adiacenti, griglia
 * recessiva, un solo asse dei valori, e la cifra sulla punta solo quando la
 * serie è una sola — con più serie il numero preciso sta nella tabella che
 * accompagna sempre il grafico.
 */

import { s, h } from './dom.js';

const LARGHEZZA = 640;
const STACCO = 2;
const PAUSA = 14;
const RAGGIO = 4;

export const COLORI = ['var(--serie-1)', 'var(--serie-2)', 'var(--serie-3)'];

export function barre({
  righe,
  serie = [{ nome: '', colore: COLORI[0] }],
  formato = (v) => String(Math.round(v)),
  didascalia,
  larghezzaNomi = 150,
  unita = '',
}) {
  const nSerie = Math.max(1, serie.length);
  const cifraSullaPunta = nSerie === 1;
  const spessore = nSerie === 1 ? 18 : 14;
  const altezzaGruppo = nSerie * spessore + (nSerie - 1) * STACCO;
  const passo = altezzaGruppo + PAUSA;

  const margineDestro = cifraSullaPunta ? 86 : 14;
  const x0 = larghezzaNomi;
  const x1 = LARGHEZZA - margineDestro;
  const altoAsse = 20;

  const massimo = Math.max(0, ...righe.flatMap((r) => r.valori.map((v) => (Number.isFinite(v) ? v : 0))));
  const { passo: tacca, massimo: cima } = scalaTonda(massimo);
  const larghezzaPlot = Math.max(1, x1 - x0);
  const scala = (v) => (cima === 0 ? 0 : (Math.max(0, v) / cima) * larghezzaPlot);

  const altezza = altoAsse + righe.length * passo;
  const svg = s('svg', {
    viewBox: `0 0 ${LARGHEZZA} ${altezza}`,
    role: 'img',
    'aria-label': didascalia || 'Grafico a barre',
    preserveAspectRatio: 'xMidYMid meet',
  });

  for (let v = 0; v <= cima + 1e-9; v += tacca) {
    const x = x0 + scala(v);
    svg.appendChild(s('line', { class: v === 0 ? 'linea-base' : 'linea-griglia', x1: x, x2: x, y1: altoAsse - 6, y2: altezza }));
    svg.appendChild(s('text', { class: 'asse', x, y: altoAsse - 11, 'text-anchor': v === 0 ? 'start' : 'middle' }, formato(v)));
  }

  righe.forEach((riga, i) => {
    const yGruppo = altoAsse + i * passo;
    svg.appendChild(s('text', {
      class: 'nome-barra', x: x0 - 10, y: yGruppo + altezzaGruppo / 2,
      'text-anchor': 'end', 'dominant-baseline': 'middle',
    }, accorcia(riga.nome, Math.floor(larghezzaNomi / 6.6))));

    riga.valori.forEach((v0, j) => {
      const v = Number.isFinite(v0) ? v0 : 0;
      const y = yGruppo + j * (spessore + STACCO);
      const w = scala(v);
      const colore = riga.colore || serie[j]?.colore || COLORI[j % COLORI.length];
      const barra = s('path', { class: 'segno', d: tracciato(x0, y, w, spessore), fill: colore });
      barra.appendChild(s('title', null, `${riga.nome} — ${serie[j]?.nome ? serie[j].nome + ': ' : ''}${formato(v)}${unita ? ' ' + unita : ''}`));
      svg.appendChild(barra);
      if (cifraSullaPunta) {
        svg.appendChild(s('text', { class: 'cifra-barra', x: x0 + w + 8, y: y + spessore / 2, 'dominant-baseline': 'middle' }, formato(v)));
      }
    });
  });

  return h('figure', { class: 'grafico' },
    didascalia ? h('figcaption', null, didascalia) : null,
    svg,
    serie.length >= 2
      ? h('div', { class: 'legenda' }, ...serie.map((sr) =>
          h('span', null, h('i', { class: 'tessera', style: { background: sr.colore } }), sr.nome)))
      : null,
  );
}

function tracciato(x, y, w, alt) {
  const r = Math.min(RAGGIO, alt / 2, Math.max(0, w));
  if (w <= 0.5) return `M${x},${y} h0.5 v${alt} h-0.5 Z`;
  if (r <= 0.5) return `M${x},${y} h${w} v${alt} h${-w} Z`;
  return `M${x},${y} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${alt - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(w - r)} Z`;
}

/** Tacche su numeri tondi: 1, 2, 5 per potenze di dieci. */
export function scalaTonda(massimo, tacche = 4) {
  if (!Number.isFinite(massimo) || massimo <= 0) return { passo: 1, massimo: 1 };
  const grezzo = massimo / tacche;
  const mag = Math.pow(10, Math.floor(Math.log10(grezzo)));
  const norm = grezzo / mag;
  const passo = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  return { passo, massimo: Math.ceil(massimo / passo) * passo };
}

const accorcia = (t, max) => {
  const testo = String(t ?? '');
  return testo.length <= max ? testo : testo.slice(0, Math.max(1, max - 1)) + '…';
};
