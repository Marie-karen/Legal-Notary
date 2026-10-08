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
