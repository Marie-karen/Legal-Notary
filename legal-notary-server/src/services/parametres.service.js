/**
 * src/services/parametres.service.js — Réglages du cabinet.
 *
 * `parametres_etude` ne contient normalement qu'une seule ligne (une
 * installation = un cabinet). `obtenir()` la crée avec les valeurs de
 * départ si elle n'existe pas encore (première utilisation après
 * migration), pour que l'application ne parte jamais d'un état "sans
 * paramètres".
 *
 * Conversion snake_case (colonnes SQL) <-> camelCase (JS) faite ici, une
 * fois pour toutes, pour que le reste du code (fiscal.service.js, les
 * routes API) manipule des objets JS classiques sans se soucier du nommage
 * SQL.
 */

const { pool } = require("../db/pool");

function versCamel(ligne) {
  return {
    id: ligne.id,
    nomEtude: ligne.nom_etude,
    titreNotaire: ligne.titre_notaire,
    nomNotaire: ligne.nom_notaire,
    numeroOrdre: ligne.numero_ordre,
    adresse: ligne.adresse,
    telephone: ligne.telephone,
    telephoneFixe: ligne.telephone_fixe,
    telephonePortable: ligne.telephone_portable,
    boitePostale: ligne.boite_postale,
    email: ligne.email,
    numeroCC: ligne.numero_cc,
    centreImpots: ligne.centre_impots,
    compteSequestreCDCI: ligne.compte_sequestre_cdci,
    tauxTVA: Number(ligne.taux_tva),
    minimumLegalMinute: Number(ligne.minimum_legal_minute),
    tarifPageTimbre: Number(ligne.tarif_page_timbre),
    tarifPageRole: Number(ligne.tarif_page_role),
    taxeFonciereTauxProportionnel: Number(ligne.taxe_fonciere_taux_proportionnel),
    taxeFonciereDroitFixe: Number(ligne.taxe_fonciere_droit_fixe),
    forfaitDivers: Number(ligne.forfait_divers),
    seuilStagnationJours: ligne.seuil_stagnation_jours,
    seuilAlerteEcheanceHeures: ligne.seuil_alerte_echeance_heures,
    capaciteCartonArchive: ligne.capacite_carton_archive,
  };
}

async function obtenir() {
  const { rows } = await pool.query("SELECT * FROM parametres_etude ORDER BY created_at ASC LIMIT 1");
  if (rows.length) return versCamel(rows[0]);

  const inseree = await pool.query(
    "INSERT INTO parametres_etude DEFAULT VALUES RETURNING *"
  );
  return versCamel(inseree.rows[0]);
}

/**
 * Met à jour les paramètres du cabinet. `champs` est un sous-ensemble
 * camelCase des colonnes ci-dessus ; seuls les champs fournis sont
 * modifiés (mise à jour partielle).
 */
async function mettreAJour(champs) {
  const actuels = await obtenir();
  const fusion = { ...actuels, ...champs };

  const { rows } = await pool.query(
    `UPDATE parametres_etude SET
       nom_etude = $1, titre_notaire = $2, nom_notaire = $3, numero_ordre = $4, adresse = $5,
       telephone = $6, telephone_fixe = $7, telephone_portable = $8, boite_postale = $9, email = $10,
       numero_cc = $11, centre_impots = $12, compte_sequestre_cdci = $13,
       taux_tva = $14, minimum_legal_minute = $15, tarif_page_timbre = $16, tarif_page_role = $17,
       taxe_fonciere_taux_proportionnel = $18, taxe_fonciere_droit_fixe = $19, forfait_divers = $20,
       seuil_stagnation_jours = $21, seuil_alerte_echeance_heures = $22, capacite_carton_archive = $23,
       updated_at = now()
     WHERE id = $24
     RETURNING *`,
    [
      fusion.nomEtude, fusion.titreNotaire, fusion.nomNotaire, fusion.numeroOrdre, fusion.adresse,
      fusion.telephone, fusion.telephoneFixe, fusion.telephonePortable, fusion.boitePostale, fusion.email,
      fusion.numeroCC, fusion.centreImpots, fusion.compteSequestreCDCI,
      fusion.tauxTVA, fusion.minimumLegalMinute, fusion.tarifPageTimbre, fusion.tarifPageRole,
      fusion.taxeFonciereTauxProportionnel, fusion.taxeFonciereDroitFixe, fusion.forfaitDivers,
      fusion.seuilStagnationJours, fusion.seuilAlerteEcheanceHeures, fusion.capaciteCartonArchive,
      actuels.id,
    ]
  );
  return versCamel(rows[0]);
}

module.exports = { obtenir, mettreAJour, versCamel };
