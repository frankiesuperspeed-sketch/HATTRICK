import test from 'node:test';
import assert from 'node:assert/strict';

import {
  valutaSchieramento, rendimento, contributiPerSettore, confrontaSchieramenti,
  POSIZIONI_PREDEFINITE, FATTORI_PREDEFINITI, SETTORI,
} from '../assets/js/calcolo/schieramento.js';

const giocatore = (id, nome, abilita, extra = {}) => ({ id, nome, abilita, ...extra });

const ROSA = [
  giocatore('p', 'Portiere', { portiere: 10 }),
  giocatore('d1', 'Difensore', { difesa: 8 }),
  giocatore('c1', 'Regista', { regia: 12 }),
  giocatore('a1', 'Punta', { attacco: 9 }),
];

const SCHIERAMENTO = [
  { posizione: 'portiere', giocatoreId: 'p' },
  { posizione: 'difensore', giocatoreId: 'd1' },
  { posizione: 'centrocampista', giocatoreId: 'c1' },
  { posizione: 'attaccante', giocatoreId: 'a1' },
];

/** Senza forma né condizione inserite, il moltiplicatore deve restare 1. */
const senzaFattori = { ...FATTORI_PREDEFINITI };

test('chi non ha forma e condizione inserite non viene penalizzato', () => {
  assert.equal(rendimento({}, senzaFattori), 1);
  assert.equal(rendimento({ forma: null, condizione: null }, senzaFattori), 1);
});

test('forma e condizione spostano il rendimento nella direzione giusta', () => {
  const alta = rendimento({ forma: 8, condizione: 8 }, senzaFattori);
  const bassa = rendimento({ forma: 2, condizione: 2 }, senzaFattori);
  assert.ok(alta > 1, `forma alta deve migliorare, vale ${alta}`);
  assert.ok(bassa < 1, `forma bassa deve peggiorare, vale ${bassa}`);
  assert.ok(Math.abs(alta - 1) - Math.abs(bassa - 1) < 1e-9, 'scostamenti simmetrici');
});

test('un peso a zero annulla l’effetto di quella voce', () => {
  const fattori = { ...FATTORI_PREDEFINITI, pesoForma: 0, pesoCondizione: 0 };
  assert.equal(rendimento({ forma: 8, condizione: 1 }, fattori), 1);
});

test('il rendimento non scende mai sotto zero', () => {
  const fattori = { ...FATTORI_PREDEFINITI, pesoForma: 5 };
  assert.equal(rendimento({ forma: 0 }, fattori), 0);
});

test('ogni posizione versa la propria abilità nei settori secondo i contributi', () => {
  const v = valutaSchieramento({ schieramento: SCHIERAMENTO, giocatori: ROSA, fattori: senzaFattori });

  // difesa = portiere 10×1,00 + difensore 8×1,00 + regista 12×0,20 + punta 9×0,00
  assert.ok(Math.abs(v.settori.difesa - (10 + 8 + 2.4)) < 1e-9, `difesa=${v.settori.difesa}`);
  // centrocampo = 10×0 + 8×0,10 + 12×1,00 + 9×0,10
  assert.ok(Math.abs(v.settori.centrocampo - (0.8 + 12 + 0.9)) < 1e-9, `centrocampo=${v.settori.centrocampo}`);
  // attacco = 0 + 0 + 12×0,20 + 9×1,00
  assert.ok(Math.abs(v.settori.attacco - (2.4 + 9)) < 1e-9, `attacco=${v.settori.attacco}`);
  assert.equal(v.giocatoriSchierati, 4);
});

test('una posizione senza giocatore non rompe il conto e viene segnalata', () => {
  const v = valutaSchieramento({
    schieramento: [...SCHIERAMENTO, { posizione: 'ala', giocatoreId: 'nessuno' }],
    giocatori: ROSA, fattori: senzaFattori,
  });
  assert.equal(v.giocatoriSchierati, 4);
  assert.ok(v.vuoti.some((x) => x.includes('Ala')));
});

test("un'abilità mancante vale zero e viene segnalata, invece di passare inosservata", () => {
  const v = valutaSchieramento({
    schieramento: [{ posizione: 'ala', giocatoreId: 'd1' }], // il difensore non ha "cross"
    giocatori: ROSA, fattori: senzaFattori,
  });
  assert.equal(v.settori.attacco, 0);
  assert.ok(v.vuoti.some((x) => x.includes('cross')));
});

test('una posizione inesistente viene ignorata invece di falsare i totali', () => {
  const v = valutaSchieramento({
    schieramento: [{ posizione: 'allenatore', giocatoreId: 'p' }],
    giocatori: ROSA, fattori: senzaFattori,
  });
  assert.equal(v.dettaglio.length, 0);
  assert.equal(v.totale, 0);
});

test('contributi personalizzati sostituiscono del tutto quelli predefiniti', () => {
  const posizioni = [{ id: 'portiere', nome: 'Portiere', abilita: 'portiere', contributi: { difesa: 2, centrocampo: 0, attacco: 0 } }];
  const v = valutaSchieramento({
    schieramento: [{ posizione: 'portiere', giocatoreId: 'p' }],
    giocatori: ROSA, posizioni, fattori: senzaFattori,
  });
  assert.equal(v.settori.difesa, 20);
});

test('la forma alta alza i settori, quella bassa li abbassa', () => {
  const inForma = valutaSchieramento({
    schieramento: SCHIERAMENTO,
    giocatori: ROSA.map((g) => ({ ...g, forma: 8 })),
    fattori: FATTORI_PREDEFINITI,
  });
  const scarico = valutaSchieramento({
    schieramento: SCHIERAMENTO,
    giocatori: ROSA.map((g) => ({ ...g, forma: 2 })),
    fattori: FATTORI_PREDEFINITI,
  });
  for (const s of SETTORI) {
    assert.ok(inForma.settori[s.id] > scarico.settori[s.id], `${s.nome} dovrebbe calare con la forma bassa`);
  }
});

test('si vede chi regge un settore, in ordine di apporto', () => {
  const v = valutaSchieramento({ schieramento: SCHIERAMENTO, giocatori: ROSA, fattori: senzaFattori });
  const centrocampo = contributiPerSettore(v, 'centrocampo');
  assert.equal(centrocampo[0].nome, 'Regista');
  assert.ok(centrocampo[0].apporto > centrocampo[1].apporto);
  assert.ok(!centrocampo.some((c) => c.nome === 'Portiere'), 'chi non contribuisce non compare');
});

test('il confronto fra due schieramenti dà la differenza per settore', () => {
  const base = valutaSchieramento({ schieramento: SCHIERAMENTO, giocatori: ROSA, fattori: senzaFattori });
  const senzaPunta = valutaSchieramento({
    schieramento: SCHIERAMENTO.filter((r) => r.posizione !== 'attaccante'),
    giocatori: ROSA, fattori: senzaFattori,
  });
  const diff = confrontaSchieramenti(base, senzaPunta);
  const attacco = diff.find((d) => d.settore === 'attacco');
  assert.equal(attacco.differenza, -9);
  assert.equal(diff.length, SETTORI.length);
});

test('uno schieramento vuoto dà zero, non errori', () => {
  const v = valutaSchieramento({ schieramento: [], giocatori: ROSA });
  assert.equal(v.totale, 0);
  assert.equal(v.giocatoriSchierati, 0);
  assert.deepEqual(v.vuoti, []);
});
