import { esc } from '../util.js';

export const nomeSquadra = (dati, id) => (dati.torneo.squadre.find(s => s.id === id) || { nome: '?' }).nome;
export const badgeEsito = (esito) => esito ? `<span class="esito ${esito}">${esito}</span>` : '<span class="esito x">–</span>';
export const card = (titolo, corpo, extra = '') => `<section class="card ${extra}">${titolo ? `<h3>${esc(titolo)}</h3>` : ''}${corpo}</section>`;
export const vuoto = (msg) => `<p class="vuoto">${esc(msg)}</p>`;
export const punteggio = (p) => (p.giocata ? `${p.gf} - ${p.gs}` : '–');
export const iconaLuogo = (casa) => (casa ? '🏠' : '✈️');
