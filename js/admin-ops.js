// Operazioni del cassiere su cassa.json. Funzioni pure che mutano l'oggetto e restituiscono il messaggio di commit.
import { formattaEuro, centesimi } from './util.js';
import { amichevoleDi } from './cassa.js';

const TIPI = new Set(['pagamento', 'multa', 'spesa', 'rettifica']);

export function prossimoIdMovimento(cassa) {
  const max = (cassa.movimenti || []).reduce((m, x) => Math.max(m, Number(String(x.id).slice(1)) || 0), 0);
  return 'm' + String(max + 1).padStart(4, '0');
}

export function aggiungiMovimento(cassa, m, nickDi) {
  if (!TIPI.has(m.tipo)) throw new Error('Tipo movimento non valido');
  const importo = Number(m.importo);
  if (!Number.isFinite(importo)) throw new Error('Importo non valido');
  if (m.tipo === 'rettifica' ? importo === 0 : importo <= 0) throw new Error('Importo: deve essere maggiore di zero');
  if (m.tipo !== 'spesa' && !m.giocatoreId) throw new Error('Scegli il giocatore');
  if ((m.tipo === 'rettifica' || m.tipo === 'spesa' || (m.tipo === 'multa' && m.tipoMulta === 'libera')) && !(m.causale || '').trim()) throw new Error('La causale è obbligatoria');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.data || '')) throw new Error('Data non valida');
  const mov = { id: prossimoIdMovimento(cassa), data: m.data, tipo: m.tipo, importo: Math.round(importo * 100) / 100, causale: (m.causale || '').trim() };
  if (m.giocatoreId) mov.giocatoreId = m.giocatoreId;
  if (m.idPartita) mov.idPartita = idPartitaValido(m.idPartita);
  if (m.tipo === 'multa') mov.tipoMulta = m.tipoMulta || 'libera';
  cassa.movimenti.push(mov);
  const chi = m.giocatoreId ? nickDi(m.giocatoreId) : '';
  const eur = formattaEuro(centesimi(mov.importo));
  const testa = { pagamento: `Pagamento ${eur} da ${chi}`, multa: `Multa ${eur} a ${chi}`, spesa: `Spesa ${eur}`, rettifica: `Rettifica ${eur} su ${chi}` }[m.tipo];
  return `${testa}${mov.causale ? `: ${mov.causale}` : ''}`;
}

// Le amichevoli hanno id non numerici ('am1'): vanno tenuti come stringa.
export function idPartitaValido(id) {
  return /^\d+$/.test(String(id)) ? Number(id) : String(id);
}

const nomePartita = (id) => (amichevoleDi(id) || {}).nome || `partita ${id}`;

function partitaCassa(cassa, idPartita) {
  let pc = cassa.partite.find(p => p.idPartita === idPartita);
  if (!pc) { pc = { idPartita, costoCampo: null, presentiOverride: null }; cassa.partite.push(pc); }
  return pc;
}

export function impostaCostoCampo(cassa, idPartita, costoEuro) {
  const costo = Number(costoEuro);
  if (!(costo > 0)) throw new Error('Costo campo non valido');
  partitaCassa(cassa, idPartita).costoCampo = Math.round(costo * 100) / 100;
  return `Costo campo ${nomePartita(idPartita)}: ${formattaEuro(centesimi(costo))}`;
}

// Le spunte sui giocatori valgono come dichiarazione di presenza: senza spunte e senza
// "a mano" si torna al tabellino. Prima le spunte si perdevano se la casella era spenta.
export function presenzeDaSalvare(ids, aMano) {
  if (ids.length) return ids;
  return aMano ? [] : null;
}

export function impostaPresenze(cassa, idPartita, ids) {
  partitaCassa(cassa, idPartita).presentiOverride = ids ? [...new Set(ids)] : null;
  return ids ? `Presenze ${nomePartita(idPartita)}: ${ids.length} giocatori` : `Presenze ${nomePartita(idPartita)}: dal tabellino`;
}

export function impostaDataPartita(cassa, idPartita, data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) throw new Error('Data non valida');
  partitaCassa(cassa, idPartita).data = data;
  return `Data ${nomePartita(idPartita)}: ${data}`;
}

export function aggiornaGiocatore(cassa, id, { nickname, attivo }) {
  const g = cassa.giocatori.find(x => x.id === id);
  if (!g) throw new Error('Giocatore non trovato');
  if (nickname != null) { if (!nickname.trim()) throw new Error('Nickname vuoto'); g.nickname = nickname.trim(); }
  if (attivo != null) g.attivo = !!attivo;
  return `Giocatore ${g.nickname}: ${g.attivo ? 'attivo' : 'inattivo'}`;
}

export function unisciGiocatori(cassa, idDa, idIn) {
  const da = cassa.giocatori.find(x => x.id === idDa), a = cassa.giocatori.find(x => x.id === idIn);
  if (!da || !a || idDa === idIn) throw new Error('Scegli due giocatori diversi');
  for (const m of cassa.movimenti) if (m.giocatoreId === idDa) m.giocatoreId = idIn;
  for (const p of cassa.partite) if (Array.isArray(p.presentiOverride)) p.presentiOverride = [...new Set(p.presentiOverride.map(x => (x === idDa ? idIn : x)))];
  a.alias = [...new Set([...(a.alias || []), da.nomeSito, ...(da.alias || [])])];
  cassa.giocatori = cassa.giocatori.filter(x => x.id !== idDa);
  return `Unito ${da.nickname} in ${a.nickname}`;
}

export function aggiornaConfig(cassa, cfg) {
  const costo = Number(cfg.costoCampoDefault), mora = Number(cfg.moraGiorni);
  const quotaFissa = cfg.quotaFissa != null && cfg.quotaFissa !== '' ? Number(cfg.quotaFissa) : null;
  const arr = cfg.arrotondamento != null && cfg.arrotondamento !== '' ? Number(cfg.arrotondamento) : 0.5;
  if (!(costo > 0)) throw new Error('Costo campo non valido');
  if (quotaFissa != null && !(quotaFissa > 0)) throw new Error('Quota fissa non valida');
  if (!(arr > 0)) throw new Error('Arrotondamento non valido');
  if (!(mora >= 0)) throw new Error('Giorni mora non validi');
  for (const t of cfg.tipiMulta) if (!t.id || !t.nome) throw new Error('Tipo multa incompleto');
  cassa.config = { ...cassa.config, costoCampoDefault: costo, ...(quotaFissa != null ? { quotaFissa } : {}), arrotondamento: arr, moraGiorni: mora,
    tipiMulta: cfg.tipiMulta.map(t => ({ id: t.id, nome: t.nome, importo: t.importo == null || t.importo === '' ? null : Number(t.importo) })) };
  return 'Aggiornata configurazione cassa';
}
