# Legal Notary — Backend

API serveur de gestion d'office notarial (Côte d'Ivoire). Node.js + Express
+ PostgreSQL, pensée pour être installée **par un seul cabinet** sur son
propre serveur (physique ou cloud) — pas un service centralisé partagé
entre plusieurs cabinets.

Le frontend (les écrans) n'est **pas** dans ce dossier : il vit dans
`../legal-notary-web/` (HTML/CSS/JS, sans framework), servi par ce même
serveur en production (voir `src/server.js` et `docs/DEPLOIEMENT.md`).
Son design reprend fidèlement un export réel de Claude Design — voir
`docs/PROMPT_CLAUDE_DESIGN.md` pour l'identité visuelle et ce qui reste à
concevoir.

## Démarrage (installation locale / développement)

Prérequis : Node.js ≥ 18, PostgreSQL ≥ 13 (installé localement, ou accès à
une base distante).

```bash
npm install
cp .env.example .env
# éditer .env : DATABASE_URL, JWT_SECRET (voir les commentaires du fichier)
npm run migrate
npm run seed
node scripts/creer-premier-utilisateur.js "Votre nom" vous@etude.ci un-mot-de-passe-solide
npm start
```

L'API écoute par défaut sur `http://localhost:4000`. `GET /api/sante`
répond `{"etat":"ok"}` si tout fonctionne.

## Tests

```bash
npm test
```

Aucune base de données n'est nécessaire : les tests couvrent le moteur
fiscal et le classement du référentiel (fonctions pures). Voir
`tests/fiscal.service.test.js` et `tests/importer-referentiel.test.js`.

## Structure du projet

```
migrations/           schéma SQL, numéroté, appliqué par src/db/migrate.js
seed/                  catalogue réel des actes (2 cabinets, extrait d'Excel)
scripts/               scripts à exécuter une fois (import, bootstrap)
src/
  db/                  connexion PostgreSQL, exécuteur de migrations
  rbac/                rôles et permissions (voir docs/RBAC.md)
  services/            toute la logique métier (aucune route ne contient de logique)
  api/                 routes Express, fines, appellent les services
  middleware/          authentification JWT, vérification de permission
  server.js            point d'entrée
tests/                 tests unitaires (node --test, aucune dépendance de test)
docs/                  documentation d'architecture, RBAC, archivage, déploiement
```

Chaque fichier porte un commentaire d'en-tête expliquant son rôle — un
développeur qui découvre le projet peut comprendre l'architecture fichier
par fichier sans documentation externe.

## Documents à lire ensuite

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — vue d'ensemble, conventions, ce qui reste à construire.
- [`docs/RBAC.md`](docs/RBAC.md) — qui a le droit de voir/faire quoi, et pourquoi.
- [`docs/ARCHIVAGE.md`](docs/ARCHIVAGE.md) — logique d'archivage numérique/physique.
- [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md) — installer sur le serveur réel du cabinet.
- [`NOTES_HYPOTHESES.md`](NOTES_HYPOTHESES.md) — valeurs fiscales à confirmer avant mise en production.
