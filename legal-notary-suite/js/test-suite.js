/**
 * js/test-suite.js — Tests unitaires du référentiel et du moteur fiscal
 *
 * Couvre js/data.js et js/tax-engine.js (fonctions pures, aucune dépendance
 * DOM ni LocalStorage) : c'est la partie la plus sensible de l'application
 * puisqu'elle manipule des montants réels en francs CFA. Ne touche jamais au
 * LocalStorage pour ne pas polluer les données réelles de l'étude.
 *
 * S'exécute dans le navigateur via tests.html (ouverture directe en
 * file://, aucun serveur ni framework de test requis) et affiche le résultat
 * à l'écran ainsi que dans la console.
 */

(function () {
  "use strict";

  var data = LegalNotary.data;
  var tax = LegalNotary.taxEngine;

  var resultats = [];
  function assert(intitule, condition, detail) {
    resultats.push({ intitule: intitule, reussi: !!condition, detail: detail || "" });
  }
  function assertEgal(intitule, obtenu, attendu) {
    assert(intitule, obtenu === attendu, "obtenu=" + obtenu + " attendu=" + attendu);
  }

  // -----------------------------------------------------------------
  // data.js
  // -----------------------------------------------------------------
  assert("Le catalogue des actes n'est pas vide", data.CATALOGUE_ACTES.length > 0, "taille=" + data.CATALOGUE_ACTES.length);
  assert("Les 6 étapes du pipeline sont définies", data.ETAPES_KANBAN.length === 6);
  // Le cahier des charges évoque ~298 tâches standards ; ce chiffre n'est pas détaillé
  // acte par acte. Plutôt que d'inventer des tâches de remplissage pour l'atteindre
  // artificiellement, le référentiel ci-dessous couvre les 6 étapes pour les 26 types
  // d'actes du catalogue avec des tâches réelles et distinctes — à compléter depuis
  // l'écran Paramètres (à venir) si la pratique de l'étude en identifie d'autres.
  assert("Le référentiel de tâches standards est substantiel (couverture réaliste, sans remplissage artificiel)",
    data.tailleReferentielTaches() >= 150, "taille=" + data.tailleReferentielTaches());

  assert("Le Notaire a la permission de gérer les paramètres", data.aPermission("notaire", "gerer_parametres"));
  assert("L'Assistante n'a PAS la permission de gérer les paramètres (élévation de privilège)", !data.aPermission("assistante", "gerer_parametres"));
  assert("Un rôle inconnu n'a aucune permission (échec fermé)", !data.aPermission("role_qui_nexiste_pas", "gerer_parametres"));

  var checklistVente = data.construireChecklist("vente_immo_urbaine");
  assert("La checklist d'une vente immobilière contient des tâches communes et spécifiques",
    checklistVente.some(function (t) { return t.source === "commune"; }) && checklistVente.some(function (t) { return t.source === "specifique"; }));
  var checklistInconnue = data.construireChecklist("acte_qui_nexiste_pas");
  assert("La checklist d'un acte inconnu contient au moins les tâches communes (jamais vide/bloquant)", checklistInconnue.length === data.TACHES_COMMUNES.length);

  // -----------------------------------------------------------------
  // tax-engine.js — émoluments dégressifs
  // -----------------------------------------------------------------
  var tranchesVente = data.BAREME_EMOLUMENTS_DEFAUT.vente;
  var minimum = data.PARAMETRES_FISCAUX_DEFAUT.minimumLegalMinute;

  var em1 = tax.calculEmoluments(5000000, tranchesVente, minimum);
  assertEgal("Émoluments vente 5 000 000 FCFA (1ère tranche à 4%)", em1.montantHT, 200000);

  var em2 = tax.calculEmoluments(20000000, tranchesVente, minimum);
  // 10 000 000 * 4% + 10 000 000 * 2,5% = 400 000 + 250 000 = 650 000
  assertEgal("Émoluments vente 20 000 000 FCFA (2 tranches cumulées)", em2.montantHT, 650000);

  var em3 = tax.calculEmoluments(100000000, tranchesVente, minimum);
  // 10M*4% + 20M*2,5% + 60M*1,5% + 10M*0,75% = 400000+500000+900000+75000 = 1 875 000
  assertEgal("Émoluments vente 100 000 000 FCFA (4 tranches cumulées)", em3.montantHT, 1875000);

  var em4 = tax.calculEmoluments(100000, tranchesVente, minimum);
  assertEgal("Le minimum légal de minute s'applique sur un petit montant", em4.montantHT, minimum);
  assert("Le drapeau minimumApplique est levé quand le minimum s'applique", em4.minimumApplique === true);

  var em5 = tax.calculEmoluments(0, tranchesVente, minimum);
  assertEgal("Un montant nul retombe sur le minimum légal (jamais 0, jamais bloquant)", em5.montantHT, minimum);

  // -----------------------------------------------------------------
  // tax-engine.js — autres briques fiscales
  // -----------------------------------------------------------------
  assertEgal("Droit d'enregistrement vente 4% sur 10 000 000", tax.calculDroitsEnregistrement(10000000, { taux: 0.04 }).montant, 400000);
  assertEgal("Droit d'enregistrement à montant fixe", tax.calculDroitsEnregistrement(999, { montantFixe: 25000 }).montant, 25000);

  var cf = tax.calculConservationFonciere(10000000, data.PARAMETRES_FISCAUX_DEFAUT, { avecInscription: true, avecRadiation: false });
  assertEgal("Salaire du conservateur = 1% du montant", cf.salaireConservateur, 100000);
  assertEgal("Inscription foncière fixe = 15 000 FCFA", cf.inscriptionFonciere, 15000);
  assertEgal("Radiation non demandée = 0", cf.radiation, 0);

  assertEgal("Timbre fiscal 4 feuilles à 2 000 FCFA", tax.calculTimbreFiscal(4, data.PARAMETRES_FISCAUX_DEFAUT), 8000);
  assertEgal("Rôles de minute : 3 rôles à 3 000 FCFA", tax.calculRolesMinute(3, data.PARAMETRES_FISCAUX_DEFAUT), 9000);
  assertEgal("TVA 18% sur 200 000 FCFA HT", tax.calculTVA(200000, data.PARAMETRES_FISCAUX_DEFAUT), 36000);

  var deb = tax.calculDebours({ nombreExpeditions: 2, extraitTopoCadastre: true }, data.PARAMETRES_FISCAUX_DEFAUT);
  assertEgal("Débours : forfait papeterie 20 000 FCFA inclus par défaut", deb.papeterie, 20000);
  assertEgal("Débours : 2 expéditions à 15 000 FCFA", deb.expeditions, 30000);
  assertEgal("Débours : extrait topo/cadastre 25 000 FCFA", deb.extraitTopo, 25000);
  assertEgal("Débours total = somme des postes", deb.total, deb.papeterie + deb.expeditions + deb.extraitTopo + deb.autres);

  var penalite = tax.calculPenaliteRetard(400000, 45, data.PARAMETRES_FISCAUX_DEFAUT);
  assert("Pénalité de retard applicable au-delà du délai légal", penalite.applicable === true);
  assertEgal("Pénalité de retard = 10% + (1%/mois × mois de retard)", penalite.montant, Math.round(400000 * 0.10 + 400000 * 0.01 * 2));

  var penaliteNulle = tax.calculPenaliteRetard(400000, 0, data.PARAMETRES_FISCAUX_DEFAUT);
  assert("Pas de pénalité si aucun jour de retard", penaliteNulle.applicable === false && penaliteNulle.montant === 0);

  // -----------------------------------------------------------------
  // tax-engine.js — fiche de taxe complète (cohérence des totaux)
  // -----------------------------------------------------------------
  var acteVente = data.getActe("vente_immo_urbaine");
  var ficheVente = tax.calculerFicheDeTaxe(acteVente, 50000000, data.PARAMETRES_FISCAUX_DEFAUT, data.BAREME_EMOLUMENTS_DEFAUT, {
    nombreFeuilles: 10, nombreRoles: 6, nombreExpeditions: 2, avecInscriptionFonciere: true
  });
  assert("Fiche de taxe vente 50M : tous les montants sont des entiers (jamais de flottant)",
    [ficheVente.emoluments.montantHT, ficheVente.droitsEnregistrement.montant, ficheVente.tva, ficheVente.totaux.general]
      .every(function (n) { return Number.isInteger(n); }));
  assertEgal("Fiche de taxe vente 50M : total général = somme des 3 sous-totaux",
    ficheVente.totaux.general, ficheVente.totaux.tresor + ficheVente.totaux.emolumentsTTC + ficheVente.totaux.debours);

  var acteSociete = data.getActe("constitution_societe");
  var ficheSociete = tax.calculerFicheDeTaxe(acteSociete, 10000000, data.PARAMETRES_FISCAUX_DEFAUT, data.BAREME_EMOLUMENTS_DEFAUT, {
    nombreFeuilles: 8, nombreRoles: 4, nombreExpeditions: 2
  });
  assertEgal("Fiche de taxe constitution SARL 10M : émoluments = 3% (1ère tranche société)", ficheSociete.emoluments.montantHT, 300000);
  assert("Fiche de taxe constitution SARL : droit d'enregistrement marqué à confirmer (valeur non chiffrée par le CDC)",
    acteSociete.droitEnregistrement.aConfirmer === true);

  // -----------------------------------------------------------------
  // Rendu du rapport
  // -----------------------------------------------------------------
  function rendre() {
    var reussis = resultats.filter(function (r) { return r.reussi; }).length;
    var echoues = resultats.length - reussis;
    var conteneur = document.getElementById("resultats-tests");
    var resume = document.getElementById("resume-tests");
    if (resume) {
      resume.textContent = reussis + " / " + resultats.length + " tests réussis" + (echoues ? " — " + echoues + " échec(s)" : "");
      resume.className = echoues ? "resume-tests resume-tests--echec" : "resume-tests resume-tests--ok";
    }
    if (conteneur) {
      conteneur.innerHTML = resultats.map(function (r) {
        return '<div class="ligne-test ' + (r.reussi ? "ligne-test--ok" : "ligne-test--echec") + '">' +
          (r.reussi ? "✔" : "✘") + " " + r.intitule + (r.reussi ? "" : " <span class=\"detail-test\">(" + r.detail + ")</span>") +
          "</div>";
      }).join("");
    }
    console.log(reussis + "/" + resultats.length + " tests réussis");
    resultats.filter(function (r) { return !r.reussi; }).forEach(function (r) {
      console.error("ÉCHEC : " + r.intitule + " — " + r.detail);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", rendre);
  } else {
    rendre();
  }
})();
