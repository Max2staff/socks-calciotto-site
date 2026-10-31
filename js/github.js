// Lettura/scrittura di un file JSON nel repo privato via GitHub Contents API.
const API = 'https://api.github.com';

export function codificaBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function decodificaBase64Utf8(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

export class RepoGitHub {
  constructor({ owner, repo, token, path = 'data/cassa.json' }) { Object.assign(this, { owner, repo, token, path }); }

  get url() { return `${API}/repos/${this.owner}/${this.repo}/contents/${this.path}`; }
  get headers() { return { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }; }

  async leggi() {
    const r = await fetch(`${this.url}?t=${Date.now()}`, { headers: this.headers, cache: 'no-store' });
    if (r.status === 401) throw new Error('Token non valido o scaduto');
    if (r.status === 404) throw new Error('Repo o file non trovato: controlla owner/repo');
    if (!r.ok) throw new Error(`GitHub: ${r.status}`);
    const j = await r.json();
    return { cassa: JSON.parse(decodificaBase64Utf8(j.content)), sha: j.sha };
  }

  async scrivi(cassa, messaggio, sha) {
    const r = await fetch(this.url, { method: 'PUT', headers: this.headers,
      body: JSON.stringify({ message: messaggio, sha, content: codificaBase64Utf8(JSON.stringify(cassa, null, 2) + '\n') }) });
    if (r.status === 409 || r.status === 422) throw Object.assign(new Error('CONFLITTO'), { conflitto: true });
    if (!r.ok) throw new Error(`GitHub: ${r.status}`);
    return (await r.json()).content.sha;
  }

  async salva(mutatore) {
    for (let tentativo = 0; tentativo < 2; tentativo++) {
      const { cassa, sha } = await this.leggi();
      const messaggio = mutatore(cassa);
      try { return { messaggio, sha: await this.scrivi(cassa, messaggio, sha), cassa }; }
      catch (e) { if (!e.conflitto || tentativo === 1) throw e; }
    }
  }
}
