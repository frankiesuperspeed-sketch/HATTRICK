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
