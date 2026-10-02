import test from 'node:test';
import assert from 'node:assert/strict';

import { tempoRimanente, valutaAsta, analizzaMercato } from '../assets/js/calcolo/mercato.js';

const ADESSO = new Date('2026-10-02T12:00:00Z');
const fra = (ore) => new Date(ADESSO.getTime() + ore * 3600 * 1000).toISOString();

/** Modello noto: così la stima è verificabile a mano. */
const MODELLO = { a: 9, b: 0.6, c: -0.07 };
const prezzoVero = (abilita, eta) => Math.exp(MODELLO.a + MODELLO.b * abilita + MODELLO.c * eta);

const asta = (nome, extra = {}) => ({ id: nome, nome, abilita: 9, eta: 24, prezzo: 500000, tetto: 800000, scadenza: fra(48), ...extra });

test('il tempo rimanente distingue aperta, chiusa e senza scadenza', () => {
  assert.equal(tempoRimanente(fra(10), ADESSO).scaduta, false);
  assert.ok(Math.abs(tempoRimanente(fra(10), ADESSO).ore - 10) < 1e-9);
  assert.equal(tempoRimanente(fra(-1), ADESSO).scaduta, true);
  assert.equal(tempoRimanente(null, ADESSO).valido, false);
  assert.equal(tempoRimanente('non è una data', ADESSO).valido, false);
});

test('la stima dell’asta usa il modello delle vendite osservate', () => {
  const v = valutaAsta({ asta: asta('Tizio'), modello: MODELLO, adesso: ADESSO });
  assert.ok(Math.abs(v.stima - prezzoVero(9, 24)) < 1e-6, 'la stima è quella del modello');

  // il giudizio si lega alla stima, non a una cifra scritta a mano
  const sotto = valutaAsta({ asta: asta('Affare', { prezzo: prezzoVero(9, 24) * 0.6 }), modello: MODELLO, adesso: ADESSO });
  assert.equal(sotto.confronto.giudizio, 'occasione');

  const sopra = valutaAsta({ asta: asta('Salato', { prezzo: prezzoVero(9, 24) * 1.5 }), modello: MODELLO, adesso: ADESSO });
  assert.equal(sopra.confronto.giudizio, 'molto caro');

  const giusto = valutaAsta({ asta: asta('Giusto', { prezzo: prezzoVero(9, 24) }), modello: MODELLO, adesso: ADESSO });
  assert.equal(giusto.confronto.giudizio, 'in linea');
});

test('senza modello non si inventa un giudizio', () => {
  const v = valutaAsta({ asta: asta('Tizio'), modello: null, adesso: ADESSO });
  assert.equal(v.stima, null);
  assert.equal(v.confronto, null);
});

test('il tetto dice se sei andato oltre e di quanto', () => {
  const dentro = valutaAsta({ asta: asta('Dentro', { prezzo: 700000, tetto: 800000 }), modello: MODELLO, adesso: ADESSO });
  assert.equal(dentro.oltreIlTetto, false);
  assert.equal(dentro.margineSulTetto, 100000);

  const fuori = valutaAsta({ asta: asta('Fuori', { prezzo: 900000, tetto: 800000 }), modello: MODELLO, adesso: ADESSO });
  assert.equal(fuori.oltreIlTetto, true);
  assert.equal(fuori.margineSulTetto, -100000);

  const senzaTetto = valutaAsta({ asta: asta('Libera', { tetto: null }), modello: MODELLO, adesso: ADESSO });
  assert.equal(senzaTetto.oltreIlTetto, false, 'senza tetto non si può sforare');
  assert.equal(senzaTetto.margineSulTetto, null);
});

test('l’impegno è il tetto se c’è, altrimenti il prezzo attuale', () => {
  assert.equal(valutaAsta({ asta: asta('A', { tetto: 800000, prezzo: 500000 }), adesso: ADESSO }).impegno, 800000);
  assert.equal(valutaAsta({ asta: asta('B', { tetto: null, prezzo: 500000 }), adesso: ADESSO }).impegno, 500000);
  assert.equal(valutaAsta({ asta: asta('C', { tetto: null, prezzo: null }), adesso: ADESSO }).impegno, 0);
});

test('le aste sono ordinate per chiusura, con le scadute in fondo', () => {
  const q = analizzaMercato({
    aste: [
      asta('Lontana', { scadenza: fra(72) }),
      asta('Chiusa', { scadenza: fra(-5) }),
      asta('Imminente', { scadenza: fra(2) }),
      asta('Senza scadenza', { scadenza: null }),
    ],
    modello: MODELLO, adesso: ADESSO,
  });
  assert.deepEqual(q.righe.map((r) => r.asta.nome), ['Imminente', 'Lontana', 'Senza scadenza', 'Chiusa']);
  assert.equal(q.aperte, 3);
  assert.equal(q.chiuse, 1);
});

test('l’impegno massimo somma solo le aste ancora aperte', () => {
  const q = analizzaMercato({
    aste: [
      asta('Aperta', { tetto: 300000, scadenza: fra(10) }),
      asta('Chiusa', { tetto: 900000, scadenza: fra(-10) }),
    ],
    modello: MODELLO, cassa: 500000, adesso: ADESSO,
  });
  assert.equal(q.impegnoMassimo, 300000);
  assert.equal(q.cassaResidua, 200000);
});

test('sforare la cassa o il tetto produce un avviso critico', () => {
  const q = analizzaMercato({
    aste: [asta('Costosa', { tetto: 900000, prezzo: 950000, scadenza: fra(10) })],
    modello: MODELLO, cassa: 500000, adesso: ADESSO,
  });
  assert.ok(q.avvisi.some((a) => a.tono === 'critico' && a.testo.includes('tetto')));
  assert.ok(q.avvisi.some((a) => a.tono === 'critico' && a.testo.includes('cassa')));
  assert.equal(q.oltreIlTetto.length, 1);
});

test('chi chiude entro 24 ore viene segnalato, chi è già chiuso no', () => {
  const q = analizzaMercato({
    aste: [asta('Stasera', { scadenza: fra(6) }), asta('Finita', { scadenza: fra(-6) })],
    modello: MODELLO, adesso: ADESSO,
  });
  const avviso = q.avvisi.find((a) => a.testo.includes('24 ore'));
  assert.ok(avviso);
  assert.ok(avviso.testo.includes('Stasera'));
  assert.ok(!avviso.testo.includes('Finita'));
});

test('le occasioni sono solo fra le aste ancora aperte', () => {
  const q = analizzaMercato({
    aste: [
      asta('Affare', { prezzo: 100000, scadenza: fra(10) }),
      asta('Affare scaduto', { prezzo: 100000, scadenza: fra(-10) }),
      asta('Cara', { prezzo: prezzoVero(9, 24) * 2, scadenza: fra(10) }),
    ],
    modello: MODELLO, adesso: ADESSO,
  });
  assert.deepEqual(q.occasioni.map((r) => r.asta.nome), ['Affare']);
});

test('le righe senza nome vengono ignorate, e una lista vuota lo dice', () => {
  const q = analizzaMercato({ aste: [{ nome: '  ', prezzo: 999 }], modello: MODELLO, adesso: ADESSO });
  assert.equal(q.righe.length, 0);
  assert.ok(q.avvisi.some((a) => a.testo.includes('Nessuna asta')));
});

test('senza modello lo dichiara invece di tacere', () => {
  const q = analizzaMercato({ aste: [asta('Tizio')], modello: null, adesso: ADESSO });
  assert.ok(q.avvisi.some((a) => a.testo.includes('Valutazione')));
});

test('i messaggi scrivono i numeri con le migliaia separate', () => {
  const q = analizzaMercato({
    aste: [asta('Costosa', { tetto: 1400000, prezzo: 100000, scadenza: fra(10) })],
    modello: MODELLO, cassa: 200000, adesso: ADESSO,
  });
  const sforo = q.avvisi.find((a) => a.testo.includes('sfori la cassa'));
  assert.ok(sforo.testo.includes('1.200.000'), `atteso il numero separato, trovato: ${sforo.testo}`);
});
