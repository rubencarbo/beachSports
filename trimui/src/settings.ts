// Ajustes de la edición consola (se guardan en localStorage: el lanzador lo vuelca a ~/.jsgamelauncher/<juego>/data.json).
export const settings = {
  movement: 'assist' as 'assist' | 'semi' | 'manual',
  autoSmash: true,
  swapAB: false,
  music: true,
  sound: true,
  vsync: false,
  lite: true,
  diag: true,
  difficulty: 'normal' as 'facil' | 'normal' | 'dificil',
  points: 7,
};
const KEY = 'beachsports.trimui.v1';
export function loadSettings() {
  try { const s = localStorage && localStorage.getItem(KEY); if (s) Object.assign(settings, JSON.parse(s)); } catch (e) { /* sin almacenamiento */ }
}
export function saveSettings() {
  try { localStorage && localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* sin almacenamiento */ }
}
