/** Scheda "Arena sizer": quanti posti servono, quanto costa farli, quanto rendono. */

import { h, rimpiazza, riquadro, valore, tabella, campoNumero, campoCursore, segmenti, avvisi } from '../lib/dom.js';
import { barre, COLORI } from '../lib/grafico.js';
import { denaro, denaroSegnato, intero, decimale, stagioni, SETTIMANE_PER_STAGIONE } from '../lib/formato.js';
import { deposito } from '../lib/deposito.js';
import { rosa } from '../dati/rosa.js';
import {
  SETTORI, PROFILI, UMORI, UMORE_MASSIMO, ARENA_INIZIALE, PARAMETRI_PREDEFINITI,
  profilo as cercaProfilo, dimensioneSuggerita, progettaArena, avvisiArena,
} from '../calcolo/arena.js';

const PARTITE_CASA = 7;

const arena = deposito('arena', {
  attuale: { ...ARENA_INIZIALE },
  tifosi: 250,
  umore: 6,
  sovradimensionamento: 125,
  profilo: 'nrg',
  manuali: { ...cercaProfilo('nrg').percentuali },
  smantella: false,
  modo: 'tifosi',
  obiettivo: 15000,
  partiteCasa: PARTITE_CASA,
  parametri: structuredClone(PARAMETRI_PREDEFINITI),
});

const conti = deposito('conti', { entrate: 0, cassa: 0, orizzonte: 16 });

const percentualiScelte = (s) => (s.profilo === 'manuale' ? s.manuali : cercaProfilo(s.profilo).percentuali);
const cento = (x) => `${decimale(x, 1)} %`;

export function render(host) {
  const disegna = () => {
    const s = arena.leggi();
    const valuta = rosa.leggi().valuta;
    const cassa = conti.leggi().cassa;

    const percentuali = percentualiScelte(s);
    const fan = dimensioneSuggerita({
      tifosi: s.tifosi, umore: s.umore, sovradimensionamento: s.sovradimensionamento,
    });
    const obiettivo = s.modo === 'tifosi' ? fan.suggerita : Math.max(0, Math.round(s.obiettivo || 0));

    const p = progettaArena({
      attuale: s.attuale,
      obiettivo,
      percentuali,
      smantella: s.smantella,
      affluenza: fan.affluenzaAttesa,
      partiteCasa: s.partiteCasa,
      parametri: s.parametri,
    });

    const problemi = avvisiArena({ progetto: p, cassa, obiettivo, smantella: s.smantella });
    const sceltoProfilo = s.profilo === 'manuale' ? null : cercaProfilo(s.profilo);
    const incassoSettimanale = p.incasso ? (p.incasso.totale * Math.max(0, s.partiteCasa || 0)) / SETTIMANE_PER_STAGIONE : 0;

    rimpiazza(host,
      h('div', { class: 'testata' },
        h('h1', null, 'Arena sizer'),
        h('p', null, 'Quanti posti ti servono davvero, quanto costa costruirli e quanto tornano indietro dai biglietti.'),
      ),

      h('div', { class: 'avviso' },
        h('strong', null, 'Numeri di gioco stimati. '),
        'Costo per posto, manutenzione, prezzo del biglietto e percentuali di affluenza non sono pubblicati da Hattrick: ',
        'qui si usano le stime consolidate dalla comunità, nella forma del tool ',
        h('em', null, 'Enterprise Construction Online'), ' di nrgjack. Sono tutte modificabili in fondo alla pagina.',
      ),

      h('div', { class: 'colonne' },
        riquadro({
          titolo: 'Lo stadio di oggi',
          sottotitolo: 'I posti che hai già, settore per settore.',
          figli: [
            h('div', { class: 'campi' },
              ...SETTORI.map((set) => campoNumero({
                etichetta: set.nome, passo: 100, min: 0, chiave: `attuale-${set.id}`,
                valore: s.attuale[set.id],
                onInput: (val) => arena.modifica((st) => { st.attuale[set.id] = Math.max(0, val ?? 0); }),
              })),
            ),
            h('p', { class: 'piccolo tenue', style: { marginBottom: 0 } },
              `Capienza attuale ${intero(p.totaleAttuale)} posti · manutenzione ${denaro(p.manutenzioneAttuale, valuta)} a settimana.`),
          ],
        }),

        riquadro({
          titolo: 'I tuoi tifosi',
          sottotitolo: 'Da qui nasce l’affluenza attesa, e quindi i posti che servono.',
          figli: [
            campoNumero({
              etichetta: 'Tifosi del club', passo: 10, min: 0, chiave: 'tifosi',
              valore: s.tifosi, nota: 'Il numero di iscritti al fan club',
              onInput: (val) => arena.modifica((st) => { st.tifosi = Math.max(0, val ?? 0); }),
            }),
            campoCursore({
              etichetta: 'Umore dei tifosi', min: 0, max: UMORE_MASSIMO, chiave: 'umore',
              valore: s.umore, testoValore: (v) => UMORI[v] ?? '—',
              onInput: (val) => arena.modifica((st) => { st.umore = val; }),
              marche: [
                { valore: 0, testo: 'inferociti' },
                { valore: 6, testo: 'contenti' },
                { valore: UMORE_MASSIMO, testo: 'in estasi' },
              ],
            }),
            campoNumero({
              etichetta: 'Cassa disponibile', passo: 10000, chiave: 'cassa',
              valore: cassa, unita: valuta, nota: 'La stessa della scheda “Rosa e stipendi”',
              onInput: (val) => conti.modifica((c) => { c.cassa = val ?? 0; }),
            }),
            h('p', { class: 'piccolo tenue', style: { marginBottom: 0 } },
              `Affluenza attesa ${intero(fan.affluenzaAttesa)} spettatori: ${decimale(fan.coefficiente, 2)} per ogni tifoso, con questo umore.`),
          ],
        }),
      ),

      riquadro({
        titolo: 'Quanti posti costruire',
        sottotitolo: 'Dal numero dei tifosi, oppure una capienza che scegli tu.',
        figli: [
          segmenti({
            etichetta: 'Come decidere la capienza',
            valore: s.modo,
            opzioni: [
              { valore: 'tifosi', nome: 'Dai tifosi' },
              { valore: 'dimensione', nome: 'La scelgo io' },
            ],
            onInput: (val) => arena.modifica((st) => {
              // passando a mano si parte dalla proposta, così il campo non è mai vuoto
              if (val === 'dimensione' && !st.obiettivo) st.obiettivo = fan.suggerita;
              st.modo = val;
            }),
          }),

          s.modo === 'tifosi'
            ? h('div', null,
                campoCursore({
                  etichetta: 'Sovradimensionamento', min: 100, max: 150, chiave: 'sovra',
                  valore: s.sovradimensionamento, testoValore: (v) => `${v} %`,
                  onInput: (val) => arena.modifica((st) => { st.sovradimensionamento = val; }),
                  marche: [
                    { valore: 100, testo: '100 %' },
                    { valore: 112, testo: 'medie' },
                    { valore: 125, testo: 'NRG' },
                    { valore: 135, testo: 'massime' },
                    { valore: 150, testo: '150 %' },
                  ],
                  nota: 'Il margine sopra l’affluenza attesa: serve per il meteo estremo, per le partite di cartello e per la crescita dei tifosi',
                }),
                sceltoProfilo && sceltoProfilo.sovradimensionamento !== s.sovradimensionamento
                  ? h('p', { class: 'in-riga', style: { marginTop: '4px' } },
                      h('span', { class: 'piccolo tenue' },
                        `Con le percentuali “${sceltoProfilo.nome}” si consiglia il ${sceltoProfilo.sovradimensionamento} %.`),
                      h('button', {
                        class: 'btn minuto', type: 'button',
                        onclick: () => arena.modifica((st) => { st.sovradimensionamento = sceltoProfilo.sovradimensionamento; }),
                      }, 'Usa il valore consigliato'),
                    )
                  : null,
              )
            : campoNumero({
                etichetta: 'Capienza che vuoi raggiungere', passo: 500, min: 0, chiave: 'obiettivo',
                valore: s.obiettivo, unita: 'posti',
                nota: `Dai tifosi verrebbero proposti ${intero(fan.suggerita)} posti`,
                onInput: (val) => arena.modifica((st) => { st.obiettivo = Math.max(0, val ?? 0); }),
              }),

          h('p', { class: 'piccolo tenue', style: { marginBottom: 0 } },
            `Obiettivo di capienza: ${intero(obiettivo)} posti.`),
        ],
      }),

      riquadro({
        titolo: 'Come dividere i posti',
        sottotitolo: 'Le percentuali dicono dove si siede la gente che viene allo stadio.',
        figli: [
          segmenti({
            valore: s.profilo,
            opzioni: [...PROFILI.map((pr) => ({ valore: pr.id, nome: pr.nome })), { valore: 'manuale', nome: 'Manuali' }],
            onInput: (val) => arena.modifica((st) => {
              // passando a mano si parte dalle percentuali che si vedevano
              if (val === 'manuale') st.manuali = { ...percentualiScelte(st) };
              st.profilo = val;
            }),
          }),

          sceltoProfilo
            ? h('p', { class: 'piccolo tenue' }, sceltoProfilo.descrizione)
            : h('div', null,
                h('div', { class: 'campi' },
                  ...SETTORI.map((set) => campoNumero({
                    etichetta: set.nome, passo: 0.5, min: 0, unita: '%', chiave: `pct-${set.id}`,
                    valore: s.manuali[set.id],
                    onInput: (val) => arena.modifica((st) => { st.manuali[set.id] = Math.max(0, val ?? 0); }),
                  })),
                ),
                h('p', { class: 'piccolo tenue' },
                  `Somma: ${cento(SETTORI.reduce((acc, set) => acc + (Number(s.manuali[set.id]) || 0), 0))}. `,
                  'Se non fa 100 le percentuali vengono riproporzionate.'),
              ),

          h('div', { class: 'campo' },
            h('label', { class: 'in-riga', style: { fontWeight: '550' } },
              h('input', {
                type: 'checkbox', checked: s.smantella, dataset: { chiave: 'smantella' },
                onchange: (e) => arena.modifica((st) => { st.smantella = e.target.checked; }),
              }),
              'Permetti lo smantellamento dei posti in eccesso',
            ),
            h('span', { class: 'nota' }, s.smantella
              ? 'Verrà proposta anche la riduzione dei settori troppo grandi.'
              : 'Si costruisce solo ciò che manca: nessun settore verrà ridotto.'),
          ),
        ],
      }),

      h('div', { class: 'valori' },
        valore({
          etichetta: 'Capienza del progetto', grande: true,
          cifra: intero(p.totale),
          sotto: p.totale === p.totaleAttuale
            ? 'uguale a oggi'
            : `${p.totale > p.totaleAttuale ? '+' : '−'}${intero(Math.abs(p.totale - p.totaleAttuale))} rispetto a oggi`,
        }),
        valore({
          etichetta: 'Costo dei lavori',
          cifra: denaro(p.costi.totale, valuta),
          tono: p.costi.totale > 0 && Number.isFinite(Number(cassa)) && Number(cassa) < p.costi.totale ? 'negativa' : null,
          sotto: p.costi.totale > 0 ? `pronti in ${p.giorni} giorni` : 'niente da fare',
        }),
        valore({
          etichetta: 'Manutenzione',
          cifra: denaro(p.manutenzione, valuta),
          sotto: `a settimana · ${denaroSegnato(p.manutenzione - p.manutenzioneAttuale, valuta)} su oggi`,
        }),
        valore({
          etichetta: 'Incasso per partita',
          cifra: denaro(p.incasso?.totale ?? 0, valuta),
          sotto: `a stadio pieno farebbe ${denaro(p.incassoMassimo, valuta)}`,
        }),
        valore({
          etichetta: 'Saldo settimanale',
          cifra: denaroSegnato(p.saldoSettimanale ?? 0, valuta),
          tono: (p.saldoSettimanale ?? 0) >= 0 ? 'positiva' : 'negativa',
          sotto: `biglietti meno manutenzione, su ${Math.max(0, s.partiteCasa || 0)} partite in casa`,
        }),
        valore({
          etichetta: 'Rientro dei lavori',
          cifra: p.costi.totale === 0 ? '—' : p.rientro.possibile ? stagioni(p.rientro.settimane) : 'mai',
          sotto: p.costi.totale === 0
            ? 'nessun lavoro da ripagare'
            : p.rientro.possibile
              ? `con ${denaro(Math.round(p.guadagnoSettimanale), valuta)} in più a settimana`
              : 'i posti nuovi non si ripagano: costano più di quanto rendano',
        }),
      ),

      avvisi(problemi),

      riquadro({
        titolo: 'Il progetto, settore per settore',
        sottotitolo: 'Quanto c’è, quanto fare, e cosa rende ogni settore con l’affluenza attesa.',
        figli: [
          barre({
            righe: p.righe.map((r) => ({ nome: r.nome, valori: [r.attuale, r.posti] })),
            serie: [
              { nome: 'Oggi', colore: COLORI[0] },
              { nome: 'Nel progetto', colore: COLORI[2] },
            ],
            formato: (v) => intero(v),
            larghezzaNomi: 150,
            didascalia: 'Posti per settore, oggi e nel progetto',
          }),
          tabella({
            intestazione: ['Settore', 'Oggi', 'Da fare', 'Nel progetto', '% finale', 'Biglietto', 'Attesi', 'Incasso'],
            righe: p.righe.map((r) => {
              const i = p.incasso?.righe.find((x) => x.id === r.id);
              return [
                r.nome,
                intero(r.attuale),
                h('span', {
                  class: r.delta > 0 ? 'cifra positiva' : r.delta < 0 ? 'cifra negativa' : null,
                  style: { fontSize: 'inherit', fontWeight: 500 },
                }, r.delta === 0 ? '—' : `${r.delta > 0 ? '+' : '−'}${intero(Math.abs(r.delta))}`),
                intero(r.posti),
                cento(r.percentuale),
                denaro(r.prezzo, valuta),
                i ? intero(Math.round(i.venduti)) : '—',
                denaro(i?.ricavo ?? 0, valuta),
              ];
            }),
            piede: [
              'Totale', intero(p.totaleAttuale),
              p.totale === p.totaleAttuale ? '—' : `${p.totale > p.totaleAttuale ? '+' : '−'}${intero(Math.abs(p.totale - p.totaleAttuale))}`,
              intero(p.totale), cento(100), '',
              intero(Math.round(p.incasso?.venduti ?? 0)),
              denaro(p.incasso?.totale ?? 0, valuta),
            ],
          }),
          p.incasso && p.incasso.fuori >= 1
            ? h('p', { class: 'piccolo tenue', style: { marginBottom: 0 } },
                `Con questa affluenza ${intero(Math.round(p.incasso.fuori))} spettatori resterebbero fuori: sono ${denaro(Math.round(p.incasso.fuori * mediaPrezzo(p)), valuta)} di biglietti non venduti.`)
            : h('p', { class: 'piccolo tenue', style: { marginBottom: 0 } },
                'Con questa affluenza entrano tutti, e resta margine per le partite di cartello.'),
        ],
      }),

      riquadro({
        titolo: 'Tiene nel tempo?',
        sottotitolo: 'Gli incassi di una stagione contro quello che lo stadio costa tenerlo aperto.',
        azioni: h('button', {
          class: 'btn minuto', type: 'button',
          onclick: () => conti.modifica((c) => { c.entrate = Math.round(incassoSettimanale); }),
        }, 'Usa come entrate in “Rosa e stipendi”'),
        figli: [
          campoNumero({
            etichetta: 'Partite in casa per stagione', passo: 1, min: 0, chiave: 'partite',
            valore: s.partiteCasa, nota: 'Sette di campionato, più le amichevoli e la coppa',
            onInput: (val) => arena.modifica((st) => { st.partiteCasa = Math.max(0, val ?? 0); }),
          }),
          tabella({
            intestazione: ['Voce', 'Per stagione', 'Per settimana'],
            righe: [
              [
                'Incassi dai biglietti',
                denaro((p.incasso?.totale ?? 0) * Math.max(0, s.partiteCasa || 0), valuta),
                denaro(incassoSettimanale, valuta),
              ],
              [
                'Manutenzione dello stadio',
                denaro(-p.manutenzione * SETTIMANE_PER_STAGIONE, valuta),
                denaro(-p.manutenzione, valuta),
              ],
            ],
            piede: [
              'Saldo',
              denaroSegnato((p.saldoSettimanale ?? 0) * SETTIMANE_PER_STAGIONE, valuta),
              denaroSegnato(p.saldoSettimanale ?? 0, valuta),
            ],
          }),
          h('p', { class: 'piccolo tenue', style: { marginBottom: 0 } },
            `Una stagione sono ${SETTIMANE_PER_STAGIONE} settimane di manutenzione. `
            + 'Lo stadio non è l’unica voce di bilancio: stipendi e tenuta della cassa stanno in “Rosa e stipendi”.'),
        ],
      }),

      pannelloParametri(s, valuta),
    );
  };

  /** Prezzo medio del biglietto, per dire quanto valgono gli spettatori rimasti fuori. */
  function mediaPrezzo(p) {
    const venduti = p.incasso?.venduti ?? 0;
    return venduti > 0 ? p.incasso.totale / venduti : 0;
  }

  function pannelloParametri(s, valuta) {
    const par = s.parametri;
    return h('details', { class: 'parametri' },
      h('summary', null, 'Numeri di gioco'),
      h('div', { class: 'corpo-parametri' },
        h('p', { class: 'piccolo tenue' },
          'Costo di costruzione, manutenzione settimanale e prezzo del biglietto, per ogni posto. '
          + 'Sono stime: se nel gioco vedi valori diversi, correggili qui e tutta la scheda si adegua.'),
        h('div', { class: 'scorri' },
          h('table', null,
            h('thead', null, h('tr', null,
              h('th', null, 'Settore'),
              h('th', { class: 'num' }, `Costruzione (${valuta})`),
              h('th', { class: 'num' }, `Manutenzione (${valuta})`),
              h('th', { class: 'num' }, `Biglietto (${valuta})`),
            )),
            h('tbody', null, ...SETTORI.map((set) => h('tr', null,
              h('td', null, set.nome),
              h('td', { class: 'num' }, campoNumero({
                passo: 1, min: 0, valore: par.costi[set.id], chiave: `par-costo-${set.id}`,
                onInput: (val) => arena.modifica((st) => { st.parametri.costi[set.id] = Math.max(0, val ?? 0); }),
              })),
              h('td', { class: 'num' }, campoNumero({
                passo: 0.1, min: 0, valore: par.manutenzioni[set.id], chiave: `par-man-${set.id}`,
                onInput: (val) => arena.modifica((st) => { st.parametri.manutenzioni[set.id] = Math.max(0, val ?? 0); }),
              })),
              h('td', { class: 'num' }, campoNumero({
                passo: 1, min: 0, valore: par.prezzi[set.id], chiave: `par-prezzo-${set.id}`,
                onInput: (val) => arena.modifica((st) => { st.parametri.prezzi[set.id] = Math.max(0, val ?? 0); }),
              })),
            ))),
          ),
        ),
        h('div', { class: 'campi' },
          campoNumero({
            etichetta: 'Spesa fissa di apertura lavori', passo: 1000, min: 0, unita: valuta,
            valore: par.costoFisso, chiave: 'par-fisso',
            onInput: (val) => arena.modifica((st) => { st.parametri.costoFisso = Math.max(0, val ?? 0); }),
          }),
          campoNumero({
            etichetta: 'Smantellamento di un posto', passo: 1, min: 0, unita: valuta,
            valore: par.costoSmantellamento, chiave: 'par-smant',
            onInput: (val) => arena.modifica((st) => { st.parametri.costoSmantellamento = Math.max(0, val ?? 0); }),
          }),
        ),
        h('div', { class: 'in-riga', style: { marginBottom: '12px' } },
          h('button', {
            class: 'btn minuto', type: 'button',
            onclick: () => arena.modifica((st) => { st.parametri = structuredClone(PARAMETRI_PREDEFINITI); }),
          }, 'Ripristina i valori di partenza'),
        ),
      ),
    );
  }

  disegna();
  const s1 = arena.ascolta(disegna);
  const s2 = conti.ascolta(disegna);
  const s3 = rosa.ascolta(disegna);
  return () => { s1(); s2(); s3(); };
}
