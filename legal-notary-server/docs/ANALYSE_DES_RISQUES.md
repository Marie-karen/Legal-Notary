# 🛡️ Analyse Complète des Risques & Plan de Maîtrise — Legal Notary

> **Cadre d'évaluation** : Plateforme logicielle pour Études Notariales & Éditeur SaaS Multi-Tenant (Côte d'Ivoire / Afrique de l'Ouest).  
> **Normes de référence** : Décret n° 2013-279 du 24 avril 2013, Secret Professionnel Notarial, Politique 3-2-1 de Sauvegarde, Cryptographie WORM (Write Once Read Many).

---

## 📑 Synthèse des 5 Domaines de Risques

### 1. ⚖️ Risques Juridiques & Secret Professionnel
1. **Violation du Secret Professionnel par l'Éditeur SaaS (Critique)** :
   - *Parade* : Architecture **Zéro-Accès**. L'équipe SaaS n'a aucun droit de lecture sur les actes. Accès support temporaire d'urgence verrouillé à 1h avec validation explicite par signature du Notaire Titulaire.
2. **Contestation de l'intégrité d'un Acte en Justice (Critique)** :
   - *Parade* : **Scellement SHA-256 Immuable**. Chaque scan est horodaté avec empreinte cryptographique. L'original papier minute reste la preuve reine opposable.
3. **Erreur de Calcul des Émoluments Réglementés (Élevé)** :
   - *Parade* : Moteur fiscal 100% conforme au **Décret 2013-279** (tranches de 4% à 0.75%, minimum légal 100 000 FCFA, DGI, séquestres CDCI).

---

### 2. 🔐 Risques de Cybersécurité & Données Confidentielles
1. **Ransomware / Chiffrement Malveillant du Serveur (Critique)** :
   - *Parade* : Sauvegardes **3-2-1 chiffrées AES-256-GCM** avec snapshots immuables (WORM) répliqués hors-site.
2. **Attaque Supply Chain (Paquets NPM malveillants) (Élevé)** :
   - *Parade* : **Frontend Vanilla JS (0 dépendance npm)** et backend minimaliste (~6 packages vérifiés).
3. **Interception Réseau (Critique)** :
   - *Parade* : **Nginx HTTPS TLS 1.3 forcé** avec en-têtes de sécurité HSTS.

---

### 3. ⚡ Risques d'Infrastructure & Terrain (Fibre, Électricité)
1. **Coupure Internet / Fibre à l'Office (Très Forte Probabilité)** :
   - *Parade* : **Mode Hybride Offline-First (Cas 3)**. Le serveur local continue de fonctionner sur le réseau LAN du cabinet et stocke les requêtes dans un buffer de synchronisation.
2. **Coupure d'Électricité Brutale (CIE) (Très Forte Probabilité)** :
   - *Parade* : Base PostgreSQL avec journalisation **WAL (Write-Ahead-Logging)**, redémarrage PM2 automatique et onduleur à extinction propre.
3. **Panne Silencieuse du Serveur Physique Local (Élevé)** :
   - *Parade* : **Watchdog Heartbeat (30s)** détectant toute absence de signal > 120s avec alerte instantanée au DevOps (Slack/Email).
4. **Saturation du Disque Dur (VPS Hostinger ou Local) (Élevé)** :
   - *Parade* : **`pm2-logrotate`** avec rotation tous les 10 Mo et compression en `.gz`.

---

### 4. 🏢 Risques SaaS & Multi-Tenancy (Inter-Études)
1. **Fuite de Données d'une Étude vers une autre (Critique)** :
   - *Parade* : Isolation logique forcée par le middleware `etude_id` sur 100% des requêtes SQL.
2. **Explosion des Coûts de Stockage Cloud (Moyen)** :
   - *Parade* : Quotas stricts par étude avec alertes de dépassement (80%, 95%) dans la console SuperAdmin.

---

### 5. 👥 Risques Métier & Erreurs Humaines
1. **Dépassement des Délais Légaux de Formalités DGI (Élevé)** :
   - *Parade* : Badges d'alerte automatiques et suivi visuel du pipeline de chaque clerc.
2. **Erreur d'Indexation OCR par l'IA (Moyen)** :
   - *Parade* : **Validation humaine obligatoire** (l'IA suggère, l'humain valide).
3. **Plan Cadastral Grand Format non numérisable (Moyen)** :
   - *Parade* : Fiche d'identification physique dans le jumeau numérique avec traçabilité d'emplacement (Salle/Armoire/Boîte).
