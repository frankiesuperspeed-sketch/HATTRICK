/** Scheda "Tattiche": quale scelta tattica rende di più con la rosa che hai. */

import { h, rimpiazza, riquadro, valore, tabella, campoNumero, campoScelta } from '../lib/dom.js';
import { barre, COLORI } from '../lib/grafico.js';
import { decimale } from '../lib/formato.js';
import { deposito } from '../lib/deposito.js';
import { rosa, giocatori, ABILITA } from '../dati/rosa.js';
import { valutaSchieramento, POSIZIONI_PREDEFINITE, FATTORI_PREDEFINITI, SETTORI } from '../calcolo/schieramento.js';
import { confrontaTattiche, TATTICHE_PREDEFINITE, LIVELLO_PIENO } from '../calcolo/tattiche.js';

const campo = deposito('schieramento', {
  righe: [], posizioni: POSIZIONI_PREDEFINITE, fattori: FATTORI_PREDEFINITI, conversione: 0, fotografia: null,
});

const impostazioni = deposito('tattiche', {
  tattiche: TATTICHE_PREDEFINITE,
  livelloPieno: LIVELLO_PIENO,
  pesi: { difesa: 1, centrocampo: 1, attacco: 1 },
});

export function render(host) {
  const disegna = () => {
    const schieramento = campo.leggi();
    const elenco = giocatori();
    const stato = impostazioni.leggi();

    const v = valutaSchieramento({
      schieramento: schieramento.righe,
      giocatori: elenco,
      posizioni: schieramento.posizioni,
      fattori: schieramento.fattori,
    });

    if (!v.giocatoriSchierati) {
      rimpiazza(host,
        h('div', { class: 'testata' },
          h('h1', null, 'Tattiche'),
          h('p', null, 'Quale tattica rende di più con la formazione che hai schierato.'),
        ),
        h('div', { class: 'vuoto' },
          h('p', null, 'Serve una formazione: componila nella scheda “Schieramento” e torna qui.'),
          h('a', { class: 'btn principale', href: '#/schieramento' }, 'Vai a Schieramento'),
        ),
      );
      return;
    }

    const confronto = confrontaTattiche({
      settori: v.settori,
      schieramento: schieramento.righe,
      giocatori: elenco,
      tattiche: stato.tattiche,
      livelloPieno: stato.livelloPieno,
      pesi: stato.pesi,
    });
    const migliore = confronto[0];
    const nessuna = confronto.find((c) => !c.tattica.abilita) ?? confronto[confronto.length - 1];

    rimpiazza(host,
      h('div', { class: 'testata' },
        h('h1', null, 'Tattiche'),
        h('p', null, 'Quale tattica rende di più con la formazione che hai schierato, e chi gliene dà la forza.'),
      ),

      h('div', { class: 'avviso' },
        h('strong', null, 'Lettura relativa, non assoluta. '),
        'Hattrick descrive le tattiche a parole, non con numeri: quanto ciascuna sposti i rating non è pubblicato. ',
        'Gli effetti qui sono stime modificabili, quindi fidati del ',
        h('em', null, 'confronto'), ' fra tattiche più che dei valori assoluti.',
      ),

      riquadro({
        titolo: 'Cosa ti serve da questa partita',
        sottotitolo: 'I pesi dicono quanto conta ciascun reparto: in trasferta contro una corazzata, alza la difesa.',
        figli: [
          h('div', { class: 'campi' },
            ...SETTORI.map((s) => campoNumero({
              etichetta: `Peso ${s.nome.toLowerCase()}`, passo: 0.5, min: 0, valore: stato.pesi[s.id],
              onInput: (val) => impostazioni.modifica((st) => { st.pesi[s.id] = val ?? 0; }),
            })),
          ),
          h('p', { class: 'piccolo tenue', style: { marginBottom: 0 } },
            `Formazione di partenza: difesa ${decimale(v.settori.difesa, 1)}, centrocampo ${decimale(v.settori.centrocampo, 1)}, attacco ${decimale(v.settori.attacco, 1)}.`),
        ],
      }),

      h('div', { class: 'valori' },
        valore({
          etichetta: 'Tattica migliore', grande: true,
          cifra: migliore.tattica.nome,
          tono: migliore.guadagno > 0 ? 'positiva' : null,
          sotto: migliore.guadagno > 0
            ? `${decimale(migliore.guadagno, 1)} punti in più di non fare nulla`
            : 'con questi pesi, nessuna tattica conviene',
        }),
        valore({
          etichetta: 'Forza che le dai',
          cifra: migliore.forza == null ? '—' : `${decimale(migliore.forza * 100, 0)} %`,
          sotto: migliore.livello == null ? 'non serve un’abilità' : `abilità media ${decimale(migliore.livello, 1)}`,
        }),
        ...SETTORI.map((s) => valore({
          etichetta: s.nome,
          cifra: decimale(migliore.settori[s.id], 1),
          tono: migliore.variazioni[s.id] > 0.05 ? 'positiva' : migliore.variazioni[s.id] < -0.05 ? 'negativa' : null,
          sotto: `${migliore.variazioni[s.id] >= 0 ? '+' : '−'}${decimale(Math.abs(migliore.variazioni[s.id]), 1)} sul valore di base`,
        })),
      ),

      riquadro({
        titolo: 'Tutte le tattiche a confronto',
        sottotitolo: 'Ordinate per quanto rendono con i pesi che hai scelto.',
        figli: [
          // si confronta il guadagno, non il punteggio assoluto: fra valori
          // tutti attorno a 125, differenze di un punto sarebbero invisibili
          barre({
            righe: confronto.map((c) => ({
              nome: c.tattica.nome,
              valori: [c.guadagno],
              // il colore dice il segno; la tattica migliore è già evidenziata
              // in tabella e in cima alla pagina
              colore: c.guadagno < -0.05 ? COLORI[1] : COLORI[0],
            })),
            serie: [{ nome: 'Guadagno rispetto a nessuna tattica', colore: COLORI[0] }],
            formato: (val) => decimale(val, 1), larghezzaNomi: 150,
            didascalia: 'Quanto rende ogni tattica rispetto a non farne nessuna',
          }),
          h('div', { class: 'legenda' },
            h('span', null, h('i', { class: 'tessera', style: { background: COLORI[0] } }), 'Conviene'),
            h('span', null, h('i', { class: 'tessera', style: { background: COLORI[1] } }), 'Peggiora la situazione'),
          ),
          tabella({
            intestazione: ['Tattica', 'Forza', ...SETTORI.map((s) => s.nome), 'Guadagno'],
            classeRiga: (i) => (confronto[i].tattica.id === migliore.tattica.id ? 'evidenziata' : null),
            righe: confronto.map((c) => [
              c.tattica.nome,
              c.forza == null ? '—' : `${decimale(c.forza * 100, 0)} %`,
              ...SETTORI.map((s) => h('span', {
                class: c.variazioni[s.id] > 0.05 ? 'cifra positiva' : c.variazioni[s.id] < -0.05 ? 'cifra negativa' : null,
                style: { fontSize: 'inherit', fontWeight: 500 },
              }, decimale(c.settori[s.id], 1))),
              h('span', {
                class: c.guadagno > 0.05 ? 'cifra positiva' : c.guadagno < -0.05 ? 'cifra negativa' : null,
                style: { fontSize: 'inherit', fontWeight: 500 },
              }, Math.abs(c.guadagno) < 0.05 ? 'invariato' : `${c.guadagno > 0 ? '+' : '−'}${decimale(Math.abs(c.guadagno), 1)}`),
            ]),
          }),
          h('p', { class: 'piccolo tenue', style: { marginBottom: 0 } },
            `Il riferimento è “${nessuna.tattica.nome}”: il guadagno è rispetto a quella.`),
        ],
      }),

      migliore.contributori.length
        ? riquadro({
            titolo: `Chi dà forza a “${migliore.tattica.nome}”`,
            sottotitolo: `Conta l’abilità ${ABILITA.find((a) => a.id === migliore.tattica.abilita)?.nome ?? migliore.tattica.abilita}, fra i giocatori schierati che ce l’hanno.`,
            figli: [
              tabella({
                intestazione: ['Giocatore', 'Abilità'],
                righe: migliore.contributori.map((c) => [c.nome, decimale(c.livello, 0)]),
                piede: ['Media', decimale(migliore.livello, 1)],
              }),
            ],
          })
        : null,

      pannelloParametri(stato),
    );
  };

  function pannelloParametri(stato) {
    return h('details', { class: 'parametri' },
      h('summary', null, 'Effetti delle tattiche'),
      h('div', { class: 'corpo-parametri' },
        h('p', { class: 'piccolo tenue' },
          'Variazione di ogni reparto a piena forza, espressa in frazione: 0,10 significa +10%. Sono stime: correggile man mano che leggi i tuoi resoconti.'),
        h('div', { class: 'scorri' },
          h('table', null,
            h('thead', null, h('tr', null,
              h('th', null, 'Tattica'), h('th', null, 'Abilità'),
              ...SETTORI.map((s) => h('th', { class: 'num' }, s.nome)))),
            h('tbody', null, ...stato.tattiche.map((t, i) => h('tr', null,
              h('td', null, t.nome),
              h('td', null, t.abilita
                ? campoScelta({
                    valore: t.abilita,
                    opzioni: ABILITA.map((a) => ({ valore: a.id, nome: a.nome })),
                    onInput: (val) => impostazioni.modifica((s) => { s.tattiche[i].abilita = val; }),
                  })
                : h('span', { class: 'tenue' }, '—')),
              ...SETTORI.map((s) => h('td', { class: 'num' }, t.abilita
                ? campoNumero({
                    passo: 0.01, valore: t.effetti?.[s.id] ?? 0,
                    onInput: (val) => impostazioni.modifica((st) => { st.tattiche[i].effetti[s.id] = val ?? 0; }),
                  })
                : h('span', { class: 'tenue' }, '0'))),
            ))),
          ),
        ),
        h('div', { class: 'campi' },
          campoNumero({
            etichetta: 'Abilità per la forza piena', passo: 1, min: 1, valore: stato.livelloPieno,
            nota: 'A questa abilità media la tattica esprime tutto il suo effetto',
            onInput: (val) => impostazioni.modifica((s) => { s.livelloPieno = val ?? LIVELLO_PIENO; }),
          }),
        ),
        h('div', { class: 'in-riga', style: { marginBottom: '12px' } },
          h('button', {
            class: 'btn minuto', type: 'button',
            onclick: () => impostazioni.sostituisci({
              tattiche: structuredClone(TATTICHE_PREDEFINITE),
              livelloPieno: LIVELLO_PIENO,
              pesi: { difesa: 1, centrocampo: 1, attacco: 1 },
            }),
          }, 'Ripristina i valori di partenza'),
        ),
      ),
    );
  }

  disegna();
  const s1 = campo.ascolta(disegna);
  const s2 = impostazioni.ascolta(disegna);
  const s3 = rosa.ascolta(disegna);
  return () => { s1(); s2(); s3(); };
}
