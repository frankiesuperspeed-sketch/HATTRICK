#!/usr/bin/env bash
#
# Pubblica il sito SUL SERVER DOVE VIENE ESEGUITO, copiando i file dal
# repository alla cartella servita dal web server.
#
#   ./scripts/pubblica-locale.sh /var/www/hattrick
#   ./scripts/pubblica-locale.sh /var/www/hattrick --si    (senza conferma)
#
# Da usare quando sei collegato al server. Se invece pubblichi dal tuo
# computer, usa scripts/pubblica.sh, che fa la stessa cosa via SSH.
#
# Mostra in anteprima cosa verrebbe aggiunto, aggiornato e CANCELLATO, e
# chiede conferma. La cartella di destinazione deve contenere il solo sito
# Hattrick: ciò che si trova lì e non è nel repository viene rimosso.

set -euo pipefail

destinazione="${1:-}"
conferma=1

shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --si) conferma=0; shift ;;
    *) echo "Opzione sconosciuta: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$destinazione" ]; then
  echo "Uso: $0 /percorso/della/cartella/del/sito [--si]" >&2
  exit 2
fi

case "$destinazione" in
  /|/bin|/boot|/dev|/etc|/home|/lib|/proc|/root|/sbin|/sys|/usr|/var)
    echo "Destinazione troppo pericolosa: '$destinazione'." >&2
    echo "Dev'essere la cartella del solo sito, per esempio /var/www/hattrick." >&2
    exit 2 ;;
esac

if [ ! -e "$destinazione" ]; then
  echo "La cartella '$destinazione' non esiste. Creala e assegnatela:" >&2
  echo "  sudo mkdir -p '$destinazione' && sudo chown -R \$USER:\$USER '$destinazione'" >&2
  exit 1
fi
if [ ! -d "$destinazione" ]; then
  echo "'$destinazione' esiste ma non è una cartella." >&2
  exit 1
fi
if [ ! -w "$destinazione" ]; then
  echo "Non hai il permesso di scrivere in '$destinazione'. Assegnatela:" >&2
  echo "  sudo chown -R \$USER:\$USER '$destinazione'" >&2
  exit 1
fi

radice="$(cd "$(dirname "$0")/.." && pwd)"
cd "$radice"

if command -v npm >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
  echo "→ Test del motore di calcolo"
  npm test --silent >/dev/null
else
  # Sul server Node può non esserci: i test girano comunque su GitHub a ogni push.
  echo "→ Test saltati: Node non è installato su questa macchina"
fi

echo "→ Preparazione dei file"
cartella="$(mktemp -d)"
trap 'rm -rf "$cartella"' EXIT
# -p preserva le date: senza, ogni copia temporanea sembrerebbe più recente
# e rsync ritrasferirebbe tutto anche quando non è cambiato niente
cp -p index.html "$cartella/"
cp -rp assets "$cartella/"

echo "→ Anteprima: ecco cosa cambierebbe in $destinazione"
# --chmod: i permessi li decide la destinazione, non la cartella temporanea.
# Senza, mktemp -d (che crea a 700) rendeva la docroot illeggibile al web
# server, che rispondeva 403 pur avendo i file al posto giusto.
rsync -ai --delete --chmod=D755,F644 --dry-run "$cartella/" "$destinazione/"

if [ "$conferma" -eq 1 ]; then
  printf '\nProcedo? [s/N] '
  read -r risposta
  case "$risposta" in
    s|S|si|SI|Si) ;;
    *) echo "Annullato: niente è stato modificato."; exit 0 ;;
  esac
fi

echo "→ Pubblicazione"
rsync -a --delete --chmod=D755,F644 "$cartella/" "$destinazione/"
echo "✓ Fatto: https://hattrick.besttoolbox.de/"
