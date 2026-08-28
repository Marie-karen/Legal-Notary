-- migrations/002_notifications_rh_procedures.sql
--
-- Ajouts demandés le 2026-08-25 : identité complète du cabinet, gestion RH
-- de l'équipe, infrastructure de notifications multi-canal (email/SMS/
-- WhatsApp/push navigateur/fil in-app), manuel de procédure configurable
-- (responsable + niveau d'alerte par étape), et le circuit de rédaction/
-- révision des projets d'acte.
--
-- Comme la migration 001 : PostgreSQL standard uniquement, rien de
-- propriétaire à un hébergeur. Les identifiants de services tiers (SMTP,
-- SMS, WhatsApp) sont stockés par cabinet, jamais partagés ni codés en dur
-- — voir docs/NOTIFICATIONS.md pour l'architecture complète.

-- ---------------------------------------------------------------------
-- 1. Identité complète du cabinet (point 1 de la demande)
-- ---------------------------------------------------------------------
ALTER TABLE parametres_etude
  ADD COLUMN nom_notaire text NOT NULL DEFAULT '',
  ADD COLUMN numero_ordre text NOT NULL DEFAULT '',
  ADD COLUMN telephone_fixe text NOT NULL DEFAULT '',
  ADD COLUMN telephone_portable text NOT NULL DEFAULT '',
  ADD COLUMN boite_postale text NOT NULL DEFAULT '';

-- ---------------------------------------------------------------------
-- 2. Données RH de l'équipe (point 6)
-- ---------------------------------------------------------------------
-- `salaire_net` est une donnée sensible : voir src/rbac/roles.js, seule la
-- permission `equipe:voir_salaires` (notaire uniquement) y donne accès —
-- jamais renvoyée par l'API à un autre rôle, y compris le premier clerc.
ALTER TABLE utilisateurs
  ADD COLUMN telephone text NOT NULL DEFAULT '',
  ADD COLUMN date_embauche date,
  ADD COLUMN type_contrat text,
  ADD COLUMN salaire_net bigint;

-- ---------------------------------------------------------------------
-- 3. Manuel de procédure configurable (point 4)
-- ---------------------------------------------------------------------
-- Les 6 étapes du pipeline étaient jusqu'ici une liste fixe dans le code
-- (src/services/dossiers.service.js). Elles deviennent une vraie table :
-- le cabinet peut décrire qui est responsable de chaque étape et son
-- niveau d'alerte par défaut sans reprise de développement. Le CODE
-- (l'identifiant 1 à 6, l'ordre) reste structurel et n'est pas éditable —
-- seuls le rôle responsable, la description et le niveau d'alerte le sont.
CREATE TABLE etapes_pipeline (
  id smallint PRIMARY KEY CHECK (id BETWEEN 1 AND 6),
  code text NOT NULL UNIQUE,
  libelle text NOT NULL,
  description text NOT NULL DEFAULT '',
  role_responsable text, -- réfère un id de src/rbac/roles.js (ex. 'clerc_redacteur'), pas de contrainte FK : c'est du code, pas une table
  niveau_alerte_par_defaut text NOT NULL DEFAULT 'normal' CHECK (niveau_alerte_par_defaut IN ('normal', 'eleve', 'critique'))
);

INSERT INTO etapes_pipeline (id, code, libelle, description, role_responsable, niveau_alerte_par_defaut) VALUES
  (1, 'COLLECTE_KYC', 'Collecte & KYC', 'Vérification CNI/passeport, extrait < 3 mois, régime matrimonial.', 'clerc_redacteur', 'normal'),
  (2, 'REQUISITIONS', 'Réquisitions & états préalables', 'Conservation Foncière, TCA, certificat d''urbanisme.', 'clerc_redacteur', 'normal'),
  (3, 'REDACTION', 'Rédaction du projet d''acte', 'Contrôle notarial de légalité.', 'clerc_redacteur', 'eleve'),
  (4, 'SIGNATURE', 'Rendez-vous de signature', 'Lecture et signature des comparants et du notaire.', 'notaire', 'eleve'),
  (5, 'FORMALITES', 'Formalités DGI & Conservation Foncière', 'Enregistrement fiscal, formalité fusionnée, inscription foncière.', 'clerc_formaliste', 'critique'),
  (6, 'EXPEDITIONS', 'Expéditions & clôture', 'Remise de la grosse/expéditions, CMPF, RCCM, archivage.', 'clerc_formaliste', 'normal');

-- ---------------------------------------------------------------------
-- 4. Circuit de rédaction / révision des projets d'acte (point 7)
-- ---------------------------------------------------------------------
-- Le contenu est rédigé DANS l'application par défaut (éditeur intégré) —
-- voir `contenu` ci-dessous. C'est délibérément optionnel : un notaire qui
-- préfère travailler autrement peut ignorer `contenu` et utiliser
-- uniquement `piece_jointe_url` (un fichier déposé de l'extérieur, ex. un
-- .docx modifié sur papier puis scanné/re-déposé). Append-only par
-- version : chaque soumission ou correction crée une nouvelle ligne,
-- jamais une modification sur place — historique complet conservé.
CREATE TABLE dossier_projets_acte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  numero_version integer NOT NULL,
  contenu text, -- rédigé dans l'éditeur intégré (optionnel, voir commentaire ci-dessus)
  piece_jointe_url text, -- chemin/URL d'un fichier déposé de l'extérieur (optionnel)
  statut text NOT NULL DEFAULT 'en_redaction'
    CHECK (statut IN ('en_redaction', 'soumis', 'a_corriger', 'valide')),
  redige_par_id uuid REFERENCES utilisateurs(id),
  soumis_le timestamptz,
  decision_par_id uuid REFERENCES utilisateurs(id),
  decision_le timestamptz,
  commentaire_decision text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dossier_id, numero_version)
);

CREATE INDEX idx_dossier_projets_acte_dossier ON dossier_projets_acte (dossier_id, numero_version DESC);

-- ---------------------------------------------------------------------
-- 5. Configuration des canaux de notification, par cabinet (point 2)
-- ---------------------------------------------------------------------
-- Une seule ligne en usage normal, comme parametres_etude. Les
-- identifiants SMS/WhatsApp sont volontairement génériques (jsonb) : le
-- cabinet peut brancher n'importe quel fournisseur exposant une simple
-- requête HTTP sortante, sans dépendre d'un fournisseur imposé par le
-- logiciel — voir docs/NOTIFICATIONS.md.
--
-- ATTENTION SÉCURITÉ : smtp_mot_de_passe et les identifiants des
-- fournisseurs SMS/WhatsApp sont stockés en clair dans cette version — ce
-- n'est pas chiffré au repos. Seule la permission `parametres:gerer`
-- (notaire) permet de les lire ou les modifier via l'API (jamais
-- renvoyés à un autre rôle). Voir NOTES_HYPOTHESES.md : le chiffrement au
-- repos de ces identifiants est une amélioration recommandée avant une
-- mise en production à grande échelle, pas encore faite dans cette
-- version.
CREATE TABLE parametres_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  smtp_hote text NOT NULL DEFAULT '',
  smtp_port integer NOT NULL DEFAULT 587,
  smtp_securise boolean NOT NULL DEFAULT true,
  smtp_utilisateur text NOT NULL DEFAULT '',
  smtp_mot_de_passe text NOT NULL DEFAULT '',
  smtp_expediteur_nom text NOT NULL DEFAULT '',
  smtp_expediteur_email text NOT NULL DEFAULT '',

  sms_actif boolean NOT NULL DEFAULT false,
  sms_url_webhook text NOT NULL DEFAULT '', -- endpoint HTTP du fournisseur choisi par le cabinet
  sms_identifiants jsonb NOT NULL DEFAULT '{}'::jsonb, -- ex. {"apiKey": "...", "senderId": "..."}, propre au fournisseur

  whatsapp_actif boolean NOT NULL DEFAULT false,
  whatsapp_url_webhook text NOT NULL DEFAULT '',
  whatsapp_identifiants jsonb NOT NULL DEFAULT '{}'::jsonb,

  push_actif boolean NOT NULL DEFAULT false,
  push_cle_publique text NOT NULL DEFAULT '', -- clé VAPID publique (Web Push), générée une fois par installation
  push_cle_privee text NOT NULL DEFAULT '',
  push_contact_email text NOT NULL DEFAULT '', -- requis par le protocole Web Push (mailto: de contact)

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 6. Modèles de message : à qui, quand, quoi (point 2)
-- ---------------------------------------------------------------------
-- Une ligne par combinaison (événement, canal) : l'email d'un événement a
-- un sujet + corps longs, le SMS/WhatsApp du MÊME événement a un corps
-- court — ce sont deux modèles séparés, pas un seul texte réutilisé
-- partout. `corps` supporte des espaces réservés du type {{numeroDossier}}
-- remplacés à l'envoi (voir src/services/notifications.service.js).
CREATE TABLE modeles_message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evenement text NOT NULL, -- ex. 'projet_acte_soumis', 'projet_acte_a_corriger', 'alerte_echeance', 'alerte_stagnation'
  canal text NOT NULL CHECK (canal IN ('email', 'sms', 'whatsapp', 'push', 'in_app')),
  destinataire text NOT NULL, -- rôle destinataire par défaut : 'notaire' | 'clerc_assigne' | 'premier_clerc' | ...
  sujet text, -- utilisé par email et push (titre) ; ignoré pour sms/whatsapp/in_app
  corps text NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  UNIQUE (evenement, canal)
);

-- Modèles de départ, personnalisables ensuite sans toucher au code.
INSERT INTO modeles_message (evenement, canal, destinataire, sujet, corps) VALUES
  ('projet_acte_soumis', 'email', 'notaire', 'Projet d''acte à valider — {{numeroDossier}}',
   'Bonjour,\n\n{{nomRedacteur}} a soumis le projet d''acte du dossier {{numeroDossier}} ({{typeActe}}) pour validation.\n\nConnectez-vous à Legal Notary pour le consulter.'),
  ('projet_acte_soumis', 'sms', 'notaire', NULL,
   'Legal Notary : {{nomRedacteur}} a soumis le projet d''acte {{numeroDossier}} pour validation.'),
  ('projet_acte_soumis', 'whatsapp', 'notaire', NULL,
   'Legal Notary : {{nomRedacteur}} a soumis le projet d''acte {{numeroDossier}} pour validation.'),
  ('projet_acte_soumis', 'push', 'notaire', 'Projet d''acte à valider',
   '{{numeroDossier}} — {{typeActe}}'),
  ('projet_acte_soumis', 'in_app', 'notaire', 'Projet d''acte à valider',
   '{{nomRedacteur}} a soumis le projet d''acte du dossier {{numeroDossier}}.'),

  ('projet_acte_a_corriger', 'email', 'clerc_assigne', 'Projet d''acte à corriger — {{numeroDossier}}',
   'Bonjour,\n\nLe notaire a renvoyé le projet d''acte du dossier {{numeroDossier}} pour correction.\n\nCommentaire : {{commentaire}}\n\nConnectez-vous à Legal Notary pour le reprendre.'),
  ('projet_acte_a_corriger', 'sms', 'clerc_assigne', NULL,
   'Legal Notary : le dossier {{numeroDossier}} est renvoyé pour correction.'),
  ('projet_acte_a_corriger', 'whatsapp', 'clerc_assigne', NULL,
   'Legal Notary : le dossier {{numeroDossier}} est renvoyé pour correction. Commentaire : {{commentaire}}'),
  ('projet_acte_a_corriger', 'push', 'clerc_assigne', 'Projet d''acte à corriger',
   '{{numeroDossier}} — voir le commentaire du notaire'),
  ('projet_acte_a_corriger', 'in_app', 'clerc_assigne', 'Projet d''acte à corriger',
   'Le notaire a renvoyé le dossier {{numeroDossier}} pour correction : {{commentaire}}'),

  ('projet_acte_valide', 'in_app', 'clerc_assigne', 'Projet d''acte validé',
   'Le notaire a validé le projet d''acte du dossier {{numeroDossier}}.'),
  ('projet_acte_valide', 'push', 'clerc_assigne', 'Projet d''acte validé',
   '{{numeroDossier}} a été validé par le notaire.'),

  ('alerte_echeance', 'in_app', 'clerc_assigne', 'Échéance proche', '{{numeroDossier}} arrive à échéance sous 48h.'),
  ('alerte_stagnation', 'in_app', 'clerc_assigne', 'Dossier stagnant', '{{numeroDossier}} n''a plus de mouvement depuis {{jours}} jours.');

-- ---------------------------------------------------------------------
-- 7. Notifications envoyées / fil in-app (points 2 et 3)
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id),
  dossier_id uuid REFERENCES dossiers(id),
  evenement text NOT NULL,
  canal text NOT NULL CHECK (canal IN ('email', 'sms', 'whatsapp', 'push', 'in_app')),
  titre text,
  corps text NOT NULL,
  lu boolean NOT NULL DEFAULT false, -- pertinent pour canal='in_app'
  statut_envoi text NOT NULL DEFAULT 'en_attente' CHECK (statut_envoi IN ('en_attente', 'envoye', 'echec')),
  erreur text,
  created_at timestamptz NOT NULL DEFAULT now(),
  envoye_le timestamptz
);

CREATE INDEX idx_notifications_utilisateur ON notifications (utilisateur_id, created_at DESC);
CREATE INDEX idx_notifications_non_lues ON notifications (utilisateur_id) WHERE canal = 'in_app' AND lu = false;

-- ---------------------------------------------------------------------
-- 8. Abonnements Web Push (notifications "à l'écran", point 3)
-- ---------------------------------------------------------------------
-- Une ligne par navigateur/appareil sur lequel l'utilisateur a autorisé
-- les notifications (comme les notifications système de Claude ou de
-- n'importe quelle app web) — un même utilisateur peut en avoir plusieurs
-- (ordinateur du bureau + téléphone).
CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  cle_p256dh text NOT NULL,
  cle_auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
