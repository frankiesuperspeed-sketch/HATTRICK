import { inArrivo } from './segnaposto.js';

export const render = inArrivo({
  titolo: 'Mercato',
  sommario: 'Scadenze, offerte e prezzi di riferimento.',
  punti: [
    'tenere traccia delle aste che stai seguendo, con la scadenza',
    'annotare le offerte fatte e il tetto che ti sei dato',
    'confrontare il prezzo con la valutazione stimata del giocatore',
  ],
});
