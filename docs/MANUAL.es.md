# Manual de MicTime

MicTime es un temporizador para intervenciones. Una **señal** inicia la cuenta, la **señal siguiente** la detiene, el **total** se queda en pantalla unos segundos y el temporizador vuelve a cero. Está pensado para la radio en directo (¿cuánto duró esa intervención?), pero sirve para charlas, mesas redondas y cualquier sala de control.

## Instalación y primer inicio

Descarga el instalador para tu sistema desde la página de [Releases](https://github.com/djgragra/mictime/releases) y compruébalo con `SHA256SUMS.txt`:
`MicTime-Setup-<V>.exe` (Windows), `MicTime-<V>-arm64.dmg` (Mac con Apple silicon), `MicTime-<V>-x64.dmg` (Mac con Intel), `MicTime-<V>.AppImage` (Linux).
La app es gratuita y no tiene certificado de Apple ni de Microsoft, así que en el primer inicio puede aparecer un aviso.

- **macOS**: la app tiene una firma ad-hoc, que es lo que necesita un Mac Apple silicon para abrirla. El primer inicio muestra igualmente el aviso «desarrollador no identificado»: abre *Ajustes del Sistema → Privacidad y seguridad* y pulsa *Abrir de todos modos* (el clic derecho → Abrir ya no existe desde macOS 15). Si una versión anterior (26.10.2 o más antigua) dice que la app está «dañada», ejecuta una vez en Terminal: `xattr -cr /Applications/MicTime.app && codesign --force --deep -s - /Applications/MicTime.app`
- **Windows**: si aparece SmartScreen, pulsa *Más información* → *Ejecutar de todos modos*.
- **Linux**: `chmod +x MicTime-*.AppImage` y después ejecútalo.

## La pantalla

- Las cifras grandes muestran minutos y segundos (`mm:ss`; `h:mm:ss` a partir de una hora).
- La palabra de encima dice lo que ocurre: **LISTO** (cero, en espera), **CONTANDO**, **TOTAL** (la cuenta detenida, mantenida en pantalla; una barra fina muestra cuánto va a durar).
- Con un **programa** activo, bajo las cifras ves el paso que se está cronometrando y el siguiente, con un menú para elegir el programa y botones para el paso anterior, el paso siguiente y *volver al primer paso*. Las cifras cambian de color con el límite del paso (véase *Programas*).
- **START / STOP** (o **START** y **STOP**) y **RESET** hacen a mano lo que hacen las señales. Los tres pequeños indicadores de arriba a la derecha dicen qué hace cada entrada: **MIDI** (listo, sin entrada, sin acceso), **KEY** (global, solo ventana), **AUDIO**.
- **Pantalla completa**: `F11`, el botón de arriba a la derecha o un doble clic en las cifras; `Esc` la cierra. En pantalla completa solo se ven las cifras, el paso y la barra del total.
- **Vista compacta**: el botón junto a la pantalla completa (en macOS también *Vista → Vista compacta*). La ventana se reduce a las cifras, se queda encima de las demás ventanas y recuerda su propio tamaño y posición; arrastra los bordes para cambiar el tamaño (hasta un cuadro pequeño). Para volver: doble clic en las cifras, pulsa `Esc` o usa el pequeño botón que aparece en la esquina cuando el ratón está sobre la ventana. No se recuerda en el siguiente inicio.
- **Intervenciones** (el botón de lista de arriba a la derecha): las últimas 20 intervenciones de esta sesión, de la más reciente a la más antigua, con hora, programa y paso, duración y límite (la duración sale en rojo si se superó el límite). *Copiar* las pone en el portapapeles como CSV, *Guardar CSV…* escribe un archivo, *Vaciar* vacía la lista. Viven solo en la memoria: al cerrar MicTime se olvidan.
- `S` abre los ajustes.

## Ajustes → General

- **Idioma**, **tema** (oscuro, claro, seguir el sistema).
- **Cómo funcionan las señales**: *una señal* (la primera inicia, la siguiente detiene, el mismo mensaje o la misma tecla) o *dos señales* (una inicia, la otra detiene).
- **Mostrar el total durante**: cuántos segundos se queda el total en pantalla tras una parada (1–600, por defecto 5). Con **No poner a cero nunca**, el total se queda hasta la siguiente señal de inicio o hasta un reinicio.
- **Ignorar una señal repetida en menos de**: algunas consolas envían dos mensajes por una pulsación; dos señales de inicio/parada más cercanas que estos milisegundos cuentan como una (por defecto 300; el reinicio nunca se ignora).
- **Siempre encima**.
- **Solo cifras a pantalla completa**: a pantalla completa se ocultan también la línea del paso y la barra del total, solo quedan las cifras (desactivado por defecto).

## Ajustes → Programas

**Un programa** es una lista de pasos, cada uno con un nombre y un tiempo límite (minutos y segundos; 00:00 = sin límite): por ejemplo *Apertura 00:45, Noticias 01:00, Entrevista 03:00, Cierre 00:30*. Sin un programa activo vale el **límite único** (misma pestaña, *Tiempo límite, colores y avisos*): minutos y segundos, 00:00 = sin límite. Recibe los mismos colores, aviso y parpadeo que los pasos de un programa, y la línea bajo las cifras dice `Límite 01:00`.

- **Cómo se usa**: elige el programa activo (aquí o con el menú de la pantalla principal). El primer paso queda armado. Cuando termina una intervención (la señal de parada), el total se queda en pantalla con el color que tenía y el **paso siguiente se arma solo**. **Reiniciar** cancela la cuenta en curso y *no* pasa al paso siguiente.
- **Al final del programa**: *volver al primer paso* o *seguir sin límite*.
- **Cuando cambia el guion**: **Paso anterior**, **Paso siguiente** y **Volver al primer paso**, con los botones o con señales que asignas en *Señales* (un mensaje MIDI o una tecla, con Aprender). Dos mensajes por una pulsación (véase *Ignorar una señal repetida*) no se saltan un paso.
- **Edición**: nombre, minutos y segundos de cada paso, subir y bajar, quitar, añadir (hasta 40 pasos); hasta 8 programas. El paso en verde es el que está listo ahora. El paso en el que está cada programa se recuerda al cerrar la app; no forma parte de la copia de seguridad.

**Colores y avisos** (misma pestaña)
- Las cifras son **grises** a cero, del color **contando** mientras cuenta, del color de **aviso** desde *N segundos antes del límite* (por defecto 10), del color **límite superado** (rojo) una vez superado el límite, y **parpadean lentamente** (más o menos una vez por segundo) cuando se supera en *M segundos* (por defecto 10). El total conserva el color que tenía en la parada y nunca parpadea. Un paso sin límite nunca cambia de color.
- Con *reducir animaciones* activado en el sistema no hay parpadeo: se muestra en su lugar un marco rojo fijo.
- Cada uno de los cuatro colores se puede elegir; *Por defecto* vuelve al color del tema.

**Aviso al llegar al límite** (misma pestaña, ambas opciones desactivadas por defecto)
- **Un pitido corto** y/o **un destello corto de la ventana** en el momento en que se alcanza el límite de tiempo del paso, una vez por intervención. *Probar* los reproduce. Con *reducir animaciones* activado en el sistema el destello no se muestra.
- **Cuidado con el pitido**: sale por la salida de audio predeterminada del equipo. Si esa salida va a la mesa o al streaming, el pitido puede salir al aire: usa el destello, o envía el audio del equipo solo a un monitor.

## Ajustes → Señales

### MIDI

1. Conecta el dispositivo (o el puerto virtual del software que envía MIDI). Pulsa **Actualizar** si no está en la lista.
2. Elige la **entrada MIDI** o *Todas las entradas*.
3. Pulsa **Aprender** junto a *Start / stop* (o *Start*, *Stop*, *Reset*) y envía el mensaje desde la consola: un botón, una nota, un controlador o un program change. MicTime lo muestra, por ejemplo `Nota C4 (60) · can. 1`. Pon el canal en *cualquier canal* si la fuente lo cambia.
4. La lista **Mensajes entrantes** muestra los últimos mensajes y lo que hizo MicTime con cada uno: úsala para ver lo que envía realmente tu dispositivo. *Mostrar todos los mensajes* enumera también los que MicTime ignora (reloj, keep-alive), en hexadecimal. **Puertos vistos por el sistema** enumera cada entrada con su estado y su conexión.
5. Paso siguiente, Paso anterior y Reiniciar programa se pueden asignar del mismo modo (actúan solo con *on*, como el Reinicio).

Un valor superior a 0 es **on**, 0 es **off**; solo actúa *on*, salvo cuando *Start* y *Stop* son el mismo mensaje: entonces on inicia y off detiene. La descripción completa, con ejemplos, está en [MIDI-SPEC.md](MIDI-SPEC.md).

### Teclado

**Asignar tecla**, y después pulsa la tecla o la combinación. Esc cancela. Con **Atajo global** activado, la tecla funciona incluso cuando otro programa está delante (hace falta un modificador como Ctrl, Alt o Mayús, o una tecla F, una tecla del teclado numérico o una tecla multimedia, de modo que la escritura normal no se intercepte nunca). La línea bajo la tecla dice si es global, si solo funciona con la ventana delante o si el sistema la ha rechazado (normalmente porque otro programa la usa). En Linux un atajo global puede no funcionar en todos los escritorios (por ejemplo Wayland): entonces usa la tecla con la ventana delante, o MIDI.

### Nivel de audio

Apagado por defecto. Enciéndelo, elige la **entrada de audio**, fija el **umbral** (el medidor muestra el nivel; la línea naranja es el umbral) y el **tiempo de mantenimiento**. La cuenta **empieza** cuando el nivel alcanza el umbral y **se detiene** cuando se queda por debajo durante el tiempo de mantenimiento, de modo que una respiración o una pausa breve no la terminan. La primera vez, el sistema pide permiso para el micrófono. Solo se mide el nivel: no se graba, guarda ni envía nada, y el sonido no se reproduce.

### Si no llega nada

1. ¿El monitor muestra algo? Si quien envía está en el mismo equipo, un *puerto virtual* conecta ambos (véase [MIDI-SPEC.md](MIDI-SPEC.md)).
2. ¿Está el puerto en *Puertos vistos por el sistema*? Si no, pulsa *Actualizar*; si sigue sin estar, el sistema no lo muestra.
3. ¿Quien envía muestra actividad pero no llega nada (por ejemplo, el *Total data* de loopMIDI se queda en 0 mientras tocas)? En una prueba en Windows, un puerto virtual que se había creado una vez no pasaba nada hasta que se **eliminó y se volvió a crear**; después todo funcionó. Vuelve a crear el puerto, reinicia quien envía, pulsa *Actualizar*.
4. Dos programas en la misma entrada a la vez pueden no recibir los dos: cierra el otro para ver si cambia algo.

## Ajustes → Actualizaciones

MicTime busca una versión nueva una vez al día (aquí puedes desactivarlo). Una franja bajo la cabecera ofrece **Descargar e instalar**, **Recordármelo después** (24 horas), **Omitir esta versión** y las notas de la versión. La descarga muestra una barra de progreso y se puede cancelar; el archivo se comprueba con el SHA-256 de la versión. **Cerrar e instalar** guarda primero una copia de seguridad de los ajustes (se conservan las últimas 3): en Windows cierra MicTime e inicia el instalador, en macOS abre la imagen de disco, en Linux muestra el AppImage. Si hay una cuenta en curso, pregunta antes. Tras una actualización, **Novedades** aparece una vez. No se instala nada sin un clic.

## Ajustes → Copia de seguridad

**Exportar** guarda la configuración (mensajes MIDI, teclas, ajustes de audio y del temporizador, programas, colores, idioma, tema) como `mictime-backup-AAAA-MM-DD.json`. **Importar** la lee de nuevo: *Sustituir todo* o *Añadir solo los que faltan* (las asignaciones y los colores que aún no has fijado se rellenan, los programas que este equipo no tiene se añaden, todo lo demás se queda como está). El archivo no contiene contraseñas ni claves.

## Ajustes → Ayuda e información

Versión, enlaces, **Copiar info de soporte** (versión, sistema, idioma, última comprobación de actualizaciones, último error: nunca tus ajustes), **Abrir la carpeta de registros** (archivos diarios, de 5 MB como máximo cada uno, se conservan 7 días), los avisos del primer inicio (en macOS: *Abrir de todos modos*, y el comando de Terminal para una versión anterior que dice que está dañada) y los créditos.

La pequeña tarjeta de propina del final tiene un botón y una hucha; ambos abren en tu navegador la página de apoyo del sitio.

## Límites

- MicTime no es un instrumento certificado; la cuenta sigue el reloj del equipo y la llegada de las señales.
- Una señal que no llega nunca, o que llega dos veces con mucha distancia, da un total erróneo: revisa el monitor.
- El PC debe seguir encendido y MicTime abierto. Mientras está abierto, se impide que el sistema se suspenda.
