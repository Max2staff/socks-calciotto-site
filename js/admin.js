import { caricaDati, store } from './data.js';
import { calcolaCassa, AMICHEVOLI, amichevoleDi } from './cassa.js';
import { partiteSquadra } from './stats.js';
import { esc, formattaData, formattaEuro, oggiISO } from './util.js';
import { nomeSquadra } from './views/comuni.js';
import { RepoGitHub } from './github.js';
import * as ops from './admin-ops.js';

const K = { token: 'socks.admin.token', repo: 'socks.admin.repo' };
const app = document.getElementById('app');
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }, del: (k) => { try { localStorage.removeItem(k); } catch {} } };
let dati = null, repo = null, cassa = null;

function schermataSetup(errore = '') {
  const [owner = '', nome = ''] = (ls.get(K.repo) || '').split('/');
  app.innerHTML = `
    <div class="login">
      <div class="login-logo-wrap">
        <img src="img/logo.jpg" alt="Logo SOCKS" class="login-logo">
      </div>
      <h1>Admin cassa</h1>
      <form id="setup">
        <input name="pw" type="password" placeholder="password del sito" value="${esc(store.getPassword() || '')}" required>
        <input name="owner" placeholder="utente GitHub" value="${esc(owner)}" required>
        <input name="repo" placeholder="repo privato (es. socks-calciotto)" value="${esc(nome)}" required>
        <input name="token" type="password" placeholder="token GitHub (fine-grained)" value="${esc(ls.get(K.token) || '')}" required>
        <button>Entra</button><div class="errore">${esc(errore)}</div>
      </form></div>`;
  document.getElementById('setup').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try {
      dati = (await caricaDati(f.pw)).dati; store.setPassword(f.pw);
      repo = new RepoGitHub({ owner: f.owner.trim(), repo: f.repo.trim(), token: f.token.trim() });
      cassa = (await repo.leggi()).cassa;
      ls.set(K.token, f.token.trim()); ls.set(K.repo, `${f.owner.trim()}/${f.repo.trim()}`);
      render();
    } catch (err) { schermataSetup(err.message === 'PASSWORD_ERRATA' ? 'Password del sito errata' : err.message); }
  };
}

const opz = (arr, val, label, sel) => arr.map(x => `<option value="${esc(val(x))}" ${sel === val(x) ? 'selected' : ''}>${esc(label(x))}</option>`).join('');
const SPESE_FREQUENTI = ['kit maglie', 'palloni', 'pettorine', 'iscrizione torneo', 'borracce', 'materiale sanitario'];

function render() {
  const t = dati.torneo, oggi = oggiISO();
  const c = calcolaCassa(cassa, t, oggi);
  const gioc = [...cassa.giocatori].sort((a, b) => a.nickname.localeCompare(b.nickname));
  // Anche le partite non ancora giocate: spuntando le presenze a mano nasce la quota.
  // In coda i due slot amichevole, che hanno data e costo campo propri.
  const nostre = [...partiteSquadra(t), ...AMICHEVOLI.map(a => ({
    id: a.id, nome: a.nome, amichevole: true,
    data: (cassa.partite.find(x => x.idPartita === a.id) || {}).data || null,
  }))];
  const descP = (p) => p.amichevole
    ? `${p.nome}${p.data ? ` · ${formattaData(p.data)}` : ' · data da impostare'}`
    : `${formattaData(p.data)} vs ${nomeSquadra(dati, p.avversarioId)}${p.giocata ? '' : ' · da giocare'}`;
  const nuovi = dati.nuoviGiocatori || [];
  app.innerHTML = `
    <header class="testa">
      <img src="img/logo.jpg" alt="Logo SOCKS" class="logo-squadra">
      <h1>Admin cassa</h1>
      <button id="esci">Esci</button>
    </header>
    <main>
      <p><a href="./">← Torna all'app</a> · <span class="muto">le modifiche vanno online in ~2 minuti</span></p>
      <div id="esito" class="esito-op"></div>
      ${nuovi.length ? `<section class="card avviso">👤 Nuovi dal sito: ${nuovi.map(esc).join(', ')} — controlla nickname e duplicati in Roster.</section>` : ''}
      ${c.avvisiMora.length ? `<section class="card avviso"><h3>Quote scoperte oltre ${cassa.config.moraGiorni} giorni</h3>${c.avvisiMora.map(a => `<div class="riga"><span>${esc(c.giocatori.find(g => g.id === a.giocatoreId)?.nickname || a.giocatoreId)} · ${a.giorni} gg</span><button class="bottone" data-mora="${esc(a.giocatoreId)}|${esc(a.idPartita)}">Applica mora</button></div>`).join('')}</section>` : ''}

      <section class="card"><h3>Registra pagamento</h3><form class="op" data-op="pagamento">
        <label>Giocatore<select name="giocatoreId" required>${opz(gioc, g => g.id, g => `${g.nickname} (saldo ${formattaEuro(c.giocatori.find(x => x.id === g.id)?.saldoCent || 0)})`)}</select></label>
        <label>Importo €<input name="importo" type="number" step="0.5" min="0.5" inputmode="decimal" required></label>
        <label>Data<input name="data" type="date" value="${oggi}" required></label>
        <label>Nota<input name="causale" placeholder="es. quota 16/09 + 23/09"></label>
        <button class="bottone primario">Salva pagamento</button></form></section>

      <section class="card"><h3>Aggiungi multa</h3><form class="op" data-op="multa">
        <label>Giocatore<select name="giocatoreId" required>${opz(gioc, g => g.id, g => g.nickname)}</select></label>
        <label>Tipo<select name="tipoMulta">${opz(cassa.config.tipiMulta.filter(m => m.id !== 'mora'), m => m.id, m => `${m.nome}${m.importo != null ? ` · ${m.importo} €` : ''}`)}</select></label>
        <label>Importo €<input name="importo" type="number" step="0.5" min="0.5" inputmode="decimal" required value="${esc(cassa.config.tipiMulta[0]?.importo ?? '')}"></label>
        <label>Data<input name="data" type="date" value="${oggi}" required></label>
        <label>Causale<input name="causale" placeholder="obbligatoria per multa libera"></label>
        <button class="bottone primario">Salva multa</button></form></section>

      <section class="card"><h3>Spesa dal fondo cassa</h3><form class="op" data-op="spesa">
        <label>Importo €<input name="importo" type="number" step="0.5" min="0.5" inputmode="decimal" required></label>
        <label>Data<input name="data" type="date" value="${oggi}" required></label>
        <label>Causale<input name="causale" list="causali-spesa" placeholder="es. kit maglie" required></label>
        <datalist id="causali-spesa">${SPESE_FREQUENTI.map(x => `<option value="${esc(x)}"></option>`).join('')}</datalist>
        <p class="muto">Kit, palloni, pettorine, iscrizione: qualsiasi acquisto pagato dalla cassa.
          Il costo del campo <strong>no</strong>, quello esce dal fondo cassa da solo.</p>
        <button class="bottone primario">Salva spesa</button></form></section>

      <section class="card"><h3>Rettifica</h3><form class="op" data-op="rettifica">
        <label>Giocatore<select name="giocatoreId" required>${opz(gioc, g => g.id, g => g.nickname)}</select></label>
        <label>Importo € (positivo = deve di più, negativo = sconto)<input name="importo" type="number" step="0.5" inputmode="decimal" required></label>
        <label>Data<input name="data" type="date" value="${oggi}" required></label>
        <label>Causale<input name="causale" required></label>
        <button class="bottone primario">Salva rettifica</button></form></section>

      <section class="card"><h3>Partita: costo campo e presenze</h3>${nostre.length === 0 ? '<p class="muto">Nessuna partita in calendario.</p>' : `<form class="op" id="partita">
        <label>Partita<select name="idPartita">${opz(nostre, p => String(p.id), descP)}</select></label>
        <label id="riga-data" hidden>Data dell'amichevole<input name="dataPartita" type="date"></label>
        <label>Costo campo € (vuoto = standard ${cassa.config.costoCampoDefault})<input name="costoCampo" type="number" step="0.5" inputmode="decimal"></label>
        <label><input type="checkbox" name="override"> Segna presenze a mano</label>
        <div class="presenze" id="presenze"></div>
        <p class="muto">Serve per far pagare la quota prima che esca il tabellino: spunta chi c'era e
          ognuno si vede addebitata la quota, così chi ha già pagato torna a saldo zero.</p>
        <button class="bottone primario">Salva partita</button></form>`}</section>

      <section class="card"><h3>Roster</h3>
        ${gioc.map(g => `<form class="op riga" data-op="giocatore" data-id="${esc(g.id)}" style="margin-bottom:.4rem"><input name="nickname" value="${esc(g.nickname)}" title="${esc(g.nomeSito)}"><label style="flex-direction:row;align-items:center"><input type="checkbox" name="attivo" ${g.attivo !== false ? 'checked' : ''}> attivo</label><button class="bottone">Salva</button></form>`).join('')}
        <form class="op" data-op="unisci" style="margin-top:.8rem"><label>Unisci duplicato<select name="idDa">${opz(gioc, g => g.id, g => `${g.nickname} — ${g.nomeSito}`)}</select></label><label>dentro<select name="idIn">${opz(gioc, g => g.id, g => `${g.nickname} — ${g.nomeSito}`)}</select></label><button class="bottone">Unisci</button></form>
      </section>

      <section class="card"><h3>Configurazione</h3><form class="op" data-op="config">
        <label>Quota fissa a partita €<input name="quotaFissa" type="number" step="0.5" value="${esc(cassa.config.quotaFissa ?? 10)}" required></label>
        <label>Costo campo standard €<input name="costoCampoDefault" type="number" step="0.5" value="${esc(cassa.config.costoCampoDefault)}" required></label>
        <label>Giorni prima della mora<input name="moraGiorni" type="number" step="1" value="${esc(cassa.config.moraGiorni)}" required></label>
        <label>Tipi multa (JSON: id, nome, importo)<textarea name="tipiMulta" rows="6">${esc(JSON.stringify(cassa.config.tipiMulta, null, 1))}</textarea></label>
        <button class="bottone primario">Salva configurazione</button></form></section>

      <p><button id="rimuovi-token" class="bottone">Rimuovi token da questo telefono</button></p>
    </main>`;
  collega(c, nostre);
}

function collega(c, nostre) {
  const esito = document.getElementById('esito');
  const nickDi = (id) => cassa.giocatori.find(g => g.id === id)?.nickname || id;
  async function esegui(bottone, mutatore) {
    bottone.disabled = true; esito.className = 'esito-op'; esito.textContent = 'Salvataggio…';
    try {
      const r = await repo.salva(mutatore);
      cassa = r.cassa;
      render();
      const azioni = `https://github.com/${esc(repo.owner)}/${esc(repo.repo)}/actions`;
      document.getElementById('esito').className = 'esito-op ok';
      document.getElementById('esito').innerHTML = `✅ ${esc(r.messaggio)}. Pubblicazione in corso (~2 min) — <a href="${azioni}" target="_blank" rel="noopener">segui su GitHub Actions</a>.`;
    } catch (err) { esito.className = 'esito-op ko'; esito.textContent = `❌ ${err.message}`; bottone.disabled = false; }
  }
  document.getElementById('esci').onclick = () => { store.clearPassword(); location.reload(); };
  document.getElementById('rimuovi-token').onclick = () => { ls.del(K.token); location.reload(); };
  for (const form of document.querySelectorAll('form.op[data-op]')) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form)), op = form.dataset.op;
      esegui(form.querySelector('button'), (cs) => {
        if (['pagamento', 'multa', 'spesa', 'rettifica'].includes(op)) return ops.aggiungiMovimento(cs, { ...f, tipo: op }, nickDi);
        if (op === 'giocatore') return ops.aggiornaGiocatore(cs, form.dataset.id, { nickname: f.nickname, attivo: !!f.attivo });
        if (op === 'unisci') return ops.unisciGiocatori(cs, f.idDa, f.idIn);
        if (op === 'config') return ops.aggiornaConfig(cs, { ...f, tipiMulta: JSON.parse(f.tipiMulta) });
        throw new Error('operazione sconosciuta');
      });
    };
  }
  const multa = document.querySelector('form[data-op="multa"]');
  multa.tipoMulta.onchange = () => { const t = cassa.config.tipiMulta.find(x => x.id === multa.tipoMulta.value); if (t && t.importo != null) multa.importo.value = t.importo; };
  for (const b of document.querySelectorAll('[data-mora]')) b.onclick = () => {
    const [giocatoreId, idPartita] = b.dataset.mora.split('|');
    const importo = cassa.config.tipiMulta.find(x => x.id === 'mora')?.importo ?? 2;
    esegui(b, (cs) => ops.aggiungiMovimento(cs, { tipo: 'multa', tipoMulta: 'mora', giocatoreId, idPartita: ops.idPartitaValido(idPartita), importo, data: oggiISO(), causale: 'mora ritardo pagamento' }, nickDi));
  };
  const fp = document.getElementById('partita');
  if (fp) {
    const aggiornaPresenze = () => {
      const p = nostre.find(x => String(x.id) === fp.idPartita.value); if (!p) return;
      const pc = cassa.partite.find(x => x.idPartita === p.id);
      document.getElementById('riga-data').hidden = !p.amichevole;
      fp.dataPartita.value = pc?.data ?? '';
      fp.dataPartita.required = !!p.amichevole;
      fp.costoCampo.value = pc?.costoCampo ?? '';
      fp.override.checked = Array.isArray(pc?.presentiOverride);
      const attuali = new Set(pc?.presentiOverride || c.quote.find(q => q.idPartita === p.id)?.presenti || []);
      const box = document.getElementById('presenze');
      box.innerHTML = cassa.giocatori.map(g => `<label><input type="checkbox" name="pres" value="${esc(g.id)}" ${attuali.has(g.id) ? 'checked' : ''}> ${esc(g.nickname)}</label>`).join('');
      box.onchange = () => { if (box.querySelector('input[name="pres"]:checked')) fp.override.checked = true; };
    };
    fp.idPartita.onchange = aggiornaPresenze; aggiornaPresenze();
    fp.onsubmit = (e) => {
      e.preventDefault();
      const idPartita = ops.idPartitaValido(fp.idPartita.value), costo = fp.costoCampo.value, override = fp.override.checked;
      const dataAmichevole = amichevoleDi(idPartita) ? fp.dataPartita.value : '';
      const ids = [...fp.querySelectorAll('input[name="pres"]:checked')].map(x => x.value);
      esegui(fp.querySelector('button.primario'), (cs) => {
        const msgs = [];
        if (dataAmichevole) msgs.push(ops.impostaDataPartita(cs, idPartita, dataAmichevole));
        if (costo !== '') msgs.push(ops.impostaCostoCampo(cs, idPartita, costo));
        msgs.push(ops.impostaPresenze(cs, idPartita, ops.presenzeDaSalvare(ids, override)));
        return msgs.join('; ');
      });
    };
  }
}

(async () => {
  const pw = store.getPassword(), token = ls.get(K.token), r = ls.get(K.repo);
  if (!pw || !token || !r) return schermataSetup();
  try {
    dati = (await caricaDati(pw)).dati;
    const [owner, nome] = r.split('/');
    repo = new RepoGitHub({ owner, repo: nome, token });
    cassa = (await repo.leggi()).cassa;
    render();
  } catch (err) { schermataSetup(err.message); }
})();
