import { caricaDati, store } from './data.js';
import { esc, oggiISO } from './util.js';
import * as home from './views/home.js';
import * as calendario from './views/calendario.js';
import * as classifica from './views/classifica.js';
import * as statistiche from './views/statistiche.js';
import * as cassa from './views/cassa.js';

const VISTE = { home, calendario, classifica, statistiche, cassa };
const TAB = [['home', '🏠', 'Home'], ['calendario', '📅', 'Calendario'], ['classifica', '🏆', 'Classifica'], ['statistiche', '📊', 'Statistiche'], ['cassa', '💰', 'Cassa']];
const app = document.getElementById('app');
let stato = null; // { dati, meta }

function rotta() {
  const parti = location.hash.replace(/^#/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return parti.length && VISTE[parti[0]] ? parti : ['home'];
}

function formattaAgg(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function renderApp() {
  const r = rotta();
  const ctx = { dati: stato.dati, meta: stato.meta, rotta: r, oggi: oggiISO(), naviga: (h) => { location.hash = h; } };
  const vista = VISTE[r[0]];
  app.innerHTML = `
    <header class="testa">
      <img src="img/logo.jpg" alt="Logo SOCKS" class="logo-squadra">
      <h1>${esc(stato.dati.torneo.squadra.nome)}</h1>
      <div class="agg">agg. ${formattaAgg(stato.meta.generato)}${stato.meta.stale ? '<br><span class="stale">dati parziali</span>' : ''}</div>
      <button id="esci" title="Esci">Esci</button>
    </header>
    <main>${vista.render(ctx)}</main>
    <nav class="tabbar">${TAB.map(([id, ic, nome]) => `<a href="#${id}" class="${id === r[0] ? 'attivo' : ''}"><span class="ic">${ic}</span>${nome}</a>`).join('')}</nav>`;
  vista.dopo(ctx, app.querySelector('main'));
  document.getElementById('esci').onclick = () => { store.clearPassword(); stato = null; renderLogin(); };
  window.scrollTo(0, 0);
}

function renderLogin(errore = '', precompilata = '') {
  app.innerHTML = `
    <div class="login">
      <div class="login-logo-wrap">
        <img src="img/logo.jpg" alt="Logo SOCKS" class="login-logo">
      </div>
      <h1>SOCKS</h1>
      <p>Inserisci la password della squadra</p>
      <form id="login">
        <input type="password" name="pw" placeholder="password" autocomplete="current-password" autofocus required value="${esc(precompilata)}">
        <button type="submit">Entra</button>
        <div class="errore">${esc(errore)}</div>
      </form>
    </div>`;
  document.getElementById('login').onsubmit = async (e) => {
    e.preventDefault();
    const pw = e.target.pw.value;
    e.target.querySelector('button').disabled = true;
    try {
      await entra(pw);
      store.setPassword(pw);
    } catch (err) {
      renderLogin(err.message === 'PASSWORD_ERRATA' ? 'Password errata' : 'Dati non disponibili, riprova più tardi');
    }
  };
}

async function entra(pw) {
  stato = await caricaDati(pw);
  renderApp();
}

window.addEventListener('hashchange', () => { if (stato) renderApp(); });

(async () => {
  const pw = store.getPassword();
  if (!pw) return renderLogin();
  try {
    await entra(pw);
  } catch (err) {
    if (err.message === 'PASSWORD_ERRATA') {
      store.clearPassword();
      renderLogin('La password è cambiata: reinseriscila');
    } else {
      renderLogin('Dati non disponibili, riprova più tardi', pw);
    }
  }
})();
