/**
 * Arena: quanti posti servono, quanto costa costruirli, quanto rendono.
 *
 * ⚠️ I numeri di gioco (costo per posto, manutenzione, prezzo del biglietto,
 * percentuali di affluenza per settore) non sono pubblicati da Hattrick in
 * forma ufficiale: quelli qui sotto sono le STIME usate dalla comunità, nella
 * forma consolidata dal tool "Enterprise Construction Online" di nrgjack. Sono
 * dichiarate, modificabili e passate da fuori a ogni funzione, come in tutte
 * le altre schede.
 *
 * Il modello in breve:
 *   affluenza attesa = tifosi × coefficiente(umore)
 *   posti consigliati = affluenza attesa × sovradimensionamento
 *   i posti si dividono fra i quattro settori con le percentuali di affluenza
 *   il costo è una quota fissa più il costo dei posti aggiunti (o smantellati)
 */

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? NaN : Number(v));
const oZero = (v) => (Number.isFinite(num(v)) ? num(v) : 0);
const positivo = (v) => Math.max(0, oZero(v));

/* ------------------------------------------------------------- settori */

export const SETTORI = [
  { id: 'gradinate', nome: 'Gradinate', chpp: 'Terraces' },
  { id: 'tribune', nome: 'Tribune', chpp: 'Basic' },
  { id: 'coperte', nome: 'Tribune coperte', chpp: 'Roof' },
  { id: 'vip', nome: 'Poltrone VIP', chpp: 'VIP' },
];

export const nomeSettore = (id) => SETTORI.find((s) => s.id === id)?.nome ?? id;

/* ---------------------------------------------------- parametri di gioco */

/** Costo di costruzione di un posto, per settore. Stima. */
export const COSTO_POSTO = { gradinate: 45, tribune: 75, coperte: 90, vip: 300 };

/** Manutenzione settimanale di un posto, per settore. Stima. */
export const MANUTENZIONE_POSTO = { gradinate: 0.5, tribune: 0.7, coperte: 1, vip: 2.5 };

/** Prezzo del biglietto, per settore. Stima. */
export const PREZZO_BIGLIETTO = { gradinate: 7, tribune: 10, coperte: 19, vip: 35 };

/** Spesa fissa di apertura dei lavori, indipendente dai posti. Stima. */
export const COSTO_FISSO = 10000;

/** Costo di smantellamento di un posto, uguale per tutti i settori. Stima. */
export const COSTO_SMANTELLAMENTO = 6;

/** Lo stadio con cui si parte in Hattrick. */
export const ARENA_INIZIALE = { gradinate: 8000, tribune: 3000, coperte: 1000, vip: 0 };

export const PARAMETRI_PREDEFINITI = {
  costi: { ...COSTO_POSTO },
  manutenzioni: { ...MANUTENZIONE_POSTO },
  prezzi: { ...PREZZO_BIGLIETTO },
  costoFisso: COSTO_FISSO,
  costoSmantellamento: COSTO_SMANTELLAMENTO,
};

/* ------------------------------------------------------------ affluenza */

/**
 * Percentuali di affluenza per settore, cioè come si distribuiscono gli
 * spettatori che vengono allo stadio. Tre letture dello stesso fenomeno.
 */
export const PROFILI = [
  {
    id: 'media',
    nome: 'Medie',
    sovradimensionamento: 112,
    percentuali: { gradinate: 59.3819, tribune: 23.7881, coperte: 14.497, vip: 2.333 },
    descrizione:
      'Le percentuali di affluenza media. Costi di costruzione e manutenzione più bassi, ' +
      'ma con sole o pioggia forti qualche settore andrà esaurito e perderai quegli incassi. ' +
      'Con queste percentuali si consiglia un sovradimensionamento del 12 %.',
  },
  {
    id: 'nrg',
    nome: 'NRG',
    sovradimensionamento: 125,
    percentuali: { gradinate: 56.5, tribune: 23, coperte: 18, vip: 2.5 },
    descrizione:
      'Un compromesso fra le medie e le massime: cerca il miglior rapporto fra costi e ' +
      'biglietti venduti tenendo conto di quanto spesso capita il meteo estremo. ' +
      'Funzionano bene con stadi sovradimensionati del 25 %.',
  },
  {
    id: 'massima',
    nome: 'Massime',
    sovradimensionamento: 135,
    percentuali: { gradinate: 52.79, tribune: 22.92, coperte: 22.28, vip: 2.01 },
    descrizione:
      'Le percentuali di affluenza massima, misurate su stadi grandi. L’idea è che vendere ' +
      'quei posti anche una o due volte per stagione ripaghi costruzione e manutenzione. ' +
      'Valgono quando lo stadio è sovradimensionato del 35 % o più.',
  },
];

export const profilo = (id) => PROFILI.find((p) => p.id === id) ?? PROFILI[1];

/** L'umore dei tifosi come lo scrive Hattrick, dal peggiore al migliore. */
export const UMORI = [
  'inferociti', 'furiosi', 'arrabbiati', 'irritati', 'delusi', 'calmi',
  'contenti', 'soddisfatti', 'in delirio', 'sulle stelle', 'danzano per le strade',
  'mandano poesie d’amore',
];

export const UMORE_MASSIMO = UMORI.length - 1;

/**
 * Quanti spettatori porta allo stadio ogni tifoso del club, in base all'umore.
 * Retta ricavata dalle affluenze osservate: a umore 0 circa 8,9 spettatori per
 * tifoso, a umore 11 circa 21,7.
 */
export function coefficienteAffluenza(umore) {
  const u = Math.min(UMORE_MASSIMO, Math.max(0, oZero(umore)));
  return 8.929 + 1.1606 * u;
}

/** Posti consigliati: affluenza attesa più il margine di sovradimensionamento. */
export function dimensioneSuggerita({ tifosi, umore, sovradimensionamento = 125 }) {
  const coefficiente = coefficienteAffluenza(umore);
  const margine = positivo(sovradimensionamento) / 100 || 1;
  const t = positivo(tifosi);
  return {
    coefficiente,
    coefficienteEffettivo: Math.round(coefficiente * margine * 100) / 100,
    affluenzaAttesa: Math.round(coefficiente * t),
    suggerita: Math.round(coefficiente * t * margine),
  };
}

/* ---------------------------------------------------------- ripartizione */

/**
 * Divide i posti fra i settori secondo le percentuali, senza perderne né
 * inventarne: ogni settore prende la sua parte intera, e i posti avanzati
 * vanno a chi è stato arrotondato per difetto di più (metodo dei resti).
 */
export function distribuisci(totale, percentuali = {}) {
  const t = Math.round(positivo(totale));
  const somma = SETTORI.reduce((acc, s) => acc + positivo(percentuali[s.id]), 0);
  if (!t || !somma) return Object.fromEntries(SETTORI.map((s) => [s.id, 0]));

  const voci = SETTORI.map((s) => {
    const esatto = (t * positivo(percentuali[s.id])) / somma;
    return { id: s.id, esatto, posti: Math.floor(esatto) };
  });

  let avanzo = t - voci.reduce((acc, v) => acc + v.posti, 0);
  const perResto = [...voci].sort((a, b) => b.esatto - b.posti - (a.esatto - a.posti));
  for (let i = 0; avanzo > 0; i++, avanzo--) perResto[i % perResto.length].posti += 1;

  return Object.fromEntries(voci.map((v) => [v.id, v.posti]));
}

/* ------------------------------------------------------------- progetto */

/** Giorni di lavori: una base fissa più il tempo che costa la spesa. */
export const giorniLavori = (costo) => (positivo(costo) > 0 ? 7 + Math.round(positivo(costo) / 1e5) : 0);

/**
 * Il progetto completo: posti per settore, lavori da fare, costi, tempi,
 * manutenzione e incassi.
 *
 * Con `smantella` a false i settori già più grandi del necessario restano
 * come sono: si costruisce solo ciò che manca, quindi il totale finale può
 * superare l'obiettivo.
 */
export function progettaArena({
  attuale = {},
  obiettivo = 0,
  percentuali = PROFILI[1].percentuali,
  smantella = false,
  affluenza = null,
  partiteCasa = 7,
  settimanePerStagione = 16,
  parametri = PARAMETRI_PREDEFINITI,
} = {}) {
  const p = { ...PARAMETRI_PREDEFINITI, ...parametri };
  const voluti = distribuisci(obiettivo, percentuali);

  const righe = SETTORI.map((s) => {
    const prima = Math.round(positivo(attuale[s.id]));
    const chiesti = voluti[s.id];
    const posti = !smantella && chiesti < prima ? prima : chiesti;
    return { id: s.id, nome: s.nome, attuale: prima, posti, delta: posti - prima };
  });

  const totale = righe.reduce((acc, r) => acc + r.posti, 0);
  const totaleAttuale = righe.reduce((acc, r) => acc + r.attuale, 0);

  const costruzione = righe.reduce((acc, r) => acc + (r.delta > 0 ? r.delta * oZero(p.costi[r.id]) : 0), 0);
  const smantellamento = righe.reduce((acc, r) => acc + (r.delta < 0 ? -r.delta * oZero(p.costoSmantellamento) : 0), 0);
  const lavori = costruzione + smantellamento;
  // la quota fissa si paga solo se i lavori si fanno davvero
  const costoTotale = lavori > 0 ? oZero(p.costoFisso) + lavori : 0;

  const manutenzione = righe.reduce((acc, r) => acc + r.posti * oZero(p.manutenzioni[r.id]), 0);
  const manutenzioneAttuale = righe.reduce((acc, r) => acc + r.attuale * oZero(p.manutenzioni[r.id]), 0);

  const incassoMassimo = righe.reduce((acc, r) => acc + r.posti * oZero(p.prezzi[r.id]), 0);

  // scostamento fra la percentuale ottenuta e quella scelta: dice quando il
  // progetto non rispetta più il profilo (tipico se non si smantella)
  const sommaPercentuali = SETTORI.reduce((acc, s) => acc + positivo(percentuali[s.id]), 0) || 100;
  const dettaglio = righe.map((r) => {
    const voluta = (positivo(percentuali[r.id]) / sommaPercentuali) * 100;
    const finale = totale ? (r.posti / totale) * 100 : 0;
    return {
      ...r,
      percentualeVoluta: voluta,
      percentuale: finale,
      scostamento: voluta ? Math.abs(finale / voluta - 1) : 0,
      prezzo: oZero(p.prezzi[r.id]),
      manutenzione: r.posti * oZero(p.manutenzioni[r.id]),
      incassoMassimo: r.posti * oZero(p.prezzi[r.id]),
    };
  });

  const spettatori = affluenza == null ? null : positivo(affluenza);
  const incasso = spettatori == null
    ? null
    : incassoAtteso({ righe: dettaglio, affluenza: spettatori, percentuali, prezzi: p.prezzi });
  const incassoPrima = spettatori == null
    ? null
    : incassoAtteso({
        righe: dettaglio.map((r) => ({ ...r, posti: r.attuale })),
        affluenza: spettatori, percentuali, prezzi: p.prezzi,
      });

  const partite = positivo(partiteCasa);
  const settimane = positivo(settimanePerStagione) || 16;
  const perSettimana = incasso ? (incasso.totale * partite) / settimane - manutenzione : null;
  const guadagnoSettimanale = incasso && incassoPrima
    ? ((incasso.totale - incassoPrima.totale) * partite) / settimane - (manutenzione - manutenzioneAttuale)
    : null;

  return {
    righe: dettaglio,
    totale,
    totaleAttuale,
    daCostruire: dettaglio.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0),
    daSmantellare: dettaglio.reduce((acc, r) => acc + (r.delta < 0 ? -r.delta : 0), 0),
    costi: { fisso: lavori > 0 ? oZero(p.costoFisso) : 0, costruzione, smantellamento, totale: costoTotale },
    giorni: giorniLavori(costoTotale),
    manutenzione,
    manutenzioneAttuale,
    incassoMassimo,
    incasso,
    incassoPrima,
    saldoSettimanale: perSettimana,
    guadagnoSettimanale,
    rientro: rientro({ costo: costoTotale, guadagnoSettimanale }),
  };
}

/**
 * Incasso di una partita: gli spettatori si distribuiscono fra i settori con
 * le stesse percentuali di affluenza, e chi trova il settore pieno resta fuori.
 */
export function incassoAtteso({ righe = [], affluenza = 0, percentuali = {}, prezzi = PREZZO_BIGLIETTO }) {
  const spettatori = positivo(affluenza);
  const somma = SETTORI.reduce((acc, s) => acc + positivo(percentuali[s.id]), 0) || 100;

  const dettaglio = righe.map((r) => {
    const attesi = (spettatori * positivo(percentuali[r.id])) / somma;
    const venduti = Math.min(attesi, positivo(r.posti));
    return {
      id: r.id,
      nome: r.nome ?? nomeSettore(r.id),
      attesi,
      venduti,
      fuori: Math.max(0, attesi - venduti),
      pieno: attesi > positivo(r.posti) + 0.5,
      ricavo: venduti * oZero(prezzi[r.id]),
    };
  });

  return {
    righe: dettaglio,
    venduti: dettaglio.reduce((acc, r) => acc + r.venduti, 0),
    fuori: dettaglio.reduce((acc, r) => acc + r.fuori, 0),
    totale: dettaglio.reduce((acc, r) => acc + r.ricavo, 0),
  };
}

/** Settimane per ripagare i lavori col guadagno che portano. */
export function rientro({ costo, guadagnoSettimanale }) {
  const c = positivo(costo);
  const g = num(guadagnoSettimanale);
  if (!c) return { settimane: 0, possibile: true };
  if (!Number.isFinite(g) || g <= 0) return { settimane: null, possibile: false };
  return { settimane: c / g, possibile: true };
}

/* -------------------------------------------------------------- avvisi */

/** Quello che vale la pena dire ad alta voce prima di aprire il cantiere. */
export function avvisiArena({ progetto, cassa = null, obiettivo = null, smantella = false }) {
  const avvisi = [];
  if (!progetto) return avvisi;

  // una cassa a zero quasi sempre vuol dire "non l'ho ancora scritta":
  // avvisare lì sarebbe rumore, e il confronto resta comunque sotto gli occhi
  const soldi = num(cassa);
  if (progetto.costi.totale > 0 && Number.isFinite(soldi) && soldi > 0 && soldi < progetto.costi.totale) {
    avvisi.push({
      tipo: 'cassa',
      testo: 'La cassa non copre i lavori: riduci i posti, procedi in due tappe o rimanda l’inizio.',
    });
  }

  const nomi = (righe) => righe.map((r) => r.nome.toLowerCase()).join(', ');
  const scostati = progetto.righe.filter((r) => r.scostamento > 0.05);
  const dimensioneDiversa = obiettivo != null && !smantella
    && progetto.totale !== Math.round(positivo(obiettivo));

  // il totale che non torna e le percentuali fuori profilo hanno la stessa
  // causa: si dicono insieme, una volta sola
  if (dimensioneDiversa) {
    avvisi.push({
      tipo: 'dimensione',
      testo: 'Qualche settore è già più grande del necessario. Con lo smantellamento disattivato si costruisce '
        + 'solo ciò che manca, quindi la capienza finale supera quella che hai chiesto'
        + (scostati.length ? `, e questi settori restano fuori profilo: ${nomi(scostati)}.` : '.'),
    });
  } else if (scostati.length) {
    avvisi.push({
      tipo: 'percentuali',
      testo: `Le percentuali finali si allontanano da quelle scelte di più del 5 % in: ${nomi(scostati)}.`,
    });
  }

  if (progetto.daSmantellare > 0 && progetto.totaleAttuale < progetto.totale * 2) {
    avvisi.push({
      tipo: 'smantellamento',
      testo: 'Smantellare conviene solo quando i posti costruiti sono davvero troppi, più o meno il doppio del '
        + 'necessario: il risparmio settimanale non copre la demolizione più il riampliamento che servirà quando i tifosi cresceranno.',
    });
  }

  const pieni = progetto.incasso?.righe.filter((r) => r.pieno) ?? [];
  if (pieni.length) {
    avvisi.push({
      tipo: 'pieni',
      testo: `Con questa affluenza resterebbe gente fuori da: ${pieni.map((r) => r.nome.toLowerCase()).join(', ')}.`,
    });
  }

  return avvisi;
}
