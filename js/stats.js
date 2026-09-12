// Statistiche di squadra e individuali. Funzioni pure su torneo.json. Vedi spec §5.2 punto 4.

export function partiteSquadra(torneo) {
  const noi = torneo.squadra.id;
  return torneo.partite
    .filter(p => p.casaId === noi || p.ospiteId === noi)
    .map(p => {
      const casa = p.casaId === noi;
      const gf = casa ? p.golCasa : p.golOspite;
      const gs = casa ? p.golOspite : p.golCasa;
      const esito = !p.giocata ? null : gf > gs ? 'V' : gf < gs ? 'P' : 'N';
      return { id: p.id, giornata: p.giornata, data: p.data, ora: p.ora, casa, avversarioId: casa ? p.ospiteId : p.casaId,
        gf, gs, esito, giocata: p.giocata, tavolino: p.tavolino, tabellino: torneo.tabellini[String(p.id)] || null };
    })
    .sort((a, b) => a.giornata - b.giornata);
}

export function filtra(partite, { da, a, avversarioId, luogo = 'tutte' } = {}) {
  return partite.filter(p => {
    if (luogo === 'casa' && !p.casa) return false;
    if (luogo === 'trasferta' && p.casa) return false;
    if (avversarioId && p.avversarioId !== avversarioId) return false;
    if ((da || a) && !p.data) return false;
    if (da && p.data < da) return false;
    if (a && p.data > a) return false;
    return true;
  });
}

const giocate = (partite) => partite.filter(p => p.giocata && p.tabellino);

function accumula(partite, idsquadra) {
  const per = new Map();
  const get = (nome) => {
    if (!per.has(nome)) per.set(nome, { nome, presenze: 0, gol: 0, voti: [], ammonizioni: 0, mvp: 0 });
    return per.get(nome);
  };
  for (const p of giocate(partite)) {
    for (const f of p.tabellino.formazioni) {
      if (f.squadraId !== idsquadra) continue;
      const g = get(f.nome);
      g.presenze++;
      if (f.voto != null) g.voti.push(f.voto);
      if (f.ammonito) g.ammonizioni++;
    }
    for (const m of p.tabellino.marcatori) if (m.squadraId === idsquadra) get(m.nome).gol++;
    const mig = p.tabellino.migliore;
    if (mig && mig.squadraId === idsquadra) get(mig.nome).mvp++;
  }
  return per;
}

const media = (xs) => xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100 : null;

export function statGiocatori(partite, idsquadra) {
  return [...accumula(partite, idsquadra).values()]
    .map(g => ({ nome: g.nome, presenze: g.presenze, gol: g.gol,
      golPerPartita: g.presenze ? Math.round((g.gol / g.presenze) * 100) / 100 : 0,
      votoMedio: media(g.voti), ammonizioni: g.ammonizioni, mvp: g.mvp }))
    .sort((a, b) => b.gol - a.gol || b.presenze - a.presenze || a.nome.localeCompare(b.nome));
}

export function statSquadra(partite) {
  const gs = partite.filter(p => p.giocata);
  const conta = (e) => gs.filter(p => p.esito === e).length;
  const gf = gs.reduce((s, p) => s + p.gf, 0), gsub = gs.reduce((s, p) => s + p.gs, 0);
  const primo = (arr, punteggio) => arr.length ? arr.reduce((m, p) => (punteggio(p) > punteggio(m) ? p : m)) : null;
  return {
    g: gs.length, v: conta('V'), n: conta('N'), p: conta('P'), gf, gs: gsub,
    mediaGf: gs.length ? Math.round((gf / gs.length) * 100) / 100 : 0,
    mediaGs: gs.length ? Math.round((gsub / gs.length) * 100) / 100 : 0,
    ultime: gs.slice(-5).map(p => p.esito),
    record: {
      vittoriaPiuLarga: primo(gs.filter(p => p.esito === 'V'), p => p.gf - p.gs),
      sconfittaPiuPesante: primo(gs.filter(p => p.esito === 'P'), p => p.gs - p.gf),
      piuGol: primo(gs, p => p.gf + p.gs),
    },
  };
}

export function testaATesta(partite, squadre) {
  const nome = new Map(squadre.map(s => [s.id, s.nome]));
  const per = new Map();
  for (const p of partite.filter(x => x.giocata)) {
    if (!per.has(p.avversarioId)) per.set(p.avversarioId, { avversarioId: p.avversarioId, nome: nome.get(p.avversarioId) || '?', g: 0, v: 0, n: 0, p: 0, gf: 0, gs: 0 });
    const t = per.get(p.avversarioId);
    t.g++; t.gf += p.gf; t.gs += p.gs;
    if (p.esito === 'V') t.v++; else if (p.esito === 'N') t.n++; else t.p++;
  }
  return [...per.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

export function schedaGiocatore(partite, idsquadra, nome) {
  const perPartita = [], saltate = [];
  for (const p of giocate(partite)) {
    const f = p.tabellino.formazioni.find(x => x.squadraId === idsquadra && x.nome === nome);
    if (!f) { saltate.push(p); continue; }
    perPartita.push({ idPartita: p.id, data: p.data, avversarioId: p.avversarioId, casa: p.casa, gf: p.gf, gs: p.gs, esito: p.esito,
      gol: p.tabellino.marcatori.filter(m => m.squadraId === idsquadra && m.nome === nome).length,
      voto: f.voto, ammonito: f.ammonito, mvp: !!(p.tabellino.migliore && p.tabellino.migliore.squadraId === idsquadra && p.tabellino.migliore.nome === nome) });
  }
  return { nome, presenze: perPartita.length, gol: perPartita.reduce((s, x) => s + x.gol, 0),
    votoMedio: media(perPartita.map(x => x.voto).filter(v => v != null)),
    ammonizioni: perPartita.filter(x => x.ammonito).length, mvp: perPartita.filter(x => x.mvp).length, perPartita, saltate };
}

export function andamentoPosizione(torneo) {
  const noi = torneo.squadra.id;
  return Object.entries(torneo.classifica.perGiornata || {})
    .map(([g, righe]) => ({ giornata: Number(g), riga: righe.find(r => r.squadraId === noi) }))
    .filter(x => x.riga).sort((a, b) => a.giornata - b.giornata)
    .map(x => ({ giornata: x.giornata, pos: x.riga.pos, pt: x.riga.pt }));
}

export function prossimaPartita(partite, oggi) {
  const future = partite.filter(p => !p.giocata);
  return future.find(p => p.data && p.data >= oggi) || future.find(p => !p.data) || future[0] || null;
}

export function ultimaPartita(partite) {
  const gs = partite.filter(p => p.giocata);
  return gs.length ? gs[gs.length - 1] : null;
}
