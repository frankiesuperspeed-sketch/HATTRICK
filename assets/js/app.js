/** Guscio dell'app: tema, schede e caricamento delle viste. */

import { q, qq } from './lib/dom.js';
import { stato as statoSorgente, impostazioni } from './dati/sorgente.js';

const SCHEDE = {
  rosa:         () => import('./schede/rosa.js'),
  valutazione:  () => import('./schede/valutazione.js'),
  schieramento: () => import('./schede/schieramento.js'),
  allenamento:  () => import('./schede/allenamento.js'),
  giovanili:    () => import('./schede/giovanili.js'),
  forma:        () => import('./schede/forma.js'),
  tattiche:     () => import('./schede/tattiche.js'),
  rating:       () => import('./schede/rating.js'),
  mercato:      () => import('./schede/mercato.js'),
};
const PRIMA = 'rosa';
const CHIAVE_TEMA = 'hattrick:tema';

/* ------------------------------------------------------------------ tema */

function applicaTema(tema) {
  if (tema === 'chiaro' || tema === 'scuro') document.documentElement.dataset.tema = tema;
  else delete document.documentElement.dataset.tema;
  const icona = q('[data-tema-icona]');
  if (icona) icona.textContent = tema === 'chiaro' ? '☀' : tema === 'scuro' ? '☾' : '◐';
}

const temaSalvato = () => { try { return localStorage.getItem(CHIAVE_TEMA) || 'auto'; } catch { return 'auto'; } };

q('#tema')?.addEventListener('click', () => {
  const ordine = ['auto', 'chiaro', 'scuro'];
  const prossimo = ordine[(ordine.indexOf(temaSalvato()) + 1) % ordine.length];
  try { localStorage.setItem(CHIAVE_TEMA, prossimo); } catch { /* ignorato */ }
  applicaTema(prossimo);
});
applicaTema(temaSalvato());

/* -------------------------------------------------------- sorgente dati */

function mostraSorgente() {
  const s = statoSorgente();
  const chip = q('#sorgente-dati');
  const nome = q('[data-sorgente-nome]');
  if (!chip || !nome) return;
  const collegato = s.tipo === 'chpp' && s.collegato;
  nome.textContent = collegato ? `Hattrick: ${s.squadra || 'collegato'}` : s.sorgente.nome;
  chip.classList.toggle('collegato', collegato);
  chip.title = collegato ? s.sorgente.descrizione : `${s.sorgente.descrizione} Il collegamento a Hattrick arriverà qui.`;
}

q('#sorgente-dati')?.addEventListener('click', () => {
  const s = statoSorgente();
  const messaggio = s.tipo === 'chpp' && s.collegato
    ? `Dati collegati a Hattrick${s.squadra ? ` (${s.squadra})` : ''}.`
    : 'I dati sono quelli che inserisci tu e restano in questo browser.\n\nIl collegamento a Hattrick (CHPP) richiede un’applicazione approvata da Hattrick e un piccolo proxy sul server: arriverà qui.';
  alert(messaggio);
});
impostazioni.ascolta(mostraSorgente);
mostraSorgente();

/* ------------------------------------------------------------- schede */

const schedaCorrente = () => {
  const nome = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
  return SCHEDE[nome] ? nome : PRIMA;
};

let ultima = null;
let pulizia = null;

async function naviga() {
  const scheda = schedaCorrente();
  qq('#schede a').forEach((a) => a.setAttribute('aria-current', a.dataset.scheda === scheda ? 'page' : 'false'));
  if (scheda === ultima) return;
  ultima = scheda;

  const host = q('#app');
  if (typeof pulizia === 'function') pulizia();
  pulizia = null;
  host.replaceChildren();

  try {
    const modulo = await SCHEDE[scheda]();
    pulizia = modulo.render(host);
  } catch (errore) {
    console.error(errore);
    host.replaceChildren();
    const p = document.createElement('p');
    p.className = 'avviso';
    p.textContent = 'Non è stato possibile caricare questa scheda. Ricarica la pagina.';
    host.appendChild(p);
  }
  window.scrollTo({ top: 0 });
}

addEventListener('hashchange', naviga);
if (!location.hash) location.replace(`#/${PRIMA}`);
naviga();
