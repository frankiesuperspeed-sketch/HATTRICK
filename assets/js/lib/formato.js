/** Numeri, denaro e date, in italiano e senza dipendere dai dati di locale. */

const gruppi = (n) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const intero = (n) => (Number.isFinite(n) ? (n < 0 ? '−' : '') + gruppi(n) : '—');

export function decimale(n, cifre = 2) {
  if (!Number.isFinite(n)) return '—';
  const fisso = Math.abs(n).toFixed(cifre);
  const [parteIntera, parteDecimale] = fisso.split('.');
  const segno = n < 0 ? '−' : '';
  const testa = parteIntera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return segno + testa + (parteDecimale ? ',' + parteDecimale : '');
}

export const denaro = (n, valuta = '€') => (Number.isFinite(n) ? `${intero(n)} ${valuta}` : '—');

export const denaroSegnato = (n, valuta = '€') =>
  Number.isFinite(n) ? `${n > 0 ? '+' : ''}${intero(n)} ${valuta}` : '—';

/** 1.284 · 12,9 mila · 4,2 mln */
export function compatto(n, valuta) {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  const pezzo = a >= 1e6 ? `${decimale(n / 1e6, 1)} mln` : a >= 1e4 ? `${decimale(n / 1e3, 1)} mila` : intero(n);
  return valuta ? `${pezzo} ${valuta}` : pezzo;
}

export const percento = (frazione, cifre = 0) => (Number.isFinite(frazione) ? `${decimale(frazione * 100, cifre)} %` : '—');

export const SETTIMANE_PER_STAGIONE = 16;

export function settimane(n) {
  if (!Number.isFinite(n) || n < 0) return '—';
  const r = Math.round(n);
  return r === 1 ? '1 settimana' : `${intero(r)} settimane`;
}

export function stagioni(n) {
  if (!Number.isFinite(n) || n < 0) return '—';
  const tot = Math.round(n);
  const st = Math.floor(tot / SETTIMANE_PER_STAGIONE);
  const se = tot % SETTIMANE_PER_STAGIONE;
  if (st === 0) return settimane(se);
  return `${st} ${st === 1 ? 'stagione' : 'stagioni'}${se ? ` e ${se} sett.` : ''}`;
}
