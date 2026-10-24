# Manuale di MicTime

MicTime è un timer per gli interventi. Un **segnale** avvia il conteggio, il **segnale successivo** lo ferma, il **totale** resta a schermo per qualche secondo e il timer torna a zero. È pensato per la radio dal vivo (quanto è durato quell'intervento?), ma funziona per interventi, tavole rotonde e qualsiasi regia.

## Installazione e primo avvio

Scarica l'installer per il tuo sistema dalla pagina [Releases](https://github.com/djgragra/mictime/releases) e controllalo con `SHA256SUMS.txt`:
`MicTime-Setup-<V>.exe` (Windows), `MicTime-<V>-arm64.dmg` (Mac con Apple silicon), `MicTime-<V>-x64.dmg` (Mac con Intel), `MicTime-<V>.AppImage` (Linux).
L'app è gratuita e non ha un certificato Apple o Microsoft, quindi al primo avvio può comparire un avviso.

- **macOS**: l'app è firmata ad-hoc, ed è ciò che serve a un Mac Apple silicon per aprirla. Il primo avvio mostra comunque l'avviso «sviluppatore non identificato»: apri *Impostazioni di Sistema → Privacy e sicurezza* e clicca *Apri comunque* (il clic destro → Apri non esiste più da macOS 15). Se una versione precedente (26.10.2 o più vecchia) dice che l'app è «danneggiata», esegui una volta nel Terminale: `xattr -cr /Applications/MicTime.app && codesign --force --deep -s - /Applications/MicTime.app`
- **Windows**: se compare SmartScreen, clicca *Ulteriori informazioni* → *Esegui comunque*.
- **Linux**: `chmod +x MicTime-*.AppImage`, poi avvialo.

## La schermata

- Le cifre grandi mostrano minuti e secondi (`mm:ss`; `h:mm:ss` da un'ora in su).
- La parola sopra dice cosa succede: **PRONTO** (zero, in attesa), **IN CORSO**, **TOTALE** (il conteggio fermato, tenuto a schermo; una barra sottile mostra quanto resterà).
- Con un **programma** attivo, sotto le cifre vedi il passo che si sta cronometrando e quello dopo, con un menu per scegliere il programma e i pulsanti per il passo precedente, il passo successivo e *riparti dal primo passo*. Le cifre cambiano colore con il limite del passo (vedi *Programmi*).
- **START / STOP** (oppure **START** e **STOP**) e **RESET** fanno a mano ciò che fanno i segnali. I tre piccoli indicatori in alto a destra dicono cosa fa ogni ingresso: **MIDI** (pronto, nessun ingresso, nessun accesso), **KEY** (globale, solo finestra), **AUDIO**.
- **Schermo intero**: `F11`, il pulsante in alto a destra o un doppio clic sulle cifre; `Esc` lo chiude. A schermo intero si vedono solo le cifre, il passo e la barra del totale.
- **Vista compatta**: il pulsante accanto allo schermo intero (su macOS anche *Vista → Vista compatta*). La finestra si riduce alle cifre, resta sopra le altre finestre e ricorda la propria dimensione e posizione; trascina i bordi per ridimensionarla (fino a un riquadro piccolo). Per tornare indietro: doppio clic sulle cifre, premi `Esc` o usa il piccolo pulsante che compare nell'angolo quando il mouse è sulla finestra. Non viene ricordata al prossimo avvio.
- **Speech** (il pulsante elenco in alto a destra): gli ultimi 20 speech di questa sessione, dal più recente, con ora, programma e passo, durata e limite (la durata è rossa se il limite è stato superato). *Copia* li mette negli appunti come CSV, *Salva CSV…* scrive un file, *Svuota* azzera l'elenco. Stanno solo in memoria: chiudendo MicTime li dimentica.
- `S` apre le impostazioni.

## Impostazioni → Generale

- **Lingua**, **tema** (scuro, chiaro, segui il sistema).
- **Come funzionano i segnali**: *un segnale* (il primo avvia, il successivo ferma, stesso messaggio o stesso tasto) oppure *due segnali* (uno avvia, l'altro ferma).
- **Mostra il totale per**: quanti secondi il totale resta a schermo dopo uno stop (1–600, predefinito 5). Con **Non azzerare mai** il totale resta fino al successivo segnale di avvio o a un reset.
- **Ignora un segnale ripetuto entro**: alcune console mandano due messaggi per una pressione; due segnali di start/stop più vicini di questi millisecondi contano come uno (predefinito 300; il reset non viene mai ignorato).
- **Sempre in primo piano**.
- **Solo cifre a tutto schermo**: a tutto schermo si nascondono anche la riga del passo e la barra del totale, restano solo le cifre (spento di default).

## Impostazioni → Programmi

**Un programma** è un elenco di passi, ognuno con un nome e un tempo limite (minuti e secondi; 00:00 = senza limite): per esempio *Apertura 00:45, Notizie 01:00, Intervista 03:00, Chiusura 00:30*. Senza un programma attivo vale il **limite unico** (stessa scheda, *Tempo limite, colori e avvisi*): minuti e secondi, 00:00 = senza limite. Ottiene gli stessi colori, avviso e lampeggio dei passi di un programma, e la riga sotto le cifre dice `Limite 01:00`.

- **Come si usa**: scegli il programma attivo (qui o con il menu nella schermata principale). Il primo passo è armato. Quando uno speech finisce (il segnale di stop), il totale resta a schermo con il colore che aveva e il **passo successivo si arma da solo**. **Reset** annulla il conteggio in corso e *non* passa al passo successivo.
- **Alla fine del programma**: *riparti dal primo passo*, oppure *continua senza limite*.
- **Quando la scaletta cambia**: **Passo precedente**, **Passo successivo** e **Riparti dal primo passo**, con i pulsanti o con segnali che assegni in *Segnali* (un messaggio MIDI o un tasto, con Impara). Due messaggi per una pressione (vedi *Ignora un segnale ripetuto*) non saltano un passo.
- **Modifica**: nome, minuti e secondi di ogni passo, sposta su e giù, togli, aggiungi (fino a 40 passi); fino a 8 programmi. Il passo in verde è quello pronto ora. Il passo a cui è arrivato ogni programma viene ricordato quando l'app si chiude; non fa parte del backup.

**Colori e avvisi** (stessa scheda)
- Le cifre sono **grigie** a zero, del colore **in corso** durante il conteggio, del colore di **avviso** da *N secondi prima del limite* (predefinito 10), del colore **limite superato** (rosso) quando il limite è superato, e **lampeggiano lentamente** (circa una volta al secondo) quando è superato di *M secondi* (predefinito 10). Il totale tiene il colore che aveva allo stop e non lampeggia mai. Un passo senza limite non cambia mai colore.
- Con *riduci animazioni* attivo nel sistema non c'è lampeggio: si vede invece una cornice rossa fissa.
- Ognuno dei quattro colori si può scegliere; *Predefinito* torna al colore del tema.

**Avviso al limite** (stessa scheda, entrambe le opzioni spente di default)
- **Un breve beep** e/o **un breve lampo della finestra** nel momento in cui si raggiunge il limite di tempo del passo, una volta per speech. *Prova* li esegue. Con *riduci animazioni* attivo nel sistema il lampo non si vede.
- **Attenzione al beep**: esce dall'uscita audio predefinita del computer. Se quell'uscita arriva al mixer o allo streaming, il beep può andare in onda: usa il lampo, oppure manda l'audio del computer solo a un monitor.

## Impostazioni → Segnali

### MIDI

1. Collega il dispositivo (o la porta virtuale del software che manda MIDI). Premi **Aggiorna** se non è nell'elenco.
2. Scegli l'**ingresso MIDI**, oppure *Tutti gli ingressi*.
3. Premi **Impara** accanto a *Start / stop* (o *Start*, *Stop*, *Reset*) e manda il messaggio dalla console: un pulsante, una nota, un controller o un program change. MicTime lo mostra, per esempio `Nota C4 (60) · can. 1`. Imposta il canale su *qualsiasi canale* se la sorgente lo cambia.
4. L'elenco **Messaggi in arrivo** mostra gli ultimi messaggi e cosa ha fatto MicTime con ciascuno: usalo per vedere cosa manda davvero il tuo dispositivo. *Mostra tutti i messaggi* elenca anche quelli che MicTime ignora (clock, keep-alive), in esadecimale. **Porte viste dal sistema** elenca ogni ingresso con il suo stato e la sua connessione.
5. Passo successivo, Passo precedente e Riparti il programma si assegnano allo stesso modo (agiscono solo su *on*, come il Reset).

Un valore sopra 0 è **on**, 0 è **off**; agisce solo *on*, tranne quando *Start* e *Stop* sono lo stesso messaggio: allora on avvia e off ferma. La descrizione completa, con esempi, è in [MIDI-SPEC.md](MIDI-SPEC.md).

### Tastiera

**Imposta tasto**, poi premi il tasto o la combinazione. Esc annulla. Con **Scorciatoia globale** attiva, il tasto funziona anche quando un altro programma è davanti (serve un modificatore come Ctrl, Alt o Maiusc, oppure un tasto F, un tasto del tastierino numerico o un tasto multimediale, così la normale digitazione non viene mai intercettata). La riga sotto il tasto dice se è globale, se funziona solo con la finestra davanti o se è stato rifiutato dal sistema (di solito perché un altro programma lo usa). Su Linux una scorciatoia globale può non funzionare su ogni desktop (per esempio Wayland): in quel caso usa il tasto con la finestra davanti, oppure il MIDI.

### Livello audio

Spento di default. Accendilo, scegli l'**ingresso audio**, imposta la **soglia** (il misuratore mostra il livello; la linea arancione è la soglia) e il **tempo di tenuta**. Il conteggio **parte** quando il livello raggiunge la soglia e **si ferma** quando resta sotto per il tempo di tenuta, così un respiro o una breve pausa non lo chiudono. La prima volta il sistema chiede il permesso per il microfono. Si misura solo il livello: non viene registrato, salvato o inviato nulla, e il suono non viene riprodotto.

### Se non arriva niente

1. Il monitor mostra qualcosa? Se chi invia è sullo stesso computer, una *porta virtuale* collega i due (vedi [MIDI-SPEC.md](MIDI-SPEC.md)).
2. La porta è in *Porte viste dal sistema*? Se no, premi *Aggiorna*; se ancora no, il sistema non la mostra.
3. Chi invia mostra attività ma non arriva niente (per esempio il *Total data* di loopMIDI resta a 0 mentre suoni)? In una prova su Windows una porta virtuale creata una volta non passava nulla finché non è stata **rimossa e ricreata**, poi tutto ha funzionato. Ricrea la porta, riavvia chi invia, premi *Aggiorna*.
4. Due programmi sullo stesso ingresso nello stesso momento possono non ricevere entrambi: chiudi l'altro, per vedere se cambia qualcosa.

## Impostazioni → Aggiornamenti

MicTime cerca una nuova versione una volta al giorno (qui puoi disattivarlo). Una striscia sotto l'intestazione offre **Scarica e installa**, **Ricordamelo dopo** (24 ore), **Salta questa versione** e le note di rilascio. Il download mostra una barra di avanzamento e si può annullare; il file viene controllato con lo SHA-256 della release. **Chiudi e installa** salva prima una copia di sicurezza delle impostazioni (si tengono le ultime 3): su Windows chiude MicTime e avvia l'installer, su macOS apre l'immagine disco, su Linux mostra l'AppImage. Se un conteggio è in corso, chiede prima. Dopo un aggiornamento, **Novità** compare una volta. Niente viene installato senza un clic.

## Impostazioni → Backup

**Esporta** salva la configurazione (messaggi MIDI, tasti, impostazioni audio e del timer, programmi, colori, lingua, tema) come `mictime-backup-AAAA-MM-GG.json`. **Importa** la rilegge: *Sostituisci tutto*, oppure *Aggiungi solo i mancanti* (le assegnazioni e i colori che non hai ancora impostato vengono riempiti, i programmi che questo computer non ha vengono aggiunti, il resto resta com'è). Il file non contiene password né chiavi.

## Impostazioni → Aiuto e informazioni

Versione, link, **Copia info per assistenza** (versione, sistema, lingua, ultimo controllo aggiornamenti, ultimo errore: mai le tue impostazioni), **Apri la cartella dei log** (file giornalieri, al massimo 5 MB ciascuno, 7 giorni conservati), gli avvisi del primo avvio (su macOS: *Apri comunque*, e il comando da Terminale per una versione precedente che dice che è danneggiata) e i crediti.

Il piccolo riquadro mancia in fondo ha un pulsante e un salvadanaio, entrambi aprono nel browser la pagina di sostegno del sito.

## Limiti

- MicTime non è uno strumento certificato; il conteggio segue l'orologio del computer e l'arrivo dei segnali.
- Un segnale che non arriva mai, o che arriva due volte a grande distanza, dà un totale sbagliato: controlla il monitor.
- Il PC deve restare acceso e MicTime aperto. Finché è aperto, il sistema non viene lasciato andare in sospensione.
