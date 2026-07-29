// Helpers partagés par les fonctions : authentification et accès au stockage.
import { createHash, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';

export const CONTENT_KEY = 'works.json';

/** Le contenu du site (JSON des œuvres). */
export function contentStore() {
  // `strong` : après un enregistrement, la lecture suivante voit bien la nouvelle version.
  return getStore({ name: 'content', consistency: 'strong' });
}

/** Les images déposées depuis l'admin. */
export function mediaStore() {
  return getStore({ name: 'media', consistency: 'strong' });
}

/**
 * Compare deux secrets sans fuite de temps. On passe par un hash pour que la
 * comparaison porte toujours sur des tampons de même longueur.
 */
function sameSecret(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Vérifie le mot de passe d'administration envoyé dans l'en-tête `x-admin-password`.
 * Renvoie une `Response` d'erreur si l'accès est refusé, sinon `null`.
 */
export function denyUnlessAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return json(
      { error: "L'administration n'est pas configurée : la variable ADMIN_PASSWORD est absente." },
      503
    );
  }
  if (expected.length < 12) {
    return json(
      { error: 'Le mot de passe configuré est trop court (12 caractères minimum).' },
      503
    );
  }

  const given = req.headers.get('x-admin-password') || '';
  if (!given || !sameSecret(given, expected)) {
    return json({ error: 'Mot de passe incorrect.' }, 401);
  }
  return null;
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
  });
}
