// Repérage des images qui ne sont plus référencées par aucune œuvre.
//
// Une image devient orpheline quand on remplace la photo d'une œuvre ou qu'on
// retire l'œuvre du site. Sans nettoyage, elles s'accumuleraient indéfiniment.

/** Délai avant qu'une image non référencée puisse être supprimée. */
export const GRACE_MS = 24 * 60 * 60 * 1000;

const PREFIX = '/media/';

/** Les clés d'images réellement utilisées par le contenu. */
export function usedKeys(data) {
  const used = new Set();
  for (const coll of data.collections || []) {
    for (const work of coll.works || []) {
      if (typeof work.img === 'string' && work.img.startsWith(PREFIX)) {
        used.add(decodeURIComponent(work.img.slice(PREFIX.length)));
      }
    }
  }
  return used;
}

/**
 * Parmi `keys`, celles qu'on peut supprimer sans risque.
 *
 * Deux protections : une image encore référencée n'est jamais touchée, et une
 * image récente non plus — elle peut avoir été déposée dans un formulaire en
 * cours de saisie, pas encore enregistré. Les clés produites par l'envoi
 * commencent par un horodatage ; si on n'arrive pas à le lire, on s'abstient.
 */
export function orphanKeys(data, keys, now = Date.now()) {
  const used = usedKeys(data);

  return keys.filter((key) => {
    if (used.has(key)) return false;

    const stamp = Number(String(key).split('-')[0]);
    if (!Number.isFinite(stamp) || stamp <= 0) return false;

    return now - stamp >= GRACE_MS;
  });
}
