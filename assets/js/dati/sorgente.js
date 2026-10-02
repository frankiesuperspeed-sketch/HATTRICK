/**
 * Da dove arrivano i dati della squadra.
 *
 * Oggi c'è una sola sorgente davvero attiva, l'inserimento manuale. Il
 * collegamento a Hattrick (CHPP) è previsto qui e non altrove: quando il
 * proxy sarà in funzione, le schede non cambieranno di una riga, perché
 * leggono la rosa e non l'API.
 *
 * Perché serve un proxy e non si può chiamare l'API dal browser: il CHPP usa
 * OAuth 1.0a, che richiede di firmare ogni richiesta con un "consumer secret".
 * In una pagina statica quel segreto sarebbe leggibile da chiunque, e in più
 * il browser non può interrogare direttamente chpp.hattrick.org perché è
 * un'altra origine. Il segreto resta quindi sul server, dentro server/chpp.php.
 */

import { deposito } from '../lib/deposito.js';

export const SORGENTI = {
  manuale: { id: 'manuale', nome: 'Dati manuali', descrizione: 'I dati li inserisci tu e restano in questo browser.' },
  chpp: { id: 'chpp', nome: 'Hattrick (CHPP)', descrizione: 'I dati arrivano dalla tua squadra su Hattrick.' },
};

export const impostazioni = deposito('sorgente', {
  tipo: 'manuale',
  // indirizzo del proxy sul proprio server, es. "/chpp.php"
  proxy: '',
  collegato: false,
  squadra: null,
  ultimoAggiornamento: null,
});

export const stato = () => {
  const s = impostazioni.leggi();
  return { ...s, sorgente: SORGENTI[s.tipo] ?? SORGENTI.manuale };
};

export const collegato = () => stato().tipo === 'chpp' && stato().collegato;

/** Verifica se il proxy CHPP risponde ed è configurato. */
export async function verificaProxy(indirizzo) {
  if (!indirizzo) throw new Error('Manca l’indirizzo del proxy CHPP.');
  const risposta = await fetch(`${indirizzo}?azione=stato`, { credentials: 'same-origin' });
  if (!risposta.ok) throw new Error(`Il proxy ha risposto ${risposta.status}.`);
  return risposta.json();
}

/**
 * Scarica la rosa dalla propria squadra. Finché il proxy non è configurato
 * fallisce in modo esplicito, invece di restituire dati finti.
 */
export async function scaricaRosa() {
  const s = stato();
  if (s.tipo !== 'chpp') throw new Error('La sorgente dati è impostata su inserimento manuale.');
  if (!s.proxy) throw new Error('Manca l’indirizzo del proxy CHPP.');
  const risposta = await fetch(`${s.proxy}?azione=rosa`, { credentials: 'same-origin' });
  if (!risposta.ok) throw new Error(`Il proxy ha risposto ${risposta.status}.`);
  return risposta.json();
}
