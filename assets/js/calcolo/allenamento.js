/**
 * Allenamento: quanto cresce chi alleni e quando arrivano gli scatti.
 *
 * ⚠️ Hattrick non pubblica la formula dell'allenamento. Questo è un modello
 * trasparente e scomposto in fattori indipendenti, tutti modificabili: serve a
 * confrontare piani, non a indovinare la settimana esatta. Per riportarlo alla
 * realtà c'è `calibraVelocita`, che riallinea la velocità di base alle
 * settimane che hai osservato davvero in gioco.
 */

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? NaN : Number(v));
const oZero = (v) => (Number.isFinite(num(v)) ? num(v) : 0);

export const SETTIMANE_PER_STAGIONE = 16;
const MAX_SETTIMANE = 520;

/** Ogni allenamento: quale abilità sviluppa, su quali ruoli, e quanto è rapido. */
export const ALLENAMENTI_PREDEFINITI = [
  { id: 'portieri',   nome: 'Portieri',    abilita: 'portiere',   ruoli: ['portiere'], velocita: 0.75 },
  { id: 'difesa',     nome: 'Difesa',      abilita: 'difesa',     ruoli: ['difensore', 'terzino'], velocita: 0.60 },
  { id: 'regia',      nome: 'Regia',       abilita: 'regia',      ruoli: ['centrocampista'], velocita: 0.50 },
  { id: 'passaggi',   nome: 'Passaggi',    abilita: 'passaggi',   ruoli: ['centrocampista', 'attaccante'], velocita: 0.55 },
  { id: 'cross',      nome: 'Cross',       abilita: 'cross',      ruoli: ['ala', 'terzino'], velocita: 1.00 },
  { id: 'attacco',    nome: 'Attacco',     abilita: 'attacco',    ruoli: ['attaccante'], velocita: 0.80 },
  { id: 'punizioni',  nome: 'Punizioni',   abilita: 'punizioni',  ruoli: ['portiere', 'difensore', 'terzino', 'centrocampista', 'ala', 'attaccante'], velocita: 0.45 },
  { id: 'resistenza', nome: 'Resistenza',  abilita: 'resistenza', ruoli: ['portiere', 'difensore', 'terzino', 'centrocampista', 'ala', 'attaccante'], velocita: 0.90 },
];

export const PARAMETRI_PREDEFINITI = {
  // livelli guadagnati a settimana nelle condizioni di riferimento
  velocitaBase: 0.155,
  riferimento: { eta: 20, livello: 8 },
  allenatore: { 4: 0.82, 5: 0.88, 6: 0.94, 7: 1, 8: 1.05 },
  bonusAssistente: 0.015,
  eta: {
    17: 1.40, 18: 1.26, 19: 1.12, 20: 1.00, 21: 0.89, 22: 0.79, 23: 0.70, 24: 0.62,
    25: 0.55, 26: 0.48, 27: 0.42, 28: 0.36, 29: 0.31, 30: 0.26, 31: 0.22, 32: 0.18, 33: 0.15,
  },
  // ogni livello già raggiunto rallenta il successivo
  decadimentoLivello: 0.88,
  settimanePerStagione: SETTIMANE_PER_STAGIONE,
};

/** Moltiplicatore per età, interpolato fra i valori della tabella. */
export function fattoreEta(eta, tabella = PARAMETRI_PREDEFINITI.eta) {
  const chiavi = Object.keys(tabella).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!chiavi.length) return 1;
  const e = num(eta);
  if (!Number.isFinite(e)) return 1;
  if (e <= chiavi[0]) return oZero(tabella[chiavi[0]]);
  if (e >= chiavi[chiavi.length - 1]) return oZero(tabella[chiavi[chiavi.length - 1]]);
  const dopo = chiavi.find((k) => k >= e);
  const prima = [...chiavi].reverse().find((k) => k <= e);
  if (prima === dopo) return oZero(tabella[prima]);
  const t = (e - prima) / (dopo - prima);
  return oZero(tabella[prima]) * (1 - t) + oZero(tabella[dopo]) * t;
}

/** Moltiplicatore dell'allenatore: fuori tabella vale il livello più vicino. */
export function fattoreAllenatore(livello, tabella = PARAMETRI_PREDEFINITI.allenatore) {
  const chiavi = Object.keys(tabella).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!chiavi.length) return 1;
  const l = num(livello);
  if (!Number.isFinite(l)) return 1;
  const vicina = chiavi.reduce((best, k) => (Math.abs(k - l) < Math.abs(best - l) ? k : best), chiavi[0]);
  return oZero(tabella[vicina]);
}

/** Chi riceve questo allenamento, in base al ruolo. */
export function giocatoriAllenati({ giocatori = [], allenamento }) {
  if (!allenamento?.ruoli?.length) return [];
  return giocatori.filter((g) => allenamento.ruoli.includes(g.ruolo));
}

/**
 * Livelli guadagnati in una settimana da un giocatore.
 * `livello` è quello attuale nell'abilità allenata.
 */
export function crescitaSettimanale({ giocatore, livello, allenamento, impostazioni = {}, parametri = PARAMETRI_PREDEFINITI }) {
  const p = { ...PARAMETRI_PREDEFINITI, ...parametri };
  const l = num(livello);
  if (!Number.isFinite(l)) return { crescita: 0, fattori: null };

  const fattori = {
    base: oZero(p.velocitaBase),
    allenamento: oZero(allenamento?.velocita ?? 1),
    allenatore: fattoreAllenatore(impostazioni.allenatore, p.allenatore),
    assistenti: 1 + oZero(p.bonusAssistente) * oZero(impostazioni.assistenti),
    eta: fattoreEta(giocatore?.eta, p.eta),
    livello: Math.pow(oZero(p.decadimentoLivello) || 1, l - oZero(p.riferimento?.livello)),
    intensita: Math.min(1, Math.max(0, oZero(impostazioni.intensita ?? 100) / 100)),
    resistenza: Math.max(0, 1 - Math.min(100, Math.max(0, oZero(impostazioni.quotaResistenza))) / 100),
  };

  const crescita = Object.values(fattori).reduce((acc, f) => acc * f, 1);
  return { crescita: Math.max(0, crescita), fattori };
}

/**
 * Simula l'allenamento settimana per settimana: il giocatore invecchia (una
 * stagione = 16 settimane) e ogni livello raggiunto rallenta il successivo.
 */
export function proietta({
  giocatore,
  livello,
  sublivello = 0,
  allenamento,
  impostazioni = {},
  parametri = PARAMETRI_PREDEFINITI,
  settimane = SETTIMANE_PER_STAGIONE,
  dataInizio = new Date(),
}) {
  const p = { ...PARAMETRI_PREDEFINITI, ...parametri };
  const perStagione = Math.max(1, Math.round(oZero(p.settimanePerStagione)) || SETTIMANE_PER_STAGIONE);
  const totale = Math.min(MAX_SETTIMANE, Math.max(0, Math.round(oZero(settimane))));

  let livelloCorrente = num(livello);
  if (!Number.isFinite(livelloCorrente)) return { scatti: [], livelloFinale: null, crescitaTotale: 0, sublivelloFinale: 0 };

  let sub = Math.min(0.999, Math.max(0, oZero(sublivello)));
  let eta = num(giocatore?.eta);
  let crescitaTotale = 0;
  const scatti = [];

  for (let settimana = 1; settimana <= totale; settimana++) {
    const { crescita } = crescitaSettimanale({
      giocatore: { ...giocatore, eta }, livello: livelloCorrente, allenamento, impostazioni, parametri: p,
    });
    if (!(crescita > 0)) break;
    sub += crescita;
    crescitaTotale += crescita;
    while (sub >= 1) {
      sub -= 1;
      livelloCorrente += 1;
      scatti.push({ livello: livelloCorrente, settimana, eta, data: piuSettimane(dataInizio, settimana) });
    }
    if (settimana % perStagione === 0 && Number.isFinite(eta)) eta += 1;
  }

  return { scatti, livelloFinale: livelloCorrente, sublivelloFinale: sub, crescitaTotale, etaFinale: eta };
}

/** Settimane (frazionarie) al prossimo scatto, a condizioni costanti. */
export function settimaneAlProssimoScatto({ giocatore, livello, sublivello = 0, allenamento, impostazioni, parametri }) {
  const { crescita } = crescitaSettimanale({ giocatore, livello, allenamento, impostazioni, parametri });
  if (!(crescita > 0)) return null;
  return Math.max(0, 1 - Math.min(1, oZero(sublivello))) / crescita;
}

/**
 * Piano di una stagione sull'intera rosa: chi viene allenato, quanto cresce e
 * quali scatti arrivano, in ordine di data.
 */
export function pianoStagionale({
  giocatori = [],
  allenamento,
  impostazioni = {},
  parametri = PARAMETRI_PREDEFINITI,
  settimane = SETTIMANE_PER_STAGIONE,
  sublivelli = {},
  dataInizio = new Date(),
}) {
  const allenati = giocatoriAllenati({ giocatori, allenamento });
  const perGiocatore = allenati.map((g) => {
    const livello = num(g.abilita?.[allenamento.abilita]);
    const proiezione = proietta({
      giocatore: g,
      livello,
      sublivello: sublivelli[g.id] ?? 0,
      allenamento, impostazioni, parametri, settimane, dataInizio,
    });
    return {
      giocatore: g,
      livello: Number.isFinite(livello) ? livello : null,
      mancaAbilita: !Number.isFinite(livello),
      ...proiezione,
      settimaneAlProssimo: settimaneAlProssimoScatto({
        giocatore: g, livello, sublivello: sublivelli[g.id] ?? 0, allenamento, impostazioni, parametri,
      }),
    };
  });

  const scatti = perGiocatore
    .flatMap((r) => r.scatti.map((s) => ({ ...s, nome: r.giocatore.nome, giocatoreId: r.giocatore.id })))
    .sort((a, b) => a.settimana - b.settimana);

  return {
    allenati: allenati.length,
    perGiocatore,
    scatti,
    livelliGuadagnati: scatti.length,
    senzaAbilita: perGiocatore.filter((r) => r.mancaAbilita).map((r) => r.giocatore.nome),
  };
}

/** Confronta più allenamenti sulla stessa rosa e sullo stesso orizzonte. */
export function confrontaAllenamenti({
  giocatori = [],
  allenamenti = ALLENAMENTI_PREDEFINITI,
  impostazioni = {},
  parametri = PARAMETRI_PREDEFINITI,
  settimane = SETTIMANE_PER_STAGIONE,
  sublivelli = {},
}) {
  return allenamenti.map((allenamento) => {
    const piano = pianoStagionale({ giocatori, allenamento, impostazioni, parametri, settimane, sublivelli });
    return {
      allenamento,
      allenati: piano.allenati,
      // senza questo numero, una crescita a zero per dati mancanti si
      // confonderebbe con un allenamento che davvero non rende
      senzaAbilita: piano.senzaAbilita.length,
      livelliGuadagnati: piano.livelliGuadagnati,
      crescitaTotale: piano.perGiocatore.reduce((acc, r) => acc + r.crescitaTotale, 0),
      primoScatto: piano.scatti[0] ?? null,
    };
  }).sort((a, b) => b.crescitaTotale - a.crescitaTotale);
}

/**
 * Riallinea la velocità di base perché il prossimo scatto cada dopo le
 * settimane osservate davvero. È il modo onesto di tarare il modello.
 */
export function calibraVelocita({ giocatore, livello, sublivello = 0, allenamento, impostazioni, parametri = PARAMETRI_PREDEFINITI, settimaneOsservate }) {
  const osservate = oZero(settimaneOsservate);
  if (!(osservate > 0)) return null;
  const stimate = settimaneAlProssimoScatto({ giocatore, livello, sublivello, allenamento, impostazioni, parametri });
  if (!stimate || !Number.isFinite(stimate)) return null;
  const nuova = (oZero({ ...PARAMETRI_PREDEFINITI, ...parametri }.velocitaBase) * stimate) / osservate;
  return Number.isFinite(nuova) && nuova > 0 ? Number(nuova.toFixed(4)) : null;
}

function piuSettimane(base, n) {
  const d = new Date(base instanceof Date ? base.getTime() : Date.now());
  d.setDate(d.getDate() + Math.round(n) * 7);
  return d;
}
