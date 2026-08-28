-- migrations/001_schema_initial.sql
--
-- Schéma initial de Legal Notary (backend serveur).
--
-- Objectif : décrire toutes les tables nécessaires à un office notarial
-- unique (une installation = un cabinet, sur son propre serveur physique
-- ou cloud — voir docs/DEPLOIEMENT.md). Aucune fonctionnalité propriétaire
-- d'un fournisseur cloud n'est utilisée : uniquement du PostgreSQL standard
-- (extension pgcrypto pour gen_random_uuid(), disponible sur toute
-- installation PostgreSQL >= 9.4), pour rester portable vers un serveur
-- ivoirien type VeOne si le cabinet change d'hébergeur.
--
-- Conventions (voir docs/ARCHITECTURE.md pour le détail) :
--   - montants en francs CFA : toujours `bigint`, jamais de type à virgule
--     flottante ;
--   - taux/pourcentages : `numeric`, en valeur décimale (0.18 = 18 %) ;
--   - aucune suppression physique de données métier : les tables qui
--     représentent un enregistrement légal (dossiers, utilisateurs, types
--     d'actes, tâches standard) ont une colonne `archived_at` — on
--     n'utilise jamais DELETE dessus depuis le code applicatif ;
--   - toute écriture financière (compte_client_ecritures, fiches_taxe) est
--     en ajout seul (append-only) : on ne corrige jamais une ligne, on en
--     ajoute une nouvelle et l'historique reste consultable.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- Utilisateurs & rôles (RBAC)
-- ---------------------------------------------------------------------
-- La liste des rôles et la matrice des permissions associées ne sont PAS
-- en base : elles vivent dans le code (src/rbac/roles.js), documentées et
-- versionnées avec le code, car ce sont des rôles structurels de l'outil
-- (qui peut faire quoi), pas des réglages métier du cabinet. Voir
-- docs/RBAC.md.
CREATE TABLE utilisateurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_complet text NOT NULL,
  email text NOT NULL UNIQUE,
  mot_de_passe_hash text NOT NULL,
  role text NOT NULL CHECK (role IN (
    'notaire', 'premier_clerc', 'clerc_redacteur',
    'clerc_formaliste', 'comptable_taxateur', 'assistante'
  )),
  actif boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Paramètres du cabinet (une seule ligne en usage normal)
-- ---------------------------------------------------------------------
-- Toutes les valeurs qui relèvent d'une décision du cabinet plutôt que
-- d'une contrainte technique vivent ici, jamais câblées en dur dans le
-- code applicatif : taux, seuils, tarifs. Modifiable via l'écran
-- Paramètres (frontend Claude Design) et l'API /api/parametres.
CREATE TABLE parametres_etude (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_etude text NOT NULL DEFAULT 'Office notarial — à renseigner',
  titre_notaire text NOT NULL DEFAULT 'Notaire Titulaire',
  adresse text NOT NULL DEFAULT '',
  telephone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  numero_cc text NOT NULL DEFAULT '',
  centre_impots text NOT NULL DEFAULT '',
  compte_sequestre_cdci text NOT NULL DEFAULT '',

  -- Moteur fiscal — valeurs de départ confirmées par des documents réels
  -- du cabinet (voir NOTES_HYPOTHESES.md pour ce qui reste à confirmer).
  taux_tva numeric(8,6) NOT NULL DEFAULT 0.18,
  minimum_legal_minute bigint NOT NULL DEFAULT 50000,
  tarif_page_timbre bigint NOT NULL DEFAULT 500,
  tarif_page_role bigint NOT NULL DEFAULT 500,
  taxe_fonciere_taux_proportionnel numeric(8,6) NOT NULL DEFAULT 0.012,
  taxe_fonciere_droit_fixe bigint NOT NULL DEFAULT 3000,
  forfait_divers bigint NOT NULL DEFAULT 20000,

  -- Alertes proactives
  seuil_stagnation_jours integer NOT NULL DEFAULT 7,
  seuil_alerte_echeance_heures integer NOT NULL DEFAULT 48,

  -- Archivage physique
  capacite_carton_archive integer NOT NULL DEFAULT 50,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Référentiel des actes (importé depuis la pratique réelle du cabinet,
-- voir seed/ — et entièrement éditable ensuite via l'API)
-- ---------------------------------------------------------------------
CREATE TABLE classifications_actes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle text NOT NULL UNIQUE,
  ordre integer NOT NULL DEFAULT 0,
  archived_at timestamptz
);

-- Barèmes d'émoluments dégressifs, réutilisables par plusieurs types
-- d'actes (ex. "vente", "societe", "pret" — Décret N° 2013-279).
CREATE TABLE baremes_emoluments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  libelle text NOT NULL,
  archived_at timestamptz
);

CREATE TABLE baremes_emoluments_tranches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bareme_id uuid NOT NULL REFERENCES baremes_emoluments(id),
  ordre integer NOT NULL,
  jusqua bigint, -- NULL = dernière tranche ("au-delà de")
  taux numeric(8,6) NOT NULL,
  UNIQUE (bareme_id, ordre)
);

CREATE TABLE types_actes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id uuid REFERENCES classifications_actes(id),
  libelle text NOT NULL UNIQUE,

  -- Délai standard total (somme des tâches), affiché à titre indicatif —
  -- recalculé automatiquement quand les tâches standard changent, mais
  -- reste une colonne stockée pour un affichage rapide sans jointure.
  delai_standard_jours integer NOT NULL DEFAULT 0,

  -- Règle fiscale de l'acte (voir src/services/fiscal.service.js) :
  --   - bareme_emoluments_id NULL => seul le minimum légal de minute
  --     s'applique (comportement conservateur par défaut, jamais de taux
  --     inventé — voir NOTES_HYPOTHESES.md) ;
  --   - droit_enregistrement_mode = 'a_confirmer' => droit affiché comme
  --     non chiffré, 0 appliqué tant que le cabinet ne l'a pas confirmé.
  bareme_emoluments_id uuid REFERENCES baremes_emoluments(id),
  droit_enregistrement_mode text NOT NULL DEFAULT 'a_confirmer'
    CHECK (droit_enregistrement_mode IN ('pourcentage', 'fixe', 'a_confirmer')),
  droit_enregistrement_valeur numeric(14,6) NOT NULL DEFAULT 0,
  taxe_fonciere_applicable boolean NOT NULL DEFAULT false,

  actif boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Checklist de référence par type d'acte. `duree_jours` est LE paramètre
-- de délai du cabinet pour cette tâche (pas une valeur globale à
-- l'application) — modifier cette colonne suffit à adapter les délais à
-- la pratique du cabinet, sans toucher au code.
-- `etape` rattache la tâche à l'une des 6 étapes universelles du pipeline
-- (voir src/services/dossiers.service.js#ETAPES) : c'est ce qui permet de
-- regrouper la checklist par colonne dans la vue kanban.
CREATE TABLE taches_standard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_acte_id uuid NOT NULL REFERENCES types_actes(id),
  etape smallint NOT NULL CHECK (etape BETWEEN 1 AND 6),
  ordre integer NOT NULL,
  libelle text NOT NULL,
  duree_jours integer NOT NULL DEFAULT 1,
  bloquante boolean NOT NULL DEFAULT false,
  archived_at timestamptz
);

-- ---------------------------------------------------------------------
-- Dossiers
-- ---------------------------------------------------------------------
CREATE TABLE dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_dossier text NOT NULL UNIQUE,
  type_acte_id uuid NOT NULL REFERENCES types_actes(id),
  annee_ouverture integer NOT NULL,
  date_ouverture date NOT NULL DEFAULT CURRENT_DATE,
  montant_assiette bigint NOT NULL DEFAULT 0,
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'cloture')),
  etape_actuelle integer NOT NULL DEFAULT 1 CHECK (etape_actuelle BETWEEN 1 AND 6),
  date_entree_etape date NOT NULL DEFAULT CURRENT_DATE,
  report_jours integer NOT NULL DEFAULT 0, -- report manuel d'échéance (bouton "Reporter 24h" côté alertes)
  clerc_assigne_id uuid REFERENCES utilisateurs(id),
  cree_par_id uuid REFERENCES utilisateurs(id),
  derniere_activite timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dossiers_statut ON dossiers (statut) WHERE archived_at IS NULL;
CREATE INDEX idx_dossiers_type_acte ON dossiers (type_acte_id);
CREATE INDEX idx_dossiers_clerc ON dossiers (clerc_assigne_id);

CREATE TABLE dossier_comparants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  nom text NOT NULL,
  qualite text NOT NULL DEFAULT 'Comparant'
);

-- Copie ("snapshot") de la checklist standard au moment de la création du
-- dossier : si le cabinet modifie ensuite le référentiel (taches_standard),
-- les dossiers déjà ouverts gardent la checklist qui était en vigueur à
-- leur ouverture — cohérence historique, pas de tâche qui apparaît ou
-- disparaît rétroactivement sur un dossier en cours.
CREATE TABLE dossier_taches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  tache_standard_id uuid REFERENCES taches_standard(id),
  etape smallint NOT NULL CHECK (etape BETWEEN 1 AND 6),
  ordre integer NOT NULL,
  libelle text NOT NULL,
  bloquante boolean NOT NULL DEFAULT false,
  duree_jours integer NOT NULL DEFAULT 1,
  statut text NOT NULL DEFAULT 'non_demarree'
    CHECK (statut IN ('non_demarree', 'attente_client', 'en_cours', 'depot_effectue', 'effectuee')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dossier_taches_dossier ON dossier_taches (dossier_id);

-- Journal d'activité du dossier : sert à la fois de fil d'audit léger et
-- de base pour la détection de stagnation (dossier sans mouvement depuis
-- plus de N jours).
CREATE TABLE dossier_mouvements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  utilisateur_id uuid REFERENCES utilisateurs(id),
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dossier_mouvements_dossier ON dossier_mouvements (dossier_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Comptabilité du dossier (compte séquestre / compte client)
-- ---------------------------------------------------------------------
-- Append-only : une correction se fait en ajoutant une écriture inverse,
-- jamais en modifiant/supprimant une ligne existante (traçabilité légale).
CREATE TABLE compte_client_ecritures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  sens text NOT NULL CHECK (sens IN ('provision', 'decaissement')),
  categorie text NOT NULL, -- 'droits' | 'debours' | 'honoraires' | 'vacations' | 'divers'
  montant bigint NOT NULL CHECK (montant >= 0),
  libelle text NOT NULL,
  date_ecriture date NOT NULL DEFAULT CURRENT_DATE,
  utilisateur_id uuid REFERENCES utilisateurs(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_compte_client_dossier ON compte_client_ecritures (dossier_id);

-- Historique des fiches de taxe calculées pour un dossier (jamais
-- écrasées : chaque calcul produit une nouvelle ligne, la plus récente
-- fait foi mais les précédentes restent consultables).
CREATE TABLE fiches_taxe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  donnees jsonb NOT NULL,
  utilisateur_id uuid REFERENCES utilisateurs(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fiches_taxe_dossier ON fiches_taxe (dossier_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Archivage numérique & physique (voir docs/ARCHIVAGE.md)
-- ---------------------------------------------------------------------
-- Un carton représente une boîte d'archives physique réelle. La numérotation
-- est strictement séquentielle et un carton reste "ouvert" (on peut encore
-- y ranger un dossier) jusqu'à ce qu'il atteigne sa capacité, puis passe
-- "plein" : le prochain dossier à archiver ouvre alors le carton suivant.
-- Cette règle garantit que le numéro du carton et sa position physique
-- réelle (rayonnage/armoire/salle) restent synchronisés avec l'ordre
-- chronologique d'archivage.
CREATE TABLE cartons_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_carton text NOT NULL UNIQUE, -- ex. CARTON-014, séquentiel
  salle text NOT NULL DEFAULT '',
  armoire text NOT NULL DEFAULT '',
  rayonnage text NOT NULL DEFAULT '',
  capacite_max integer NOT NULL DEFAULT 50,
  nombre_dossiers integer NOT NULL DEFAULT 0,
  statut text NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'plein', 'ferme')),
  date_ouverture date NOT NULL DEFAULT CURRENT_DATE,
  date_fermeture date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Un dossier clôturé reçoit immédiatement un numéro de minute (trace
-- numérique officielle). Le classement physique (attribution à un carton)
-- est une étape séparée, traitée dans l'ordre du plus ancien dossier
-- clôturé au plus récent (voir archives.service.js#archiverProchainDossier).
CREATE TABLE minutes_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL UNIQUE REFERENCES dossiers(id),
  numero_minute text NOT NULL UNIQUE, -- ex. MIN-2026/014
  annee_minute integer NOT NULL,
  date_cloture date NOT NULL DEFAULT CURRENT_DATE,
  carton_id uuid REFERENCES cartons_archive(id),
  position_dans_carton integer,
  code_emplacement text, -- chaîne composée, lisible, calculée à l'archivage physique
  statut_archivage text NOT NULL DEFAULT 'a_archiver'
    CHECK (statut_archivage IN ('a_archiver', 'archive')),
  scan_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_minutes_archive_statut ON minutes_archive (statut_archivage, date_cloture);

-- ---------------------------------------------------------------------
-- Audit générique (traçabilité légale des modifications sensibles)
-- ---------------------------------------------------------------------
CREATE TABLE journal_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_cible text NOT NULL,
  ligne_id uuid,
  action text NOT NULL,
  utilisateur_id uuid REFERENCES utilisateurs(id),
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_audit_cible ON journal_audit (table_cible, ligne_id);
