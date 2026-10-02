import test from 'node:test';
import assert from 'node:assert/strict';

import {
  forzaTattica, applicaTattica, confrontaTattiche,
  TATTICHE_PREDEFINITE, LIVELLO_PIENO,
} from '../assets/js/calcolo/tattiche.js';

const SETTORI = { difesa: 40, centrocampo: 30, attacco: 20 };
const tattica = (id) => TATTICHE_PREDEFINITE.find((t) => t.id === id);

const giocatore = (id, nome, abilita) => ({ id, nome, abilita });
const ROSA = [
  giocatore('a', 'Difensore forte', { difesa: 12 }),
  giocatore('b', 'Difensore scarso', { difesa: 8 }),
  giocatore('c', 'Ala', { cross: 10 }),
  giocatore('d', 'Senza dati', {}),
];
const SCHIERAMENTO = ROSA.map((g) => ({ giocatoreId: g.id }));

test('la forza nasce dalla media di chi ha davvero quell’abilità', () => {
  const f = forzaTattica({ tattica: tattica('pressing'), schieramento: SCHIERAMENTO, giocatori: ROSA });
  assert.equal(f.livello, 10, 'media fra 12 e 8');
  assert.equal(f.forza, 1, 'al livello pieno la tattica rende tutto');
  assert.equal(f.contributori.length, 2, 'chi non ha difesa non entra nella media');
  assert.equal(f.contributori[0].nome, 'Difensore forte', 'ordinati dal più forte');
});

test('nessuno con quell’abilità significa forza zero, non un errore', () => {
  const f = forzaTattica({ tattica: tattica('tiri'), schieramento: SCHIERAMENTO, giocatori: ROSA });
  assert.equal(f.livello, null);
  assert.equal(f.forza, 0);
  assert.deepEqual(f.contributori, []);
});

test('la tattica "nessuna" non ha abilità né forza', () => {
  const f = forzaTattica({ tattica: tattica('nessuna'), schieramento: SCHIERAMENTO, giocatori: ROSA });
  assert.equal(f.livello, null);
  assert.equal(f.forza, 0);
});

test('il livello pieno è un parametro: alzarlo indebolisce la stessa rosa', () => {
  const normale = forzaTattica({ tattica: tattica('pressing'), schieramento: SCHIERAMENTO, giocatori: ROSA });
  const esigente = forzaTattica({ tattica: tattica('pressing'), schieramento: SCHIERAMENTO, giocatori: ROSA, livelloPieno: 20 });
  assert.equal(normale.forza, 1);
  assert.equal(esigente.forza, 0.5);
});

test('gli effetti spostano i reparti in proporzione alla forza', () => {
  const piena = applicaTattica({ settori: SETTORI, tattica: tattica('pressing'), forza: 1 });
  assert.ok(Math.abs(piena.difesa - 44) < 1e-9, 'difesa +10%');
  assert.ok(Math.abs(piena.centrocampo - 27.6) < 1e-9, 'centrocampo −8%');

  const meta = applicaTattica({ settori: SETTORI, tattica: tattica('pressing'), forza: 0.5 });
  assert.ok(Math.abs(meta.difesa - 42) < 1e-9, 'a metà forza, metà effetto');
});

test('senza forza la tattica non sposta nulla', () => {
  const niente = applicaTattica({ settori: SETTORI, tattica: tattica('contropiede'), forza: 0 });
  assert.deepEqual(niente, SETTORI);
});

test('"nessuna tattica" lascia i reparti come sono', () => {
  assert.deepEqual(applicaTattica({ settori: SETTORI, tattica: tattica('nessuna'), forza: 1 }), SETTORI);
});

test('il confronto ordina le tattiche dalla più redditizia', () => {
  const elenco = confrontaTattiche({ settori: SETTORI, schieramento: SCHIERAMENTO, giocatori: ROSA });
  assert.equal(elenco.length, TATTICHE_PREDEFINITE.length);
  for (let i = 1; i < elenco.length; i++) {
    assert.ok(elenco[i - 1].punteggio >= elenco[i].punteggio, 'ordinate per punteggio');
  }
  const nessuna = elenco.find((e) => e.tattica.id === 'nessuna');
  assert.equal(nessuna.guadagno, 0, 'il riferimento è non fare nulla');
});

test('una tattica che la rosa non sa giocare non cambia nulla', () => {
  const elenco = confrontaTattiche({ settori: SETTORI, schieramento: SCHIERAMENTO, giocatori: ROSA });
  const tiri = elenco.find((e) => e.tattica.id === 'tiri');
  assert.equal(tiri.forza, 0);
  assert.equal(tiri.guadagno, 0);
});

test('i pesi dei reparti cambiano quale tattica conviene', () => {
  const difensivo = confrontaTattiche({
    settori: SETTORI, schieramento: SCHIERAMENTO, giocatori: ROSA,
    pesi: { difesa: 3, centrocampo: 1, attacco: 1 },
  });
  assert.equal(difensivo[0].tattica.id, 'pressing', 'pesando la difesa, il pressing conviene');

  const offensivo = confrontaTattiche({
    settori: SETTORI, schieramento: SCHIERAMENTO, giocatori: ROSA,
    pesi: { difesa: 0, centrocampo: 0, attacco: 1 },
  });
  assert.ok(offensivo[0].variazioni.attacco > 0, 'pesando solo l’attacco vince chi lo alza');
});

test('le variazioni dichiarate corrispondono ai valori prodotti', () => {
  const elenco = confrontaTattiche({ settori: SETTORI, schieramento: SCHIERAMENTO, giocatori: ROSA });
  for (const voce of elenco) {
    for (const [reparto, valore] of Object.entries(voce.settori)) {
      assert.ok(Math.abs((SETTORI[reparto] + voce.variazioni[reparto]) - valore) < 1e-9, `${voce.tattica.nome}/${reparto}`);
    }
  }
});
