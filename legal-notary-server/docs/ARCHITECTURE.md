# Architecture

## Vue d'ensemble

```
Frontend (Claude Design, hors de ce dossier)
        │  HTTP / JSON, jeton JWT dans l'en-tête Authorization
        ▼
src/server.js  (Express)
        │
        ├── src/middleware/authentifier.js     — vérifie le jeton JWT
        ├── src/middleware/exigerPermission.js — vérifie la permission RBAC
        │
        ├── src/api/*.routes.js   — routes fines, aucune logique métier
        │
        └── src/services/*.js     — TOUTE la logique métier vit ici
                │
                ├── dossiers.service.js    — cycle de vie des dossiers, filtrage RBAC
                ├── fiscal.service.js      — moteur fiscal (fonctions pures, testées)
                ├── archives.service.js    — clôture, minute, archivage physique
                ├── alertes.service.js     — centre d'alertes proactives
                ├── referentiel.service.js — catalogue des actes, checklist
                ├── parametres.service.js  — réglages du cabinet
                ├── auth.service.js        — connexion, gestion des comptes
                └── audit.service.js       — journal d'audit générique
                        │
                        ▼
                src/db/pool.js — connexion PostgreSQL
                        │
                        ▼
                PostgreSQL (migrations/*.sql)
```

Règle centrale : **les routes (`src/api/`) ne contiennent jamais de
logique métier ni de SQL** — elles valident l'entrée HTTP, appellent un
service, renvoient sa réponse. Toute règle de gestion (calcul fiscal,
filtrage RBAC, numérotation d'archivage...) vit dans `src/services/` et y
est testable sans serveur HTTP ni base de données quand c'est possible
(voir `fiscal.service.js`, entièrement fait de fonctions pures).

## Pourquoi ce découpage

Le cahier des charges (message de l'utilisatrice) demande explicitement :
« le code doit toujours être documenté pour qu'un dev prenne en charge,
même logique de serveur ». Concrètement, cela a guidé les choix suivants :

- **Peu de dépendances**, choisies pour leur normalité (`express`, `pg`,
  `bcryptjs`, `jsonwebtoken`, `dotenv`) plutôt que des frameworks « tout en
  un » qui cachent la logique réelle derrière de la génération de code ou
  de la configuration déclarative. Un développeur qui connaît Node.js de
  base peut lire ce projet sans apprendre un framework maison.
- **SQL écrit à la main** (pas d'ORM) : chaque requête est visible et
  compréhensible dans le fichier qui l'utilise, avec le nom exact des
  colonnes qu'elle touche. Le prix à payer est la conversion manuelle
  snake_case (SQL) ↔ camelCase (JS), centralisée dans chaque
  `xxxVersCamel()` en tête de service.
- **Migrations SQL numérotées et un exécuteur maison de 50 lignes**
  (`src/db/migrate.js`) plutôt qu'un outil de migration externe : le
  mécanisme entier tient dans un seul fichier lisible.
- **Aucune fonctionnalité propriétaire d'un hébergeur cloud** (pas de
  Supabase, pas de fonctions serverless propriétaires) : uniquement du
  PostgreSQL standard + Node.js, portable vers n'importe quel serveur, y
  compris un serveur physique ivoirien.

## Conventions

| Sujet | Convention |
|---|---|
| Montants | Toujours en francs CFA, `bigint` en base, `Number` en JS (jamais de flottant conservé) |
| Taux | `numeric` en base, valeur décimale en JS (0.18 = 18 %) |
| Identifiants | `uuid` (généré par PostgreSQL, `gen_random_uuid()`) |
| Suppression | Jamais physique — `archived_at` renseigné, ou statut dédié |
| Écritures financières | Append-only (`compte_client_ecritures`, `fiches_taxe`) — jamais de UPDATE/DELETE dessus |
| Noms de colonnes SQL | snake_case, français, sans accent |
| Noms de variables JS | camelCase, français |
| Fuseau horaire | UTC en base ; conversion à l'affichage laissée au frontend |

## Ce qui est fait (état à la fin de cette session)

- Schéma complet (migrations/001_schema_initial.sql).
- Référentiel réel importé depuis la pratique de deux cabinets (30 et 25
  types d'actes, ~246 et ~217 tâches — voir `seed/` et
  `scripts/importer-referentiel.js`).
- Moteur fiscal testé (13 tests), avec les corrections tirées de documents
  réels du cabinet (taxe foncière 1,2 % + 3 000 FCFA, timbres/rôles à la
  page, mainlevée d'hypothèque à droit fixe confirmé).
- RBAC à 6 rôles avec portée de visibilité par dossier (pas seulement des
  permissions d'action) — voir `docs/RBAC.md`.
- Cycle de vie complet d'un dossier : création avec checklist copiée du
  référentiel, changement d'étape, mise à jour de tâche, compte client,
  clôture avec attribution de numéro de minute.
- Archivage physique/numérique avec règle FIFO (le plus ancien dossier
  clôturé est toujours archivé en premier) — voir `docs/ARCHIVAGE.md`.
- Centre d'alertes proactives (retard, stagnation, pièce bloquante
  manquante).
- Authentification JWT + audit générique des actions sensibles
  (paramètres, équipe, référentiel).
- Tests automatisés (17 tests, `npm test`, aucune base de données requise).

## Ce qui reste à faire (honnêtement, pour la suite)

- **Aucun test exécuté contre une vraie base PostgreSQL** dans cette
  session : l'environnement de développement utilisé pour écrire ce code
  n'avait ni PostgreSQL ni Docker installés. Tout le SQL a été relu à la
  main, colonne par colonne, contre le schéma (voir la session de
  développement), et la logique pure est testée, mais **la première chose
  à faire avant mise en production est de lancer `npm run migrate` puis
  `npm run seed` sur une vraie base et de vérifier que tout s'exécute sans
  erreur**, puis de tester manuellement quelques appels API (voir
  `docs/DEPLOIEMENT.md`).
- Le délai "standard" utilisé par le centre d'alertes pour une étape
  précise est approximé (délai total du type d'acte ÷ 6) plutôt que
  calculé précisément à partir des tâches de cette étape uniquement (voir
  le commentaire dans `alertes.service.js`) — à affiner si le cabinet
  trouve les alertes trop approximatives.
- Génération de PDF (fiche de taxe imprimable, expéditions) : pas encore
  faite côté backend — dépend du choix qui sera fait pour le frontend
  (rendu HTML → PDF côté serveur, ou impression navigateur côté client).
- Tableaux de bord agrégés (statistiques multi-dossiers, rapports
  périodiques) : pas construits, uniquement les listes et le centre
  d'alertes.
- OCR / import automatique de pièces : non commencé (le cahier des charges
  d'origine le classait explicitement comme non bloquant).
- Export SQL de secours / sauvegarde automatisée : à documenter dans
  `docs/DEPLOIEMENT.md` selon l'hébergement réel choisi par le cabinet.
