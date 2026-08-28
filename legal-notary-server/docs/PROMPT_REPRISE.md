# Prompt de reprise — Legal Notary (pour Antigravity)

À coller dans une nouvelle session Antigravity pour reprendre ce projet
là où il en est. Ce document résume fidèlement l'état réel du code au
25/08/2026 — vérifié en le faisant tourner, pas déduit de mémoire.
Avancement global : Backend 93 % · Écrans 78 % · Mise en production
réelle 55 %.

---

## Contexte du projet

**Legal Notary** est un logiciel de gestion pour un office notarial de
Côte d'Ivoire. Deux dossiers séparés, à copier ensemble sur le serveur
du cabinet :

- `legal-notary-server/` — API Node.js/Express + PostgreSQL.
- `legal-notary-web/` — frontend HTML/CSS/JS classique, sans framework,
  servi par ce même serveur (voir `legal-notary-server/src/server.js`,
  qui fait `express.static` + fallback SPA sur `legal-notary-web/`).

**Principe non négociable du projet** : une installation self-hosted
**par cabinet**, jamais un SaaS centralisé partagé. Aucune dépendance à
un fournisseur cloud particulier — PostgreSQL et Node.js standards,
portable vers n'importe quel hébergeur.

**La propriétaire du produit n'est pas développeuse.** Chaque fichier
backend porte un commentaire d'en-tête expliquant son rôle, exprès pour
qu'un développeur (humain ou agent) reprenne le projet sans elle. Garder
cette discipline : documenter le POURQUOI, pas le COMMENT (le code le
dit déjà).

## Règles à ne jamais enfreindre

Ces règles ont chacune une raison précise, apprise en corrigeant de
vraies erreurs pendant la construction — ne pas les redécouvrir à la dure :

1. **Ne jamais fabriquer de donnée** — aucun chiffre de démonstration,
   aucune valeur inventée. Un écran affiche ce que l'API renvoie
   réellement, ou un état vide honnête ("Aucun dossier", "0 %"), jamais
   un placeholder qui ressemble à une vraie donnée.
2. **Le RBAC se vérifie côté serveur, jamais seulement côté écran.**
   Voir `legal-notary-server/src/rbac/roles.js` — `aPermission()` pour
   les actions, `porteeDossiers()` pour la visibilité des dossiers. Une
   vraie faille a existé ici (4 routes dossier ne vérifiaient pas la
   portée — un clerc isolé pouvait modifier n'importe quel dossier en
   devinant son id) : corrigée, mais ça montre le risque si une nouvelle
   route oublie ce contrôle.
3. **Montants fiscaux toujours en entiers FCFA**, jamais un flottant
   (`Math.round` partout dans `fiscal.service.js`).
4. **Aucun taux fiscal inventé.** Ce qui n'est pas confirmé par le
   Décret N° 2013-279 ou un document réel du cabinet reste à 0 FCFA ou au
   minimum légal — voir `NOTES_HYPOTHESES.md`, qui liste précisément ce
   qui est confirmé et ce qui attend une confirmation du notaire.
5. **Aucune suppression physique de donnée métier.** Toujours
   `archived_at` / changement de statut, jamais un `DELETE` sur un
   dossier, une écriture comptable ou une fiche de taxe.
6. **L'identité visuelle est déjà choisie, ne pas la réinventer.** Thème
   sombre `#0f172a`, accent vert `#16a34a`, titres Space Grotesk, texte
   Inter — voir `legal-notary-web/css/style.css` (jetons en haut du
   fichier) et `legal-notary-web/design-reference/`. C'est un choix
   explicite de la propriétaire après avoir rejeté une première
   proposition ("bleu marine + or", jugée générique) : ne pas proposer
   d'autre palette sans qu'elle le demande.
7. **Interface entièrement en français**, vocabulaire notarial exact (un
   « décompte » reste un « décompte »).

## Ce qui existe déjà et fonctionne (vérifié, pas supposé)

### Backend (`legal-notary-server/`)

- **RBAC à 6 rôles** (notaire, premier clerc, clerc rédacteur, clerc aux
  formalités, comptable taxateur, assistante), avec permissions d'action
  ET portée de visibilité des dossiers distinctes — voir `docs/RBAC.md`.
  Vérifié en conditions réelles pour les 6 rôles (comptes de test créés).
- **Moteur fiscal** (`src/services/fiscal.service.js`) — émoluments
  dégressifs par tranches, droits d'enregistrement, taxe foncière,
  timbres/rôles, TVA 18 %, compte client, fiche de taxe historisée. 21
  tests automatisés (`npm test`), tous les taux sourcés dans
  `NOTES_HYPOTHESES.md`.
- **Workflow d'instruction** — pipeline à 6 étapes paramétrable
  (`etapes_pipeline`, éditable sans toucher au code), checklist de tâches
  copiée du référentiel à l'ouverture d'un dossier, durées par tâche
  modifiables par cabinet.
- **Alertes proactives** — retard, stagnation, pièce bloquante manquante.
- **Archivage numérique + physique** — numérotation de minute à la
  clôture, cartons séquentiels FIFO. Voir `docs/ARCHIVAGE.md`.
- **Circuit de rédaction d'acte** — brouillon → soumission → notification
  du notaire → validation ou renvoi (commentaire obligatoire) → nouvelle
  version. Historique complet conservé.
- **Notifications multi-canal** — email (SMTP par cabinet), SMS/WhatsApp
  (webhook générique, aucun fournisseur imposé), push navigateur (Web
  Push standard, pas de compte tiers), fil in-app. Modèles de message
  éditables. Voir `docs/NOTIFICATIONS.md`.
- **RH et équipe** — téléphone, embauche, contrat, salaire net (visible
  au notaire uniquement — le champ est absent de la réponse API pour les
  autres rôles, pas juste caché à l'écran).
- **Manuel de procédure** — les 6 étapes éditables (rôle responsable,
  niveau d'alerte) sans toucher au code.
- **Annuaire clients** (`GET /api/clients`, ajouté récemment) — agrège
  les comparants de tous les dossiers dans la portée RBAC de
  l'utilisateur. **Limitation connue et documentée dans le code** :
  regroupement par nom normalisé seulement, pas d'identifiant client
  unique — deux homonymes seraient fusionnés à tort.
- **Serveur unique** — depuis peu, `src/server.js` sert l'API ET le
  frontend statique (`legal-notary-web/`) dans le même processus, un
  seul port, pas de CORS à configurer en production.

### Frontend (`legal-notary-web/`)

Écrans construits, reliés à l'API réelle, vérifiés à l'écran :
connexion, tableau de bord (2 variantes selon la portée du rôle :
cabinet complet ou personnelle), circuit d'instruction (kanban), liste
des dossiers, nouveau dossier (avec auto-assignation au créateur pour
les rôles limités à leurs dossiers assignés), fiche dossier complète
(checklist, compte client, fiche de taxe avec calcul en aperçu et
historique, projet d'acte), clients, actes (catalogue des 30 types
réels), archives, équipe, paramètres de base, fil de notifications.

### Déploiement (`legal-notary-server/deploiement/`)

Modèles prêts à l'emploi, jamais testés sur un vrai serveur (voir
section suivante) mais leur logique est relue et en partie testée :
`legalnotary.service` (systemd), `nginx-legalnotary.conf` (reverse proxy
+ HTTPS via Certbot), `sauvegarder.sh` + `crontab.exemple` (sauvegarde
PostgreSQL quotidienne). Voir `docs/DEPLOIEMENT.md` pour la checklist
complète.

## Ce qui reste à faire

### Bloquant avant une vraie mise en production (priorité haute)

1. **Identifiants SMTP/SMS/WhatsApp stockés en clair en base**
   (`parametres_notifications`) — pas de chiffrement au repos. Voir
   `NOTES_HYPOTHESES.md`, section "Sécurité des identifiants de
   notification", et `docs/NOTIFICATIONS.md` pour une piste de
   correction. **À corriger avant tout déploiement réel.**
2. **Confirmer les taux fiscaux manquants avec le notaire** — voir la
   liste précise dans `NOTES_HYPOTHESES.md` (droit d'enregistrement pour
   la plupart des types d'actes hors vente/bail/prêt/succession/
   mainlevée, formule exacte des émoluments de mainlevée d'hypothèque).
   Tant que ce n'est pas fait, le moteur applique 0 FCFA par sécurité —
   ne jamais combler ces trous avec un taux deviné.
3. **Aucun serveur réel ni nom de domaine** — il faut que le cabinet
   choisisse un hébergement (physique ou VPS) et un domaine avant que
   les modèles systemd/nginx puissent être réellement installés et
   testés.
4. **`pg_dump` jamais exécuté pour de vrai** — le script de sauvegarde a
   été relu et sa logique d'extraction de `DATABASE_URL` testée
   séparément, mais l'environnement de développement où ce projet a été
   construit n'a pas `pg_dump` installé. À vérifier une fois sur le vrai
   serveur avant de faire confiance à la sauvegarde automatique.
5. **Envoi réel de notification jamais testé** — email/SMS/WhatsApp/push
   fonctionnent en logique (testés avec des échecs propres quand un canal
   n'est pas configuré), mais aucun identifiant SMTP/SMS/push réel n'a
   été branché. À vérifier une fois les vrais identifiants du cabinet
   configurés.

### Écrans pas encore conçus visuellement

Aujourd'hui fonctionnels mais avec une mise en page minimale, pas
vraiment conçus dans l'identité visuelle choisie — voir le détail complet
et le contrat API de chaque écran dans
`legal-notary-server/docs/PROMPT_CLAUDE_DESIGN.md` :

1. **Cinq tableaux de bord vraiment distincts par rôle** — aujourd'hui,
   les rôles à portée "tous" (premier clerc, comptable) partagent la mise
   en page du notaire, et les rôles à portée "assignés" (clerc rédacteur,
   clerc aux formalités, assistante) partagent une seconde mise en page
   générique. Seuls les chiffres changent, pas la conception.
2. **Paramètres complets à onglets** — fiscalité (taux, barèmes, seuils),
   notifications (SMTP, SMS/WhatsApp, Web Push), modèles de message,
   manuel de procédure. Seule l'identité de base de l'étude existe à
   l'écran aujourd'hui.
3. **Fiche complète d'un membre de l'équipe** — téléphone, embauche,
   contrat, salaire (déjà géré côté API, pas encore d'écran dédié).
4. **« Mon évolution »** — statistiques personnelles d'un clerc/d'une
   assistante (l'API existe : `GET /api/tableau-bord/evolution/:id`).
5. **Moment dédié pour la demande d'autorisation de notification
   navigateur** (pas juste le popup natif brut).
6. **Vue imprimable de la fiche de taxe** (`@media print`).

### Autres limitations connues, non bloquantes

- **Pas d'identifiant client unique** — voir plus haut, `GET /api/clients`.
- **Export/impression Word/Excel** — décision explicite de la
  propriétaire : la rédaction se fait dans l'application par défaut,
  Word est optionnel via une pièce jointe déposée de l'extérieur
  (`piece_jointe_url`). Aucune intégration Word/Office 365 construite —
  si un export .docx devient nécessaire, c'est un ajout autonome à partir
  du contenu déjà stocké, pas une reprise du circuit de validation.
- **Classement automatique des tâches par mots-clés** — raisonnable mais
  pas une vérité absolue, corrigeable dossier par dossier sans reprise de
  code (voir `NOTES_HYPOTHESES.md`).

## Où trouver quoi

```
legal-notary-server/
  README.md                    démarrage local, structure du projet
  NOTES_HYPOTHESES.md          taux fiscaux confirmés vs à confirmer
  docs/ARCHITECTURE.md         vue d'ensemble technique, conventions
  docs/RBAC.md                 qui a le droit de voir/faire quoi, et pourquoi
  docs/ARCHIVAGE.md            logique d'archivage numérique/physique
  docs/NOTIFICATIONS.md        détail technique des notifications multi-canal
  docs/DEPLOIEMENT.md          checklist d'installation sur le serveur réel
  docs/PROMPT_CLAUDE_DESIGN.md identité visuelle + écrans restants à concevoir
  deploiement/                 systemd, nginx, script de sauvegarde
  src/rbac/roles.js            LA source de vérité des permissions
  src/services/                toute la logique métier
  src/api/                     routes Express (fines, jamais de logique ici)
  tests/                       21 tests automatisés (node --test, aucune BDD requise)

legal-notary-web/
  design-reference/            export Claude Design original — référence visuelle qui fait foi
  css/style.css                jetons de design (couleurs, polices, espacements) en commentaire d'en-tête
  js/api.js                    client HTTP (jeton, gestion du 401)
  js/app.js                    tout le contrôleur applicatif (~1000 lignes, une fonction render* par écran)
```

## Comment vérifier que ça marche

```bash
cd legal-notary-server
npm test              # 21 tests, aucune base de données nécessaire
npm start             # sert l'API + le frontend sur http://localhost:4000
```

Comptes de test existants dans la base actuelle (mot de passe
`motdepasse123` pour tous) : `notaire@legalnotary.test`,
`premier_clerc@legalnotary.test`, `clerc.isole@legalnotary.test` (clerc
rédacteur), `clerc_formaliste@legalnotary.test`,
`comptable_taxateur@legalnotary.test`, `assistante@legalnotary.test`.
