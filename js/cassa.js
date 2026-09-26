// Calcoli della cassa: funzioni pure su (cassa.json, torneo.json). Vedi spec §4.2.
import { centesimi, giorniTra } from './util.js';
import { mappaNomi } from './nomi.js';

// Il mister è sempre in panchina (e nel tabellino) ma non gioca e non paga la quota.
const nonPaganti = (cassa) => new Set(cassa.giocatori.filter(g => g.mister).map(g => g.id));

export function presentiPartita(idPartita, cassa, torneo) {
  const esclusi = nonPaganti(cassa);
  const pc = cassa.partite.find(p => p.idPartita === idPartita);
  if (pc && Array.isArray(pc.presentiOverride)) return pc.presentiOverride.filter(id => !esclusi.has(id));
  const tab = torneo.tabellini[String(idPartita)];
  if (!tab) return [];
  const perNome = mappaNomi(cassa);
  const nostro = torneo.squadra.id;
  return [...new Set(tab.formazioni.filter(f => f.squadraId === nostro).map(f => perNome.get(f.nome)).filter(id => id && !esclusi.has(id)))];
}

// Slot fuori calendario: partite non del campionato (amichevoli), con data, costo campo e
// presenze inseriti a mano dall'admin. Gli id non sono numerici, così non collidono col sito.
export const AMICHEVOLI = [
  { id: 'am1', nome: 'Amichevole 1', sigla: 'A1' },
  { id: 'am2', nome: 'Amichevole 2', sigla: 'A2' },
];

export const amichevoleDi = (id) => AMICHEVOLI.find(a => a.id === id) || null;

export function quotaPartita(costoCampoCent, nPresenti, arrotondamentoCent = 50, quotaFissaCent = null) {
  if (nPresenti <= 0) return { quotaCent: 0, avanzoCent: 0 };
  if (quotaFissaCent != null && quotaFissaCent > 0) {
    const quotaCent = quotaFissaCent;
    return { quotaCent, avanzoCent: quotaCent * nPresenti - costoCampoCent };
  }
  const arr = arrotondamentoCent > 0 ? arrotondamentoCent : 1;
  const quotaCent = Math.ceil(costoCampoCent / nPresenti / arr) * arr;
  return { quotaCent, avanzoCent: quotaCent * nPresenti - costoCampoCent };
}

export function calcolaCassa(cassa, torneo, oggi) {
  const nostro = torneo.squadra.id;
  const cfg = cassa.config;
  const costoDefaultCent = centesimi(cfg.costoCampoDefault);
  const arrCent = cfg.arrotondamento != null ? centesimi(cfg.arrotondamento) : 50;
  const quotaFissaCent = cfg.quotaFissa != null ? centesimi(cfg.quotaFissa) : null;

  const quote = [];
  for (const p of torneo.partite) {
    if (p.casaId !== nostro && p.ospiteId !== nostro) continue;
    const pc = cassa.partite.find(x => x.idPartita === p.id);
    // Senza tabellino la quota nasce solo se il cassiere ha spuntato le presenze a mano.
    if (!p.giocata && !Array.isArray(pc && pc.presentiOverride)) continue;
    const presenti = presentiPartita(p.id, cassa, torneo);
    if (presenti.length === 0) continue;
    const costoCampoCent = pc && pc.costoCampo != null ? centesimi(pc.costoCampo) : costoDefaultCent;
    const { quotaCent, avanzoCent } = quotaPartita(costoCampoCent, presenti.length, arrCent, quotaFissaCent);
    quote.push({ idPartita: p.id, giornata: p.giornata, data: p.data, costoCampoCent, presenti, quotaCent, avanzoCent });
  }

  for (const a of AMICHEVOLI) {
    const pc = cassa.partite.find(x => x.idPartita === a.id);
    if (!pc || !Array.isArray(pc.presentiOverride) || pc.presentiOverride.length === 0) continue;
    const presenti = [...new Set(pc.presentiOverride)].filter(id => !nonPaganti(cassa).has(id));
    const costoCampoCent = pc.costoCampo != null ? centesimi(pc.costoCampo) : costoDefaultCent;
    const { quotaCent, avanzoCent } = quotaPartita(costoCampoCent, presenti.length, arrCent, quotaFissaCent);
    quote.push({ idPartita: a.id, giornata: null, nome: a.nome, sigla: a.sigla, data: pc.data || null,
      costoCampoCent, presenti, quotaCent, avanzoCent });
  }

  const movimenti = cassa.movimenti
    .map(m => ({ ...m, importoCent: centesimi(m.importo) }))
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));

  const giocatori = cassa.giocatori.map(g => {
    const mie = movimenti.filter(m => m.giocatoreId === g.id);
    const quoteMie = quote.filter(q => q.presenti.includes(g.id));
    const multe = mie.filter(m => m.tipo === 'multa');
    const dovutoCent = quoteMie.reduce((s, q) => s + q.quotaCent, 0)
      + multe.reduce((s, m) => s + m.importoCent, 0)
      + mie.filter(m => m.tipo === 'rettifica').reduce((s, m) => s + m.importoCent, 0);
    const pagatoCent = mie.filter(m => m.tipo === 'pagamento').reduce((s, m) => s + m.importoCent, 0);
    return { id: g.id, nickname: g.nickname, nomeSito: g.nomeSito, attivo: g.attivo !== false && !g.ignorato, ignorato: !!g.ignorato, mister: !!g.mister,
      dovutoCent, pagatoCent, saldoCent: pagatoCent - dovutoCent, nQuote: quoteMie.length, nMulte: multe.length };
  });
  const saldoDi = new Map(giocatori.map(g => [g.id, g.saldoCent]));

  const avvisiMora = [];
  for (const q of quote) {
    if (!q.data) continue;
    const giorni = giorniTra(q.data, oggi);
    if (giorni <= cfg.moraGiorni) continue;
    for (const id of q.presenti) {
      if ((saldoDi.get(id) ?? 0) >= 0) continue;
      const giaApplicata = movimenti.some(m => m.tipo === 'multa' && m.tipoMulta === 'mora' && m.giocatoreId === id && m.idPartita === q.idPartita);
      if (!giaApplicata) avvisiMora.push({ giocatoreId: id, idPartita: q.idPartita, data: q.data, giorni });
    }
  }

  const somma = (tipo) => movimenti.filter(m => m.tipo === tipo).reduce((s, m) => s + m.importoCent, 0);
  // Il costo del campo esce dal fondo cassa da solo: non va registrato anche come spesa.
  const costoCampoTotaleCent = quote.reduce((s, q) => s + q.costoCampoCent, 0);
  return {
    saldoCassaCent: somma('pagamento') + somma('entrata') - somma('spesa') - costoCampoTotaleCent,
    creditiAttesiCent: giocatori.reduce((s, g) => s + Math.max(0, -g.saldoCent), 0),
    // Il credito del mister è un contributo al fondo cassa, non un debito della cassa verso di lui.
    debitiVersoGiocatoriCent: giocatori.filter(g => !g.mister).reduce((s, g) => s + Math.max(0, g.saldoCent), 0),
    costoCampoTotaleCent,
    speseCent: somma('spesa'),
    entrateCent: somma('entrata'),
    saldoPartiteCent: quote.reduce((s, q) => s + q.avanzoCent, 0),
    quote, giocatori, avvisiMora, movimenti,
  };
}

// Effetto di un movimento sul saldo del giocatore: il pagamento aggiunge, multa e rettifica
// si sommano al dovuto (rettifica negativa = deve di meno = saldo che sale).
const segnoSaldo = (m) => (m.tipo === 'pagamento' ? m.importoCent : -m.importoCent);

// Tutte le righe che fanno il saldo di un giocatore, dalla più vecchia, con il saldo progressivo.
// Le quote non hanno id: non si annullano, si cambiano dalle presenze della partita.
export function estrattoConto(calcolo, giocatoreId) {
  const righe = [
    ...calcolo.quote.filter(q => q.presenti.includes(giocatoreId)).map(q => ({
      tipo: 'quota', data: q.data, idPartita: q.idPartita, importoCent: -q.quotaCent })),
    ...calcolo.movimenti.filter(m => m.giocatoreId === giocatoreId).map(m => ({
      ...m, importoCent: segnoSaldo(m) })),
  ].sort((a, b) => (a.data || '9999') < (b.data || '9999') ? -1 : (a.data || '9999') > (b.data || '9999') ? 1 : 0);
  let saldoCent = 0;
  for (const r of righe) { saldoCent += r.importoCent; r.saldoCent = saldoCent; }
  return { righe, saldoCent };
}

// Partite con presenze segnate a mano che non coincidono con il tabellino ufficiale.
export function controlloPresenze(cassa, torneo) {
  const perNome = mappaNomi(cassa);
  const nostro = torneo.squadra.id;
  const differenze = [];
  for (const pc of cassa.partite) {
    const tab = torneo.tabellini[String(pc.idPartita)];
    if (!tab || !Array.isArray(pc.presentiOverride)) continue;
    // I nomi da ignorare (ex giocatori, nomi inesistenti) non fanno differenza.
    const esclusi = nonPaganti(cassa);
    const nomi = tab.formazioni.filter(f => f.squadraId === nostro && perNome.get(f.nome) !== null && !esclusi.has(perNome.get(f.nome))).map(f => f.nome);
    const idsTab = new Set(nomi.map(n => perNome.get(n)).filter(Boolean));
    const aMano = new Set(pc.presentiOverride);
    const soloInCassa = [...aMano].filter(id => !idsTab.has(id) && !esclusi.has(id));
    const soloNelTabellino = nomi.map(nome => ({ nome, giocatoreId: perNome.get(nome) || null }))
      .filter(x => !x.giocatoreId || !aMano.has(x.giocatoreId));
    if (soloInCassa.length || soloNelTabellino.length) differenze.push({ idPartita: pc.idPartita, soloInCassa, soloNelTabellino });
  }
  return differenze;
}
