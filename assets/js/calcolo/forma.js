/**
 * Forma e condizione: come vanno, e quanto spostano il rendimento.
 *
 * Il moltiplicatore di rendimento è lo stesso usato dalla scheda Schieramento,
 * importato da lì invece che riscritto: se tari i pesi in un posto, valgono
 * anche qui.
 *
 * Nessuna previsione: in Hattrick la forma si muove in modo non pubblicato e
 * tutt'altro che regolare. Questa scheda registra quello che è successo e
 * misura l'effetto sul presente — non indovina la settimana prossima.
 */

import { rendimento, FATTORI_PREDEFINITI } from './schieramento.js';

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? NaN : Number(v));

export { rendimento, FATTORI_PREDEFINITI };

/** Soglia sotto la quale una variazione è rumore, non tendenza. */
export const SOGLIA_TENDENZA = 0.5;

/**
 * Andamento di una serie di letture, dalla più vecchia alla più recente.
 * @param {{forma:number, condizione:number}[]} letture
 */
export function andamento(letture = [], campo = 'forma', soglia = SOGLIA_TENDENZA) {
  const valori = letture.map((l) => num(l?.[campo])).filter(Number.isFinite);
  // "nessuno storico" e non "senza dati": il giocatore può avere forma e
  // condizione di oggi, e mancare solo di letture precedenti con cui confrontarle
  if (!valori.length) return { ultimo: null, precedente: null, variazione: null, tendenza: 'nessuno storico', media: null, letture: 0 };

  const ultimo = valori[valori.length - 1];
  const precedente = valori.length > 1 ? valori[valori.length - 2] : null;
  const variazione = precedente == null ? null : ultimo - precedente;
  const media = valori.reduce((a, b) => a + b, 0) / valori.length;

  let tendenza = 'stabile';
  if (variazione == null) tendenza = 'prima lettura';
  else if (variazione >= soglia) tendenza = 'in salita';
  else if (variazione <= -soglia) tendenza = 'in calo';

  return { ultimo, precedente, variazione, tendenza, media, letture: valori.length, valori };
}

/**
 * Quadro della rosa: rendimento attuale di ciascuno e come si sta muovendo.
 * @param {{giocatori:Array, storico:object, fattori:object}} ingresso
 */
export function analizzaRosa({ giocatori = [], storico = {}, fattori = FATTORI_PREDEFINITI }) {
  const righe = giocatori.map((g) => {
    const letture = storico[g.id] ?? [];
    const moltiplicatore = rendimento(g, fattori);
    return {
      giocatore: g,
      forma: num(g.forma),
      condizione: num(g.condizione),
      rendimento: moltiplicatore,
      scarto: moltiplicatore - 1,
      andamentoForma: andamento(letture, 'forma'),
      andamentoCondizione: andamento(letture, 'condizione'),
      letture: letture.length,
      senzaDati: !Number.isFinite(num(g.forma)) && !Number.isFinite(num(g.condizione)),
    };
  });

  const conDati = righe.filter((r) => !r.senzaDati);
  const medio = conDati.length ? conDati.reduce((a, r) => a + r.rendimento, 0) / conDati.length : 1;

  return {
    righe: righe.sort((a, b) => b.rendimento - a.rendimento),
    rendimentoMedio: medio,
    // quanto la rosa rende rispetto a sé stessa in condizioni normali
    scartoMedio: medio - 1,
    inSalita: righe.filter((r) => r.andamentoForma.tendenza === 'in salita'),
    inCalo: righe.filter((r) => r.andamentoForma.tendenza === 'in calo'),
    senzaDati: righe.filter((r) => r.senzaDati).map((r) => r.giocatore.nome),
    avvisi: avvisi(righe, medio),
  };
}

/** Effetto del rendimento su un valore di reparto già calcolato. */
export function effettoSuValore({ valore, rendimento: moltiplicatore }) {
  const v = num(valore);
  const m = num(moltiplicatore);
  if (!Number.isFinite(v) || !Number.isFinite(m)) return null;
  return { base: v, effettivo: v * m, differenza: v * m - v };
}

/** Aggiunge una lettura allo storico, senza modificare quello esistente. */
export function registraLettura(storico = {}, giocatoreId, lettura) {
  const precedenti = storico[giocatoreId] ?? [];
  return { ...storico, [giocatoreId]: [...precedenti, lettura] };
}

function avvisi(righe, medio) {
  const out = [];
  const conDati = righe.filter((r) => !r.senzaDati);
  if (!conDati.length) {
    out.push({ tono: 'attenzione', testo: 'Nessun dato di forma o condizione: inseriscili per vedere quanto incidono.' });
    return out;
  }
  if (medio < 0.95) out.push({ tono: 'critico', testo: 'La rosa sta rendendo sotto il proprio livello: è un brutto momento per una partita importante.' });
  else if (medio > 1.05) out.push({ tono: 'attenzione', testo: 'La rosa sta rendendo sopra il proprio livello: è il momento di sfruttarlo.' });

  const peggiore = righe[righe.length - 1];
  if (peggiore && !peggiore.senzaDati && peggiore.scarto < -0.1) {
    out.push({ tono: 'attenzione', testo: `${peggiore.giocatore.nome} rende il ${Math.round(Math.abs(peggiore.scarto) * 100)}% sotto il suo livello: valuta di lasciarlo fuori.` });
  }
  return out;
}
