/**
 * js/sample-dossiers.js — Couche de persistance LocalStorage de Legal Notary
 *
 * Toutes les données de l'étude (dossiers, paramètres) vivent uniquement
 * dans le LocalStorage du navigateur : rien ne transite par un serveur,
 * conformément à l'exigence de secret professionnel absolu. Ce fichier
 * fournit le CRUD, le seed de démonstration (dossiers 2026 + stock
 * antérieur 2020-2025 + répertoire des minutes) et les règles de non
 * suppression physique : toute suppression est logique (archivedAt).
 *
 * Chargé en <script> classique (pas de type="module"), voir js/data.js.
 * Dépend de LegalNotary.data (doit être chargé avant ce fichier).
 */

var LegalNotary = window.LegalNotary || {};

LegalNotary.store = (function () {
  "use strict";

  var CLES = {
    DOSSIERS: "legalnotary_v1_dossiers",
    PARAMETRES: "legalnotary_v1_parametres",
    UTILISATEUR_ACTIF: "legalnotary_v1_utilisateur_actif",
    SEED_FAIT: "legalnotary_v1_seed_fait"
  };

  function lire(cle, defaut) {
    try {
      var brut = window.localStorage.getItem(cle);
      if (brut === null) return defaut;
      return JSON.parse(brut);
    } catch (e) {
      console.error("Legal Notary: lecture LocalStorage impossible pour " + cle, e);
      return defaut;
    }
  }

  function ecrire(cle, valeur) {
    try {
      window.localStorage.setItem(cle, JSON.stringify(valeur));
      return true;
    } catch (e) {
      console.error("Legal Notary: écriture LocalStorage impossible pour " + cle, e);
      return false;
    }
  }

  function genererId() {
    return "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function dateISO(offsetJours) {
    var d = new Date();
    d.setDate(d.getDate() + (offsetJours || 0));
    return d.toISOString().slice(0, 10);
  }

  // ---------------------------------------------------------------
  // Paramètres d'étude
  // ---------------------------------------------------------------
  function getParametres() {
    var p = lire(CLES.PARAMETRES, null);
    if (!p) {
      p = JSON.parse(JSON.stringify(LegalNotary.data.PARAMETRES_ETUDE_DEFAUT));
      p.fiscal = JSON.parse(JSON.stringify(LegalNotary.data.PARAMETRES_FISCAUX_DEFAUT));
      p.baremeEmoluments = JSON.parse(JSON.stringify(LegalNotary.data.BAREME_EMOLUMENTS_DEFAUT));
      ecrire(CLES.PARAMETRES, p);
    }
    return p;
  }

  function saveParametres(p) {
    return ecrire(CLES.PARAMETRES, p);
  }

  // ---------------------------------------------------------------
  // Utilisateur / rôle actif (session de l'étude, pas un compte réseau)
  // ---------------------------------------------------------------
  function getRoleActif() {
    return lire(CLES.UTILISATEUR_ACTIF, "notaire");
  }

  function setRoleActif(roleId) {
    return ecrire(CLES.UTILISATEUR_ACTIF, roleId);
  }

  // ---------------------------------------------------------------
  // Dossiers — CRUD (jamais de suppression physique)
  // ---------------------------------------------------------------
  function getDossiers() {
    return lire(CLES.DOSSIERS, []);
  }

  function getDossiersActifs() {
    return getDossiers().filter(function (d) { return !d.archivedAt; });
  }

  function saveDossiers(liste) {
    return ecrire(CLES.DOSSIERS, liste);
  }

  function getDossier(id) {
    var liste = getDossiers();
    for (var i = 0; i < liste.length; i++) {
      if (liste[i].id === id) return liste[i];
    }
    return null;
  }

  function majDossier(dossier) {
    var liste = getDossiers();
    for (var i = 0; i < liste.length; i++) {
      if (liste[i].id === dossier.id) { liste[i] = dossier; break; }
    }
    saveDossiers(liste);
    return dossier;
  }

  function prochainNumeroDossier(annee) {
    var liste = getDossiers().filter(function (d) { return d.anneeOuverture === annee; });
    var n = liste.length + 1;
    return "DOS-" + annee + "-" + String(n).padStart(3, "0");
  }

  function ajouterMouvement(dossier, description) {
    dossier.mouvements = dossier.mouvements || [];
    dossier.mouvements.push({ date: new Date().toISOString(), description: description });
    dossier.derniereActivite = new Date().toISOString();
  }

  function creerDossier(champs) {
    var annee = champs.anneeOuverture || new Date().getFullYear();
    var dossier = {
      id: genererId(),
      numeroDossier: prochainNumeroDossier(annee),
      acteId: champs.acteId,
      anneeOuverture: annee,
      dateOuverture: champs.dateOuverture || dateISO(0),
      comparants: champs.comparants || [],
      montant: champs.montant || 0,
      clercAssigne: champs.clercAssigne || "",
      etapeActuelle: 1,
      dateEntreeEtape: dateISO(0),
      checklist: LegalNotary.data.construireChecklist(champs.acteId),
      statutGlobal: "actif",
      compteClient: { provisions: [], decaissements: [] },
      minute: null,
      archivedAt: null,
      mouvements: []
    };
    ajouterMouvement(dossier, "Ouverture du dossier");
    var liste = getDossiers();
    liste.push(dossier);
    saveDossiers(liste);
    return dossier;
  }

  function changerEtape(dossierId, nouvelleEtape) {
    var dossier = getDossier(dossierId);
    if (!dossier) return null;
    var etapeInfo = LegalNotary.data.ETAPES_KANBAN[nouvelleEtape - 1];
    dossier.etapeActuelle = nouvelleEtape;
    dossier.dateEntreeEtape = dateISO(0);
    ajouterMouvement(dossier, "Passage à l'étape : " + (etapeInfo ? etapeInfo.label : nouvelleEtape));
    majDossier(dossier);
    return dossier;
  }

  function majStatutTache(dossierId, tacheId, statutId) {
    var dossier = getDossier(dossierId);
    if (!dossier) return null;
    var tache = null;
    for (var i = 0; i < dossier.checklist.length; i++) {
      if (dossier.checklist[i].id === tacheId) { tache = dossier.checklist[i]; break; }
    }
    if (!tache) return null;
    tache.statut = statutId;
    ajouterMouvement(dossier, "Tâche « " + tache.label + " » → " + statutId);
    majDossier(dossier);
    return dossier;
  }

  function ajouterProvision(dossierId, montant, libelle) {
    var dossier = getDossier(dossierId);
    if (!dossier) return null;
    dossier.compteClient.provisions.push({ date: dateISO(0), montant: montant, libelle: libelle || "Provision reçue" });
    ajouterMouvement(dossier, "Provision reçue : " + montant + " FCFA");
    majDossier(dossier);
    return dossier;
  }

  function ajouterDecaissement(dossierId, type, montant, libelle) {
    var dossier = getDossier(dossierId);
    if (!dossier) return null;
    dossier.compteClient.decaissements.push({ date: dateISO(0), type: type, montant: montant, libelle: libelle || type });
    ajouterMouvement(dossier, "Décaissement (" + type + ") : " + montant + " FCFA");
    majDossier(dossier);
    return dossier;
  }

  function enregistrerFicheDeTaxe(dossierId, fiche) {
    var dossier = getDossier(dossierId);
    if (!dossier) return null;
    dossier.ficheDeTaxe = fiche;
    ajouterMouvement(dossier, "Fiche de taxe établie/mise à jour");
    majDossier(dossier);
    return dossier;
  }

  function prochainNumeroMinute(annee) {
    var liste = getDossiers().filter(function (d) { return d.minute && d.minute.anneeMinute === annee; });
    var n = liste.length + 1;
    return "MIN-" + annee + "/" + String(n).padStart(3, "0");
  }

  function cloturerDossier(dossierId, emplacement) {
    var dossier = getDossier(dossierId);
    if (!dossier) return null;
    var annee = new Date().getFullYear();
    dossier.statutGlobal = "cloture";
    dossier.minute = {
      numero: prochainNumeroMinute(annee),
      anneeMinute: annee,
      dateCloture: dateISO(0),
      carton: (emplacement && emplacement.carton) || "",
      rayonnage: (emplacement && emplacement.rayonnage) || "",
      armoire: (emplacement && emplacement.armoire) || "",
      scanUrl: (emplacement && emplacement.scanUrl) || ""
    };
    ajouterMouvement(dossier, "Dossier clôturé — minute " + dossier.minute.numero + " attribuée");
    majDossier(dossier);
    return dossier;
  }

  // Suppression logique uniquement — aucune suppression physique.
  function archiverDossier(dossierId) {
    var dossier = getDossier(dossierId);
    if (!dossier) return null;
    dossier.archivedAt = new Date().toISOString();
    ajouterMouvement(dossier, "Dossier archivé (suppression logique)");
    majDossier(dossier);
    return dossier;
  }

  function getRepertoireMinutes() {
    return getDossiers()
      .filter(function (d) { return !!d.minute; })
      .sort(function (a, b) { return a.minute.numero < b.minute.numero ? 1 : -1; });
  }

  // ---------------------------------------------------------------
  // Chronométrage
  // ---------------------------------------------------------------
  function joursDepuis(dateStr) {
    var d = new Date(dateStr);
    var maintenant = new Date();
    return Math.floor((maintenant - d) / (1000 * 60 * 60 * 24));
  }

  function joursDansEtapeActuelle(dossier) {
    return joursDepuis(dossier.dateEntreeEtape);
  }

  function ancienneteDossier(dossier) {
    return joursDepuis(dossier.dateOuverture);
  }

  // ---------------------------------------------------------------
  // Seed de démonstration (dossiers 2026 + stock antérieur 2020-2025)
  // ---------------------------------------------------------------
  function initStockageEtSeed() {
    getParametres(); // s'assure que les paramètres par défaut existent
    if (lire(CLES.SEED_FAIT, false)) return;
    if (getDossiers().length > 0) { ecrire(CLES.SEED_FAIT, true); return; }

    var comparantsDemo = [
      [{ nom: "Koffi Yao Armand", role: "Vendeur" }, { nom: "Diaby Fatoumata", role: "Acquéreur" }],
      [{ nom: "SCI Les Palmiers", role: "Bailleur" }, { nom: "Établissements Traoré & Fils", role: "Preneur" }],
      [{ nom: "Kouassi N'Guessan", role: "Emprunteur" }, { nom: "Banque Atlantique CI", role: "Prêteur" }],
      [{ nom: "Succession Bamba Souleymane", role: "De cujus" }],
      [{ nom: "Ouattara Investissements SARL", role: "Société constituée" }]
    ];

    function ajout(joursOuverture, acteId, etape, montant, anneeOuverture) {
      var d = new Date();
      d.setDate(d.getDate() - joursOuverture);
      var dossier = {
        id: genererId(),
        numeroDossier: "DOS-" + anneeOuverture + "-" + String(Math.floor(Math.random() * 900 + 100)),
        acteId: acteId,
        anneeOuverture: anneeOuverture,
        dateOuverture: d.toISOString().slice(0, 10),
        comparants: comparantsDemo[Math.floor(Math.random() * comparantsDemo.length)],
        montant: montant,
        clercAssigne: ["Clerc Rédacteur A", "Clerc Rédacteur B", "Clerc Formaliste"][Math.floor(Math.random() * 3)],
        etapeActuelle: etape,
        dateEntreeEtape: dateISO(-Math.min(joursOuverture, Math.floor(Math.random() * 20))),
        checklist: LegalNotary.data.construireChecklist(acteId),
        statutGlobal: "actif",
        compteClient: { provisions: [{ date: d.toISOString().slice(0, 10), montant: Math.round(montant * 0.1), libelle: "Provision initiale" }], decaissements: [] },
        minute: null,
        archivedAt: null,
        mouvements: [{ date: d.toISOString(), description: "Ouverture du dossier" }]
      };
      var liste = getDossiers();
      liste.push(dossier);
      saveDossiers(liste);
      return dossier;
    }

    var anneeCourante = new Date().getFullYear();

    // Dossiers de l'année en cours — variété d'étapes et de statuts (vert/ambre/rouge)
    ajout(2, "vente_immo_urbaine", 1, 32000000, anneeCourante);
    ajout(6, "constitution_societe", 3, 5000000, anneeCourante);
    ajout(9, "pret_notarie_hypotheque", 5, 45000000, anneeCourante);
    ajout(1, "procuration", 1, 0, anneeCourante);
    ajout(18, "declaration_succession", 2, 60000000, anneeCourante);
    ajout(4, "bail_pro_commercial", 4, 12000000, anneeCourante);
    ajout(11, "cession_parts_sociales", 3, 8000000, anneeCourante);
    ajout(25, "mainlevee_hypotheque", 5, 0, anneeCourante);
    ajout(3, "donation", 1, 15000000, anneeCourante);
    ajout(40, "vente_parcelle_rurale", 2, 9000000, anneeCourante);

    // Stock antérieur non apuré (2020-2025) — pour le module de reprise d'historique
    ajout(650, "vente_immo_urbaine", 5, 28000000, 2024);
    ajout(1200, "declaration_succession", 2, 40000000, 2022);
    ajout(1800, "constitution_societe", 6, 3000000, 2021);
    ajout(2100, "partage_actifs", 3, 22000000, 2020);

    // Quelques dossiers déjà clôturés pour peupler le répertoire des minutes
    var d1 = ajout(400, "vente_immo_urbaine", 6, 18000000, 2025);
    cloturerDossier(d1.id, { carton: "Carton 12", rayonnage: "Rayon B", armoire: "Armoire 2" });
    var d2 = ajout(500, "constitution_societe", 6, 4000000, 2025);
    cloturerDossier(d2.id, { carton: "Carton 12", rayonnage: "Rayon B", armoire: "Armoire 2" });

    ecrire(CLES.SEED_FAIT, true);
  }

  return {
    CLES: CLES,
    getParametres: getParametres,
    saveParametres: saveParametres,
    getRoleActif: getRoleActif,
    setRoleActif: setRoleActif,
    getDossiers: getDossiers,
    getDossiersActifs: getDossiersActifs,
    getDossier: getDossier,
    majDossier: majDossier,
    creerDossier: creerDossier,
    changerEtape: changerEtape,
    majStatutTache: majStatutTache,
    ajouterProvision: ajouterProvision,
    ajouterDecaissement: ajouterDecaissement,
    enregistrerFicheDeTaxe: enregistrerFicheDeTaxe,
    cloturerDossier: cloturerDossier,
    archiverDossier: archiverDossier,
    getRepertoireMinutes: getRepertoireMinutes,
    joursDepuis: joursDepuis,
    joursDansEtapeActuelle: joursDansEtapeActuelle,
    ancienneteDossier: ancienneteDossier,
    initStockageEtSeed: initStockageEtSeed
  };
})();
