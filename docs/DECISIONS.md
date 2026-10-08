# Journal des Décisions Techniques & Architecturales — Legal Notary

## Décision C0 — Chaîne de contrôle automatique & Baseline ESLint (8 octobre 2026)

**Date** : 8 octobre 2026 · **Branche** : `securite-1`

### Contexte et Décision
Conformément à la section 15 bis C du Cahier des charges v2 et aux directives de l'Étape C0, une chaîne de contrôle automatique GitHub Actions est mise en place.
Pour permettre la détection immédiate de toute régression sans bloquer les développements actuels sur les erreurs historiques du code existant, un mécanisme de **baseline différentielle** a été arrêté :
- **Formatage Prettier** : Appliqué en une seule fois dans un commit dédié (`style: formatage Prettier initial, aucun changement fonctionnel`). Le check `prettier --check` est désormais strictement bloquant (0 tolérance).
- **Contrôle ESLint** : Les 6 erreurs et 274 avertissements préexistants sont figés dans `legal-notary-server/eslint-baseline.json`. La CI bloque **uniquement l'apparition de nouvelles erreurs** dans les fichiers modifiés par chaque Pull Request.
- **Résorption programmée** : Les anomalies existantes seront traitées au fil de l'avancement des étapes de sécurité (S01 à S25) et des lots métier (Lots 0 à 8).

### Inventaire exhaustif des anomalies ESLint de référence (Baseline C0)

| Fichier | Erreurs (bloquantes dans baseline) | Avertissements | Étape cible prévue |
| :--- | :---: | :---: | :--- |
| `scripts/importer-referentiel.js` | **0** | 5 | Lots métier / Refactoring |
| `src/api/auth.routes.js` | **0** | 1 | S01 / S03 / S05 |
| `src/api/fiscal.routes.js` | **0** | 10 | Résolu (imports fs, path) |
| `src/api/rapports.routes.js` | **0** | 1 | Lots métier / Refactoring |
| `src/api/recus.routes.js` | **0** | 1 | Lots métier / Refactoring |
| `src/db/migrate.js` | **0** | 1 | S08 / S23 |
| `src/db/pool.js` | **0** | 6 | S08 / S23 |
| `src/middleware/controlHubAuth.middleware.js` | **0** | 1 | Lots métier / Refactoring |
| `src/server.js` | **0** | 8 | Lots métier / Refactoring |
| `src/services/archives.service.js` | **0** | 11 | Lots métier / Refactoring |
| `src/services/auth.service.js` | **0** | 16 | S01 / S03 / S05 |
| `src/services/campagnes-numerisation.service.js` | **0** | 3 | Résolu (import pool) |
| `src/services/demande-demo.service.js` | **0** | 3 | Lots métier / Refactoring |
| `src/services/dossiers.service.js` | **0** | 22 | Lots métier / Refactoring |
| `src/services/email-deploiement.service.js` | **0** | 4 | Lots métier / Refactoring |
| `src/services/excel-renderer.service.js` | **0** | 16 | Lots métier / Refactoring |
| `src/services/excel.service.js` | **0** | 9 | Lots métier / Refactoring |
| `src/services/fiscal.service.js` | **0** | 11 | Lot 0 (Multi-pays) & S11 |
| `src/services/internal-control.service.js` | **0** | 5 | S14 |
| `src/services/kyc.service.js` | **0** | 1 | Lots métier / Refactoring |
| `src/services/manuel-procedure.service.js` | **0** | 5 | Lots métier / Refactoring |
| `src/services/monitoring-support.service.js` | **0** | 5 | Lots métier / Refactoring |
| `src/services/mouvements-physiques.service.js` | **0** | 8 | Lots métier / Refactoring |
| `src/services/notifications.service.js` | **0** | 4 | Lots métier / Refactoring |
| `src/services/numerisation-ocr.service.js` | **0** | 4 | Lots métier / Refactoring |
| `src/services/packs.service.js` | **0** | 6 | Lots métier / Refactoring |
| `src/services/parametres-notifications.service.js` | **0** | 4 | Lots métier / Refactoring |
| `src/services/parametres.service.js` | **0** | 6 | Lots métier / Refactoring |
| `src/services/projets-acte.service.js` | **0** | 6 | Lots métier / Refactoring |
| `src/services/rapports.service.js` | **0** | 1 | Lots métier / Refactoring |
| `src/services/recherche-unifiee.service.js` | **0** | 1 | Lots métier / Refactoring |
| `src/services/recus.service.js` | **0** | 9 | Lots métier / Refactoring |
| `src/services/referentiel.service.js` | **0** | 17 | Lots métier / Refactoring |
| `src/services/sauvegarde-immuable.service.js` | **0** | 12 | S08 / S09 / S16 |
| `src/services/stockage-persistant.service.js` | **0** | 4 | Lots métier / Refactoring |
| `src/services/storage/storage.service.js` | **0** | 23 | S08 / S09 / S16 |
| `src/services/superadmin.service.js` | **0** | 13 | S02 / A1 |
| `src/services/sync-engine.service.js` | **0** | 4 | Lots métier / Refactoring |
| `src/services/tableau-bord.service.js` | **0** | 1 | Lots métier / Refactoring |
| `src/services/telemetrie.service.js` | **0** | 3 | S15 / S24 |
| `tests/dno-numerotation-recus.test.js` | **0** | 1 | Lots métier / Refactoring |
| `tests/excel.service.test.js` | **0** | 2 | Lots métier / Refactoring |
| `tests/internal-control.test.js` | **0** | 1 | S14 |
| `tests/kyc.service.test.js` | **0** | 1 | Lots métier / Refactoring |
| **TOTAL (44 fichiers)** | **0** | **276** | *0 erreur restante (seuls des avertissements non-bloquants subsistent)* |

### Résolution des 6 erreurs de référence (Étape C0 clôture)
1. **`src/api/fiscal.routes.js`** (3 erreurs `no-undef` résolues) : variables `fs` et `path` désormais importées au sommet du fichier. Couvert par le test `tests/lint_fixes_c0.test.js` (téléchargement modèle standard et gestion 404 sans ReferenceError).
2. **`src/services/campagnes-numerisation.service.js`** (3 erreurs `no-undef` résolues) : import destructuré de `{ pool }` ajouté depuis `../db/pool`. Couvert par le test `tests/lint_fixes_c0.test.js` (`listerCampagnes`, `creerCampagne`, `enregistrerAvancementLot` testés sans ReferenceError).

### Décision C0-bis — Détection Gitleaks intégrale (Motif Générique)
- **Gitleaks sur tout l'historique** : Configuration `.gitleaks.toml` à la racine sans aucune valeur secrète en clair. Utilisation d'une règle générique (`generic-fallback-secret-hex`) détectant toute chaîne hexadécimale de 32 caractères ou plus utilisée comme valeur de repli d'un secret (ex. après `JWT_SECRET ||` dans `src/services/auth.service.js`).
- **Statut CI** : Le job Gitleaks scanne l'intégralité de l'historique Git (`gitleaks detect --log-opts="--all"`). Il restera **strictement ROUGE** jusqu'à l'étape S04 (suppression définitive du fallback dans le code et rotation/purge de l'historique).

### Décision C0-ter — Baseline différentielle Semgrep SAST
- **Baseline de référence Semgrep** : Création de `semgrep-baseline.json` recensant les 17 alertes préexistantes du dépôt (2 High sur AES-256-GCM, 3 Medium Nginx, 1 Low HTML, 11 Info CI).
- **Contrôle différentiel** : Exécution via `scripts/securite/verifier-semgrep.py`. Le job échoue obligatoirement (code de sortie 1) dès qu'une **nouvelle alerte de gravité élevée (ERROR / HIGH)** non répertoriée dans la baseline est introduite.

### Signalement Modification Fichier Sensible : `src/db/pool.js` (Section 15 bis D)
- **Fichier** : `legal-notary-server/src/db/pool.js`
- **Modification apportée** :
  - En mode test (`NODE_ENV === "test"`), `pool.js` exige strictement `TEST_DATABASE_URL` (avec repli local strict par défaut `postgresql://localhost:5432/legal_notary_test`), **sans aucun repli sur `DATABASE_URL`** pour garantir l'étanchéité absolue vis-à-vis des bases distantes.
  - Conditionnement de l'affectation `poolConfig.password` : assigné uniquement si `process.env.PGPASSWORD` ou `process.env.DB_PASSWORD` est non vide, évitant d'écraser le mot de passe extrait de `TEST_DATABASE_URL`.
- **Justification** : Prévention stricte de toute collision avec une base de production ou de staging, et résolution de l'erreur d'authentification SCRAM SASL dans les conteneurs de test. La sécurité stricte refusant les URL sans `localhost` ou `127.0.0.1` demeure inchangée et active.

## Décision S01 — Suppression des mots de passe universels (8 octobre 2026)

**Date** : 8 octobre 2026 · **Branche** : `securite-1` · **Réf. audit** : Section 3 (S01)

### Contexte et Décision
L'audit de sécurité approfondi a révélé la présence de portes dérobées permettant de se connecter à n'importe quel compte en saisissant `"notaire123"` ou `"admin123"`, ainsi que des comparaisons permissives avec des mots de passe en clair dans `src/services/auth.service.js`.
Décisions arrêtées :
1. **Suppression de tout mot de passe universel et secours en clair** : Dans `auth.service.js` (fonction `connecter`), seule la vérification cryptographique `bcrypt.compare` contre `mot_de_passe_hash` est autorisée. Tout mot de passe de secours ou comparaison en clair (`utilisateur.mdp`, `compteSecours.mdp`, `"notaire123"`, `"admin123"`) est supprimé, aussi bien dans le chemin PostgreSQL que dans le repli mémoire.
2. **Obligation stricte du mot de passe (Erreur 400)** : Partout où un mot de passe par défaut a été retiré (`creerUtilisateur`, `equipe.routes.js`, `email-deploiement.service.js`, `superadmin.service.js`), si aucun mot de passe n'est fourni, l'opération est formellement refusée avec une erreur 400 ("Mot de passe obligatoire."). Aucun mot de passe vide ou valeur par défaut n'est toléré.
3. **Désactivation de `sync-passwords.js`** : Le script a été neutralisé pour refuser toute exécution jusqu'à son déplacement et sécurisation sous `scripts/demo/` lors de S07.
4. **Comptes démo hors ligne** : Les mots de passe en clair ont été retirés de `COMPTES_DEMO_OFFLINE`. La connexion hors ligne sans base est désactivée en attendant le module de démonstration isolé (S07).
5. **Couverture de tests automatisés** : Création de `tests/securite_s01_mots_de_passe.test.js` couvrant l'authentification avec mot de passe réel, le rejet 401 des backdoors, la résilience face aux hash corrompus, le rejet 400 des créations sans mot de passe, et la confirmation automatisée de l'absence de `"notaire123"` et `"admin123"` dans `src/`.

## Décision S02 — Contrôle strict des rôles SuperAdmin et Éditeur SaaS (8 octobre 2026)

**Date** : 8 octobre 2026 · **Branche** : `securite-1` · **Réf. audit** : Section 3 (S02) & Cahier des charges (Section 3 bis, Exigence 2)

### Contexte et Décision
L'audit de sécurité approfondi a révélé que la console Super-Administrateur (`src/api/superadmin.routes.js`, 26 routes) et les rapports d'activité SaaS (`src/api/rapports.routes.js`, 6 routes) étaient accessibles à tout collaborateur authentifié d'un office (notaire, clerc, assistante, etc.), permettant la suppression d'études ou la réinitialisation de mots de passe sans restriction de privilèges.
Décisions arrêtées :
1. **Refus par défaut sur la Console SuperAdmin** : Ajout du middleware `exigerSuperadmin` en tête de `src/api/superadmin.routes.js` via `router.use(exigerSuperadmin)`. Seul le rôle `"superadmin"` est autorisé. Tout autre rôle (notamment les 7 rôles d'étude) est rejeté avec un code HTTP 403.
2. **Cloisonnement des Rapports d'Activité SaaS** : Ajout du middleware `exigerEditeur` en tête de `src/api/rapports.routes.js` via `router.use(exigerEditeur)`. L'accès est restreint aux 5 rôles de l'équipe éditeur (`"superadmin"`, `"dev"`, `"commercial"`, `"support"`, `"assistante_editeur"`). Les 7 rôles d'étude sont systématiquement rejetés avec un code HTTP 403.
3. **Renforcement des routes de Télémétrie** : Les routes de lecture (`GET /erreurs`, `GET /noeuds`) et d'administration de `src/api/telemetrie.routes.js` exigent le middleware `exigerSaaS` et rejettent systématiquement les rôles d'étude avec un code HTTP 403.
4. **Journalisation structurée des refus (403)** : Chaque rejet pour rôle non autorisé émet un log JSON structuré (`ACCES_REFUSE_ROLE`) consignant l'identifiant utilisateur, son rôle, la méthode, la route et l'horodatage, à l'exclusion stricte de tout secret, jeton ou corps de requête.
5. **Couverture de tests automatisés** : Création de `tests/securite_s02_superadmin_role.test.js` (7 tests) validant par découverte dynamique le rejet 403 des 7 rôles d'étude sur l'intégralité des routes concernées, le rejet 401 en l'absence de jeton, la réponse 200 pour le rôle `superadmin`, et la conformité des journaux de sécurité.




