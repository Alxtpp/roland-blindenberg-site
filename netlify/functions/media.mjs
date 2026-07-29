// Sert les images déposées depuis l'admin.
import { mediaStore } from '../lib/admin.mjs';

export const config = { path: '/media/*' };

export default async (req) => {
  const key = decodeURIComponent(new URL(req.url).pathname.replace(/^\/media\//, ''));
  if (!key || key.includes('..') || key.includes('/')) {
    return new Response('Image introuvable.', { status: 404 });
  }

  const found = await mediaStore().getWithMetadata(key, { type: 'arrayBuffer' });
  if (!found) return new Response('Image introuvable.', { status: 404 });

  return new Response(found.data, {
    headers: {
      'content-type': found.metadata?.contentType || 'application/octet-stream',
      // La clé contient un horodatage : une image publiée ne change jamais.
      'cache-control': 'public, max-age=31536000, immutable'
    }
  });
};
