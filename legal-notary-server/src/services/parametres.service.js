/**
 * src/services/parametres.service.js — Réglages du cabinet avec tolérance de panne in-memory & stockage persistant.
 */

const { pool } = require("../db/pool");
const {
  lireFichierJson,
  ecrireFichierJson,
} = require("./stockage-persistant.service");

function versCamel(ligne) {
  if (!ligne) return null;
  return {
    id: ligne.id,
    etudeId: ligne.etude_id || ligne.etudeId,
    nomEtude: ligne.nom_etude || ligne.nomEtude || "Legal Notary",
    titreNotaire: ligne.titre_notaire || ligne.titreNotaire || "Maître",
    nomNotaire: ligne.nom_notaire || ligne.nomNotaire || "Notaire Titulaire",
    numeroOrdre: ligne.numero_ordre || ligne.numeroOrdre || "NOT-ABJ-042",
    adresse: ligne.adresse || "Plateau, Abidjan, Côte d'Ivoire",
    telephone: ligne.telephone || "+225 27 20 00 00 00",
    telephoneFixe:
      ligne.telephone_fixe || ligne.telephoneFixe || "+225 27 20 00 00 00",
    telephonePortable:
      ligne.telephone_portable ||
      ligne.telephonePortable ||
      "+225 07 00 00 00 00",
    boitePostale:
      ligne.boite_postale || ligne.boitePostale || "01 BP 1000 Abidjan 01",
    email: ligne.email || "contact@legalnotary.app",
    numeroCC: ligne.numero_cc || ligne.numeroCC || "9801234 A",
    centreImpots:
      ligne.centre_impots ||
      ligne.centreImpots ||
      "Direction des Moyennes Entreprises (DME)",
    compteSequestreCDCI:
      ligne.compte_sequestre_cdci ||
      ligne.compteSequestreCDCI ||
      "CI092 01001 12345678901 22",
    tauxTVA: Number(
      ligne.taux_tva !== undefined ? ligne.taux_tva : ligne.tauxTVA || 0.18,
    ),
    minimumLegalMinute: Number(
      ligne.minimum_legal_minute !== undefined
        ? ligne.minimum_legal_minute
        : ligne.minimumLegalMinute || 50000,
    ),
    tarifPageTimbre: Number(
      ligne.tarif_page_timbre !== undefined
        ? ligne.tarif_page_timbre
        : ligne.tarifPageTimbre || 500,
    ),
    tarifPageRole: Number(
      ligne.tarif_page_role !== undefined
        ? ligne.tarif_page_role
        : ligne.tarifPageRole || 500,
    ),
    taxeFonciereTauxProportionnel: Number(
      ligne.taxe_fonciere_taux_proportionnel !== undefined
        ? ligne.taxe_fonciere_taux_proportionnel
        : ligne.taxeFonciereTauxProportionnel || 0.012,
    ),
    taxeFonciereDroitFixe: Number(
      ligne.taxe_fonciere_droit_fixe !== undefined
        ? ligne.taxe_fonciere_droit_fixe
        : ligne.taxeFonciereDroitFixe || 3000,
    ),
    forfaitDivers: Number(
      ligne.forfait_divers !== undefined
        ? ligne.forfait_divers
        : ligne.forfaitDivers || 20000,
    ),
    seuilStagnationJours: Number(
      ligne.seuil_stagnation_jours !== undefined
        ? ligne.seuil_stagnation_jours
        : ligne.seuilStagnationJours || 7,
    ),
    seuilAlerteEcheanceHeures: Number(
      ligne.seuil_alerte_echeance_heures !== undefined
        ? ligne.seuil_alerte_echeance_heures
        : ligne.seuilAlerteEcheanceHeures || 48,
    ),
    capaciteCartonArchive: Number(
      ligne.capacite_carton_archive !== undefined
        ? ligne.capacite_carton_archive
        : ligne.capaciteCartonArchive || 50,
    ),
    presenceArchiviste:
      ligne.presence_archiviste !== false && ligne.presenceArchiviste !== false,

    // Paramètres de Numérotation & Continuité de l'Étude
    modeNumerotation:
      ligne.mode_numerotation || ligne.modeNumerotation || "global", // 'global' | 'par_nature_acte'
    formatNumerotation:
      ligne.format_numerotation ||
      ligne.formatNumerotation ||
      "DOS-{AAAA}-{NUM}",
    dernierNumeroGlobal: Number(
      ligne.dernier_numero_global !== undefined
        ? ligne.dernier_numero_global
        : ligne.dernierNumeroGlobal || 0,
    ),
    derniersNumerosParNature:
      ligne.derniers_numeros_par_nature &&
      typeof ligne.derniers_numeros_par_nature === "object"
        ? ligne.derniers_numeros_par_nature
        : ligne.derniersNumerosParNature &&
            typeof ligne.derniersNumerosParNature === "object"
          ? ligne.derniersNumerosParNature
          : {},

    // Confidentialité financière pour le Premier Clerc
    premierClercVoirFinances: Boolean(
      ligne.premier_clerc_voir_finances || ligne.premierClercVoirFinances,
    ),

    // Référence légale / Tarif réglementaire paramétrable
    nomTarifReglementaire:
      ligne.nom_tarif_reglementaire ||
      ligne.nomTarifReglementaire ||
      "Tarif Réglementaire & Barème Notarial",
  };
}

let PARAMETRES_ACTUELS = {
  id: "param-etude-defaut-id",
  nomEtude: "Legal Notary",
  titreNotaire: "Maître",
  nomNotaire: "Notaire Titulaire",
  numeroOrdre: "NOT-ABJ-001",
  adresse: "Plateau, Abidjan, Côte d'Ivoire",
  telephone: "+225 27 20 00 00 00",
  telephoneFixe: "+225 27 20 00 00 00",
  telephonePortable: "+225 07 00 00 00 00",
  boitePostale: "01 BP 1000 Abidjan 01",
  email: "contact@legalnotary.app",
  numeroCC: "9801234 A",
  centreImpots: "Direction des Moyennes Entreprises (DME)",
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
  modeNumerotation: "global",
  formatNumerotation: "DOS-{AAAA}-{NUM}",
  dernierNumeroGlobal: 0,
  derniersNumerosParNature: {},
  premierClercVoirFinances: false,
  nomTarifReglementaire: "Tarif Réglementaire & Barème Notarial",
};

async function obtenir(etudeIdOuDomaine) {
  try {
    if (
      etudeIdOuDomaine &&
      etudeIdOuDomaine !== "saas-bttech" &&
      etudeIdOuDomaine !== "etude-abidjan-01" &&
      etudeIdOuDomaine !== "legalnotary.app" &&
      etudeIdOuDomaine !== "www.legalnotary.app" &&
      etudeIdOuDomaine !== "localhost" &&
      etudeIdOuDomaine !== "127.0.0.1"
    ) {
      // 1. Chercher par etude_id direct ou id
      const { rows } = await pool.query(
        "SELECT * FROM parametres_etude WHERE etude_id = $1 OR id = $1 ORDER BY created_at DESC LIMIT 1",
        [etudeIdOuDomaine],
      );
      if (rows && rows.length) return versCamel(rows[0]);

      // 2. Chercher par domaine dans la table etudes
      const cleanHost = String(etudeIdOuDomaine)
        .replace(/^www\./i, "")
        .toLowerCase();
      const etudeRes = await pool.query(
        "SELECT id FROM etudes WHERE LOWER(domaine) = $1 OR LOWER(domaine) = $2 LIMIT 1",
        [etudeIdOuDomaine.toLowerCase(), cleanHost],
      );
      if (etudeRes.rows && etudeRes.rows.length) {
        const foundEid = etudeRes.rows[0].id;
        const paramRes = await pool.query(
          "SELECT * FROM parametres_etude WHERE etude_id = $1 ORDER BY created_at DESC LIMIT 1",
          [foundEid],
        );
        if (paramRes.rows && paramRes.rows.length)
          return versCamel(paramRes.rows[0]);
      }
    }
  } catch (_) {}

  // Recherche dans les études persistées sur disque
  if (
    etudeIdOuDomaine &&
    etudeIdOuDomaine !== "saas-bttech" &&
    etudeIdOuDomaine !== "etude-abidjan-01"
  ) {
    try {
      const etudes = lireFichierJson("etudes_persistantes.json", []);
      const cle = String(etudeIdOuDomaine).toLowerCase().trim();
      const etudeTrouvee = etudes.find(
        (e) =>
          e.id === etudeIdOuDomaine ||
          (e.codeEtude && e.codeEtude.toLowerCase() === cle) ||
          (e.domaine && e.domaine.toLowerCase().includes(cle)),
      );
      if (etudeTrouvee) {
        const paramsMap = lireFichierJson("parametres_etudes_map.json", {});
        const perso = paramsMap[etudeTrouvee.id] || {};
        return {
          ...PARAMETRES_ACTUELS,
          ...perso,
          id: etudeTrouvee.id,
          etudeId: etudeTrouvee.id,
          nomEtude: etudeTrouvee.nomEtude || PARAMETRES_ACTUELS.nomEtude,
          titreNotaire: etudeTrouvee.titreNotaire || "Maître",
          nomNotaire:
            etudeTrouvee.nomNotaire ||
            (etudeTrouvee.titreNotaire
              ? etudeTrouvee.titreNotaire + " " + etudeTrouvee.nomEtude
              : "Maître Notaire"),
          ville: etudeTrouvee.ville || "Abidjan",
          adresse:
            etudeTrouvee.adresse ||
            "Office Notarial, " + (etudeTrouvee.ville || "Abidjan"),
          email:
            etudeTrouvee.emailContact ||
            (etudeTrouvee.codeEtude
              ? etudeTrouvee.codeEtude + "@notaire.ci"
              : PARAMETRES_ACTUELS.email),
        };
      }
    } catch (_) {}
  }

  // Vérifier si des réglages ont été personnalisés sur disque
  try {
    const paramsGlobal = lireFichierJson("parametres_etude_global.json", null);
    if (paramsGlobal) return { ...PARAMETRES_ACTUELS, ...paramsGlobal };
  } catch (_) {}

  return PARAMETRES_ACTUELS;
}

async function mettreAJour(champs, etudeId) {
  const actuels = await obtenir(etudeId);
  const fusion = { ...actuels, ...champs };

  try {
    const targetId = actuels.id || "param-etude-defaut-id";
    const { rows } = await pool.query(
      `UPDATE parametres_etude SET
         nom_etude = $1, titre_notaire = $2, nom_notaire = $3, numero_ordre = $4, adresse = $5,
         telephone = $6, telephone_fixe = $7, telephone_portable = $8, boite_postale = $9, email = $10,
         numero_cc = $11, centre_impots = $12, compte_sequestre_cdci = $13,
         taux_tva = $14, minimum_legal_minute = $15, tarif_page_timbre = $16, tarif_page_role = $17,
         taxe_fonciere_taux_proportionnel = $18, taxe_fonciere_droit_fixe = $19, forfait_divers = $20,
         seuil_stagnation_jours = $21, seuil_alerte_echeance_heures = $22, capacite_carton_archive = $23,
         presence_archiviste = $24,
         mode_numerotation = $25, format_numerotation = $26, dernier_numero_global = $27,
         derniers_numeros_par_nature = $28, premier_clerc_voir_finances = $29,
         updated_at = now()
       WHERE id = $30 OR etude_id = $31
       RETURNING *`,
      [
        fusion.nomEtude,
        fusion.titreNotaire,
        fusion.nomNotaire,
        fusion.numeroOrdre,
        fusion.adresse,
        fusion.telephone,
        fusion.telephoneFixe,
        fusion.telephonePortable,
        fusion.boitePostale,
        fusion.email,
        fusion.numeroCC,
        fusion.centreImpots,
        fusion.compteSequestreCDCI,
        fusion.tauxTVA,
        fusion.minimumLegalMinute,
        fusion.tarifPageTimbre,
        fusion.tarifPageRole,
        fusion.taxeFonciereTauxProportionnel,
        fusion.taxeFonciereDroitFixe,
        fusion.forfaitDivers,
        fusion.seuilStagnationJours,
        fusion.seuilAlerteEcheanceHeures,
        fusion.capaciteCartonArchive,
        fusion.presenceArchiviste !== false,
        fusion.modeNumerotation || "global",
        fusion.formatNumerotation || "DOS-{AAAA}-{NUM}",
        Number(fusion.dernierNumeroGlobal || 0),
        JSON.stringify(fusion.derniersNumerosParNature || {}),
        Boolean(fusion.premierClercVoirFinances),
        targetId,
        etudeId || targetId,
      ],
    );
    if (rows && rows.length) {
      const maj = versCamel(rows[0]);
      if (
        !etudeId ||
        etudeId === "saas-bttech" ||
        etudeId === "etude-abidjan-01"
      ) {
        PARAMETRES_ACTUELS = maj;
      }
      return maj;
    }
  } catch (_) {}

  // Sauvegarde persistante sur disque JSON
  try {
    if (
      etudeId &&
      etudeId !== "saas-bttech" &&
      etudeId !== "etude-abidjan-01"
    ) {
      const paramsMap = lireFichierJson("parametres_etudes_map.json", {});
      paramsMap[etudeId] = fusion;
      ecrireFichierJson("parametres_etudes_map.json", paramsMap);
    } else {
      ecrireFichierJson("parametres_etude_global.json", fusion);
    }
  } catch (_) {}

  PARAMETRES_ACTUELS = fusion;
  return PARAMETRES_ACTUELS;
}

module.exports = { obtenir, mettreAJour, versCamel };
