import { partiteSquadra, prossimaPartita, ultimaPartita } from '../stats.js';
import { calcolaCassa } from '../cassa.js';
import { esc, formattaDataLunga, formattaEuro, giorniTra } from '../util.js';
import { nomeSquadra, badgeEsito, card, vuoto, iconaLuogo } from './comuni.js';

export function render({ dati, oggi }) {
  const t = dati.torneo;
  const partite = partiteSquadra(t);
  const pross = prossimaPartita(partite, oggi);
  const ult = ultimaPartita(partite);
  const riga = t.classifica.totale.find(r => r.squadraId === t.squadra.id);
  const c = calcolaCassa(dati.cassa, t, oggi);
  const debitori = c.giocatori.filter(g => g.saldoCent < 0).sort((a, b) => a.saldoCent - b.saldoCent).slice(0, 3);

  const prossimaHtml = pross ? `
    <div class="grande">${iconaLuogo(pross.casa)} ${esc(nomeSquadra(dati, pross.avversarioId))}</div>
    <div>${esc(formattaDataLunga(pross.data))}${pross.ora ? ` · ore ${esc(pross.ora)}` : ''} · ${pross.casa ? 'in casa' : 'in trasferta'}</div>
    <div class="muto">${pross.data ? (giorniTra(oggi, pross.data) === 0 ? 'oggi!' : giorniTra(oggi, pross.data) < 0 ? 'da riprogrammare' : `tra ${giorniTra(oggi, pross.data)} giorni`) : 'data da definire'} · giornata ${pross.giornata}</div>`
    : vuoto('Nessuna partita in programma');

  const ultimaHtml = ult ? `
    <div class="riga"><span>${badgeEsito(ult.esito)} ${iconaLuogo(ult.casa)} ${esc(nomeSquadra(dati, ult.avversarioId))}</span><span class="grande">${ult.gf} - ${ult.gs}</span></div>
    <div class="muto">${ult.tabellino ? ult.tabellino.marcatori.filter(m => m.squadraId === t.squadra.id).map(m => `${esc(m.nome)} ${m.minuto}'`).join(', ') || 'nessun nostro marcatore' : ''}</div>`
    : vuoto('Ancora nessuna partita giocata');

  const classificaHtml = riga ? `
    <div class="riga"><span class="grande">${riga.pos}º</span><span class="grande">${riga.pt} pt</span></div>
    <div class="muto">${riga.g} giocate · ${riga.v}V ${riga.n}N ${riga.p}P · ${riga.gf}:${riga.gs}</div>` : vuoto('Classifica non disponibile');

  const cassaHtml = `
    <div class="riga"><span>Saldo cassa</span><span class="grande ${c.saldoCassaCent < 0 ? 'neg' : ''}">${formattaEuro(c.saldoCassaCent)}</span></div>
    ${debitori.length ? `<div class="muto">Da incassare: ${debitori.map(g => `${esc(g.nickname)} ${formattaEuro(-g.saldoCent)}`).join(' · ')}</div>` : '<div class="muto">Tutti in regola 👏</div>'}
    ${c.avvisiMora.length ? `<div class="muto">⚠️ ${c.avvisiMora.length} quote oltre i ${dati.cassa.config.moraGiorni} giorni</div>` : ''}`;

  return `
    <h2>${esc(t.girone.nome)} · ${esc(t.girone.stagione)}</h2>
    ${dati.nuoviGiocatori && dati.nuoviGiocatori.length ? card('', `👤 Nuovi giocatori rilevati dal sito: ${dati.nuoviGiocatori.map(esc).join(', ')}. Il cassiere può sistemarli in <a href="admin.html">admin</a>.`, 'avviso') : ''}
    ${card('Prossima partita', prossimaHtml)}
    ${card('Ultimo risultato', ultimaHtml)}
    <a href="#classifica" style="text-decoration:none;color:inherit">${card('Classifica', classificaHtml)}</a>
    <a href="#cassa" style="text-decoration:none;color:inherit">${card('Cassa', cassaHtml)}</a>`;
}

export function dopo() {}
