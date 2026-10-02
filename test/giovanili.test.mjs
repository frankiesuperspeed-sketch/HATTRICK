import test from 'node:test';
import assert from 'node:assert/strict';

import {
  crescitaMisurata, settimaneAlLivello, confrontaConRosa, valutaGiovane, analizzaVivaio,
  PARAMETRI_PREDEFINITI,
} from '../assets/js/calcolo/giovanili.js';

const abilitaDi = () => 'difesa';

const titolare = (nome, livello) => ({ id: nome, nome, ruolo: 'difensore', abilita: { difesa: livello } });
const ROSA = [titolare('Capitano', 10), titolare('Riserva', 6), titolare('Panchinaro', 4)];

const giovane = (nome, livello, eta = 17, extra = {}) =>
  ({ id: nome, nome, ruolo: 'difensore', eta, abilita: { difesa: livello }, ...extra });

test('con meno di due letture non si misura una crescita', () => {
  assert.equal(crescitaMisurata([]).perSettimana, null);
  assert.equal(crescitaMisurata([{ settimana: 1, livello: 5 }]).perSettimana, null);
  assert.equal(crescitaMisurata([{ settimana: 1, livello: 5 }]).letture, 1);
});

test('la crescita è misurata fra la prima e l’ultima lettura', () => {
  const c = crescitaMisurata([
    { settimana: 1, livello: 4 },
    { settimana: 5, livello: 5 },
    { settimana: 9, livello: 6 },
  ]);
  assert.equal(c.letture, 3);
  assert.equal(c.settimaneOsservate, 8);
  assert.equal(c.perSettimana, 0.25);
});

test('le letture disordinate o incomplete non falsano la misura', () => {
  const c = crescitaMisurata([
    { settimana: 9, livello: 6 },
    { settimana: null, livello: 99 },
    { settimana: 1, livello: 4 },
  ]);
  assert.equal(c.letture, 2);
  assert.equal(c.perSettimana, 0.25);
});

test('le settimane per arrivare a un livello seguono la crescita misurata', () => {
  assert.equal(settimaneAlLivello({ corrente: 4, obiettivo: 6, perSettimana: 0.25 }), 8);
  assert.equal(settimaneAlLivello({ corrente: 6, obiettivo: 6, perSettimana: 0.25 }), 0, 'già arrivato');
  assert.equal(settimaneAlLivello({ corrente: 4, obiettivo: 6, perSettimana: 0 }), null, 'fermo: non ci arriva');
  assert.equal(settimaneAlLivello({ corrente: 4, obiettivo: 6, perSettimana: null }), null);
});

test('il confronto con la rosa dice chi il giovane supera già', () => {
  const c = confrontaConRosa({ giovane: giovane('Promessa', 7), rosa: ROSA, abilita: 'difesa' });
  assert.equal(c.livello, 7);
  assert.equal(c.titolari, 3);
  assert.deepEqual(c.meglioDi.map((g) => g.nome), ['Riserva', 'Panchinaro']);
  assert.deepEqual(c.peggioDi.map((g) => g.nome), ['Capitano']);
});

test('il confronto guarda solo lo stesso ruolo', () => {
  const rosaMista = [...ROSA, { id: 'p', nome: 'Portiere', ruolo: 'portiere', abilita: { difesa: 1 } }];
  const c = confrontaConRosa({ giovane: giovane('Promessa', 2), rosa: rosaMista, abilita: 'difesa' });
  assert.equal(c.titolari, 3, 'il portiere non entra nel confronto fra difensori');
  assert.equal(c.meglioDi.length, 0);
});

test('un margine più alto rende la promozione più esigente', () => {
  // titolari a 10, 6 e 4; il giovane è a 7
  const senza = confrontaConRosa({ giovane: giovane('Promessa', 7), rosa: ROSA, abilita: 'difesa', margine: 0 });
  assert.deepEqual(senza.meglioDi.map((g) => g.nome), ['Riserva', 'Panchinaro']);

  const stretto = confrontaConRosa({ giovane: giovane('Promessa', 7), rosa: ROSA, abilita: 'difesa', margine: 2 });
  assert.deepEqual(stretto.meglioDi.map((g) => g.nome), ['Panchinaro'], 'la riserva a 6 non basta più superarla di poco');

  const severo = confrontaConRosa({ giovane: giovane('Promessa', 7), rosa: ROSA, abilita: 'difesa', margine: 4 });
  assert.equal(severo.meglioDi.length, 0, 'con margine 4 non supera più nessuno');
});

test('un giovane senza livello inserito non viene confrontato a caso', () => {
  const c = confrontaConRosa({ giovane: { nome: 'Ignoto', ruolo: 'difensore', abilita: {} }, rosa: ROSA, abilita: 'difesa' });
  assert.equal(c.livello, null);
  assert.deepEqual(c.meglioDi, []);
});

test('è pronto chi supera qualcuno in prima squadra, e il motivo è scritto', () => {
  const v = valutaGiovane({ giovane: giovane('Promessa', 7), rosa: ROSA, abilita: 'difesa' });
  assert.equal(v.pronto, true);
  assert.ok(v.motivi[0].includes('Riserva'));
  assert.equal(v.mancanoLivelli, 3, 'per superare il capitano');
});

test('è pronto anche chi sta per superare l’età massima', () => {
  const v = valutaGiovane({ giovane: giovane('Scadenza', 2, 19), rosa: ROSA, abilita: 'difesa' });
  assert.equal(v.pronto, true);
  assert.ok(v.motivi.some((m) => m.includes('età massima')));
  assert.equal(v.anniRimasti, 0);
  assert.equal(v.settimaneRimaste, 0);
});

test('chi non supera nessuno e ha tempo non è pronto', () => {
  const v = valutaGiovane({ giovane: giovane('Acerbo', 3, 16), rosa: ROSA, abilita: 'difesa' });
  assert.equal(v.pronto, false);
  assert.deepEqual(v.motivi, []);
  assert.equal(v.anniRimasti, 3);
});

test('il potenziale è quello che hai inserito, e dice quando ci arriva', () => {
  const v = valutaGiovane({
    giovane: giovane('Talento', 5, 17, { potenziale: 9 }),
    rosa: ROSA, abilita: 'difesa',
    storico: [{ settimana: 1, livello: 4 }, { settimana: 5, livello: 5 }],
  });
  assert.equal(v.potenziale, 9);
  assert.equal(v.crescita.perSettimana, 0.25);
  assert.equal(v.settimaneAlPotenziale, 16);

  const senzaPotenziale = valutaGiovane({ giovane: giovane('Ignoto', 5), rosa: ROSA, abilita: 'difesa' });
  assert.equal(senzaPotenziale.potenziale, null, 'non si inventa un potenziale');
  assert.equal(senzaPotenziale.settimaneAlPotenziale, null);
});

test('il vivaio mette davanti i pronti e segnala chi è senza livello', () => {
  const q = analizzaVivaio({
    giovani: [
      giovane('Acerbo', 3, 16),
      giovane('Pronto', 8, 17),
      { id: 'x', nome: 'Ignoto', ruolo: 'difensore', eta: 17, abilita: {} },
      { id: 'y', nome: '', ruolo: 'difensore', eta: 17, abilita: { difesa: 9 } },
    ],
    rosa: ROSA, abilitaDi,
  });
  assert.equal(q.righe.length, 3, 'le righe senza nome non contano');
  assert.equal(q.righe[0].giovane.nome, 'Pronto');
  assert.deepEqual(q.pronti.map((r) => r.giovane.nome), ['Pronto']);
  assert.deepEqual(q.senzaLivello, ['Ignoto']);
});

test('i parametri sono modificabili: alzando l’età massima cambia chi è in scadenza', () => {
  const giovani = [giovane('Diciannovenne', 3, 19)];
  const stretto = analizzaVivaio({ giovani, rosa: ROSA, abilitaDi, parametri: PARAMETRI_PREDEFINITI });
  const largo = analizzaVivaio({ giovani, rosa: ROSA, abilitaDi, parametri: { ...PARAMETRI_PREDEFINITI, etaMassima: 21 } });
  assert.equal(stretto.inScadenza.length, 1);
  assert.equal(largo.inScadenza.length, 0);
});
