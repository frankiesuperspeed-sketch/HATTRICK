import { inArrivo } from './segnaposto.js';

export const render = inArrivo({
  titolo: 'Schieramento e rating attesi',
  sommario: 'Che valori produce una certa formazione in difesa, centrocampo e attacco.',
  punti: [
    'comporre la formazione prendendo i giocatori dalla rosa',
    'stimare i rating per reparto che ne derivano',
    'confrontare due schieramenti alternativi fianco a fianco',
  ],
});
