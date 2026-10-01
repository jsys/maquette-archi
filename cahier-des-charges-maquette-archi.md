# Cahier des charges — Maquette.archi

## 1. Présentation du projet

**Nom de travail :** Maquette.archi  
**Type :** application web de modélisation 3D simplifiée pour maquettes d'architecture  
**Public principal :** étudiants en architecture, enseignants, maquettistes et designers  
**Objectif :** permettre de créer très rapidement une maquette architecturale composée de plaques planes ayant une épaisseur, puis de les assembler en 3D grâce à un système de magnétisme simple.

L'application ne cherche pas à concurrencer Blender, SketchUp, Rhino ou Shapr3D.  
Elle doit au contraire être beaucoup plus simple, avec une logique proche de la fabrication d'une maquette physique en carton.

Principe :

1. Dessiner une forme à plat.
2. Lui attribuer une épaisseur.
3. La transformer en plaque 3D.
4. Déplacer la plaque dans l'espace.
5. L'assembler à d'autres plaques par magnétisme.
6. À terme, remettre les pièces à plat pour impression ou découpe.

---

# 2. Philosophie UX

Le logiciel doit être utilisable sans connaissance préalable de la modélisation 3D.

## Principes

- pas de vocabulaire CAD complexe ;
- pas de manipulation directe des axes X / Y / Z dans l'interface principale ;
- pas de gizmo complexe type Blender ;
- priorité au glisser-déposer ;
- retour visuel permanent ;
- magnétisme évident ;
- création d'une pièce en quelques secondes ;
- interface épurée ;
- fonctionnement fluide sur ordinateur portable.

Le modèle mental utilisateur est :

> « Je découpe des morceaux de carton virtuels et je les assemble. »

et non :

> « Je crée des solides paramétriques dans un repère 3D. »

---

# 3. Objectif du prototype MVP

Le prototype doit valider une seule hypothèse :

> Est-il possible de rendre l'assemblage de plaques 3D suffisamment simple et agréable pour qu'un étudiant en architecture puisse construire une maquette sans apprendre un logiciel 3D ?

Le MVP doit permettre de fabriquer une petite maquette composée de :

- un sol ;
- quatre murs ;
- éventuellement deux pans de toiture.

---

# 4. Stack technique recommandée

## Front-end

- HTML5
- CSS
- JavaScript ou TypeScript
- Three.js

Pour le prototype, éviter un framework lourd si cela n'apporte rien.

Option recommandée :

- TypeScript
- Vite
- Three.js

## Dépendances possibles

- Three.js
- OrbitControls
- éventuellement TransformControls uniquement pour tests internes
- aucune dépendance CAD lourde pour le MVP

## Backend

Aucun backend pour la première version.

Sauvegarde locale :

- JSON ;
- LocalStorage ou IndexedDB.

---

# 5. Organisation de l'application

Interface desktop avec deux espaces principaux.

```text
┌─────────────────────────────────────────────────────────────┐
│ Maquette.archi                                  [Sauvegarder]│
├───────────────────┬─────────────────────────────────────────┤
│                   │                                         │
│   ÉDITEUR 2D      │               VUE 3D                    │
│                   │                                         │
│                   │                                         │
│                   │                                         │
├───────────────────┴─────────────────────────────────────────┤
│ Pièces : Sol | Mur 1 | Mur 2 | Mur 3 | Mur 4                │
└─────────────────────────────────────────────────────────────┘
```

Alternative possible :

- mode Dessin ;
- mode Assemblage ;

avec bascule par onglets.

Le prototype doit tester les deux approches avant décision définitive.

---

# 6. Création d'une pièce

## 6.1 Formes disponibles dans le MVP

### Rectangle

L'utilisateur saisit :

- largeur ;
- hauteur.

Exemple :

```text
Largeur : 120 mm
Hauteur : 80 mm
Épaisseur : 2 mm
```

### Polygone libre

L'utilisateur clique plusieurs points dans le plan.

Fonctions minimales :

- ajouter un point ;
- fermer le polygone ;
- déplacer un point ;
- supprimer un point.

## 6.2 Unités

Unités disponibles :

- mm par défaut ;
- cm en option.

Toutes les valeurs internes doivent être stockées dans une seule unité de référence, idéalement le millimètre.

## 6.3 Épaisseur

Chaque pièce possède une épaisseur.

Valeurs courantes proposées :

- 1 mm
- 1,5 mm
- 2 mm
- 3 mm
- 5 mm

Valeur personnalisée autorisée.

---

# 7. Génération 3D

Une forme 2D fermée devient une plaque 3D.

Implémentation Three.js recommandée :

```javascript
THREE.Shape
    ↓
THREE.ExtrudeGeometry
```

Paramètres :

```javascript
{
    depth: thickness,
    bevelEnabled: false
}
```

Chaque pièce doit devenir un objet indépendant.

Structure logique :

```text
Part
 ├─ id
 ├─ name
 ├─ shape2D
 ├─ thickness
 ├─ geometry
 ├─ position
 ├─ rotation
 ├─ edges
 └─ material
```

---

# 8. Navigation 3D

La navigation ne doit pas être confondue avec la manipulation des pièces.

## Caméra

Utiliser OrbitControls.

Actions :

- rotation de la vue ;
- zoom ;
- déplacement de caméra.

## Raccourcis envisageables

- clic gauche : sélectionner ;
- clic-glisser sur fond : rotation caméra ;
- molette : zoom ;
- clic droit ou touche espace : déplacement caméra.

Les interactions exactes devront être testées.

---

# 9. Sélection d'une pièce

Au survol :

- légère mise en évidence.

Au clic :

- pièce sélectionnée ;
- contour visible ;
- affichage éventuel de son nom.

Lorsqu'une pièce est sélectionnée, afficher un panneau minimal :

```text
Mur façade
120 × 80 mm
Épaisseur : 2 mm

[Dupliquer]
[Supprimer]
```

---

# 10. Déplacement des pièces

Le déplacement est l'élément central de l'UX.

L'utilisateur doit pouvoir prendre une plaque et la déplacer directement.

Le prototype peut d'abord utiliser une méthode simplifiée :

- déplacement sur un plan temporaire ;
- déplacement relatif à la caméra.

Éviter d'exposer directement trois flèches X / Y / Z à l'utilisateur.

---

# 11. Magnétisme / Snap

## 11.1 Objectif

Le système doit donner la sensation que les plaques « s'aimantent ».

Lorsqu'une pièce mobile approche d'une autre pièce :

- une arête compatible est détectée ;
- les deux arêtes sont mises en évidence ;
- la pièce se positionne automatiquement ;
- l'utilisateur peut accepter en relâchant la souris.

## 11.2 Types de snap MVP

Priorité :

1. arête → arête ;
2. sommet → sommet ;
3. face → face.

Le plus important est **arête → arête**.

## 11.3 Distance d'activation

Définir un seuil de snap dépendant du zoom ou de l'échelle visuelle.

Exemple initial :

```text
snapDistance = 8 à 15 pixels écran
```

Il vaut mieux raisonner en pixels écran qu'en millimètres du modèle afin d'obtenir une sensation constante.

## 11.4 Feedback visuel

Arête candidate :

- surbrillance ;
- épaississement ;
- changement visuel clair.

Une ligne ou un petit symbole peut indiquer le futur raccord.

Exemple :

```text
      plaque déplacée
          │
          │
──────────●──────────
     arête cible
```

## 11.5 Placement automatique

Lorsque deux arêtes sont associées :

1. aligner leurs centres ;
2. aligner leur direction ;
3. placer les surfaces au contact ;
4. choisir une orientation cohérente.

Orientation par défaut :

- 90° entre les plaques pour le MVP.

---

# 12. Angle entre deux pièces

Après snap :

```text
Angle : [ 90° ]
```

Valeurs rapides :

- 30°
- 45°
- 60°
- 90°
- 120°
- 135°
- 180°

Une poignée ou une petite commande contextuelle permettra ultérieurement de régler l'angle librement.

Pour le premier prototype :

- 90° suffit.

---

# 13. Gestion de l'épaisseur

Le logiciel doit tenir compte de l'épaisseur réelle des matériaux.

Exemple :

Deux plaques de 2 mm assemblées à angle droit ne doivent pas forcément se chevaucher géométriquement.

Le MVP peut accepter une approximation visuelle.

Une version ultérieure devra proposer plusieurs modes de joint :

### Bord contre face

```text
│
│
└────────
```

### Bord contre bord

```text
│
│
────────
```

### Recouvrement

Selon les méthodes de fabrication physique.

---

# 14. Liste des pièces

La maquette contient une liste de pièces.

Exemple :

```text
Sol
Mur façade
Mur arrière
Mur gauche
Mur droit
Toit gauche
Toit droit
```

Fonctions :

- sélectionner ;
- renommer ;
- masquer ;
- afficher ;
- dupliquer ;
- supprimer.

---

# 15. Duplication

Commande essentielle.

Exemple :

```text
Mur gauche
[Dupliquer]
```

La copie conserve :

- forme ;
- dimensions ;
- épaisseur ;
- matériau.

La copie reçoit un nouvel identifiant.

---

# 16. Annuler / Rétablir

Minimum :

- Ctrl/Cmd + Z ;
- Ctrl/Cmd + Shift + Z.

Actions concernées :

- création ;
- déplacement ;
- rotation ;
- suppression ;
- changement de dimensions.

---

# 17. Sauvegarde

Format JSON.

Exemple :

```json
{
  "version": 1,
  "units": "mm",
  "materials": [
    {
      "id": "cardboard-2",
      "name": "Carton gris 2 mm",
      "thickness": 2
    }
  ],
  "parts": [
    {
      "id": "part-1",
      "name": "Sol",
      "shape": [
        [0, 0],
        [120, 0],
        [120, 80],
        [0, 80]
      ],
      "thickness": 2,
      "position": [0, 0, 0],
      "rotation": [0, 0, 0],
      "materialId": "cardboard-2"
    }
  ]
}
```

Fonctions MVP :

- sauvegarder dans navigateur ;
- charger ;
- exporter JSON ;
- importer JSON.

---

# 18. Matériaux

Le MVP peut proposer :

- Carton gris ;
- Carton plume ;
- Bristol.

Chaque matériau possède :

- nom ;
- épaisseur ;
- couleur visuelle indicative.

Aucune simulation physique du matériau n'est nécessaire.

---

# 19. Grille

Afficher une grille légère dans la vue 3D.

Valeurs possibles :

- pas 1 mm ;
- 5 mm ;
- 10 mm.

La grille sert essentiellement de repère visuel.

---

# 20. Dimensions

Lorsqu'une pièce est sélectionnée, afficher ses dimensions.

Exemple :

```text
120 mm
┌──────────────────────┐
│                      │ 80 mm
└──────────────────────┘
```

Il doit être possible de modifier les dimensions d'un rectangle via des champs numériques.

---

# 21. Fonction majeure post-MVP : mise à plat

Cette fonction constitue une évolution stratégique du produit.

Commande :

```text
[Mettre les pièces à plat]
```

Le logiciel prend toutes les pièces de la maquette et les dispose dans un plan 2D.

Objectifs :

- imprimer ;
- découper manuellement ;
- découper au laser ;
- découper au plotter.

---

# 22. Export futur

Formats envisagés :

- SVG ;
- PDF ;
- DXF éventuellement ;
- STL éventuellement ;
- GLTF / GLB éventuellement.

Priorité future :

1. SVG ;
2. PDF.

L'export doit pouvoir inclure :

- contours de découpe ;
- noms des pièces ;
- repères d'assemblage ;
- dimensions ;
- numéro de pièce.

---

# 23. Fonction future : repères d'assemblage

Exemple :

```text
A1 ───────── A1
```

Deux arêtes associées peuvent recevoir automatiquement le même repère.

Exemple :

```text
Mur façade : A1
Sol : A1
```

Cela facilite l'assemblage physique après découpe.

---

# 24. Fonction future : encoches

Possibilité de créer automatiquement des encoches tenant compte de l'épaisseur du carton.

Exemple :

```text
Plaque A          Plaque B

────┐             │
    │             │
    └──           ├──
```

Les deux pièces peuvent ensuite s'emboîter physiquement.

Cette fonction est hors MVP.

---

# 25. Fonction future : bibliothèque de pièces

Exemples :

- mur rectangle ;
- pignon ;
- dalle ;
- toiture ;
- escalier simplifié ;
- poteau ;
- socle.

L'objectif reste de conserver une logique de maquette et non de devenir un logiciel BIM.

---

# 26. Fonction future : modèle à l'échelle

Possibilité de travailler à :

- 1:20 ;
- 1:50 ;
- 1:100 ;
- 1:200 ;
- échelle personnalisée.

Exemple :

```text
Mur réel : 6 m
Échelle : 1:50
Pièce de maquette : 120 mm
```

Cette fonctionnalité est particulièrement pertinente pour les étudiants en architecture.

---

# 27. Hors périmètre MVP

Ne pas développer pour la première version :

- BIM ;
- IFC ;
- murs architecturaux intelligents ;
- portes ;
- fenêtres ;
- calcul de structure ;
- moteur physique ;
- rendu photoréaliste ;
- textures avancées ;
- éclairage architectural ;
- cotation CAD complète ;
- collaboration temps réel ;
- comptes utilisateurs ;
- serveur ;
- intelligence artificielle ;
- export complexe.

---

# 28. Critères de réussite du MVP

Le prototype est considéré comme réussi si un nouvel utilisateur peut, sans tutoriel :

1. créer un rectangle ;
2. lui donner une épaisseur ;
3. voir la plaque en 3D ;
4. la dupliquer ;
5. déplacer la copie ;
6. comprendre qu'une arête peut s'aimanter ;
7. assembler deux plaques à 90° ;
8. construire une petite boîte ou une pièce avec quatre murs.

Objectif UX :

**moins de 5 minutes pour construire une première maquette simple.**

---

# 29. Scénario de test principal

Créer une petite maison.

## Sol

```text
120 × 80 mm
épaisseur 2 mm
```

## Façades

```text
2 × 120 × 60 mm
```

## Côtés

```text
2 × 80 × 60 mm
```

L'utilisateur doit pouvoir :

1. créer le sol ;
2. créer un mur ;
3. dupliquer le mur ;
4. créer un mur latéral ;
5. le dupliquer ;
6. assembler les quatre murs sur les bords du sol.

Le test est réussi si les opérations semblent évidentes.

---

# 30. Architecture de code proposée

```text
src/
├── main.ts
├── app/
│   ├── App.ts
│   └── State.ts
├── scene/
│   ├── SceneManager.ts
│   ├── CameraManager.ts
│   └── SelectionManager.ts
├── parts/
│   ├── Part.ts
│   ├── PartFactory.ts
│   └── PartGeometry.ts
├── drawing/
│   ├── Drawing2D.ts
│   ├── RectangleTool.ts
│   └── PolygonTool.ts
├── snap/
│   ├── SnapManager.ts
│   ├── EdgeSnap.ts
│   └── SnapCandidate.ts
├── interaction/
│   ├── DragManager.ts
│   └── PointerManager.ts
├── storage/
│   ├── ProjectSerializer.ts
│   └── LocalStorage.ts
└── ui/
    ├── Toolbar.ts
    ├── PartsPanel.ts
    └── PropertiesPanel.ts
```

---

# 31. Modèle d'objet `Part`

Exemple TypeScript :

```typescript
interface Vec2 {
  x: number;
  y: number;
}

interface PartData {
  id: string;
  name: string;
  points: Vec2[];
  thickness: number;
  position: [number, number, number];
  rotation: [number, number, number];
  materialId?: string;
}
```

Classe possible :

```typescript
class Part {
  data: PartData;
  mesh: THREE.Mesh;

  getEdges(): PartEdge[] {
    // Retourne les arêtes utilisables pour le snap.
  }
}
```

---

# 32. Modèle d'arête

Chaque arête doit pouvoir être interrogée pour le snap.

```typescript
interface PartEdge {
  partId: string;
  index: number;

  startLocal: THREE.Vector3;
  endLocal: THREE.Vector3;

  startWorld: THREE.Vector3;
  endWorld: THREE.Vector3;
}
```

Propriétés calculées :

- centre ;
- longueur ;
- direction ;
- coordonnées écran.

---

# 33. Algorithme de snap — première approche

Lors du drag :

1. récupérer les arêtes de la pièce déplacée ;
2. récupérer les arêtes des autres pièces ;
3. projeter leurs extrémités en coordonnées écran ;
4. calculer les distances ;
5. ignorer les candidats trop éloignés ;
6. comparer les longueurs et orientations si nécessaire ;
7. choisir le candidat ayant le meilleur score ;
8. afficher le candidat ;
9. au relâchement, appliquer la transformation.

Pseudo-code :

```javascript
for (movingEdge of movingPart.edges) {
    for (targetEdge of sceneEdges) {

        const distance = screenDistance(
            movingEdge,
            targetEdge
        );

        if (distance < SNAP_THRESHOLD) {
            candidates.push({
                movingEdge,
                targetEdge,
                score: distance
            });
        }
    }
}

const candidate = candidates.sort(
    (a, b) => a.score - b.score
)[0];
```

---

# 34. Alignement de deux arêtes

Pour un snap arête → arête :

1. calculer le vecteur direction de l'arête mobile ;
2. calculer celui de l'arête cible ;
3. calculer la rotation nécessaire ;
4. appliquer la rotation ;
5. déplacer le centre de l'arête mobile vers celui de l'arête cible ;
6. appliquer une rotation supplémentaire de 90° autour de l'arête pour former l'angle entre les plaques.

Il sera probablement utile de travailler avec :

- matrices ;
- quaternions ;
- repères locaux.

Three.js fournit les outils nécessaires.

---

# 35. Indications visuelles

Le design doit utiliser très peu d'éléments.

Exemple :

- pièce inactive : carton beige/gris ;
- pièce sélectionnée : contour renforcé ;
- arête snap possible : mise en évidence ;
- arête snap active : mise en évidence plus forte.

Le système ne doit pas dépendre uniquement de la couleur : prévoir également variation d'épaisseur, pointillés ou surbrillance.

---

# 36. Performance cible

Pour le MVP :

- 100 pièces sans ralentissement perceptible ;
- interaction cible : 60 FPS sur ordinateur récent.

Optimisations prématurées à éviter.

---

# 37. Responsive

Priorité :

1. ordinateur desktop ;
2. MacBook ;
3. tablette ultérieurement.

Le smartphone n'est pas une cible pour le MVP.

---

# 38. Compatibilité navigateurs

Priorité :

- Chrome ;
- Safari ;
- Firefox ;
- Edge.

WebGL2 recommandé si nécessaire.

---

# 39. Étapes de développement

## Étape 1 — scène 3D

- créer scène Three.js ;
- caméra ;
- lumière ;
- OrbitControls ;
- grille.

## Étape 2 — création d'une plaque

- rectangle ;
- largeur ;
- hauteur ;
- épaisseur ;
- extrusion.

## Étape 3 — sélection

- raycasting ;
- sélection ;
- suppression ;
- duplication.

## Étape 4 — déplacement

- drag d'une pièce ;
- feedback correct.

## Étape 5 — détection des arêtes

- extraction des arêtes d'une plaque ;
- visualisation debug.

## Étape 6 — snap

- détection d'arête proche ;
- mise en évidence ;
- snap à 90°.

## Étape 7 — édition 2D

- rectangle ;
- polygone.

## Étape 8 — sauvegarde

- JSON ;
- LocalStorage.

## Étape 9 — polish UX

- interface ;
- raccourcis ;
- undo/redo ;
- tests utilisateurs.

---

# 40. Priorité absolue

Ne pas chercher à faire beaucoup de fonctionnalités.

La qualité principale du prototype doit être :

> **prendre une plaque, l'approcher d'une autre et sentir immédiatement où et comment elle va venir se fixer.**

Si cette interaction est réussie, le concept est validé.

Si cette interaction est mauvaise, ajouter des fonctionnalités ne servira à rien.

---

# 41. Première tâche à donner à un agent de code

Prompt conseillé :

```text
Construis un prototype web en TypeScript + Vite + Three.js.

Objectif :
Créer un logiciel extrêmement simple de maquette architecturale virtuelle.

Pour cette première étape uniquement :

- afficher une scène Three.js avec OrbitControls ;
- afficher une grille ;
- ajouter un bouton "Créer une plaque" ;
- créer un rectangle de 120 × 80 mm et 2 mm d'épaisseur avec ExtrudeGeometry ;
- permettre de sélectionner la plaque par clic ;
- afficher un contour visuel de sélection ;
- permettre de dupliquer et supprimer la plaque ;
- organiser le code proprement en modules.

Ne développe pas encore le snap, le dessin libre, le backend ou l'export.

Le code doit rester simple, lisible et facilement extensible.

Une unité Three.js = 1 mm.

Prévois une classe Part contenant :
- id
- name
- points 2D
- thickness
- mesh

Prépare également une méthode getEdges() qui sera utilisée plus tard pour le système de magnétisme.
```

---

# 42. Phase suivante à donner à l'agent

Une fois l'étape précédente fonctionnelle :

```text
Ajoute maintenant un système de déplacement simple des plaques.

Puis implémente un premier prototype de snap arête → arête :

- calcule les arêtes d'une plaque ;
- au déplacement, cherche l'arête d'une autre plaque la plus proche ;
- utilise une distance visuelle à l'écran pour détecter le snap ;
- mets les deux arêtes candidates en évidence ;
- au relâchement, aligne la plaque déplacée sur l'arête cible ;
- place la plaque à 90° par rapport à la plaque cible.

Le système doit privilégier la simplicité UX plutôt que la généralité mathématique.

Ajoute un mode debug permettant d'afficher :
- les sommets ;
- les arêtes ;
- leur index ;
- le candidat de snap courant.
```

---

# 43. Nom de domaine / marque

Nom envisagé :

**Maquette.archi**

Positionnement possible :

> Maquette.archi — Simple architectural model maker

Version française :

> Créez et assemblez vos maquettes d'architecture en 3D.

Version anglaise :

> Build architectural models from simple virtual sheets.

---

# 44. Vision produit

À terme, le produit pourrait couvrir la chaîne complète :

```text
dessiner
    ↓
assembler virtuellement
    ↓
vérifier la maquette
    ↓
mettre à plat
    ↓
exporter SVG / PDF
    ↓
découper
    ↓
assembler physiquement
```

La différenciation du produit repose sur sa simplicité et sur le lien direct entre maquette virtuelle et maquette physique.
