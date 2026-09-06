import { decifra } from './crypto.js';

const CHIAVE = 'socks.password';
export const store = {
  getPassword() { try { return localStorage.getItem(CHIAVE); } catch { return null; } },
  setPassword(p) { try { localStorage.setItem(CHIAVE, p); } catch { /* storage non disponibile */ } },
  clearPassword() { try { localStorage.removeItem(CHIAVE); } catch { /* idem */ } },
};

export async function caricaDati(password) {
  const rMeta = await fetch('data.meta.json', { cache: 'no-store' });
  const rEnc = await fetch('data.enc', { cache: 'no-store' });
  if (!rMeta.ok || !rEnc.ok) throw new Error('DATI_NON_DISPONIBILI');
  const meta = await rMeta.json();
  const dati = await decifra(await rEnc.arrayBuffer(), password, meta.kdf.iter);
  return { dati, meta };
}
