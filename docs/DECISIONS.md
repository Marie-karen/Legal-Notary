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
| `src/api/fiscal.routes.js` | **3** | 8 | Lot 0 (Multi-pays) & S11 |
| `src/api/rapports.routes.js` | **0** | 1 | Lots métier / Refactoring |
| `src/api/recus.routes.js` | **0** | 1 | Lots métier / Refactoring |
| `src/db/migrate.js` | **0** | 1 | S08 / S23 |
| `src/db/pool.js` | **0** | 6 | S08 / S23 |
| `src/middleware/controlHubAuth.middleware.js` | **0** | 1 | Lots métier / Refactoring |
| `src/server.js` | **0** | 8 | Lots métier / Refactoring |
| `src/services/archives.service.js` | **0** | 11 | Lots métier / Refactoring |
| `src/services/auth.service.js` | **0** | 16 | S01 / S03 / S05 |
| `src/services/campagnes-numerisation.service.js` | **3** | 3 | Lot 5 (Archives) |
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
| **TOTAL (44 fichiers)** | **6** | **274** | *À résorber progressivement* |

### Détail des 6 erreurs de référence
1. **`src/api/fiscal.routes.js`** (3 erreurs `no-undef`) : variables `fs` et `path` non déclarées dans une route d'export Excel (résolu lors du Lot 0 et S10/S25).
2. **`src/services/campagnes-numerisation.service.js`** (3 erreurs `no-undef`) : référence à `pool` sans import préalable (résolu lors du Lot 5).

