#!/usr/bin/env bash
#
# Pubblica il sito su un server via SSH, dal proprio computer.
#
#   ./scripts/pubblica.sh utente@server:/var/www/hattrick
#   ./scripts/pubblica.sh utente@server:/var/www/hattrick --porta 2222
#   ./scripts/pubblica.sh utente@server:/var/www/hattrick --si     (senza conferma)
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
echo "✓ Fatto."
