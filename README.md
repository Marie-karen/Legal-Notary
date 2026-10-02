# 🏛️ Legal Notary — Plateforme Intégrale de Gestion Notariale & SaaS Multi-Études

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2B-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Architecture](https://img.shields.io/badge/Architecture-Hybride%20%26%20Cloud-0284c7?style=for-the-badge)](https://github.com/Marie-karen/Legal-Notary)
[![Security](https://img.shields.io/badge/Chiffrement-AES--256--GCM%20%7C%20SHA--256-10b981?style=for-the-badge)](https://github.com/Marie-karen/Legal-Notary)
[![License](https://img.shields.io/badge/Licence-Propriétaire-f59e0b?style=for-the-badge)](https://github.com/Marie-karen/Legal-Notary)

> **Solution logicielle souveraine de pilotage d’offices notariaux, calculs d'émoluments officiels (Décret n° 2013-279), archivage hybride et console de gestion multi-tenant pour éditeur SaaS.**

---

## 🌟 Points Clés & Philosophie

1. **🏛️ Métier Notarial Respecté & Décret 2013-279** :
   - Moteur fiscal automatisé : calcul au centime près des émoluments réglementés par tranches, droits d'enregistrement DGI, taxes foncières et séquestres CDCI.
   - Respect absolu de l'original papier : l'acte notarié est signé physiquement sur papier minute, puis numérisé et scellé numériquement avec calcul d'empreinte **SHA-256 immuable**.

2. **⚡ Architecture SaaS Multi-Tenant Centralisée (1 Seul Serveur pour Tout le Parc)** :
   - **Déploiement Centralisé Unique (VPS Hostinger)** : Un seul serveur Node.js et une seule base de données PostgreSQL gèrent l'intégralité de vos études notariales clientes sans multiplication de serveurs.
   - **Onboarding Instantané en 2 Minutes** : Création d'une nouvelle étude depuis la Console SuperAdmin avec attribution immédiate d'un sous-domaine (`etude-nom.notaires.ci`) ou liaison transparente du nom de domaine personnalisé du notaire (`notaire-kouame.ci`).
   - **Mises à jour Universelles en 1 Clic** : Une seule commande `git pull` met à jour 100% de vos études clientes sans intervention manuelle serveur par serveur.
   - **Coût d'Exploitation Minimal & Rentabilité Maximale** : Facture d'infrastructure divisée par 20 comparé au modèle mono-serveur isolé.

3. **🛡️ Console SuperAdmin SaaS & Isolation Étanche** :
   - Gestion du parc des offices notariaux clients, quotas de stockage et monitoring.
   - Espace interne séparé pour l'équipe éditeur : **Direction**, **DevOps**, **Commerciaux**, **Support Client L1-L4** et **Assistantes**.
   - Matrice de permissions RBAC granulaire et dynamique, verrouillée par la Direction.

4. **📡 Télémétrie d'Erreurs Distribuée & Watchdog Heartbeat (30s)** :
   - Surveillance proactive des serveurs locaux des offices : détection automatique des coupures fibre ou électricité en moins de 120s.
   - Remontée centralisée des incidents (Hub PostgreSQL + compatibilité Sentry) et alertes instantanées DevOps (Slack / Discord / Email).

---

## 🏗️ Architecture du Projet

```
Legal-Notary/
├── legal-notary-server/       # Backend API Node.js / Express & PostgreSQL
│   ├── src/api/               # Routes REST (Dossiers, Actes, Fiscal, Archives, SuperAdmin, Télémétrie)
│   ├── src/services/          # Logique métier, calculs d'émoluments, sync engine, PRA & audit
│   ├── src/db/                # Migrations SQL, scripts de seed et pool PostgreSQL
│   ├── deploiement/           # Scripts systemd, crontab, Nginx et rotation de logs
│   └── docs/                  # Architecture technique, RBAC, Déploiement et Sécurité
│
├── legal-notary-web/          # Frontend Web SPA Vanilla CSS / JS (Fidèle à Claude Design)
│   ├── index.html             # Point d'entrée, sélecteur rapide de profils et conteneurs d'écrans
│   ├── css/style.css          # Design System sombre et élégant (Tokens, Grid, Badges, Modales)
│   └── js/
│       ├── api.js             # Client HTTP avec routage dynamique et gestion de sessions
│       └── app.js             # Vues métier adaptatives par rôle, tableaux de bord et formulaires
│
└── legal-notary-suite/        # Moteur autonome de calcul fiscal et suite de tests
```

---

## 👥 Rôles Métier & Espaces Démo

### 🏛️ Espace Cabinet Notarial (Rôles Internes à l'Étude)
| Rôle | Email Démo | Mot de Passe | Description du Périmètre |
| :--- | :--- | :--- | :--- |
| **👑 Notaire Titulaire** | `notaire@notaire.ci` | `notaire123` | Pilotage global, validation des actes, finances, alertes et scellement minute |
| **📋 Premier Clerc** | `premier.clerc@notaire.ci` | `notaire123` | Attribution des dossiers, supervision des clercs et révision juridique |
| **✍️ Clerc Rédacteur** | `clerc1@notaire.ci` | `notaire123` | Rédaction des projets d'actes, collecte des pièces KYC et suivi pipeline |
| **🏛️ Clerc Formaliste** | `formalites@notaire.ci` | `notaire123` | Enregistrement DGI, Livre Foncier, RCCM, publicité et levée d'états |
| **💰 Comptable Taxateur** | `comptable@notaire.ci` | `notaire123` | Établissement des fiches de taxe, gestion des séquestres et trésorerie |
| **📞 Assistante Accueil** | `accueil@notaire.ci` | `notaire123` | Création des dossiers, accueil clients et prise de rendez-vous |

### 🛡️ Espace Éditeur SaaS (Direction & Équipe Interne)
| Rôle | Email Démo | Mot de Passe | Description du Périmètre |
| :--- | :--- | :--- | :--- |
| **👑 Direction SaaS / SuperAdmin** | `admin@editeur-legal.ci` | `admin123` | Contrôle total du parc d'études, matrice des permissions, déploiements |
| **💻 Développeur / DevOps** | `dev@editeur-legal.ci` | `admin123` | Clusters serveurs, télémétrie, Watchdog Heartbeat, tests de PRA et logs |
| **💼 Commercial & Sales** | `commercial@editeur-legal.ci` | `admin123` | Onboarding de nouvelles études, suivi des abonnements et licences |
| **🎧 Support Client L1-L4** | `support@editeur-legal.ci` | `admin123` | Tickets incidents et demandes d'accès temporaires exceptionnels audités |
| **📋 Assistante Éditeur** | `assistante.editeur@editeur-legal.ci` | `admin123` | Facturation SaaS, gestion administrative des contrats et relances |

---

## 🚀 Démarrage Rapide (Développement Local)

### 1. Prérequis
- **Node.js** v18.0+ et **npm**
- **PostgreSQL** v14+ (local ou hébergé)

### 2. Installation
```bash
# Cloner le dépôt
git clone https://github.com/Marie-karen/Legal-Notary.git
cd Legal-Notary

# Installer les dépendances du serveur
cd legal-notary-server
npm install
```

### 3. Configuration de la Base de Données
Créez un fichier `.env` dans `legal-notary-server/` :
```env
PORT=4000
DATABASE_URL=postgres://votre_utilisateur:votre_mot_de_passe@localhost:5432/legal_notary
JWT_SECRET=votre_cle_secrete_jwt_super_longue_et_aleatoire
SENTRY_DSN=
ORIGINE_FRONTEND=*
```

Exécutez les migrations et l'initialisation des données :
```bash
# Lancer les migrations de structure
npm run migrate

# Importer le référentiel fiscal & actes officiels
npm run seed:referentiel

# Créer les comptes démo et initialiser la télémétrie
npm run seed:comptes
npm run init:telemetrie
npm run sync:passwords
```

### 4. Lancer le Serveur & Frontend
```bash
# Démarrer le serveur backend (qui sert également le frontend sur le même port)
node src/server.js
```

Ouvrez ensuite votre navigateur sur :  
👉 **[http://localhost:4000/](http://localhost:4000/)**

---

## 🛠️ Guide d'Architecture & Directives pour Développeur Full-Time

Si vous intervenez en tant que développeur sur le projet **Legal Notary**, vous devez respecter scrupuleusement les 5 principes fondamentaux ci-dessous pour préserver l'intégrité, la sécurité et la scalabilité du SaaS.

### 1. 🛡️ Scoping Multi-Tenant Strict & Cloisonnement des Données (`etude_id`)
* **Règle absolue** : Chaque table de données, route d'API et requête SQL doit impérativement filtrer par `etude_id` (injecté automatiquement via le middleware d'authentification JWT `req.utilisateur.etudeId`).
* **Zéro fuite de données** : Deux offices notariaux ne doivent sous aucun prétexte partager ou apercevoir leurs répertoires, actes, clients ou courriers respectifs.

### 2. 🧩 Ajout de Fonctionnalités & Modules Spécifiques par Étude (Feature Flags)
Quand une étude demande un module ou une logique personnalisée (ex: *Recouvrement spécialisé, successions coutumières, barèmes fiscaux dérogatoires*) :
* **Ne JAMAIS casser le tronc commun** : Toute modification spécifique à une étude doit être conditionnée et isolée.
* **Activation via Feature Flag** : Activer le module dans la configuration de l'étude (`modules_actifs` dans la table `etudes` ou `parametres_etude`) :
  ```javascript
  // Backend : Vérification de permission / module actif
  if (req.utilisateur.codeEtude === 'ETUDE_KOFFI' || req.etude.modules.includes('custom_recouvrement')) {
    // Exécuter la logique spécifique de cette étude
    return serviceSpecifiqueKoffi.traiter(req.body);
  }
  // Tronc commun préservé pour tout le reste du réseau
  return serviceStandard.traiter(req.body);
  ```
* **Affichage conditionnel Frontend** : Dans l'interface, les onglets et actions sur-mesure ne s'affichent que si l'utilisateur connecté possède le module activé sur son étude.

### 3. 👥 Respect de la Matrice RBAC (6 Rôles Notariaux Déontologiques)
Toute nouvelle fonctionnalité doit respecter les prérogatives des 6 rôles de l'Office :
* `notaire` : Validation d'actes, comptabilité globale, clôture d'exercices, scellement SHA-256.
* `premier_clerc` : Attribution des dossiers, révision juridique, supervision de l'équipe.
* `clerc_redacteur` : Rédaction des projets d'actes, collecte des pièces KYC, gestion de ses dossiers.
* `clerc_formaliste` : Formalités préalables/postérieures, DGI, Conservation Foncière, RCCM.
* `comptable_taxateur` : Fiches de taxe Décret 2013-279, suivi des provisions et comptes séquestres CDCI.
* `archiviste` / `assistante` : Minutier scellé, repérage physique des cartons, registre des courriers.

### 4. 🌐 Routage Multi-Domaines Automatique (`server.js`)
* Les domaines vitrine (`legalnotary.app`, `www.legalnotary.app`) servent la **Landing Page commerciale (`index.html`)**.
* Les domaines dédiés aux études (`etude-mka.ci`, `nom.notaires.ci`, `app.legalnotary.app`) basculent **instantanément sur le Cockpit de Travail (`app.html`)**, sans jamais exposer la vitrine publique.

### 5. 🚀 Workflow de Contribution & Déploiement VPS
1. **Développement & Tests** : Écrire et tester le code en local. Les scripts de validation de non-régression se trouvent dans `scratch/`.
2. **Push Git** : Committer avec des messages explicites (`feat:`, `fix:`, `refactor:`) et pousser sur `origin main`.
3. **Déploiement en Production (Hostinger VPS)** :
   ```bash
   ssh root@72.62.39.225
   cd /var/www/legal-notary && git pull origin main && pm2 restart all
   ```
4. **Configuration SMTP Production** : Vérifier que `/var/www/legal-notary/legal-notary-server/.env` contient les identifiants SMTP réels (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) pour l'envoi effectif des emails d'accueil.

---

## 🔒 Sécurité, Audit & Secret Professionnel

- **Garantie Zéro-Accès aux Actes** : Par conception, l'éditeur SaaS et les équipes de support n'ont **aucun accès par défaut** aux actes juridiques rédigés par les études.
- **Scellement Cryptographique SHA-256** : Chaque minute d'acte numérisée est horodatée et scellée avec une empreinte cryptographique vérifiable en justice.
- **Sauvegardes 3-2-1 & Snapshots Immuables (WORM)** : Sauvegardes chiffrées AES-256-GCM quotidiennes avec rétention configurable et simulation de Plan de Reprise d'Activité (PRA).
- **Rotation Automatique des Logs** : Intégration `pm2-logrotate` avec compression `.gz` pour éviter toute saturation d'espace disque.

---

## 📜 Licence & Propriété Intellectuelle

Tous droits réservés © 2026 — **Marie-karen / Legal Notary**.  
Usage propriétaire réservé à l'éditeur et aux études notariales titulaires d'une licence d'exploitation.

