import { caricaDati, store } from './data.js';
import { calcolaCassa, AMICHEVOLI, amichevoleDi, estrattoConto, controlloPresenze } from './cassa.js';
import { correggiTabellini } from './nomi.js';
import { partiteSquadra } from './stats.js';
import { esc, formattaData, formattaEuro, oggiISO } from './util.js';
import { nomeSquadra } from './views/comuni.js';
import { RepoGitHub } from './github.js';
import * as ops from './admin-ops.js';

const K = { token: 'socks.admin.token', repo: 'socks.admin.repo' };
const app = document.getElementById('app');
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }, del: (k) => { try { localStorage.removeItem(k); } catch {} } };
let dati = null, repo = null, cassa = null;

// Schede della pagina: restano scelte fra un salvataggio e l'altro (e nell'indirizzo, per il tasto indietro).
const SCHEDE = [['cassa', 'Cassa'], ['partite', 'Partite'], ['rosa', 'Rosa'], ['altro', 'Altro']];
let scheda = SCHEDE.some(([k]) => k === location.hash.slice(1)) ? location.hash.slice(1) : 'cassa';
let estrattoId = '';

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
const saldoHtml = (cent) => `<span class="${cent < 0 ? 'neg' : cent > 0 ? 'pos' : ''}">${cent > 0 ? '+' : ''}${formattaEuro(cent)}</span>`;
const SPESE_FREQUENTI = ['kit maglie', 'palloni', 'pettorine', 'iscrizione torneo', 'borracce', 'materiale sanitario'];
const plurale = (n, uno, tanti) => `${n} ${n === 1 ? uno : tanti}`;
const TIPI_MOV = { pagamento: 'Pagamento', multa: 'Multa', rettifica: 'Rettifica', quota: 'Quota' };

function render() {
  // Il tabellino si corregge con la rosa attuale: dopo un "nome sbagliato di…" vale subito.
  const t = correggiTabellini(dati.torneo, cassa), oggi = oggiISO();
  const c = calcolaCassa(cassa, t, oggi);
  const gioc = cassa.giocatori.filter(g => !g.ignorato).sort((a, b) => a.nickname.localeCompare(b.nickname));
  const ignorati = cassa.giocatori.filter(g => g.ignorato).sort((a, b) => a.nickname.localeCompare(b.nickname));
  const saldoDi = new Map(c.giocatori.map(g => [g.id, g]));
  const nickDi = (id) => cassa.giocatori.find(g => g.id === id)?.nickname || id;
  // Anche le partite non ancora giocate: spuntando le presenze a mano nasce la quota.
  // In coda i due slot amichevole, che hanno data e costo campo propri.
  const nostre = [...partiteSquadra(t), ...AMICHEVOLI.map(a => ({
    id: a.id, nome: a.nome, amichevole: true,
    data: (cassa.partite.find(x => x.idPartita === a.id) || {}).data || null,
  }))];
  const descP = (p) => p.amichevole
    ? `${p.nome}${p.data ? ` · ${formattaData(p.data)}` : ' · data da impostare'}`
    : `${formattaData(p.data)} vs ${nomeSquadra(dati, p.avversarioId)}${p.giocata ? '' : ' · da giocare'}`;
  const descId = (id) => { const p = nostre.find(x => x.id === id); return p ? descP(p) : `partita ${id}`; };
  const nuovi = dati.nuoviGiocatori || [];
  const corpo = { cassa: schedaCassa, partite: schedaPartite, rosa: schedaRosa, altro: schedaAltro }[scheda];
  app.innerHTML = `
    <header class="testa">
      <img src="img/logo.jpg" alt="Logo SOCKS" class="logo-squadra">
      <h1>Admin cassa</h1>
      <button id="esci">Esci</button>
    </header>
    <main>
      <p><a href="./">← Torna all'app</a> · <span class="muto">le modifiche vanno online in ~2 minuti</span></p>
      <nav class="segmenti schede">${SCHEDE.map(([k, l]) => `<button data-scheda="${k}" class="${scheda === k ? 'attivo' : ''}">${l}</button>`).join('')}</nav>
      <div id="esito" class="esito-op"></div>
      ${nuovi.length ? `<section class="card avviso">👤 Nuovi dal sito: ${nuovi.map(esc).join(', ')} — controlla nickname e duplicati in Rosa.</section>` : ''}
      ${c.avvisiMora.length ? `<section class="card avviso"><h3>Quote scoperte oltre ${cassa.config.moraGiorni} giorni</h3>${c.avvisiMora.map(a => `<div class="riga"><span>${esc(nickDi(a.giocatoreId))} · ${a.giorni} gg</span><button class="bottone" data-mora="${esc(a.giocatoreId)}|${esc(a.idPartita)}">Applica mora</button></div>`).join('')}</section>` : ''}
      ${corpo({ t, c, gioc, ignorati, saldoDi, nickDi, nostre, descP, descId, oggi })}
    </main>`;
  collega({ t, c, nostre, nickDi, descId, oggi });
}

function formPagamento({ gioc, saldoDi, oggi }) {
  return `<section class="card"><h3>Registra pagamento</h3><form class="op" data-op="pagamento" data-anteprima>
    <label>Giocatore<select name="giocatoreId" required>${opz(gioc, g => g.id, g => `${g.nickname} (saldo ${formattaEuro(saldoDi.get(g.id)?.saldoCent || 0)})`, estrattoId)}</select></label>
    <label>Importo €<input name="importo" type="number" step="0.5" min="0.5" inputmode="decimal" required></label>
    <label>Data<input name="data" type="date" value="${oggi}" required></label>
    <label>Nota<input name="causale" placeholder="es. quota 16/09 + 23/09"></label>
    <div class="anteprima muto"></div>
    <button class="bottone primario">Salva pagamento</button></form></section>`;
}

function schedaCassa(ctx) {
  const { c, gioc, nickDi, descId } = ctx;
  const righe = c.giocatori.filter(g => g.attivo || g.dovutoCent || g.pagatoCent)
    .sort((a, b) => a.saldoCent - b.saldoCent || a.nickname.localeCompare(b.nickname));
  let estratto = '';
  if (estrattoId && c.giocatori.some(g => g.id === estrattoId)) {
    const e = estrattoConto(c, estrattoId);
    estratto = `<section class="card" id="estratto"><h3>Estratto conto · ${esc(nickDi(estrattoId))}</h3>
      <table class="tab estratto"><thead><tr><th class="sx">Cosa</th><th>Importo</th><th>Saldo</th></tr></thead><tbody>
      ${e.righe.map(r => `<tr>
        <td class="sx"><span class="muto">${esc(r.data ? formattaData(r.data) : 'senza data')}</span><br>
          <strong>${TIPI_MOV[r.tipo] || esc(r.tipo)}</strong>${r.tipo === 'quota' ? ` · ${esc(descId(r.idPartita))}` : ''}${r.causale ? `<br><span class="muto">${esc(r.causale)}</span>` : ''}
          ${r.id ? `<br><button class="bottone piccolo" data-annulla="${esc(r.id)}">Annulla</button>` : ''}</td>
        <td>${saldoHtml(r.importoCent)}</td>
        <td>${saldoHtml(r.saldoCent)}</td></tr>`).join('') || '<tr><td class="sx muto" colspan="3">Nessun movimento</td></tr>'}
      </tbody></table>
      <p class="muto">Le quote non si annullano: si tolgono dalle presenze della partita (scheda Partite).
        Un pagamento sbagliato si annulla e si registra di nuovo giusto.</p>
      <button class="bottone" id="chiudi-estratto">Chiudi</button></section>`;
  }
  return `
    <div class="griglia">
      <div class="cella"><div class="n">${saldoHtml(c.saldoCassaCent)}</div><div class="l">fondo cassa</div></div>
      <div class="cella"><div class="n">${formattaEuro(c.creditiAttesiCent)}</div><div class="l">da incassare</div></div>
      <div class="cella"><div class="n">${formattaEuro(c.debitiVersoGiocatoriCent)}</div><div class="l">crediti giocatori</div></div>
      <div class="cella"><div class="n">${formattaEuro(c.entrateCent)}</div><div class="l">entrate extra</div></div>
    </div>
    ${estratto}
    ${formPagamento(ctx)}
    <section class="card"><h3>Saldi</h3>
      <p class="muto">In rosso chi deve pagare, in verde chi ha credito. Tocca un nome per vedere e correggere i suoi movimenti.
        Il credito del Mister è un contributo al fondo cassa: non entra nei "crediti giocatori".</p>
      <div class="scroll-x"><table class="tab"><thead><tr><th class="sx">Giocatore</th><th>Dovuto</th><th>Pagato</th><th>Saldo</th></tr></thead><tbody>
      ${righe.map(g => `<tr${g.id === estrattoId ? ' class="noi"' : ''}><td class="sx nome"><button class="link" data-estratto="${esc(g.id)}">${esc(g.nickname)}</button>${g.mister ? ' <span class="chip">Mister</span>' : ''}${g.attivo ? '' : ' <span class="chip">inattivo</span>'}</td>
        <td>${formattaEuro(g.dovutoCent)}</td><td>${formattaEuro(g.pagatoCent)}</td><td><strong>${saldoHtml(g.saldoCent)}</strong></td></tr>`).join('')}
      </tbody></table></div></section>
    ${gioc.length ? '' : '<p class="muto">Nessun giocatore in rosa.</p>'}`;
}

function schedaPartite({ t, c, nostre, descP, descId, nickDi }) {
  const diff = controlloPresenze(cassa, t);
  return `
    <section class="card"><h3>Partita: costo campo e presenze</h3>${nostre.length === 0 ? '<p class="muto">Nessuna partita in calendario.</p>' : `<form class="op" id="partita">
      <label>Partita<select name="idPartita">${opz(nostre, p => String(p.id), descP)}</select></label>
      <label id="riga-data" hidden>Data dell'amichevole<input name="dataPartita" type="date"></label>
      <label>Costo campo € (vuoto = standard ${cassa.config.costoCampoDefault})<input name="costoCampo" type="number" step="0.5" inputmode="decimal"></label>
      <label><input type="checkbox" name="override"> Segna presenze a mano</label>
      <div class="presenze" id="presenze"></div>
      <p class="muto">Serve per far pagare la quota prima che esca il tabellino: spunta chi c'era e
        ognuno si vede addebitata la quota, così chi ha già pagato torna a saldo zero.</p>
      <button class="bottone primario">Salva partita</button></form>`}</section>
    <section class="card${diff.length ? ' avviso' : ''}"><h3>Controllo presenze</h3>
      ${diff.length ? diff.map(d => `<div class="controllo"><strong>${esc(descId(d.idPartita))}</strong>
        ${d.soloInCassa.length ? `<div>Segnati in cassa ma non nel tabellino: ${d.soloInCassa.map(id => esc(nickDi(id))).join(', ')}</div>` : ''}
        ${d.soloNelTabellino.length ? `<div>Nel tabellino ma non segnati in cassa: ${d.soloNelTabellino.map(x => x.giocatoreId ? esc(nickDi(x.giocatoreId)) : `${esc(x.nome)} <span class="chip">non in rosa</span>`).join(', ')}</div>` : ''}</div>`).join('')
        : '<p class="muto">Le presenze segnate a mano coincidono con i tabellini ufficiali.</p>'}
      <p class="muto">Non è per forza un errore (a volte il tabellino non è preciso), ma controlla chi ha giocato davvero.</p></section>
    ${c.quote.length ? `<section class="card"><h3>Quote per partita</h3><div class="scroll-x"><table class="tab"><thead><tr><th class="sx">Partita</th><th>Presenti</th><th>Quota</th><th>Campo</th></tr></thead><tbody>
      ${c.quote.map(q => `<tr><td class="sx" style="white-space:normal">${esc(descId(q.idPartita))}</td><td>${q.presenti.length}</td><td>${formattaEuro(q.quotaCent)}</td><td>${formattaEuro(q.costoCampoCent)}</td></tr>`).join('')}
      </tbody></table></div></section>` : ''}`;
}

function schedaRosa({ gioc, ignorati, saldoDi }) {
  return `
    <section class="card"><h3>Aggiungi giocatore</h3><form class="op" data-op="nuovo-giocatore">
      <label>Nome come sul sito del torneo<input name="nomeSito" placeholder="COGNOME NOME" autocapitalize="characters" required></label>
      <label>Nickname (facoltativo)<input name="nickname" placeholder="come lo chiamate"></label>
      <p class="muto">Per una persona nuova usa sempre questo. Non rinominare un giocatore esistente per farlo
        diventare un altro: i suoi pagamenti e le sue presenze resterebbero attaccati al nome sbagliato.</p>
      <button class="bottone primario">Aggiungi</button></form></section>
    <section class="card"><h3>Rosa</h3>
      ${gioc.map(g => { const s = saldoDi.get(g.id); return `<details class="giocatore"><summary><span><strong>${esc(g.nickname)}</strong>${g.mister ? ' <span class="chip">Mister</span>' : ''}${g.attivo !== false ? '' : ' <span class="chip">inattivo</span>'}<br><span class="muto">${esc(g.nomeSito)}</span></span><span>${s ? saldoHtml(s.saldoCent) : ''}<br><span class="muto">${g.mister ? 'non paga quote' : plurale(s ? s.nQuote : 0, 'presenza', 'presenze')}</span></span></summary>
        <form class="op" data-op="giocatore" data-id="${esc(g.id)}">
          <label>Nickname<input name="nickname" value="${esc(g.nickname)}" required></label>
          <label>Nome sul sito del torneo<input name="nomeSito" value="${esc(g.nomeSito)}" required></label>
          ${g.alias?.length ? `<p class="muto">Riconosciuto anche come: ${g.alias.map(esc).join(', ')}</p>` : ''}
          <label class="in-riga"><input type="checkbox" name="attivo" ${g.attivo !== false ? 'checked' : ''}> attivo</label>
          <label class="in-riga"><input type="checkbox" name="mister" ${g.mister ? 'checked' : ''}> mister (sempre in panchina, non gioca e non paga quote)</label>
          <label class="in-riga"><input type="checkbox" name="ignorato"> nome da ignorare (ex giocatore o nome inesistente)</label>
          <p class="muto">Cambia il nome sul sito solo per correggere come è scritto; il vecchio nome resta riconosciuto.</p>
          <button class="bottone">Salva</button></form>
        <form class="op" data-op="variante" data-id="${esc(g.id)}">
          <label>È un nome sbagliato di…<select name="idIn">${opz(gioc.filter(x => x.id !== g.id), x => x.id, x => x.nickname)}</select></label>
          <p class="muto">Da usare quando nel tabellino c'è una variante che non esiste: pagamenti e presenze passano al giocatore giusto e il nome diventa una sua variante.</p>
          <button class="bottone">È lui</button></form></details>`; }).join('')}
    </section>
    ${ignorati.length ? `<section class="card"><h3>Nomi ignorati</h3>
      <p class="muto">Se compaiono nel tabellino non contano: niente presenze, niente quote, niente statistiche.</p>
      ${ignorati.map(g => `<form class="op riga" data-op="ripristina" data-id="${esc(g.id)}"><span><strong>${esc(g.nickname)}</strong><br><span class="muto">${esc([g.nomeSito, ...(g.alias || [])].join(', '))}</span></span><button class="bottone piccolo">Ripristina</button></form>`).join('')}
    </section>` : ''}
`;
}

function schedaAltro({ gioc, oggi }) {
  return `
    <section class="card"><h3>Aggiungi multa</h3><form class="op" data-op="multa" data-anteprima>
      <label>Giocatore<select name="giocatoreId" required>${opz(gioc, g => g.id, g => g.nickname)}</select></label>
      <label>Tipo<select name="tipoMulta">${opz(cassa.config.tipiMulta.filter(m => m.id !== 'mora'), m => m.id, m => `${m.nome}${m.importo != null ? ` · ${m.importo} €` : ''}`)}</select></label>
      <label>Importo €<input name="importo" type="number" step="0.5" min="0.5" inputmode="decimal" required value="${esc(cassa.config.tipiMulta[0]?.importo ?? '')}"></label>
      <label>Data<input name="data" type="date" value="${oggi}" required></label>
      <label>Causale<input name="causale" placeholder="obbligatoria per multa libera"></label>
      <div class="anteprima muto"></div>
      <button class="bottone primario">Salva multa</button></form></section>

    <section class="card"><h3>Rettifica</h3><form class="op" data-op="rettifica" data-anteprima>
      <label>Giocatore<select name="giocatoreId" required>${opz(gioc, g => g.id, g => g.nickname)}</select></label>
      <label>Il giocatore deve<select name="verso" required>
        <option value="piu">di più (toglie credito o aumenta il debito)</option>
        <option value="meno">di meno (toglie debito o dà credito)</option></select></label>
      <label>Importo €<input name="importo" type="number" step="0.5" min="0.5" inputmode="decimal" required></label>
      <label>Data<input name="data" type="date" value="${oggi}" required></label>
      <label>Causale<input name="causale" required></label>
      <div class="anteprima muto"></div>
      <p class="muto">Se hai sbagliato un pagamento o una multa, meglio annullarlo dall'estratto conto (scheda Cassa).</p>
      <button class="bottone primario">Salva rettifica</button></form></section>

    <section class="card"><h3>Spesa dal fondo cassa</h3><form class="op" data-op="spesa">
      <label>Importo €<input name="importo" type="number" step="0.5" min="0.5" inputmode="decimal" required></label>
      <label>Data<input name="data" type="date" value="${oggi}" required></label>
      <label>Causale<input name="causale" list="causali-spesa" placeholder="es. kit maglie" required></label>
      <datalist id="causali-spesa">${SPESE_FREQUENTI.map(x => `<option value="${esc(x)}"></option>`).join('')}</datalist>
      <p class="muto">Kit, palloni, pettorine, iscrizione: qualsiasi acquisto pagato dalla cassa.
        Il costo del campo <strong>no</strong>, quello esce dal fondo cassa da solo.</p>
      <button class="bottone primario">Salva spesa</button></form></section>

    <section class="card"><h3>Entrata extra</h3><form class="op" data-op="entrata">
      <label>Importo €<input name="importo" type="number" step="0.5" min="0.5" inputmode="decimal" required></label>
      <label>Data<input name="data" type="date" value="${oggi}" required></label>
      <label>Causale<input name="causale" placeholder="es. sponsor, donazione" required></label>
      <p class="muto">Soldi che entrano nel fondo cassa senza essere la quota di qualcuno: non diventano credito di nessuno.</p>
      <button class="bottone primario">Salva entrata</button></form></section>

    <section class="card"><h3>Configurazione</h3><form class="op" data-op="config">
      <label>Quota fissa a partita €<input name="quotaFissa" type="number" step="0.5" value="${esc(cassa.config.quotaFissa ?? 10)}" required></label>
      <label>Costo campo standard €<input name="costoCampoDefault" type="number" step="0.5" value="${esc(cassa.config.costoCampoDefault)}" required></label>
      <label>Giorni prima della mora<input name="moraGiorni" type="number" step="1" value="${esc(cassa.config.moraGiorni)}" required></label>
      <label>Tipi multa (JSON: id, nome, importo)<textarea name="tipiMulta" rows="6">${esc(JSON.stringify(cassa.config.tipiMulta, null, 1))}</textarea></label>
      <button class="bottone primario">Salva configurazione</button></form></section>

    <p><button id="rimuovi-token" class="bottone">Rimuovi token da questo telefono</button></p>`;
}

// Dai campi del form al movimento da salvare (la rettifica arriva senza segno, con "di più/di meno").
function movimentoDaForm(op, f) {
  const m = { ...f, tipo: op };
  if (op === 'rettifica') { m.importo = ops.importoRettifica(f.verso, f.importo); delete m.verso; }
  return m;
}

function collega({ t, c, nostre, nickDi, oggi }) {
  const esito = document.getElementById('esito');
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
  const rt = document.getElementById('rimuovi-token');
  if (rt) rt.onclick = () => { ls.del(K.token); location.reload(); };
  for (const b of document.querySelectorAll('[data-scheda]')) b.onclick = () => {
    scheda = b.dataset.scheda; history.replaceState(null, '', `#${scheda}`); render();
  };

  for (const form of document.querySelectorAll('form.op[data-op]')) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form)), op = form.dataset.op;
      if (op === 'variante') {
        const a = ops.anteprimaUnione(cassa, form.dataset.id);
        if (!confirm(`${nickDi(form.dataset.id)} è un nome sbagliato di ${nickDi(f.idIn)}?\n\nPassano a ${nickDi(f.idIn)}: ${plurale(a.movimenti, 'movimento', 'movimenti')} e ${plurale(a.presenze, 'presenza', 'presenze')}. ${nickDi(form.dataset.id)} sparirà dalla rosa.`)) return;
      }
      if (op === 'giocatore' && f.ignorato && !confirm(`Ignorare ${nickDi(form.dataset.id)}? Se compare nel tabellino non conterà più.`)) return;
      esegui(form.querySelector('button'), (cs) => {
        if (['pagamento', 'multa', 'spesa', 'rettifica', 'entrata'].includes(op)) return ops.aggiungiMovimento(cs, movimentoDaForm(op, f), nickDi);
        if (op === 'giocatore') return ops.aggiornaGiocatore(cs, form.dataset.id, { nickname: f.nickname, nomeSito: f.nomeSito, attivo: !!f.attivo, ignorato: !!f.ignorato, mister: !!f.mister });
        if (op === 'variante') return ops.unisciGiocatori(cs, form.dataset.id, f.idIn);
        if (op === 'ripristina') return ops.aggiornaGiocatore(cs, form.dataset.id, { ignorato: false, attivo: true });
        if (op === 'nuovo-giocatore') return ops.aggiungiGiocatore(cs, f);
        if (op === 'config') return ops.aggiornaConfig(cs, { ...f, tipiMulta: JSON.parse(f.tipiMulta) });
        throw new Error('operazione sconosciuta');
      });
    };
  }

  // Anteprima del saldo mentre si compila: "Stizzoli: +10,00 € → 0,00 €".
  for (const form of document.querySelectorAll('form[data-anteprima]')) {
    const box = form.querySelector('.anteprima');
    const aggiorna = () => {
      const f = Object.fromEntries(new FormData(form));
      let a = null;
      try { a = ops.anteprimaSaldo(cassa, t, oggi, movimentoDaForm(form.dataset.op, f)); } catch { a = null; }
      box.innerHTML = a ? `Saldo ${esc(nickDi(f.giocatoreId))}: ${saldoHtml(a.primaCent)} → <strong>${saldoHtml(a.dopoCent)}</strong>` : '';
    };
    form.oninput = aggiorna; form.onchange = aggiorna;
  }

  const multa = document.querySelector('form[data-op="multa"]');
  if (multa) multa.tipoMulta.addEventListener('change', () => {
    const t = cassa.config.tipiMulta.find(x => x.id === multa.tipoMulta.value);
    if (t && t.importo != null) { multa.importo.value = t.importo; multa.dispatchEvent(new Event('input')); }
  });


  for (const b of document.querySelectorAll('[data-estratto]')) b.onclick = () => {
    estrattoId = b.dataset.estratto; render();
    document.getElementById('estratto')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const chiudi = document.getElementById('chiudi-estratto');
  if (chiudi) chiudi.onclick = () => { estrattoId = ''; render(); };
  for (const b of document.querySelectorAll('[data-annulla]')) b.onclick = () => {
    const mov = cassa.movimenti.find(m => m.id === b.dataset.annulla);
    if (!mov || !confirm(`Annullare questo movimento?\n\n${formattaData(mov.data)} · ${ops.descriviMovimento(mov, nickDi)}`)) return;
    esegui(b, (cs) => ops.annullaMovimento(cs, mov.id, nickDi));
  };

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
      box.innerHTML = [...cassa.giocatori].sort((a, b) => a.nickname.localeCompare(b.nickname))
        .filter(g => !g.ignorato && !g.mister && (g.attivo !== false || attuali.has(g.id)))
        .map(g => `<label><input type="checkbox" name="pres" value="${esc(g.id)}" ${attuali.has(g.id) ? 'checked' : ''}> ${esc(g.nickname)}</label>`).join('');
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
