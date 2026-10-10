// Operazioni del cassiere su cassa.json. Funzioni pure che mutano l'oggetto e restituiscono il messaggio di commit.
import { formattaEuro, centesimi } from './util.js';
import { amichevoleDi, calcolaCassa } from './cassa.js';

const TIPI = new Set(['pagamento', 'multa', 'spesa', 'rettifica', 'entrata']);
const SENZA_GIOCATORE = new Set(['spesa', 'entrata']);
const numeroId = (id) => Number(String(id).slice(1)) || 0;

// contatoreMovimenti ricorda l'ultimo id usato anche dopo un annullamento, così un id
// annullato non torna su un movimento nuovo (la cronologia su GitHub resta leggibile).
export function prossimoIdMovimento(cassa) {
  const max = (cassa.movimenti || []).reduce((m, x) => Math.max(m, numeroId(x.id)), cassa.contatoreMovimenti || 0);
  return 'm' + String(max + 1).padStart(4, '0');
}

export function aggiungiMovimento(cassa, m, nickDi) {
  if (!TIPI.has(m.tipo)) throw new Error('Tipo movimento non valido');
  const importo = Number(m.importo);
  if (!Number.isFinite(importo)) throw new Error('Importo non valido');
  if (m.tipo === 'rettifica' ? importo === 0 : importo <= 0) throw new Error('Importo: deve essere maggiore di zero');
  if (!SENZA_GIOCATORE.has(m.tipo) && !m.giocatoreId) throw new Error('Scegli il giocatore');
  if ((m.tipo === 'rettifica' || SENZA_GIOCATORE.has(m.tipo) || (m.tipo === 'multa' && m.tipoMulta === 'libera')) && !(m.causale || '').trim()) throw new Error('La causale è obbligatoria');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.data || '')) throw new Error('Data non valida');
  const mov = { id: prossimoIdMovimento(cassa), data: m.data, tipo: m.tipo, importo: Math.round(importo * 100) / 100, causale: (m.causale || '').trim() };
  if (m.giocatoreId && !SENZA_GIOCATORE.has(m.tipo)) mov.giocatoreId = m.giocatoreId;
  if (m.idPartita) mov.idPartita = idPartitaValido(m.idPartita);
  if (m.tipo === 'multa') mov.tipoMulta = m.tipoMulta || 'libera';
  cassa.movimenti.push(mov);
  return descriviMovimento(mov, nickDi);
}

export function descriviMovimento(mov, nickDi) {
  const chi = mov.giocatoreId ? nickDi(mov.giocatoreId) : '';
  const eur = formattaEuro(centesimi(mov.importo));
  const testa = { pagamento: `Pagamento ${eur} da ${chi}`, multa: `Multa ${eur} a ${chi}`, spesa: `Spesa ${eur}`,
    rettifica: `Rettifica ${eur} su ${chi}`, entrata: `Entrata ${eur}` }[mov.tipo] || `${mov.tipo} ${eur}`;
  return `${testa}${mov.causale ? `: ${mov.causale}` : ''}`;
}

export function annullaMovimento(cassa, id, nickDi) {
  const mov = cassa.movimenti.find(m => m.id === id);
  if (!mov) throw new Error('Movimento non trovato: forse è già stato annullato');
  cassa.movimenti = cassa.movimenti.filter(m => m.id !== id);
  cassa.contatoreMovimenti = Math.max(cassa.contatoreMovimenti || 0, numeroId(id));
  return `Annullato ${id}: ${descriviMovimento(mov, nickDi)}`;
}

// Rettifica senza segni: si sceglie se il giocatore deve di più o di meno, l'importo è sempre positivo.
export function importoRettifica(verso, importo) {
  const n = Number(importo);
  if (!(n > 0)) throw new Error('Importo: deve essere maggiore di zero');
  if (verso === 'piu') return n;
  if (verso === 'meno') return -n;
  throw new Error('Scegli se deve di più o di meno');
}

// Saldo del giocatore prima e dopo il movimento, su una copia: null se il movimento non è valido.
export function anteprimaSaldo(cassa, torneo, oggi, mov) {
  const saldoDi = (cs) => calcolaCassa(cs, torneo, oggi).giocatori.find(g => g.id === mov.giocatoreId)?.saldoCent;
  const copia = structuredClone(cassa);
  try { aggiungiMovimento(copia, mov, (x) => x); } catch { return null; }
  const primaCent = saldoDi(cassa);
  return primaCent == null ? null : { primaCent, dopoCent: saldoDi(copia) };
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

const normalizzaNome = (s) => String(s || '').trim().replace(/\s+/g, ' ').toUpperCase();
const inTitolo = (s) => s.toLowerCase().replace(/(^|[\s'-])\S/g, (x) => x.toUpperCase());

// Il nome sul sito (e gli alias) collegano il giocatore a tabellini e ListaSquadra.md: devono essere unici.
function controllaNomeLibero(cassa, nome, tranneId) {
  const doppio = cassa.giocatori.find(g => g.id !== tranneId && [g.nomeSito, ...(g.alias || [])].map(normalizzaNome).includes(nome));
  if (doppio) throw new Error(`${nome} è già in rosa: ${doppio.nickname}`);
}

export function aggiungiGiocatore(cassa, { nomeSito, nickname }) {
  const nome = normalizzaNome(nomeSito);
  if (!nome) throw new Error('Scrivi il nome come sul sito del torneo (COGNOME NOME)');
  controllaNomeLibero(cassa, nome);
  const max = cassa.giocatori.reduce((m, g) => Math.max(m, numeroId(g.id)), 0);
  const g = { id: 'g' + String(max + 1).padStart(2, '0'), nomeSito: nome, nickname: (nickname || '').trim() || inTitolo(nome), attivo: true };
  cassa.giocatori.push(g);
  return `Nuovo giocatore ${g.nickname} (${g.nomeSito})`;
}

export function aggiornaGiocatore(cassa, id, { nickname, attivo, nomeSito, ignorato, mister }) {
  const g = cassa.giocatori.find(x => x.id === id);
  if (!g) throw new Error('Giocatore non trovato');
  if (nomeSito != null && normalizzaNome(nomeSito) !== g.nomeSito) {
    const nome = normalizzaNome(nomeSito);
    if (!nome) throw new Error('Nome sul sito vuoto');
    controllaNomeLibero(cassa, nome, id);
    // Il vecchio nome resta come alias: senza, la build lo ricreerebbe come doppione.
    g.alias = [...new Set([...(g.alias || []), g.nomeSito])].filter(a => a !== nome);
    g.nomeSito = nome;
  }
  if (nickname != null) { if (!nickname.trim()) throw new Error('Nickname vuoto'); g.nickname = nickname.trim(); }
  if (attivo != null) g.attivo = !!attivo;
  // Nome da ignorare (ex giocatore o nome inesistente nel tabellino): mai presenze, mai in rosa attiva.
  if (ignorato === true) { g.ignorato = true; g.attivo = false; return `Giocatore ${g.nickname}: nome ignorato`; }
  if (ignorato === false) delete g.ignorato;
  if (mister === true) { g.mister = true; return `Giocatore ${g.nickname}: mister (non paga quote)`; }
  if (mister === false) delete g.mister;
  return `Giocatore ${g.nickname}: ${g.attivo ? 'attivo' : 'inattivo'}`;
}

export function anteprimaUnione(cassa, idDa) {
  return {
    movimenti: cassa.movimenti.filter(m => m.giocatoreId === idDa).length,
    presenze: cassa.partite.filter(p => Array.isArray(p.presentiOverride) && p.presentiOverride.includes(idDa)).length,
  };
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
