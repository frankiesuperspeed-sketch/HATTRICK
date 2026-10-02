import test from 'node:test';
import assert from 'node:assert/strict';

import { analizzaStipendi, senzaGiocatori, fasciaDi, FASCE_ETA } from '../assets/js/calcolo/stipendi.js';

const RUOLI = [
  { id: 'portiere', nome: 'Portiere' },
  { id: 'difensore', nome: 'Difensore' },
  { id: 'attaccante', nome: 'Attaccante' },
];

const g = (id, nome, stipendio, eta = 24, ruolo = 'difensore') => ({ id, nome, stipendio, eta, ruolo });

const ROSA = [
  g('1', 'Fuoriclasse', 60000, 28, 'attaccante'),
  g('2', 'Titolare', 25000, 24, 'difensore'),
  g('3', 'Portiere', 10000, 31, 'portiere'),
  g('4', 'Giovane', 5000, 18, 'difensore'),
];

test('il totale ignora le righe senza nome', () => {
  const a = analizzaStipendi({ giocatori: [...ROSA, g('5', '', 99999)], ruoli: RUOLI, entrateSettimanali: 0 });
  assert.equal(a.numero, 4);
  assert.equal(a.totale, 100000);
  assert.equal(a.medio, 25000);
});

test('margine e incidenza confrontano stipendi ed entrate', () => {
  const a = analizzaStipendi({ giocatori: ROSA, ruoli: RUOLI, entrateSettimanali: 125000 });
  assert.equal(a.margine, 25000);
  assert.equal(a.incidenza, 0.8);

  const senzaEntrate = analizzaStipendi({ giocatori: ROSA, ruoli: RUOLI, entrateSettimanali: 0 });
  assert.equal(senzaEntrate.incidenza, null, 'senza entrate non si inventa una percentuale');
});

test('i giocatori sono ordinati per peso, con quota e cumulata', () => {
  const a = analizzaStipendi({ giocatori: ROSA, ruoli: RUOLI, entrateSettimanali: 100000 });
  assert.deepEqual(a.ordinati.map((x) => x.nome), ['Fuoriclasse', 'Titolare', 'Portiere', 'Giovane']);
  assert.equal(a.ordinati[0].quota, 0.6);
  assert.ok(Math.abs(a.ordinati[1].cumulata - 0.85) < 1e-9);
  assert.ok(Math.abs(a.ordinati[3].cumulata - 1) < 1e-9);
});

test("l'analisi 80/20 isola chi fa la maggior parte del monte stipendi", () => {
  const a = analizzaStipendi({ giocatori: ROSA, ruoli: RUOLI, entrateSettimanali: 100000 });
  assert.equal(a.pareto.quanti, 2);
  assert.deepEqual(a.pareto.giocatori.map((x) => x.nome), ['Fuoriclasse', 'Titolare']);
});

test('chi non costa nulla non entra mai tra i pesi', () => {
  const a = analizzaStipendi({ giocatori: [g('1', 'Pagato', 1000), g('2', 'Gratis', 0)], ruoli: RUOLI, entrateSettimanali: 0 });
  assert.equal(a.pareto.quanti, 1);
  assert.equal(a.ordinati[1].dentroPareto, false);
});

test('il costo si ripartisce per ruolo e per fascia di età', () => {
  const a = analizzaStipendi({ giocatori: ROSA, ruoli: RUOLI, entrateSettimanali: 100000 });

  const difensori = a.perRuolo.find((r) => r.id === 'difensore');
  assert.equal(difensori.numero, 2);
  assert.equal(difensori.totale, 30000);
  assert.equal(difensori.medio, 15000);
  assert.equal(difensori.quota, 0.3);

  const veterani = a.perFasciaEta.find((f) => f.id === 'veterani');
  assert.equal(veterani.numero, 1, 'il portiere di 31 anni');
  assert.equal(veterani.totale, 10000);

  const somma = a.perFasciaEta.reduce((s, f) => s + f.totale, 0);
  assert.equal(somma, a.totale, 'le fasce coprono tutta la rosa');
});

test('le fasce di età non lasciano scoperta nessuna età', () => {
  for (const eta of [15, 17, 20, 21, 25, 26, 29, 30, 40]) {
    assert.ok(FASCE_ETA.includes(fasciaDi(eta)), `età ${eta} senza fascia`);
  }
});

test('la proiezione di cassa segnala quando finisce il denaro', () => {
  const a = analizzaStipendi({
    giocatori: ROSA, ruoli: RUOLI,
    entrateSettimanali: 80000,   // 20.000 in meno degli stipendi
    cassa: 50000,
    orizzonteSettimane: 5,
  });
  assert.equal(a.margine, -20000);
  assert.equal(a.proiezione[0].cassa, 30000);
  assert.equal(a.settimanaRottura, 3);
  assert.equal(a.autonomiaSettimane, 2.5);
  assert.ok(a.avvisi.some((x) => x.tono === 'critico'));
});

test('con i conti in ordine non si parla di autonomia né di allarmi', () => {
  const a = analizzaStipendi({ giocatori: ROSA, ruoli: RUOLI, entrateSettimanali: 200000, cassa: 1000000 });
  assert.equal(a.autonomiaSettimane, null);
  assert.equal(a.settimanaRottura, null);
  assert.ok(!a.avvisi.some((x) => x.tono === 'critico'));
});

test('cedere un giocatore mostra il risparmio e il nuovo margine', () => {
  const dopo = senzaGiocatori({ giocatori: ROSA, ids: ['1'], entrateSettimanali: 80000 });
  assert.equal(dopo.risparmio, 60000);
  assert.equal(dopo.totale, 40000);
  assert.equal(dopo.margine, 40000);
  assert.equal(dopo.rimasti, 3);
});

test('una rosa vuota non esplode e lo dice', () => {
  const a = analizzaStipendi({ giocatori: [], ruoli: RUOLI, entrateSettimanali: 0 });
  assert.equal(a.totale, 0);
  assert.equal(a.medio, 0);
  assert.ok(a.avvisi.length > 0);
});

test('i messaggi mostrano i numeri con le migliaia separate', () => {
  const a = analizzaStipendi({
    giocatori: [g('1', 'Caro', 1234567)], ruoli: RUOLI, entrateSettimanali: 1000, cassa: 0,
  });
  const rosso = a.avvisi.find((x) => x.testo.includes('superano le entrate'));
  assert.ok(rosso.testo.includes('1.233.567'), `atteso il numero separato, trovato: ${rosso.testo}`);
});
