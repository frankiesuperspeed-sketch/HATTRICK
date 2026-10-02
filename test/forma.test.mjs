import test from 'node:test';
import assert from 'node:assert/strict';

import {
  andamento, analizzaRosa, effettoSuValore, registraLettura,
  FATTORI_PREDEFINITI, SOGLIA_TENDENZA,
} from '../assets/js/calcolo/forma.js';

const lettura = (forma, condizione) => ({ forma, condizione });

test('senza letture non si inventa un andamento', () => {
  const a = andamento([]);
  assert.equal(a.tendenza, 'nessuno storico');
  assert.equal(a.ultimo, null);
  assert.equal(a.letture, 0);
});

test('una sola lettura è un punto di partenza, non una tendenza', () => {
  const a = andamento([lettura(6, 7)]);
  assert.equal(a.ultimo, 6);
  assert.equal(a.precedente, null);
  assert.equal(a.variazione, null);
  assert.equal(a.tendenza, 'prima lettura');
});

test('la tendenza guarda l’ultima variazione, con una soglia', () => {
  assert.equal(andamento([lettura(5), lettura(7)]).tendenza, 'in salita');
  assert.equal(andamento([lettura(7), lettura(5)]).tendenza, 'in calo');
  assert.equal(andamento([lettura(5), lettura(5)]).tendenza, 'stabile');
  assert.equal(andamento([lettura(5), lettura(5.2)]).tendenza, 'stabile', 'sotto soglia è rumore');
  assert.equal(andamento([lettura(5), lettura(5 + SOGLIA_TENDENZA)]).tendenza, 'in salita');
});

test('le letture incomplete non falsano la media', () => {
  const a = andamento([lettura(6), { forma: null }, lettura(8)]);
  assert.equal(a.letture, 2);
  assert.equal(a.media, 7);
  assert.equal(a.ultimo, 8);
});

test('la condizione si legge con la stessa funzione', () => {
  const letture = [lettura(5, 4), lettura(5, 7)];
  assert.equal(andamento(letture, 'forma').tendenza, 'stabile');
  assert.equal(andamento(letture, 'condizione').tendenza, 'in salita');
});

test('il quadro della rosa ordina dal più in palla al più scarico', () => {
  const giocatori = [
    { id: 'a', nome: 'Scarico', forma: 2, condizione: 3 },
    { id: 'b', nome: 'In palla', forma: 8, condizione: 8 },
    { id: 'c', nome: 'Normale', forma: 5, condizione: 5 },
  ];
  const q = analizzaRosa({ giocatori, fattori: FATTORI_PREDEFINITI });
  assert.deepEqual(q.righe.map((r) => r.giocatore.nome), ['In palla', 'Normale', 'Scarico']);
  assert.ok(Math.abs(q.righe[1].rendimento - 1) < 1e-9, 'ai valori normali il rendimento è 1');
  assert.ok(q.righe[0].scarto > 0 && q.righe[2].scarto < 0);
});

test('chi non ha dati viene contato a parte, non trattato come scarico', () => {
  const giocatori = [
    { id: 'a', nome: 'Con dati', forma: 6, condizione: 6 },
    { id: 'b', nome: 'Senza dati' },
  ];
  const q = analizzaRosa({ giocatori });
  assert.deepEqual(q.senzaDati, ['Senza dati']);
  const senza = q.righe.find((r) => r.giocatore.nome === 'Senza dati');
  assert.equal(senza.rendimento, 1, 'nessun dato significa nessun effetto');
  assert.ok(q.rendimentoMedio > 1, 'la media considera solo chi ha dati');
});

test('una rosa scarica fa scattare un avviso, una in palla un altro', () => {
  const scarica = analizzaRosa({ giocatori: [{ id: 'a', nome: 'X', forma: 1, condizione: 1 }] });
  assert.ok(scarica.avvisi.some((x) => x.tono === 'critico'));

  const inPalla = analizzaRosa({ giocatori: [{ id: 'a', nome: 'X', forma: 8, condizione: 8 }] });
  assert.ok(inPalla.avvisi.some((x) => x.testo.includes('sopra il proprio livello')));

  const vuota = analizzaRosa({ giocatori: [] });
  assert.ok(vuota.avvisi.length > 0);
  assert.equal(vuota.rendimentoMedio, 1);
});

test('chi sale e chi scende viene elencato separatamente', () => {
  const giocatori = [{ id: 'a', nome: 'Su' }, { id: 'b', nome: 'Giù' }, { id: 'c', nome: 'Fermo' }];
  const storico = {
    a: [lettura(4), lettura(7)],
    b: [lettura(7), lettura(4)],
    c: [lettura(5), lettura(5)],
  };
  const q = analizzaRosa({ giocatori, storico });
  assert.deepEqual(q.inSalita.map((r) => r.giocatore.nome), ['Su']);
  assert.deepEqual(q.inCalo.map((r) => r.giocatore.nome), ['Giù']);
});

test("l'effetto su un valore di reparto è il valore per il moltiplicatore", () => {
  const e = effettoSuValore({ valore: 40, rendimento: 1.1 });
  assert.ok(Math.abs(e.effettivo - 44) < 1e-9);
  assert.ok(Math.abs(e.differenza - 4) < 1e-9);
  assert.equal(effettoSuValore({ valore: null, rendimento: 1.1 }), null);
});

test('registrare una lettura non altera lo storico precedente', () => {
  const prima = { a: [lettura(5)] };
  const dopo = registraLettura(prima, 'a', lettura(6));
  assert.equal(prima.a.length, 1, 'lo storico di partenza resta intatto');
  assert.equal(dopo.a.length, 2);
  assert.equal(registraLettura({}, 'b', lettura(7)).b.length, 1);
});
