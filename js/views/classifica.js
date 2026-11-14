import { andamentoPosizione } from '../stats.js';
import { esc } from '../util.js';

let tipo = 'totale'; // 'totale' | 'casa' | 'trasferta'

export function graficoPosizione(punti, nSquadre) {
  if (punti.length < 2) return '<p class="vuoto">Il grafico compare dopo la seconda giornata</p>';
  const W = 600, H = 220, mx = 34, my = 18;
  const gMax = Math.max(...punti.map(p => p.giornata));
  const x = (g) => mx + ((g - 1) / Math.max(1, gMax - 1)) * (W - 2 * mx);
  const y = (pos) => my + ((pos - 1) / Math.max(1, nSquadre - 1)) * (H - 2 * my);
  const linee = [1, Math.ceil(nSquadre / 2), nSquadre].map(p => `<line x1="${mx}" x2="${W - mx}" y1="${y(p)}" y2="${y(p)}" stroke="currentColor" stroke-opacity=".15"/><text x="4" y="${y(p) + 4}" font-size="11" fill="currentColor" opacity=".6">${p}º</text>`).join('');
  const pts = punti.map(p => `${x(p.giornata)},${y(p.pos)}`).join(' ');
  const dots = punti.map(p => `<circle class="punto" cx="${x(p.giornata)}" cy="${y(p.pos)}" r="4" stroke-width="2"><title>giornata ${p.giornata}: ${p.pos}º, ${p.pt} pt</title></circle>`).join('');
  const etichette = punti.filter((_, i) => i === 0 || i === punti.length - 1 || punti.length <= 10).map(p => `<text x="${x(p.giornata)}" y="${H - 2}" font-size="11" text-anchor="middle" fill="currentColor" opacity=".6">g${p.giornata}</text>`).join('');
  return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Posizione in classifica per giornata">${linee}<polyline class="linea" points="${pts}" fill="none" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${dots}${etichette}</svg>`;
}

export function render({ dati }) {
  const t = dati.torneo;
  const righe = t.classifica[tipo] || [];
  const tabella = righe.length ? `
    <div class="scroll-x"><table class="tab">
      <thead><tr><th>#</th><th class="sx">Squadra</th><th>PT</th><th>G</th><th>V</th><th>N</th><th>P</th><th>GF</th><th>GS</th><th>DR</th></tr></thead>
      <tbody>${righe.map(r => `<tr class="${r.squadraId === t.squadra.id ? 'noi' : ''}"><td>${r.pos}</td><td class="sx nome">${esc(r.nome)}</td><td><strong>${r.pt}</strong></td><td>${r.g}</td><td>${r.v}</td><td>${r.n}</td><td>${r.p}</td><td>${r.gf}</td><td>${r.gs}</td><td>${r.dr > 0 ? '+' : ''}${r.dr}</td></tr>`).join('')}</tbody>
    </table></div>` : '<p class="vuoto">Classifica non disponibile</p>';
  return `
    <h2>${esc(t.girone.nome)} · ${esc(t.girone.stagione)}</h2>
    <div class="segmenti">${[['totale', 'Totale'], ['casa', 'Casa'], ['trasferta', 'Trasferta']].map(([k, l]) => `<button data-tipo="${k}" class="${tipo === k ? 'attivo' : ''}">${l}</button>`).join('')}</div>
    <section class="card">${tabella}</section>
    <h3>Andamento ${esc(t.squadra.nome)}</h3>
    <section class="card">${graficoPosizione(andamentoPosizione(t), t.squadre.length)}</section>`;
}

export function dopo(ctx, root) {
  root.querySelectorAll('.segmenti button').forEach(b => { b.onclick = () => { tipo = b.dataset.tipo; root.innerHTML = render(ctx); dopo(ctx, root); }; });
}
