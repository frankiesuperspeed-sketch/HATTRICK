/** Scheda "Schieramento": che valori produce una formazione, reparto per reparto. */

import { h, rimpiazza, riquadro, valore, tabella, campoNumero, campoScelta } from '../lib/dom.js';
import { barre, COLORI } from '../lib/grafico.js';
import { decimale, intero } from '../lib/formato.js';
import { deposito } from '../lib/deposito.js';
import { rosa, giocatori, modificaGiocatore, ABILITA } from '../dati/rosa.js';
import {
  valutaSchieramento, contributiPerSettore, confrontaSchieramenti,
  POSIZIONI_PREDEFINITE, FATTORI_PREDEFINITI, SETTORI,
} from '../calcolo/schieramento.js';
import { daNumero, perEsteso, SCALA_PREDEFINITA, SOTTOLIVELLI_PREDEFINITI } from '../calcolo/rating.js';

const scalaSalvata = deposito('scala-rating', { scala: SCALA_PREDEFINITA, sottolivelli: SOTTOLIVELLI_PREDEFINITI, confermata: false });

const campo = deposito('schieramento', {
  righe: [],
  posizioni: POSIZIONI_PREDEFINITE,
  fattori: FATTORI_PREDEFINITI,
  // quanto vale un punto di reparto sulla scala dei rating. Zero = non
  // convertire: meglio nessun nome che un nome sbagliato.
  conversione: 0,
  fotografia: null,
});

const FORMAZIONE_TIPO = [
  'portiere', 'difensore', 'difensore', 'terzino', 'terzino',
  'centrocampista', 'centrocampista', 'centrocampista', 'ala', 'attaccante', 'attaccante',
];

export function render(host) {
  const disegna = () => {
    const stato = campo.leggi();
    const elenco = giocatori();
    const v = valutaSchieramento({
      schieramento: stato.righe,
      giocatori: elenco,
      posizioni: stato.posizioni,
      fattori: stato.fattori,
    });

    rimpiazza(host,
      h('div', { class: 'testata' },
        h('h1', null, 'Schieramento e rating attesi'),
        h('p', null, 'Componi la formazione con i giocatori della rosa e guarda che valori producono i tre reparti.'),
      ),

      h('div', { class: 'avviso' },
        h('strong', null, 'Da tarare. '),
        'Hattrick non pubblica quanto ogni ruolo pesa sui rating: i contributi di partenza sono stime dichiarate. ',
        'Confronta i numeri con i resoconti delle tue partite e correggili nel pannello in fondo — da lì in poi la scheda parla il tuo linguaggio.',
      ),

      elenco.length === 0
        ? h('div', { class: 'vuoto' }, h('p', null, 'La rosa è vuota: aggiungi i giocatori nella scheda “Rosa e stipendi” e torna qui.'))
        : null,

      riquadro({
        titolo: `Formazione — ${v.giocatoriSchierati} in campo`,
        sottotitolo: 'L’abilità che conta per ogni posizione la puoi scrivere qui: finisce nella rosa condivisa.',
        azioni: h('div', { class: 'in-riga' },
          h('button', {
            class: 'btn minuto', type: 'button',
            onclick: () => campo.modifica((s) => { s.righe.push({ posizione: 'centrocampista', giocatoreId: '' }); }),
          }, '+ Posizione'),
          stato.righe.length === 0
            ? h('button', {
                class: 'btn minuto principale', type: 'button',
                onclick: () => campo.modifica((s) => { s.righe = FORMAZIONE_TIPO.map((p) => ({ posizione: p, giocatoreId: '' })); }),
              }, 'Formazione tipo')
            : h('button', {
                class: 'btn minuto', type: 'button',
                onclick: () => campo.modifica((s) => { s.righe = []; }),
              }, 'Svuota'),
        ),
        figli: [
          stato.righe.length
            ? h('div', null, ...stato.righe.map((riga, i) => rigaFormazione(riga, i, stato, elenco)))
            : h('div', { class: 'vuoto' }, h('p', null, 'Nessuna posizione: parti dalla formazione tipo e poi sistemala.')),
          v.vuoti.length
            ? h('p', { class: 'avviso' }, 'Da completare: ', v.vuoti.join(' · '))
            : null,
        ],
      }),

      ...(v.giocatoriSchierati ? risultati(v, stato) : []),

      pannelloParametri(stato),
    );
  };

  function rigaFormazione(riga, indice, stato, elenco) {
    const posizione = stato.posizioni.find((p) => p.id === riga.posizione);
    const g = elenco.find((x) => x.id === riga.giocatoreId);
    const chiaveAbilita = posizione?.abilita;
    const nomeAbilita = ABILITA.find((a) => a.id === chiaveAbilita)?.nome ?? chiaveAbilita;

    return h('div', { class: 'riga-elenco' },
      campoScelta({
        etichetta: 'Posizione', valore: riga.posizione,
        opzioni: stato.posizioni.map((p) => ({ valore: p.id, nome: p.nome })),
        onInput: (val) => campo.modifica((s) => { s.righe[indice].posizione = val; }),
      }),
      campoScelta({
        etichetta: 'Giocatore', valore: riga.giocatoreId,
        opzioni: [{ valore: '', nome: '— nessuno —' }, ...elenco.map((x) => ({ valore: x.id, nome: x.nome || '(senza nome)' }))],
        onInput: (val) => campo.modifica((s) => { s.righe[indice].giocatoreId = val; }),
      }),
      campoNumero({
        etichetta: nomeAbilita ? `Abilità: ${nomeAbilita}` : 'Abilità', passo: 1, min: 0, max: 20,
        valore: g && chiaveAbilita ? g.abilita?.[chiaveAbilita] : null,
        nota: g ? null : 'scegli prima un giocatore',
        onInput: (val) => {
          if (!g || !chiaveAbilita) return;
          modificaGiocatore(g.id, { abilita: { ...g.abilita, [chiaveAbilita]: val } });
        },
      }),
      campoNumero({
        etichetta: 'Forma', passo: 1, min: 0, max: 8, valore: g ? g.forma : null,
        nota: g ? 'vuoto = nessun effetto' : null,
        onInput: (val) => { if (g) modificaGiocatore(g.id, { forma: val }); },
      }),
      h('div', { class: 'azioni' },
        h('button', {
          class: 'btn spoglio minuto', type: 'button',
          onclick: () => campo.modifica((s) => { s.righe.splice(indice, 1); }),
        }, 'Togli'),
      ),
    );
  }

  function risultati(v, stato) {
    const { scala, sottolivelli } = scalaSalvata.leggi();
    const conversione = Number.isFinite(stato.conversione) && stato.conversione > 0 ? stato.conversione : 0;
    const comeRating = (valoreSettore) => {
      if (!conversione) return 'nome non tarato';
      const r = daNumero(valoreSettore * conversione, { scala, sottolivelli });
      return r && !r.fuoriScala ? perEsteso(r) : 'oltre la scala';
    };

    const confronto = stato.fotografia ? confrontaSchieramenti(stato.fotografia, v) : null;

    return [
      h('div', { class: 'valori' },
        ...SETTORI.map((s) => valore({
          etichetta: s.nome,
          grande: s.id === 'centrocampo',
          cifra: decimale(v.settori[s.id], 1),
          sotto: comeRating(v.settori[s.id]),
        })),
        valore({
          etichetta: 'Somma dei reparti',
          cifra: decimale(v.totale, 1),
          sotto: `${v.giocatoriSchierati} giocatori schierati`,
        }),
      ),

      riquadro({
        titolo: 'I tre reparti',
        sottotitolo: 'Il valore di ogni reparto e chi lo regge.',
        azioni: h('div', { class: 'in-riga' },
          h('button', {
            class: 'btn minuto', type: 'button',
            onclick: () => campo.modifica((s) => { s.fotografia = { settori: { ...v.settori } }; }),
          }, stato.fotografia ? 'Aggiorna la fotografia' : 'Fotografa questo schieramento'),
          stato.fotografia
            ? h('button', { class: 'btn spoglio minuto', type: 'button', onclick: () => campo.modifica((s) => { s.fotografia = null; }) }, 'Dimentica')
            : null,
        ),
        figli: [
          barre({
            righe: SETTORI.map((s) => ({ nome: s.nome, valori: [v.settori[s.id]] })),
            serie: [{ nome: 'Valore del reparto', colore: COLORI[0] }],
            formato: (val) => decimale(val, 1), larghezzaNomi: 130,
            didascalia: 'Valore prodotto da ciascun reparto',
          }),
          confronto
            ? tabella({
                intestazione: ['Reparto', 'Fotografia', 'Adesso', 'Differenza'],
                righe: confronto.map((c) => [
                  c.nome, decimale(c.primo, 1), decimale(c.secondo, 1),
                  h('span', {
                    class: c.differenza > 0 ? 'cifra positiva' : c.differenza < 0 ? 'cifra negativa' : null,
                    style: { fontSize: 'inherit', fontWeight: 500 },
                  }, `${c.differenza >= 0 ? '+' : '−'}${decimale(Math.abs(c.differenza), 1)}`),
                ]),
              })
            : null,
          ...SETTORI.map((s) => {
            const righe = contributiPerSettore(v, s.id);
            if (!righe.length) return null;
            return h('div', { style: { marginTop: '14px' } },
              h('h3', null, `Chi regge ${s.nome.toLowerCase()}`),
              tabella({
                intestazione: ['Giocatore', 'Posizione', 'Apporto', 'Quota'],
                righe: righe.map((r) => [
                  r.nome, r.posizione, decimale(r.apporto, 2),
                  v.settori[s.id] > 0 ? `${decimale((r.apporto / v.settori[s.id]) * 100, 0)} %` : '—',
                ]),
              }),
            );
          }),
        ],
      }),
    ];
  }

  function pannelloParametri(stato) {
    return h('details', { class: 'parametri' },
      h('summary', null, 'Contributi dei ruoli e altri parametri'),
      h('div', { class: 'corpo-parametri' },
        h('p', { class: 'piccolo tenue' },
          'Quanto ogni posizione pesa su ciascun reparto. Sono stime: confrontale con i tuoi resoconti e correggile.'),
        h('div', { class: 'scorri' },
          h('table', null,
            h('thead', null, h('tr', null,
              h('th', null, 'Posizione'), h('th', null, 'Abilità'),
              ...SETTORI.map((s) => h('th', { class: 'num' }, s.nome)))),
            h('tbody', null, ...stato.posizioni.map((p, i) => h('tr', null,
              h('td', null, p.nome),
              h('td', null, campoScelta({
                valore: p.abilita,
                opzioni: ABILITA.map((a) => ({ valore: a.id, nome: a.nome })),
                onInput: (val) => campo.modifica((s) => { s.posizioni[i].abilita = val; }),
              })),
              ...SETTORI.map((s) => h('td', { class: 'num' }, campoNumero({
                passo: 0.05, min: 0, valore: p.contributi?.[s.id] ?? 0,
                onInput: (val) => campo.modifica((st) => { st.posizioni[i].contributi[s.id] = val ?? 0; }),
              }))),
            ))),
          ),
        ),
        h('h3', null, 'Forma e condizione'),
        h('div', { class: 'campi' },
          campoNumero({
            etichetta: 'Peso della forma', passo: 0.05, min: 0, valore: stato.fattori.pesoForma,
            nota: '0 = non influisce',
            onInput: (val) => campo.modifica((s) => { s.fattori.pesoForma = val ?? 0; }),
          }),
          campoNumero({
            etichetta: 'Peso della condizione', passo: 0.05, min: 0, valore: stato.fattori.pesoCondizione,
            onInput: (val) => campo.modifica((s) => { s.fattori.pesoCondizione = val ?? 0; }),
          }),
          campoNumero({
            etichetta: 'Forma considerata normale', passo: 1, min: 0, valore: stato.fattori.formaNeutra,
            onInput: (val) => campo.modifica((s) => { s.fattori.formaNeutra = val ?? 0; }),
          }),
          campoNumero({
            etichetta: 'Da valore di reparto a rating', passo: 0.05, min: 0, valore: stato.conversione,
            nota: '0 = non convertire. Taralo finché i nomi corrispondono ai tuoi resoconti',
            onInput: (val) => campo.modifica((s) => { s.conversione = val ?? 1; }),
          }),
        ),
        h('div', { class: 'in-riga', style: { marginBottom: '12px' } },
          h('button', {
            class: 'btn minuto', type: 'button',
            title: 'Porta il reparto più forte vicino alla cima della scala: è un punto di partenza, non una verità',
            onclick: () => {
              const stato2 = campo.leggi();
              const v2 = valutaSchieramento({
                schieramento: stato2.righe, giocatori: giocatori(),
                posizioni: stato2.posizioni, fattori: stato2.fattori,
              });
              const massimo = Math.max(...SETTORI.map((s) => v2.settori[s.id]), 0);
              if (massimo <= 0) return;
              const cima = scalaSalvata.leggi().scala.length - 1;
              campo.modifica((s) => { s.conversione = Number((cima / massimo).toFixed(3)); });
            },
          }, 'Calcola un fattore di partenza'),
          h('button', {
            class: 'btn minuto', type: 'button',
            onclick: () => campo.modifica((s) => {
              s.posizioni = structuredClone(POSIZIONI_PREDEFINITE);
              s.fattori = structuredClone(FATTORI_PREDEFINITI);
              s.conversione = 0;
            }),
          }, 'Ripristina i valori di partenza'),
        ),
      ),
    );
  }

  disegna();
  const stacca1 = campo.ascolta(disegna);
  const stacca2 = rosa.ascolta(disegna);
  const stacca3 = scalaSalvata.ascolta(disegna);
  return () => { stacca1(); stacca2(); stacca3(); };
}
