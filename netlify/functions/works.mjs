// Lecture publique et écriture protégée du contenu du site (les œuvres).
import { contentStore, mediaStore, CONTENT_KEY, denyUnlessAdmin, json } from '../lib/admin.mjs';
import { orphanKeys } from '../lib/orphans.mjs';

export const config = { path: '/api/works' };

const LANGS = ['fr', 'en', 'de'];
const MAX_WORKS = 500;
const MAX_BYTES = 2 * 1024 * 1024;

export default async (req) => {
  if (req.method === 'GET') return read(req);
  if (req.method === 'PUT') return write(req);
  return json({ error: 'Méthode non autorisée.' }, 405, { allow: 'GET, PUT' });
};

async function read(req) {
  const stored = await contentStore().get(CONTENT_KEY, { type: 'json' });
  if (stored) {
    return json(stored, 200, { 'cache-control': 'public, max-age=0, must-revalidate' });
  }

  // Rien n'a encore été enregistré depuis l'admin : on sert le contenu d'origine,
  // livré avec le site. Le premier enregistrement prendra le relais.
  const seed = await fetch(new URL('/data/works.json', req.url));
  if (!seed.ok) return json({ error: 'Contenu initial introuvable.' }, 500);
  return json(await seed.json(), 200, { 'cache-control': 'public, max-age=0, must-revalidate' });
}

async function write(req) {
  const denied = denyUnlessAdmin(req);
  if (denied) return denied;

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return json({ error: 'Contenu trop volumineux.' }, 413);

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ error: 'JSON invalide.' }, 400);
  }

  const problem = validate(data);
  if (problem) return json({ error: problem }, 400);

  await contentStore().setJSON(CONTENT_KEY, data);
  const total = data.collections.reduce((n, c) => n + c.works.length, 0);
  const cleaned = await sweepMedia(data);

  return json({ ok: true, works: total, cleaned, savedAt: new Date().toISOString() });
}

/**
 * Supprime les images devenues inutiles. Le contenu est déjà enregistré à ce
 * stade : un échec du nettoyage ne doit pas faire échouer la publication.
 */
async function sweepMedia(data) {
  try {
    const store = mediaStore();
    const { blobs } = await store.list();
    const orphans = orphanKeys(data, blobs.map((b) => b.key));

    await Promise.all(orphans.map((key) => store.delete(key)));
    return orphans.length;
  } catch {
    return 0;
  }
}

/** Renvoie un message d'erreur si la structure est incorrecte, sinon `null`. */
function validate(data) {
  if (!data || typeof data !== 'object') return 'Contenu vide.';
  if (!Array.isArray(data.collections) || data.collections.length === 0) {
    return 'Aucune série dans le contenu.';
  }

  let total = 0;
  for (const coll of data.collections) {
    if (!coll || typeof coll.key !== 'string' || !/^[a-z0-9-]{1,40}$/.test(coll.key)) {
      return 'Identifiant de série invalide.';
    }
    if (!Array.isArray(coll.works)) return `Série « ${coll.key} » : liste d'œuvres manquante.`;

    total += coll.works.length;
    if (total > MAX_WORKS) return `Trop d'œuvres (maximum ${MAX_WORKS}).`;

    for (const w of coll.works) {
      if (!w || typeof w.id !== 'string' || !w.id) return 'Œuvre sans identifiant.';
      if (typeof w.img !== 'string' || !isSafeImage(w.img)) {
        return `Œuvre « ${w.id} » : chemin d'image invalide.`;
      }
      if (typeof w.avail !== 'boolean') return `Œuvre « ${w.id} » : disponibilité invalide.`;
      if (w.wide !== undefined && typeof w.wide !== 'boolean') {
        return `Œuvre « ${w.id} » : mise en page invalide.`;
      }

      if (!isText(w.fr) || !w.fr.title.trim()) {
        return `Œuvre « ${w.id} » : le titre en français est obligatoire.`;
      }
      for (const lang of LANGS) {
        if (w[lang] !== undefined && !isText(w[lang])) {
          return `Œuvre « ${w.id} » : traduction « ${lang} » invalide.`;
        }
      }
    }
  }
  return null;
}

/** Une image doit venir des fichiers du site ou des dépôts de l'admin — jamais d'ailleurs. */
function isSafeImage(src) {
  return (src.startsWith('img/') || src.startsWith('/media/')) && !src.includes('..');
}

function isText(t) {
  return (
    t &&
    typeof t === 'object' &&
    ['title', 'dims', 'desc'].every(
      (f) => typeof t[f] === 'string' && t[f].length <= 2000
    )
  );
}
