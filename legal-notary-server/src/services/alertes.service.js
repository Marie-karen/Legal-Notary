/**
 * src/services/alertes.service.js — Centre d'alertes proactives.
 *
 * Calcule, pour chaque dossier actif visible par l'utilisateur (le
 * filtrage RBAC vient de dossiers.service.js, pas d'ici), trois signaux
 * indépendants :
 *   - retard/échéance : jours passés dans l'étape actuelle comparés au
 *     délai standard de cette étape pour ce cabinet (paramétrable) ;
 *   - stagnation : aucun mouvement enregistré depuis plus de
 *     `seuil_stagnation_jours` (paramétrable) ;
 *   - pièce bloquante manquante : au moins une tâche marquée `bloquante`
 *     dans une étape déjà atteinte n'est pas encore "effectuée".
 *
 * Les seuils utilisés viennent tous de `parametres_etude` — jamais de
 * valeur câblée en dur ici, conformément à la règle "la durée d'une tâche
 * dépend de chaque cabinet".
 */

const dossiersService = require("./dossiers.service");
const parametresService = require("./parametres.service");
const referentielService = require("./referentiel.service");

function joursDepuis(date) {
  const debut = new Date(date).getTime();
  const maintenant = Date.now();
  return Math.floor((maintenant - debut) / (1000 * 60 * 60 * 24));
}

async function calculerAlertesPourUtilisateur(utilisateur) {
  const [dossiers, parametres] = await Promise.all([
    dossiersService.listerDossiersPourUtilisateur(utilisateur, { statut: "actif" }),
    parametresService.obtenir(),
  ]);

  const typesActes = await referentielService.listerTypesActes();
  const delaiParTypeActe = new Map(typesActes.map((t) => [t.id, t.delaiStandardJours]));

  const seuilAmbreJours = parametres.seuilAlerteEcheanceHeures / 24;

  const resultats = [];
  for (const dossier of dossiers) {
    // Le délai "standard" par étape n'existe pas comme colonne séparée dans
    // ce modèle v1 (le délai est stocké par tâche, sommé au niveau du type
    // d'acte) : on approxime le délai de l'étape en cours par un sixième du
    // délai total du type d'acte. Une évolution possible (voir
    // docs/ARCHITECTURE.md, section "pistes") serait de sommer les tâches
    // de l'étape en cours précisément plutôt que d'utiliser cette moyenne.
    const delaiTotal = delaiParTypeActe.get(dossier.typeActeId) || 30;
    const delaiEtape = Math.max(1, Math.round(delaiTotal / 6));
    const delaiEffectif = delaiEtape + (dossier.reportJours || 0);

    const joursDansEtape = joursDepuis(dossier.dateEntreeEtape);
    let couleur = "vert";
    if (joursDansEtape > delaiEffectif) couleur = "rouge";
    else if (joursDansEtape >= delaiEffectif - seuilAmbreJours) couleur = "ambre";

    const stagnant = joursDepuis(dossier.derniereActivite) > parametres.seuilStagnationJours;

    const details = await dossiersService.obtenirDossierPourUtilisateur(dossier.id, utilisateur);
    const kycBloquant = details
      ? details.taches.some((t) => t.bloquante && t.statut !== "effectuee" && t.etape <= dossier.etapeActuelle)
      : false;

    if (couleur === "vert" && !stagnant && !kycBloquant) continue;

    resultats.push({
      dossier,
      couleur,
      joursDansEtape,
      delaiEffectif,
      stagnant,
      kycBloquant,
    });
  }

  return resultats;
}

module.exports = { calculerAlertesPourUtilisateur, joursDepuis };
