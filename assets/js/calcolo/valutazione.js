/**
 * Valutazione di un giocatore.
 *
 * Hattrick non pubblica alcuna formula del valore di mercato: ogni costante
 * "ufficiale" sarebbe inventata. Qui si fa il contrario — il modello si tara
 * sulle vendite che osservi tu.
 *
 * Il modello è una regressione sui logaritmi:
 *
 *     ln(prezzo) = a + b · abilità + c · età
 *
 * cioè il prezzo cresce in modo moltiplicativo con l'abilità (ogni livello in
 * più vale una percentuale in più, non una cifra fissa) e cala con l'età. Con
 * almeno tre osservazioni i coefficienti vengono calcolati dai tuoi dati; sotto
 * quella soglia si usa un modello di partenza, dichiarato come tale.
 */

/** Vuoto e nullo NON sono zero: Number(null) vale 0 e farebbe passare per
 *  validi dei campi mai compilati. */
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? NaN : Number(v));

/**
 * Modello di partenza, usato solo finché non hai osservazioni tue.
 * Corrisponde a circa 200.000 per un giocatore di abilità 8 e 20 anni,
 * con ogni livello che vale circa l'80% in più e ogni anno circa il 7% in meno.
 * Sono stime: servono a non lasciare la pagina vuota, non a essere esatte.
 */
export const MODELLO_PREDEFINITO = { a: 8.954, b: 0.588, c: -0.0726, origine: 'predefinito', n: 0 };

/** Risolve un sistema 3×3 con eliminazione di Gauss e pivot parziale. */
function risolvi3(M, v) {
  const A = M.map((riga, i) => [...riga, v[i]]);
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    if (Math.abs(A[pivot][col]) < 1e-12) return null; // sistema senza soluzione unica
    [A[col], A[pivot]] = [A[pivot], A[col]];
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const fattore = A[r][col] / A[col][col];
      for (let k = col; k < 4; k++) A[r][k] -= fattore * A[col][k];
    }
  }
  return [A[0][3] / A[0][0], A[1][3] / A[1][1], A[2][3] / A[2][2]];
}

/** Osservazioni utilizzabili: prezzo e abilità positivi, età sensata. */
export function osservazioniValide(osservazioni = []) {
  return osservazioni.filter((o) => {
    const prezzo = num(o?.prezzo), abilita = num(o?.abilita), eta = num(o?.eta);
    return prezzo > 0 && Number.isFinite(abilita) && abilita >= 0 && Number.isFinite(eta) && eta > 0;
  });
}

/**
 * Calcola il modello dalle osservazioni. Restituisce anche R², cioè quanta
 * parte della variabilità dei prezzi il modello riesce a spiegare.
 */
export function adattaModello(osservazioni = []) {
  const dati = osservazioniValide(osservazioni);
  if (dati.length < 3) return null;

  let n = 0, sx = 0, sy = 0, sl = 0, sxx = 0, syy = 0, sxy = 0, sxl = 0, syl = 0;
  for (const o of dati) {
    const x = num(o.abilita), y = num(o.eta), l = Math.log(num(o.prezzo));
    n++; sx += x; sy += y; sl += l;
    sxx += x * x; syy += y * y; sxy += x * y;
    sxl += x * l; syl += y * l;
  }

  const coef = risolvi3([[n, sx, sy], [sx, sxx, sxy], [sy, sxy, syy]], [sl, sxl, syl]);
  if (!coef) return null;
  const [a, b, c] = coef;
  if (![a, b, c].every(Number.isFinite)) return null;

  const mediaLog = sl / n;
  let residui = 0, totale = 0;
  for (const o of dati) {
    const l = Math.log(num(o.prezzo));
    const previsto = a + b * num(o.abilita) + c * num(o.eta);
    residui += (l - previsto) ** 2;
    totale += (l - mediaLog) ** 2;
  }
  const r2 = totale > 0 ? 1 - residui / totale : 1;

  return {
    a, b, c, n,
    r2: Math.max(0, Math.min(1, r2)),
    origine: 'osservazioni',
    // letti come fattori moltiplicativi, sono molto più parlanti dei coefficienti
    fattoreAbilita: Math.exp(b),
    fattoreEta: Math.exp(c),
  };
}

/** Prezzo stimato per un giocatore, dato un modello. */
export function stimaPrezzo({ abilita, eta, modello = MODELLO_PREDEFINITO }) {
  const x = num(abilita), y = num(eta);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !modello) return null;
  const prezzo = Math.exp(modello.a + modello.b * x + modello.c * y);
  return Number.isFinite(prezzo) && prezzo > 0 ? prezzo : null;
}

/** Confronto fra prezzo richiesto e stima: quanto si discosta, e da che parte. */
export function confronta({ richiesto, stimato }) {
  const r = num(richiesto), s = num(stimato);
  if (!(r > 0) || !(s > 0)) return null;
  const scarto = (r - s) / s;
  const giudizio = scarto <= -0.25 ? 'occasione'
    : scarto <= -0.08 ? 'conveniente'
    : scarto < 0.08 ? 'in linea'
    : scarto < 0.25 ? 'caro'
    : 'molto caro';
  return { richiesto: r, stimato: s, differenza: r - s, scarto, giudizio };
}

/** Come cambia la stima al variare dell'abilità, a parità di età. */
export function curvaAbilita({ eta, modello = MODELLO_PREDEFINITO, da = 5, a = 15 }) {
  const punti = [];
  for (let x = Math.round(da); x <= Math.round(a); x++) {
    punti.push({ abilita: x, prezzo: stimaPrezzo({ abilita: x, eta, modello }) });
  }
  return punti;
}

/** Come cambia la stima al variare dell'età, a parità di abilità. */
export function curvaEta({ abilita, modello = MODELLO_PREDEFINITO, da = 17, a = 34 }) {
  const punti = [];
  for (let y = Math.round(da); y <= Math.round(a); y++) {
    punti.push({ eta: y, prezzo: stimaPrezzo({ abilita, eta: y, modello }) });
  }
  return punti;
}
