/**
 * Mercato: le aste che segui, quanto manca alla chiusura e se il prezzo sta
 * ancora dentro quello che hai deciso di spendere.
 *
 * Il giudizio sul prezzo arriva dal modello della scheda Valutazione, cioè
 * dalle vendite che hai osservato tu: qui non si inventa nessun listino.
 */

import { stimaPrezzo, confronta } from './valutazione.js';

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? NaN : Number(v));
const oZero = (v) => (Number.isFinite(num(v)) ? num(v) : 0);

const ORA = 3600 * 1000;
/** Migliaia separate, fatte a mano: i messaggi devono leggersi uguali ovunque. */
const leggibile = (v) => String(Math.round(Math.abs(oZero(v)))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Quanto manca alla chiusura. Negativo significa già chiusa. */
export function tempoRimanente(scadenza, adesso = new Date()) {
  if (!scadenza) return { valido: false, scaduta: false, ore: null, giorni: null, millisecondi: null };
  const fine = new Date(scadenza);
  if (isNaN(fine)) return { valido: false, scaduta: false, ore: null, giorni: null, millisecondi: null };
  const ms = fine.getTime() - (adesso instanceof Date ? adesso.getTime() : Date.now());
  return {
    valido: true,
    scaduta: ms <= 0,
    millisecondi: ms,
    ore: ms / ORA,
    giorni: ms / (24 * ORA),
  };
}

/** Una singola asta, con la stima e il confronto col tetto che ti sei dato. */
export function valutaAsta({ asta, modello, adesso = new Date() }) {
  const prezzo = num(asta?.prezzo);
  const tetto = num(asta?.tetto);
  const stima = modello ? stimaPrezzo({ abilita: asta?.abilita, eta: asta?.eta, modello }) : null;

  return {
    asta,
    stima,
    confronto: stima != null && Number.isFinite(prezzo) ? confronta({ richiesto: prezzo, stimato: stima }) : null,
    tempo: tempoRimanente(asta?.scadenza, adesso),
    oltreIlTetto: Number.isFinite(tetto) && Number.isFinite(prezzo) ? prezzo > tetto : false,
    margineSulTetto: Number.isFinite(tetto) && Number.isFinite(prezzo) ? tetto - prezzo : null,
    // quanto si impegna davvero: il tetto se c'è, altrimenti il prezzo attuale
    impegno: Number.isFinite(tetto) ? tetto : Number.isFinite(prezzo) ? prezzo : 0,
  };
}

/**
 * Quadro di tutte le aste seguite, in ordine di chiusura.
 * `cassa` serve a dire cosa resta se le vinci tutte.
 */
export function analizzaMercato({ aste = [], modello = null, cassa = 0, adesso = new Date() }) {
  const righe = aste
    .filter((a) => a && String(a.nome ?? '').trim() !== '')
    .map((asta) => valutaAsta({ asta, modello, adesso }));

  const aperte = righe.filter((r) => !r.tempo.scaduta);
  const impegnoMassimo = aperte.reduce((acc, r) => acc + oZero(r.impegno), 0);

  const ordinate = [...righe].sort((a, b) => {
    // prima quelle che chiudono, poi quelle senza scadenza, infine le chiuse
    if (a.tempo.scaduta !== b.tempo.scaduta) return a.tempo.scaduta ? 1 : -1;
    if (a.tempo.valido !== b.tempo.valido) return a.tempo.valido ? -1 : 1;
    if (!a.tempo.valido) return 0;
    return a.tempo.millisecondi - b.tempo.millisecondi;
  });

  return {
    righe: ordinate,
    aperte: aperte.length,
    chiuse: righe.length - aperte.length,
    impegnoMassimo,
    cassaResidua: oZero(cassa) - impegnoMassimo,
    oltreIlTetto: righe.filter((r) => r.oltreIlTetto),
    occasioni: aperte.filter((r) => r.confronto && (r.confronto.giudizio === 'occasione' || r.confronto.giudizio === 'conveniente')),
    avvisi: avvisi({ righe, aperte, impegnoMassimo, cassa: oZero(cassa), modello }),
  };
}

function avvisi({ righe, aperte, impegnoMassimo, cassa, modello }) {
  const out = [];
  if (!righe.length) {
    out.push({ tono: 'attenzione', testo: 'Nessuna asta seguita: aggiungine una per tenerne traccia.' });
    return out;
  }
  if (!modello) {
    out.push({ tono: 'attenzione', testo: 'Senza il modello della scheda Valutazione non posso dire se un prezzo è alto: registra qualche vendita osservata.' });
  }
  const sforate = righe.filter((r) => r.oltreIlTetto && !r.tempo.scaduta);
  if (sforate.length) {
    out.push({ tono: 'critico', testo: `Hai superato il tuo tetto su: ${sforate.map((r) => r.asta.nome).join(', ')}.` });
  }
  if (cassa > 0 && impegnoMassimo > cassa) {
    out.push({ tono: 'critico', testo: `Se le vinci tutte sfori la cassa di ${leggibile(impegnoMassimo - cassa)}.` });
  }
  const inChiusura = aperte.filter((r) => r.tempo.valido && r.tempo.ore <= 24);
  if (inChiusura.length) {
    out.push({ tono: 'attenzione', testo: `Chiudono entro 24 ore: ${inChiusura.map((r) => r.asta.nome).join(', ')}.` });
  }
  return out;
}
