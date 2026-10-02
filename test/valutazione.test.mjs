import test from 'node:test';
import assert from 'node:assert/strict';

import {
  adattaModello, stimaPrezzo, confronta, osservazioniValide,
  curvaAbilita, curvaEta, MODELLO_PREDEFINITO,
} from '../assets/js/calcolo/valutazione.js';

/** Mercato finto con una legge nota: serve a verificare che il modello la ritrovi. */
const VERO = { a: 9, b: 0.6, c: -0.07 };
const prezzoVero = (abilita, eta) => Math.exp(VERO.a + VERO.b * abilita + VERO.c * eta);
const osservazione = (abilita, eta) => ({ abilita, eta, prezzo: prezzoVero(abilita, eta) });

test('scarta le osservazioni inutilizzabili', () => {
  const valide = osservazioniValide([
    { abilita: 8, eta: 20, prezzo: 100000 },
    { abilita: 8, eta: 20, prezzo: 0 },
    { abilita: 8, eta: 20, prezzo: -5 },
    { abilita: null, eta: 20, prezzo: 100000 },
    { abilita: 8, eta: 0, prezzo: 100000 },
  ]);
  assert.equal(valide.length, 1);
});

test('sotto le tre osservazioni non si azzarda un modello', () => {
  assert.equal(adattaModello([]), null);
  assert.equal(adattaModello([osservazione(8, 20), osservazione(9, 22)]), null);
});

test('con osservazioni coerenti ritrova la legge che le ha generate', () => {
  const m = adattaModello([
    osservazione(6, 18), osservazione(8, 20), osservazione(10, 24),
    osservazione(12, 28), osservazione(9, 31),
  ]);
  assert.ok(Math.abs(m.a - VERO.a) < 1e-6, `a=${m.a}`);
  assert.ok(Math.abs(m.b - VERO.b) < 1e-6, `b=${m.b}`);
  assert.ok(Math.abs(m.c - VERO.c) < 1e-6, `c=${m.c}`);
  assert.equal(m.n, 5);
  assert.ok(m.r2 > 0.999, 'dati perfetti, spiegazione quasi totale');
  assert.equal(m.origine, 'osservazioni');
});

test('i coefficienti si leggono anche come fattori moltiplicativi', () => {
  const m = adattaModello([osservazione(6, 18), osservazione(8, 20), osservazione(10, 24), osservazione(12, 28)]);
  assert.ok(Math.abs(m.fattoreAbilita - Math.exp(VERO.b)) < 1e-9, 'un livello in più vale questo fattore');
  assert.ok(m.fattoreAbilita > 1, 'più abilità, più valore');
  assert.ok(m.fattoreEta < 1, 'più età, meno valore');
});

test('dati sparsi abbassano R² senza rompere il modello', () => {
  const rumorosi = [
    { abilita: 6, eta: 18, prezzo: 50000 },
    { abilita: 8, eta: 20, prezzo: 900000 },
    { abilita: 10, eta: 24, prezzo: 120000 },
    { abilita: 12, eta: 28, prezzo: 2000000 },
  ];
  const m = adattaModello(rumorosi);
  assert.ok(m, 'il modello esiste comunque');
  assert.ok(m.r2 >= 0 && m.r2 < 0.9, `R² dovrebbe essere basso, è ${m.r2}`);
});

test('osservazioni tutte identiche non producono un modello inventato', () => {
  const m = adattaModello([osservazione(8, 20), osservazione(8, 20), osservazione(8, 20)]);
  assert.equal(m, null, 'senza variabilità i coefficienti non sono determinati');
});

test('la stima cresce con l’abilità e cala con l’età', () => {
  const m = { ...VERO };
  const base = stimaPrezzo({ abilita: 9, eta: 24, modello: m });
  assert.ok(stimaPrezzo({ abilita: 10, eta: 24, modello: m }) > base);
  assert.ok(stimaPrezzo({ abilita: 8, eta: 24, modello: m }) < base);
  assert.ok(stimaPrezzo({ abilita: 9, eta: 30, modello: m }) < base);
  assert.ok(stimaPrezzo({ abilita: 9, eta: 18, modello: m }) > base);
});

test('la stima rifiuta ingressi non numerici invece di restituire NaN', () => {
  assert.equal(stimaPrezzo({ abilita: null, eta: 20 }), null);
  assert.equal(stimaPrezzo({ abilita: 8, eta: 'venti' }), null);
});

test('il modello predefinito dà una cifra plausibile e dichiara di esserlo', () => {
  assert.equal(MODELLO_PREDEFINITO.origine, 'predefinito');
  const p = stimaPrezzo({ abilita: 8, eta: 20, modello: MODELLO_PREDEFINITO });
  assert.ok(p > 100000 && p < 400000, `atteso attorno a 200.000, ottenuto ${Math.round(p)}`);
});

test('il confronto col prezzo richiesto dà un giudizio sensato', () => {
  assert.equal(confronta({ richiesto: 70, stimato: 100 }).giudizio, 'occasione');
  assert.equal(confronta({ richiesto: 90, stimato: 100 }).giudizio, 'conveniente');
  assert.equal(confronta({ richiesto: 100, stimato: 100 }).giudizio, 'in linea');
  assert.equal(confronta({ richiesto: 115, stimato: 100 }).giudizio, 'caro');
  assert.equal(confronta({ richiesto: 200, stimato: 100 }).giudizio, 'molto caro');
  assert.equal(confronta({ richiesto: 200, stimato: 100 }).scarto, 1);
  assert.equal(confronta({ richiesto: 0, stimato: 100 }), null);
});

test('le curve coprono l’intervallo richiesto e sono monotone', () => {
  const m = { ...VERO };
  const perAbilita = curvaAbilita({ eta: 24, modello: m, da: 5, a: 15 });
  assert.equal(perAbilita.length, 11);
  for (let i = 1; i < perAbilita.length; i++) assert.ok(perAbilita[i].prezzo > perAbilita[i - 1].prezzo);

  const perEta = curvaEta({ abilita: 9, modello: m, da: 17, a: 34 });
  assert.equal(perEta.length, 18);
  for (let i = 1; i < perEta.length; i++) assert.ok(perEta[i].prezzo < perEta[i - 1].prezzo);
});
