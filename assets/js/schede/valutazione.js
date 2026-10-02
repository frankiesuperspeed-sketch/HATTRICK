import { inArrivo } from './segnaposto.js';

export const render = inArrivo({
  titolo: 'Valutazione giocatore',
  sommario: 'Quanto vale un giocatore sul mercato, a partire da abilità, età e specialità.',
  punti: [
    'stimare il prezzo di mercato di un giocatore della tua rosa o di uno che stai guardando',
    'confrontare la stima con il prezzo richiesto, per capire se è un affare',
    'mostrare quanto pesano età e specialità sul valore',
  ],
});
