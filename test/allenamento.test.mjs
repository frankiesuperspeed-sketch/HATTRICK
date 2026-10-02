import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fattoreEta, fattoreAllenatore, giocatoriAllenati, crescitaSettimanale,
  settimaneAlProssimoScatto, proietta, pianoStagionale, confrontaAllenamenti, calibraVelocita,
  ALLENAMENTI_PREDEFINITI, PARAMETRI_PREDEFINITI, SETTIMANE_PER_STAGIONE,
} from '../assets/js/calcolo/allenamento.js';

const allenamento = (id) => ALLENAMENTI_PREDEFINITI.find((a) => a.id === id);

/** Condizioni di riferimento: ogni fattore vale 1, tranne la velocità del tipo. */
const RIFERIMENTO = {
  giocatore: { id: 'x', nome: 'Tipo', ruolo: 'ala', eta: 20 },
  livello: 8,
  allenamento: { id: 'prova', nome: 'Prova', abilita: 'cross', ruoli: ['ala'], velocita: 1 },
  impostazioni: { allenatore: 7, assistenti: 0, intensita: 100, quotaResistenza: 0 },
};

test('il fattore età interpola e si ferma agli estremi della tabella', () => {
  assert.equal(fattoreEta(20), 1);
  assert.ok(fattoreEta(21) < fattoreEta(20), 'a 21 si cresce meno che a 20');
  const mezzo = fattoreEta(20.5);
  assert.ok(mezzo < fattoreEta(20) && mezzo > fattoreEta(21), 'valore intermedio');
  assert.equal(fattoreEta(14), fattoreEta(17), 'sotto la tabella resta il primo valore');
  assert.equal(fattoreEta(45), fattoreEta(33), 'sopra la tabella resta l’ultimo');
  assert.equal(fattoreEta(null), 1, 'età mancante: nessun effetto, invece di azzerare tutto');
});

test('il fattore allenatore usa il livello disponibile più vicino', () => {
  assert.equal(fattoreAllenatore(7), 1);
  assert.equal(fattoreAllenatore(12), fattoreAllenatore(8));
  assert.equal(fattoreAllenatore(1), fattoreAllenatore(4));
});

test('nelle condizioni di riferimento la crescita è la velocità di base', () => {
  const { crescita } = crescitaSettimanale(RIFERIMENTO);
  assert.ok(Math.abs(crescita - PARAMETRI_PREDEFINITI.velocitaBase) < 1e-12);
});

test('un livello non inserito non produce una crescita inventata', () => {
  const { crescita, fattori } = crescitaSettimanale({ ...RIFERIMENTO, livello: null });
  assert.equal(crescita, 0);
  assert.equal(fattori, null);
});

test('giovani e livelli bassi crescono più in fretta', () => {
  const base = crescitaSettimanale(RIFERIMENTO).crescita;
  const giovane = crescitaSettimanale({ ...RIFERIMENTO, giocatore: { ...RIFERIMENTO.giocatore, eta: 17 } }).crescita;
  const anziano = crescitaSettimanale({ ...RIFERIMENTO, giocatore: { ...RIFERIMENTO.giocatore, eta: 30 } }).crescita;
  assert.ok(giovane > base && base > anziano);
  assert.ok(crescitaSettimanale({ ...RIFERIMENTO, livello: 5 }).crescita > base);
  assert.ok(crescitaSettimanale({ ...RIFERIMENTO, livello: 14 }).crescita < base);
});

test('intensità e quota resistenza riducono la crescita in proporzione', () => {
  const base = crescitaSettimanale(RIFERIMENTO).crescita;
  const meta = crescitaSettimanale({ ...RIFERIMENTO, impostazioni: { ...RIFERIMENTO.impostazioni, intensita: 50 } }).crescita;
  const conResistenza = crescitaSettimanale({ ...RIFERIMENTO, impostazioni: { ...RIFERIMENTO.impostazioni, quotaResistenza: 25 } }).crescita;
  assert.ok(Math.abs(meta - base * 0.5) < 1e-12);
  assert.ok(Math.abs(conResistenza - base * 0.75) < 1e-12);
});

test('a intensità zero non si cresce e non si scatta mai', () => {
  const fermo = { ...RIFERIMENTO, impostazioni: { ...RIFERIMENTO.impostazioni, intensita: 0 } };
  assert.equal(crescitaSettimanale(fermo).crescita, 0);
  assert.equal(settimaneAlProssimoScatto(fermo), null);
  assert.deepEqual(proietta({ ...fermo, settimane: 50 }).scatti, []);
});

test('l’allenamento raggiunge solo i ruoli che gli competono', () => {
  const rosa = [
    { id: '1', nome: 'Ala', ruolo: 'ala' },
    { id: '2', nome: 'Terzino', ruolo: 'terzino' },
    { id: '3', nome: 'Punta', ruolo: 'attaccante' },
  ];
  const conCross = giocatoriAllenati({ giocatori: rosa, allenamento: allenamento('cross') });
  assert.deepEqual(conCross.map((g) => g.nome), ['Ala', 'Terzino']);
  assert.equal(giocatoriAllenati({ giocatori: rosa, allenamento: { ruoli: [] } }).length, 0);
});

test('la proiezione alza i livelli uno alla volta e rallenta via via', () => {
  const p = proietta({ ...RIFERIMENTO, settimane: 100, dataInizio: new Date('2026-01-01T00:00:00Z') });
  assert.ok(p.scatti.length >= 3);
  assert.deepEqual(p.scatti.slice(0, 3).map((s) => s.livello), [9, 10, 11]);
  for (let i = 1; i < p.scatti.length; i++) {
    const attesa = p.scatti[i].settimana - p.scatti[i - 1].settimana;
    const precedente = i > 1 ? p.scatti[i - 1].settimana - p.scatti[i - 2].settimana : 0;
    assert.ok(attesa >= precedente, 'ogni livello costa almeno quanto il precedente');
    assert.ok(p.scatti[i].data > p.scatti[i - 1].data);
  }
});

test('nella proiezione il giocatore invecchia di un anno a stagione', () => {
  const p = proietta({ ...RIFERIMENTO, settimane: SETTIMANE_PER_STAGIONE * 3 });
  assert.equal(p.etaFinale, RIFERIMENTO.giocatore.eta + 3);
});

test('il sublivello già accumulato avvicina lo scatto', () => {
  const daZero = settimaneAlProssimoScatto(RIFERIMENTO);
  const aMeta = settimaneAlProssimoScatto({ ...RIFERIMENTO, sublivello: 0.5 });
  assert.ok(Math.abs(aMeta - daZero / 2) < 1e-9);
});

test('il piano di stagione copre solo gli allenati e segnala le abilità mancanti', () => {
  const rosa = [
    { id: 'a', nome: 'Ala brava', ruolo: 'ala', eta: 18, abilita: { cross: 7 } },
    { id: 'b', nome: 'Ala senza dati', ruolo: 'ala', eta: 19, abilita: {} },
    { id: 'c', nome: 'Portiere', ruolo: 'portiere', eta: 25, abilita: { portiere: 10 } },
  ];
  const piano = pianoStagionale({
    giocatori: rosa, allenamento: allenamento('cross'),
    impostazioni: RIFERIMENTO.impostazioni, settimane: SETTIMANE_PER_STAGIONE,
  });
  assert.equal(piano.allenati, 2, 'il portiere non riceve l’allenamento cross');
  assert.deepEqual(piano.senzaAbilita, ['Ala senza dati']);
  assert.ok(piano.livelliGuadagnati >= 1);
  assert.equal(piano.scatti[0].nome, 'Ala brava');
});

test('gli scatti del piano sono ordinati nel tempo', () => {
  const rosa = [
    { id: 'a', nome: 'Giovane', ruolo: 'ala', eta: 17, abilita: { cross: 5 } },
    { id: 'b', nome: 'Maturo', ruolo: 'ala', eta: 28, abilita: { cross: 12 } },
  ];
  const piano = pianoStagionale({ giocatori: rosa, allenamento: allenamento('cross'), impostazioni: RIFERIMENTO.impostazioni, settimane: 60 });
  for (let i = 1; i < piano.scatti.length; i++) {
    assert.ok(piano.scatti[i].settimana >= piano.scatti[i - 1].settimana);
  }
  assert.equal(piano.scatti[0].nome, 'Giovane', 'il giovane scatta prima');
});

test('il confronto fra allenamenti ordina per crescita complessiva', () => {
  const rosa = [
    { id: 'a', nome: 'Ala', ruolo: 'ala', eta: 18, abilita: { cross: 6, punizioni: 6 } },
    { id: 'b', nome: 'Ala2', ruolo: 'ala', eta: 19, abilita: { cross: 7, punizioni: 7 } },
  ];
  const elenco = confrontaAllenamenti({ giocatori: rosa, impostazioni: RIFERIMENTO.impostazioni, settimane: SETTIMANE_PER_STAGIONE });
  assert.equal(elenco.length, ALLENAMENTI_PREDEFINITI.length);
  for (let i = 1; i < elenco.length; i++) {
    assert.ok(elenco[i - 1].crescitaTotale >= elenco[i].crescitaTotale);
  }
  const regia = elenco.find((e) => e.allenamento.id === 'regia');
  assert.equal(regia.allenati, 0, 'nessun centrocampista in rosa');
  assert.equal(regia.crescitaTotale, 0);
});

test('la calibrazione riallinea il modello alle settimane osservate', () => {
  const osservate = 5;
  const nuova = calibraVelocita({ ...RIFERIMENTO, settimaneOsservate: osservate });
  assert.ok(nuova > 0);
  const ricalcolate = settimaneAlProssimoScatto({
    ...RIFERIMENTO,
    parametri: { ...PARAMETRI_PREDEFINITI, velocitaBase: nuova },
  });
  assert.ok(Math.abs(ricalcolate - osservate) < 0.05, `atteso ~${osservate}, ottenuto ${ricalcolate}`);
  assert.equal(calibraVelocita({ ...RIFERIMENTO, settimaneOsservate: 0 }), null);
});

test('il confronto distingue "non rende" da "mancano i dati"', () => {
  const rosa = [
    { id: 'a', nome: 'Ala con dati', ruolo: 'ala', eta: 18, abilita: { cross: 6 } },
    { id: 'b', nome: 'Ala senza dati', ruolo: 'ala', eta: 18, abilita: {} },
  ];
  const elenco = confrontaAllenamenti({ giocatori: rosa, impostazioni: RIFERIMENTO.impostazioni, settimane: SETTIMANE_PER_STAGIONE });

  const cross = elenco.find((e) => e.allenamento.id === 'cross');
  assert.equal(cross.allenati, 2);
  assert.equal(cross.senzaAbilita, 1, 'uno dei due non ha il livello di cross');
  assert.ok(cross.crescitaTotale > 0);

  const punizioni = elenco.find((e) => e.allenamento.id === 'punizioni');
  assert.equal(punizioni.allenati, 2, 'le punizioni toccano tutti i ruoli');
  assert.equal(punizioni.senzaAbilita, 2, 'ma nessuno ha il livello inserito');
  assert.equal(punizioni.crescitaTotale, 0);

  const regia = elenco.find((e) => e.allenamento.id === 'regia');
  assert.equal(regia.allenati, 0, 'nessun centrocampista: è un altro caso ancora');
  assert.equal(regia.senzaAbilita, 0);
});
