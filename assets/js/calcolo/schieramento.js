/**
 * Schieramento: che valori produce una formazione in difesa, centrocampo e attacco.
 *
 * ⚠️ Hattrick non pubblica come i ruoli contribuiscono ai rating. I contributi
 * qui sotto sono STIME dichiarate, non regole del gioco: stanno tutti in un
 * unico posto, sono modificabili dall'interfaccia, e ogni funzione li riceve
 * da fuori. Tararli sui tuoi resoconti di partita è parte del lavoro.
 */

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? NaN : Number(v));
const oZero = (v) => (Number.isFinite(num(v)) ? num(v) : 0);

export const SETTORI = [
  { id: 'difesa', nome: 'Difesa' },
  { id: 'centrocampo', nome: 'Centrocampo' },
  { id: 'attacco', nome: 'Attacco' },
];

/**
 * Per ogni posizione in campo: quale abilità conta e quanto pesa su ciascun
 * settore. Valori di partenza, da tarare.
 */
export const POSIZIONI_PREDEFINITE = [
  { id: 'portiere',       nome: 'Portiere',            abilita: 'portiere', contributi: { difesa: 1.00, centrocampo: 0.00, attacco: 0.00 } },
  { id: 'difensore',      nome: 'Difensore centrale',  abilita: 'difesa',   contributi: { difesa: 1.00, centrocampo: 0.10, attacco: 0.00 } },
  { id: 'terzino',        nome: 'Terzino',             abilita: 'difesa',   contributi: { difesa: 0.80, centrocampo: 0.20, attacco: 0.10 } },
  { id: 'centrocampista', nome: 'Centrocampista',      abilita: 'regia',    contributi: { difesa: 0.20, centrocampo: 1.00, attacco: 0.20 } },
  { id: 'ala',            nome: 'Ala',                 abilita: 'cross',    contributi: { difesa: 0.10, centrocampo: 0.30, attacco: 0.60 } },
  { id: 'attaccante',     nome: 'Attaccante',          abilita: 'attacco',  contributi: { difesa: 0.00, centrocampo: 0.10, attacco: 1.00 } },
];

/**
 * Quanto forma e condizione spostano il rendimento. Che incidano è assodato;
 * di quanto, no: questi pesi sono stime e si cambiano dall'interfaccia.
 * Peso 0 = la voce non influisce.
 */
export const FATTORI_PREDEFINITI = {
  pesoForma: 0.20,
  pesoCondizione: 0.10,
  // valore considerato "normale": sopra migliora, sotto peggiora
  formaNeutra: 5,
  condizioneNeutra: 5,
  scala: 10,
};

/** Moltiplicatore di rendimento di un giocatore, fra forma e condizione. */
export function rendimento(giocatore, fattori = FATTORI_PREDEFINITI) {
  const f = { ...FATTORI_PREDEFINITI, ...fattori };
  const scala = oZero(f.scala) || 10;
  const parte = (valore, neutro, peso) => {
    const v = num(valore);
    if (!Number.isFinite(v)) return 0; // non inserito: nessun effetto, invece di penalizzare
    return oZero(peso) * ((v - oZero(neutro)) / scala);
  };
  const moltiplicatore = 1
    + parte(giocatore?.forma, f.formaNeutra, f.pesoForma)
    + parte(giocatore?.condizione, f.condizioneNeutra, f.pesoCondizione);
  return Math.max(0, moltiplicatore);
}

/**
 * Valuta una formazione.
 * @param {{schieramento: {posizione:string, giocatoreId:string}[], giocatori:Array,
 *          posizioni:Array, fattori:object}} ingresso
 */
export function valutaSchieramento({
  schieramento = [],
  giocatori = [],
  posizioni = POSIZIONI_PREDEFINITE,
  fattori = FATTORI_PREDEFINITI,
}) {
  const perId = new Map(giocatori.map((g) => [g.id, g]));
  const settori = Object.fromEntries(SETTORI.map((s) => [s.id, 0]));
  const vuoti = [];

  const dettaglio = schieramento.map((riga) => {
    const posizione = posizioni.find((p) => p.id === riga.posizione);
    const giocatore = perId.get(riga.giocatoreId) ?? null;
    if (!posizione) return null;
    if (!giocatore) { vuoti.push(posizione.nome); return { posizione, giocatore: null, abilita: null, efficace: 0, apporti: {} }; }

    const abilita = num(giocatore.abilita?.[posizione.abilita]);
    const moltiplicatore = rendimento(giocatore, fattori);
    const efficace = Number.isFinite(abilita) ? abilita * moltiplicatore : 0;
    if (!Number.isFinite(abilita)) vuoti.push(`${giocatore.nome} (${posizione.nome}): manca ${posizione.abilita}`);

    const apporti = {};
    for (const s of SETTORI) {
      const quota = efficace * oZero(posizione.contributi?.[s.id]);
      apporti[s.id] = quota;
      settori[s.id] += quota;
    }
    return { posizione, giocatore, abilita: Number.isFinite(abilita) ? abilita : null, moltiplicatore, efficace, apporti };
  }).filter(Boolean);

  return {
    settori,
    dettaglio,
    vuoti,
    totale: SETTORI.reduce((acc, s) => acc + settori[s.id], 0),
    giocatoriSchierati: dettaglio.filter((d) => d.giocatore).length,
  };
}

/** Chi contribuisce di più a un settore: serve a capire dove intervenire. */
export function contributiPerSettore(valutazione, settore) {
  return valutazione.dettaglio
    .filter((d) => d.giocatore && d.apporti[settore] > 0)
    .map((d) => ({ nome: d.giocatore.nome, posizione: d.posizione.nome, apporto: d.apporti[settore] }))
    .sort((a, b) => b.apporto - a.apporto);
}

/** Differenza fra due schieramenti, settore per settore. */
export function confrontaSchieramenti(a, b) {
  return SETTORI.map((s) => ({
    settore: s.id,
    nome: s.nome,
    primo: a.settori[s.id],
    secondo: b.settori[s.id],
    differenza: b.settori[s.id] - a.settori[s.id],
  }));
}
