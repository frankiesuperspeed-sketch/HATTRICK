/**
 * Tattiche: come una scelta tattica sposta i valori dei tre reparti.
 *
 * ⚠️ Hattrick descrive le tattiche a parole, non con numeri: quanto ciascuna
 * sposti i rating non è pubblicato. Gli effetti qui sotto sono STIME dichiarate
 * e modificabili, e ogni funzione li riceve da fuori. La domanda a cui la
 * scheda risponde bene è comunque relativa, non assoluta: *quale* tattica
 * rende di più con la rosa che hai.
 *
 * Il modello: ogni tattica ha un'abilità determinante e una forza, che nasce
 * dai giocatori schierati che possiedono quell'abilità. La forza scala gli
 * effetti, espressi come variazione percentuale di ciascun reparto.
 */

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? NaN : Number(v));
const oZero = (v) => (Number.isFinite(num(v)) ? num(v) : 0);

export const TATTICHE_PREDEFINITE = [
  { id: 'nessuna',     nome: 'Nessuna tattica',    abilita: null,       effetti: { difesa: 0,     centrocampo: 0,     attacco: 0 } },
  { id: 'pressing',    nome: 'Pressing',           abilita: 'difesa',   effetti: { difesa: 0.10,  centrocampo: -0.08, attacco: -0.02 } },
  { id: 'contropiede', nome: 'Contropiede',        abilita: 'difesa',   effetti: { difesa: 0.06,  centrocampo: -0.12, attacco: 0.10 } },
  { id: 'ali',         nome: 'Attacco sulle ali',  abilita: 'cross',    effetti: { difesa: -0.02, centrocampo: -0.05, attacco: 0.12 } },
  { id: 'centro',      nome: 'Attacco al centro',  abilita: 'passaggi', effetti: { difesa: -0.02, centrocampo: -0.05, attacco: 0.12 } },
  { id: 'creativo',    nome: 'Gioco creativo',     abilita: 'passaggi', effetti: { difesa: -0.03, centrocampo: 0.08,  attacco: 0.04 } },
  { id: 'tiri',        nome: 'Tiri da fuori area', abilita: 'punizioni',effetti: { difesa: 0,     centrocampo: -0.04, attacco: 0.08 } },
];

/** Abilità di riferimento: a questo livello la tattica esprime tutto il suo effetto. */
export const LIVELLO_PIENO = 10;

/**
 * Forza della tattica, dai giocatori schierati che hanno l'abilità richiesta.
 * Chi non ce l'ha inserita non entra nella media, invece di abbassarla a zero.
 */
export function forzaTattica({ tattica, schieramento = [], giocatori = [], livelloPieno = LIVELLO_PIENO }) {
  if (!tattica?.abilita) return { livello: null, forza: 0, contributori: [] };

  const perId = new Map(giocatori.map((g) => [g.id, g]));
  const contributori = schieramento
    .map((r) => perId.get(r.giocatoreId))
    .filter(Boolean)
    .map((g) => ({ nome: g.nome, livello: num(g.abilita?.[tattica.abilita]) }))
    .filter((c) => Number.isFinite(c.livello))
    .sort((a, b) => b.livello - a.livello);

  if (!contributori.length) return { livello: null, forza: 0, contributori: [] };

  const livello = contributori.reduce((acc, c) => acc + c.livello, 0) / contributori.length;
  const pieno = Math.max(1, oZero(livelloPieno) || LIVELLO_PIENO);
  return { livello, forza: Math.max(0, livello / pieno), contributori };
}

/** Applica gli effetti di una tattica ai valori dei reparti. */
export function applicaTattica({ settori, tattica, forza = 1 }) {
  const fuori = {};
  for (const [chiave, valore] of Object.entries(settori ?? {})) {
    const effetto = oZero(tattica?.effetti?.[chiave]);
    fuori[chiave] = oZero(valore) * (1 + effetto * Math.max(0, oZero(forza)));
  }
  return fuori;
}

/**
 * Mette a confronto tutte le tattiche sulla stessa formazione: per ciascuna,
 * la forza che la tua rosa le dà e come sposta i reparti.
 */
export function confrontaTattiche({
  settori,
  schieramento = [],
  giocatori = [],
  tattiche = TATTICHE_PREDEFINITE,
  livelloPieno = LIVELLO_PIENO,
  pesi = { difesa: 1, centrocampo: 1, attacco: 1 },
}) {
  const base = settori ?? {};
  const valuta = (s) => Object.entries(s).reduce((acc, [k, v]) => acc + oZero(v) * oZero(pesi[k] ?? 1), 0);
  const punteggioBase = valuta(base);

  return tattiche.map((tattica) => {
    const { livello, forza, contributori } = forzaTattica({ tattica, schieramento, giocatori, livelloPieno });
    const risultato = applicaTattica({ settori: base, tattica, forza: tattica.abilita ? forza : 1 });
    const punteggio = valuta(risultato);
    return {
      tattica,
      livello,
      forza: tattica.abilita ? forza : null,
      contributori,
      settori: risultato,
      variazioni: Object.fromEntries(Object.keys(base).map((k) => [k, oZero(risultato[k]) - oZero(base[k])])),
      punteggio,
      guadagno: punteggio - punteggioBase,
    };
  }).sort((a, b) => b.punteggio - a.punteggio);
}
