/** Scheda "Rosa e stipendi": quanto costa la squadra e per quanto regge. */

import { h, rimpiazza, riquadro, valore, tabella, campoNumero, campoTesto, campoScelta, avvisi } from '../lib/dom.js';
import { barre, COLORI } from '../lib/grafico.js';
import { intero, denaro, denaroSegnato, compatto, percento, settimane, decimale } from '../lib/formato.js';
import { deposito } from '../lib/deposito.js';
import { rosa, giocatori, aggiungiGiocatore, rimuoviGiocatore, modificaGiocatore, RUOLI, nomeRuolo } from '../dati/rosa.js';
import { analizzaStipendi, senzaGiocatori } from '../calcolo/stipendi.js';

const conti = deposito('conti', { entrate: 0, cassa: 0, orizzonte: 16 });

const ESEMPIO = [
  { nome: 'Rossi',    ruolo: 'portiere',       eta: 27, stipendio: 18000 },
  { nome: 'Bianchi',  ruolo: 'difensore',      eta: 24, stipendio: 22000 },
  { nome: 'Verdi',    ruolo: 'difensore',      eta: 31, stipendio: 31000 },
  { nome: 'Neri',     ruolo: 'terzino',        eta: 22, stipendio: 14000 },
  { nome: 'Gialli',   ruolo: 'centrocampista', eta: 26, stipendio: 42000 },
  { nome: 'Blu',      ruolo: 'centrocampista', eta: 19, stipendio: 9000 },
  { nome: 'Viola',    ruolo: 'ala',            eta: 25, stipendio: 26000 },
  { nome: 'Arancio',  ruolo: 'attaccante',     eta: 29, stipendio: 58000 },
];

export function render(host) {
  const selezione = new Set();

  const disegna = () => {
    const elenco = giocatori();
    const c = conti.leggi();
    const valuta = rosa.leggi().valuta;

    rimpiazza(host,
      h('div', { class: 'testata' },
        h('h1', null, 'Rosa e stipendi'),
        h('p', null, 'Quanto costa la tua squadra ogni settimana, chi pesa di più e per quanto regge la cassa.'),
      ),

      riquadro({
          titolo: 'Entrate e cassa',
          sottotitolo: 'Servono per dire se la rosa è sostenibile, non solo quanto costa.',
          figli: [
            h('div', { class: 'campi' },
              campoNumero({
                etichetta: 'Entrate a settimana', passo: 10000, min: 0, valore: c.entrate,
                nota: 'Sponsor, biglietti e resto, al netto delle altre spese',
                onInput: (v) => { conti.modifica((s) => { s.entrate = Math.max(0, v ?? 0); }); },
              }),
              campoNumero({
                etichetta: 'Cassa attuale', passo: 100000, valore: c.cassa,
                onInput: (v) => { conti.modifica((s) => { s.cassa = v ?? 0; }); },
              }),
              campoNumero({
                etichetta: 'Settimane da proiettare', passo: 1, min: 1, max: 104, valore: c.orizzonte,
                onInput: (v) => { conti.modifica((s) => { s.orizzonte = Math.min(104, Math.max(1, v ?? 16)); }); },
              }),
            ),
          ],
        }),

      riquadro({
          titolo: `Rosa — ${elenco.length} ${elenco.length === 1 ? 'giocatore' : 'giocatori'}`,
          sottotitolo: 'Stipendio settimanale di ciascuno. Le altre schede useranno la stessa rosa.',
          azioni: h('div', { class: 'in-riga' },
            h('button', { class: 'btn minuto', type: 'button', onclick: () => aggiungiGiocatore({ nome: `Giocatore ${elenco.length + 1}` }) }, '+ Aggiungi'),
          ),
          figli: [
            elenco.length
              ? h('div', null,
                  h('div', { class: 'intestazione-rosa' },
                    h('span', null, 'Nome'), h('span', null, 'Ruolo'), h('span', null, 'Età'),
                    h('span', null, 'Stipendio'), h('span', null, '')),
                  ...elenco.map((g) => rigaGiocatore(g)))
              : h('div', { class: 'vuoto' },
                  h('p', null, 'Nessun giocatore in rosa.'),
                  h('div', { class: 'in-riga', style: { justifyContent: 'center' } },
                    h('button', { class: 'btn principale', type: 'button', onclick: () => aggiungiGiocatore({ nome: 'Nuovo giocatore' }) }, 'Aggiungi il primo'),
                    h('button', { class: 'btn', type: 'button', onclick: () => ESEMPIO.forEach((g) => aggiungiGiocatore(g)) }, 'Carica una rosa d’esempio'),
                  ),
                ),
          ],
        }),

      ...risultati({ elenco, conti: c, valuta, selezione, ridisegna: disegna }),
    );
  };

  disegna();
  // le schede condividono la rosa: se cambia altrove, questa si riallinea
  const staccaRosa = rosa.ascolta(disegna);
  const staccaConti = conti.ascolta(disegna);
  return () => { staccaRosa(); staccaConti(); };
}

function rigaGiocatore(g) {
  return h('div', { class: 'riga-elenco riga-giocatore' },
    campoTesto({ etichetta: 'Nome', valore: g.nome, onInput: (v) => modificaGiocatore(g.id, { nome: v }) }),
    campoScelta({
      etichetta: 'Ruolo', valore: g.ruolo,
      opzioni: RUOLI.map((r) => ({ valore: r.id, nome: r.nome })),
      onInput: (v) => modificaGiocatore(g.id, { ruolo: v }),
    }),
    campoNumero({ etichetta: 'Età', passo: 1, min: 15, max: 45, valore: g.eta, onInput: (v) => modificaGiocatore(g.id, { eta: v ?? 0 }) }),
    campoNumero({ etichetta: 'Stipendio', passo: 1000, min: 0, valore: g.stipendio, onInput: (v) => modificaGiocatore(g.id, { stipendio: Math.max(0, v ?? 0) }) }),
    h('div', { class: 'azioni' },
      h('button', { class: 'btn spoglio minuto', type: 'button', onclick: () => rimuoviGiocatore(g.id) }, 'Rimuovi'),
    ),
  );
}

function risultati({ elenco, conti: c, valuta, selezione, ridisegna }) {
  const a = analizzaStipendi({
    giocatori: elenco,
    ruoli: RUOLI,
    entrateSettimanali: c.entrate,
    cassa: c.cassa,
    orizzonteSettimane: c.orizzonte,
  });

  if (!a.numero) return [avvisi(a.avvisi)];

  const ruoliConCosto = a.perRuolo.filter((r) => r.numero > 0);
  const fasceConCosto = a.perFasciaEta.filter((f) => f.numero > 0);
  const passo = Math.max(1, Math.round(a.proiezione.length / 8));
  const tappe = a.proiezione.filter((r, i) => r.settimana % passo === 0 || i === 0 || i === a.proiezione.length - 1);
  const ceduti = senzaGiocatori({ giocatori: elenco, ids: [...selezione], entrateSettimanali: c.entrate });

  return [
    avvisi(a.avvisi),

    h('div', { class: 'valori' },
      valore({
        etichetta: 'Monte stipendi settimanale', grande: true, cifra: denaro(a.totale, valuta),
        sotto: `${intero(a.numero)} giocatori, media ${denaro(a.medio, valuta)}`,
      }),
      valore({
        etichetta: 'Margine settimanale', cifra: denaroSegnato(a.margine, valuta),
        tono: a.margine >= 0 ? 'positiva' : 'negativa',
        sotto: a.incidenza == null ? 'inserisci le entrate' : `gli stipendi sono il ${percento(a.incidenza)} delle entrate`,
      }),
      valore({
        etichetta: a.autonomiaSettimane == null ? `Cassa fra ${a.proiezione.length} settimane` : 'Autonomia della cassa',
        cifra: a.autonomiaSettimane == null ? compatto(a.proiezione[a.proiezione.length - 1].cassa, valuta) : settimane(a.autonomiaSettimane),
        tono: a.settimanaRottura ? 'negativa' : null,
        sotto: a.settimanaRottura ? `sotto zero dalla settimana ${a.settimanaRottura}` : `oggi ${compatto(a.cassa, valuta)}`,
      }),
      valore({
        etichetta: `Giocatori che fanno l’${Math.round(a.pareto.soglia * 100)}%`,
        cifra: intero(a.pareto.quanti),
        sotto: a.pareto.giocatori.map((g) => g.nome).join(', ') || '—',
      }),
    ),

    riquadro({
      titolo: 'Chi pesa di più',
      sottotitolo: `Stipendi in ordine di peso. Spunta un giocatore per vedere cosa cambierebbe cedendolo.`,
      figli: [
        barre({
          righe: a.ordinati.map((g) => ({
            nome: g.nome,
            valori: [g.stipendio],
            colore: g.dentroPareto ? COLORI[1] : COLORI[0],
          })),
          serie: [{ nome: 'Stipendio settimanale', colore: COLORI[0] }],
          formato: (v) => compatto(v),
          unita: valuta,
          larghezzaNomi: 150,
          didascalia: 'Stipendio settimanale per giocatore',
        }),
        h('div', { class: 'legenda' },
          h('span', null, h('i', { class: 'tessera', style: { background: COLORI[1] } }), `Chi fa l’${Math.round(a.pareto.soglia * 100)}% del monte stipendi`),
          h('span', null, h('i', { class: 'tessera', style: { background: COLORI[0] } }), 'Il resto della rosa'),
        ),
        tabella({
          intestazione: ['Giocatore', 'Ruolo', 'Età', 'Stipendio', 'Quota', 'Cumulata'],
          righe: a.ordinati.map((g) => [
            h('label', { class: 'in-riga' },
              h('input', {
                type: 'checkbox', checked: selezione.has(g.id),
                onchange: (e) => { e.target.checked ? selezione.add(g.id) : selezione.delete(g.id); ridisegna(); },
              }),
              h('span', null, g.nome),
            ),
            nomeRuolo(g.ruolo),
            intero(g.eta),
            denaro(g.stipendio, valuta),
            percento(g.quota),
            percento(g.cumulata),
          ]),
          piede: ['Totale', '', '', denaro(a.totale, valuta), '100 %', ''],
        }),
        selezione.size
          ? h('p', { class: 'avviso' },
              `Cedendo ${selezione.size === 1 ? 'questo giocatore' : `questi ${selezione.size} giocatori`} risparmieresti `,
              h('strong', null, denaro(ceduti.risparmio, valuta)),
              ' a settimana: il monte stipendi scenderebbe a ',
              h('strong', null, denaro(ceduti.totale, valuta)),
              ' e il margine diventerebbe ',
              h('strong', null, denaroSegnato(ceduti.margine, valuta)),
              '.')
          : null,
      ],
    }),

    riquadro({
      titolo: 'Dove va il monte stipendi',
      sottotitolo: 'Per reparto e per età: utile per capire se stai pagando il presente o il futuro.',
      figli: [
        h('div', { class: 'colonne' },
          h('div', null,
            barre({
              righe: ruoliConCosto.map((r) => ({ nome: r.nome, valori: [r.totale] })),
              serie: [{ nome: 'Costo per reparto', colore: COLORI[0] }],
              formato: (v) => compatto(v), unita: valuta, larghezzaNomi: 130,
              didascalia: 'Costo settimanale per ruolo',
            }),
            tabella({
              intestazione: ['Ruolo', 'N.', 'Totale', 'Media', 'Quota'],
              righe: ruoliConCosto.map((r) => [r.nome, intero(r.numero), denaro(r.totale, valuta), denaro(r.medio, valuta), percento(r.quota)]),
            }),
          ),
          h('div', null,
            barre({
              righe: fasceConCosto.map((f) => ({ nome: f.nome, valori: [f.totale] })),
              serie: [{ nome: 'Costo per età', colore: COLORI[2] }],
              formato: (v) => compatto(v), unita: valuta, larghezzaNomi: 130,
              didascalia: 'Costo settimanale per fascia di età',
            }),
            tabella({
              intestazione: ['Età', 'N.', 'Totale', 'Media', 'Quota'],
              righe: fasceConCosto.map((f) => [f.nome, intero(f.numero), denaro(f.totale, valuta), denaro(f.medio, valuta), percento(f.quota)]),
            }),
          ),
        ),
      ],
    }),

    riquadro({
      titolo: 'Tenuta della cassa',
      sottotitolo: `Proiezione a ${a.proiezione.length} settimane con il margine attuale.`,
      figli: [
        tabella({
          intestazione: ['Settimana', 'Cassa prevista'],
          righe: tappe.map((r) => [
            `Settimana ${r.settimana}`,
            h('span', { class: r.cassa < 0 ? 'cifra negativa' : null, style: { fontSize: 'inherit', fontWeight: 500 } }, denaro(r.cassa, valuta)),
          ]),
        }),
        a.settimanaRottura
          ? h('p', { class: 'avviso' }, `Con questo ritmo la cassa si esaurisce alla settimana ${a.settimanaRottura}: servono entrate o una rosa più leggera.`)
          : h('p', { class: 'piccolo tenue', style: { marginBottom: 0 } }, 'La cassa regge per tutto l’orizzonte considerato.'),
      ],
    }),
  ];
}
