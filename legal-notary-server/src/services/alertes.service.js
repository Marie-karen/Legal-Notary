/**
 * src/services/alertes.service.js — Centre d'alertes proactives & Maîtrise des risques opérationnels.
 *
 * Calcule pour chaque dossier actif :
 *   1. Retard d'étape & échéance relative au cabinet ;
 *   2. Risque de dépassement du Délai Légal DGI (Étape 5 - Formalités d'enregistrement 30j) ;
 *   3. Stagnation / Absence d'activité ;
 *   4. Pièces KYC ou conditions suspensives bloquantes ;
 *   5. Retard de réintégration du dossier physique en carton d'archives (> 7 jours).
 */

const { pool } = require("../db/pool");
const dossiersService = require("./dossiers.service");
const parametresService = require("./parametres.service");
const referentielService = require("./referentiel.service");

function joursDepuis(date) {
  if (!date) return 0;
  const debut = new Date(date).getTime();
  const maintenant = Date.now();
  return Math.floor((maintenant - debut) / (1000 * 60 * 60 * 24));
}

async function calculerAlertesPourUtilisateur(utilisateur) {
  const etudeId = utilisateur.etudeId || "a0000000-0000-0000-0000-000000000001";
  const [dossiers, parametres] = await Promise.all([
    dossiersService.listerDossiersPourUtilisateur(utilisateur, { statut: "actif" }),
    parametresService.obtenir(),
  ]);

  const typesActes = await referentielService.listerTypesActes();
  const delaiParTypeActe = new Map(typesActes.map((t) => [t.id, t.delaiStandardJours]));

  const seuilAmbreJours = parametres.seuilAlerteEcheanceHeures / 24;

  // Récupération des sorties physiques en cours pour détecter les retards
  let sortiesEnCours = [];
  try {
    const { rows } = await pool.query(
      "SELECT dossier_id, nom_demandeur, destination_bureau, date_mouvement, date_retour_prevue FROM mouvements_dossiers_physiques WHERE etude_id = $1 AND statut = 'en_cours'",
      [etudeId]
    );
    sortiesEnCours = rows;
  } catch {
    // Si la table n'est pas encore initialisée
  }
  const sortiesParDossier = new Map(sortiesEnCours.map((s) => [s.dossier_id, s]));

  const resultats = [];
  for (const dossier of dossiers) {
    const delaiTotal = delaiParTypeActe.get(dossier.typeActeId) || 30;
    const delaiEtape = Math.max(1, Math.round(delaiTotal / 6));
    const delaiEffectif = delaiEtape + (dossier.reportJours || 0);

    const joursDansEtape = joursDepuis(dossier.dateEntreeEtape);
    let couleur = "vert";
    if (joursDansEtape > delaiEffectif) couleur = "rouge";
    else if (joursDansEtape >= delaiEffectif - seuilAmbreJours) couleur = "ambre";

    // 1. Risque Légal DGI (Étape 5 : formalités d'enregistrement)
    let risqueDelaiDGI = false;
    let joursRestantsDGI = null;
    if (dossier.etapeActuelle === 5) {
      joursRestantsDGI = 30 - joursDansEtape;
      if (joursDansEtape >= 20) {
        couleur = "rouge";
        risqueDelaiDGI = true;
      } else if (joursDansEtape >= 15) {
        if (couleur === "vert") couleur = "ambre";
        risqueDelaiDGI = true;
      }
    }

    // 2. Risque de Stagnation
    const stagnant = joursDepuis(dossier.derniereActivite) > parametres.seuilStagnationJours;

    // 3. Risque KYC Bloquant
    const details = await dossiersService.obtenirDossierPourUtilisateur(dossier.id, utilisateur);
    const kycBloquant = details
      ? details.taches.some((t) => t.bloquante && t.statut !== "effectuee" && t.etape <= dossier.etapeActuelle)
      : false;

    // 4. Risque Perte / Emprunt Physique Non Réintégré (> 7 jours)
    const sortiePhysique = sortiesParDossier.get(dossier.id);
    let alerteSortiePhysique = null;
    if (sortiePhysique) {
      const joursSorti = joursDepuis(sortiePhysique.date_mouvement);
      const depassementDatePrevue = sortiePhysique.date_retour_prevue && new Date(sortiePhysique.date_retour_prevue) < new Date();
      if (joursSorti > 7 || depassementDatePrevue) {
        couleur = "rouge";
        alerteSortiePhysique = {
          nomDemandeur: sortiePhysique.nom_demandeur,
          bureau: sortiePhysique.destination_bureau,
          joursSorti,
        };
      }
    }

    if (couleur === "vert" && !stagnant && !kycBloquant && !risqueDelaiDGI && !alerteSortiePhysique) continue;

    resultats.push({
      dossier,
      couleur,
      joursDansEtape,
      delaiEffectif,
      stagnant,
      kycBloquant,
      risqueDelaiDGI,
      joursRestantsDGI,
      alerteSortiePhysique,
    });
  }

  return resultats;
}

module.exports = { calculerAlertesPourUtilisateur, joursDepuis };
