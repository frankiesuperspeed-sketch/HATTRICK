# Hattrick

Strumenti di calcolo per il gioco manageriale **Hattrick**, in una sola webapp a schede.
Statica: HTML, CSS e JavaScript (ES modules), **zero dipendenze e zero build**.
I dati restano nel browser (`localStorage`).

## Le schede

| Scheda | Stato | Cosa fa |
|---|---|---|
| **Rosa e stipendi** | pronta | Monte stipendi, margine sulle entrate, chi pesa di più (regola 80/20), costo per ruolo e per età, tenuta della cassa, effetto di una cessione. |
| **Valutazione** | in costruzione | Prezzo di mercato stimato di un giocatore. |
| **Schieramento** | in costruzione | Rating attesi per reparto da una formazione. |
| **Allenamento** | in costruzione | Chi allenare e dove si arriva a fine stagione. |
| **Giovanili** | in costruzione | Potenziale dei giovani e momento della promozione. |
| **Forma** | in costruzione | Andamento di forma e condizione e impatto sui rating. |
| **Tattiche** | in costruzione | Effetto delle scelte tattiche sui rating. |
| **Rating** | pronta | Conversione in entrambi i versi tra nomi verbali e numeri, sottolivelli compresi, con tabella di riferimento. La scala dei nomi è modificabile. |
| **Mercato** | in costruzione | Aste seguite, offerte e prezzi di riferimento. |

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

## I nomi della scala sono un dato, non codice

La scheda *Rating* parte da una scala di nomi (`inesistente` … `divino`) che è
**modificabile dall'interfaccia** e salvata nel browser. I nomi cambiano con la lingua
e con le versioni del gioco, quindi nessuna funzione li dà per scontati: la scala viene
passata da fuori a ogni conversione. Se correggi un nome, si adegua tutto.

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
