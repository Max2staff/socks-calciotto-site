// Piccole utilità condivise. Importi: centesimi interi nei calcoli, euro solo in I/O.
export const centesimi = (euro) => Math.round(Number(euro) * 100);
export const euro = (cent) => cent / 100;

export function formattaEuro(cent) {
  const s = (Math.abs(cent) / 100).toFixed(2).replace('.', ',');
  return (cent < 0 ? '−' : '') + s + ' €';
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const GIORNI_LUNGHI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function daISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formattaData(iso) {
  if (!iso) return 'data da definire';
  const d = daISO(iso);
  return `${GIORNI[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formattaDataLunga(iso) {
  if (!iso) return 'data da definire';
  const d = daISO(iso);
  return `${GIORNI_LUNGHI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

export function giorniTra(isoA, isoB) {
  return Math.round((daISO(isoB) - daISO(isoA)) / 86400000);
}

export function oggiISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
