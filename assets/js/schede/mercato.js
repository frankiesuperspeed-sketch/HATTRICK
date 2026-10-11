/** Scheda "Mercato": le aste che segui, le scadenze e i tuoi limiti di spesa. */

import { h, rimpiazza, riquadro, valore, tabella, campoNumero, campoTesto, campoScelta, avvisi } from '../lib/dom.js';
import { barre, COLORI } from '../lib/grafico.js';
import { denaro, denaroSegnato, compatto, decimale, percento, intero } from '../lib/formato.js';
import { deposito } from '../lib/deposito.js';
import { rosa, RUOLI, nomeRuolo } from '../dati/rosa.js';
import { adattaModello, stimaPrezzo } from '../calcolo/valutazione.js';
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
        h('p', null, 'Le aste che stai seguendo, quanto manca alla chiusura e se il prezzo regge il confronto con le vendite che hai visto davvero.'),
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

      vendite({ elenco: osservazioni.leggi().elenco, modello, valuta }),
    );
  };

  /**
   * Le vendite viste sul mercato: sono i dati su cui si tara il modello che
   * giudica i prezzi, quindi stanno nella scheda che quel giudizio lo usa.
   */
  function vendite({ elenco, modello, valuta }) {
    const aggiungi = () => osservazioni.modifica((st) => {
      st.elenco.push({ id: `o${Date.now()}`, abilita: 9, eta: 24, prezzo: null, nota: '' });
    });
    const aggiorna = (id, campi) => osservazioni.modifica((st) => {
      const o = st.elenco.find((x) => x.id === id);
      if (o) Object.assign(o, campi);
    });

    return riquadro({
      titolo: `Vendite osservate — ${elenco.length}`,
      sottotitolo: 'Ogni riga è un giocatore che hai visto vendere davvero: abilità di riferimento, età e prezzo finale. '
        + 'Da tre in poi il giudizio sui prezzi viene da qui invece che dai valori di partenza.',
      azioni: h('button', { class: 'btn minuto', type: 'button', onclick: aggiungi }, '+ Aggiungi vendita'),
      figli: [
        elenco.length
          ? h('div', null,
              ...elenco.map((o) => h('div', { class: 'riga-elenco' },
                campoNumero({ etichetta: 'Abilità', passo: 1, min: 0, max: 20, valore: o.abilita, chiave: `oss-ab-${o.id}`, onInput: (v) => aggiorna(o.id, { abilita: v }) }),
                campoNumero({ etichetta: 'Età', passo: 1, min: 15, max: 45, valore: o.eta, chiave: `oss-eta-${o.id}`, onInput: (v) => aggiorna(o.id, { eta: v }) }),
                campoNumero({ etichetta: 'Prezzo finale', passo: 10000, min: 0, valore: o.prezzo, chiave: `oss-pr-${o.id}`, onInput: (v) => aggiorna(o.id, { prezzo: v }) }),
                campoTesto({ etichetta: 'Nota', valore: o.nota, segnaposto: 'es. specialità, ruolo', chiave: `oss-no-${o.id}`, onInput: (v) => aggiorna(o.id, { nota: v }) }),
                h('div', { class: 'azioni' },
                  h('button', {
                    class: 'btn spoglio minuto', type: 'button',
                    onclick: () => osservazioni.modifica((st) => { st.elenco = st.elenco.filter((x) => x.id !== o.id); }),
                  }, 'Rimuovi'),
                ),
              )),
              elenco.length >= 3 ? tabellaScarti(elenco, modello, valuta) : null,
            )
          : h('div', { class: 'vuoto' },
              h('p', null, 'Nessuna vendita registrata: senza, i prezzi non hanno un metro di paragone.'),
              h('button', { class: 'btn principale', type: 'button', onclick: aggiungi }, 'Registra la prima vendita'),
            ),
      ],
    });
  }

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
          ? `Il giudizio sul prezzo viene da un modello tarato sulle tue ${modello.n} vendite osservate, qui sotto.`
          : 'Senza vendite osservate non c’è giudizio sul prezzo: registrane qualcuna qui sotto.',
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

/** Quanto ogni vendita si discosta dal modello: serve a stanare i casi strani. */
function tabellaScarti(elenco, modello, valuta) {
  const righe = elenco
    .filter((o) => Number.isFinite(o.prezzo) && o.prezzo > 0)
    .map((o) => {
      const previsto = stimaPrezzo({ abilita: o.abilita, eta: o.eta, modello });
      const scarto = previsto ? (o.prezzo - previsto) / previsto : null;
      return { ...o, previsto, scarto };
    })
    .sort((a, b) => Math.abs(b.scarto ?? 0) - Math.abs(a.scarto ?? 0));

  if (!righe.length) return null;

  return h('div', { style: { marginTop: '14px' } },
    h('h3', null, 'Quanto il modello azzecca le tue osservazioni'),
    tabella({
      intestazione: ['Vendita', 'Abilità', 'Età', 'Prezzo reale', 'Previsto', 'Scarto'],
      righe: righe.map((r) => [
        r.nota || '—',
        decimale(r.abilita ?? 0, 0),
        decimale(r.eta ?? 0, 0),
        denaro(r.prezzo, valuta),
        denaro(r.previsto, valuta),
        h('span', {
          class: r.scarto == null ? null : Math.abs(r.scarto) > 0.3 ? 'cifra negativa' : null,
          style: { fontSize: 'inherit', fontWeight: 500 },
        }, r.scarto == null ? '—' : `${r.scarto >= 0 ? '+' : '−'}${percento(Math.abs(r.scarto))}`),
      ]),
    }),
  );
}
