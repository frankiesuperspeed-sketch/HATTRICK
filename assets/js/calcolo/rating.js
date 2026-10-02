/**
 * Conversione tra i nomi verbali di Hattrick e i numeri.
 *
 * ⚠️ La scala qui sotto è il punto di partenza, NON una verità: i nomi
 * cambiano con la lingua e con le versioni del gioco. Sono tutti
 * modificabili dall'interfaccia e salvati nel browser, e ogni funzione di
 * questo modulo riceve la scala da fuori: così, se correggi un nome, tutto
 * il resto si adegua da solo.
 */

export const SCALA_PREDEFINITA = [
  'inesistente', 'disastroso', 'tremendo', 'scarso', 'debole', 'insufficiente',
  'accettabile', 'buono', 'eccellente', 'formidabile', 'straordinario',
  'splendido', 'magnifico', 'fuoriclasse', 'sovrannaturale', 'titanico',
  'extraterrestre', 'mitico', 'magico', 'utopico', 'divino',
];

export const SOTTOLIVELLI_PREDEFINITI = ['molto basso', 'basso', 'alto', 'molto alto'];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : NaN);

/** Minuscolo, senza accenti né punteggiatura: per confrontare quello che scrivi. */
export function normalizza(testo) {
  return String(testo ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[()\[\],.;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Livello + sottolivello → numero. Con 4 sottolivelli: 8, 8.25, 8.5, 8.75. */
export function aNumero({ livello, sottolivello = 0, quantiSottolivelli = 4 }) {
  const l = num(livello);
  const s = num(sottolivello);
  const q = Math.max(1, Math.round(num(quantiSottolivelli)) || 1);
  if (!Number.isFinite(l)) return null;
  const indice = Number.isFinite(s) ? Math.min(q - 1, Math.max(0, s)) : 0;
  return l + indice / q;
}

/** Numero → livello, sottolivello e nomi corrispondenti. */
export function daNumero(valore, { scala = SCALA_PREDEFINITA, sottolivelli = SOTTOLIVELLI_PREDEFINITI } = {}) {
  const v = num(valore);
  if (!Number.isFinite(v) || v < 0) return null;
  const q = Math.max(1, sottolivelli.length);
  const livello = Math.floor(v + 1e-9);
  const resto = v - livello;
  const sottolivello = Math.min(q - 1, Math.max(0, Math.round(resto * q - 1e-9)));
  return {
    livello,
    sottolivello,
    nome: scala[livello] ?? null,
    nomeSottolivello: sottolivelli[sottolivello] ?? null,
    valore: livello + sottolivello / q,
    fuoriScala: livello >= scala.length,
  };
}

/**
 * Interpreta quello che scrivi: "eccellente", "buono (molto alto)",
 * "formidabile basso", "8,5" o "8.75". Restituisce null se non capisce.
 */
export function interpreta(testo, { scala = SCALA_PREDEFINITA, sottolivelli = SOTTOLIVELLI_PREDEFINITI } = {}) {
  // il numero va riconosciuto prima di ripulire la punteggiatura, altrimenti
  // la virgola o il punto decimale verrebbero spazzati via insieme al resto
  const grezzo = String(testo ?? '').trim().replace(/(\d),(\d)/g, '$1.$2');
  if (/^\d+(\.\d+)?$/.test(grezzo)) return daNumero(Number(grezzo), { scala, sottolivelli });

  const pulito = normalizza(grezzo);
  if (!pulito) return null;

  const scalaNorm = scala.map(normalizza);
  const sottoNorm = sottolivelli.map(normalizza);

  // il nome più lungo che combacia vince: "molto alto" prima di "alto"
  const perLunghezza = (elenco) => elenco.map((n, i) => ({ n, i })).sort((a, b) => b.n.length - a.n.length);

  const livelloTrovato = perLunghezza(scalaNorm).find(({ n }) => n && (pulito === n || pulito.startsWith(n + ' ') || pulito.endsWith(' ' + n) || pulito.includes(' ' + n + ' ')));
  if (!livelloTrovato) return null;

  const resto = pulito.replace(livelloTrovato.n, ' ').replace(/\s+/g, ' ').trim();
  const sottoTrovato = resto ? perLunghezza(sottoNorm).find(({ n }) => n && resto.includes(n)) : null;
  const sottolivello = sottoTrovato ? sottoTrovato.i : 0;

  return {
    livello: livelloTrovato.i,
    sottolivello,
    nome: scala[livelloTrovato.i],
    nomeSottolivello: sottolivelli[sottolivello] ?? null,
    valore: aNumero({ livello: livelloTrovato.i, sottolivello, quantiSottolivelli: sottolivelli.length }),
    fuoriScala: false,
  };
}

/** Testo completo di un rating: "eccellente (molto alto)". */
export function perEsteso(r, { conSottolivello = true } = {}) {
  if (!r || !r.nome) return '—';
  return conSottolivello && r.nomeSottolivello ? `${r.nome} (${r.nomeSottolivello})` : r.nome;
}

/** Tutta la scala, livello per livello, con i valori di ogni sottolivello. */
export function tabellaRiferimento({ scala = SCALA_PREDEFINITA, sottolivelli = SOTTOLIVELLI_PREDEFINITI } = {}) {
  return scala.map((nome, livello) => ({
    livello,
    nome,
    valori: sottolivelli.map((nomeSotto, i) => ({
      sottolivello: i,
      nomeSottolivello: nomeSotto,
      valore: aNumero({ livello, sottolivello: i, quantiSottolivelli: sottolivelli.length }),
    })),
  }));
}
