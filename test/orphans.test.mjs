// Sélection des images à supprimer. Une erreur ici ferait perdre des visuels
// d'œuvres : chaque protection mérite son cas de test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { orphanKeys, usedKeys, GRACE_MS } from '../netlify/lib/orphans.mjs';

const NOW = 1_800_000_000_000;
const vieux = NOW - GRACE_MS - 1000; // au-delà du délai de grâce
const recent = NOW - 60_000;         // déposée il y a une minute

const cle = (ts, nom) => `${ts}-ab12cd-${nom}.webp`;

const contenu = {
  collections: [
    {
      key: 'ensemble',
      works: [
        { id: '1', img: `/media/${cle(vieux, 'gardee')}`, avail: true, fr: { title: 'A' } },
        { id: '2', img: 'img/ancienne-photo.jpeg', avail: true, fr: { title: 'B' } }
      ]
    },
    { key: 'corps', works: [] }
  ]
};

test('repère les images réellement utilisées', () => {
  assert.deepEqual([...usedKeys(contenu)], [cle(vieux, 'gardee')]);
});

test('ne touche jamais à une image utilisée, même ancienne', () => {
  assert.deepEqual(orphanKeys(contenu, [cle(vieux, 'gardee')], NOW), []);
});

test('supprime une image orpheline et ancienne', () => {
  assert.deepEqual(orphanKeys(contenu, [cle(vieux, 'orpheline')], NOW), [cle(vieux, 'orpheline')]);
});

test('épargne une orpheline récente — saisie peut-être en cours', () => {
  assert.deepEqual(orphanKeys(contenu, [cle(recent, 'a-peine-deposee')], NOW), []);
});

test('épargne une clé dont on ne sait pas lire la date', () => {
  assert.deepEqual(orphanKeys(contenu, ['image-sans-date.webp'], NOW), []);
});

test('ignore les fichiers historiques du dossier img', () => {
  assert.equal(usedKeys(contenu).size, 1);
});

test('trie correctement un lot mélangé', () => {
  const lot = [
    cle(vieux, 'gardee'),
    cle(vieux, 'orpheline-1'),
    cle(recent, 'orpheline-2'),
    cle(vieux, 'orpheline-3')
  ];
  assert.deepEqual(orphanKeys(contenu, lot, NOW), [cle(vieux, 'orpheline-1'), cle(vieux, 'orpheline-3')]);
});

test('un contenu vide ne supprime que ce qui est hors délai', () => {
  const vide = { collections: [] };
  assert.deepEqual(orphanKeys(vide, [cle(recent, 'x')], NOW), []);
  assert.deepEqual(orphanKeys(vide, [cle(vieux, 'x')], NOW), [cle(vieux, 'x')]);
});
