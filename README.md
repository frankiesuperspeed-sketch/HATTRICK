# Hattrick

Strumenti di calcolo per il gioco manageriale **Hattrick**, in una sola webapp a schede.
Statica: HTML, CSS e JavaScript (ES modules), **zero dipendenze e zero build**.
I dati restano nel browser (`localStorage`).

## Le schede

| Scheda | Stato | Cosa fa |
|---|---|---|
| **Rosa e stipendi** | pronta | Monte stipendi, margine sulle entrate, chi pesa di più (regola 80/20), costo per ruolo e per età, tenuta della cassa, effetto di una cessione. |
| **Valutazione** | pronta | Prezzo stimato di un giocatore, con un modello che si tara sulle vendite che registri tu; confronto col prezzo richiesto e scarti sulle osservazioni. |
| **Schieramento** | pronta | Formazione composta con i giocatori della rosa, valore prodotto da ciascun reparto, chi lo regge, confronto con una fotografia precedente. Contributi dei ruoli modificabili. |
| **Allenamento** | pronta | Crescita settimanale di chi alleni, scatti previsti con le date, confronto fra tutti i tipi di allenamento sulla stessa rosa, e calibrazione sulle settimane osservate in gioco. |
| **Giovanili** | pronta | Crescita misurata sulle letture registrate, confronto con la prima squadra ruolo per ruolo, e per ogni giovane il motivo per cui è (o non è) pronto alla promozione. |
| **Forma** | pronta | Rendimento attuale di ogni giocatore rispetto alle sue condizioni normali, tendenza rispetto alla lettura precedente, storico registrabile settimana per settimana. |
| **Tattiche** | pronta | Confronto fra tutte le tattiche sulla formazione schierata: forza che la rosa dà a ciascuna, effetto sui tre reparti e guadagno rispetto a non farne nessuna. |
| **Rating** | pronta | Conversione in entrambi i versi tra nomi verbali e numeri, sottolivelli compresi, con tabella di riferimento. La scala dei nomi è modificabile. |
| **Mercato** | pronta | Aste seguite in ordine di chiusura, giudizio sul prezzo dal modello della Valutazione, tetto di spesa personale e impegno massimo confrontato con la cassa. |

## Le schede si parlano

Nessuna scheda è un'isola, e nessun dato si inserisce due volte:

- la **rosa** è una sola e la usano stipendi, valutazione, schieramento, allenamento, forma e giovanili;
- il **moltiplicatore di forma** dello schieramento è lo stesso che usa la scheda Forma;
- il **modello di valutazione**, tarato sulle vendite che registri, dà il giudizio sui prezzi nel Mercato;
- la **cassa** della prima scheda dice, nel Mercato, cosa resta se vinci tutte le aste;
- la **scala dei rating** convertita nella scheda Rating nomina i valori di reparto dello Schieramento;
- il **confronto con la prima squadra** è il criterio di promozione delle Giovanili.

## Un'idea sola: la rosa è condivisa

I giocatori si inseriscono **una volta** nella scheda *Rosa e stipendi*; tutte le altre
schede leggono la stessa rosa (`assets/js/dati/rosa.js`). Il deposito è reattivo: una
modifica fatta in una scheda si riflette subito nelle altre.

## Dati: oggi a mano, domani da Hattrick

Da dove arrivano i dati è deciso in un punto solo, `assets/js/dati/sorgente.js`.
Oggi la sorgente è l'inserimento manuale; il collegamento a Hattrick è previsto lì e
le schede non dovranno cambiare.

**Perché il collegamento CHPP non può stare tutto nel browser.** Il CHPP usa OAuth 1.0a:
ogni richiesta va firmata con un *consumer secret* rilasciato da Hattrick. In una pagina
statica quel segreto sarebbe leggibile da chiunque apra il sorgente, e in più il browser
non può interrogare `chpp.hattrick.org` direttamente perché è un'altra origine.

Serve quindi un piccolo intermediario sul proprio server (`server/chpp.php`, in arrivo):
custodisce il segreto, gestisce il login e inoltra le chiamate. Il frontend resta statico.

Per attivarlo servono, in quest'ordine:

1. registrare l'applicazione su [hattrick.org/en/Chpp](https://www.hattrick.org/en/Chpp) e attenderne l'approvazione;
2. mettere chiave e segreto in `server/chpp-config.php` **sul server** (il file è escluso da git);
3. indicare l'indirizzo del proxy nelle impostazioni della sorgente dati.

## Niente numeri inventati

Hattrick non pubblica le proprie formule. Dove un valore non è verificabile,
l'app non lo finge: o lo rende **modificabile e dichiarato come stima**, o lo
**impara dai tuoi dati**.

La scheda *Valutazione* segue la seconda strada: registri le vendite che vedi sul
mercato e il modello si tara su quelle. È una regressione sui logaritmi,

```
ln(prezzo) = a + b · abilità + c · età
```

quindi il prezzo cresce in modo moltiplicativo con l'abilità e cala con l'età; `b` e
`c` si leggono direttamente come "un livello in più vale × tanto". Da tre osservazioni
in poi i coefficienti vengono dai tuoi dati, e R² dice quanto il modello li spiega.
Sotto quella soglia si usano valori di partenza, dichiarati come tali.

## La scala dei rating

La scala italiana 0–20 (`inesistente` … `divino`) è quella ufficiale del gioco e vale
sia per le abilità dei giocatori sia per i rating dei reparti. È bloccata da un test,
così una modifica involontaria si vede subito.

I **sottolivelli** (molto basso, basso, alto, molto alto) sono invece un'ipotesi non
verificata, e la scheda lo dichiara.

In ogni caso i nomi restano un dato e non delle costanti: sono modificabili
dall'interfaccia — serve a chi gioca in un'altra lingua — e ogni funzione riceve la
scala da fuori, così correggerne uno adegua tutto il resto.

## Pubblicazione

Il sito vive su **https://hattrick.besttoolbox.de**.

Il sito è statico e usa solo percorsi relativi con un router a hash, quindi funziona
sia dalla radice di un dominio sia da una sottocartella, senza regole di rewrite.
Sul server serve solo `index.html` e `assets/`: test, workflow e file di progetto
restano fuori.

### Dal proprio computer (nessuna configurazione)

```bash
./scripts/pubblica.sh utente@besttoolbox.de:/var/www/hattrick
./scripts/pubblica.sh utente@besttoolbox.de:/var/www/hattrick --porta 2222
```

Esegue i test, prepara i file, **mostra in anteprima cosa verrebbe aggiunto, aggiornato
e cancellato**, e chiede conferma prima di scrivere. Usa la configurazione SSH del tuo
computer: nessun segreto da configurare da nessuna parte.

Prima di toccare qualunque cosa controlla la destinazione e, se qualcosa non va, dice
quale dei quattro casi è: server irraggiungibile, cartella inesistente, non è una
cartella, oppure esiste ma il tuo utente non può scriverci. In quest'ultimo caso serve
un passaggio sul server, una volta sola:

```bash
ssh utente@besttoolbox.de 'sudo mkdir -p /var/www/hattrick && sudo chown -R $USER:$USER /var/www/hattrick'
```

Se non sai dove il vhost serve il sito:

```bash
ssh utente@besttoolbox.de 'apachectl -S 2>/dev/null | grep -i hattrick; nginx -T 2>/dev/null | grep -A3 hattrick'
```

### Il server (Caddy)

Il sito è servito da Caddy. Il blocco da aggiungere a `/etc/caddy/Caddyfile` è tutto qui:

```caddyfile
hattrick.besttoolbox.de {
    root * /var/www/hattrick
    encode zstd gzip
    file_server
}
```

Caddy ottiene e rinnova il certificato HTTPS da solo, purché il DNS del sottodominio
punti già al server. Poi:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile   # controlla prima di applicare
sudo systemctl reload caddy                          # ricarica senza interrompere il servizio
```

La cartella va creata una volta sola, leggibile da Caddy e scrivibile da chi pubblica:

```bash
sudo mkdir -p /var/www/hattrick
sudo chown -R $USER:$USER /var/www/hattrick
sudo chmod 755 /var/www/hattrick
```

> I nomi dei file non contengono un'impronta di versione, quindi **non** conviene
> aggiungere direttive di cache aggressive: il comportamento predefinito di Caddy
> (`ETag` e `Last-Modified`) fa già la cosa giusta e dopo una pubblicazione il browser
> prende subito la versione nuova.

### Da GitHub, a ogni push su `main`

Il workflow `.github/workflows/deploy.yml` fa le stesse cose in automatico. Richiede
questi **Repository secrets** (Settings → Secrets and variables → Actions → scheda
*Secrets*, non *Variables*):

| Secret | Contenuto |
|---|---|
| `DEPLOY_HOST` | host SSH del server, es. `besttoolbox.de` |
| `DEPLOY_USER` | utente SSH |
| `DEPLOY_PATH` | docroot del **solo** sito `hattrick.besttoolbox.de` |
| `DEPLOY_SSH_KEY` | chiave **privata** dedicata al deploy |
| `DEPLOY_KNOWN_HOSTS` | output di `ssh-keyscan -p 22 besttoolbox.de` |
| `DEPLOY_PORT` | solo se la porta SSH non è la 22 |

Finché mancano, il job si ferma al primo passo elencando quali, **senza toccare il
server**. Da *Actions → Run workflow* si può anche chiedere la sola passata di prova.

> ⚠️ La sincronizzazione usa `rsync --delete`: `DEPLOY_PATH` dev'essere la cartella del
> solo sito Hattrick, perché tutto ciò che si trova lì e non è nel repository viene
> rimosso. Il workflow rifiuta la radice come destinazione ed esegue sempre prima una
> passata di prova, il cui elenco resta nei log.

## Avvio in locale

Gli ES modules non funzionano con `file://`, serve un server statico:

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000
```

## Test

La logica di calcolo vive in `assets/js/calcolo/` ed è pura (nessun DOM), quindi si
verifica con il test runner di Node:

```bash
npm test
```

## Struttura

```
index.html              guscio dell'app
assets/css/app.css      stile e temi (chiaro/scuro)
assets/js/app.js        schede e navigazione
assets/js/dati/         rosa condivisa e sorgente dei dati
assets/js/calcolo/      motore di calcolo puro (testato)
assets/js/schede/       una vista per scheda
assets/js/lib/          utility DOM, formattazione, deposito, grafici
server/                 intermediario CHPP (in arrivo)
test/                   test unitari
```

## Note legali

Progetto amatoriale, **non affiliato né approvato da Hattrick**.
"Hattrick" è un marchio dei rispettivi proprietari.
