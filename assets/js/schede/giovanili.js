/** Scheda "Giovanili": chi sta crescendo e quando conviene promuoverlo. */

import { h, rimpiazza, riquadro, valore, tabella, campoNumero, campoTesto, campoScelta } from '../lib/dom.js';
import { barre, COLORI } from '../lib/grafico.js';
import { decimale, intero, settimane as testoSettimane, stagioni } from '../lib/formato.js';
import { deposito } from '../lib/deposito.js';
import { rosa, giocatori, RUOLI, nomeRuolo, abilitaDelRuolo, ABILITA } from '../dati/rosa.js';
import { analizzaVivaio, crescitaMisurata, PARAMETRI_PREDEFINITI } from '../calcolo/giovanili.js';

const vivaio = deposito('giovanili', {
  giovani: [],
  storico: {},
  parametri: PARAMETRI_PREDEFINITI,
  selezionato: '',
  settimanaCorrente: 1,
});

export function render(host) {
  const disegna = () => {
    const s = vivaio.leggi();
    const prima = giocatori();
    const q = analizzaVivaio({
      giovani: s.giovani, rosa: prima, storico: s.storico,
      abilitaDi: (g) => abilitaDelRuolo(g.ruolo), parametri: s.parametri,
    });
    const selezionato = s.giovani.find((g) => g.id === s.selezionato) ?? null;

    rimpiazza(host,
      h('div', { class: 'testata' },
        h('h1', null, 'Settore giovanile'),
        h('p', null, 'Chi sta crescendo, quanto in fretta, e quando conviene portarlo in prima squadra.'),
      ),

      h('div', { class: 'avviso' },
        h('strong', null, 'Due cose vere, nessuna indovinata. '),
        'Il potenziale di un giovane non è calcolabile da fuori: quello che gli scout ti rivelano lo scrivi tu e non viene inventato. ',
        'Quello che la scheda calcola davvero è la crescita misurata sulle tue letture e il confronto con la prima squadra — ',
        'che è il segnale di promozione più solido: un giovane è pronto quando è già meglio di chi gioca adesso.',
      ),

      riquadro({
        titolo: `Vivaio — ${s.giovani.length}`,
        sottotitolo: 'Il livello è quello dell’abilità principale del ruolo. Il potenziale è quello rivelato dagli scout, se lo conosci.',
        azioni: h('div', { class: 'in-riga' },
          campoNumero({
            etichetta: 'Settimana', passo: 1, min: 1, valore: s.settimanaCorrente,
            onInput: (v) => vivaio.modifica((st) => { st.settimanaCorrente = Math.max(1, v ?? 1); }),
          }),
          h('button', {
            class: 'btn minuto', type: 'button',
            title: 'Salva i livelli di oggi, per misurare la crescita',
            onclick: () => vivaio.modifica((st) => {
              for (const g of st.giovani) {
                const livello = g.abilita?.[abilitaDelRuolo(g.ruolo)];
                if (!Number.isFinite(livello)) continue;
                st.storico[g.id] = [...(st.storico[g.id] ?? []), { settimana: st.settimanaCorrente, livello }];
              }
              st.settimanaCorrente += 1;
            }),
          }, 'Registra i livelli'),
          h('button', {
            class: 'btn minuto', type: 'button',
            onclick: () => vivaio.modifica((st) => {
              st.giovani.push({ id: `y${Date.now()}`, nome: `Giovane ${st.giovani.length + 1}`, ruolo: 'difensore', eta: 17, abilita: {}, potenziale: null });
            }),
          }, '+ Aggiungi'),
        ),
        figli: [
          s.giovani.length
            ? h('div', null, ...s.giovani.map((g, i) => rigaGiovane(g, i)))
            : h('div', { class: 'vuoto' },
                h('p', null, 'Nessun giovane inserito.'),
                h('button', {
                  class: 'btn principale', type: 'button',
                  onclick: () => vivaio.modifica((st) => {
                    st.giovani.push({ id: `y${Date.now()}`, nome: 'Primo giovane', ruolo: 'difensore', eta: 17, abilita: {}, potenziale: null });
                  }),
                }, 'Aggiungi il primo'),
              ),
          q.senzaLivello.length
            ? h('p', { class: 'avviso' }, 'Senza livello inserito: ', q.senzaLivello.join(', '))
            : null,
        ],
      }),

      ...(q.righe.length ? risultati({ q, s, prima, selezionato }) : []),

      pannelloParametri(s),
    );
  };

  function rigaGiovane(g, indice) {
    const abilita = abilitaDelRuolo(g.ruolo);
    const nomeAbilita = ABILITA.find((a) => a.id === abilita)?.nome ?? abilita;
    const aggiorna = (campi) => vivaio.modifica((st) => { Object.assign(st.giovani[indice], campi); });

    return h('div', { class: 'riga-elenco' },
      campoTesto({ etichetta: 'Nome', valore: g.nome, onInput: (v) => aggiorna({ nome: v }) }),
      campoScelta({
        etichetta: 'Ruolo', valore: g.ruolo,
        opzioni: RUOLI.map((r) => ({ valore: r.id, nome: r.nome })),
        onInput: (v) => aggiorna({ ruolo: v }),
      }),
      campoNumero({ etichetta: 'Età', passo: 1, min: 15, max: 21, valore: g.eta, onInput: (v) => aggiorna({ eta: v }) }),
      campoNumero({
        etichetta: nomeAbilita, passo: 1, min: 0, max: 20, valore: g.abilita?.[abilita],
        onInput: (v) => vivaio.modifica((st) => { st.giovani[indice].abilita = { ...st.giovani[indice].abilita, [abilita]: v }; }),
      }),
      campoNumero({
        etichetta: 'Potenziale', passo: 1, min: 0, max: 20, valore: g.potenziale,
        nota: 'se rivelato',
        onInput: (v) => aggiorna({ potenziale: v }),
      }),
      h('div', { class: 'azioni' },
        h('button', {
          class: 'btn spoglio minuto', type: 'button',
          onclick: () => vivaio.modifica((st) => {
            st.giovani = st.giovani.filter((x) => x.id !== g.id);
            delete st.storico[g.id];
          }),
        }, 'Rimuovi'),
      ),
    );
  }

  function risultati({ q, s, prima, selezionato }) {
    const letture = selezionato ? (s.storico[selezionato.id] ?? []) : [];
    const crescitaSelezionato = crescitaMisurata(letture);

    return [
      h('div', { class: 'valori' },
        valore({
          etichetta: 'Pronti per la promozione', grande: true,
          cifra: intero(q.pronti.length),
          tono: q.pronti.length ? 'positiva' : null,
          sotto: q.pronti.length ? q.pronti.map((r) => r.giovane.nome).join(', ') : 'nessuno, per ora',
        }),
        valore({
          etichetta: 'In scadenza di età',
          cifra: intero(q.inScadenza.length),
          tono: q.inScadenza.length ? 'negativa' : null,
          sotto: `entro i ${intero(s.parametri.etaMassima)} anni`,
        }),
        valore({
          etichetta: 'Giovani seguiti',
          cifra: intero(q.righe.length),
          sotto: `${intero(prima.length)} giocatori in prima squadra per il confronto`,
        }),
      ),

      riquadro({
        titolo: 'Chi è pronto, e perché',
        sottotitolo: 'Il motivo è sempre scritto: o supera qualcuno in rosa, o sta per scadere.',
        figli: [
          tabella({
            intestazione: ['Giovane', 'Ruolo', 'Età', 'Livello', 'Potenziale', 'Stato'],
            classeRiga: (i) => (q.righe[i].pronto ? 'evidenziata' : null),
            righe: q.righe.map((r) => [
              r.giovane.nome,
              nomeRuolo(r.giovane.ruolo),
              intero(r.giovane.eta),
              r.livello == null ? '—' : decimale(r.livello, 0),
              r.potenziale == null ? '—' : decimale(r.potenziale, 0),
              r.pronto
                ? h('span', { class: 'targhetta' }, r.motivi.join('; '))
                : r.mancanoLivelli
                  ? h('span', { class: 'tenue' }, `gli mancano ${decimale(r.mancanoLivelli, 0)} livelli`)
                  : h('span', { class: 'tenue' }, 'da seguire'),
            ]),
          }),
          ...(() => {
            // nel grafico solo chi ha un potenziale rivelato: altrimenti la
            // barra del potenziale pareggerebbe il livello e si leggerebbe
            // come "non può crescere", che è un'altra cosa
            const conPotenziale = q.righe.filter((r) => r.livello != null && r.potenziale != null);
            const senzaPotenziale = q.righe.filter((r) => r.livello != null && r.potenziale == null);
            if (!conPotenziale.length) return [];
            return [
              barre({
                righe: conPotenziale.map((r) => ({ nome: r.giovane.nome, valori: [r.livello, r.potenziale] })),
                serie: [
                  { nome: 'Livello attuale', colore: COLORI[0] },
                  { nome: 'Potenziale rivelato', colore: COLORI[2] },
                ],
                formato: (v) => decimale(v, 0), larghezzaNomi: 140,
                didascalia: 'Dove sono adesso e dove possono arrivare',
              }),
              senzaPotenziale.length
                ? h('p', { class: 'piccolo tenue' },
                    'Fuori dal grafico perché il potenziale non è stato rivelato: ',
                    senzaPotenziale.map((r) => r.giovane.nome).join(', '), '.')
                : null,
            ];
          })(),
        ],
      }),

      riquadro({
        titolo: 'Crescita misurata',
        sottotitolo: 'Serve almeno due letture dello stesso giovane per misurare quanto cresce.',
        azioni: campoScelta({
          valore: s.selezionato,
          opzioni: [{ valore: '', nome: '— scegli —' }, ...s.giovani.map((g) => ({ valore: g.id, nome: g.nome || '(senza nome)' }))],
          onInput: (v) => vivaio.modifica((st) => { st.selezionato = v; }),
        }),
        figli: [
          !selezionato
            ? h('p', { class: 'tenue' }, 'Scegli un giovane per vedere la sua crescita.')
            : letture.length < 2
              ? h('p', { class: 'tenue' }, `Finora ${letture.length === 1 ? 'una sola lettura' : 'nessuna lettura'}: usa “Registra i livelli” per cominciare a misurare.`)
              : h('div', null,
                  h('div', { class: 'valori', style: { marginBottom: '14px' } },
                    valore({
                      etichetta: 'Crescita misurata',
                      cifra: `${decimale(crescitaSelezionato.perSettimana, 3)}`,
                      sotto: `livelli a settimana, su ${intero(crescitaSelezionato.settimaneOsservate)} settimane`,
                    }),
                    valore({
                      etichetta: 'Al potenziale',
                      cifra: (() => {
                        const r = q.righe.find((x) => x.giovane.id === selezionato.id);
                        return r?.settimaneAlPotenziale == null ? '—' : stagioni(r.settimaneAlPotenziale);
                      })(),
                      sotto: selezionato.potenziale == null ? 'potenziale non inserito' : `fino a ${decimale(selezionato.potenziale, 0)}`,
                    }),
                  ),
                  tabella({
                    intestazione: ['Settimana', 'Livello'],
                    righe: [...letture].reverse().map((l) => [`Settimana ${intero(l.settimana)}`, decimale(l.livello, 0)]),
                  }),
                  h('div', { class: 'in-riga', style: { marginTop: '10px' } },
                    h('button', {
                      class: 'btn spoglio minuto', type: 'button',
                      onclick: () => vivaio.modifica((st) => { delete st.storico[selezionato.id]; }),
                    }, 'Cancella le letture di questo giovane'),
                  ),
                ),
        ],
      }),
    ];
  }

  function pannelloParametri(s) {
    return h('details', { class: 'parametri' },
      h('summary', null, 'Criteri di promozione'),
      h('div', { class: 'corpo-parametri' },
        h('div', { class: 'campi' },
          campoNumero({
            etichetta: 'Età massima in accademia', passo: 1, min: 15, max: 25, valore: s.parametri.etaMassima,
            nota: 'Oltre questa età va promosso o perso',
            onInput: (v) => vivaio.modifica((st) => { st.parametri.etaMassima = v ?? 19; }),
          }),
          campoNumero({
            etichetta: 'Margine di promozione', passo: 1, min: 0, valore: s.parametri.margineDiPromozione,
            nota: 'Di quanto deve superare un titolare per dirsi pronto',
            onInput: (v) => vivaio.modifica((st) => { st.parametri.margineDiPromozione = v ?? 0; }),
          }),
        ),
        h('div', { class: 'in-riga', style: { marginBottom: '12px' } },
          h('button', {
            class: 'btn minuto', type: 'button',
            onclick: () => vivaio.modifica((st) => { st.parametri = structuredClone(PARAMETRI_PREDEFINITI); }),
          }, 'Ripristina i criteri di partenza'),
        ),
      ),
    );
  }

  disegna();
  const s1 = vivaio.ascolta(disegna);
  const s2 = rosa.ascolta(disegna);
  return () => { s1(); s2(); };
}
