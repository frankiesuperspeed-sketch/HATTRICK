/**
 * Settore giovanile: quanto stanno crescendo i giovani e quando promuoverli.
 *
 * Il potenziale di un giovane in Hattrick non è calcolabile da fuori: quello
 * che gli scout rivelano lo inserisci tu, e non viene inventato. Quello che
 * questa scheda calcola davvero sono due cose verificabili:
 *
 *  - la crescita misurata sulle letture che registri, e da lì quando un
 *    giovane raggiungerà un livello obiettivo;
 *  - il confronto con la prima squadra, che è il segnale di promozione più
 *    solido: un giovane è pronto quando è già meglio di chi gioca adesso.
 */

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? NaN : Number(v));
const oZero = (v) => (Number.isFinite(num(v)) ? num(v) : 0);

export const PARAMETRI_PREDEFINITI = {
  // età entro cui un giovane va promosso o perso
  etaMassima: 19,
  settimanePerStagione: 16,
  // di quanto deve superare un titolare per dirsi "pronto"
  margineDiPromozione: 0,
};

/**
 * Crescita misurata su una serie di letture ordinate nel tempo.
 * @param {{settimana:number, livello:number}[]} letture
 */
export function crescitaMisurata(letture = []) {
  const punti = letture
    .map((l) => ({ settimana: num(l?.settimana), livello: num(l?.livello) }))
    .filter((l) => Number.isFinite(l.settimana) && Number.isFinite(l.livello))
    .sort((a, b) => a.settimana - b.settimana);

  if (punti.length < 2) {
    return { perSettimana: null, letture: punti.length, primo: punti[0] ?? null, ultimo: punti[punti.length - 1] ?? null };
  }

  const primo = punti[0];
  const ultimo = punti[punti.length - 1];
  const settimane = ultimo.settimana - primo.settimana;
  const perSettimana = settimane > 0 ? (ultimo.livello - primo.livello) / settimane : null;
  return { perSettimana, letture: punti.length, primo, ultimo, settimaneOsservate: settimane };
}

/** Settimane per arrivare da un livello a un altro, alla crescita misurata. */
export function settimaneAlLivello({ corrente, obiettivo, perSettimana }) {
  const da = num(corrente), a = num(obiettivo), v = num(perSettimana);
  if (!Number.isFinite(da) || !Number.isFinite(a) || !Number.isFinite(v)) return null;
  if (a <= da) return 0;
  if (!(v > 0)) return null;
  return (a - da) / v;
}

/**
 * Chi, in prima squadra e nello stesso ruolo, il giovane supererebbe già.
 * È il confronto che rende la promozione una decisione e non una scommessa.
 */
export function confrontaConRosa({ giovane, rosa = [], abilita, margine = 0 }) {
  const livello = num(giovane?.abilita?.[abilita]);
  if (!Number.isFinite(livello)) return { livello: null, meglioDi: [], peggioDi: [], titolari: 0 };

  const stessoRuolo = rosa.filter((g) => g.ruolo === giovane.ruolo);
  const conLivello = stessoRuolo
    .map((g) => ({ nome: g.nome, livello: num(g.abilita?.[abilita]) }))
    .filter((g) => Number.isFinite(g.livello));

  return {
    livello,
    titolari: conLivello.length,
    meglioDi: conLivello.filter((g) => livello > g.livello + oZero(margine)).sort((a, b) => b.livello - a.livello),
    peggioDi: conLivello.filter((g) => livello <= g.livello + oZero(margine)).sort((a, b) => b.livello - a.livello),
  };
}

/** Quadro di un singolo giovane. */
export function valutaGiovane({ giovane, rosa = [], abilita, storico = [], parametri = PARAMETRI_PREDEFINITI }) {
  const p = { ...PARAMETRI_PREDEFINITI, ...parametri };
  const crescita = crescitaMisurata(storico);
  const confronto = confrontaConRosa({ giovane, rosa, abilita, margine: p.margineDiPromozione });

  const eta = num(giovane?.eta);
  const anniRimasti = Number.isFinite(eta) ? oZero(p.etaMassima) - eta : null;
  const settimaneRimaste = anniRimasti == null ? null : Math.max(0, anniRimasti * Math.max(1, oZero(p.settimanePerStagione)));

  const potenziale = num(giovane?.potenziale);
  const settimaneAlPotenziale = Number.isFinite(potenziale)
    ? settimaneAlLivello({ corrente: confronto.livello, obiettivo: potenziale, perSettimana: crescita.perSettimana })
    : null;

  const motivi = [];
  if (confronto.meglioDi.length) motivi.push(`è già meglio di ${confronto.meglioDi.map((g) => g.nome).join(', ')}`);
  if (settimaneRimaste != null && settimaneRimaste <= Math.max(1, oZero(p.settimanePerStagione))) {
    motivi.push('sta per superare l’età massima');
  }

  return {
    giovane,
    abilita,
    livello: confronto.livello,
    crescita,
    confronto,
    potenziale: Number.isFinite(potenziale) ? potenziale : null,
    settimaneAlPotenziale,
    anniRimasti,
    settimaneRimaste,
    pronto: motivi.length > 0,
    motivi,
    // quanto gli manca per superare il peggiore dei titolari
    mancanoLivelli: confronto.peggioDi.length && Number.isFinite(confronto.livello)
      ? Math.max(0, confronto.peggioDi[confronto.peggioDi.length - 1].livello - confronto.livello)
      : 0,
  };
}

/** Quadro di tutto il vivaio, con i pronti davanti. */
export function analizzaVivaio({ giovani = [], rosa = [], storico = {}, abilitaDi, parametri = PARAMETRI_PREDEFINITI }) {
  const righe = giovani
    .filter((g) => g && String(g.nome ?? '').trim() !== '')
    .map((g) => valutaGiovane({
      giovane: g, rosa, abilita: abilitaDi(g), storico: storico[g.id] ?? [], parametri,
    }));

  return {
    righe: righe.sort((a, b) => Number(b.pronto) - Number(a.pronto) || (b.livello ?? -1) - (a.livello ?? -1)),
    pronti: righe.filter((r) => r.pronto),
    inScadenza: righe.filter((r) => r.settimaneRimaste != null && r.settimaneRimaste <= Math.max(1, oZero(parametri.settimanePerStagione ?? 16))),
    senzaLivello: righe.filter((r) => r.livello == null).map((r) => r.giovane.nome),
  };
}
