/**
 * Stipendi e sostenibilità della rosa.
 *
 * Modulo puro: niente DOM, niente costanti di gioco inventate. Gli unici
 * numeri che contano sono quelli che inserisci tu (o che arriveranno dal
 * CHPP): stipendi, entrate settimanali e cassa.
 */

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const positivo = (v) => Math.max(0, num(v));
/** Migliaia separate, fatte a mano: i messaggi devono leggersi uguali
 *  ovunque giri il codice, browser o Node che sia. */
const leggibile = (v) => String(Math.round(Math.abs(num(v)))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const FASCE_ETA = [
  { id: 'giovani',   nome: 'Fino a 20 anni', da: 0,  a: 20 },
  { id: 'maturita',  nome: '21–25 anni',     da: 21, a: 25 },
  { id: 'apice',     nome: '26–29 anni',     da: 26, a: 29 },
  { id: 'veterani',  nome: '30 anni e oltre',da: 30, a: 999 },
];

export const fasciaDi = (eta) => FASCE_ETA.find((f) => num(eta) >= f.da && num(eta) <= f.a) ?? FASCE_ETA[FASCE_ETA.length - 1];

/**
 * `ruoli` arriva da fuori ({id, nome}[]) così questo modulo non dipende dal
 * modello della rosa e resta verificabile da solo.
 *
 * @param {{giocatori:Array, ruoli:Array, entrateSettimanali:number, cassa:number,
 *          orizzonteSettimane:number, sogliaPareto:number}} ingresso
 */
export function analizzaStipendi({
  giocatori = [],
  ruoli = [],
  entrateSettimanali = 0,
  cassa = 0,
  orizzonteSettimane = 16,
  sogliaPareto = 80,
}) {
  const rosa = giocatori.filter((g) => g && String(g.nome ?? '').trim() !== '');
  const totale = rosa.reduce((acc, g) => acc + positivo(g.stipendio), 0);
  const entrate = positivo(entrateSettimanali);
  const margine = entrate - totale;

  // chi pesa di più, con quota e cumulata (regola 80/20)
  const soglia = Math.min(100, Math.max(1, num(sogliaPareto) || 80)) / 100;
  let corrente = 0;
  let quantiPesano = 0;
  const ordinati = [...rosa].sort((a, b) => positivo(b.stipendio) - positivo(a.stipendio)).map((g) => {
    const quota = totale > 0 ? positivo(g.stipendio) / totale : 0;
    const precedente = corrente;
    corrente += quota;
    const dentroPareto = precedente < soglia && positivo(g.stipendio) > 0;
    if (dentroPareto) quantiPesano += 1;
    return { ...g, quota, cumulata: corrente, dentroPareto };
  });

  const perGruppo = (chiave, elenco) => elenco.map((voce) => {
    const dentro = rosa.filter((g) => chiave(g) === voce.id);
    const somma = dentro.reduce((acc, g) => acc + positivo(g.stipendio), 0);
    return {
      id: voce.id,
      nome: voce.nome,
      numero: dentro.length,
      totale: somma,
      medio: dentro.length ? somma / dentro.length : 0,
      quota: totale > 0 ? somma / totale : 0,
    };
  });

  // la proiezione di cassa serve a rispondere a "per quanto reggo così"
  const orizzonte = Math.max(1, Math.round(positivo(orizzonteSettimane) || 16));
  const proiezione = [];
  let saldo = num(cassa);
  let settimanaRottura = null;
  for (let w = 1; w <= orizzonte; w++) {
    saldo += margine;
    proiezione.push({ settimana: w, cassa: saldo });
    if (settimanaRottura === null && saldo < 0) settimanaRottura = w;
  }
  const autonomia = margine < 0 ? num(cassa) / -margine : null;

  return {
    numero: rosa.length,
    totale,
    medio: rosa.length ? totale / rosa.length : 0,
    entrate,
    margine,
    incidenza: entrate > 0 ? totale / entrate : null,
    ordinati,
    pareto: { soglia, quanti: quantiPesano, giocatori: ordinati.filter((g) => g.dentroPareto) },
    perRuolo: perGruppo((g) => g.ruolo, ruoli),
    perFasciaEta: perGruppo((g) => fasciaDi(g.eta).id, FASCE_ETA),
    proiezione,
    settimanaRottura,
    autonomiaSettimane: autonomia,
    cassa: num(cassa),
    avvisi: avvisi({ rosa, totale, entrate, margine, autonomia, ordinati }),
  };
}

/** Quanto cambierebbe il quadro cedendo questi giocatori. */
export function senzaGiocatori({ giocatori, ids, entrateSettimanali }) {
  const restano = giocatori.filter((g) => !ids.includes(g.id));
  const risparmio = giocatori.filter((g) => ids.includes(g.id)).reduce((a, g) => a + positivo(g.stipendio), 0);
  const totale = restano.reduce((a, g) => a + positivo(g.stipendio), 0);
  return { risparmio, totale, margine: positivo(entrateSettimanali) - totale, rimasti: restano.length };
}

function avvisi({ rosa, totale, entrate, margine, autonomia, ordinati }) {
  const out = [];
  if (!rosa.length) {
    out.push({ tono: 'attenzione', testo: 'Aggiungi i giocatori della rosa con il loro stipendio per vedere il quadro.' });
    return out;
  }
  if (entrate <= 0) {
    out.push({ tono: 'attenzione', testo: 'Inserisci le entrate settimanali: senza, non si può dire se la rosa è sostenibile.' });
  } else if (margine < 0) {
    out.push({ tono: 'critico', testo: `Gli stipendi superano le entrate di ${leggibile(margine)} a settimana.` });
    if (autonomia != null && autonomia < 52) {
      out.push({ tono: 'critico', testo: `Con la cassa attuale reggi ancora ${leggibile(autonomia)} settimane.` });
    }
  } else if (totale / entrate > 0.9) {
    out.push({ tono: 'attenzione', testo: 'Gli stipendi assorbono oltre il 90% delle entrate: resta poco per tutto il resto.' });
  }
  const primo = ordinati[0];
  if (primo && totale > 0 && primo.quota >= 0.25) {
    out.push({ tono: 'attenzione', testo: `${primo.nome} da solo vale il ${Math.round(primo.quota * 100)}% del monte stipendi.` });
  }
  return out;
}
