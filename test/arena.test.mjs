import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SETTORI, PROFILI, UMORI, ARENA_INIZIALE, PARAMETRI_PREDEFINITI,
  coefficienteAffluenza, dimensioneSuggerita, distribuisci,
  progettaArena, incassoAtteso, rientro, avvisiArena, giorniLavori,
} from '../assets/js/calcolo/arena.js';

const nrg = PROFILI.find((p) => p.id === 'nrg').percentuali;
const somma = (o) => SETTORI.reduce((acc, s) => acc + (o[s.id] ?? 0), 0);

/* ---------------------------------------------------------- affluenza */

test('il coefficiente cresce con l’umore dei tifosi', () => {
  assert.equal(coefficienteAffluenza(0), 8.929);
  assert.ok(Math.abs(coefficienteAffluenza(6) - 15.8926) < 1e-9, 'umore “contenti”');
  assert.ok(coefficienteAffluenza(11) > coefficienteAffluenza(6), 'più contenti, più gente');
});

test('un umore fuori scala viene riportato dentro, invece di dare numeri assurdi', () => {
  assert.equal(coefficienteAffluenza(-3), coefficienteAffluenza(0));
  assert.equal(coefficienteAffluenza(99), coefficienteAffluenza(UMORI.length - 1));
  assert.equal(coefficienteAffluenza(null), coefficienteAffluenza(0), 'campo vuoto non è un errore');
});

test('i posti consigliati sono l’affluenza attesa più il sovradimensionamento', () => {
  const d = dimensioneSuggerita({ tifosi: 1000, umore: 6, sovradimensionamento: 125 });
  assert.equal(d.affluenzaAttesa, 15893, '1000 tifosi contenti');
  assert.equal(d.suggerita, 19866, 'il 25 % in più dell’affluenza');
  assert.equal(d.coefficienteEffettivo, 19.87, 'coefficiente già maggiorato, come lo mostra la scheda');
});

test('senza tifosi non si consiglia nessun posto', () => {
  assert.equal(dimensioneSuggerita({ tifosi: 0, umore: 6 }).suggerita, 0);
  assert.equal(dimensioneSuggerita({ tifosi: null, umore: 6 }).suggerita, 0);
});

/* -------------------------------------------------------- ripartizione */

test('la ripartizione non perde né inventa posti', () => {
  for (const totale of [1, 7, 100, 9999, 54321]) {
    assert.equal(somma(distribuisci(totale, nrg)), totale, `totale ${totale}`);
  }
});

test('i posti avanzati vanno a chi è stato arrotondato per difetto di più', () => {
  // esatti: 56,5 / 23 / 18 / 2,5 → interi 56/23/18/2, un posto avanza
  const d = distribuisci(100, nrg);
  assert.equal(d.gradinate, 57, 'il resto più grosso è quello delle gradinate');
  assert.equal(d.tribune, 23);
  assert.equal(d.coperte, 18);
  assert.equal(d.vip, 2);
});

test('percentuali che non fanno 100 vengono normalizzate', () => {
  const d = distribuisci(1000, { gradinate: 30, tribune: 30, coperte: 0, vip: 0 });
  assert.equal(somma(d), 1000);
  assert.equal(d.gradinate, 500);
  assert.equal(d.tribune, 500);
});

test('senza percentuali o senza posti la ripartizione è vuota, non è un errore', () => {
  assert.equal(somma(distribuisci(1000, {})), 0);
  assert.equal(somma(distribuisci(0, nrg)), 0);
});

/* ------------------------------------------------------------ progetto */

test('ampliare lo stadio iniziale: posti, costo, tempi, manutenzione, incasso', () => {
  const p = progettaArena({ attuale: ARENA_INIZIALE, obiettivo: 15000, percentuali: nrg });

  assert.equal(p.totale, 15000);
  assert.equal(p.totaleAttuale, 12000);
  assert.equal(p.daCostruire, 3000);
  assert.equal(p.daSmantellare, 0);

  // 475×45 + 450×75 + 1700×90 + 375×300
  assert.equal(p.costi.costruzione, 320625);
  assert.equal(p.costi.fisso, 10000);
  assert.equal(p.costi.totale, 330625);
  assert.equal(p.giorni, 10, '7 giorni di base più uno ogni 100.000');

  assert.equal(p.manutenzione, 10290, 'a settimana, sui posti finali');
  assert.equal(p.incassoMassimo, 158250, 'a stadio pieno');
});

test('senza smantellamento i settori già grandi restano, e il totale cresce oltre l’obiettivo', () => {
  const grande = { ...ARENA_INIZIALE, gradinate: 20000 };
  const p = progettaArena({ attuale: grande, obiettivo: 15000, percentuali: nrg, smantella: false });

  const gradinate = p.righe.find((r) => r.id === 'gradinate');
  assert.equal(gradinate.posti, 20000, 'non si tocca ciò che c’è già');
  assert.equal(gradinate.delta, 0);
  assert.ok(p.totale > 15000, 'il totale finale supera quello chiesto');
  assert.equal(p.costi.smantellamento, 0);
});

test('con lo smantellamento i posti in eccesso si demoliscono, a 6 l’uno', () => {
  const grande = { ...ARENA_INIZIALE, gradinate: 20000 };
  const p = progettaArena({ attuale: grande, obiettivo: 15000, percentuali: nrg, smantella: true });

  assert.equal(p.totale, 15000, 'ora l’obiettivo è rispettato');
  const gradinate = p.righe.find((r) => r.id === 'gradinate');
  assert.equal(gradinate.posti, 8475);
  assert.equal(gradinate.delta, -11525);
  assert.equal(p.costi.smantellamento, 11525 * 6);
});

test('se non c’è nulla da fare non si paga la quota fissa né si aspettano giorni', () => {
  const esatto = distribuisci(15000, nrg);
  const p = progettaArena({ attuale: esatto, obiettivo: 15000, percentuali: nrg });

  assert.equal(p.daCostruire, 0);
  assert.equal(p.daSmantellare, 0);
  assert.equal(p.costi.totale, 0);
  assert.equal(p.giorni, 0);
  assert.equal(giorniLavori(0), 0);
});

test('le percentuali finali e il loro scostamento dicono se il profilo è rispettato', () => {
  const esatto = distribuisci(20000, nrg);
  const p = progettaArena({ attuale: esatto, obiettivo: 20000, percentuali: nrg });
  for (const r of p.righe) {
    assert.ok(r.scostamento < 0.01, `${r.nome} segue il profilo scelto`);
    assert.ok(Math.abs(r.percentuale - r.percentualeVoluta) < 0.1, `${r.nome} alla percentuale chiesta`);
  }
});

/* -------------------------------------------------------------- incassi */

test('l’incasso atteso conta i biglietti davvero vendibili, non i posti', () => {
  // stadio piccolissimo di sole gradinate, affluenza molto maggiore
  const i = incassoAtteso({
    righe: [{ id: 'gradinate', posti: 100 }],
    affluenza: 1000,
    percentuali: { gradinate: 100 },
  });
  assert.equal(i.venduti, 100, 'oltre la capienza non si vende');
  assert.equal(i.fuori, 900, 'gli altri restano fuori');
  assert.equal(i.totale, 700, '100 biglietti da 7');
  assert.equal(i.righe[0].pieno, true);
});

test('con lo stadio capiente entrano tutti e nessuno resta fuori', () => {
  const p = progettaArena({ attuale: ARENA_INIZIALE, obiettivo: 20000, percentuali: nrg, affluenza: 16000 });
  assert.ok(p.incasso.fuori < 1, 'nessuno fuori');
  assert.ok(Math.abs(p.incasso.venduti - 16000) < 1, 'venduti quanti gli spettatori');
  assert.ok(p.incasso.totale < p.incassoMassimo, 'meno del massimo, perché lo stadio non è pieno');
});

test('l’incasso atteso cresce coi posti, e il progetto lo confronta con la situazione di oggi', () => {
  const p = progettaArena({
    attuale: { gradinate: 2000, tribune: 0, coperte: 0, vip: 0 },
    obiettivo: 20000, percentuali: nrg, affluenza: 16000, partiteCasa: 7,
  });
  assert.ok(p.incasso.totale > p.incassoPrima.totale, 'più posti, più biglietti venduti');
  assert.ok(p.incassoPrima.fuori > 0, 'oggi resterebbe fuori un sacco di gente');
  assert.ok(p.guadagnoSettimanale > 0, 'l’ampliamento rende più di quanto costi mantenerlo');
});

test('il rientro è il costo diviso il guadagno, e non esiste se il guadagno non c’è', () => {
  assert.equal(rientro({ costo: 1000, guadagnoSettimanale: 250 }).settimane, 4);
  assert.equal(rientro({ costo: 1000, guadagnoSettimanale: 0 }).possibile, false);
  assert.equal(rientro({ costo: 1000, guadagnoSettimanale: -5 }).settimane, null);
  assert.equal(rientro({ costo: 0, guadagnoSettimanale: null }).settimane, 0, 'niente lavori, niente da rientrare');
});

/* --------------------------------------------------------------- avvisi */

test('la cassa insufficiente viene detta', () => {
  const p = progettaArena({ attuale: ARENA_INIZIALE, obiettivo: 15000, percentuali: nrg });
  const con = avvisiArena({ progetto: p, cassa: 100000 });
  const senza = avvisiArena({ progetto: p, cassa: 5000000 });
  assert.ok(con.some((a) => a.tipo === 'cassa'), `servono ${p.costi.totale}, in cassa 100.000`);
  assert.ok(!senza.some((a) => a.tipo === 'cassa'));
});

test('una cassa a zero è un campo non compilato, non un allarme', () => {
  const p = progettaArena({ attuale: ARENA_INIZIALE, obiettivo: 15000, percentuali: nrg });
  assert.ok(!avvisiArena({ progetto: p, cassa: 0 }).some((a) => a.tipo === 'cassa'));
  assert.ok(!avvisiArena({ progetto: p, cassa: null }).some((a) => a.tipo === 'cassa'));
});

test('lo smantellamento è sconsigliato quando i posti non sono il doppio del necessario', () => {
  const pocoGrande = progettaArena({
    attuale: { ...ARENA_INIZIALE, gradinate: 12000 }, obiettivo: 15000, percentuali: nrg, smantella: true,
  });
  assert.ok(avvisiArena({ progetto: pocoGrande, smantella: true }).some((a) => a.tipo === 'smantellamento'));

  const enorme = progettaArena({
    attuale: { gradinate: 60000, tribune: 20000, coperte: 10000, vip: 1000 },
    obiettivo: 15000, percentuali: nrg, smantella: true,
  });
  assert.ok(!avvisiArena({ progetto: enorme, smantella: true }).some((a) => a.tipo === 'smantellamento'),
    'con il doppio dei posti lo smantellamento ha senso');
});

test('il totale che non torna viene spiegato, non nascosto', () => {
  const p = progettaArena({ attuale: { ...ARENA_INIZIALE, gradinate: 20000 }, obiettivo: 15000, percentuali: nrg });
  const a = avvisiArena({ progetto: p, obiettivo: 15000, smantella: false });
  assert.ok(a.some((x) => x.tipo === 'dimensione'));
  assert.ok(!a.some((x) => x.tipo === 'percentuali'), 'lo scostamento è la conseguenza: non lo si dice due volte');
});

test('l’avviso sul totale nomina i settori rimasti fuori profilo', () => {
  const p = progettaArena({ attuale: { ...ARENA_INIZIALE, gradinate: 20000 }, obiettivo: 15000, percentuali: nrg });
  const a = avvisiArena({ progetto: p, obiettivo: 15000, smantella: false });
  assert.match(a.find((x) => x.tipo === 'dimensione').testo, /gradinate/);
});

test('smantellando, il profilo viene rispettato e non c’è nulla da segnalare', () => {
  const p = progettaArena({
    attuale: { gradinate: 1000, tribune: 1000, coperte: 1000, vip: 1000 },
    obiettivo: 4000, percentuali: nrg, smantella: true,
  });
  const a = avvisiArena({ progetto: p, obiettivo: 4000, smantella: true });
  assert.equal(p.totale, 4000, 'il totale torna');
  assert.ok(p.righe.every((r) => r.scostamento < 0.01), 'ogni settore è alla percentuale chiesta');
  assert.ok(!a.some((x) => x.tipo === 'percentuali' || x.tipo === 'dimensione'));
});

test('i parametri di gioco sono dichiarati e si possono sostituire', () => {
  const p = progettaArena({
    attuale: { gradinate: 0, tribune: 0, coperte: 0, vip: 0 },
    obiettivo: 100, percentuali: { gradinate: 100 },
    parametri: { ...PARAMETRI_PREDEFINITI, costi: { ...PARAMETRI_PREDEFINITI.costi, gradinate: 1 }, costoFisso: 0 },
  });
  assert.equal(p.costi.totale, 100, 'con i miei costi, 100 posti da 1');
});
