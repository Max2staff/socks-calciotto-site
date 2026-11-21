import { partiteSquadra } from '../stats.js';
import { esc, formattaData } from '../util.js';
import { nomeSquadra, badgeEsito } from './comuni.js';

// Il tabellino non sa chi siamo noi: lavora su casa e ospite di una partita qualsiasi del girone.
export function tabellinoHtml(tab, casaId, ospiteId, dati) {
  if (!tab) return '<p class="muto">Tabellino non ancora disponibile</p>';
  const lista = (id) => tab.marcatori.filter(m => m.squadraId === id).map(m => `${esc(m.nome)} ${m.minuto}'`).join('<br>') || '<span class="muto">–</span>';
  const formazione = (id) => tab.formazioni.filter(f => f.squadraId === id)
    .map(f => `<tr><td>${f.numero ?? ''}</td><td class="sx nome">${esc(f.nome)}${f.ammonito ? ' 🟨' : ''}${f.espulso ? ' 🟥' : ''}${tab.migliore && tab.migliore.squadraId === id && tab.migliore.nome === f.nome ? ' ⭐' : ''}</td><td>${f.voto ?? ''}</td></tr>`).join('');
  // Il nome squadra in testa alla formazione è la porta verso le sue statistiche: nessuna etichetta in più.
  const intestazione = (id) => `<a href="#statistiche/squadra/${id}">${esc(nomeSquadra(dati, id))}</a>`;
  return `
    <div class="marcatori"><div>${lista(casaId)}</div><div class="osp">${lista(ospiteId)}</div></div>
    ${tab.migliore ? `<p>⭐ Migliore in campo: <strong>${esc(tab.migliore.nome)}</strong> (${esc(nomeSquadra(dati, tab.migliore.squadraId))})</p>` : ''}
    <div class="formazioni">
      ${[casaId, ospiteId].map(id => `<div><table class="tab"><thead><tr><th>#</th><th class="sx">${intestazione(id)}</th><th>voto</th></tr></thead><tbody>${formazione(id) || '<tr><td colspan="3" class="muto">formazione non disponibile</td></tr>'}</tbody></table></div>`).join('')}
    </div>`;
}

// Una sola riga per tutte le partite del girone. Si apre solo se il tabellino c'è davvero:
// una riga che si apre sul vuoto è una promessa non mantenuta.
function rigaPartita(p, dati, nostra) {
  const tab = dati.torneo.tabellini[String(p.id)] || null;
  const ris = p.giocata ? `${p.golCasa} - ${p.golOspite}` : esc(p.ora || '–');
  const quando = `${nostra ? `${badgeEsito(nostra.esito)} ` : ''}${esc(formattaData(p.data))}${p.tavolino ? ' · a tavolino' : ''}`;
  const corpo = `
      <span class="sq">${esc(nomeSquadra(dati, p.casaId))}</span><span class="ris">${ris}</span><span class="sq osp">${esc(nomeSquadra(dati, p.ospiteId))}</span>
      <span class="quando">${quando}</span>`;
  const evidenza = nostra ? ' nostra' : '';
  if (!tab) return `<div class="partita${evidenza}" id="p${p.id}">${corpo}</div>`;
  return `
    <details class="partita-det${evidenza}" id="p${p.id}">
      <summary class="partita">${corpo}<span class="freccia" aria-hidden="true"></span></summary>
      <div class="dettaglio">${tabellinoHtml(tab, p.casaId, p.ospiteId, dati)}</div>
    </details>`;
}

export function render({ dati, rotta }) {
  const t = dati.torneo;
  const tutte = rotta[1] === 'tutte';
  const nostre = new Map(partiteSquadra(t).map(p => [p.id, p]));
  const giornate = [...new Set(t.partite.map(p => p.giornata))].sort((a, b) => a - b);
  const corpo = giornate.map(g => {
    const partite = t.partite.filter(p => p.giornata === g && (tutte || nostre.has(p.id)));
    if (!partite.length) return '';
    return `<h3>Giornata ${g}</h3><section class="card giornata${tutte ? ' intera' : ''}">${partite.map(p => rigaPartita(p, dati, nostre.get(p.id))).join('')}</section>`;
  }).join('');
  const segmento = (href, etichetta, attivo) => `<a href="${href}" class="${attivo ? 'attivo' : ''}">${etichetta}</a>`;
  return `
    <h2>Calendario</h2>
    <div class="segmenti">${segmento('#calendario', `Solo ${esc(t.squadra.nome)}`, !tutte)}${segmento('#calendario/tutte', 'Tutta la giornata', tutte)}</div>
    ${corpo || '<p class="vuoto">Calendario non disponibile</p>'}`;
}

export function dopo(ctx, root) {
  try {
    // La prossima partita è l'unica nostra senza esito: ci portiamo lì invece che in cima.
    // Evitiamo :has() (non supportato su alcuni browser meno recenti, dove solleverebbe
    // un'eccezione e interromperebbe renderApp prima di agganciare il bottone Esci).
    const prossima = [...root.querySelectorAll('.partita')].find(r => r.querySelector('.esito.x'));
    if (prossima) prossima.scrollIntoView({ block: 'center' });
  } catch (e) {
    console.error('calendario: scroll alla prossima partita fallito', e);
  }
}
