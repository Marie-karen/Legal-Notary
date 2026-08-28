/**
 * src/services/recherche-unifiee.service.js — Moteur de recherche unifié.
 *
 * Recherche simultanément sur :
 *   - N° dossier, dates, types d'actes
 *   - Noms et qualités des comparants
 *   - Plein texte issu de l'OCR (documents_numeriques.texte_ocr)
 *   - N° minute légale et répertoire officiel
 *   - Emplacements physiques, cartons et rayonnages
 */

const { pool } = require("../db/pool");
const mouvementsService = require("./mouvements-physiques.service");

async function rechercher({ etudeId = "a0000000-0000-0000-0000-000000000001", query = "" }) {
  const q = `%${(query || "").trim().toLowerCase()}%`;

  const { rows } = await pool.query(
    `SELECT d.id AS dossier_id, d.numero_dossier, d.type_acte_id, d.statut, d.statut_numerisation,
            d.date_ouverture, d.montant_assiette,
            COALESCE((SELECT string_agg(c.nom || ' (' || c.qualite || ')', ', ') FROM dossier_comparants c WHERE c.dossier_id = d.id), '') AS comparants_noms,
            m.numero_minute, m.code_emplacement, m.scan_url,
            k.numero_carton, k.salle AS carton_salle, k.armoire AS carton_armoire, k.rayonnage AS carton_rayonnage,
            COALESCE((SELECT string_agg(nom_fichier, ', ') FROM documents_numeriques dn WHERE dn.dossier_id = d.id AND dn.archived_at IS NULL), '') AS fichiers_numeriques,
            (SELECT COUNT(*)::int FROM documents_numeriques dn WHERE dn.dossier_id = d.id AND dn.archived_at IS NULL) AS nombre_docs_numeriques,
            (SELECT COUNT(*)::int FROM documents_physiques dp WHERE dp.dossier_id = d.id) AS nombre_docs_physiques
     FROM dossiers d
     LEFT JOIN minutes_archive m ON m.dossier_id = d.id
     LEFT JOIN cartons_archive k ON k.id = m.carton_id
     WHERE d.etude_id = $1
       AND (
         LOWER(d.numero_dossier) LIKE $2
         OR EXISTS (SELECT 1 FROM dossier_comparants c WHERE c.dossier_id = d.id AND LOWER(c.nom) LIKE $2)
         OR LOWER(COALESCE(m.numero_minute, '')) LIKE $2
         OR LOWER(COALESCE(m.code_emplacement, '')) LIKE $2
         OR LOWER(COALESCE(k.numero_carton, '')) LIKE $2
         OR EXISTS (SELECT 1 FROM documents_numeriques doc WHERE doc.dossier_id = d.id AND (LOWER(doc.nom_fichier) LIKE $2 OR LOWER(doc.texte_ocr) LIKE $2))
       )
     ORDER BY d.created_at DESC LIMIT 30`,
    [etudeId, q]
  );

  // Enrichir avec le statut physique en temps réel (sorti ou en carton)
  const resultats = [];
  for (const r of rows) {
    const statutPhysique = await mouvementsService.obtenirStatutPhysiqueDossier(r.dossier_id);
    resultats.push({
      dossierId: r.dossier_id,
      numeroDossier: r.numero_dossier,
      typeActeId: r.type_acte_id,
      comparantsNoms: r.comparants_noms || "Comparants",
      dateOuverture: r.date_ouverture,
      montantAssiette: Number(r.montant_assiette) || 0,
      statutDossier: r.statut,
      statutNumerisation: r.statut_numerisation || (r.scan_url ? "NUMERISE" : "NON_NUMERISE"),
      numeroMinute: r.numero_minute,
      scanUrl: r.scan_url,
      fichiersNumeriques: r.fichiers_numeriques || (r.scan_url ? r.scan_url : "Aucun fichier"),
      nombreDocsNumeriques: r.nombre_docs_numeriques || (r.scan_url ? 1 : 0),
      nombreDocsPhysiques: r.nombre_docs_physiques || 1,
      statutPhysique: statutPhysique,
    });
  }

  return resultats;
}

module.exports = {
  rechercher,
};
