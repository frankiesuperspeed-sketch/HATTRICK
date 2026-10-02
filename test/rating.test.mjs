import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizza, aNumero, daNumero, interpreta, perEsteso, tabellaRiferimento,
  SCALA_PREDEFINITA, SOTTOLIVELLI_PREDEFINITI,
} from '../assets/js/calcolo/rating.js';

test('la normalizzazione toglie accenti, parentesi e spazi di troppo', () => {
  assert.equal(normalizza('  Eccellente  (Molto Alto) '), 'eccellente molto alto');
  assert.equal(normalizza('Perchè'), 'perche');
});

test('livello e sottolivello diventano un numero', () => {
  assert.equal(aNumero({ livello: 8, sottolivello: 0 }), 8);
  assert.equal(aNumero({ livello: 8, sottolivello: 1 }), 8.25);
  assert.equal(aNumero({ livello: 8, sottolivello: 3 }), 8.75);
  assert.equal(aNumero({ livello: 8, sottolivello: 9 }), 8.75, 'il sottolivello non sfora');
  assert.equal(aNumero({ livello: 'x' }), null);
});

test('il numero di sottolivelli è un parametro, non una costante', () => {
  assert.equal(aNumero({ livello: 5, sottolivello: 1, quantiSottolivelli: 2 }), 5.5);
});

test('dal numero si risale a livello, sottolivello e nomi', () => {
  const r = daNumero(8.5);
  assert.equal(r.livello, 8);
  assert.equal(r.sottolivello, 2);
  assert.equal(r.nome, SCALA_PREDEFINITA[8]);
  assert.equal(r.nomeSottolivello, SOTTOLIVELLI_PREDEFINITI[2]);
  assert.equal(r.valore, 8.5);
});

test('numeri non validi o fuori scala vengono dichiarati tali', () => {
  assert.equal(daNumero(-1), null);
  assert.equal(daNumero('niente'), null);
  assert.equal(daNumero(99).fuoriScala, true);
  assert.equal(daNumero(8).fuoriScala, false);
});

test('interpreta un nome semplice', () => {
  const r = interpreta('eccellente');
  assert.equal(r.livello, 8);
  assert.equal(r.sottolivello, 0);
  assert.equal(r.valore, 8);
});

test('interpreta nome e sottolivello, con o senza parentesi', () => {
  for (const testo of ['buono (molto alto)', 'Buono molto alto', '  buono   MOLTO ALTO ']) {
    const r = interpreta(testo);
    assert.equal(r.livello, 7, testo);
    assert.equal(r.sottolivello, 3, testo);
    assert.equal(r.valore, 7.75, testo);
  }
});

test('“molto alto” non viene scambiato per “alto”', () => {
  assert.equal(interpreta('buono alto').sottolivello, 2);
  assert.equal(interpreta('buono molto alto').sottolivello, 3);
  assert.equal(interpreta('buono basso').sottolivello, 1);
  assert.equal(interpreta('buono molto basso').sottolivello, 0);
});

test('interpreta anche i numeri, con la virgola o con il punto', () => {
  assert.equal(interpreta('8.75').valore, 8.75);
  assert.equal(interpreta('8,75').valore, 8.75);
  assert.equal(interpreta('12').livello, 12);
});

test('quello che non capisce lo dice, invece di indovinare', () => {
  assert.equal(interpreta('pizza'), null);
  assert.equal(interpreta(''), null);
  assert.equal(interpreta(null), null);
});

test('una scala personalizzata sostituisce del tutto quella predefinita', () => {
  const scala = ['zero', 'uno', 'due', 'tre'];
  const sottolivelli = ['giù', 'su'];
  const r = interpreta('due su', { scala, sottolivelli });
  assert.equal(r.livello, 2);
  assert.equal(r.valore, 2.5);
  assert.equal(interpreta('eccellente', { scala, sottolivelli }), null, 'i nomi vecchi non valgono più');
});

test('andata e ritorno: nome → numero → nome', () => {
  for (let livello = 0; livello < SCALA_PREDEFINITA.length; livello++) {
    for (let sotto = 0; sotto < SOTTOLIVELLI_PREDEFINITI.length; sotto++) {
      const testo = `${SCALA_PREDEFINITA[livello]} (${SOTTOLIVELLI_PREDEFINITI[sotto]})`;
      const avanti = interpreta(testo);
      const indietro = daNumero(avanti.valore);
      assert.equal(indietro.livello, livello, testo);
      assert.equal(indietro.sottolivello, sotto, testo);
      assert.equal(perEsteso(indietro), `${SCALA_PREDEFINITA[livello]} (${SOTTOLIVELLI_PREDEFINITI[sotto]})`);
    }
  }
});

test('la tabella di riferimento copre tutta la scala', () => {
  const t = tabellaRiferimento();
  assert.equal(t.length, SCALA_PREDEFINITA.length);
  assert.equal(t[8].nome, SCALA_PREDEFINITA[8]);
  assert.equal(t[8].valori.length, 4);
  assert.deepEqual(t[8].valori.map((v) => v.valore), [8, 8.25, 8.5, 8.75]);
});

test('la scala italiana è quella ufficiale, livello per livello', () => {
  // Fonte: la scala principale di Hattrick in italiano, 0–20, valida sia per
  // le abilità sia per i rating dei reparti. Bloccata qui perché una modifica
  // involontaria si veda subito.
  assert.deepEqual(SCALA_PREDEFINITA, [
    'inesistente', 'disastroso', 'tremendo', 'scarso', 'debole', 'insufficiente',
    'accettabile', 'buono', 'eccellente', 'formidabile', 'straordinario',
    'splendido', 'magnifico', 'fuoriclasse', 'sovrannaturale', 'titanico',
    'extraterrestre', 'mitico', 'magico', 'utopico', 'divino',
  ]);
  assert.equal(SCALA_PREDEFINITA.length, 21, 'da 0 a 20 compresi');
  assert.equal(SCALA_PREDEFINITA[0], 'inesistente');
  assert.equal(SCALA_PREDEFINITA[20], 'divino');
});

test('i nomi scritti sono riconosciuti dalla conversione', () => {
  SCALA_PREDEFINITA.forEach((nome, livello) => {
    assert.equal(interpreta(nome)?.livello, livello, `"${nome}" dovrebbe valere ${livello}`);
  });
});
