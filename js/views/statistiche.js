import { partiteSquadra, filtra, statGiocatori, statSquadra, testaATesta, schedaGiocatore } from '../stats.js';
import { esc, formattaData } from '../util.js';
import { nomeSquadra, badgeEsito, card, vuoto, iconaLuogo } from './comuni.js';

const filtri = { luogo: 'tutte', avversarioId: '', da: '', a: '' };

function descrizionePartita(p, dati) {
  return `${badgeEsito(p.esito)} ${iconaLuogo(p.casa)} ${esc(nomeSquadra(dati, p.avversarioId))} ${p.gf}-${p.gs} <span class="muto">${esc(formattaData(p.data))}</span>`;
}

function scheda(nome, dati) {
  const s = schedaGiocatore(partiteSquadra(dati.torneo), dati.torneo.squadra.id, nome);
  return `
    <p><a href="#statistiche">← Statistiche</a></p>
    <h2>${esc(nome)}</h2>
    <div class="griglia">
      <div class="cella"><div class="n">${s.presenze}</div><div class="l">presenze</div></div>
      <div class="cella"><div class="n">${s.gol}</div><div class="l">gol</div></div>
      <div class="cella"><div class="n">${s.votoMedio ?? '–'}</div><div class="l">voto medio</div></div>
      <div class="cella"><div class="n">${s.mvp}</div><div class="l">⭐ migliore</div></div>
      <div class="cella"><div class="n">${s.ammonizioni}</div><div class="l">🟨</div></div>
    </div>
    <h3>Partita per partita</h3>
    ${card('', s.perPartita.length ? `<table class="tab"><thead><tr><th class="sx">Partita</th><th>Gol</th><th>Voto</th><th></th></tr></thead><tbody>${s.perPartita.map(p => `<tr><td class="sx">${descrizionePartita(p, dati)}</td><td>${p.gol || ''}</td><td>${p.voto ?? ''}</td><td>${p.mvp ? '⭐' : ''}${p.ammonito ? '🟨' : ''}</td></tr>`).join('')}</tbody></table>` : vuoto('Nessuna presenza'))}
    <h3>Partite saltate</h3>
    ${card('', s.saltate.length ? s.saltate.map(p => `<div>${descrizionePartita(p, dati)}</div>`).join('') : vuoto('Sempre presente 💪'))}`;
}

export function render({ dati, rotta }) {
  if (rotta[1] === 'giocatore' && rotta[2]) return scheda(rotta[2], dati);
  const t = dati.torneo;
  const tutte = partiteSquadra(t);
  const partite = filtra(tutte, { ...filtri, avversarioId: filtri.avversarioId ? Number(filtri.avversarioId) : undefined, da: filtri.da || undefined, a: filtri.a || undefined });
  const sq = statSquadra(partite);
  const gioc = statGiocatori(partite, t.squadra.id);
  const h2h = testaATesta(partite, t.squadre);
  const avversari = t.squadre.filter(s => s.id !== t.squadra.id).sort((a, b) => a.nome.localeCompare(b.nome));
  const rec = (p, etichetta) => p ? `<div class="riga"><span>${etichetta}</span><span>${descrizionePartita(p, dati)}</span></div>` : '';

  return `
    <h2>Statistiche</h2>
    <form id="filtri" class="filtri">
      <label>Dove<select name="luogo">${[['tutte', 'Tutte'], ['casa', 'Casa'], ['trasferta', 'Trasferta']].map(([k, l]) => `<option value="${k}" ${filtri.luogo === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Avversario<select name="avversarioId"><option value="">Tutti</option>${avversari.map(s => `<option value="${s.id}" ${String(s.id) === filtri.avversarioId ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')}</select></label>
      <label>Dal<input type="date" name="da" value="${esc(filtri.da)}"></label>
      <label>Al<input type="date" name="a" value="${esc(filtri.a)}"></label>
    </form>
    <p class="muto">${partite.filter(p => p.giocata).length} partite giocate nel filtro</p>
    <div class="griglia">
      <div class="cella"><div class="n">${sq.v}-${sq.n}-${sq.p}</div><div class="l">V-N-P</div></div>
      <div class="cella"><div class="n">${sq.gf}:${sq.gs}</div><div class="l">gol fatti:subiti</div></div>
      <div class="cella"><div class="n">${sq.mediaGf}</div><div class="l">gol a partita</div></div>
      <div class="cella"><div class="n">${sq.ultime.map(e => `<span class="esito ${e}">${e}</span>`).join(' ') || '–'}</div><div class="l">ultime</div></div>
    </div>
    ${(sq.record.vittoriaPiuLarga || sq.record.piuGol) ? card('Record', rec(sq.record.vittoriaPiuLarga, 'Vittoria più larga') + rec(sq.record.sconfittaPiuPesante, 'Sconfitta più pesante') + rec(sq.record.piuGol, 'Partita con più gol')) : ''}
    <h3>Giocatori</h3>
    ${card('', gioc.length ? `<div class="scroll-x"><table class="tab"><thead><tr><th class="sx">Giocatore</th><th>Gol</th><th>Pres.</th><th>Gol/p</th><th>Voto</th><th>⭐</th><th>🟨</th></tr></thead><tbody>${gioc.map(g => `<tr><td class="sx nome"><a href="#statistiche/giocatore/${encodeURIComponent(g.nome)}">${esc(g.nome)}</a></td><td><strong>${g.gol}</strong></td><td>${g.presenze}</td><td>${g.golPerPartita}</td><td>${g.votoMedio ?? '–'}</td><td>${g.mvp || ''}</td><td>${g.ammonizioni || ''}</td></tr>`).join('')}</tbody></table></div>` : vuoto('Nessun tabellino nel filtro'))}
    <h3>Testa a testa</h3>
    ${card('', h2h.length ? `<table class="tab"><thead><tr><th class="sx">Avversario</th><th>G</th><th>V</th><th>N</th><th>P</th><th>GF:GS</th></tr></thead><tbody>${h2h.map(x => `<tr><td class="sx nome">${esc(x.nome)}</td><td>${x.g}</td><td>${x.v}</td><td>${x.n}</td><td>${x.p}</td><td>${x.gf}:${x.gs}</td></tr>`).join('')}</tbody></table>` : vuoto('Nessuna partita nel filtro'))}`;
}

export function dopo(ctx, root) {
  const form = root.querySelector('#filtri');
  if (!form) return;
  form.onchange = () => {
    Object.assign(filtri, Object.fromEntries(new FormData(form)));
    root.innerHTML = render(ctx); dopo(ctx, root);
  };
}
