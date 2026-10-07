# Budget Courses Server — final

Le serveur sépare chaque enseigne et impose le contexte magasin/Drive avant le catalogue.

## Endpoints

GET /api/health
GET /api/stores
GET /api/stores/:store/locations?postalCode=76000&city=Rouen
GET /api/stores/:store/locations/:locationId/categories
GET /api/stores/:store/locations/:locationId/products?q=lait
GET /api/smoke?q=lait

## Fiabilité

- Aucun prix inventé.
- `verified:true` uniquement si un prix réel a été extrait d'une source officielle.
- Pour une enseigne qui exige une session/catalogue magasin côté navigateur, l'API renvoie `requiresOfficialSelection:true` et le lien officiel de sélection.
- Le serveur ne contourne ni CAPTCHA, ni anti-bot, ni connexion.
- Le front-end peut utiliser `officialSelectionUrl` pour faire choisir le Drive à l'utilisateur.

## Render

Build: `npm install`
Start: `node index.js`
