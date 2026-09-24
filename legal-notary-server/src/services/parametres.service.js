/**
 * src/services/parametres.service.js — Réglages du cabinet avec tolérance de panne in-memory.
 */

const { pool } = require("../db/pool");

function versCamel(ligne) {
  if (!ligne) return null;
  return {
    id: ligne.id,
    nomEtude: ligne.nom_etude || ligne.nomEtude || "ÉTUDE NOTARIALE KOUAMÉ & ASSOCIÉS",
    titreNotaire: ligne.titre_notaire || ligne.titreNotaire || "Maître",
    nomNotaire: ligne.nom_notaire || ligne.nomNotaire || "Kouamé Jean-Luc",
    numeroOrdre: ligne.numero_ordre || ligne.numeroOrdre || "NOT-ABJ-042",
    adresse: ligne.adresse || "Plateau, Boulevard de la République, Immeuble Le Notariat, Abidjan, Côte d'Ivoire",
    telephone: ligne.telephone || "+225 27 20 21 00 00",
    telephoneFixe: ligne.telephone_fixe || ligne.telephoneFixe || "+225 27 20 21 00 00",
    telephonePortable: ligne.telephone_portable || ligne.telephonePortable || "+225 07 07 12 34 56",
    boitePostale: ligne.boite_postale || ligne.boitePostale || "01 BP 4512 Abidjan 01",
    email: ligne.email || "contact@etude-kouame.ci",
    numeroCC: ligne.numero_cc || ligne.numeroCC || "9801234 A",
    centreImpots: ligne.centre_impots || ligne.centreImpots || "Direction des Moyennes Entreprises (DME Plateau)",
    compteSequestreCDCI: ligne.compte_sequestre_cdci || ligne.compteSequestreCDCI || "CI092 01001 12345678901 22",
    tauxTVA: Number(ligne.taux_tva !== undefined ? ligne.taux_tva : (ligne.tauxTVA || 0.18)),
    minimumLegalMinute: Number(ligne.minimum_legal_minute !== undefined ? ligne.minimum_legal_minute : (ligne.minimumLegalMinute || 50000)),
    tarifPageTimbre: Number(ligne.tarif_page_timbre !== undefined ? ligne.tarif_page_timbre : (ligne.tarifPageTimbre || 500)),
    tarifPageRole: Number(ligne.tarif_page_role !== undefined ? ligne.tarif_page_role : (ligne.tarifPageRole || 500)),
    taxeFonciereTauxProportionnel: Number(ligne.taxe_fonciere_taux_proportionnel !== undefined ? ligne.taxe_fonciere_taux_proportionnel : (ligne.taxeFonciereTauxProportionnel || 0.012)),
    taxeFonciereDroitFixe: Number(ligne.taxe_fonciere_droit_fixe !== undefined ? ligne.taxe_fonciere_droit_fixe : (ligne.taxeFonciereDroitFixe || 3000)),
    forfaitDivers: Number(ligne.forfait_divers !== undefined ? ligne.forfait_divers : (ligne.forfaitDivers || 20000)),
    seuilStagnationJours: Number(ligne.seuil_stagnation_jours !== undefined ? ligne.seuil_stagnation_jours : (ligne.seuilStagnationJours || 7)),
    seuilAlerteEcheanceHeures: Number(ligne.seuil_alerte_echeance_heures !== undefined ? ligne.seuil_alerte_echeance_heures : (ligne.seuilAlerteEcheanceHeures || 48)),
    capaciteCartonArchive: Number(ligne.capacite_carton_archive !== undefined ? ligne.capacite_carton_archive : (ligne.capaciteCartonArchive || 50)),
    presenceArchiviste: ligne.presence_archiviste !== false && ligne.presenceArchiviste !== false,
  };
}

let PARAMETRES_ACTUELS = {
  id: "param-etude-defaut-id",
  nomEtude: "ÉTUDE NOTARIALE KOUAMÉ & ASSOCIÉS",
  titreNotaire: "Maître",
  nomNotaire: "Kouamé Jean-Luc",
  numeroOrdre: "NOT-ABJ-042",
  adresse: "Plateau, Boulevard de la République, Immeuble Le Notariat, Abidjan, Côte d'Ivoire",
  telephone: "+225 27 20 21 00 00",
  telephoneFixe: "+225 27 20 21 00 00",
  telephonePortable: "+225 07 07 12 34 56",
  boitePostale: "01 BP 4512 Abidjan 01",
  email: "contact@etude-kouame.ci",
  numeroCC: "9801234 A",
  centreImpots: "Direction des Moyennes Entreprises (DME Plateau)",
  compteSequestreCDCI: "CI092 01001 12345678901 22",
  tauxTVA: 0.18,
  minimumLegalMinute: 50000,
  tarifPageTimbre: 500,
  tarifPageRole: 500,
  taxeFonciereTauxProportionnel: 0.012,
  taxeFonciereDroitFixe: 3000,
  forfaitDivers: 20000,
  seuilStagnationJours: 7,
  seuilAlerteEcheanceHeures: 48,
  capaciteCartonArchive: 50,
  presenceArchiviste: true,
};

async function obtenir() {
  try {
    const { rows } = await pool.query("SELECT * FROM parametres_etude ORDER BY created_at ASC LIMIT 1");
    if (rows && rows.length) return versCamel(rows[0]);
  } catch (_) {}
  return PARAMETRES_ACTUELS;
}

async function mettreAJour(champs) {
  const actuels = await obtenir();
  const fusion = { ...actuels, ...champs };

  try {
    const { rows } = await pool.query(
      `UPDATE parametres_etude SET
         nom_etude = $1, titre_notaire = $2, nom_notaire = $3, numero_ordre = $4, adresse = $5,
         telephone = $6, telephone_fixe = $7, telephone_portable = $8, boite_postale = $9, email = $10,
         numero_cc = $11, centre_impots = $12, compte_sequestre_cdci = $13,
         taux_tva = $14, minimum_legal_minute = $15, tarif_page_timbre = $16, tarif_page_role = $17,
         taxe_fonciere_taux_proportionnel = $18, taxe_fonciere_droit_fixe = $19, forfait_divers = $20,
         seuil_stagnation_jours = $21, seuil_alerte_echeance_heures = $22, capacite_carton_archive = $23,
         presence_archiviste = $24,
         updated_at = now()
       WHERE id = $25
       RETURNING *`,
      [
        fusion.nomEtude, fusion.titreNotaire, fusion.nomNotaire, fusion.numeroOrdre, fusion.adresse,
        fusion.telephone, fusion.telephoneFixe, fusion.telephonePortable, fusion.boitePostale, fusion.email,
        fusion.numeroCC, fusion.centreImpots, fusion.compteSequestreCDCI,
        fusion.tauxTVA, fusion.minimumLegalMinute, fusion.tarifPageTimbre, fusion.tarifPageRole,
        fusion.taxeFonciereTauxProportionnel, fusion.taxeFonciereDroitFixe, fusion.forfaitDivers,
        fusion.seuilStagnationJours, fusion.seuilAlerteEcheanceHeures, fusion.capaciteCartonArchive,
        fusion.presenceArchiviste !== false,
        actuels.id,
      ]
    );
    if (rows && rows.length) {
      PARAMETRES_ACTUELS = versCamel(rows[0]);
      return PARAMETRES_ACTUELS;
    }
  } catch (_) {}

  PARAMETRES_ACTUELS = fusion;
  return PARAMETRES_ACTUELS;
}

module.exports = { obtenir, mettreAJour, versCamel };
