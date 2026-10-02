/**
 * Deposito reattivo su localStorage: le schede si iscrivono e si ridisegnano
 * da sole quando i dati cambiano, da qualunque scheda arrivi la modifica.
 */

const PREFISSO = 'hattrick:';

function leggi(chiave, difetto) {
  try {
    const grezzo = localStorage.getItem(PREFISSO + chiave);
    if (!grezzo) return structuredClone(difetto);
    return fondi(structuredClone(difetto), JSON.parse(grezzo));
  } catch {
    // localStorage può essere negato (finestra privata, cookie bloccati):
    // l'app deve funzionare lo stesso, solo senza ricordare i dati.
    return structuredClone(difetto);
  }
}

function scrivi(chiave, valore) {
  try { localStorage.setItem(PREFISSO + chiave, JSON.stringify(valore)); } catch { /* niente persistenza */ }
}

/** I valori salvati coprono i difetti, ma un difetto nuovo non va perso. */
function fondi(base, extra) {
  if (Array.isArray(extra) || extra === null || typeof extra !== 'object') return extra;
  if (Array.isArray(base) || base === null || typeof base !== 'object') return extra;
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) out[k] = fondi(base[k], v);
  return out;
}

export function deposito(chiave, difetto) {
  let stato = leggi(chiave, difetto);
  const ascoltatori = new Set();

  const avvisa = () => { scrivi(chiave, stato); ascoltatori.forEach((fn) => fn(stato)); };

  return {
    leggi: () => stato,
    /** modifica(s => { s.campo = valore }) */
    modifica(fn) { fn(stato); avvisa(); },
    sostituisci(nuovo) { stato = nuovo; avvisa(); },
    azzera() { stato = structuredClone(difetto); avvisa(); },
    /** Restituisce la funzione per smettere di ascoltare. */
    ascolta(fn) { ascoltatori.add(fn); return () => ascoltatori.delete(fn); },
  };
}
