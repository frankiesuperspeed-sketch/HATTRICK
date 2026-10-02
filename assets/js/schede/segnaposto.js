/**
 * Scheda non ancora costruita. Dice cosa farà, invece di fingere di esistere:
 * meglio una pagina onesta di una piena di finti dati.
 */

import { h, rimpiazza } from '../lib/dom.js';

export function inArrivo({ titolo, sommario, punti }) {
  return (host) => {
    rimpiazza(host,
      h('div', { class: 'testata' }, h('h1', null, titolo), h('p', null, sommario)),
      h('div', { class: 'in-arrivo' },
        h('h2', null, 'In costruzione'),
        h('p', null, 'Questa scheda farà:'),
        h('ul', { style: { textAlign: 'left', maxWidth: '52ch', margin: '0 auto' } },
          ...punti.map((p) => h('li', null, p))),
        h('p', { class: 'piccolo tenue', style: { marginTop: '16px' } },
          'Userà la stessa rosa della scheda “Rosa e stipendi”: i giocatori si inseriscono una volta sola.'),
      ),
    );
  };
}
