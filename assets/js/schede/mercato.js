/** Scheda "Mercato": le aste che segui, le scadenze e i tuoi limiti di spesa. */

import { h, rimpiazza, riquadro, valore, tabella, campoNumero, campoTesto, campoScelta, avvisi } from '../lib/dom.js';
import { barre, COLORI } from '../lib/grafico.js';
import { denaro, denaroSegnato, compatto, decimale, percento, intero } from '../lib/formato.js';
import { deposito } from '../lib/deposito.js';
import { rosa, RUOLI, nomeRuolo } from '../dati/rosa.js';
import { adattaModello } from '../calcolo/valutazione.js';
import { analizzaMercato } from '../calcolo/mercato.js';

const osservazioni = deposito('osservazioni-mercato', { elenco: [] });
const conti = deposito('conti', { entrate: 0, cassa: 0, orizzonte: 16 });
const mercato = deposito('mercato', { aste: [] });

/** "fra 2 giorni e 5 ore", oppure "chiusa da 3 ore". */
function testoTempo(t) {
  if (!t.valido) return 'senza scadenza';
  const ore = Math.abs(t.ore);
  const giorni = Math.floor(ore / 24);
  const resto = Math.round(ore % 24);
  const pezzo = giorni ? `${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}${resto ? ` e ${resto} h` : ''}` : `${Math.max(1, Math.round(ore))} h`;
  return t.scaduta ? `chiusa da ${pezzo}` : `fra ${pezzo}`;
}

/** Da ISO a valore per <input type="datetime-local">. */
const perInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function render(host) {
  const disegna = () => {
    const s = mercato.leggi();
    const valuta = rosa.leggi().valuta;
    const cassa = conti.leggi().cassa;
    const modello = adattaModello(osservazioni.leggi().elenco);
    const q = analizzaMercato({ aste: s.aste, modello, cassa });

    rimpiazza(host,
      h('div', { class: 'testata' },
        h('h1', null, 'Mercato'),
        h('p', null, 'Le aste che stai seguendo, quanto manca alla chiusura e se il prezzo regge il confronto con la tua valutazione.'),
      ),

      avvisi(q.avvisi),

      riquadro({
        titolo: `Aste seguite — ${s.aste.length}`,
        sottotitolo: 'Il tetto è quanto hai deciso di non superare. Serve a te, non al venditore.',
        azioni: h('button', {
          class: 'btn minuto', type: 'button',
          onclick: () => mercato.modifica((st) => {
            st.aste.push({
              id: `m${Date.now()}`, nome: 'Nuovo giocatore', ruolo: 'centrocampista',
              eta: 24, abilita: 9, prezzo: null, tetto: null, scadenza: '', note: '',
            });
          }),
        }, '+ Segui un’asta'),
        figli: [
          s.aste.length
            ? h('div', null, ...s.aste.map((a, i) => rigaAsta(a, i)))
            : h('div', { class: 'vuoto' },
                h('p', null, 'Nessuna asta seguita.'),
                h('button', {
                  class: 'btn principale', type: 'button',
                  onclick: () => mercato.modifica((st) => {
                    st.aste.push({
                      id: `m${Date.now()}`, nome: 'Primo obiettivo', ruolo: 'centrocampista',
                      eta: 24, abilita: 9, prezzo: null, tetto: null, scadenza: '', note: '',
                    });
                  }),
                }, 'Segui la prima'),
              ),
        ],
      }),

      ...(q.righe.length ? risultati({ q, valuta, cassa, modello }) : []),
    );
  };

  function rigaAsta(a, indice) {
    const aggiorna = (campi) => mercato.modifica((st) => { Object.assign(st.aste[indice], campi); });
    return h('div', { class: 'riga-elenco' },
      campoTesto({ etichetta: 'Giocatore', valore: a.nome, onInput: (v) => aggiorna({ nome: v }) }),
      campoScelta({
        etichetta: 'Ruolo', valore: a.ruolo,
        opzioni: RUOLI.map((r) => ({ valore: r.id, nome: r.nome })),
        onInput: (v) => aggiorna({ ruolo: v }),
      }),
      campoNumero({ etichetta: 'Età', passo: 1, min: 15, max: 45, valore: a.eta, onInput: (v) => aggiorna({ eta: v }) }),
      campoNumero({ etichetta: 'Abilità', passo: 1, min: 0, max: 20, valore: a.abilita, nota: 'quella del ruolo', onInput: (v) => aggiorna({ abilita: v }) }),
      campoNumero({ etichetta: 'Prezzo attuale', passo: 10000, min: 0, valore: a.prezzo, onInput: (v) => aggiorna({ prezzo: v }) }),
      campoNumero({ etichetta: 'Il tuo tetto', passo: 10000, min: 0, valore: a.tetto, onInput: (v) => aggiorna({ tetto: v }) }),
      h('div', { class: 'campo' },
        h('label', null, 'Chiusura'),
        h('input', {
          type: 'datetime-local', value: perInput(a.scadenza),
          oninput: (e) => aggiorna({ scadenza: e.target.value ? new Date(e.target.value).toISOString() : '' }),
        }),
      ),
      h('div', { class: 'azioni' },
        h('button', {
          class: 'btn spoglio minuto', type: 'button',
          onclick: () => mercato.modifica((st) => { st.aste = st.aste.filter((x) => x.id !== a.id); }),
        }, 'Rimuovi'),
      ),
    );
  }

  function risultati({ q, valuta, cassa, modello }) {
    const conStima = q.righe.filter((r) => r.stima != null && Number.isFinite(Number(r.asta.prezzo)));

    return [
      h('div', { class: 'valori' },
        valore({
          etichetta: 'Impegno massimo', grande: true,
          cifra: denaro(q.impegnoMassimo, valuta),
          sotto: `se vinci tutte le ${intero(q.aperte)} aste aperte`,
        }),
        valore({
          etichetta: 'Cassa dopo gli acquisti',
          cifra: compatto(q.cassaResidua, valuta),
          tono: q.cassaResidua < 0 ? 'negativa' : null,
          sotto: `oggi ${compatto(cassa, valuta)}`,
        }),
        valore({
          etichetta: 'Occasioni',
          cifra: intero(q.occasioni.length),
          tono: q.occasioni.length ? 'positiva' : null,
          sotto: q.occasioni.length ? q.occasioni.map((r) => r.asta.nome).join(', ') : 'nessun prezzo sotto la stima',
        }),
        valore({
          etichetta: 'Oltre il tetto',
          cifra: intero(q.oltreIlTetto.length),
          tono: q.oltreIlTetto.length ? 'negativa' : null,
          sotto: q.oltreIlTetto.length ? q.oltreIlTetto.map((r) => r.asta.nome).join(', ') : 'tutto dentro i tuoi limiti',
        }),
      ),

      riquadro({
        titolo: 'In ordine di chiusura',
        sottotitolo: modello
          ? `Il giudizio sul prezzo viene dal modello della scheda Valutazione, tarato sulle tue ${modello.n} vendite osservate.`
          : 'Senza vendite osservate non c’è giudizio sul prezzo: registrane qualcuna nella scheda Valutazione.',
        figli: [
          tabella({
            intestazione: ['Giocatore', 'Chiusura', 'Prezzo', 'Stima', 'Giudizio', 'Tetto', 'Margine'],
            classeRiga: (i) => (q.righe[i].oltreIlTetto ? 'evidenziata' : null),
            righe: q.righe.map((r) => [
              h('span', null,
                r.asta.nome,
                h('span', { class: 'tenue' }, ` · ${nomeRuolo(r.asta.ruolo)}, ${decimale(r.asta.eta ?? 0, 0)} anni`)),
              h('span', { class: r.tempo.scaduta ? 'tenue' : r.tempo.valido && r.tempo.ore <= 24 ? 'cifra negativa' : null, style: { fontSize: 'inherit', fontWeight: 500 } },
                testoTempo(r.tempo)),
              r.asta.prezzo == null ? '—' : denaro(r.asta.prezzo, valuta),
              r.stima == null ? '—' : denaro(r.stima, valuta),
              r.confronto
                ? h('span', {
                    class: r.confronto.scarto <= -0.08 ? 'cifra positiva' : r.confronto.scarto >= 0.08 ? 'cifra negativa' : null,
                    style: { fontSize: 'inherit', fontWeight: 600 },
                  }, r.confronto.giudizio)
                : h('span', { class: 'tenue' }, '—'),
              r.asta.tetto == null ? '—' : denaro(r.asta.tetto, valuta),
              r.margineSulTetto == null
                ? '—'
                : h('span', {
                    class: r.margineSulTetto < 0 ? 'cifra negativa' : null,
                    style: { fontSize: 'inherit', fontWeight: 500 },
                  }, denaroSegnato(r.margineSulTetto, valuta)),
            ]),
            piede: ['Impegno massimo', '', '', '', '', denaro(q.impegnoMassimo, valuta), ''],
          }),
        ],
      }),

      conStima.length
        ? riquadro({
            titolo: 'Prezzo chiesto e valore stimato',
            sottotitolo: 'Dove il prezzo supera la stima, stai pagando un sovrapprezzo.',
            figli: [
              barre({
                righe: conStima.map((r) => ({ nome: r.asta.nome, valori: [Number(r.asta.prezzo), r.stima] })),
                serie: [
                  { nome: 'Prezzo attuale', colore: COLORI[1] },
                  { nome: 'Valore stimato', colore: COLORI[0] },
                ],
                formato: (v) => compatto(v), unita: valuta, larghezzaNomi: 150,
                didascalia: 'Prezzo a confronto con la stima',
              }),
              tabella({
                intestazione: ['Giocatore', 'Prezzo', 'Stima', 'Differenza', 'Scarto'],
                righe: conStima.map((r) => [
                  r.asta.nome,
                  denaro(r.asta.prezzo, valuta),
                  denaro(r.stima, valuta),
                  denaroSegnato(r.confronto.differenza, valuta),
                  h('span', {
                    class: r.confronto.scarto <= -0.08 ? 'cifra positiva' : r.confronto.scarto >= 0.08 ? 'cifra negativa' : null,
                    style: { fontSize: 'inherit', fontWeight: 500 },
                  }, `${r.confronto.scarto >= 0 ? '+' : '−'}${percento(Math.abs(r.confronto.scarto))}`),
                ]),
              }),
            ],
          })
        : null,
    ];
  }

  disegna();
  const s1 = mercato.ascolta(disegna);
  const s2 = osservazioni.ascolta(disegna);
  const s3 = conti.ascolta(disegna);
  const s4 = rosa.ascolta(disegna);
  return () => { s1(); s2(); s3(); s4(); };
}
