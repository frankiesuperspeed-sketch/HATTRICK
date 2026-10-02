import { inArrivo } from './segnaposto.js';

export const render = inArrivo({
  titolo: 'Pianificatore di allenamento',
  sommario: 'Chi allenare, in che ordine, e dove si arriva a fine stagione.',
  punti: [
    'stimare la crescita settimanale di ogni giocatore allenato',
    'proiettare i prossimi scatti di abilità con le date',
    'confrontare piani di allenamento diversi sull’arco di una stagione',
  ],
});
