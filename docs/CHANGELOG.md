# Journal des Modifications (CHANGELOG) — Legal Notary

Toutes les modifications notables apportées à ce projet sont documentées dans ce fichier.
Format conforme à [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [Non publié] - Branche `securite-1`

### Sécurité & Authentification — Correctif S01 (8 octobre 2026)
- **Suppression des mots de passe universels (S01)** : Élimination définitive des chaînes `"notaire123"` et `"admin123"` dans `src/services/auth.service.js`.
- **Validation cryptographique stricte** : Dans la fonction `connecter`, seul `bcrypt.compare` contre `mot_de_passe_hash` est désormais utilisé. Suppression des validations de repli en clair (`utilisateur.mdp`, `compteSecours.mdp`, ou comparaison brute avec le hash).
- **Obligation stricte du mot de passe (HTTP 400)** :
  - `POST /api/equipe` et `authService.creerUtilisateur` : refus immédiat (400 "Mot de passe obligatoire.") si le mot de passe est absent ou vide.
  - `superadminService.creerEtude` et `superadminService.ajouterCollaborateurEtude` : suppression des mots de passe par défaut générés en douce ou fixés à `"notaire123"` ; refus 400 systématique.
  - `emailDeploiementService.envoyerEmailBienvenueCollaborateur` et `POST /api/superadmin/renvoyer-email` : obligation du mot de passe sans valeur de secours.
- **Désactivation de `src/db/sync-passwords.js`** : Le script refuse désormais toute exécution (levée d'exception / sortie code 1) en attendant son déplacement et sécurisation lors de S07.
- **Neutralisation des mots de passe de démo hors ligne** : Suppression des champs `mdp` dans `COMPTES_DEMO_OFFLINE`.
- **Tests de non-régression et sécurité** :
  - Création de `tests/securite_s01_mots_de_passe.test.js` avec 5 tests automatisés dédiés couvrant les codes 401 sur mot de passe universel, 200 sur mot de passe réel, 401 sur hash invalide ou vide, 400 sur absence de mot de passe, et vérification de l'absence totale de `"notaire123"` et `"admin123"` dans `src/`.

### Sécurité & Contrôle d'accès — Correctif S02 (8 octobre 2026)
- **Verrouillage strict de la Console Super-Administrateur (S02)** :
  - Ajout du middleware `exigerSuperadmin` en tête de `src/api/superadmin.routes.js` via `router.use(exigerSuperadmin)`.
  - Refus immédiat (HTTP 403) de tout rôle différent de `"superadmin"` sur les 26 routes du routeur.
- **Verrouillage des Rapports d'Activité SaaS Éditeur** :
  - Ajout du middleware `exigerEditeur` en tête de `src/api/rapports.routes.js` via `router.use(exigerEditeur)` limitant l'accès aux rôles éditeur (`"superadmin"`, `"dev"`, `"commercial"`, `"support"`, `"assistante_editeur"`).
  - Refus immédiat (HTTP 403) pour l'ensemble des 7 rôles d'étude notariale.
- **Harmonisation et vérification des routes de télémétrie** :
  - Renforcement de `exigerSaaS` dans `src/api/telemetrie.routes.js` sur les routes de lecture (`GET /erreurs`, `GET /noeuds`) et d'administration.
- **Journalisation structurée des refus d'accès 403** :
  - Journalisation en JSON structuré (`ACCES_REFUSE_ROLE`) contenant : identifiant utilisateur, rôle, méthode, route, date et heure.
  - Conformité stricte : aucun mot de passe, jeton JWT, ni corps de requête dans les journaux.
- **Batterie de tests automatisés (S02)** :
  - Création de `tests/securite_s02_superadmin_role.test.js` (7 tests) :
    - Découverte dynamique des routes des routeurs (26 superadmin, 6 rapports, 6 télémétrie).
    - Validation du rejet 403 pour chacun des 7 rôles d'office (`notaire`, `premier_clerc`, `clerc_redacteur`, `clerc_formaliste`, `comptable_taxateur`, `assistante`, `archiviste`) sur chaque route.
    - Validation du rejet 401 en l'absence de jeton sur chaque routeur.
    - Validation de la réponse 200 pour le rôle `superadmin` sur les routes de lecture.
    - Contrôle de la structure et de la non-divulgation de secrets dans les journaux de refus 403.
