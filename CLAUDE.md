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
- `js/geometry.js` : calculs purs (boîtes, placement, bords, glisser), testés dans `test/`.
  Un bord = un segment du contour, donc une tranche du carton (`partEdges`).
- `js/snap.js` : snap arête → arête, pur et testé ; ses règles sont écrites en tête du fichier.
  Au relâché, la pièce retient le bord où elle s'appuie (`attachedTo`), préféré au glisser suivant.
- `js/collision.js` : pièces solides (axes séparateurs sur des prismes convexes, contact toléré à
  0,01 mm). Glisser et flèches s'arrêtent au contact (`sweep`), une rotation ou un snap qui
  heurterait est refusé, les pièces qui se chevauchent quand même sont entourées de rouge.
- Rotation (`rotatedPose`) : R quart de tour vertical, B bascule vers soi, Maj l'autre sens ; le
  point le plus bas de la pièce ne bouge pas.
- Flèches de déplacement (TransformControls, plans masqués) sur un repère posé au centre de la
  pièce sélectionnée ; la pièce suit, au mm, par `sweep`. La table (Y = 0) est un plancher.
  Clavier : Alt+↑/↓ ou Pg.préc./Pg.suiv. pour monter et descendre.
- `js/debug-view.js` : mode debug (case « Debug » de l'en-tête), bords et sommets par-dessus tout.
- `js/history.js` : annuler et rétablir par instantanés du document ; `main.js` photographie juste
  avant chaque changement (`remember`), une rafale de même nature ne fait qu'une étape.
- `js/storage.js` : JSON du document (CdC § 17). La maquette en cours est gardée à chaque
  changement (clé `maquette.document`) ; nommée (« Enregistrer… », `id` + `name`), elle est aussi
  tenue à jour dans la bibliothèque du navigateur (`maquette.plans` + `maquette.plan.<id>`), que
  liste « Ouvrir… ». Export et import en fichier ; un fichier lu est contrôlé pièce par pièce.
  Les comptes viendront plus tard : la bibliothèque est la seule partie à remplacer.
- `js/editor2d.js` : dessin SVG de la nouvelle plaque (rectangle coté ou polygone), Y vers le haut ;
  le contour est contrôlé (`contourProblem`) et rangé (`normalizeContour`) avant l'extrusion.
- `js/main.js` tient l'état (document, sélection) et les actions ; `js/panels.js` (HTML) et
  `js/pointer.js` (survol, clic, glisser) ne font que les appeler.

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
