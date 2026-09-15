import { partiteSquadra } from '../stats.js';
import { esc, formattaData } from '../util.js';
import { nomeSquadra, badgeEsito } from './comuni.js';

let mostraTutte = false;

export function tabellinoHtml(p, dati) {
  const tab = p.tabellino;
  if (!tab) return '<p class="muto">Tabellino non ancora disponibile</p>';
  const noi = dati.torneo.squadra.id;
  const casaId = p.casa ? noi : p.avversarioId, ospId = p.casa ? p.avversarioId : noi;
  const lista = (id) => tab.marcatori.filter(m => m.squadraId === id).map(m => `${esc(m.nome)} ${m.minuto}'`).join('<br>') || '<span class="muto">–</span>';
  const formazione = (id) => tab.formazioni.filter(f => f.squadraId === id)
    .map(f => `<tr><td>${f.numero ?? ''}</td><td class="sx nome">${esc(f.nome)}${f.ammonito ? ' 🟨' : ''}${f.espulso ? ' 🟥' : ''}${tab.migliore && tab.migliore.squadraId === id && tab.migliore.nome === f.nome ? ' ⭐' : ''}</td><td>${f.voto ?? ''}</td></tr>`).join('');
  return `
    <div class="marcatori"><div>${lista(casaId)}</div><div class="osp">${lista(ospId)}</div></div>
    ${tab.migliore ? `<p>⭐ Migliore in campo: <strong>${esc(tab.migliore.nome)}</strong> (${esc(nomeSquadra(dati, tab.migliore.squadraId))})</p>` : ''}
    <div class="formazioni">
      ${[casaId, ospId].map(id => `<div><table class="tab"><thead><tr><th>#</th><th class="sx">${esc(nomeSquadra(dati, id))}</th><th>voto</th></tr></thead><tbody>${formazione(id) || '<tr><td colspan="3" class="muto">formazione non disponibile</td></tr>'}</tbody></table></div>`).join('')}
    </div>`;
}

function rigaNostra(p, dati) {
  const casa = p.casa ? dati.torneo.squadra.nome : nomeSquadra(dati, p.avversarioId);
  const osp = p.casa ? nomeSquadra(dati, p.avversarioId) : dati.torneo.squadra.nome;
  const ris = p.giocata ? (p.casa ? `${p.gf} - ${p.gs}` : `${p.gs} - ${p.gf}`) : esc(p.ora || '–');
  return `
    <details class="partita-det" id="p${p.id}">
      <summary class="partita">
        <span class="sq">${esc(casa)}</span><span class="ris">${ris}</span><span class="sq osp">${esc(osp)}</span>
        <span class="quando">${badgeEsito(p.esito)} ${esc(formattaData(p.data))}${p.tavolino ? ' · a tavolino' : ''}</span>
      </summary>
      <div class="dettaglio">${p.giocata ? tabellinoHtml(p, dati) : '<p class="muto">Partita da giocare</p>'}</div>
    </details>`;
}

function rigaAltri(p, dati) {
  return `<div class="partita" id="p${p.id}"><span class="sq">${esc(nomeSquadra(dati, p.casaId))}</span><span class="ris">${p.giocata ? `${p.golCasa} - ${p.golOspite}` : esc(p.ora || '–')}</span><span class="sq osp">${esc(nomeSquadra(dati, p.ospiteId))}</span><span class="quando">${esc(formattaData(p.data))}</span></div>`;
}

export function render({ dati }) {
  const t = dati.torneo;
  const nostre = partiteSquadra(t);
  const giornate = [...new Set(t.partite.map(p => p.giornata))].sort((a, b) => a - b);
  const corpo = giornate.map(g => {
    const nostra = nostre.find(p => p.giornata === g);
    const altre = t.partite.filter(p => p.giornata === g && p.casaId !== t.squadra.id && p.ospiteId !== t.squadra.id);
    if (!nostra && !mostraTutte) return '';
    return `<h3>Giornata ${g}</h3><section class="card">${nostra ? rigaNostra(nostra, dati) : ''}${mostraTutte ? altre.map(p => rigaAltri(p, dati)).join('') : ''}</section>`;
  }).join('');
  return `
    <h2>Calendario</h2>
    <div class="segmenti"><button data-tutte="0" class="${mostraTutte ? '' : 'attivo'}">Solo ${esc(t.squadra.nome)}</button><button data-tutte="1" class="${mostraTutte ? 'attivo' : ''}">Tutta la giornata</button></div>
    ${corpo || '<p class="vuoto">Calendario non disponibile</p>'}`;
}

export function dopo(ctx, root) {
  root.querySelectorAll('.segmenti button').forEach(b => { b.onclick = () => { mostraTutte = b.dataset.tutte === '1'; root.innerHTML = render(ctx); dopo(ctx, root); }; });
  try {
    // Evitiamo :has() (non supportato su alcuni browser meno recenti, dove solleverebbe
    // un'eccezione e interromperebbe renderApp prima di agganciare il bottone Esci).
    const dettagli = [...root.querySelectorAll('details.partita-det')];
    const prossima = dettagli.find(d => d.querySelector('.esito')?.classList.contains('x'));
    if (prossima) prossima.scrollIntoView({ block: 'center' });
  } catch (e) {
    console.error('calendario: scroll alla prossima partita fallito', e);
  }
}
