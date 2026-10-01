# CLAUDE.md

## Le projet

**maquette-archi** : un site web pour dessiner des plaques de carton à plat, leur donner une
épaisseur et les assembler en 3D par magnétisme. Public visé : étudiants en architecture.

- [cahier-des-charges-maquette-archi.md](cahier-des-charges-maquette-archi.md) : le produit et le
  MVP. Il fait foi.
- Suivi des tâches : `TODO.md` à la racine (skill `/todo`).

## Règles

- **Projet autonome** : aucune dépendance à un autre projet, rien n'est repris d'ailleurs.
- **Site statique sans build** : `index.html`, CSS, modules ES natifs. Pas de framework, pas de
  compte, pas de serveur applicatif ; la sauvegarde reste dans le navigateur.
- **Une seule bibliothèque** : three.js 0.186.1, fichiers du paquet npm copiés tels quels dans
  `lib/three/` (r186 ne publie plus de version minifiée), chargés par import map (`three`,
  `three/addons/`). Les modules purs importent directement `../lib/three/three.core.js`, qui
  tourne sous Node sans DOM : c'est ce qui permet des tests sans dépendance.
- **Prototype** : on cherche la bonne ergonomie du magnétisme (CdC § 40), pas une architecture
  définitive. Une unité three.js = 1 mm, Y vertical.
- Les modules purs (géométrie, magnétisme, sérialisation) se testent avec `node --test`, sans
  dépendance.

## Architecture

- `js/model.js` : le document, données pures sérialisables (CdC § 17). Une pièce = contour 2D en
  mm, épaisseur, matériau, position et quaternion.
- `js/parts-view.js` reconstruit les maillages depuis le modèle (`sync`), jamais l'inverse.
- `js/geometry.js` : calculs purs (boîtes, placement), testés dans `test/`.

## Publication

- Dépôt public [jsys/maquette-archi](https://github.com/jsys/maquette-archi), licence AGPL-3.0.
  Rien de privé dans le dépôt ni dans son historique.
- Site sur GitHub Pages, servi tel quel depuis la racine de `main` (`.nojekyll`) : **pousser sur
  `main`, c'est publier**.
- Chemins relatifs partout : le site doit marcher sous `/maquette-archi/` comme à la racine d'un
  domaine.
- Clés du stockage navigateur préfixées `maquette.` : l'origine `jsys.github.io` est partagée par
  tous les sites du compte.

## Commandes

- Serveur local : `python3 -m http.server 8000`, puis http://localhost:8000 (les modules ES ne se
  chargent pas en `file://`).
- Tests : `node --test`, dès les premiers modules purs.
