# Legal Notary

Application de gestion d'office notarial pour la Côte d'Ivoire — 100% locale,
sans serveur, sans compte, sans connexion requise.

## Démarrage

Double-cliquer sur `index.html` (ou utiliser `../LANCER_LEGAL_NOTARY.command`).
L'application s'ouvre dans le navigateur par défaut. Aucune installation,
aucun serveur, aucune donnée envoyée sur Internet : tout est stocké dans le
LocalStorage du navigateur utilisé, sur cet ordinateur uniquement.

**Important — secret professionnel** : les données du cabinet (dossiers,
comparants, montants) ne quittent jamais ce navigateur. Elles ne sont ni
sauvegardées automatiquement ailleurs, ni synchronisées. Prévoir une
sauvegarde manuelle régulière (export du profil navigateur, ou copie du
dossier de l'application) si l'ordinateur venait à être remplacé : vider le
cache/les données de navigation du navigateur effacerait ces données.

## Tests

Ouvrir `tests.html` de la même façon pour vérifier le référentiel métier et
le moteur fiscal (calculs d'émoluments, droits d'enregistrement, TVA,
débours). Ces tests ne touchent jamais aux données réelles de l'étude.

## Structure des fichiers

- `index.html` — structure de l'application (tableau de bord, kanban,
  liste des dossiers, archives, paramètres, fiche dossier, fiche de taxe).
- `css/style.css` — design system « Notariat d'Ivoire Prestige ».
- `js/data.js` — référentiel métier : rôles, catalogue des actes, checklist
  de tâches standards, barèmes fiscaux et paramètres par défaut.
- `js/tax-engine.js` — moteur fiscal (fonctions pures, testées).
- `js/sample-dossiers.js` — couche de persistance LocalStorage (CRUD des
  dossiers, données de démonstration).
- `js/app.js` — contrôleur applicatif (vues, RBAC, alertes).
- `js/test-suite.js` / `tests.html` — tests unitaires du référentiel et du
  moteur fiscal.
- `NOTES_HYPOTHESES.md` — valeurs fiscales non chiffrées avec certitude par
  le cahier des charges initial, à faire valider par le notaire avant mise
  en production.

## Pourquoi pas de modules ES6 (`import`/`export`) ?

Les fichiers `js/*.js` sont chargés en `<script>` classique, dans l'ordre
(`data.js` → `tax-engine.js` → `sample-dossiers.js` → `app.js`), sous un
espace de nommage global `window.Legal Notary`. Un `<script type="module">`
ouvert en `file://` (double-clic) est bloqué par la politique CORS de
Chrome et Safari — ce choix garantit que l'application s'ouvre toujours
sans serveur, condition posée par le secret professionnel.
