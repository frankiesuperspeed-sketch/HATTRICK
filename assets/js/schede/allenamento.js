/** Scheda "Allenamento": chi cresce, quanto, e quando arrivano gli scatti. */

import { h, rimpiazza, riquadro, valore, tabella, campoNumero, campoScelta } from '../lib/dom.js';
import { barre, COLORI } from '../lib/grafico.js';
import { decimale, intero, settimane as testoSettimane, stagioni } from '../lib/formato.js';
import { deposito } from '../lib/deposito.js';
import { rosa, giocatori, modificaGiocatore, RUOLI, nomeRuolo } from '../dati/rosa.js';
import {
  pianoStagionale, confrontaAllenamenti, calibraVelocita, crescitaSettimanale,
  ALLENAMENTI_PREDEFINITI, PARAMETRI_PREDEFINITI, SETTIMANE_PER_STAGIONE,
} from '../calcolo/allenamento.js';

const stato = deposito('allenamento', {
  allenamentoId: 'cross',
  impostazioni: { allenatore: 7, assistenti: 3, intensita: 100, quotaResistenza: 10 },
  settimane: SETTIMANE_PER_STAGIONE,
  sublivelli: {},
  allenamenti: ALLENAMENTI_PREDEFINITI,
  parametri: PARAMETRI_PREDEFINITI,
  settimaneOsservate: null,
  giocatoreCalibrazione: '',
});

const dataIta = (d) => (d instanceof Date && !isNaN(d)
  ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  : '—');

export function render(host) {
  const disegna = () => {
    const s = stato.leggi();
    const elenco = giocatori();
    const allenamento = s.allenamenti.find((a) => a.id === s.allenamentoId) ?? s.allenamenti[0];

    const piano = pianoStagionale({
      giocatori: elenco, allenamento,
      impostazioni: s.impostazioni, parametri: s.parametri,
      settimane: s.settimane, sublivelli: s.sublivelli,
    });

    const confronto = confrontaAllenamenti({
      giocatori: elenco, allenamenti: s.allenamenti,
      impostazioni: s.impostazioni, parametri: s.parametri,
      settimane: s.settimane, sublivelli: s.sublivelli,
    });

    const primo = piano.perGiocatore
      .filter((r) => r.settimaneAlProssimo != null)
      .sort((a, b) => a.settimaneAlProssimo - b.settimaneAlProssimo)[0];

    rimpiazza(host,
      h('div', { class: 'testata' },
        h('h1', null, 'Pianificatore di allenamento'),
        h('p', null, 'Chi stai allenando, quanto cresce ogni settimana e quando arrivano i prossimi scatti.'),
      ),

      h('div', { class: 'avviso' },
        h('strong', null, 'Da tarare sulla tua squadra. '),
        'Hattrick non pubblica la formula dell’allenamento: questo è un modello scomposto in fattori, utile per confrontare piani. ',
        'Quando un tuo giocatore fa uno scatto davvero, usa la ', h('em', null, 'calibrazione'), ' in fondo: da lì in poi le date diventano tue.',
      ),

      riquadro({
        titolo: 'Impostazioni',
        sottotitolo: 'Valgono per tutta la rosa allenata.',
        figli: [
          h('div', { class: 'campi' },
            campoScelta({
              etichetta: 'Allenamento', valore: s.allenamentoId,
              opzioni: s.allenamenti.map((a) => ({ valore: a.id, nome: a.nome })),
              onInput: (v) => stato.modifica((st) => { st.allenamentoId = v; }),
              nota: `Allena: ${allenamento.ruoli.map(nomeRuolo).join(', ')}`,
            }),
            campoNumero({
              etichetta: 'Intensità', unita: '%', passo: 5, min: 0, max: 100, valore: s.impostazioni.intensita,
              onInput: (v) => stato.modifica((st) => { st.impostazioni.intensita = v ?? 0; }),
            }),
            campoNumero({
              etichetta: 'Quota resistenza', unita: '%', passo: 5, min: 0, max: 100, valore: s.impostazioni.quotaResistenza,
              onInput: (v) => stato.modifica((st) => { st.impostazioni.quotaResistenza = v ?? 0; }),
            }),
            campoNumero({
              etichetta: 'Livello allenatore', passo: 1, min: 1, max: 10, valore: s.impostazioni.allenatore,
              nota: 'Da 4 a 8',
              onInput: (v) => stato.modifica((st) => { st.impostazioni.allenatore = v ?? 7; }),
            }),
            campoNumero({
              etichetta: 'Assistenti', passo: 1, min: 0, max: 10, valore: s.impostazioni.assistenti,
              onInput: (v) => stato.modifica((st) => { st.impostazioni.assistenti = v ?? 0; }),
            }),
            campoNumero({
              etichetta: 'Settimane da proiettare', passo: 1, min: 1, max: 160, valore: s.settimane,
              nota: `Una stagione = ${SETTIMANE_PER_STAGIONE} settimane`,
              onInput: (v) => stato.modifica((st) => { st.settimane = Math.min(160, Math.max(1, v ?? SETTIMANE_PER_STAGIONE)); }),
            }),
          ),
        ],
      }),

      !elenco.length
        ? h('div', { class: 'vuoto' }, h('p', null, 'La rosa è vuota: aggiungi i giocatori nella scheda “Rosa e stipendi” e torna qui.'))
        : !piano.allenati
          ? h('div', { class: 'vuoto' }, h('p', null, `Nessuno in rosa riceve l’allenamento “${allenamento.nome}”, che tocca ${allenamento.ruoli.map(nomeRuolo).join(', ')}.`))
          : null,

      ...(piano.allenati ? risultati({ s, piano, confronto, primo, allenamento, elenco }) : []),

      pannelloParametri(s),
    );
  };

  function risultati({ s, piano, confronto, primo, allenamento, elenco }) {
    return [
      h('div', { class: 'valori' },
        valore({
          etichetta: 'Prossimo scatto', grande: true,
          cifra: primo ? testoSettimane(Math.ceil(primo.settimaneAlProssimo)) : '—',
          sotto: primo
            ? `${primo.giocatore.nome} → livello ${primo.livello + 1}`
            : 'nessuno cresce con queste impostazioni',
        }),
        valore({
          etichetta: `Scatti in ${stagioni(s.settimane)}`,
          cifra: intero(piano.livelliGuadagnati),
          sotto: `su ${intero(piano.allenati)} giocatori allenati`,
        }),
        valore({
          etichetta: 'Crescita complessiva',
          cifra: decimale(piano.perGiocatore.reduce((a, r) => a + r.crescitaTotale, 0), 1),
          sotto: 'livelli, sommati su tutta la rosa allenata',
        }),
        valore({
          etichetta: 'Allenamento scelto',
          cifra: allenamento.nome,
          sotto: `sviluppa ${allenamento.abilita}`,
        }),
      ),

      riquadro({
        titolo: 'Chi stai allenando',
        sottotitolo: 'Il livello si scrive qui e finisce nella rosa condivisa. Il sublivello è quanto sei già avanti verso il prossimo scatto.',
        figli: [
          piano.senzaAbilita.length
            ? h('p', { class: 'avviso' }, 'Manca il livello di ', h('strong', null, allenamento.abilita), ' per: ', piano.senzaAbilita.join(', '))
            : null,
          h('div', null, ...piano.perGiocatore.map((r) => h('div', { class: 'riga-elenco' },
            h('div', { class: 'campo' },
              h('label', null, 'Giocatore'),
              h('div', { style: { padding: '8px 0' } },
                h('strong', null, r.giocatore.nome || '(senza nome)'),
                h('span', { class: 'tenue' }, ` · ${nomeRuolo(r.giocatore.ruolo)}, ${decimale(r.giocatore.eta ?? 0, 0)} anni`)),
            ),
            campoNumero({
              etichetta: `Livello ${allenamento.abilita}`, passo: 1, min: 0, max: 20,
              valore: r.giocatore.abilita?.[allenamento.abilita],
              onInput: (v) => modificaGiocatore(r.giocatore.id, { abilita: { ...r.giocatore.abilita, [allenamento.abilita]: v } }),
            }),
            campoNumero({
              etichetta: 'Sublivello', unita: '%', passo: 5, min: 0, max: 99,
              valore: Math.round((s.sublivelli[r.giocatore.id] ?? 0) * 100),
              onInput: (v) => stato.modifica((st) => { st.sublivelli[r.giocatore.id] = Math.min(0.99, Math.max(0, (v ?? 0) / 100)); }),
            }),
            h('div', { class: 'campo' },
              h('label', null, 'Prossimo scatto'),
              h('div', { style: { padding: '8px 0' } },
                r.settimaneAlProssimo == null
                  ? h('span', { class: 'tenue' }, 'mai')
                  : h('span', null, testoSettimane(Math.ceil(r.settimaneAlProssimo)),
                      h('span', { class: 'tenue' }, ` · ${decimale(crescitaSettimanale({ giocatore: r.giocatore, livello: r.livello, allenamento, impostazioni: s.impostazioni, parametri: s.parametri }).crescita, 3)}/sett.`)),
              ),
            ),
          ))),
        ],
      }),

      piano.scatti.length
        ? riquadro({
            titolo: `Scatti previsti — ${piano.scatti.length}`,
            sottotitolo: `Nei prossimi ${stagioni(s.settimane)}, in ordine di arrivo.`,
            figli: [
              tabella({
                intestazione: ['Giocatore', 'Livello raggiunto', 'Età', 'Settimana', 'Data prevista'],
                righe: piano.scatti.map((sc) => [
                  sc.nome, intero(sc.livello), intero(sc.eta), intero(sc.settimana), dataIta(sc.data),
                ]),
              }),
            ],
          })
        : null,

      riquadro({
        titolo: 'Quale allenamento rende di più',
        sottotitolo: `Stessa rosa, stesse impostazioni, stesso orizzonte: cambia solo il tipo di allenamento.`,
        figli: [
          barre({
            righe: confronto.map((c) => ({
              nome: c.allenamento.nome,
              valori: [c.crescitaTotale],
              colore: c.allenamento.id === allenamento.id ? COLORI[1] : COLORI[0],
            })),
            serie: [{ nome: 'Livelli guadagnati in totale', colore: COLORI[0] }],
            formato: (v) => decimale(v, 1), larghezzaNomi: 130,
            didascalia: 'Crescita complessiva della rosa, per tipo di allenamento',
          }),
          h('div', { class: 'legenda' },
            h('span', null, h('i', { class: 'tessera', style: { background: COLORI[1] } }), 'Quello che stai facendo'),
          ),
          h('p', { class: 'piccolo tenue' },
            'Una crescita a zero con dei giocatori allenati significa che a quei giocatori manca il livello dell\u2019abilità: la colonna “senza dati” li conta.'),
          tabella({
            intestazione: ['Allenamento', 'Allenati', 'Senza dati', 'Scatti', 'Crescita totale', 'Primo scatto'],
            classeRiga: (i) => (confronto[i].allenamento.id === allenamento.id ? 'evidenziata' : null),
            righe: confronto.map((c) => [
              c.allenamento.nome,
              intero(c.allenati),
              c.senzaAbilita
                ? h('span', { class: 'targhetta attenzione' }, intero(c.senzaAbilita))
                : h('span', { class: 'tenue' }, '—'),
              intero(c.livelliGuadagnati),
              decimale(c.crescitaTotale, 2),
              c.primoScatto ? `${c.primoScatto.nome}, sett. ${c.primoScatto.settimana}` : '—',
            ]),
          }),
        ],
      }),

      riquadro({
        titolo: 'Calibrazione',
        sottotitolo: 'Se sai quante settimane ha impiegato davvero un tuo giocatore per uno scatto, allinea il modello alla realtà.',
        figli: [
          h('div', { class: 'campi' },
            campoScelta({
              etichetta: 'Su quale giocatore', valore: s.giocatoreCalibrazione,
              opzioni: [{ valore: '', nome: '— scegli —' }, ...piano.perGiocatore.map((r) => ({ valore: r.giocatore.id, nome: r.giocatore.nome }))],
              onInput: (v) => stato.modifica((st) => { st.giocatoreCalibrazione = v; }),
            }),
            campoNumero({
              etichetta: 'Settimane osservate', passo: 1, min: 1, valore: s.settimaneOsservate,
              nota: 'Da livello pieno a scatto',
              onInput: (v) => stato.modifica((st) => { st.settimaneOsservate = v; }),
            }),
            h('div', { class: 'campo' },
              h('label', null, ' '),
              h('button', {
                class: 'btn principale', type: 'button',
                onclick: () => {
                  const r = piano.perGiocatore.find((x) => x.giocatore.id === s.giocatoreCalibrazione);
                  if (!r) return;
                  const nuova = calibraVelocita({
                    giocatore: r.giocatore, livello: r.livello, sublivello: 0,
                    allenamento, impostazioni: s.impostazioni, parametri: s.parametri,
                    settimaneOsservate: s.settimaneOsservate,
                  });
                  if (nuova) stato.modifica((st) => { st.parametri.velocitaBase = nuova; });
                },
              }, 'Calibra'),
            ),
          ),
          h('p', { class: 'piccolo tenue', style: { marginBottom: 0 } },
            `Velocità di base attuale: ${decimale(s.parametri.velocitaBase, 4)} livelli a settimana.`),
        ],
      }),
    ];
  }

  function pannelloParametri(s) {
    return h('details', { class: 'parametri' },
      h('summary', null, 'Velocità degli allenamenti e fattori del modello'),
      h('div', { class: 'corpo-parametri' },
        h('h3', null, 'Allenamenti'),
        h('p', { class: 'piccolo tenue' }, 'Velocità relativa e ruoli raggiunti da ciascun allenamento.'),
        h('div', { class: 'scorri' },
          h('table', null,
            h('thead', null, h('tr', null,
              h('th', null, 'Allenamento'), h('th', { class: 'num' }, 'Velocità'),
              ...RUOLI.map((r) => h('th', { class: 'num' }, r.breve)))),
            h('tbody', null, ...s.allenamenti.map((a, i) => h('tr', null,
              h('td', null, a.nome),
              h('td', { class: 'num' }, campoNumero({
                passo: 0.05, min: 0, valore: a.velocita,
                onInput: (v) => stato.modifica((st) => { st.allenamenti[i].velocita = v ?? 0; }),
              })),
              ...RUOLI.map((r) => h('td', { class: 'num' },
                h('input', {
                  type: 'checkbox', checked: a.ruoli.includes(r.id),
                  onchange: (e) => stato.modifica((st) => {
                    const insieme = new Set(st.allenamenti[i].ruoli);
                    e.target.checked ? insieme.add(r.id) : insieme.delete(r.id);
                    st.allenamenti[i].ruoli = [...insieme];
                  }),
                }))),
            ))),
          ),
        ),
        h('h3', null, 'Motore'),
        h('div', { class: 'campi' },
          campoNumero({
            etichetta: 'Velocità di base', passo: 0.005, min: 0, valore: s.parametri.velocitaBase,
            nota: 'Livelli a settimana nelle condizioni di riferimento',
            onInput: (v) => stato.modifica((st) => { st.parametri.velocitaBase = v ?? 0; }),
          }),
          campoNumero({
            etichetta: 'Rallentamento per livello', passo: 0.01, min: 0, max: 1, valore: s.parametri.decadimentoLivello,
            nota: 'Sotto 1: ogni livello costa di più',
            onInput: (v) => stato.modifica((st) => { st.parametri.decadimentoLivello = v ?? 1; }),
          }),
          campoNumero({
            etichetta: 'Bonus per assistente', passo: 0.005, min: 0, valore: s.parametri.bonusAssistente,
            onInput: (v) => stato.modifica((st) => { st.parametri.bonusAssistente = v ?? 0; }),
          }),
          campoNumero({
            etichetta: 'Livello di riferimento', passo: 1, valore: s.parametri.riferimento.livello,
            onInput: (v) => stato.modifica((st) => { st.parametri.riferimento.livello = v ?? 8; }),
          }),
        ),
        h('h3', null, 'Moltiplicatore per età'),
        h('div', { class: 'campi' },
          ...Object.keys(s.parametri.eta).map(Number).sort((a, b) => a - b).map((eta) => campoNumero({
            etichetta: `${eta} anni`, passo: 0.01, min: 0, valore: s.parametri.eta[eta],
            onInput: (v) => stato.modifica((st) => { st.parametri.eta[eta] = v ?? 0; }),
          })),
        ),
        h('div', { class: 'in-riga', style: { marginBottom: '12px' } },
          h('button', {
            class: 'btn minuto', type: 'button',
            onclick: () => stato.modifica((st) => {
              st.allenamenti = structuredClone(ALLENAMENTI_PREDEFINITI);
              st.parametri = structuredClone(PARAMETRI_PREDEFINITI);
            }),
          }, 'Ripristina i valori di partenza'),
        ),
      ),
    );
  }

  disegna();
  const s1 = stato.ascolta(disegna);
  const s2 = rosa.ascolta(disegna);
  return () => { s1(); s2(); };
}
