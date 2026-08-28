-- Migration 005 : Configuration de la présence d'un archiviste dédié ou mutualisation clercs

ALTER TABLE parametres_etude 
ADD COLUMN IF NOT EXISTS presence_archiviste boolean NOT NULL DEFAULT true;

-- Mise à jour de la contrainte CHECK sur les rôles autorisés
ALTER TABLE utilisateurs DROP CONSTRAINT IF EXISTS utilisateurs_role_check;
ALTER TABLE utilisateurs ADD CONSTRAINT utilisateurs_role_check CHECK (role IN (
  'notaire', 'premier_clerc', 'clerc_redacteur',
  'clerc_formaliste', 'comptable_taxateur', 'assistante',
  'archiviste',
  'superadmin', 'dev', 'commercial', 'support', 'assistante_editeur'
));

-- Création d'un compte démo archiviste si non existant
DO $$
DECLARE
  v_hash text;
BEGIN
  SELECT mot_de_passe_hash INTO v_hash FROM utilisateurs WHERE email = 'notaire@notaire.ci' LIMIT 1;
  IF v_hash IS NULL THEN
    v_hash := '$2b$10$e7jCjXf74vP7kQG5V5Z2Oeo4gHkY.v1o4j9GgG5V5Z2Oeo4gHkY.v';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM utilisateurs WHERE email = 'archiviste@notaire.ci') THEN
    INSERT INTO utilisateurs (
      nom_complet, email, mot_de_passe_hash, role, actif, salaire_net, etude_id
    ) VALUES (
      'Archiviste / Minutier',
      'archiviste@notaire.ci',
      v_hash,
      'archiviste',
      true,
      350000,
      'a0000000-0000-0000-0000-000000000001'
    );
  END IF;
END $$;
