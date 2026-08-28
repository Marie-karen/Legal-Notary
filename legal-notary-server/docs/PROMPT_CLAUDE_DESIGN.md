# Prompt de démarrage — Legal Notary dans Claude Design

À copier-coller dans une session Claude Design (claude.ai/design) pour
concevoir les écrans qui n'existent pas encore visuellement. Le backend
(API) et une bonne partie du frontend sont déjà construits et testés
contre les vraies données du cabinet — ce prompt sert à prolonger le
travail déjà fait, pas à repartir de zéro.

---

## Votre identité visuelle — déjà choisie, à respecter telle quelle

Ceci n'est **pas** une question ouverte. Vous avez déjà choisi une
direction visuelle réelle dans Claude Design (thème sombre) : ne proposez
pas d'autres palettes ni d'autres polices, ne repartez pas d'un préréglage
générique — prolongez exactement celle-ci.

```
--color-bg: #0f172a;          (fond principal, bleu nuit très sombre)
--color-surface: #182238;     (cartes, panneaux)
--color-surface-2: #1f2b47;   (champs de formulaire, éléments secondaires)
--color-text: #e7ecf5;
--color-text-dim: #94a3b8;
--color-accent: #16a34a;      (vert — actions principales, validation)
--color-accent-600: #15803d;  (survol du vert)
--color-warning: #d97706;     (ambre — alerte à surveiller)
--color-danger: #dc2626;      (rouge — urgent/erreur)
--color-divider: rgba(255,255,255,.09);

Titres : Space Grotesk (600/700)
Texte courant : Inter (400/500/600)
Rayon des coins : 6px
Espacements : 6 / 10 / 14 / 20 / 28 / 40 px
```

Composants déjà établis à réutiliser (pas à réinventer) : boutons
`.btn-primary` (vert plein) / `.btn-secondary` (surface grise) /
`.btn-ghost` (texte vert, transparent) ; champs `.input` sur fond
`--color-surface-2` ; cartes `.card` ; étiquettes `.tag` colorées par
statut (vert = sous contrôle, ambre = à surveiller, rouge = urgent) ;
tableaux sobres avec en-têtes en petites capitales grises.

Contraintes qui s'appliquent quelle que soit la direction : interface
entièrement en français, vocabulaire notarial exact (un « décompte »
reste un « décompte », jamais un anglicisme), style d'impression propre
(`@media print`) pour la fiche de taxe.

## Ce qui est déjà construit — ne pas repartir de zéro

Le frontend réel (`legal-notary-web/`, HTML/CSS/JS relié à l'API) couvre
déjà, fidèlement à cette identité visuelle : connexion, tableau de bord
(variante notaire — vue cabinet complète — et variante personnelle pour
les rôles restreints à leurs propres dossiers), circuit d'instruction en
kanban, liste des dossiers, fiche dossier complète (checklist de tâches,
compte client, fiche de taxe avec calcul en aperçu et historique, projet
d'acte avec cycle rédaction/soumission/validation/renvoi), écran de
création d'un nouveau dossier, archives, équipe (liste simple), et un
paramétrage de base (identité de l'étude, seuil d'alerte).

Si vous voulez les repasser dans Claude Design pour les affiner
visuellement, c'est bienvenu — mais ce n'est pas la priorité : ce qui
manque vraiment, ce sont les écrans ci-dessous, qui n'ont jamais été
conçus visuellement, seulement rendus fonctionnels avec une mise en page
minimale.

## Ce qui manque réellement

1. **Cinq tableaux de bord distincts, visuellement pas seulement en
   contenu.** Aujourd'hui, Premier Clerc/Comptable partagent la mise en
   page "vue cabinet" du notaire (mêmes 4 chiffres en haut, même liste
   d'alertes) et Clerc Rédacteur/Clerc aux Formalités/Assistante
   partagent une mise en page "vue personnelle" — seuls les chiffres
   affichés changent, pas la conception de l'écran. Concevoir une mise en
   page vraiment adaptée à chaque façon de travailler (voir le
   raisonnement métier dans `docs/RBAC.md` du backend) :
   - **Premier Clerc** : supervision de l'instruction, tous les dossiers.
   - **Clerc Rédacteur** : ses dossiers assignés, priorité à la
     checklist et à la rédaction.
   - **Clerc aux Formalités** : centré sur les délais administratifs
     (DGI, Conservation Foncière), pas un kanban à 6 colonnes complet —
     seulement les 2 étapes qui le concernent.
   - **Comptable Taxateur** : centré sur les fiches de taxe et le compte
     client, pas la checklist juridique.
   - **Assistante / Accueil** : priorité à l'ouverture de dossier et aux
     pièces KYC — écran d'accueil simple, pas un tableau financier.
2. **Paramètres du cabinet — version complète à onglets** (aujourd'hui,
   seule l'identité de base existe à l'écran) :
   - *Fiscalité* : taux, barèmes d'émoluments, délais de tâches, seuils
     d'alerte, capacité des cartons d'archive.
   - *Notifications* : SMTP, activation/identifiants SMS et WhatsApp,
     activation Web Push. Le mot de passe SMTP ne revient jamais en clair
     (`smtpMotDePasseDefini: true/false` seulement) — afficher "déjà
     configuré, laisser vide pour ne pas changer".
   - *Modèles de message* : liste éditable des textes envoyés par
     événement/canal.
   - *Manuel de procédure* : les 6 étapes du pipeline, chacune avec une
     description modifiable, le rôle responsable, le niveau d'alerte par
     défaut.
3. **Équipe — fiche complète d'un membre** (au-delà de la liste actuelle) :
   téléphone, date d'embauche, type de contrat, salaire net. **Le salaire
   n'est visible/modifiable que si l'API le renvoie** (uniquement pour le
   notaire) — si absent de la réponse, ne pas afficher ce champ du tout,
   ni un champ vide qui laisserait croire qu'il pourrait être rempli.
4. **« Mon évolution »** (clerc, assistante) — statistiques personnelles :
   dossiers actifs, dossiers clôturés sur 30 jours, avancement moyen. Le
   notaire/premier clerc/comptable peuvent consulter celles de n'importe
   quel membre de l'équipe.
5. **Demande d'autorisation de notification navigateur**, présentée comme
   un vrai moment de l'interface (pas juste un popup natif brut) —
   expliquer pourquoi (alertes de dossier, projet d'acte à valider) avant
   de déclencher `Notification.requestPermission()`.
6. **Vue imprimable de la fiche de taxe** (`@media print`) — ce qui sort
   sur papier pour le client, distinct de l'écran de saisie.

## Contrat avec l'API (inchangé, toujours valable)

```
POST /api/auth/connexion
Corps : { "email": "...", "motDePasse": "..." }
Réponse : { "jeton": "...", "utilisateur": { "id", "nomComplet", "email", "role", "actif" } }
```

Jeton envoyé sur chaque appel : `Authorization: Bearer <jeton>`. 401 →
écran de connexion. Ne jamais recalculer un montant fiscal, ni décider
quels dossiers un rôle peut voir : l'API tranche déjà tout — l'écran
n'a qu'à afficher fidèlement ce qu'elle renvoie.

Étapes du pipeline : Collecte & KYC · Réquisitions & états préalables ·
Rédaction du projet d'acte · Rendez-vous de signature · Formalités DGI &
Conservation Foncière · Expéditions & clôture.

Statuts de tâche : `non_demarree` (0 %), `attente_client` (25 %),
`en_cours` (50 %), `depot_effectue` (75 %), `effectuee` (100 %).

Endpoints utiles par écran manquant : tableaux de bord personnels →
`GET /api/tableau-bord/evolution/:utilisateurId` ; paramètres fiscalité
→ `GET`/`PUT /api/parametres` ; notifications/modèles →
`GET`/`PUT /api/parametres-notifications`,
`GET /api/parametres-notifications/modeles` ; manuel de procédure →
`GET /api/manuel-procedure`, `PATCH /api/manuel-procedure/:id` ; équipe →
`GET`/`POST`/`PATCH /api/equipe` ; fiche de taxe imprimable →
`POST /api/fiscal/calculer` (aperçu) et
`GET /api/fiscal/dossiers/:id/historique` (déjà enregistrées).
