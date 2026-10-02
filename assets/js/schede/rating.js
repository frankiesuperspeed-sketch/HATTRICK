/** Scheda "Rating": dai nomi verbali di Hattrick ai numeri e viceversa. */

import { h, rimpiazza, riquadro, valore, tabella, campoTesto, campoScelta } from '../lib/dom.js';
import { decimale, intero } from '../lib/formato.js';
import { deposito } from '../lib/deposito.js';
import {
  SCALA_PREDEFINITA, SOTTOLIVELLI_PREDEFINITI,
  interpreta, daNumero, aNumero, perEsteso, tabellaRiferimento,
} from '../calcolo/rating.js';

const scalaSalvata = deposito('scala-rating', {
  scala: SCALA_PREDEFINITA,
  sottolivelli: SOTTOLIVELLI_PREDEFINITI,
  confermata: false,
});

export function render(host) {
  let testo = 'eccellente (molto alto)';

  const disegna = () => {
    const { scala, sottolivelli, confermata } = scalaSalvata.leggi();
    const letto = interpreta(testo, { scala, sottolivelli });

    rimpiazza(host,
      h('div', { class: 'testata' },
        h('h1', null, 'Conversione rating'),
        h('p', null, 'Scrivi un rating come lo leggi in gioco, oppure un numero: ti do l’altra forma.'),
      ),

      confermata ? null : h('div', { class: 'avviso' },
        h('strong', null, 'Controlla i nomi. '),
        'La scala qui sotto è un punto di partenza, non una verità: i nomi cambiano con la lingua e con le versioni del gioco. ',
        'Confrontala con quella che vedi su Hattrick e correggi quello che non torna — le modifiche restano salvate. ',
        h('button', {
          class: 'btn minuto', type: 'button', style: { marginLeft: '6px' },
          onclick: () => scalaSalvata.modifica((s) => { s.confermata = true; }),
        }, 'L’ho controllata'),
      ),

      riquadro({
        titolo: 'Converti',
        sottotitolo: 'Funziona in entrambi i versi: “formidabile basso”, “eccellente”, “8,75”.',
        figli: [
          h('div', { class: 'campi' },
            campoTesto({
              etichetta: 'Rating o numero',
              valore: testo,
              segnaposto: 'es. buono (molto alto) oppure 7.75',
              onInput: (v) => { testo = v; aggiornaRisultato(); },
            }),
            campoScelta({
              etichetta: 'Oppure scegli il livello',
              valore: letto && !letto.fuoriScala ? String(letto.livello) : '',
              opzioni: [{ valore: '', nome: '—' }, ...scala.map((n, i) => ({ valore: String(i), nome: `${i} · ${n}` }))],
              onInput: (v) => {
                if (v === '') return;
                const sotto = letto?.sottolivello ?? 0;
                testo = `${scala[Number(v)]} (${sottolivelli[sotto] ?? sottolivelli[0]})`;
                disegna();
              },
            }),
            campoScelta({
              etichetta: 'Sottolivello',
              valore: String(letto?.sottolivello ?? 0),
              opzioni: sottolivelli.map((n, i) => ({ valore: String(i), nome: n })),
              onInput: (v) => {
                const livello = letto?.livello ?? 0;
                testo = `${scala[livello] ?? ''} (${sottolivelli[Number(v)]})`;
                disegna();
              },
            }),
          ),
          h('div', { id: 'risultato-rating' }),
        ],
      }),

      riquadro({
        titolo: 'Tabella di riferimento',
        sottotitolo: `Tutta la scala, con il valore di ogni sottolivello.`,
        figli: [
          tabella({
            intestazione: ['Livello', ...sottolivelli],
            classeRiga: (i) => (letto && !letto.fuoriScala && letto.livello === i ? 'evidenziata' : null),
            righe: tabellaRiferimento({ scala, sottolivelli }).map((r) => [
              `${r.livello} · ${r.nome}`,
              ...r.valori.map((v) => decimale(v.valore, 2)),
            ]),
          }),
        ],
      }),

      h('details', { class: 'parametri' },
        h('summary', null, 'Nomi della scala'),
        h('div', { class: 'corpo-parametri' },
          h('p', { class: 'piccolo tenue' },
            'Correggi un nome e tutta l’app lo userà: conversione, tabella e le altre schede.'),
          h('h3', null, 'Livelli'),
          h('div', { class: 'campi' },
            ...scala.map((nome, i) => campoTesto({
              etichetta: `Livello ${i}`,
              valore: nome,
              onInput: (v) => scalaSalvata.modifica((s) => { s.scala[i] = v; s.confermata = false; }),
            })),
          ),
          h('h3', null, 'Sottolivelli'),
          h('div', { class: 'campi' },
            ...sottolivelli.map((nome, i) => campoTesto({
              etichetta: `Sottolivello ${i}`,
              valore: nome,
              onInput: (v) => scalaSalvata.modifica((s) => { s.sottolivelli[i] = v; s.confermata = false; }),
            })),
          ),
          h('div', { class: 'in-riga', style: { marginBottom: '12px' } },
            h('button', {
              class: 'btn minuto', type: 'button',
              onclick: () => scalaSalvata.sostituisci({ scala: [...SCALA_PREDEFINITA], sottolivelli: [...SOTTOLIVELLI_PREDEFINITI], confermata: false }),
            }, 'Ripristina i nomi predefiniti'),
          ),
        ),
      ),
    );

    aggiornaRisultato();
  };

  /** Solo il risultato si ridisegna mentre scrivi: il campo non perde il fuoco. */
  function aggiornaRisultato() {
    const host2 = document.getElementById('risultato-rating');
    if (!host2) return;
    const { scala, sottolivelli } = scalaSalvata.leggi();
    const letto = interpreta(testo, { scala, sottolivelli });

    if (!letto) {
      rimpiazza(host2, h('p', { class: 'avviso' }, 'Non riconosco questo rating. Prova con un nome della scala, con nome e sottolivello, o con un numero.'));
      return;
    }
    if (letto.fuoriScala) {
      rimpiazza(host2, h('p', { class: 'avviso' }, `Il livello ${letto.livello} è oltre la scala conosciuta, che arriva a ${scala.length - 1}.`));
      return;
    }

    rimpiazza(host2,
      h('div', { class: 'valori' },
        valore({ etichetta: 'Per esteso', grande: true, cifra: perEsteso(letto) }),
        valore({ etichetta: 'Valore numerico', cifra: decimale(letto.valore, 2), sotto: `livello ${letto.livello}, sottolivello ${letto.sottolivello}` }),
        valore({
          etichetta: 'Solo il livello',
          cifra: intero(letto.livello),
          sotto: `${scala[letto.livello]} secco vale ${decimale(aNumero({ livello: letto.livello, sottolivello: 0, quantiSottolivelli: sottolivelli.length }), 2)}`,
        }),
        valore({
          etichetta: 'Livello successivo',
          cifra: scala[letto.livello + 1] ?? '—',
          sotto: scala[letto.livello + 1] ? `a ${decimale(letto.livello + 1, 2)}` : 'cima della scala',
        }),
      ),
    );
  }

  disegna();
  return scalaSalvata.ascolta(disegna);
}
