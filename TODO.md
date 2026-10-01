# TODO Maquette

Règles du format (identifiants, sentinelles, ce qui entre et sort d'ici) : skill **`/todo`**.

- **Préfixes** : `M` MVP · `ML` mise en ligne · `B` bugs

## MVP

Étapes du [cahier des charges](cahier-des-charges-maquette-archi.md) § 39.

- `M4` **Déplacement** : glisser une pièce, retour visuel. § 10
- `M5` **Arêtes** : extraction des bords d'une plaque, mode debug (sommets, arêtes, index, candidat). § 32, § 42
- `M6` **Snap arête → arête** : détection en pixels écran, mise en évidence, pose à 90°. § 11, § 33, § 34. Règles retenues (01/10/2026) : l'arête est le bord du carton ; la tranche de la pièce déplacée se pose sur la face de la cible, centrée sur son bord, face extérieure affleurante ; côté d'où l'on amène la pièce, sinon côté caméra ; bord choisi par longueur la plus proche, puis distance à l'écran.
- `M7` **Éditeur 2D** : rectangle, polygone (ajouter, fermer, déplacer, supprimer un point), mise en page. § 5, § 6
- `M8` **Sauvegarde** : navigateur, export et import JSON. § 17
- `M9` **Finitions** : annuler et rétablir, raccourcis, interface. § 16
- `M10` **Test d'usage** : le scénario de la maison, sans tutoriel, en moins de 5 minutes. § 28, § 29

→ prochain : `M11`

## Mise en ligne

- `ML1` **Domaine définitif** : le choisir et le brancher sur GitHub Pages avant d'annoncer le site, car la sauvegarde navigateur est liée au domaine.
- `ML2` **Mentions légales** : éditeur (identité, contact) et hébergeur (GitHub), obligatoires en France.

→ prochain : `ML3`

## Bugs

→ prochain : `B1`
