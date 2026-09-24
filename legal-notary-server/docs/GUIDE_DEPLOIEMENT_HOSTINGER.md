# GUIDE COMPLET DE DÉPLOIEMENT HOSTINGER VPS — MULTI-ÉTUDES
## Système de Gestion Notariale Hybride & Zéro-Latence (Legal Notary ERP)

---

## 1. 🛒 CHOIX DE L'OFFRE SUR HOSTINGER

Rendez-vous sur [Hostinger.fr / Hostinger.com](https://www.hostinger.fr/vps) dans la section **« Hébergement VPS »** (et non hébergement web mutualisé standard) :

| Option | Configuration | Recommandation |
| :--- | :--- | :--- |
| **KVM 2** | 2 vCPU • 8 Go RAM • 100 Go NVMe | **Parfait pour démarrer** (1 à 10 Études notariales) — ~6,99 € / mois |
| **KVM 4** | 4 vCPU • 16 Go RAM • 200 Go NVMe | **Idéal pour la production SaaS** (10 à 50 Études + gros volume de scans) — ~11,99 € / mois |

* **Choix du Système d'Exploitation (OS)** lors de la commande :  
  Sélectionnez **Ubuntu 24.04 64bit** (ou Ubuntu 22.04 LTS).

---

## 2. 🌐 GESTION DES NOMS DE DOMAINE & ADRESSES EMAILS

### Cas A : L'Étude a DÉJÀ son propre nom de domaine (ex: `notaire-kouassi.ci`)
1. Ne modifiez pas leur hébergeur email existant.
2. Demandez à leur informaticien (ou faites-le pour eux) d'ajouter un enregistrement DNS :
   * **Type** : `A`
   * **Nom / Hôte** : `app` (pour avoir `app.notaire-kouassi.ci`) ou `@`
   * **Valeur / Cible** : `IP_DE_VOTRE_VPS_HOSTINGER`
3. Sur votre VPS, activez le certificat SSL en 1 seconde :
   ```bash
   sudo certbot --nginx -d app.notaire-kouassi.ci
   ```

### Cas B : Vous créez le domaine et les emails pour l'Étude (ex: `etude-diallo.ci`)
1. Achetez le nom de domaine directement sur Hostinger.
2. **Pour les Emails Professionnels** :
   * Activez le service Hostinger Email inclus (ex: `notaire@etude-diallo.ci`, `clerc@etude-diallo.ci`, `comptable@etude-diallo.ci`).
   * Les collaborateurs accèdent à leur messagerie via le Webmail Hostinger ou Outlook sur smartphone.
3. **Pour l'Application ERP** :
   * Dans la zone DNS du domaine sur Hostinger, faites pointer l'enregistrement `A` vers l'IP de votre VPS.

---

## 3. 📂 PARTITIONNEMENT DU STOCKAGE ET DES DONNÉES

Le système garantit une étanchéité absolue entre chaque étude notariale :

### A. Partitionnement Physique des Fichiers Scannés & Actes
Chaque étude dispose de son propre répertoire cloisonné sur le disque NVMe :
```
/var/data/legalnotary/uploads/
├── etude_abidjan_01/
│   ├── dossier_2026_001/ -> acte_vente.pdf, cni_vendeur.jpg
│   └── dossier_2026_002/ -> titre_foncier.pdf
└── etude_yamoussoukro_02/
    ├── dossier_2026_001/ -> statuts_sarl.pdf
```
* **Contrôle d'Accès** : Les requêtes HTTP de téléchargement vérifient le jeton JWT de l'utilisateur. Un clerc de l'Étude A ne peut jamais accéder à un fichier de l'Étude B.

### B. Partitionnement de la Base de Données PostgreSQL
* Toutes les tables sensibles (`dossiers`, `minutes_archive`, `factures`, `utilisateurs`) sont indexées par la clé étrangère `etude_id`.
* Aucune fuite d'information n'est possible entre études.

---

## 4. 🚀 DÉPLOIEMENT EN 3 COMMANDES SUR VOTRE VPS HOSTINGER

Dès que votre VPS Hostinger est actif, connectez-vous en SSH depuis votre terminal :

```bash
# 1. Connexion à votre VPS
ssh root@IP_DE_VOTRE_VPS_HOSTINGER

# 2. Cloner votre projet depuis GitHub
git clone https://github.com/Marie-karen/Legal-Notary.git /var/www/legal-notary
cd /var/www/legal-notary/legal-notary-server

# 3. Lancer le script d'installation automatisé
bash deploiement/hostinger-install.sh

# 4. Installer les dépendances et démarrer l'application avec PM2
npm install
pm2 start src/server.js --name legal-notary
pm2 save
pm2 startup
```

---

## 5. 🛡️ SAUVEGARDES AUTOMATIQUES QUOTIDIENNES

Le script de sauvegarde nocturne (`deploiement/sauvegarder.sh`) exporte chaque nuit à 02h00 une copie chiffrée et compressée de la base de données et des documents par étude dans `/var/data/legalnotary/sauvegardes/`.

---

*Legal Notary ERP — Guide d'architecture et de déploiement multi-tenant.*
