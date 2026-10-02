/**
 * La rosa è il dato condiviso dell'app: una sola lista di giocatori che tutte
 * le schede leggono e scrivono. Qui vivono il modello, i ruoli e il deposito.
 */

import { deposito } from '../lib/deposito.js';

export const RUOLI = [
  { id: 'portiere',      nome: 'Portiere',      breve: 'POR' },
  { id: 'difensore',     nome: 'Difensore',     breve: 'DIF' },
  { id: 'terzino',       nome: 'Terzino',       breve: 'TER' },
  { id: 'centrocampista',nome: 'Centrocampista',breve: 'CEN' },
  { id: 'ala',           nome: 'Ala',           breve: 'ALA' },
  { id: 'attaccante',    nome: 'Attaccante',    breve: 'ATT' },
];

export const ABILITA = [
  { id: 'portiere',   nome: 'Parate' },
  { id: 'difesa',     nome: 'Difesa' },
  { id: 'regia',      nome: 'Regia' },
  { id: 'passaggi',   nome: 'Passaggi' },
  { id: 'cross',      nome: 'Cross' },
  { id: 'attacco',    nome: 'Attacco' },
  { id: 'punizioni',  nome: 'Punizioni' },
  { id: 'resistenza', nome: 'Resistenza' },
];

export const SPECIALITA = [
  { id: '', nome: 'Nessuna' },
  { id: 'veloce', nome: 'Veloce' },
  { id: 'tecnico', nome: 'Tecnico' },
  { id: 'potente', nome: 'Potente' },
  { id: 'imprevedibile', nome: 'Imprevedibile' },
  { id: 'testa', nome: 'Colpo di testa' },
  { id: 'resistente', nome: 'Resistente' },
];

let contatore = 0;
const nuovoId = () => `g${Date.now().toString(36)}${(contatore++).toString(36)}`;

/** Giocatore completo: i campi non ancora inseriti restano a null, non a zero. */
export function creaGiocatore(parziale = {}) {
  return {
    id: parziale.id ?? nuovoId(),
    nome: parziale.nome ?? '',
    ruolo: parziale.ruolo ?? 'centrocampista',
    eta: parziale.eta ?? 20,
    stipendio: parziale.stipendio ?? 0,
    abilita: Object.fromEntries(ABILITA.map((a) => [a.id, parziale.abilita?.[a.id] ?? null])),
    esperienza: parziale.esperienza ?? null,
    forma: parziale.forma ?? null,
    condizione: parziale.condizione ?? null,
    specialita: parziale.specialita ?? '',
    valore: parziale.valore ?? null,
    note: parziale.note ?? '',
  };
}

export const rosa = deposito('rosa', { giocatori: [], valuta: '€' });

export const giocatori = () => rosa.leggi().giocatori;

export function aggiungiGiocatore(parziale) {
  const g = creaGiocatore(parziale);
  rosa.modifica((s) => { s.giocatori.push(g); });
  return g;
}

export function rimuoviGiocatore(id) {
  rosa.modifica((s) => { s.giocatori = s.giocatori.filter((g) => g.id !== id); });
}

export function modificaGiocatore(id, campi) {
  rosa.modifica((s) => {
    const g = s.giocatori.find((x) => x.id === id);
    if (g) Object.assign(g, campi);
  });
}

export const nomeRuolo = (id) => RUOLI.find((r) => r.id === id)?.nome ?? id;
export const breveRuolo = (id) => RUOLI.find((r) => r.id === id)?.breve ?? '?';
