import { calcolaCassa, amichevoleDi } from '../cassa.js';
import { esc, formattaData, formattaEuro, centesimi } from '../util.js';
import { nomeSquadra, card, vuoto } from './comuni.js';

const filtroMov = { giocatoreId: '', tipo: '', da: '', a: '' };
const TIPI = { pagamento: 'Pagamento', multa: 'Multa', spesa: 'Spesa', rettifica: 'Rettifica' };

const saldoHtml = (c) => `<span class="${c < 0 ? 'neg' : c > 0 ? 'pos' : ''}">${formattaEuro(c)}</span>`;

function renderTabellone(c, giocatori, descPartita) {
  if (!giocatori.length) return vuoto('Il roster si popola da solo dopo la prima partita');
  const quote = c.quote;

  const thGiornate = quote.map(q => `<th title="${descPartita(q.idPartita)} (quota ${formattaEuro(q.quotaCent)})" class="col-giornata">${q.sigla || 'G' + q.giornata}<br><span class="muto-th">${formattaEuro(q.quotaCent)}</span></th>`).join('');

  const righe = giocatori.map(g => {
    const celleGiornate = quote.map(q => {
      const presente = q.presenti.includes(g.id);
      return `<td class="col-giornata">${presente ? `<span class="pres-si" title="Presente · Quota ${formattaEuro(q.quotaCent)}">${formattaEuro(q.quotaCent)}</span>` : `<span class="pres-no" title="Assente">-</span>`}</td>`;
    }).join('');

    const statoChip = g.saldoCent < 0
      ? '<span class="chip chip-ko">Debito</span>'
      : g.saldoCent > 0
        ? '<span class="chip chip-ok">Credito</span>'
        : '<span class="chip chip-neutro">In regola</span>';

    return `
      <tr>
        <td class="sx nome col-fissa"><strong>${esc(g.nickname)}</strong>${g.attivo ? '' : ' <span class="chip">inattivo</span>'}</td>
        ${celleGiornate}
        <td><strong>${g.nQuote}</strong></td>
        <td>${formattaEuro(g.dovutoCent)}</td>
        <td>${formattaEuro(g.pagatoCent)}</td>
        <td>${saldoHtml(g.saldoCent)}</td>
        <td>${statoChip}</td>
      </tr>`;
  }).join('');

  const totPresenzePerQ = quote.map(q => `<td class="col-giornata"><strong>${q.presenti.length}</strong><br><span class="muto-th">${formattaEuro(q.costoCampoCent)}</span></td>`).join('');
  const totPresenze = giocatori.reduce((s, g) => s + g.nQuote, 0);
  const totDovuto = giocatori.reduce((s, g) => s + g.dovutoCent, 0);
  const totPagato = giocatori.reduce((s, g) => s + g.pagatoCent, 0);
  const totSaldo = totPagato - totDovuto;

  return `
    <div class="scroll-x">
      <table class="tab tab-rendiconto">
        <thead>
          <tr>
            <th class="sx col-fissa">Giocatore</th>
            ${thGiornate}
            <th>Pres.</th>
            <th>Dovuto</th>
            <th>Pagato</th>
            <th>Saldo</th>
            <th>Stato</th>
          </tr>
        </thead>
        <tbody>
          ${righe}
        </tbody>
        <tfoot>
          <tr class="riga-totale">
            <td class="sx col-fissa"><strong>Totale</strong></td>
            ${totPresenzePerQ}
            <td><strong>${totPresenze}</strong></td>
            <td><strong>${formattaEuro(totDovuto)}</strong></td>
            <td><strong>${formattaEuro(totPagato)}</strong></td>
            <td><strong>${saldoHtml(totSaldo)}</strong></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

export function render({ dati, oggi }) {
  const t = dati.torneo, cfg = dati.cassa.config;
  const c = calcolaCassa(dati.cassa, t, oggi);
  const nick = new Map(c.giocatori.map(g => [g.id, g.nickname]));
  const partitaDi = (id) => t.partite.find(p => p.id === id);
  const descPartita = (id) => {
    const am = amichevoleDi(id);
    if (am) { const q = c.quote.find(x => x.idPartita === id); return `${esc(am.nome)}${q && q.data ? ` · ${esc(formattaData(q.data))}` : ''}`; }
    const p = partitaDi(id);
    return p ? `${esc(formattaData(p.data))} vs ${esc(nomeSquadra(dati, p.casaId === t.squadra.id ? p.ospiteId : p.casaId))}` : `partita ${id}`;
  };
  const giocatori = c.giocatori.filter(g => g.attivo || g.dovutoCent || g.pagatoCent).sort((a, b) => a.saldoCent - b.saldoCent || a.nickname.localeCompare(b.nickname));
  const movimenti = c.movimenti.filter(m => (!filtroMov.giocatoreId || m.giocatoreId === filtroMov.giocatoreId) && (!filtroMov.tipo || m.tipo === filtroMov.tipo) && (!filtroMov.da || m.data >= filtroMov.da) && (!filtroMov.a || m.data <= filtroMov.a));

  return `
    <h2>Cassa</h2>
    <div class="griglia">
      <div class="cella"><div class="n">${saldoHtml(c.saldoCassaCent)}</div><div class="l">Saldo cassa</div></div>
      <div class="cella"><div class="n">${formattaEuro(c.creditiAttesiCent)}</div><div class="l">da incassare</div></div>
      <div class="cella"><div class="n">${formattaEuro(c.costoCampoTotaleCent)}</div><div class="l">campo pagato</div></div>
      <div class="cella"><div class="n">${formattaEuro(c.speseCent)}</div><div class="l">spese</div></div>
    </div>
    ${c.avvisiMora.length ? card('', `⚠️ Quote oltre i ${cfg.moraGiorni} giorni: ${c.avvisiMora.map(a => `${esc(nick.get(a.giocatoreId) || a.giocatoreId)} (${descPartita(a.idPartita)}, ${a.giorni} gg)`).join('; ')}`, 'avviso') : ''}
    <h3>Tabellone Rendiconto</h3>
    ${card('', renderTabellone(c, giocatori, descPartita))}
    <h3>Movimenti</h3>
    <form id="filtro-mov" class="filtri">
      <label>Giocatore<select name="giocatoreId"><option value="">Tutti</option>${c.giocatori.map(g => `<option value="${g.id}" ${filtroMov.giocatoreId === g.id ? 'selected' : ''}>${esc(g.nickname)}</option>`).join('')}</select></label>
      <label>Tipo<select name="tipo"><option value="">Tutti</option>${Object.entries(TIPI).map(([k, l]) => `<option value="${k}" ${filtroMov.tipo === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Dal<input type="date" name="da" value="${esc(filtroMov.da)}"></label>
      <label>Al<input type="date" name="a" value="${esc(filtroMov.a)}"></label>
    </form>
    ${card('', movimenti.length ? `<table class="tab"><thead><tr><th class="sx">Data</th><th class="sx">Cosa</th><th>Importo</th></tr></thead><tbody>${movimenti.map(m => `<tr><td class="sx">${esc(formattaData(m.data))}</td><td class="sx" style="white-space:normal">${TIPI[m.tipo] || esc(m.tipo)}${m.giocatoreId ? ` · <strong>${esc(nick.get(m.giocatoreId) || m.giocatoreId)}</strong>` : ''}${m.tipoMulta ? ` <span class="chip">${esc((cfg.tipiMulta.find(x => x.id === m.tipoMulta) || { nome: m.tipoMulta }).nome)}</span>` : ''}${m.causale ? `<br><span class="muto">${esc(m.causale)}</span>` : ''}</td><td>${m.tipo === 'spesa' || m.tipo === 'multa' || (m.tipo === 'rettifica' && m.importoCent > 0) ? '<span class="neg">' : '<span class="pos">'}${formattaEuro(Math.abs(m.importoCent))}</span></td></tr>`).join('')}</tbody></table>` : vuoto('Nessun movimento'))}
    <h3>Quote per partita</h3>
    ${card('', c.quote.length ? `<table class="tab"><thead><tr><th class="sx">Partita</th><th>Campo</th><th>Presenti</th><th>Quota</th></tr></thead><tbody>${c.quote.map(q => `<tr><td class="sx" style="white-space:normal">${descPartita(q.idPartita)}</td><td>${formattaEuro(q.costoCampoCent)}</td><td>${q.presenti.length}</td><td><strong>${formattaEuro(q.quotaCent)}</strong></td></tr>`).join('')}</tbody></table>` : vuoto('Le quote compaiono dopo la prima partita con tabellino'))}
    <h3>Regolamento</h3>
    ${card('', `
      <div class="riga"><span>Quota a partita</span><span>${cfg.quotaFissa != null
        ? `<strong>${formattaEuro(centesimi(cfg.quotaFissa))} fissa</strong> a presente`
        : `spesa del campo <strong>divisa fra i presenti</strong>`}</span></div>
      <div class="riga"><span>Costo campo standard</span><span>${formattaEuro(centesimi(cfg.costoCampoDefault))}</span></div>
      <div class="riga"><span>Mora</span><span>dopo ${cfg.moraGiorni} giorni</span></div>
      ${cfg.tipiMulta.map(m => `<div class="riga"><span>${esc(m.nome)}</span><span>${m.importo == null ? 'a discrezione' : formattaEuro(centesimi(m.importo))}</span></div>`).join('')}`)}`;
}

export function dopo(ctx, root) {
  const form = root.querySelector('#filtro-mov');
  if (form) form.onchange = () => { Object.assign(filtroMov, Object.fromEntries(new FormData(form))); root.innerHTML = render(ctx); dopo(ctx, root); };
}
