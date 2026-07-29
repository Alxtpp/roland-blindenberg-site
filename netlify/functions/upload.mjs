// Dépôt d'une image depuis l'admin. Le navigateur l'a déjà redimensionnée et
// compressée : on ne reçoit ici qu'un fichier léger.
import { mediaStore, denyUnlessAdmin, json } from '../lib/admin.mjs';

export const config = { path: '/api/upload' };

const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png'
};

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405, { allow: 'POST' });

  const denied = denyUnlessAdmin(req);
  if (denied) return denied;

  const type = (req.headers.get('content-type') || '').split(';')[0].trim();
  const ext = EXTENSIONS[type];
  if (!ext) return json({ error: 'Format accepté : WebP, JPEG ou PNG.' }, 415);

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0) return json({ error: 'Fichier vide.' }, 400);
  if (bytes.byteLength > MAX_BYTES) return json({ error: 'Image trop lourde (5 Mo maximum).' }, 413);

  const key = `${Date.now()}-${randomId()}-${slug(req.headers.get('x-filename'))}.${ext}`;
  await mediaStore().set(key, bytes, { metadata: { contentType: type } });

  return json({ ok: true, path: `/media/${key}`, bytes: bytes.byteLength });
};

/** Nom de fichier lisible et sans surprise : accents retirés, seuls a-z0-9- gardés. */
function slug(name) {
  const base = (name || 'image').replace(/\.[^.]+$/, '');
  const clean = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return clean || 'image';
}

function randomId() {
  return Math.random().toString(36).slice(2, 8);
}
