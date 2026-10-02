import { inArrivo } from './segnaposto.js';

export const render = inArrivo({
  titolo: 'Conversione rating',
  sommario: 'Dai nomi verbali di Hattrick ai numeri, e viceversa.',
  punti: [
    'convertire un rating verbale nel suo valore numerico e al contrario',
    'gestire i sottolivelli (molto basso, basso, alto, molto alto)',
    'fare da riferimento rapido mentre leggi i resoconti delle partite',
  ],
});
