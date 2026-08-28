-- Migration 004 : Module de Rapports d'Activité et Paramétrage des Échéances SaaS

CREATE TABLE IF NOT EXISTS parametres_rapports_saas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_cible VARCHAR(50) UNIQUE NOT NULL, -- 'commercial', 'support', 'dev', 'assistante_editeur'
    frequence VARCHAR(20) NOT NULL DEFAULT 'hebdomadaire', -- 'quotidien', 'hebdomadaire', 'mensuel'
    jour_limite VARCHAR(20) NOT NULL DEFAULT 'vendredi', -- 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'
    heure_limite VARCHAR(10) NOT NULL DEFAULT '17:00',
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    description_attendus TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rapports_activite_saas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auteur_id UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
    auteur_nom VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'commercial', 'support', 'dev', 'assistante_editeur'
    titre VARCHAR(255) NOT NULL,
    periode_debut DATE NOT NULL,
    periode_fin DATE NOT NULL,
    statut VARCHAR(30) NOT NULL DEFAULT 'soumis', -- 'brouillon', 'soumis', 'valide_direction', 'demande_precision'
    donnees JSONB NOT NULL DEFAULT '{}'::jsonb,
    commentaire_direction TEXT,
    date_soumission TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    en_retard BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_rapports_role ON rapports_activite_saas(role);
CREATE INDEX IF NOT EXISTS idx_rapports_date_soumission ON rapports_activite_saas(date_soumission DESC);
CREATE INDEX IF NOT EXISTS idx_rapports_statut ON rapports_activite_saas(statut);

-- Initialisation des paramètres par défaut
INSERT INTO parametres_rapports_saas (role_cible, frequence, jour_limite, heure_limite, actif, description_attendus)
VALUES
    ('commercial', 'hebdomadaire', 'vendredi', '17:00', true, 'Études prospectées, démos réalisées, signatures d''études, MRR généré et pipeline en cours.'),
    ('support', 'hebdomadaire', 'vendredi', '18:00', true, 'Volume de tickets résolus (L1-L4), délais de résolution, études mécontentes, CSAT et points de blocage récurrents.'),
    ('dev', 'hebdomadaire', 'vendredi', '17:00', true, 'Mises en production, état des clusters, résolution d''incidents télémétriques et tests de reprise d''activité.'),
    ('assistante_editeur', 'mensuel', 'vendredi', '16:00', true, 'Facturation des abonnements, relances des impayés, contrats renouvelés et gestion administrative.')
ON CONFLICT (role_cible) DO NOTHING;
