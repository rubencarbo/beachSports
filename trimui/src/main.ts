import { boot } from './app';
// el arranque va al final del módulo (en ESM no se puede usar nada declarado más abajo)
try { boot(); } catch (e: any) { console.error('[BeachSports] error al arrancar: ' + (e && (e.stack || e.message))); throw e; }
