import { app } from 'electron';
import { getSettings } from './store.js';

// Texts shown by the main process (file dialogs). The interface texts live in renderer/js/i18n.js.
const TEXT = {
  exportTitle: { en: 'Export backup', it: 'Esporta backup', es: 'Exportar copia de seguridad' },
  csvTitle: { en: 'Save the speeches', it: 'Salva gli interventi', es: 'Guardar las intervenciones' },
  csvFilter: { en: 'Spreadsheet file (CSV)', it: 'File per fogli di calcolo (CSV)', es: 'Archivo de hoja de cálculo (CSV)' },
  importTitle: { en: 'Import backup', it: 'Importa backup', es: 'Importar copia de seguridad' },
  jsonFilter: { en: 'Backup file (JSON)', it: 'File di backup (JSON)', es: 'Archivo de copia de seguridad (JSON)' },
  importModeMessage: { en: 'How do you want to import this backup?', it: 'Come vuoi importare questo backup?', es: '¿Cómo quieres importar esta copia de seguridad?' },
  importModeDetail: {
    en: 'Replace everything: all settings come from the file. Add only the missing: the settings of this computer stay as they are and only the MIDI messages, keys and colours you have not set yet are filled in and the programs it does not have are added.',
    it: 'Sostituisci tutto: tutte le impostazioni vengono dal file. Aggiungi solo i mancanti: le impostazioni di questo computer restano come sono e si completano solo i messaggi MIDI, i tasti e i colori non ancora impostati e si aggiungono i programmi che mancano.',
    es: 'Reemplazar todo: todos los ajustes vienen del archivo. Añadir solo los que faltan: los ajustes de este equipo se mantienen y solo se completan los mensajes MIDI, las teclas y los colores aún sin asignar y se añaden los programas que faltan.'
  },
  importReplace: { en: 'Replace everything', it: 'Sostituisci tutto', es: 'Reemplazar todo' },
  importAdd: { en: 'Add only the missing', it: 'Aggiungi solo i mancanti', es: 'Añadir solo los que faltan' },
  installBusyMessage: { en: 'The timer is running.', it: 'Il timer è in corso.', es: 'El temporizador está en marcha.' },
  installBusyDetail: {
    en: 'Closing MicTime to install the update stops the count in progress.',
    it: 'Chiudere MicTime per installare l\'aggiornamento interrompe il conteggio in corso.',
    es: 'Cerrar MicTime para instalar la actualización detiene la cuenta en curso.'
  },
  installAnyway: { en: 'Close and install', it: 'Chiudi e installa', es: 'Cerrar e instalar' },
  resetMessage: { en: 'Restore the default settings?', it: 'Ripristinare le impostazioni predefinite?', es: '¿Restaurar los ajustes predeterminados?' },
  resetDetail: {
    en: 'The MIDI messages, keys, audio settings, timer settings, programs and colours go back to their defaults.',
    it: 'Messaggi MIDI, tasti, impostazioni audio e del timer, programmi e colori tornano ai valori predefiniti.',
    es: 'Los mensajes MIDI, las teclas, los ajustes de audio y del temporizador, los programas y los colores vuelven a sus valores predeterminados.'
  },
  reset: { en: 'Restore', it: 'Ripristina', es: 'Restaurar' },
  cancel: { en: 'Cancel', it: 'Annulla', es: 'Cancelar' }
};

const SUPPORTED = ['en', 'it', 'es'];

// The app always opens in English; the choice made in Settings is remembered (apps/STANDARD.md).
export function resolveLanguage() {
  const chosen = getSettings().language;
  return SUPPORTED.includes(chosen) ? chosen : 'en';
}

export function resolveLocale() {
  const lang = resolveLanguage();
  const sys = app.getLocale() || '';
  return sys.toLowerCase().startsWith(lang) ? sys : lang;
}

export const T = (key) => TEXT[key][resolveLanguage()] ?? TEXT[key].en;
