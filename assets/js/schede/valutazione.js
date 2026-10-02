/** Scheda "Valutazione": quanto vale un giocatore, secondo il mercato che osservi. */

import { h, rimpiazza, riquadro, valore, tabella, campoNumero, campoTesto, campoScelta } from '../lib/dom.js';
import { barre, COLORI } from '../lib/grafico.js';
import { denaro, compatto, percento, decimale, intero } from '../lib/formato.js';
import { deposito } from '../lib/deposito.js';
import { rosa, giocatori, RUOLI, ABILITA, nomeRuolo, ABILITA_DEL_RUOLO } from '../dati/rosa.js';
import { adattaModello, stimaPrezzo, confronta, curvaAbilita, curvaEta, MODELLO_PREDEFINITO } from '../calcolo/valutazione.js';

const osservazioni = deposito('osservazioni-mercato', { elenco: [] });
const soggetto = deposito('valutazione-soggetto', { abilita: 9, eta: 24, richiesto: null, giocatoreId: '' });

export function render(host) {
  const disegna = () => {
    const elenco = osservazioni.leggi().elenco;
    const s = soggetto.leggi();
    const valuta = rosa.leggi().valuta;
    const modello = adattaModello(elenco) ?? MODELLO_PREDEFINITO;
    const stima = stimaPrezzo({ abilita: s.abilita, eta: s.eta, modello });
    const paragone = confronta({ richiesto: s.richiesto, stimato: stima });

    rimpiazza(host,
      h('div', { class: 'testata' },
        h('h1', null, 'Valutazione giocatore'),
        h('p', null, 'Quanto vale un giocatore sul mercato, a partire dalle vendite che hai visto tu.'),
      ),

      h('div', { class: 'avviso' },
        h('strong', null, 'Come funziona. '),
        'Hattrick non pubblica nessuna formula del valore di mercato: una stima “ufficiale” sarebbe inventata. ',
        'Qui il modello si tara sulle vendite che registri tu — ',
        h('strong', null, 'da tre osservazioni in poi'),
        ' smette di usare i valori di partenza e usa i tuoi. Più ne aggiungi, più la stima somiglia al tuo mercato.',
      ),

      h('div', { class: 'colonne' },
        riquadro({
          titolo: 'Il giocatore da valutare',
          sottotitolo: 'Prendilo dalla rosa o inserisci i valori a mano.',
          figli: [
            h('div', { class: 'campi' },
              campoScelta({
                etichetta: 'Dalla rosa',
                valore: s.giocatoreId,
                opzioni: [{ valore: '', nome: '— a mano —' }, ...giocatori().map((g) => ({ valore: g.id, nome: `${g.nome} (${nomeRuolo(g.ruolo)})` }))],
                onInput: (v) => {
                  const g = giocatori().find((x) => x.id === v);
                  soggetto.modifica((st) => {
                    st.giocatoreId = v;
                    if (g) {
                      st.eta = g.eta ?? st.eta;
                      const chiave = ABILITA_DEL_RUOLO[g.ruolo];
                      const livello = g.abilita?.[chiave];
                      if (Number.isFinite(livello)) st.abilita = livello;
                    }
                  });
                },
                nota: s.giocatoreId ? 'età e abilità presi dalla rosa' : 'oppure compila i campi qui accanto',
              }),
              campoNumero({
                etichetta: 'Abilità di riferimento', passo: 1, min: 0, max: 20, valore: s.abilita,
                nota: 'Quella che conta per il suo ruolo',
                onInput: (v) => soggetto.modifica((st) => { st.abilita = v; }),
              }),
              campoNumero({
                etichetta: 'Età', passo: 1, min: 15, max: 45, valore: s.eta,
                onInput: (v) => soggetto.modifica((st) => { st.eta = v; }),
              }),
              campoNumero({
                etichetta: 'Prezzo richiesto', passo: 10000, min: 0, valore: s.richiesto,
                nota: 'Facoltativo: per capire se conviene',
                onInput: (v) => soggetto.modifica((st) => { st.richiesto = v; }),
              }),
            ),
          ],
        }),

        riquadro({
          titolo: 'Il modello',
          sottotitolo: modello.origine === 'osservazioni'
            ? `Calcolato sulle tue ${modello.n} osservazioni.`
            : 'Valori di partenza: aggiungi tre vendite osservate e si tara sul tuo mercato.',
          figli: [
            h('div', { class: 'valori' },
              valore({
                etichetta: 'Osservazioni usate',
                cifra: intero(modello.n ?? 0),
                sotto: modello.origine === 'osservazioni' ? 'il modello è tuo' : 'servono almeno 3 vendite',
              }),
              valore({
                etichetta: 'Quanto spiega (R²)',
                cifra: modello.r2 == null ? '—' : percento(modello.r2),
                tono: modello.r2 == null ? null : modello.r2 > 0.8 ? 'positiva' : modello.r2 < 0.5 ? 'negativa' : null,
                sotto: modello.r2 == null ? 'non calcolabile' : modello.r2 > 0.8 ? 'i prezzi seguono bene il modello' : 'prezzi molto sparsi',
              }),
              valore({
                etichetta: 'Un livello di abilità in più',
                cifra: `× ${decimale(Math.exp(modello.b), 2)}`,
                sotto: 'moltiplica il valore di tanto',
              }),
              valore({
                etichetta: 'Un anno di età in più',
                cifra: `× ${decimale(Math.exp(modello.c), 2)}`,
                sotto: 'moltiplica il valore di tanto',
              }),
            ),
          ],
        }),
      ),

      riquadro({
        titolo: 'Stima',
        figli: [
          h('div', { class: 'valori' },
            valore({
              etichetta: 'Valore stimato', grande: true,
              cifra: stima == null ? '—' : denaro(stima, valuta),
              sotto: `abilità ${decimale(s.abilita ?? 0, 0)}, ${decimale(s.eta ?? 0, 0)} anni`,
            }),
            paragone ? valore({
              etichetta: 'Rispetto al richiesto',
              cifra: paragone.giudizio,
              tono: paragone.scarto <= -0.08 ? 'positiva' : paragone.scarto >= 0.08 ? 'negativa' : null,
              sotto: `${paragone.scarto >= 0 ? '+' : '−'}${percento(Math.abs(paragone.scarto))} sulla stima (${denaro(paragone.differenza, valuta)})`,
            }) : valore({ etichetta: 'Rispetto al richiesto', cifra: '—', sotto: 'inserisci il prezzo richiesto' }),
            valore({
              etichetta: 'Un anno più giovane',
              cifra: compatto(stimaPrezzo({ abilita: s.abilita, eta: (s.eta ?? 0) - 1, modello }), valuta),
              sotto: 'a parità di abilità',
            }),
            valore({
              etichetta: 'Un livello in più',
              cifra: compatto(stimaPrezzo({ abilita: (s.abilita ?? 0) + 1, eta: s.eta, modello }), valuta),
              sotto: 'a parità di età',
            }),
          ),
          h('div', { class: 'colonne', style: { marginTop: '16px' } },
            barre({
              righe: curvaAbilita({ eta: s.eta, modello, da: Math.max(0, (s.abilita ?? 9) - 4), a: (s.abilita ?? 9) + 4 })
                .map((p) => ({ nome: `abilità ${p.abilita}`, valori: [p.prezzo ?? 0], colore: p.abilita === s.abilita ? COLORI[1] : COLORI[0] })),
              serie: [{ nome: 'Valore stimato', colore: COLORI[0] }],
              formato: (v) => compatto(v), unita: valuta, larghezzaNomi: 110,
              didascalia: `Valore al variare dell’abilità, a ${decimale(s.eta ?? 0, 0)} anni`,
            }),
            barre({
              righe: curvaEta({ abilita: s.abilita, modello, da: Math.max(15, (s.eta ?? 24) - 4), a: (s.eta ?? 24) + 4 })
                .map((p) => ({ nome: `${p.eta} anni`, valori: [p.prezzo ?? 0], colore: p.eta === s.eta ? COLORI[1] : COLORI[0] })),
              serie: [{ nome: 'Valore stimato', colore: COLORI[0] }],
              formato: (v) => compatto(v), unita: valuta, larghezzaNomi: 110,
              didascalia: `Valore al variare dell’età, con abilità ${decimale(s.abilita ?? 0, 0)}`,
            }),
          ),
        ],
      }),

      riquadro({
        titolo: `Vendite osservate — ${elenco.length}`,
        sottotitolo: 'Ogni riga è un giocatore che hai visto vendere davvero: abilità di riferimento, età e prezzo finale.',
        azioni: h('div', { class: 'in-riga' },
          h('button', {
            class: 'btn minuto', type: 'button',
            onclick: () => osservazioni.modifica((st) => { st.elenco.push({ id: `o${Date.now()}`, abilita: 9, eta: 24, prezzo: null, nota: '' }); }),
          }, '+ Aggiungi vendita'),
        ),
        figli: [
          elenco.length
            ? h('div', null,
                ...elenco.map((o) => h('div', { class: 'riga-elenco' },
                  campoNumero({ etichetta: 'Abilità', passo: 1, min: 0, max: 20, valore: o.abilita, onInput: (v) => aggiorna(o.id, { abilita: v }) }),
                  campoNumero({ etichetta: 'Età', passo: 1, min: 15, max: 45, valore: o.eta, onInput: (v) => aggiorna(o.id, { eta: v }) }),
                  campoNumero({ etichetta: 'Prezzo finale', passo: 10000, min: 0, valore: o.prezzo, onInput: (v) => aggiorna(o.id, { prezzo: v }) }),
                  campoTesto({ etichetta: 'Nota', valore: o.nota, segnaposto: 'es. specialità, ruolo', onInput: (v) => aggiorna(o.id, { nota: v }) }),
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
                h('p', null, 'Nessuna vendita registrata: la stima usa ancora i valori di partenza.'),
                h('button', {
                  class: 'btn principale', type: 'button',
                  onclick: () => osservazioni.modifica((st) => { st.elenco.push({ id: `o${Date.now()}`, abilita: 9, eta: 24, prezzo: null, nota: '' }); }),
                }, 'Registra la prima vendita'),
              ),
        ],
      }),
    );
  };

  const aggiorna = (id, campi) => osservazioni.modifica((st) => {
    const o = st.elenco.find((x) => x.id === id);
    if (o) Object.assign(o, campi);
  });

  disegna();
  const stacca1 = osservazioni.ascolta(disegna);
  const stacca2 = soggetto.ascolta(disegna);
  const stacca3 = rosa.ascolta(disegna);
  return () => { stacca1(); stacca2(); stacca3(); };
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
