# Legal Notary — Guide de Configuration & Rotation des Clés

Ce document répertorie l'ensemble des paramètres de configuration du serveur d'étude Legal Notary et détaille les procédures strictes de gestion et rotation des clés cryptographiques conformément aux **exigences de sécurité non négociables (Section 3 bis — Exigence n°4 & Correctif S04)**.

---

## 1. Principes Fondamentaux de Sécurité (S04)

1. **Aucune valeur de secours en dur** : Le code source ne contient aucune clé secrète par défaut.
2. **Indépendance stricte** : Chaque usage cryptographique possède sa propre clé dédiée. Aucune clé ne retombe sur une autre.
3. **Format obligatoire** : Chaque clé secrète doit comporter **exactement 64 caractères hexadécimaux** (32 octets aléatoires générés cryptographiquement). Tout autre format est formellement rejeté.
4. **Refus de démarrer (Fail-Secure)** : Le serveur s'arrête immédiatement (`process.exit(1)`) au démarrage si une seule clé obligatoire manque ou est invalide.
5. **Confidentialité absolue** : Les valeurs des clés ne sont jamais affichées dans les journaux, les consoles ni les messages d'erreur.
6. **Protection du fichier `.env`** : Le fichier `.env` doit avoir les permissions restreintes `600` (`chmod 600 .env`) limitant la lecture/écriture au seul propriétaire système.

---

## 2. Inventaire des Variables d'Environnement

### A. Clés cryptographiques obligatoires

| Variable | Usage | Format requis |
| :--- | :--- | :--- |
| `JWT_SECRET` | Signature et vérification des jetons JWT de session des utilisateurs | 64 caractères hexadécimaux |
| `BACKUP_ENCRYPTION_KEY` | Chiffrement AES-256-GCM des sauvegardes et snapshots immuables WORM | 64 caractères hexadécimaux |
| `CLE_CHIFFREMENT_NOTIFS` | Chiffrement AES-256-GCM au repos des identifiants tiers (SMTP, Webhook SMS/WhatsApp) | 64 caractères hexadécimaux |
| `CONTROL_HUB_SECRET_KEY` | Clé partagée d'authentification pour l'API interne (`/api/internal/*`) et le Master Admin | 64 caractères hexadécimaux |

### B. Clés optionnelles de rotation et archive

| Variable | Description |
| :--- | :--- |
| `BACKUP_ENCRYPTION_KEYS_ARCHIVE` | Liste des anciennes clés de sauvegarde séparées par des virgules, conservées en lecture seule pour restaurer les anciennes archives WORM. |

### C. Base de données & Réseau

| Variable | Description | Défaut |
| :--- | :--- | :--- |
| `DATABASE_URL` | URL de connexion PostgreSQL locale dédiée à l'office notarial | *Obligatoire* |
| `PORT` | Port d'écoute HTTP du serveur Express | `4000` |
| `NODE_ENV` | Environnement d'exécution (`production`, `development`, `test`) | `development` |
| `JWT_EXPIRATION` | Durée de vie d'un jeton d'accès | `12h` |
| `CONTROL_HUB_WEBHOOK_URL` | URL de notification sortante vers le superviseur technique | *Optionnel* |

---

## 3. Génération Automatique des Clés pour une Nouvelle Installation

Pour initialiser un environnement sécurisé sans risque d'erreur humaine :

```bash
cd legal-notary-server
npm run generer-cles
```

*Ce script crée ou met à jour le fichier `.env` avec 4 clés aléatoires indépendantes de 32 octets (`crypto.randomBytes`), applique les permissions `chmod 600`, et refuse d'écraser des clés existantes sans l'option `--force`.*

---

## 4. Procédures Opérationnelles de Changement et Rotation des Clés

### Procédure 1 : Rotation de `JWT_SECRET` (Sessions Utilisateurs)

> **Impact** : Déconnexion immédiate de tous les utilisateurs connectés. Chaque collaborateur devra se réauthentifier.

1. **Générer une nouvelle clé de 64 caractères hexadécimaux** :
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. **Mettre à jour le fichier `.env`** :
   Remplacer la valeur de `JWT_SECRET` par la nouvelle chaîne hexadécimale générée.
3. **Redémarrer le serveur** :
   ```bash
   # Si service systemd :
   sudo systemctl restart legal-notary
   # En développement :
   npm start
   ```
4. **Vérifier les journaux** :
   Confirmer dans les logs que le serveur a démarré avec succès sans erreur de validation.

---

### Procédure 2 : Rotation de `BACKUP_ENCRYPTION_KEY` (Sauvegardes WORM)

> **Principe** : Les nouvelles sauvegardes sont chiffrées avec la nouvelle clé active. Chaque archive enregistre l'identifiant public de la clé (`keyId`). Les anciennes clés restent enregistrées en lecture seule dans `BACKUP_ENCRYPTION_KEYS_ARCHIVE` afin de garantir la restauration des archives historiques.

1. **Noter l'ancienne valeur** de `BACKUP_ENCRYPTION_KEY` présente dans `.env`.
2. **Générer une nouvelle clé** de 64 caractères hexadécimaux.
3. **Mettre à jour le fichier `.env`** :
   - Définir `BACKUP_ENCRYPTION_KEY` avec la nouvelle clé.
   - Ajouter l'ancienne clé dans `BACKUP_ENCRYPTION_KEYS_ARCHIVE` (ajouter à la liste existante si d'autres clés s'y trouvent, séparées par une virgule) :
     ```env
     BACKUP_ENCRYPTION_KEY=<nouvelle_cle_64hex>
     BACKUP_ENCRYPTION_KEYS_ARCHIVE=<ancienne_cle_1>,<ancienne_cle_2>
     ```
4. **Redémarrer le serveur**.
5. **Valider la rotation par un test PRA** :
   Lancer une simulation de restauration sur un snapshot récent créé avant la rotation : le système retrouve automatiquement l'ancienne clé grâce à son `keyId` et valide l'intégrité de l'archive.

---

### Procédure 3 : Rotation de `CLE_CHIFFREMENT_NOTIFS` (Secrets Tiers)

> **Principe** : Les identifiants tiers (mots de passe SMTP, webhooks SMS/WhatsApp, clé push) stockés chiffrés dans la table `parametres_notifications` doivent être rechiffrés avec la nouvelle clé au cours d'une transaction SQL.

1. **Générer la nouvelle clé** de 64 caractères hexadécimaux.
2. **Exécuter le script de migration et rechiffrement** :
   ```bash
   node scripts/rechiffrer-secrets-notifs.js \
     --ancienne-cle="<ancienne_cle_notifs_actuelle>" \
     --nouvelle-cle="<nouvelle_cle_generee>"
   ```
   *Le script déchiffre les colonnes sensibles avec l'ancienne clé, les rechiffre en mémoire avec la nouvelle clé, et met à jour la base de données dans une transaction atomique.*
3. **Mettre à jour `.env`** :
   Remplacer `CLE_CHIFFREMENT_NOTIFS` par la nouvelle clé.
4. **Redémarrer le serveur** et tester l'envoi d'une notification pour confirmer le fonctionnement.

---

### Procédure 4 : Rotation de `CONTROL_HUB_SECRET_KEY` (API Interne)

> **Principe** : Clé partagée entre le serveur d'office notarial et le Hub central Master Admin.

1. **Générer une nouvelle clé** de 64 caractères hexadécimaux.
2. **Mettre à jour le Master Admin Hub** avec la nouvelle clé pour ce cabinet.
3. **Mettre à jour `CONTROL_HUB_SECRET_KEY`** dans le `.env` de l'office notarial.
4. **Redémarrer le serveur** et vérifier le signal de vie (`heartbeat`) dans la console de contrôle.
