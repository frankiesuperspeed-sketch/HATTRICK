/** Scheda "Forma": come stanno i giocatori e quanto incide sul rendimento. */

import { h, rimpiazza, riquadro, valore, tabella, campoNumero, campoScelta, avvisi } from '../lib/dom.js';
import { barre, COLORI } from '../lib/grafico.js';
import { decimale, intero, percento } from '../lib/formato.js';
import { deposito } from '../lib/deposito.js';
import { rosa, giocatori, modificaGiocatore, nomeRuolo } from '../dati/rosa.js';
import { analizzaRosa, registraLettura, FATTORI_PREDEFINITI } from '../calcolo/forma.js';
import { FATTORI_PREDEFINITI as FATTORI_SCHIERAMENTO } from '../calcolo/schieramento.js';

const campo = deposito('schieramento', { righe: [], posizioni: [], fattori: FATTORI_SCHIERAMENTO, conversione: 0, fotografia: null });
const stato = deposito('forma', { storico: {}, selezionato: '' });

const oggi = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export function render(host) {
  const disegna = () => {
    const elenco = giocatori();
    const s = stato.leggi();
    const fattori = campo.leggi().fattori ?? FATTORI_PREDEFINITI;
    const q = analizzaRosa({ giocatori: elenco, storico: s.storico, fattori });

    const selezionato = elenco.find((g) => g.id === s.selezionato) ?? null;
    const letture = selezionato ? (s.storico[selezionato.id] ?? []) : [];

    rimpiazza(host,
      h('div', { class: 'testata' },
        h('h1', null, 'Forma e condizione'),
        h('p', null, 'Come stanno i tuoi giocatori adesso, come si stanno muovendo, e quanto questo sposta il rendimento.'),
      ),

      h('div', { class: 'avviso' },
        h('strong', null, 'Nessuna previsione. '),
        'In Hattrick la forma si muove in modo non pubblicato e tutt’altro che regolare: questa scheda registra quello che è successo e misura l’effetto sul presente, non indovina la settimana prossima. ',
        'Il peso di forma e condizione è lo stesso impostato nella scheda Schieramento.',
      ),

      !elenco.length
        ? h('div', { class: 'vuoto' }, h('p', null, 'La rosa è vuota: aggiungi i giocatori nella scheda “Rosa e stipendi” e torna qui.'))
        : null,

      ...(elenco.length ? contenuto({ q, s, elenco, selezionato, letture }) : []),
    );
  };

  function contenuto({ q, s, elenco, selezionato, letture }) {
    const migliore = q.righe[0];
    const peggiore = q.righe[q.righe.length - 1];

    return [
      avvisi(q.avvisi),

      h('div', { class: 'valori' },
        valore({
          etichetta: 'Rendimento medio della rosa', grande: true,
          cifra: percento(q.rendimentoMedio, 0),
          tono: q.scartoMedio > 0.01 ? 'positiva' : q.scartoMedio < -0.01 ? 'negativa' : null,
          sotto: `${q.scartoMedio >= 0 ? '+' : '−'}${percento(Math.abs(q.scartoMedio))} rispetto alle condizioni normali`,
        }),
        valore({
          etichetta: 'Più in palla',
          cifra: migliore && !migliore.senzaDati ? migliore.giocatore.nome : '—',
          sotto: migliore && !migliore.senzaDati ? `${migliore.scarto >= 0 ? '+' : '−'}${percento(Math.abs(migliore.scarto))}` : 'nessun dato',
        }),
        valore({
          etichetta: 'Più scarico',
          cifra: peggiore && !peggiore.senzaDati ? peggiore.giocatore.nome : '—',
          tono: peggiore && peggiore.scarto < -0.05 ? 'negativa' : null,
          sotto: peggiore && !peggiore.senzaDati ? `${peggiore.scarto >= 0 ? '+' : '−'}${percento(Math.abs(peggiore.scarto))}` : 'nessun dato',
        }),
        valore({
          etichetta: 'In movimento',
          cifra: `${intero(q.inSalita.length)} ↑  ${intero(q.inCalo.length)} ↓`,
          sotto: 'rispetto alla lettura precedente',
        }),
      ),

      riquadro({
        titolo: 'Come stanno adesso',
        sottotitolo: 'Forma e condizione si scrivono qui e finiscono nella rosa condivisa.',
        azioni: h('button', {
          class: 'btn minuto principale', type: 'button',
          title: 'Salva i valori di oggi nello storico di ogni giocatore',
          onclick: () => stato.modifica((st) => {
            const data = oggi();
            for (const g of elenco) {
              st.storico = registraLettura(st.storico, g.id, { data, forma: g.forma, condizione: g.condizione });
            }
          }),
        }, 'Registra la settimana'),
        figli: [
          q.senzaDati.length
            ? h('p', { class: 'avviso' }, 'Senza dati di forma: ', q.senzaDati.join(', '))
            : null,
          h('div', null, ...q.righe.map((r) => h('div', { class: 'riga-elenco' },
            h('div', { class: 'campo' },
              h('label', null, 'Giocatore'),
              h('div', { style: { padding: '8px 0' } },
                h('strong', null, r.giocatore.nome || '(senza nome)'),
                h('span', { class: 'tenue' }, ` · ${nomeRuolo(r.giocatore.ruolo)}`)),
            ),
            campoNumero({
              etichetta: 'Forma', passo: 1, min: 0, max: 8, valore: r.giocatore.forma,
              onInput: (v) => modificaGiocatore(r.giocatore.id, { forma: v }),
            }),
            campoNumero({
              etichetta: 'Condizione', passo: 1, min: 0, max: 8, valore: r.giocatore.condizione,
              onInput: (v) => modificaGiocatore(r.giocatore.id, { condizione: v }),
            }),
            h('div', { class: 'campo' },
              h('label', null, 'Rendimento'),
              h('div', { style: { padding: '8px 0' } },
                r.senzaDati
                  ? h('span', { class: 'tenue' }, 'senza dati')
                  : h('span', {
                      class: r.scarto > 0.01 ? 'cifra positiva' : r.scarto < -0.01 ? 'cifra negativa' : null,
                      style: { fontSize: 'inherit', fontWeight: 600 },
                    }, `${r.scarto >= 0 ? '+' : '−'}${percento(Math.abs(r.scarto))}`),
              ),
            ),
            h('div', { class: 'campo' },
              h('label', null, 'Tendenza'),
              h('div', { style: { padding: '8px 0' } },
                h('span', {
                  class: r.andamentoForma.tendenza === 'in salita' ? 'targhetta'
                    : r.andamentoForma.tendenza === 'in calo' ? 'targhetta critica' : 'tenue',
                }, r.andamentoForma.tendenza),
                r.letture ? h('span', { class: 'tenue' }, ` · ${r.letture} letture`) : null),
            ),
          ))),
        ],
      }),

      riquadro({
        titolo: 'Quanto forma e condizione spostano il rendimento',
        sottotitolo: 'Scostamento di ciascun giocatore rispetto alle sue condizioni normali.',
        figli: [
          barre({
            righe: q.righe.filter((r) => !r.senzaDati).map((r) => ({
              nome: r.giocatore.nome,
              valori: [r.scarto * 100],
              colore: r.scarto < 0 ? COLORI[1] : COLORI[0],
            })),
            serie: [{ nome: 'Scostamento', colore: COLORI[0] }],
            formato: (v) => `${decimale(v, 0)} %`, larghezzaNomi: 140,
            didascalia: 'Scostamento dal rendimento normale, in percentuale',
          }),
          h('div', { class: 'legenda' },
            h('span', null, h('i', { class: 'tessera', style: { background: COLORI[0] } }), 'Sopra il suo livello'),
            h('span', null, h('i', { class: 'tessera', style: { background: COLORI[1] } }), 'Sotto il suo livello'),
          ),
        ],
      }),

      riquadro({
        titolo: 'Storico di un giocatore',
        sottotitolo: 'Le letture che hai registrato, dalla più recente.',
        azioni: campoScelta({
          valore: s.selezionato,
          opzioni: [{ valore: '', nome: '— scegli —' }, ...elenco.map((g) => ({ valore: g.id, nome: g.nome || '(senza nome)' }))],
          onInput: (v) => stato.modifica((st) => { st.selezionato = v; }),
        }),
        figli: [
          !selezionato
            ? h('p', { class: 'tenue' }, 'Scegli un giocatore per vedere il suo andamento.')
            : !letture.length
              ? h('p', { class: 'tenue' }, 'Nessuna lettura registrata: usa “Registra la settimana” per cominciare a tenerne traccia.')
              : h('div', null,
                  barre({
                    righe: letture.map((l, i) => ({ nome: l.data ?? `lettura ${i + 1}`, valori: [l.forma ?? 0, l.condizione ?? 0] })),
                    serie: [
                      { nome: 'Forma', colore: COLORI[0] },
                      { nome: 'Condizione', colore: COLORI[2] },
                    ],
                    formato: (v) => decimale(v, 0), larghezzaNomi: 120,
                    didascalia: `Andamento di ${selezionato.nome}`,
                  }),
                  tabella({
                    intestazione: ['Lettura', 'Forma', 'Condizione'],
                    righe: [...letture].reverse().map((l, i) => [
                      l.data ?? `lettura ${letture.length - i}`,
                      l.forma == null ? '—' : decimale(l.forma, 0),
                      l.condizione == null ? '—' : decimale(l.condizione, 0),
                    ]),
                  }),
                  h('div', { class: 'in-riga', style: { marginTop: '10px' } },
                    h('button', {
                      class: 'btn spoglio minuto', type: 'button',
                      onclick: () => stato.modifica((st) => { delete st.storico[selezionato.id]; }),
                    }, 'Cancella lo storico di questo giocatore'),
                  ),
                ),
        ],
      }),
    ];
  }

  disegna();
  const s1 = stato.ascolta(disegna);
  const s2 = rosa.ascolta(disegna);
  const s3 = campo.ascolta(disegna);
  return () => { s1(); s2(); s3(); };
}
