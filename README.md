# maquette-archi

Dessiner des plaques de carton à plat, leur donner une épaisseur, puis les assembler en 3D par
magnétisme. Pour les étudiants en architecture, dans le navigateur, sans rien installer.

*Build architectural models from simple virtual sheets.*

**Statut** : prototype en cours de développement, rien d'utilisable pour l'instant.
Site : https://jsys.github.io/maquette-archi/

## Le projet

- [Cahier des charges](cahier-des-charges-maquette-archi.md) : le produit et le MVP.
- [TODO.md](TODO.md) : ce qui reste à faire.

## Lancer en local

Site statique, sans build ni dépendance à installer. Les modules ES exigent un serveur HTTP :

```bash
python3 -m http.server 8000
```

puis ouvrir http://localhost:8000. Tests : `node --test`.

## Licence

[GNU AGPL v3](LICENSE). three.js, sous licence MIT, est copié dans `lib/three/`.
