#!/usr/bin/env bash
#
# Pubblica il sito su un server via SSH, dal proprio computer.
#
#   ./scripts/pubblica.sh utente@besttoolbox.de:/var/www/hattrick
#   ./scripts/pubblica.sh utente@besttoolbox.de:/var/www/hattrick --porta 2222
#   ./scripts/pubblica.sh utente@besttoolbox.de:/var/www/hattrick --si  (senza conferma)
#
# Esegue i test, prepara i file, mostra in anteprima cosa verrebbe aggiunto,
# aggiornato e CANCELLATO, e chiede conferma prima di scrivere.
#
# La cartella di destinazione deve contenere il solo sito Hattrick: ciò che si
# trova lì e non è nel repository viene rimosso.

set -euo pipefail

destinazione="${1:-}"
porta=22
conferma=1

shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --porta) porta="${2:?--porta richiede un numero}"; shift 2 ;;
    --si) conferma=0; shift ;;
    *) echo "Opzione sconosciuta: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$destinazione" ]; then
  echo "Uso: $0 utente@server:/percorso/del/sito [--porta N] [--si]" >&2
  exit 2
fi

case "$destinazione" in
  *:/|*:) echo "La destinazione non può essere la radice del server." >&2; exit 2 ;;
  *:*) ;;
  *) echo "La destinazione deve avere la forma utente@server:/percorso" >&2; exit 2 ;;
esac

radice="$(cd "$(dirname "$0")/.." && pwd)"
cd "$radice"

echo "→ Test del motore di calcolo"
npm test --silent >/dev/null

echo "→ Preparazione dei file"
cartella="$(mktemp -d)"
trap 'rm -rf "$cartella"' EXIT
cp index.html "$cartella/"
cp -r assets "$cartella/"

# Un controllo prima di rsync: "Permission denied (13)" non dice quale dei due
# problemi sia, se la cartella manca o se non è scrivibile.
utente_host="${destinazione%%:*}"
cartella_remota="${destinazione#*:}"

echo "→ Controllo della destinazione sul server"
esito="$(ssh -p "$porta" "$utente_host" "
  if [ ! -e '$cartella_remota' ]; then echo manca;
  elif [ ! -d '$cartella_remota' ]; then echo nondirectory;
  elif [ ! -w '$cartella_remota' ]; then echo nonscrivibile;
  else echo ok; fi" 2>/dev/null || echo irraggiungibile)"

case "$esito" in
  ok) ;;
  manca)
    echo >&2
    echo "La cartella '$cartella_remota' non esiste sul server." >&2
    echo "Creala e assegnala al tuo utente, poi rilancia:" >&2
    echo "  ssh -p $porta $utente_host 'sudo mkdir -p $cartella_remota && sudo chown -R \$USER:\$USER $cartella_remota'" >&2
    echo >&2
    echo "Se invece il sito vive altrove, usa quel percorso. Per trovarlo:" >&2
    echo "  ssh -p $porta $utente_host 'apachectl -S 2>/dev/null | grep -i hattrick; nginx -T 2>/dev/null | grep -A3 hattrick'" >&2
    exit 1 ;;
  nondirectory)
    echo "'$cartella_remota' esiste ma non è una cartella." >&2; exit 1 ;;
  nonscrivibile)
    echo >&2
    echo "La cartella '$cartella_remota' esiste ma il tuo utente non può scriverci." >&2
    echo "Assegnala al tuo utente:" >&2
    echo "  ssh -p $porta $utente_host 'sudo chown -R \$USER:\$USER $cartella_remota'" >&2
    exit 1 ;;
  *)
    echo "Non riesco a raggiungere $utente_host via SSH sulla porta $porta." >&2
    echo "Prova prima: ssh -p $porta $utente_host" >&2
    exit 1 ;;
esac

echo "→ Anteprima: ecco cosa succederebbe sul server"
rsync -azi --delete --dry-run -e "ssh -p $porta" "$cartella/" "$destinazione/"

if [ "$conferma" -eq 1 ]; then
  printf '\nProcedo con la pubblicazione? [s/N] '
  read -r risposta
  case "$risposta" in
    s|S|si|SI|Si) ;;
    *) echo "Annullato: il server non è stato modificato."; exit 0 ;;
  esac
fi

echo "→ Pubblicazione"
rsync -az --delete -e "ssh -p $porta" "$cartella/" "$destinazione/"
echo "✓ Fatto: https://hattrick.besttoolbox.de/"
