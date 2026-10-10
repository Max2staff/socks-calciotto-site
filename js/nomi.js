// Chi inserisce i tabellini a volte sbaglia i nomi. La rosa della cassa dice come correggerli:
// nome sul sito e alias portano al giocatore, un giocatore "ignorato" non va mai considerato.

// nome come nel tabellino → id del giocatore, oppure null se il nome va ignorato.
export function mappaNomi(cassa) {
  const m = new Map();
  for (const g of cassa.giocatori) for (const n of [g.nomeSito, ...(g.alias || [])]) m.set(n, g.ignorato ? null : g.id);
  return m;
}

// Copia del torneo con i tabellini della nostra squadra scritti con i nomi giusti:
// le varianti diventano il nome sul sito, i nomi ignorati spariscono (formazioni, marcatori, MVP).
export function correggiTabellini(torneo, cassa) {
  const mappa = mappaNomi(cassa);
  const nomeDi = new Map(cassa.giocatori.map(g => [g.id, g.nomeSito]));
  const nostro = torneo.squadra.id;
  // undefined = nome non in rosa (resta com'è), null = da ignorare
  const correggi = (x) => {
    if (!x || x.squadraId !== nostro || !mappa.has(x.nome)) return x;
    const id = mappa.get(x.nome);
    return id ? { ...x, nome: nomeDi.get(id) } : null;
  };
  const tabellini = {};
  for (const [id, tab] of Object.entries(torneo.tabellini || {})) {
    const visti = new Set();
    const formazioni = tab.formazioni.map(correggi).filter(Boolean).filter(x => {
      const k = `${x.squadraId}|${x.nome}`;
      if (visti.has(k)) return false;
      visti.add(k); return true;
    });
    tabellini[id] = { ...tab, formazioni, marcatori: (tab.marcatori || []).map(correggi).filter(Boolean),
      migliore: tab.migliore ? correggi(tab.migliore) : tab.migliore };
  }
  return { ...torneo, tabellini };
}
