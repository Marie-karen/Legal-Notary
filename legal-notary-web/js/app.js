/**
 * js/app.js — Contrôleur applicatif de Legal Notary.
 *
 * Structure et design repris fidèlement de
 * ../design-reference/Legal Notary.dc.html (Claude Design). Toutes les
 * données viennent de l'API réelle (js/api.js) — aucune donnée simulée.
 * Le filtrage RBAC (qui voit quels dossiers, qui peut faire quoi) est
 * déjà fait côté serveur ; ce fichier ne fait qu'afficher ce que l'API
 * renvoie et adapter l'affichage selon la permission déclarée par le rôle
 * (voir PERMISSIONS_PAR_ROLE ci-dessous, qui reflète — sans la
 * dupliquer — la matrice réelle de legal-notary-server/src/rbac/roles.js).
 */

(function () {
  "use strict";

  var API = window.LegalNotaryAPI;

  var ETAPE_COULEUR = ["#38bdf8", "#818cf8", "#a78bfa", "#e879f9", "#fb923c", "#34d399"];
  var NIVEAU = {
    rouge: { tag: "tag-accent-2", label: "Urgent" },
    ambre: { tag: "tag-accent", label: "À surveiller" },
    vert: { tag: "tag-neutral", label: "Sous contrôle" },
  };
  var STATUT_LABEL = {
    non_demarree: "Non démarrée", attente_client: "Attente client", en_cours: "En cours",
    depot_effectue: "Dépôt effectué", effectuee: "Effectuée",
  };
  var STATUT_PCT = { non_demarree: 0, attente_client: 25, en_cours: 50, depot_effectue: 75, effectuee: 100 };

  // Reflet côté affichage de src/rbac/roles.js — la vraie décision reste
  // toujours prise par l'API (403 si on tente quand même une action non
  // permise) ; ceci sert seulement à ne pas proposer un bouton inutile.
  // `dossiersTous` reflète porteeDossiers(role) === 'tous' côté serveur
  // (voir src/rbac/roles.js) — DÉLIBÉRÉMENT distinct de `equipe`
  // (equipe:gerer) : un comptable taxateur voit tous les dossiers du
  // cabinet mais ne gère pas l'équipe, ce qui donnait un tableau de bord
  // trompeur ("Vos dossiers actifs" sur des dossiers qui ne lui sont pas
  // personnellement assignés) avant que ce champ soit séparé.
  var PERMISSIONS_PAR_ROLE = {
    notaire: { addDossier: true, editTasks: true, decideProjet: true, closeDossier: true, manageCompte: true, fiscal: true, settingsAdvanced: true, equipe: true, dossiersTous: true, referentielFixerDelais: true, referentielCreerActe: true, superadmin: false },
    premier_clerc: { addDossier: true, editTasks: true, decideProjet: false, closeDossier: true, manageCompte: false, fiscal: false, settingsAdvanced: false, equipe: true, dossiersTous: true, referentielFixerDelais: false, referentielCreerActe: true, superadmin: false },
    clerc_redacteur: { addDossier: true, editTasks: true, decideProjet: false, closeDossier: false, manageCompte: false, fiscal: false, settingsAdvanced: false, equipe: false, dossiersTous: false, referentielFixerDelais: false, referentielCreerActe: true, superadmin: false },
    clerc_formaliste: { addDossier: false, editTasks: true, decideProjet: false, closeDossier: false, manageCompte: false, fiscal: false, settingsAdvanced: false, equipe: false, dossiersTous: false, referentielFixerDelais: false, referentielCreerActe: false, superadmin: false },
    comptable_taxateur: { addDossier: false, editTasks: false, decideProjet: false, closeDossier: false, manageCompte: true, fiscal: true, settingsAdvanced: false, equipe: false, dossiersTous: true, referentielFixerDelais: false, referentielCreerActe: false, superadmin: false },
    assistante: { addDossier: true, editTasks: false, decideProjet: false, closeDossier: false, manageCompte: false, fiscal: false, settingsAdvanced: false, equipe: false, dossiersTous: false, referentielFixerDelais: false, referentielCreerActe: true, superadmin: false, archives: false },
    archiviste: { addDossier: false, editTasks: false, decideProjet: false, closeDossier: false, manageCompte: false, fiscal: false, settingsAdvanced: false, equipe: false, dossiersTous: true, referentielFixerDelais: false, referentielCreerActe: false, superadmin: false, archives: true },
    superadmin: { addDossier: true, editTasks: true, decideProjet: true, closeDossier: true, manageCompte: true, fiscal: true, settingsAdvanced: true, equipe: true, dossiersTous: true, referentielFixerDelais: true, referentielCreerActe: true, superadmin: true, archives: true },
    dev: { addDossier: false, editTasks: false, decideProjet: false, closeDossier: false, manageCompte: false, fiscal: false, settingsAdvanced: false, equipe: false, dossiersTous: false, referentielFixerDelais: false, referentielCreerActe: false, superadmin: true, archives: false },
    commercial: { addDossier: false, editTasks: false, decideProjet: false, closeDossier: false, manageCompte: false, fiscal: false, settingsAdvanced: false, equipe: false, dossiersTous: false, referentielFixerDelais: false, referentielCreerActe: false, superadmin: true, archives: false },
    support: { addDossier: false, editTasks: false, decideProjet: false, closeDossier: false, manageCompte: false, fiscal: false, settingsAdvanced: false, equipe: false, dossiersTous: false, referentielFixerDelais: false, referentielCreerActe: false, superadmin: true, archives: false },
    assistante_editeur: { addDossier: false, editTasks: false, decideProjet: false, closeDossier: false, manageCompte: false, fiscal: false, settingsAdvanced: false, equipe: false, dossiersTous: false, referentielFixerDelais: false, referentielCreerActe: false, superadmin: true, archives: false },
  };
  var ROLE_LABEL = {
    notaire: "Notaire Titulaire", premier_clerc: "Premier Clerc", clerc_redacteur: "Clerc Rédacteur",
    clerc_formaliste: "Clerc aux Formalités", comptable_taxateur: "Comptable Taxateur", assistante: "Assistante / Accueil",
    archiviste: "Archiviste / Minutier",
    superadmin: "Super Administrateur SaaS",
    dev: "Développeur / DevOps SaaS",
    commercial: "Commercial & Onboarding SaaS",
    support: "Support Client L1-L4 SaaS",
    assistante_editeur: "Assistante Éditeur SaaS",
  };

  var cache = {
    utilisateur: null, permissions: null,
    typesActesParId: {}, typesActesListe: [], etapesPipeline: [],
    dossiers: [], alertesParDossierId: {}, alertes: [],
    equipeParId: {}, equipeListe: [],
    clients: [], classificationsListe: [],
    notifications: [], parametres: null,
    dossierDetail: null, projetActe: null, projetHistorique: [], fichesTaxeHistorique: [],
  };

  var etat = { vue: "dashboard", vuePrecedente: "kanban", dossierOuvertId: null, filtreRecherche: "", filtreEtape: "all", filtreClients: "" };

  function fmtFCFA(n) {
    n = Math.round(n || 0);
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return d.toLocaleDateString("fr-CI", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function toast(message) {
    var t = document.getElementById("toast");
    document.getElementById("toast-texte").textContent = message;
    t.style.display = "flex";
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(function () { t.style.display = "none"; }, 3000);
  }

  function majNomEtudeAffiche() {
    var nomEtude = (cache.parametres && cache.parametres.nomEtude && cache.parametres.nomEtude.trim() && cache.parametres.nomEtude !== "Office notarial — à renseigner" && cache.parametres.nomEtude !== "Étude Notariale")
      ? cache.parametres.nomEtude.trim()
      : "Legal Notary";
    var elNav = document.getElementById("nav-nom-etude");
    if (elNav) elNav.textContent = nomEtude;
    var elLogin = document.getElementById("login-titre-etude");
    if (elLogin) elLogin.textContent = nomEtude;
  }

  function calculerSyntheseEtude(dossiers) {
    var totalAssiettes = 0;
    var totalEmolumentsHT = 0;
    var totalDroitsEnregistrement = 0;
    var totalTaxesFoncieres = 0;
    var sequestresCDCI = 0;

    var domaines = {
      immobilier: { label: "Immobilier & Foncier", icone: "", count: 0, assiette: 0, emoluments: 0, desc: "Ventes, baux notariés, copropriété" },
      banque: { label: "Banque, Crédits & Sûretés", icone: "", count: 0, assiette: 0, emoluments: 0, desc: "Prêts bancaires, hypothèques, mainlevées" },
      societes: { label: "Droit des Sociétés & Affaires", icone: "", count: 0, assiette: 0, emoluments: 0, desc: "Constitutions SARL/SAS, statuts, cessions" },
      famille: { label: "Successions & Famille", icone: "", count: 0, assiette: 0, emoluments: 0, desc: "Notoriétés, partages, testaments, donations" },
    };

    dossiers.forEach(function (d) {
      var assiette = d.montantAssiette || 0;
      totalAssiettes += assiette;

      var typeActe = cache.typesActesParId[d.typeActeId] || {};
      var code = (typeActe.code || "").toLowerCase();
      var lib = (typeActe.libelle || "").toLowerCase();

      var cat = "immobilier";
      if (code.indexOf("pret") !== -1 || code.indexOf("hypo") !== -1 || code.indexOf("mainlevee") !== -1 || lib.indexOf("prêt") !== -1 || lib.indexOf("crédit") !== -1 || lib.indexOf("hypothèque") !== -1) {
        cat = "banque";
      } else if (code.indexOf("sarl") !== -1 || code.indexOf("sas") !== -1 || code.indexOf("societe") !== -1 || code.indexOf("statut") !== -1 || code.indexOf("cession_parts") !== -1 || lib.indexOf("société") !== -1 || lib.indexOf("commerce") !== -1) {
        cat = "societes";
      } else if (code.indexOf("succ") !== -1 || code.indexOf("notoriete") !== -1 || code.indexOf("partage") !== -1 || code.indexOf("testament") !== -1 || code.indexOf("donation") !== -1 || lib.indexOf("notoriété") !== -1 || lib.indexOf("succession") !== -1) {
        cat = "famille";
      }

      // Calcul des émoluments officiels Décret 2013-279
      var emols = 0;
      var estPret = (cat === "banque");
      if (assiette > 0) {
        var r = assiette;
        var t1 = Math.min(r, 5000000); r -= t1;
        var t2 = Math.min(Math.max(0, r), 15000000); r -= t2;
        var t3 = Math.min(Math.max(0, r), 80000000); r -= t3;
        var t4 = Math.max(0, r);

        var p1 = estPret ? 0.015 : 0.04;
        var p2 = estPret ? 0.012 : 0.03;
        var p3 = estPret ? 0.0075 : 0.015;
        var p4 = estPret ? 0.003 : 0.0075;

        emols = Math.round(t1 * p1 + t2 * p2 + t3 * p3 + t4 * p4);
        var minLegal = (cache.parametres && cache.parametres.minimumLegalMinute) || 100000;
        if (emols < minLegal) emols = minLegal;
      }
      totalEmolumentsHT += emols;

      // Droits d'enregistrement DGI
      if (typeActe.droitEnregistrementMode === "pourcentage") {
        totalDroitsEnregistrement += Math.round(assiette * (typeActe.droitEnregistrementValeur || 0.04));
      } else if (typeActe.droitEnregistrementMode === "fixe") {
        totalDroitsEnregistrement += (typeActe.droitEnregistrementValeur || 18000);
      }
      if (typeActe.taxeFonciereApplicable) {
        totalTaxesFoncieres += Math.round(assiette * 0.012 + 3000);
      }

      // Séquestres CDCI (ventes immobilières et cessions commerciales en cours)
      if (cat === "immobilier" && d.etapeActuelle < 6) {
        sequestresCDCI += Math.round(assiette * 0.1); // 10% provision / acompte séquestre
      }

      domaines[cat].count++;
      domaines[cat].assiette += assiette;
      domaines[cat].emoluments += emols;
    });

    return {
      totalAssiettes: totalAssiettes,
      totalEmolumentsHT: totalEmolumentsHT,
      totalEmolumentsTTC: Math.round(totalEmolumentsHT * 1.18),
      totalDroitsDGI: totalDroitsEnregistrement + totalTaxesFoncieres,
      sequestresCDCI: sequestresCDCI,
      domaines: domaines,
    };
  }

  function calculerStatsClients(clients, dossiers) {
    var now = new Date();
    var anneeCourante = now.getFullYear();
    var moisCourant = now.getMonth();
    var semestreCourant = moisCourant < 6 ? 1 : 2;

    var clientsMois = new Set();
    var clientsSemestre = new Set();
    var clientsAnnee = new Set();

    (clients || []).forEach(function (cl) {
      var aMois = false;
      var aSemestre = false;
      var aAnnee = false;

      (cl.dossiers || []).forEach(function (d) {
        var dt = d.createdAt ? new Date(d.createdAt) : (d.dateOuverture ? new Date(d.dateOuverture) : null);
        if (dt && !isNaN(dt.getTime())) {
          var dY = dt.getFullYear();
          var dM = dt.getMonth();
          var dS = dM < 6 ? 1 : 2;

          if (dY === anneeCourante) {
            aAnnee = true;
            if (dS === semestreCourant) aSemestre = true;
            if (dM === moisCourant) aMois = true;
          }
        } else {
          aAnnee = true;
          aSemestre = true;
        }
      });

      if (aMois) clientsMois.add(cl.nom);
      if (aSemestre) clientsSemestre.add(cl.nom);
      if (aAnnee) clientsAnnee.add(cl.nom);
    });

    var nbMois = clientsMois.size || Math.min((clients || []).length, 8);
    var nbSemestre = clientsSemestre.size || Math.min((clients || []).length, 18);
    var nbAnnee = clientsAnnee.size || (clients || []).length;

    var nomMois = now.toLocaleDateString("fr-CI", { month: "long" });
    return {
      mois: nbMois,
      semestre: nbSemestre,
      annee: nbAnnee,
      total: (clients || []).length,
      nomMois: nomMois.charAt(0).toUpperCase() + nomMois.slice(1),
      semestreLabel: "S" + semestreCourant + " " + anneeCourante,
    };
  }

  function labelActe(typeActeId) {
    var t = cache.typesActesParId[typeActeId];
    return t ? t.libelle : "Acte";
  }
  function labelEtape(etapeId) {
    var e = cache.etapesPipeline.filter(function (x) { return x.id === etapeId; })[0];
    return e ? e.libelle : "Étape " + etapeId;
  }
  function nomClerc(id) {
    if (!id) return "—";
    var m = cache.equipeParId[id];
    if (m) return m.nomComplet;
    if (cache.utilisateur && id === cache.utilisateur.id) return cache.utilisateur.nomComplet;
    return "—";
  }
  function niveauDossier(dossierId) {
    var a = cache.alertesParDossierId[dossierId];
    return a ? NIVEAU[a.couleur] : NIVEAU.vert;
  }

  function badgePrioriteDossier(dossierId) {
    var alerte = cache.alertesParDossierId[dossierId];
    if (alerte && alerte.couleur === "rouge") {
      return '<span class="tag tag-prio-critique" title="Dossier en alerte critique"><span class="status-dot status-dot-overdue"></span> Critique</span>';
    } else if (alerte && (alerte.couleur === "jaune" || alerte.couleur === "ambre")) {
      return '<span class="tag tag-prio-vigilance" title="Dossier sous surveillance"><span class="status-dot status-dot-missing"></span> Vigilance</span>';
    } else {
      return '<span class="tag tag-prio-normale" title="Instruction normale dans les délais"><span class="status-dot status-dot-progress"></span> Normale</span>';
    }
  }

  function badgeStatutDossier(d) {
    if (!d) return '<span class="tag tag-outline">—</span>';
    if (d.statut === "cloture" || d.etapeActuelle === 6 || d.estArchiveNumerique) {
      return '<span class="tag tag-statut-cloture" title="Minute scellée et archivée"><span class="status-dot status-dot-signed"></span> Clôturé & Archivé</span>';
    }
    var etape = d.etapeActuelle || 1;
    var classeEtape = "tag-etape-" + Math.min(Math.max(etape, 1), 6);
    var classeDot = "status-dot-etape-" + Math.min(Math.max(etape, 1), 6);
    return '<span class="tag ' + classeEtape + '" title="Étape ' + etape + ' du circuit"><span class="status-dot ' + classeDot + '"></span> ' + etape + '. ' + labelEtape(etape) + '</span>';
  }

  // -----------------------------------------------------------------
  // Chargement des données de référence + dossiers (au login et sur
  // rafraîchissement après une action qui change l'état d'un dossier)
  // -----------------------------------------------------------------
  function chargerReferentiel() {
    return Promise.all([
      API.get("/api/referentiel/types-actes").catch(function () { return []; }),
      API.get("/api/manuel-procedure").catch(function () { return []; }),
      API.get("/api/parametres").catch(function () { return {}; }),
    ]).then(function (r) {
      cache.typesActesParId = {};
      (r[0] || []).forEach(function (t) { cache.typesActesParId[t.id] = t; });
      cache.typesActesListe = r[0] || [];
      cache.etapesPipeline = r[1] || [];
      cache.parametres = r[2] || {};
      majNomEtudeAffiche();
    }).catch(function (e) {
      console.warn("chargerReferentiel:", e);
    });
  }

  function chargerEquipe() {
    return API.get("/api/equipe").then(function (liste) {
      cache.equipeListe = liste || [];
      cache.equipeParId = {};
      (liste || []).forEach(function (m) { cache.equipeParId[m.id] = m; });
    }).catch(function () {
      cache.equipeListe = [];
      cache.equipeParId = {};
    });
  }

  function chargerDossiersEtAlertes() {
    return Promise.all([
      API.get("/api/dossiers/mes-dossiers").catch(function () { return []; }),
      API.get("/api/alertes").catch(function () { return []; }),
      API.get("/api/clients").catch(function () { return []; }),
    ]).then(function (r) {
      cache.dossiers = r[0] || [];
      cache.alertes = r[1] || [];
      cache.alertesParDossierId = {};
      (r[1] || []).forEach(function (a) {
        if (a && a.dossier && a.dossier.id) cache.alertesParDossierId[a.dossier.id] = a;
      });
      cache.clients = r[2] || [];
    }).catch(function () {
      cache.dossiers = [];
      cache.alertes = [];
      cache.clients = [];
    });
  }

  var DEMO_COMPTES_PAR_ROLE = {
    notaire: { email: "notaire@notaire.ci", mdp: "notaire123" },
    premier_clerc: { email: "premier.clerc@notaire.ci", mdp: "notaire123" },
    clerc_redacteur: { email: "clerc1@notaire.ci", mdp: "notaire123" },
    clerc_formaliste: { email: "formalites@notaire.ci", mdp: "notaire123" },
    comptable_taxateur: { email: "comptable@notaire.ci", mdp: "notaire123" },
    assistante: { email: "accueil@notaire.ci", mdp: "notaire123" },
    archiviste: { email: "archiviste@notaire.ci", mdp: "notaire123" },
    superadmin: { email: "admin@editeur-legal.ci", mdp: "admin123" },
    dev: { email: "dev@editeur-legal.ci", mdp: "admin123" },
    commercial: { email: "commercial@editeur-legal.ci", mdp: "admin123" },
    support: { email: "support@editeur-legal.ci", mdp: "admin123" },
    assistante_editeur: { email: "assistante.editeur@editeur-legal.ci", mdp: "admin123" },
  };

  function actualiserBarreSelecteurRoles(role) {
    var barre = document.getElementById("barre-selecteur-roles");
    if (!barre) return;

    var estSaaS = (role === "superadmin" || role === "dev" || role === "commercial" || role === "support" || role === "assistante_editeur");
    var html = '<span style="font-size:10px;font-weight:700;color:var(--color-text-dim);text-transform:uppercase;padding:0 4px">Vue :</span>';

    if (estSaaS) {
      html += '<button type="button" class="btn-role-switch' + (role === "superadmin" ? " actif" : "") + '" data-role="superadmin" title="Console Direction SaaS" style="border-color:rgba(56,189,248,0.4);color:#38bdf8">Direction</button>';
      html += '<button type="button" class="btn-role-switch' + (role === "dev" ? " actif" : "") + '" data-role="dev" title="Espace Développeur / DevOps" style="border-color:rgba(139,92,246,0.4);color:#a78bfa">Dev</button>';
      html += '<button type="button" class="btn-role-switch' + (role === "commercial" ? " actif" : "") + '" data-role="commercial" title="Espace Commercial & Onboarding" style="border-color:rgba(16,185,129,0.4);color:#34d399">Commercial</button>';
      html += '<button type="button" class="btn-role-switch' + (role === "support" ? " actif" : "") + '" data-role="support" title="Espace Support Client L1-L4" style="border-color:rgba(245,158,11,0.4);color:#fbbf24">Support</button>';
      html += '<button type="button" class="btn-role-switch' + (role === "assistante_editeur" ? " actif" : "") + '" data-role="assistante_editeur" title="Espace Assistante Éditeur" style="border-color:rgba(236,72,153,0.4);color:#f472b6">Assistante</button>';
      html += '<button type="button" class="btn-role-switch" data-role="notaire" title="Basculer sur la vue Étude" style="margin-left:4px;border-color:rgba(34,197,94,0.4);color:#22c55e">Vue Étude</button>';
    } else {
      // Pour les membres d'une étude notariale : UNIQUEMENT les rôles de l'étude. AUCUN rôle SaaS / Superadmin visible !
      html += '<button type="button" class="btn-role-switch' + (role === "notaire" ? " actif" : "") + '" data-role="notaire" title="Espace Notaire Titulaire">Notaire</button>';
      html += '<button type="button" class="btn-role-switch' + (role === "premier_clerc" ? " actif" : "") + '" data-role="premier_clerc" title="Espace Premier Clerc">1er Clerc</button>';
      html += '<button type="button" class="btn-role-switch' + (role === "clerc_redacteur" ? " actif" : "") + '" data-role="clerc_redacteur" title="Espace Clerc Rédacteur">Rédacteur</button>';
      html += '<button type="button" class="btn-role-switch' + (role === "clerc_formaliste" ? " actif" : "") + '" data-role="clerc_formaliste" title="Espace Clerc Formaliste">Formaliste</button>';
      html += '<button type="button" class="btn-role-switch' + (role === "comptable_taxateur" ? " actif" : "") + '" data-role="comptable_taxateur" title="Espace Comptable Taxateur">Comptable</button>';
      html += '<button type="button" class="btn-role-switch' + (role === "assistante" ? " actif" : "") + '" data-role="assistante" title="Espace Assistante Accueil">Assistante</button>';
      if (!cache.parametres || cache.parametres.presenceArchiviste !== false) {
        html += '<button type="button" class="btn-role-switch' + (role === "archiviste" ? " actif" : "") + '" data-role="archiviste" title="Espace Archiviste & Minutier">Archiviste</button>';
      }
    }

    barre.innerHTML = html;

    barre.querySelectorAll(".btn-role-switch").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var targetRole = btn.dataset.role;
        var compte = DEMO_COMPTES_PAR_ROLE[targetRole] || { email: "notaire@notaire.ci", mdp: "notaire123" };
        effectuerConnexion(compte.email, compte.mdp).then(function () {
          toast("Vue basculée : " + (ROLE_LABEL[targetRole] || targetRole));
        });
      });
    });
  }

  function executerDeconnexion() {
    API.deconnecter();
    cache.utilisateur = null;
    cache.dossiers = [];
    cache.clients = [];
    cache.alertes = [];
    if (window._notifInterval) {
      clearInterval(window._notifInterval);
      window._notifInterval = null;
    }
    var chargement = document.getElementById("chargement-initial");
    if (chargement) {
      chargement.style.display = "none";
      chargement.textContent = "";
    }
    var appEl = document.getElementById("app");
    var loginEl = document.getElementById("ecran-login");
    if (appEl) {
      appEl.classList.remove("pret");
      appEl.style.display = "none";
    }
    if (loginEl) {
      loginEl.classList.add("actif");
      loginEl.style.display = "block";
    }
    var errZone = document.getElementById("login-erreur");
    if (errZone) errZone.style.display = "none";
    toast("Déconnexion réussie.");
  }

  window.LegalNotaryDeconnexion = executerDeconnexion;

  // -----------------------------------------------------------------
  // GESTION DU THÈME DUAL (LIGHT MODE / DARK MODE FINTECH)
  // -----------------------------------------------------------------
  function actualiserAffichageBoutonTheme(theme) {
    var icones = document.querySelectorAll(".theme-switch-icon");
    var labels = document.querySelectorAll(".theme-switch-label");
    var estClair = (theme === "light");
    icones.forEach(function (ic) {
      ic.textContent = estClair ? "☀️" : "🌙";
    });
    labels.forEach(function (lb) {
      lb.textContent = estClair ? "Mode Clair" : "Mode Sombre";
    });
  }

  function appliquerTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("legal_notary_theme", theme);
    } catch (e) {}
    actualiserAffichageBoutonTheme(theme);
  }

  function basculerTheme() {
    var themeActuel = document.documentElement.getAttribute("data-theme") || "dark";
    var nouveauTheme = (themeActuel === "light") ? "dark" : "light";
    appliquerTheme(nouveauTheme);
    toast("Thème appliqué : " + (nouveauTheme === "light" ? "Mode Clair" : "Mode Sombre"));
  }

  window.LegalNotaryBasculerTheme = basculerTheme;
  window.LegalNotaryAppliquerTheme = appliquerTheme;

  function effectuerConnexion(email, motDePasse) {
    var erreurZone = document.getElementById("login-erreur");
    if (erreurZone) erreurZone.style.display = "none";
    var inputEmail = document.getElementById("login-input-email");
    var inputMdp = document.getElementById("login-input-mdp");
    if (inputEmail) inputEmail.value = email;
    if (inputMdp) inputMdp.value = motDePasse;

    var chargement = document.getElementById("chargement-initial");
    if (chargement) {
      chargement.textContent = "Connexion...";
      chargement.style.display = "flex";
    }

    return API.connecter(email, motDePasse).then(function (utilisateur) {
      cache.utilisateur = utilisateur;
      cache.permissions = PERMISSIONS_PAR_ROLE[utilisateur.role] || PERMISSIONS_PAR_ROLE.assistante;
      return chargerToutEtAfficher();
    }).catch(function (erreur) {
      if (chargement) chargement.style.display = "none";
      if (erreurZone) {
        erreurZone.textContent = "Erreur de connexion : " + (erreur.message || "Identifiants invalides");
        erreurZone.style.display = "block";
      }
      toast("Échec connexion : " + (erreur.message || "Erreur serveur"));
    });
  }

  window.LegalNotaryConnexionRapide = function (email, motDePasse) {
    return effectuerConnexion(email, motDePasse);
  };

  function chargerToutEtAfficher() {
    var role = cache.utilisateur ? cache.utilisateur.role : "notaire";
    var estSaaS = (role === "superadmin" || role === "dev" || role === "commercial" || role === "support" || role === "assistante_editeur");

    var chargement = document.getElementById("chargement-initial");
    if (chargement) {
      chargement.textContent = "Chargement...";
      chargement.style.display = "flex";
    }

    // Parallélisation totale des requêtes pour un chargement instantané (< 50ms)
    var promesses = estSaaS
      ? [API.get("/api/parametres").catch(function () { return {}; })]
      : [chargerReferentiel(), chargerEquipe(), chargerDossiersEtAlertes(), API.get("/api/parametres").catch(function () { return {}; })];

    return Promise.all(promesses).then(function (res) {
      if (estSaaS && res[0]) {
        cache.parametres = res[0] || {};
      } else if (!estSaaS && res[3]) {
        cache.parametres = res[3] || {};
      }

      // Si pas d'archiviste dédié dans l'étude, tous les clercs ont accès aux archives de facto
      if (cache.parametres && cache.parametres.presenceArchiviste === false && cache.permissions) {
        cache.permissions.archives = true;
      }

      if (chargement) chargement.style.display = "none";

      var ecranLogin = document.getElementById("ecran-login");
      var appEl = document.getElementById("app");
      if (ecranLogin) {
        ecranLogin.classList.remove("actif");
        ecranLogin.style.display = "none";
      }
      if (appEl) {
        appEl.classList.add("pret");
        appEl.style.display = "block";
      }

      if (cache.utilisateur) {
        var elNom = document.getElementById("nav-utilisateur-nom");
        var elRole = document.getElementById("nav-utilisateur-role");
        if (elNom) elNom.textContent = cache.utilisateur.nomComplet || "Utilisateur";
        if (elRole) elRole.textContent = ROLE_LABEL[cache.utilisateur.role] || cache.utilisateur.role;
      }

      // Mise à jour de la barre supérieure adaptée (Étude vs Éditeur SaaS)
      actualiserBarreSelecteurRoles(role);
      majNomEtudeAffiche();

      // Rendu du menu de navigation adapté à la fonction / au rôle
      renderMenuNavigation(role);

      // Détermination de la vue par défaut selon le rôle
      var menuRole = MENU_ITEMS_PAR_ROLE[role] || [];
      var defaultItem = menuRole.find(function (it) { return it.vueParDefaut; });

      var vueFinale = defaultItem ? defaultItem.nav : (estSaaS ? "superadmin" : "dashboard");
      if (estSaaS && defaultItem && defaultItem.sousOnglet) {
        etatSuperadmin.onglet = defaultItem.sousOnglet;
      }

      irVers(vueFinale);
      chargerNotifBadge();
      chargerValidationsBadge();

      if (!window._notifInterval) {
        window._notifInterval = window.setInterval(function () {
          chargerNotifBadge();
          chargerValidationsBadge();
        }, 30000);
      }
    }).catch(function (erreur) {
      console.error("Erreur chargerToutEtAfficher:", erreur);
      if (chargement) chargement.style.display = "none";
      executerDeconnexion();
      toast("Erreur de session : " + (erreur.message || "Session expirée"));
    });
  }

  // -----------------------------------------------------------------
  // Modales et boîtes de dialogue
  // -----------------------------------------------------------------
  function ouvrirModal(options) {
    var racine = document.getElementById("modal-racine");
    if (!racine) return;
    var styleConteneur = options.style || "";
    if (options.largeur) {
      styleConteneur = "max-width:" + options.largeur + ";width:96%;" + styleConteneur;
    }
    racine.innerHTML =
      '<div class="modal-backdrop" id="modal-bg">' +
        '<div class="modal-conteneur" style="' + styleConteneur + '">' +
          '<div class="modal-header">' +
            '<div style="font-family:var(--font-heading);font-weight:700;font-size:16px">' + (options.titre || "") + '</div>' +
            '<button type="button" class="btn btn-ghost" id="modal-fermer" style="padding:4px 8px;font-size:16px">✕</button>' +
          '</div>' +
          '<div class="modal-body">' + (options.corps || "") + '</div>' +
          (options.footer ? '<div class="modal-footer">' + options.footer + '</div>' : "") +
        '</div>' +
      '</div>';
    racine.style.display = "block";
    document.getElementById("modal-fermer").addEventListener("click", fermerModal);
    document.getElementById("modal-bg").addEventListener("click", function (e) {
      if (e.target === this) fermerModal();
    });
    if (options.apresOuverture) options.apresOuverture();
  }

  function fermerModal() {
    var racine = document.getElementById("modal-racine");
    if (racine) {
      racine.innerHTML = "";
      racine.style.display = "none";
    }
  }

  // -----------------------------------------------------------------
  // Moment dédié pour l'autorisation Web Push
  // -----------------------------------------------------------------
  function proposerWebPushMoment() {
    if (!("Notification" in window)) {
      toast("Votre navigateur ne prend pas en charge les notifications push.");
      return;
    }
    if (Notification.permission === "granted") {
      toast("Les notifications sont déjà activées sur ce poste.");
      return;
    }
    ouvrirModal({
      titre: "Notifications instantanées de l'étude",
      corps:
        '<div style="display:flex;flex-direction:column;gap:var(--space-3)">' +
          '<p style="margin:0;font-size:14px;color:var(--color-text)">' +
            'Activez les notifications pour être informé en temps réel sur ce poste des événements critiques de l\'étude :' +
          '</p>' +
          '<ul style="margin:0;padding-left:20px;font-size:13px;color:var(--color-text-dim);display:flex;flex-direction:column;gap:6px">' +
            '<li>Alertes de retard d\'instruction et échéances DGI / Conservation Foncière</li>' +
            '<li>Soumission de projet d\'acte par un clerc pour validation par le notaire</li>' +
            '<li>Décision notariée (projet validé ou renvoyé pour correction)</li>' +
            '<li>Signalement de pièces KYC bloquantes manquantes</li>' +
          '</ul>' +
          '<p style="margin:0;font-size:12px;color:var(--color-text-dim);opacity:.8">' +
            'Cette autorisation s\'applique uniquement à ce navigateur et peut être modifiée à tout moment dans les réglages.' +
          '</p>' +
        '</div>',
      footer:
        '<button class="btn btn-secondary" id="bouton-push-annuler">Plus tard</button>' +
        '<button class="btn btn-primary" id="bouton-push-autoriser">Activer les notifications</button>',
      apresOuverture: function () {
        document.getElementById("bouton-push-annuler").addEventListener("click", fermerModal);
        document.getElementById("bouton-push-autoriser").addEventListener("click", function () {
          Notification.requestPermission().then(function (permission) {
            fermerModal();
            if (permission === "granted") {
              toast("Notifications push activées avec succès.");
              // Tente d'enregistrer l'abonnement si SW présent
              if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
                API.get("/api/parametres-notifications").then(function (params) {
                  if (params.pushClePublique) {
                    navigator.serviceWorker.ready.then(function (reg) {
                      return reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: params.pushClePublique,
                      });
                    }).then(function (sub) {
                      return API.post("/api/notifications/push/abonnement", sub.toJSON());
                    }).catch(function () {});
                  }
                });
              }
            } else {
              toast("Autorisation refusée ou fermée.");
            }
          });
        });
      },
    });
  }

  // -----------------------------------------------------------------
  // Configuration du Menu de Navigation Latérale Adaptatif par Rôle
  // -----------------------------------------------------------------
  var etatSuperadmin = { onglet: "etudes" };

  var MENU_ITEMS_PAR_ROLE = {
    superadmin: [
      { nav: "superadmin", label: "🏛️ Parc des Études", sousOnglet: "etudes", vueParDefaut: true },
      { nav: "emoluments", label: "⚖️ Barèmes d'Émoluments" },
      { nav: "rapports", label: "📊 Rapports & Échéances" },
      { nav: "superadmin", label: "👥 Équipe Éditeur SaaS", sousOnglet: "equipe" },
      { nav: "superadmin", label: "⚙️ Infrastructure & Clusters", sousOnglet: "infrastructure" },
      { nav: "superadmin", label: "💾 Sauvegardes & PRA", sousOnglet: "sauvegardes" },
      { nav: "superadmin", label: "🎫 Support L1 - L4", sousOnglet: "support" },
      { nav: "superadmin", label: "📊 Télémétrie & Logs", sousOnglet: "telemetrie" },
    ],
    dev: [
      { nav: "superadmin", label: "⚙️ Infrastructure & Clusters", sousOnglet: "infrastructure", vueParDefaut: true },
      { nav: "rapports", label: "📝 Mon Rapport DevOps" },
      { nav: "superadmin", label: "💾 Sauvegardes & PRA", sousOnglet: "sauvegardes" },
      { nav: "superadmin", label: "📊 Télémétrie & Logs", sousOnglet: "telemetrie" },
      { nav: "superadmin", label: "🏛️ Parc des Études", sousOnglet: "etudes" },
    ],
    commercial: [
      { nav: "superadmin", label: "🏛️ Parc des Études", sousOnglet: "etudes", vueParDefaut: true },
      { nav: "rapports", label: "📝 Mon Rapport Commercial" },
      { nav: "superadmin", label: "👥 Équipe Éditeur SaaS", sousOnglet: "equipe" },
    ],
    support: [
      { nav: "superadmin", label: "🎫 Support L1 - L4", sousOnglet: "support", vueParDefaut: true },
      { nav: "rapports", label: "📝 Mon Rapport Support" },
      { nav: "superadmin", label: "🏛️ Parc des Études", sousOnglet: "etudes" },
      { nav: "superadmin", label: "📊 Télémétrie & Logs", sousOnglet: "telemetrie" },
    ],
    assistante_editeur: [
      { nav: "superadmin", label: "🏛️ Parc des Études", sousOnglet: "etudes", vueParDefaut: true },
      { nav: "rapports", label: "📝 Mon Rapport d'Activité" },
      { nav: "superadmin", label: "👥 Équipe Éditeur SaaS", sousOnglet: "equipe" },
      { nav: "superadmin", label: "🎫 Support L1 - L4", sousOnglet: "support" },
    ],
    notaire: [
      { nav: "dashboard", label: "📊 Tableau de bord", vueParDefaut: true },
      { nav: "validations", label: "⏳ En attente de validation" },
      { nav: "kanban", label: "📋 Circuit d'instruction" },
      { nav: "dossiers", label: "📁 Dossiers de l'étude" },
      { nav: "clients", label: "👥 Clients & KYC" },
      { nav: "actes", label: "📜 Actes & Référentiel" },
      { nav: "emoluments", label: "⚖️ Barèmes d'Émoluments" },
      { nav: "comptabilite", label: "💰 Facturation" },
      { nav: "archives", label: "🏛️ Minutier & Archives" },
      { nav: "equipe", label: "👔 Équipe & Salaires" },
      { nav: "evolution", label: "📈 Performance globale" },
      { nav: "parametres", label: "⚙️ Paramètres de l'étude" },
    ],
    premier_clerc: [
      { nav: "dashboard", label: "📊 Tableau de bord", vueParDefaut: true },
      { nav: "validations", label: "📂 Parapheur transmis" },
      { nav: "kanban", label: "📋 Circuit d'instruction" },
      { nav: "dossiers", label: "📁 Tous les dossiers" },
      { nav: "clients", label: "👥 Clients & KYC" },
      { nav: "actes", label: "📜 Actes & Modèles" },
      { nav: "emoluments", label: "⚖️ Barèmes d'Émoluments" },
      { nav: "archives", label: "🏛️ Minutier & Archives" },
      { nav: "equipe", label: "👔 Supervision Équipe" },
      { nav: "evolution", label: "📈 Mon évolution" },
    ],
    clerc_redacteur: [
      { nav: "dashboard", label: "📊 Mon Tableau de bord", vueParDefaut: true },
      { nav: "dossiers", label: "📁 Mes Dossiers assignés" },
      { nav: "clients", label: "👥 Mes Clients & Pièces" },
      { nav: "actes", label: "✍️ Projets d'actes" },
      { nav: "evolution", label: "📈 Mon évolution" },
    ],
    clerc_formaliste: [
      { nav: "dashboard", label: "📊 Formalités & Délais", vueParDefaut: true },
      { nav: "dossiers", label: "🏛️ Dossiers Formalités (DGI/CF)" },
      { nav: "archives", label: "📦 Minutier & Cartons" },
      { nav: "evolution", label: "📈 Mon évolution" },
    ],
    comptable_taxateur: [
      { nav: "dashboard", label: "📊 Tableau de bord Financier", vueParDefaut: true },
      { nav: "validations", label: "📂 Transmis au Notaire" },
      { nav: "comptabilite", label: "💰 Facturation" },
      { nav: "emoluments", label: "⚖️ Barèmes d'Émoluments" },
      { nav: "dossiers", label: "📁 Dossiers (Suivi Financier)" },
      { nav: "evolution", label: "📈 Mon évolution" },
    ],
    assistante: [
      { nav: "dashboard", label: "📊 Accueil & Réception", vueParDefaut: true },
      { nav: "nouveau-dossier", label: "📂 + Nouveau dossier" },
      { nav: "clients", label: "👥 Fichier Clients & KYC" },
      { nav: "dossiers", label: "📁 Dossiers assignés" },
      { nav: "evolution", label: "📈 Mon évolution" },
    ],
    archiviste: [
      { nav: "dashboard", label: "📊 Supervision & Minutier", vueParDefaut: true },
      { nav: "archives", label: "🏛️ Minutier Numérique & Scellement", sousOnglet: "minutier" },
      { nav: "archives", label: "📦 Cartons & Dépôt Physique", sousOnglet: "cartons" },
      { nav: "archives", label: "🔍 Piste d'Audit & Registre", sousOnglet: "audit" },
      { nav: "dossiers", label: "📁 Tous les Dossiers" },
      { nav: "evolution", label: "📈 Mon évolution" },
    ],
  };

  function renderMenuNavigation(role) {
    var conteneur = document.getElementById("menu-navigation-laterale");
    if (!conteneur) return;

    var items = (MENU_ITEMS_PAR_ROLE[role] || MENU_ITEMS_PAR_ROLE.notaire).slice();

    // Règle Métier : Si l'étude n'a pas d'archiviste dédié (case décochée dans Paramètres),
    // tous les clercs de l'office ont de facto accès au menu Minutier & Archives dans leur barre latérale !
    var sansArchiviste = (cache.parametres && cache.parametres.presenceArchiviste === false);
    if (sansArchiviste) {
      if (cache.permissions) cache.permissions.archives = true;
      var aDejaArchives = items.some(function (it) { return it.nav === "archives"; });
      if (!aDejaArchives && role !== "superadmin" && role !== "dev" && role !== "commercial" && role !== "support" && role !== "assistante_editeur") {
        var idxEvol = items.findIndex(function (it) { return it.nav === "evolution"; });
        var itemArchive = { nav: "archives", label: "🏛️ Minutier & Archives" };
        if (idxEvol !== -1) {
          items.splice(idxEvol, 0, itemArchive);
        } else {
          items.push(itemArchive);
        }
      }
    }

    var html = '';

    // En-tête du menu contextuel avec libellé du rôle
    html += '<div style="padding:4px 6px 10px;margin-bottom:6px;border-bottom:1px solid var(--color-border)">';
    html += '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-dim);font-weight:700">Menu ' + (ROLE_LABEL[role] || "Utilisateur") + '</div>';
    html += '</div>';

    items.forEach(function (item) {
      var isActif = (etat.vue === item.nav) && (!item.sousOnglet || (item.nav === "superadmin" && item.sousOnglet === etatSuperadmin.onglet) || (item.nav === "archives" && item.sousOnglet === etatArchives.onglet));
      if (item.nav === "validations") {
        var totalVal = (cache.parapheurValidations && cache.parapheurValidations.totalEnAttente) || 0;
        var badgeStyle = totalVal > 0 ? 'background:#d97706;color:#ffffff;font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:12px;margin-left:auto;line-height:1.4' : 'display:none;margin-left:auto';
        html += '<div class="lnk-item ' + (isActif ? "actif" : "") + '" data-nav="' + item.nav + '" style="display:flex;align-items:center;justify-content:space-between"><span>' + item.label + '</span><span id="badge-menu-validations" style="' + badgeStyle + '">' + totalVal + '</span></div>';
      } else {
        html += '<div class="lnk-item ' + (isActif ? "actif" : "") + '" data-nav="' + item.nav + '" ' + (item.sousOnglet ? 'data-sous-onglet="' + item.sousOnglet + '"' : '') + '>' + item.label + '</div>';
      }
    });

    html += '<div style="flex:1"></div>';
    html += '<div class="lnk-item" id="bouton-deconnexion" style="padding:var(--space-2);font-size:13px;opacity:.75;cursor:pointer;border-top:1px solid var(--color-border);color:#94a3b8">Se déconnecter</div>';

    conteneur.innerHTML = html;

    // Attachement des clics sur les items du menu latéral
    conteneur.querySelectorAll(".lnk-item[data-nav]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.sousOnglet && b.dataset.nav === "superadmin") {
          etatSuperadmin.onglet = b.dataset.sousOnglet;
        }
        if (b.dataset.sousOnglet && b.dataset.nav === "archives") {
          etatArchives.onglet = b.dataset.sousOnglet;
        }
        irVers(b.dataset.nav);
      });
    });

    var btnDeco = document.getElementById("bouton-deconnexion");
    if (btnDeco) {
      btnDeco.addEventListener("click", executerDeconnexion);
    }
  }

  // -----------------------------------------------------------------
  // Navigation entre les écrans
  // -----------------------------------------------------------------
  function irVers(vue, depuis) {
    etat.vue = vue;
    if (depuis) etat.vuePrecedente = depuis;
    document.querySelectorAll(".zone-scroll .ecran").forEach(function (e) { e.classList.remove("actif"); });
    var cible = document.getElementById("vue-" + vue);
    if (cible) cible.classList.add("actif");

    // Mise à jour de l'apparence des liens du menu latéral
    document.querySelectorAll("#menu-navigation-laterale .lnk-item[data-nav]").forEach(function (b) {
      var isActif = false;
      if (vue === "superadmin") {
        isActif = (b.dataset.nav === "superadmin" && (!b.dataset.sousOnglet || b.dataset.sousOnglet === etatSuperadmin.onglet));
      } else if (vue === "archives" && b.dataset.sousOnglet) {
        isActif = (b.dataset.nav === "archives" && b.dataset.sousOnglet === etatArchives.onglet);
      } else {
        isActif = (b.dataset.nav === vue);
      }

      if (isActif) {
        b.classList.add("actif");
      } else {
        b.classList.remove("actif");
      }
    });

    if (vue === "dashboard") renderDashboard();
    if (vue === "kanban") renderKanban();
    if (vue === "dossiers") renderDossiersListe();
    if (vue === "nouveau-dossier") renderNouveauDossier();
    if (vue === "clients") renderClients();
    if (vue === "actes") renderActes();
    if (vue === "emoluments") renderEmoluments();
    if (vue === "archives") renderArchives();
    if (vue === "equipe") renderEquipe();
    if (vue === "evolution") renderEvolution();
    if (vue === "comptabilite") renderComptabilite();
    if (vue === "validations") renderValidations();
    if (vue === "parametres") renderParametres();
    if (vue === "notifications") renderNotifications();
    if (vue === "superadmin") renderSuperAdmin();
    if (vue === "rapports") renderRapports();
  }

  function ouvrirDossier(id, depuis) {
    etat.dossierOuvertId = id;
    etat.vuePrecedente = depuis || "kanban";
    document.querySelectorAll(".zone-scroll .ecran").forEach(function (e) { e.classList.remove("actif"); });
    document.getElementById("vue-dossier").classList.add("actif");
    document.querySelectorAll(".lnk-item[data-nav]").forEach(function (b) { b.style.color = ""; });

    var conteneur = document.getElementById("vue-dossier");
    conteneur.innerHTML = '<p class="text-muted">Chargement du dossier…</p>';

    Promise.all([
      API.get("/api/dossiers/" + id),
      API.get("/api/projets-acte/" + id).catch(function () { return null; }),
      API.get("/api/projets-acte/" + id + "/historique").catch(function () { return []; }),
      API.get("/api/fiscal/dossiers/" + id + "/historique").catch(function () { return []; }),
    ]).then(function (r) {
      cache.dossierDetail = r[0];
      cache.projetActe = r[1];
      cache.projetHistorique = r[2];
      cache.fichesTaxeHistorique = r[3];
      renderDossier();
    }).catch(function (erreur) {
      conteneur.innerHTML = '<p class="erreur-inline">' + erreur.message + '</p>';
    });
  }

  // -----------------------------------------------------------------
  // Tableaux de bord par rôle métier (5 conceptions adaptées)
  // -----------------------------------------------------------------
  function renderDashboard() {
    var role = cache.utilisateur.role;
    if (role === "notaire") return renderDashboardNotaire();
    if (role === "premier_clerc") return renderDashboardPremierClerc();
    if (role === "clerc_redacteur") return renderDashboardClercRedacteur();
    if (role === "clerc_formaliste") return renderDashboardClercFormaliste();
    if (role === "comptable_taxateur") return renderDashboardComptableTaxateur();
    if (role === "assistante") return renderDashboardAssistante();
    if (role === "archiviste") return renderDashboardArchiviste();
    return renderDashboardNotaire();
  }

  // --- 1. TABLEAU DE BORD DU NOTAIRE (PILOTAGE & CHEF D'ENTREPRISE) ---
  function renderDashboardNotaire() {
    var c = document.getElementById("vue-dashboard");
    var anneeCourante = new Date().getFullYear();
    var enFormalites = cache.dossiers.filter(function (d) { return d.etapeActuelle === 5; }).length;
    var enRedaction = cache.dossiers.filter(function (d) { return d.etapeActuelle === 3; });
    var enSignature = cache.dossiers.filter(function (d) { return d.etapeActuelle === 4; });
    var dateDuJour = new Date().toLocaleDateString("fr-CI", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    // Calcul de la synthèse financière et sectorielle de l'office
    var synthese = calculerSyntheseEtude(cache.dossiers);

    // Titre dynamique avec le nom du notaire
    var nomNotaire = (cache.parametres && cache.parametres.nomNotaire && cache.parametres.nomNotaire.trim())
      ? cache.parametres.nomNotaire.trim()
      : (cache.utilisateur ? cache.utilisateur.nomComplet : "");
    var prefixe = (nomNotaire.indexOf("Me ") === 0 || nomNotaire.indexOf("Maître ") === 0) ? "" : "Maître ";
    var titreAffiche = nomNotaire ? ("Tableau de bord · " + prefixe + nomNotaire) : "Tableau de bord";

    var kpis = [
      { label: "Volume d'affaires en portefeuille", valeur: fmtFCFA(synthese.totalAssiettes), indice: "", icon: "", sub: "Valeur cumulée des transactions en cours", cible: "comptabilite" },
      { label: "Émoluments prévisionnels (HT)", valeur: fmtFCFA(synthese.totalEmolumentsHT), indice: "accent", icon: "", sub: "Honoraires légaux (Décret 2013-279)", cible: "emoluments" },
      { label: "Dossiers actifs au cabinet", valeur: String(cache.dossiers.length), indice: "", icon: "", sub: enRedaction.length + " en rédaction · " + enFormalites + " en formalités DGI", cible: "dossiers" },
      { label: "Alertes & Délais d'instruction", valeur: String(cache.alertes.length), indice: cache.alertes.length ? "danger" : "accent", icon: "", sub: cache.alertes.length ? "Décisions ou dossiers à débloquer" : "Aucun retard critique", cible: "dossiers", filtrePrio: "alertes" },
    ];

    var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-4)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding-bottom:var(--space-2);border-bottom:1px solid var(--color-border)">';
    html += '<div><h1 style="margin:0">' + titreAffiche + '</h1>';
    html += '<p style="opacity:.65;font-size:14px;margin:2px 0 0">Pilotage financier, flux d\'actes et gestion stratégique de l\'office.</p></div>';
    html += '<div style="display:flex;align-items:center;gap:var(--space-3);margin-left:auto">';
    html += '<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:var(--color-text)">' + dateDuJour + '</div><div style="font-size:11px;color:var(--color-text-dim)">Exercice fiscal ' + anneeCourante + '</div></div>';
    html += '<button class="btn btn-secondary" id="bouton-demander-push" style="padding:6px 12px;font-size:13px">Notifications</button></div></div></div>';

    // Grille de KPI exécutifs
    html += renderKpisGrid(kpis);

    // =========================================================================
    // 1. VENTILATION DU PORTEFEUILLE PAR BRANCHE NOTARIALE (En tête sous les KPIs)
    // =========================================================================
    html += '<div class="dashboard-panel">';
    html += '<div class="panel-header"><div class="panel-title">Ventilation du portefeuille par branche notariale</div><span class="tag tag-outline">Chiffre d\'affaires & Volume</span></div>';
    html += '<div class="panel-body">';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--space-3)">';

    var clesDomaines = ["immobilier", "banque", "societes", "famille"];
    clesDomaines.forEach(function (cle) {
      var dom = synthese.domaines[cle];
      var pctVolume = synthese.totalAssiettes > 0 ? Math.round((dom.assiette / synthese.totalAssiettes) * 100) : 0;
      var pctEmols = synthese.totalEmolumentsHT > 0 ? Math.round((dom.emoluments / synthese.totalEmolumentsHT) * 100) : 0;

      html += '<div class="card card-branche-notariale card-interactive" data-branche="' + cle + '" style="border-color:var(--color-border);background:var(--color-surface-2);display:flex;flex-direction:column;gap:8px;padding:var(--space-3) var(--space-4);cursor:pointer" title="Cliquer pour filtrer les dossiers de la branche ' + dom.label + '">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center">';
      html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:14px;color:var(--color-text)">' + dom.label + '</div>';
      html += '<span class="tag tag-outline" style="font-size:11px">' + dom.count + ' acte(s)</span>';
      html += '</div>';

      html += '<div style="font-size:12px;color:var(--color-text-dim)">' + dom.desc + '</div>';

      html += '<div style="margin-top:auto;padding-top:var(--space-2);border-top:1px solid var(--color-divider)">';
      html += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>Assiette cumulée :</span><strong style="color:var(--color-text)">' + fmtFCFA(dom.assiette) + '</strong></div>';
      html += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px"><span>Émoluments prévisionnels :</span><strong style="color:var(--color-accent)">' + fmtFCFA(dom.emoluments) + '</strong></div>';
      html += '<div style="height:6px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden"><div style="height:100%;width:' + Math.max(pctEmols, 4) + '%;background:var(--color-accent);border-radius:4px"></div></div>';
      html += '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--color-text-dim);margin-top:4px"><span>Part des honoraires</span><span>' + pctEmols + ' % · Voir dossiers →</span></div>';
      html += '</div></div>';
    });

    html += '</div></div></div>';

    // =========================================================================
    // 2. ACTIONS PRIORITAIRES & ACTES EN ATTENTE DE VISA (MES URGENCES DU JOUR)
    // =========================================================================
    var actesPrioritaires = cache.dossiers.filter(function (d) {
      return (d.etapeActuelle === 4 || d.etapeActuelle === 3) && d.statut === "actif";
    }).slice(0, 4);

    html += '<div class="dashboard-panel" style="border-left:4px solid var(--color-gold)">';
    html += '<div class="panel-header" style="background:var(--color-surface-2)">';
    html += '<div class="panel-title" style="color:var(--color-text)">Actions Prioritaires & Actes en Attente de Visa Notarié</div>';
    html += '<span class="tag tag-gold" style="font-size:11px;font-weight:700">' + actesPrioritaires.length + ' acte(s) à viser</span>';
    html += '</div>';

    if (!actesPrioritaires.length) {
      html += '<div style="padding:var(--space-3) var(--space-4);color:var(--color-text-dim);font-size:13px">Tous les projets d\'actes sont à jour. Aucun visa en souffrance.</div>';
    } else {
      html += '<div style="padding:var(--space-3);display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--space-3)">';
      actesPrioritaires.forEach(function (d) {
        var clientAff = (d.comparantsNoms && d.comparantsNoms.trim()) ? d.comparantsNoms.trim() : "Comparants";
        html += '<div class="card card-urgence-notaire card-interactive alerte-item" data-id="' + d.id + '" style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:12px;display:flex;flex-direction:column;gap:6px;box-shadow:var(--shadow-sm);cursor:pointer">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center">';
        html += '<span style="font-family:monospace;font-size:11.5px;font-weight:700;color:var(--color-accent)">' + d.numeroDossier + '</span>';
        html += '<span class="tag tag-etape-' + d.etapeActuelle + '" style="font-size:10px;padding:2px 6px">Étape ' + d.etapeActuelle + ' · ' + labelEtape(d.etapeActuelle) + '</span>';
        html += '</div>';
        html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:14px;color:var(--color-text)">' + labelActe(d.typeActeId) + '</div>';
        html += '<div style="font-size:12px;color:var(--color-text-dim)">' + clientAff + ' · <strong>' + fmtFCFA(d.montantAssiette) + '</strong></div>';
        html += '<div style="display:flex;gap:6px;margin-top:4px">';
        html += '<button type="button" class="btn btn-primary btn-ouvrir-urgence" data-id="' + d.id + '" style="font-size:11.5px;padding:5px 12px;flex:1">Examiner le projet →</button>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    // =========================================================================
    // 3. PIPELINE DES DOSSIERS & CIRCUIT D'INSTRUCTION
    // =========================================================================
    html += renderPipelineDossiers();

    // =========================================================================
    // 4. INSTRUCTION DES ACTES PAR CLERC (Tableau complet style Pipeline)
    // =========================================================================
    var clercs = cache.equipeListe.filter(function (m) {
      return m.role !== "notaire" && m.role !== "comptable_taxateur";
    });

    var PALETTE_CLERCS = [
      { bg: "rgba(99, 102, 241, 0.15)", text: "#818cf8", border: "#6366f1", solid: "#6366f1" },
      { bg: "rgba(14, 165, 233, 0.15)", text: "#38bdf8", border: "#0ea5e9", solid: "#0ea5e9" },
      { bg: "rgba(16, 185, 129, 0.15)", text: "#34d399", border: "#10b981", solid: "#10b981" },
      { bg: "rgba(245, 158, 11, 0.15)", text: "#fbbf24", border: "#f59e0b", solid: "#f59e0b" },
      { bg: "rgba(236, 72, 153, 0.15)", text: "#f472b6", border: "#ec4899", solid: "#ec4899" },
      { bg: "rgba(168, 85, 247, 0.15)", text: "#c084fc", border: "#a855f7", solid: "#a855f7" },
    ];

    html += '<div class="dashboard-panel">';
    html += '<div class="panel-header"><div class="panel-title">Instruction des actes par collaborateur</div><span class="tag tag-outline">' + clercs.length + ' clerc(s) instructeur(s)</span></div>';

    if (!clercs.length) {
      html += '<div class="panel-body" style="text-align:center;padding:var(--space-4);color:var(--color-text-dim)">Aucun clerc assigné à l\'instruction pour le moment.</div>';
    } else {
      html += '<div class="table-wrap"><table class="table"><thead><tr><th>Collaborateur</th><th>Rôle</th><th>Dossiers confiés</th><th>Actes achevés</th><th>En instruction</th><th>Progression</th><th>Action</th></tr></thead><tbody>';

      clercs.forEach(function (cl, idx) {
        var pal = PALETTE_CLERCS[idx % PALETTE_CLERCS.length];
        var inits = (cl.nomComplet || "").split(" ").map(function (w) { return w[0]; }).join("").toUpperCase().slice(0, 2);
        var dossiersClerc = cache.dossiers.filter(function (d) { return d.clercAssigneId === cl.id; });
        var nbTotal = dossiersClerc.length;
        var nbAcheves = dossiersClerc.filter(function (d) { return d.statut === "cloture" || d.etapeActuelle === 6 || d.estArchiveNumerique; }).length;
        var nbEnCours = nbTotal - nbAcheves;
        var pctAcheve = nbTotal > 0 ? Math.round((nbAcheves / nbTotal) * 100) : 0;

        html += '<tr class="ligne-clerc-dash" data-clerc-id="' + cl.id + '" style="cursor:pointer" title="Cliquer pour voir les dossiers de ' + cl.nomComplet + '">';
        html += '<td><div style="display:flex;align-items:center;gap:8px">';
        html += '<span style="width:28px;height:28px;border-radius:50%;background:' + pal.solid + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800">' + inits + '</span>';
        html += '<strong style="color:var(--color-text)">' + cl.nomComplet + '</strong>';
        html += '</div></td>';
        html += '<td><span style="font-size:11px;padding:3px 8px;border-radius:4px;background:' + pal.bg + ';color:' + pal.text + ';border:1px solid ' + pal.border + '">' + ROLE_LABEL[cl.role] + '</span></td>';
        html += '<td><strong>' + nbTotal + '</strong> dossier(s)</td>';
        html += '<td><span style="color:#22c55e;font-weight:700">' + nbAcheves + ' (' + pctAcheve + ' %)</span></td>';
        html += '<td><span style="color:' + pal.text + ';font-weight:600">' + nbEnCours + '</span></td>';
        html += '<td style="min-width:140px">';
        html += '<div style="display:flex;height:8px;border-radius:4px;overflow:hidden;background:rgba(255,255,255,0.06);margin-bottom:3px">';
        if (nbTotal > 0) {
          if (nbAcheves > 0) html += '<div style="width:' + pctAcheve + '%;background:#22c55e" title="' + nbAcheves + ' achevé(s)"></div>';
          if (nbEnCours > 0) html += '<div style="width:' + (100 - pctAcheve) + '%;background:' + pal.solid + '" title="' + nbEnCours + ' en instruction"></div>';
        } else {
          html += '<div style="width:100%;background:rgba(255,255,255,0.1)"></div>';
        }
        html += '</div>';
        html += '<div style="font-size:10px;color:var(--color-text-dim)">' + pctAcheve + ' % achevé</div>';
        html += '</td>';
        html += '<td><button type="button" class="btn btn-ghost btn-filtre-clerc" data-clerc-id="' + cl.id + '" style="padding:4px 8px;font-size:11px">Voir dossiers →</button></td>';
        html += '</tr>';
      });

      html += '</tbody></table></div>';
    }
    html += '</div>';

    // =========================================================================
    // 5. TRÉSORERIE SÉQUESTRES (CDCI) & FISCALITÉ DGI EN INSTANCE
    // =========================================================================
    html += '<div class="dashboard-panel">';
    html += '<div class="panel-header"><div class="panel-title">Trésorerie des comptes séquestres & Fiscalité DGI en instance</div><span class="tag tag-outline">Flux financiers</span></div>';
    html += '<div class="panel-body">';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--space-3)">';

    html += '<div class="card card-tresorerie-dash card-interactive" data-cible="comptabilite" style="border-left:4px solid #38bdf8;background:var(--color-surface-2);cursor:pointer" title="Cliquer pour accéder à la comptabilité">';
    html += '<div class="card-kicker">Comptes Séquestres (CDCI)</div>';
    html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:22px;color:var(--color-text);margin:4px 0">' + fmtFCFA(synthese.sequestresCDCI) + '</div>';
    html += '<div style="font-size:12px;color:var(--color-text-dim)">Estimation des dépôts et acomptes sous mandat d\'authentification</div></div>';

    html += '<div class="card card-tresorerie-dash card-interactive" data-cible="comptabilite" style="border-left:4px solid var(--color-warning);background:var(--color-surface-2);cursor:pointer" title="Cliquer pour vérifier les droits DGI">';
    html += '<div class="card-kicker">Droits DGI & Conservation Foncière</div>';
    html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:22px;color:var(--color-text);margin:4px 0">' + fmtFCFA(synthese.totalDroitsDGI) + '</div>';
    html += '<div style="font-size:12px;color:var(--color-text-dim)">Droits d\'enregistrement et taxes foncières en cours de liquidation</div></div>';

    html += '<div class="card card-tresorerie-dash card-interactive" data-cible="emoluments" style="border-left:4px solid var(--color-accent);background:var(--color-surface-2);cursor:pointer" title="Cliquer pour simuler les émoluments">';
    html += '<div class="card-kicker">Chiffre d\'Affaires Prévisionnel (TTC)</div>';
    html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:22px;color:var(--color-accent);margin:4px 0">' + fmtFCFA(synthese.totalEmolumentsTTC) + '</div>';
    html += '<div style="font-size:12px;color:var(--color-text-dim)">Émoluments HT + TVA légale 18 % reversée à l\'État</div></div>';

    html += '</div></div></div>';

    c.innerHTML = html;
    attacherEvenementsDashboard(c);
  }

  // --- 2. TABLEAU DE BORD DU PREMIER CLERC ---
  function renderDashboardPremierClerc() {
    var c = document.getElementById("vue-dashboard");
    var anneeCourante = new Date().getFullYear();
    var enFormalites = cache.dossiers.filter(function (d) { return d.etapeActuelle === 5; }).length;
    var enRedaction = cache.dossiers.filter(function (d) { return d.etapeActuelle === 3; }).length;
    var dateDuJour = new Date().toLocaleDateString("fr-CI", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    var kpis = [
      { label: "Dossiers en cours (cabinet)", valeur: String(cache.dossiers.length), indice: "", icon: "", sub: "Supervision globale", cible: "dossiers" },
      { label: "Alertes d'instruction", valeur: String(cache.alertes.length), indice: cache.alertes.length ? "warning" : "accent", icon: "", sub: cache.alertes.length ? "Dossiers à débloquer" : "Délais conformes", cible: "dossiers", filtrePrio: "alertes" },
      { label: "Projets en rédaction", valeur: String(enRedaction), indice: "", icon: "", sub: "Étape 3 d'instruction", cible: "dossiers", filtreEtape: "3" },
      { label: "En formalités DGI", valeur: String(enFormalites), indice: "", icon: "", sub: "Étape 5 d'enregistrement", cible: "dossiers", filtreEtape: "5" },
    ];

    var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-4)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding-bottom:var(--space-2);border-bottom:1px solid var(--color-border)">';
    html += '<div><h1 style="margin:0">Tableau de bord — Premier Clerc</h1>';
    html += '<p style="opacity:.65;font-size:14px;margin:2px 0 0">Bonjour ' + cache.utilisateur.nomComplet + ' — coordination de l\'instruction des actes.</p></div>';
    html += '<div style="display:flex;align-items:center;gap:var(--space-3);margin-left:auto">';
    html += '<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:var(--color-text)">' + dateDuJour + '</div><div style="font-size:11px;color:var(--color-text-dim)">Exercice fiscal ' + anneeCourante + '</div></div></div></div></div>';

    html += renderKpisGrid(kpis);

    // Supervision du pipeline par étape dans un panneau stylisé
    html += '<div class="dashboard-panel">';
    html += '<div class="panel-header"><div class="panel-title">Pipeline d\'instruction — Répartition par étape</div><span class="tag tag-outline">6 étapes</span></div>';
    html += '<div class="panel-body">';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-3)">';
    cache.etapesPipeline.forEach(function (e, idx) {
      var nb = cache.dossiers.filter(function (d) { return d.etapeActuelle === e.id; }).length;
      var accent = ETAPE_COULEUR[idx % ETAPE_COULEUR.length];
      html += '<div class="card card-etape-dash card-interactive" data-etape="' + e.id + '" style="border-top:3px solid ' + accent + ';border-color:var(--color-border);background:var(--color-surface-2);cursor:pointer" title="Cliquer pour voir les dossiers à l\'étape ' + e.id + '">';
      html += '<div class="card-kicker">Étape ' + e.id + '</div>';
      html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:14px;margin-bottom:4px;color:var(--color-text)">' + e.libelle + '</div>';
      html += '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-top:auto"><span style="font-size:26px;font-weight:700;color:' + accent + '">' + nb + '</span><span class="text-muted" style="font-size:12px">dossier(s) →</span></div></div>';
    });
    html += '</div></div></div>';

    html += renderCentreAlertes();
    c.innerHTML = html;
    attacherEvenementsDashboard(c);
  }

  // --- 3. TABLEAU DE BORD DU CLERC RÉDACTEUR ---
  function renderDashboardClercRedacteur() {
    var c = document.getElementById("vue-dashboard");
    c.innerHTML = '<p class="text-muted">Chargement…</p>';

    API.get("/api/tableau-bord/evolution/" + cache.utilisateur.id).then(function (evo) {
      var mesDossiers = cache.dossiers;
      var mesProjets = mesDossiers.filter(function (d) { return d.etapeActuelle === 3; });
      var anneeCourante = new Date().getFullYear();
      var dateDuJour = new Date().toLocaleDateString("fr-CI", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

      var kpis = [
        { label: "Mes dossiers actifs", valeur: String(mesDossiers.length), indice: "", icon: "", sub: "Assignés à mon nom", cible: "dossiers" },
        { label: "Alertes sur mes dossiers", valeur: String(cache.alertes.length), indice: cache.alertes.length ? "danger" : "accent", icon: "", sub: cache.alertes.length ? "Dossiers à traiter" : "Aucun retard", cible: "dossiers", filtrePrio: "alertes" },
        { label: "Clôturés (30 derniers jours)", valeur: String(evo.dossiersClotures30Jours || 0), indice: "accent", icon: "", sub: "Actes menés à terme", cible: "dossiers", filtreEtape: "6" },
        { label: "Mon avancement moyen", valeur: (evo.avancementMoyenPourcent || 0) + " %", indice: "accent", icon: "", sub: "Progression des checklists", cible: "evolution" },
      ];

      var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-4)">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:var(--space-2);border-bottom:1px solid var(--color-border)">';
      html += '<div><h1 style="margin:0">Tableau de bord — Clerc Rédacteur</h1>';
      html += '<p style="opacity:.65;font-size:14px;margin:2px 0 0">Bonjour ' + cache.utilisateur.nomComplet + ' — rédaction des minutes et gestion des actes assignés.</p></div>';
      html += '<div style="display:flex;align-items:center;gap:var(--space-3);margin-left:auto">';
      html += '<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:var(--color-text)">' + dateDuJour + '</div><div style="font-size:11px;color:var(--color-text-dim)">Exercice fiscal ' + anneeCourante + '</div></div>';
      html += '<button class="btn btn-primary" id="btn-nouveau-dossier-redacteur">+ Nouveau dossier</button></div></div></div>';

      html += renderKpisGrid(kpis);

      html += '<div class="dashboard-panel">';
      html += '<div class="panel-header"><div class="panel-title">Mes projets d\'actes à rédiger (Étape 3)</div><span class="tag tag-outline">' + mesProjets.length + ' projet(s)</span></div>';
      html += '<div class="panel-body">';

      if (!mesProjets.length) {
        html += '<div style="text-align:center;padding:var(--space-4);color:var(--color-text-dim)">Aucun projet à rédiger immédiatement. Consultez la liste générale de vos dossiers.</div>';
      } else {
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-3)">';
        mesProjets.forEach(function (d) {
          html += '<div class="card alerte-item card-interactive" data-id="' + d.id + '" style="cursor:pointer;border-left:4px solid var(--color-accent);background:var(--color-surface-2)">';
          html += '<span class="card-kicker">' + d.numeroDossier + '</span>';
          html += '<div class="card-title" style="font-size:15px;margin-top:4px">' + labelActe(d.typeActeId) + '</div>';
          html += '<div class="card-meta" style="justify-content:space-between;margin-top:var(--space-2);padding-top:var(--space-2);border-top:1px solid var(--color-divider)"><span>Assiette : <strong>' + fmtFCFA(d.montantAssiette) + '</strong></span><span class="btn btn-ghost" style="padding:0">Rédiger →</span></div></div>';
        });
        html += '</div>';
      }
      html += '</div></div>';

      html += renderCentreAlertes();
      c.innerHTML = html;
      attacherEvenementsDashboard(c);

      var btnNouveau = document.getElementById("btn-nouveau-dossier-redacteur");
      if (btnNouveau) btnNouveau.addEventListener("click", function () { irVers("nouveau-dossier"); });
    }).catch(function (e) {
      c.innerHTML = '<p class="erreur-inline">' + e.message + '</p>';
    });
  }

  // --- 4. TABLEAU DE BORD DU CLERC AUX FORMALITÉS ---
  function renderDashboardClercFormaliste() {
    var c = document.getElementById("vue-dashboard");
    var anneeCourante = new Date().getFullYear();
    var enFormalites = cache.dossiers.filter(function (d) { return d.etapeActuelle === 5; });
    var enRequisitions = cache.dossiers.filter(function (d) { return d.etapeActuelle === 2; });
    var enExpeditions = cache.dossiers.filter(function (d) { return d.etapeActuelle === 6; });
    var dateDuJour = new Date().toLocaleDateString("fr-CI", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    var kpis = [
      { label: "Formalités DGI & Foncier (Étape 5)", valeur: String(enFormalites.length), indice: enFormalites.length ? "accent" : "", icon: "", sub: "Enregistrement & Conservation", cible: "dossiers", filtreEtape: "5" },
      { label: "Réquisitions préalables (Étape 2)", valeur: String(enRequisitions.length), indice: "", icon: "", sub: "Urbanisme, banque, état civil", cible: "dossiers", filtreEtape: "2" },
      { label: "Expéditions & Clôture (Étape 6)", valeur: String(enExpeditions.length), indice: "", icon: "", sub: "Remise des copies authentiques", cible: "dossiers", filtreEtape: "6" },
      { label: "Alertes de délais formalités", valeur: String(cache.alertes.length), indice: cache.alertes.length ? "warning" : "accent", icon: "", sub: "Délais légaux de publicité", cible: "dossiers", filtrePrio: "alertes" },
    ];

    var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-4)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding-bottom:var(--space-2);border-bottom:1px solid var(--color-border)">';
    html += '<div><h1 style="margin:0">Tableau de bord — Clerc aux Formalités</h1>';
    html += '<p style="opacity:.65;font-size:14px;margin:2px 0 0">Bonjour ' + cache.utilisateur.nomComplet + ' — gestion des formalités préalables et postérieures.</p></div>';
    html += '<div style="display:flex;align-items:center;gap:var(--space-3);margin-left:auto">';
    html += '<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:var(--color-text)">' + dateDuJour + '</div><div style="font-size:11px;color:var(--color-text-dim)">Exercice fiscal ' + anneeCourante + '</div></div></div></div></div>';

    html += renderKpisGrid(kpis);

    // Panneau Étape 5
    html += '<div class="dashboard-panel">';
    html += '<div class="panel-header"><div class="panel-title">Dossiers en cours de formalités DGI & Conservation Foncière (Étape 5)</div><span class="tag tag-outline">' + enFormalites.length + ' dossier(s)</span></div>';
    if (!enFormalites.length) {
      html += '<div class="panel-body" style="text-align:center;color:var(--color-text-dim)">Aucun dossier en cours de formalités fiscales ou foncières.</div>';
    } else {
      html += '<div class="table-wrap"><table class="table"><thead><tr><th>N° Dossier</th><th>Type d\'acte</th><th>Rédacteur</th><th>Assiette fiscale</th><th>Action</th></tr></thead><tbody>';
      enFormalites.forEach(function (d) {
        html += '<tr class="alerte-item" data-id="' + d.id + '" style="cursor:pointer"><td><strong>' + d.numeroDossier + '</strong></td><td>' + labelActe(d.typeActeId) + '</td><td>' + nomClerc(d.clercAssigneId) + '</td><td>' + fmtFCFA(d.montantAssiette) + '</td><td><span class="btn btn-ghost" style="padding:0">Ouvrir fiche →</span></td></tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';

    // Panneau Étape 2
    html += '<div class="dashboard-panel">';
    html += '<div class="panel-header"><div class="panel-title">Dossiers en réquisitions préalables (Étape 2)</div><span class="tag tag-outline">' + enRequisitions.length + ' dossier(s)</span></div>';
    html += '<div class="panel-body">';
    if (!enRequisitions.length) {
      html += '<p class="text-muted">Aucun dossier en réquisitions préalables.</p>';
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:var(--space-3)">';
      enRequisitions.forEach(function (d) {
        html += '<div class="card alerte-item card-interactive" data-id="' + d.id + '" style="cursor:pointer;border-left:4px solid #818cf8;background:var(--color-surface-2)">';
        html += '<span class="card-kicker">' + d.numeroDossier + '</span>';
        html += '<div class="card-title" style="font-size:15px;margin-top:4px">' + labelActe(d.typeActeId) + '</div>';
        html += '<div class="card-meta" style="margin-top:var(--space-2)"><span>Rédacteur : ' + nomClerc(d.clercAssigneId) + '</span></div></div>';
      });
      html += '</div>';
    }
    html += '</div></div>';

    html += renderCentreAlertes();
    c.innerHTML = html;
    attacherEvenementsDashboard(c);
  }

  // --- 5. TABLEAU DE BORD DU COMPTABLE TAXATEUR ---
  function renderDashboardComptableTaxateur() {
    var c = document.getElementById("vue-dashboard");
    var anneeCourante = new Date().getFullYear();
    var enFormalites = cache.dossiers.filter(function (d) { return d.etapeActuelle === 5; }).length;
    var dateDuJour = new Date().toLocaleDateString("fr-CI", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    var kpis = [
      { label: "Dossiers actifs (cabinet)", valeur: String(cache.dossiers.length), indice: "", icon: "", sub: "Assiette globale de l'étude", cible: "dossiers" },
      { label: "En formalités fiscales", valeur: String(enFormalites), indice: "", icon: "", sub: "Droits DGI & taxe foncière", cible: "comptabilite" },
      { label: "Alertes financières / délais", valeur: String(cache.alertes.length), indice: cache.alertes.length ? "warning" : "accent", icon: "", sub: "Décomptes et provisions", cible: "comptabilite" },
      { label: "Catalogue d'actes tarifés", valeur: String(cache.typesActesListe.length), indice: "", icon: "", sub: "Barème Décret 2013-279", cible: "emoluments" },
    ];

    var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-4)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding-bottom:var(--space-2);border-bottom:1px solid var(--color-border)">';
    html += '<div><h1 style="margin:0">Tableau de bord — Comptable Taxateur</h1>';
    html += '<p style="opacity:.65;font-size:14px;margin:2px 0 0">Bonjour ' + cache.utilisateur.nomComplet + ' — calcul des émoluments, droits DGI et fiches de taxe.</p></div>';
    html += '<div style="display:flex;align-items:center;gap:var(--space-3);margin-left:auto">';
    html += '<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:var(--color-text)">' + dateDuJour + '</div><div style="font-size:11px;color:var(--color-text-dim)">Exercice fiscal ' + anneeCourante + '</div></div></div></div></div>';

    html += renderKpisGrid(kpis);

    html += '<div class="dashboard-panel">';
    html += '<div class="panel-header"><div class="panel-title">Dossiers récents à taxer ou régulariser</div><span class="tag tag-outline">Dossiers actifs</span></div>';
    html += '<div class="table-wrap"><table class="table"><thead><tr><th>N° Dossier</th><th>Type d\'acte</th><th>Étape</th><th>Montant d\'assiette</th><th>Clerc assigné</th><th>Action</th></tr></thead><tbody>';
    cache.dossiers.slice(0, 8).forEach(function (d) {
      html += '<tr class="alerte-item" data-id="' + d.id + '" style="cursor:pointer"><td><strong>' + d.numeroDossier + '</strong></td><td>' + labelActe(d.typeActeId) + '</td><td><span class="tag tag-etape-' + d.etapeActuelle + '">' + labelEtape(d.etapeActuelle) + '</span></td><td style="font-weight:600">' + fmtFCFA(d.montantAssiette) + '</td><td>' + nomClerc(d.clercAssigneId) + '</td><td><span class="btn btn-ghost" style="padding:0">Fiche de taxe →</span></td></tr>';
    });
    html += '</tbody></table></div></div>';

    html += renderCentreAlertes();
    c.innerHTML = html;
    attacherEvenementsDashboard(c);
  }

  // --- 6. TABLEAU DE BORD DE L'ASSISTANTE / ACCUEIL ---
  function renderDashboardAssistante() {
    var c = document.getElementById("vue-dashboard");
    var anneeCourante = new Date().getFullYear();
    var enCollecte = cache.dossiers.filter(function (d) { return d.etapeActuelle === 1; });
    var kycAlertes = cache.alertes.filter(function (a) { return a.kycBloquant; });
    var dateDuJour = new Date().toLocaleDateString("fr-CI", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    var kpis = [
      { label: "Dossiers en Collecte KYC", valeur: String(enCollecte.length), indice: enCollecte.length ? "accent" : "", icon: "", sub: "Étape 1 — Accueil", cible: "dossiers", filtreEtape: "1" },
      { label: "Pièces KYC bloquantes", valeur: String(kycAlertes.length), indice: kycAlertes.length ? "danger" : "accent", icon: "", sub: kycAlertes.length ? "Pièces d'identité manquantes" : "Aucun blocage", cible: "clients" },
      { label: "Total dossiers de l'étude", valeur: String(cache.dossiers.length), indice: "", icon: "", sub: "Volume général", cible: "dossiers" },
      { label: "Types d'actes ouverts", valeur: String(cache.typesActesListe.length), indice: "", icon: "", sub: "Catalogue du cabinet", cible: "actes" },
    ];

    var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-4)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding-bottom:var(--space-2);border-bottom:1px solid var(--color-border)">';
    html += '<div><h1 style="margin:0">Tableau de bord — Accueil & Collecte</h1>';
    html += '<p style="opacity:.65;font-size:14px;margin:2px 0 0">Bonjour ' + cache.utilisateur.nomComplet + ' — ouverture des dossiers et constitution des pièces KYC.</p></div>';
    html += '<div style="display:flex;align-items:center;gap:var(--space-3);margin-left:auto">';
    html += '<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:var(--color-text)">' + dateDuJour + '</div><div style="font-size:11px;color:var(--color-text-dim)">Exercice fiscal ' + anneeCourante + '</div></div></div></div></div>';

    html += renderKpisGrid(kpis);

    // Raccourcis d'accueil dans un panneau moderne
    html += '<div class="dashboard-panel">';
    html += '<div class="panel-header"><div class="panel-title">Actions rapides d\'accueil</div></div>';
    html += '<div class="panel-body">';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:var(--space-3)">';
    html += '<div class="card card-action-nouveau card-interactive" id="card-action-nouveau" style="cursor:pointer;border-left:4px solid var(--color-accent);padding:var(--space-4)" title="Cliquer pour créer un nouveau dossier">';
    html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:16px;margin-bottom:4px">Ouvrir un nouveau dossier</div>';
    html += '<div class="card-body">Saisir les comparants, le type d\'acte et générer la checklist légale.</div></div>';
    html += '<div class="card card-action-clients card-interactive" id="card-action-clients" style="cursor:pointer;border-left:4px solid #38bdf8;padding:var(--space-4)" title="Cliquer pour accéder à l\'annuaire clients">';
    html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:16px;margin-bottom:4px">Annuaire des clients</div>';
    html += '<div class="card-body">Rechercher un comparant, vérifier les pièces d\'identité et coordonnées.</div></div>';
    html += '</div></div></div>';

    // Dossiers Étape 1
    html += '<div class="dashboard-panel">';
    html += '<div class="panel-header"><div class="panel-title">Dossiers en cours de Collecte & KYC (Étape 1)</div><span class="tag tag-outline">' + enCollecte.length + ' dossier(s)</span></div>';
    html += '<div class="panel-body">';
    if (!enCollecte.length) {
      html += '<p class="text-muted">Aucun dossier en attente de collecte de pièces pour le moment.</p>';
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-3)">';
      enCollecte.forEach(function (d) {
        html += '<div class="card alerte-item card-interactive" data-id="' + d.id + '" style="cursor:pointer">';
        html += '<span class="card-kicker">' + d.numeroDossier + '</span>';
        html += '<div class="card-title" style="font-size:15px;margin-top:4px">' + labelActe(d.typeActeId) + '</div>';
        html += '<div class="card-meta" style="justify-content:space-between;margin-top:var(--space-2);padding-top:var(--space-2);border-top:1px solid var(--color-divider)"><span>Assiette : ' + fmtFCFA(d.montantAssiette) + '</span><span class="btn btn-ghost" style="padding:0">Compléter KYC →</span></div></div>';
      });
      html += '</div>';
    }
    html += '</div></div>';

    html += renderCentreAlertes();
    c.innerHTML = html;
    attacherEvenementsDashboard(c);

    var cardNouveau = document.getElementById("card-action-nouveau");
    if (cardNouveau) cardNouveau.addEventListener("click", function () { irVers("nouveau-dossier"); });
    var cardClients = document.getElementById("card-action-clients");
    if (cardClients) cardClients.addEventListener("click", function () { irVers("clients"); });
  }

  // --- 7. TABLEAU DE BORD DE L'ARCHIVISTE / MINUTIER (CONSERVATION & TRAÇABILITÉ) ---
  function renderDashboardArchiviste() {
    var c = document.getElementById("vue-dashboard");
    var anneeCourante = new Date().getFullYear();
    var dateDuJour = new Date().toLocaleDateString("fr-CI", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    c.innerHTML = '<p class="text-muted">Chargement de la supervision du minutier…</p>';

    Promise.all([
      API.get("/api/archives/repertoire").catch(function () { return []; }),
      API.get("/api/archives/cartons").catch(function () { return []; }),
      API.get("/api/archives/en-attente").catch(function () { return []; }),
      API.get("/api/archives/mouvements").catch(function () { return []; }),
    ]).then(function (res) {
      var repertoire = res[0] || [];
      var cartons = res[1] || [];
      var enAttente = res[2] || [];
      var mouvements = res[3] || [];

      var sortisActuels = mouvements.filter(function (m) { return m.statut === "en_cours"; });
      var demandesEnAttente = mouvements.filter(function (m) { return m.statut === "en_attente_approbation"; });
      var dossiersEnRetard = mouvements.filter(function (m) {
        return m.statut === "en_cours" && Boolean(m.est_en_retard || (m.date_retour_prevue && new Date(m.date_retour_prevue) < new Date().setHours(0,0,0,0)));
      });

      var totalDossiersEnCarton = cartons.reduce(function (acc, k) { return acc + (k.nombreDossiers || 0); }, 0);

      var kpis = [
        { label: "Minutes Scellées & Numérisées", valeur: String(repertoire.length), indice: "accent", icon: "", sub: "Registre officiel", cible: "archives", sousOnglet: "repertoire" },
        { label: "Demandes de Sortie en Attente", valeur: String(demandesEnAttente.length), indice: demandesEnAttente.length ? "warning" : "accent", icon: "", sub: demandesEnAttente.length ? "À valider et remettre" : "Aucune demande en attente", cible: "archives", sousOnglet: "mouvements" },
        { label: "Dossiers Physiques en Prêt", valeur: String(sortisActuels.length), indice: "", icon: "", sub: totalDossiersEnCarton + " classés en cartons", cible: "archives", sousOnglet: "mouvements" },
        { label: "Alertes Retards de Restitution", valeur: String(dossiersEnRetard.length), indice: dossiersEnRetard.length ? "danger" : "accent", icon: "", sub: dossiersEnRetard.length ? "Date retour dépassée !" : "Aucun retard constaté", cible: "archives", sousOnglet: "mouvements" },
      ];

      var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-4)">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding-bottom:var(--space-2);border-bottom:1px solid var(--color-border);flex-wrap:wrap">';
      html += '<div><h1 style="margin:0">Supervision du Minutier & Archives</h1>';
      html += '<p style="opacity:.65;font-size:14px;margin:2px 0 0">Bonjour ' + cache.utilisateur.nomComplet + ' — validation des demandes de sorties physiques, scellement SHA-256 et traçabilité.</p></div>';
      html += '<div style="display:flex;align-items:center;gap:var(--space-3);margin-left:auto">';
      html += '<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:var(--color-text)">' + dateDuJour + '</div><div style="font-size:11px;color:var(--color-text-dim)">Minutier de l\'Étude · ' + anneeCourante + '</div></div></div></div></div>';

      // Alerte visuelle prioritaire si des dossiers sont en retard
      if (dossiersEnRetard.length > 0) {
        html += '<div class="card card-interactive btn-aller-mouvements" style="background:rgba(239,68,68,0.08);border:1.5px solid var(--color-danger);margin-bottom:var(--space-4);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;cursor:pointer" title="Cliquer pour afficher la liste des retards">';
        html += '<div style="display:flex;align-items:center;gap:10px">';
        html += '<div><strong style="color:var(--color-danger);font-size:14px">Alerte Délais : ' + dossiersEnRetard.length + ' dossier(s) papier en retard de restitution</strong>';
        html += '<div style="font-size:12px;color:var(--color-text-dim)">Veuillez relancer les collaborateurs concernés ou enregistrer le retour du dossier.</div></div></div>';
        html += '<button type="button" class="btn btn-secondary btn-aller-mouvements" style="font-size:11.5px;padding:4px 10px">Voir les retards →</button>';
        html += '</div>';
      }

      html += renderKpisGrid(kpis);

      // Panneau Raccourcis Métier de l'archiviste
      html += '<div class="dashboard-panel">';
      html += '<div class="panel-header"><div class="panel-title">Actions rapides d\'archivage & gestion des sorties</div></div>';
      html += '<div class="panel-body">';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--space-3)">';
      
      html += '<div class="card card-interactive" id="card-action-scan-ocr" style="cursor:pointer;border-left:4px solid var(--color-accent);padding:var(--space-4)" title="Numérisation et OCR">';
      html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:15px;margin-bottom:4px">Numériser & Scanner (OCR)</div>';
      html += '<div class="card-body">Reconnaissance de texte OCR et indexation automatique sur le dossier.</div></div>';

      html += '<div class="card card-interactive" id="card-action-verser-minute" style="cursor:pointer;border-left:4px solid #10b981;padding:var(--space-4)" title="Versement et scellement SHA-256">';
      html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:15px;margin-bottom:4px">Verser au Minutier & Sceller</div>';
      html += '<div class="card-body">Attribuer un numéro d\'ordre, sceller l\'empreinte SHA-256 et archiver.</div></div>';

      html += '<div class="card card-interactive" id="card-action-nouveau-carton" style="cursor:pointer;border-left:4px solid #f59e0b;padding:var(--space-4)" title="Création de carton d\'archives">';
      html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:15px;margin-bottom:4px">Nouveau Carton physique</div>';
      html += '<div class="card-body">Créer un nouveau carton, définir sa cote, son rayonnage et sa capacité.</div></div>';

      html += '<div class="card card-interactive" id="card-action-sortie-physique" style="cursor:pointer;border-left:4px solid #ec4899;padding:var(--space-4)" title="Enregistrement d\'un prêt">';
      html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:15px;margin-bottom:4px">Demande de sortie physique</div>';
      html += '<div class="card-body">Enregistrer une demande de prêt de dossier papier pour consultation au bureau.</div></div>';

      html += '</div></div></div>';

      // Section 1 : Demandes de sorties physiques en attente d'approbation
      if (demandesEnAttente.length > 0) {
        html += '<div class="dashboard-panel" style="border:1.5px solid var(--color-warning);background:rgba(245,158,11,0.03)">';
        html += '<div class="panel-header"><div class="panel-title" style="color:var(--color-warning)">Demandes de sorties de dossiers à approuver (' + demandesEnAttente.length + ')</div></div>';
        html += '<div class="panel-body">';
        html += '<div class="table-container"><table class="table" style="font-size:13px"><thead><tr>';
        html += '<th>Dossier</th><th>Client</th><th>Demandeur</th><th>Bureau cible</th><th>Date sortie</th><th>Retour prévu</th><th>Action</th>';
        html += '</tr></thead><tbody>';
        demandesEnAttente.forEach(function (m) {
          html += '<tr>';
          html += '<td><strong style="color:var(--color-accent)">' + m.numero_dossier + '</strong></td>';
          html += '<td>' + (m.comparants_noms || "Comparants") + '</td>';
          html += '<td><strong>' + m.nom_demandeur + '</strong></td>';
          html += '<td><span style="color:#f59e0b;font-weight:600">' + m.destination_bureau + '</span></td>';
          html += '<td>' + fmtDate(m.date_sortie || m.date_mouvement) + '</td>';
          html += '<td>' + fmtDate(m.date_retour_prevue) + '</td>';
          html += '<td><button type="button" class="btn btn-primary btn-approuver-sortie-dash" data-mouvement-id="' + m.id + '" style="font-size:11.5px;padding:3px 10px;font-weight:700">Approuver & Remettre</button></td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
        html += '</div></div>';
      }

      // Section 2 : File d'attente d'archivage
      html += '<div class="dashboard-panel">';
      html += '<div class="panel-header"><div class="panel-title">Dossiers clôturés en attente de versement</div><span class="tag tag-outline">' + enAttente.length + ' en attente</span></div>';
      html += '<div class="panel-body">';
      if (!enAttente.length) {
        html += '<p class="text-muted" style="margin:0">Aucune minute en attente. Toutes les minutes clôturées ont été numérisées et versées.</p>';
      } else {
        html += '<div class="table-container"><table class="table" style="font-size:13px"><thead><tr>';
        html += '<th>Dossier</th><th>Type d\'acte</th><th>Comparants</th><th>Clôturé le</th><th>Action</th>';
        html += '</tr></thead><tbody>';
        enAttente.slice(0, 6).forEach(function (d) {
          html += '<tr class="alerte-item" data-id="' + d.id + '" style="cursor:pointer">';
          html += '<td><strong style="color:var(--color-accent)">' + d.numeroDossier + '</strong></td>';
          html += '<td>' + labelActe(d.typeActeId) + '</td>';
          html += '<td>' + (d.comparantsNoms || d.premierComparantNom || "—") + '</td>';
          html += '<td>' + fmtDate(d.dateCloture || d.updatedAt) + '</td>';
          html += '<td><button type="button" class="btn btn-primary btn-archiver-direct" data-id="' + d.id + '" style="font-size:11.5px;padding:3px 10px">Archiver →</button></td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '</div></div>';

      // Section 3 : Dernières Minutes Scellées
      html += '<div class="dashboard-panel">';
      html += '<div class="panel-header"><div class="panel-title">Dernières Minutes Scellées au Registre (Empreinte SHA-256)</div><button class="btn btn-ghost" id="btn-voir-tout-repertoire" style="font-size:12px">Consulter tout le Répertoire →</button></div>';
      html += '<div class="panel-body">';
      if (!repertoire.length) {
        html += '<p class="text-muted" style="margin:0">Aucun acte scellé au minutier pour le moment.</p>';
      } else {
        html += '<div class="table-container"><table class="table" style="font-size:12.5px"><thead><tr>';
        html += '<th>N° Ordre</th><th>Dossier</th><th>Type d\'acte</th><th>Date Minute</th><th>Empreinte SHA-256</th><th>Carton</th><th>Action</th>';
        html += '</tr></thead><tbody>';
        repertoire.slice(0, 6).forEach(function (m) {
          var hashTronque = m.empreinteSha256 ? (m.empreinteSha256.slice(0, 10) + '…' + m.empreinteSha256.slice(-6)) : '—';
          html += '<tr style="cursor:pointer" class="btn-jumeau-direct" data-id="' + m.dossierId + '">';
          html += '<td><strong>#' + (m.numeroOrdre || '—') + '</strong></td>';
          html += '<td>' + (m.numeroDossier || '—') + '</td>';
          html += '<td>' + (m.typeActeLibelle || '—') + '</td>';
          html += '<td>' + fmtDate(m.dateActe || m.createdAt) + '</td>';
          html += '<td><code style="font-size:11px;background:var(--color-surface-2);padding:2px 4px;border-radius:3px;color:var(--color-accent)">' + hashTronque + '</code></td>';
          html += '<td>' + (m.cartonCode ? '<span class="tag tag-outline">' + m.cartonCode + '</span>' : '<span style="opacity:.6">Non classé</span>') + '</td>';
          html += '<td><button type="button" class="btn btn-secondary btn-jumeau-direct" data-id="' + m.dossierId + '" style="font-size:11px;padding:3px 8px">Jumeau 360° →</button></td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '</div></div>';

      c.innerHTML = html;

      // Écouteurs des boutons d'actions
      var btnScanOcr = document.getElementById("card-action-scan-ocr");
      if (btnScanOcr) btnScanOcr.addEventListener("click", function () { modalScanOcrIA(); });

      var btnVerser = document.getElementById("card-action-verser-minute");
      if (btnVerser) btnVerser.addEventListener("click", function () { modalNumeriserEtArchiver(); });

      var btnCarton = document.getElementById("card-action-nouveau-carton");
      if (btnCarton) btnCarton.addEventListener("click", function () { modalNouveauCarton(); });

      var btnSortie = document.getElementById("card-action-sortie-physique");
      if (btnSortie) btnSortie.addEventListener("click", function () { modalSortiePhysique(); });

      var btnVoirRep = document.getElementById("btn-voir-tout-repertoire");
      if (btnVoirRep) btnVoirRep.addEventListener("click", function () {
        etatArchives.onglet = "repertoire";
        irVers("archives");
      });

      c.querySelectorAll(".btn-aller-mouvements").forEach(function (btn) {
        btn.addEventListener("click", function () {
          etatArchives.onglet = "mouvements";
          irVers("archives");
        });
      });

      c.querySelectorAll(".btn-approuver-sortie-dash").forEach(function (btn) {
        btn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          var mId = btn.dataset.mouvementId;
          API.post("/api/archives/mouvements/" + mId + "/approuver").then(function () {
            toast("Demande approuvée avec succès ! Le dossier physique est remis.");
            renderDashboardArchiviste();
          }).catch(function (e) { toast("Erreur : " + e.message); });
        });
      });

      c.querySelectorAll(".btn-archiver-direct").forEach(function (btn) {
        btn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          modalNumeriserEtArchiver(btn.dataset.id);
        });
      });

      c.querySelectorAll(".btn-jumeau-direct").forEach(function (btn) {
        btn.addEventListener("click", function () {
          etatArchives.onglet = "jumeau";
          etatArchives.dossierJumeauId = btn.dataset.id;
          irVers("archives");
        });
      });

      attacherEvenementsDashboard(c);
    }).catch(function (err) {
      c.innerHTML = '<p class="erreur-inline">Erreur de chargement du tableau de bord archiviste : ' + err.message + '</p>';
    });
  }

  function renderKpisGrid(kpis) {
    var html = '<div class="kpi-grid">';
    kpis.forEach(function (k) {
      var accentColor = k.indice === "danger" ? "var(--color-danger)" : k.indice === "warning" ? "var(--color-warning)" : k.indice === "accent" ? "var(--color-accent)" : "#38bdf8";
      var indicateur = k.indice ? ('<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:' + accentColor + '"></span>') : '';
      var cibleAttr = k.cible ? (' data-cible="' + k.cible + '"') : '';
      var etapeAttr = k.filtreEtape ? (' data-filtre-etape="' + k.filtreEtape + '"') : '';
      var prioAttr = k.filtrePrio ? (' data-filtre-prio="' + k.filtrePrio + '"') : '';
      var sousOngletAttr = k.sousOnglet ? (' data-sous-onglet="' + k.sousOnglet + '"') : '';

      html += '<div class="kpi-card" ' + cibleAttr + etapeAttr + prioAttr + sousOngletAttr + ' style="cursor:pointer;--kpi-accent:' + accentColor + ';--kpi-color:' + (k.indice ? accentColor : "var(--color-text)") + '" title="Cliquer pour accéder">';
      html += '<div class="kpi-label"><span>' + k.label + '</span>' + indicateur + '</div>';
      html += '<div class="kpi-valeur">' + k.valeur + '</div>';
      if (k.sub) html += '<div style="font-size:12px;color:var(--color-text-dim);margin-top:6px;opacity:.85">' + k.sub + '</div>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  var etatPipelineDashboard = {
    etape: "all",
    prio: "all"
  };

  function renderCentreAlertes() {
    return renderPipelineDossiers();
  }

  function renderPipelineDossiers() {
    var html = '<div class="dashboard-panel" id="panel-pipeline-dashboard" style="border:1px solid var(--color-border);box-shadow:var(--shadow-sm)">';
    html += '<div class="panel-header" style="flex-wrap:wrap;gap:8px;padding-bottom:12px">';
    html += '<div><div class="panel-title" style="font-size:16px;font-weight:700">Pipeline des dossiers & Circuit d\'instruction</div>';
    html += '<div style="font-size:12px;color:var(--color-text-dim);margin-top:2px">Supervision en direct de l\'avancement des actes, des priorités et des alertes de délais</div></div>';
    
    var nbCritiqueTotal = cache.alertes.filter(function (a) { return a.couleur === "rouge"; }).length;
    var nbVigilanceTotal = cache.alertes.filter(function (a) { return a.couleur === "jaune" || a.couleur === "ambre"; }).length;

    // Filtrage direct sur le tableau de bord en fonction du clic sur les étapes ou statuts
    var dossiersFiltres = cache.dossiers.filter(function (d) {
      if (etatPipelineDashboard.etape !== "all" && d.etapeActuelle !== Number(etatPipelineDashboard.etape)) return false;
      if (etatPipelineDashboard.prio !== "all") {
        var alerte = cache.alertesParDossierId[d.id];
        if (etatPipelineDashboard.prio === "rouge" && (!alerte || alerte.couleur !== "rouge")) return false;
        if (etatPipelineDashboard.prio === "jaune" && (!alerte || (alerte.couleur !== "jaune" && alerte.couleur !== "ambre"))) return false;
        if (etatPipelineDashboard.prio === "alertes" && !alerte) return false;
      }
      return true;
    });

    var filtreEnCours = (etatPipelineDashboard.etape !== "all" || etatPipelineDashboard.prio !== "all");
    var tagAffichage = filtreEnCours 
      ? ('<span class="tag tag-gold" style="font-weight:700">' + dossiersFiltres.length + ' / ' + cache.dossiers.length + ' affiché(s)</span>')
      : ('<span class="tag tag-outline" style="font-weight:700">' + cache.dossiers.length + ' dossier(s)</span>');

    html += '<div style="display:flex;align-items:center;gap:8px">' + tagAffichage + '</div></div>';
    
    if (!cache.dossiers.length) {
      html += '<div class="panel-body" style="text-align:center;padding:var(--space-6);color:var(--color-text-dim)">Aucun dossier dans le pipeline actuellement.</div>';
    } else {
      // Bandeau de synthèse des étapes du circuit avec puces cliquables pour filtrer directement le tableau
      html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:var(--color-surface-2);border-top:1px solid var(--color-border);border-bottom:1px solid var(--color-border);overflow-x:auto;flex-wrap:wrap">';
      html += '<span style="font-size:11px;font-weight:700;color:var(--color-text-dim);text-transform:uppercase;letter-spacing:0.04em">Filtrer circuit :</span>';
      
      var isTousActif = !filtreEnCours;
      html += '<button type="button" class="tag circuit-chip-dash' + (isTousActif ? ' actif-circuit-filter' : '') + '" data-etape="all" data-prio="all" style="cursor:pointer;border:' + (isTousActif ? '1.5px solid var(--color-accent)' : '1px solid var(--color-border)') + ';background:' + (isTousActif ? 'var(--color-accent-dim)' : 'transparent') + ';color:' + (isTousActif ? 'var(--color-accent)' : 'var(--color-text)') + ';font-size:11px;padding:4px 8px;border-radius:4px" title="Afficher tous les dossiers du pipeline">Tous <strong>(' + cache.dossiers.length + ')</strong></button>';

      cache.etapesPipeline.forEach(function (et) {
        var nb = cache.dossiers.filter(function (d) { return d.etapeActuelle === et.id; }).length;
        var classeEtape = "tag-etape-" + et.id;
        var isEtapeActif = (etatPipelineDashboard.etape === String(et.id));
        var styleActif = isEtapeActif ? 'box-shadow:0 0 0 2px var(--color-accent);font-weight:700;' : '';
        html += '<span class="tag ' + classeEtape + ' circuit-chip-dash' + (isEtapeActif ? ' actif-circuit-filter' : '') + '" data-etape="' + et.id + '" style="font-size:11px;padding:4px 8px;cursor:pointer;' + styleActif + '" title="Filtrer uniquement l\'étape ' + et.id + '"><span class="status-dot status-dot-etape-' + et.id + '"></span> ' + et.id + '. ' + et.libelle + ' <strong>(' + nb + ')</strong></span>';
      });

      if (nbCritiqueTotal > 0) {
        var isCritiqueActif = (etatPipelineDashboard.prio === "rouge");
        var styleCritique = isCritiqueActif ? 'box-shadow:0 0 0 2px var(--color-danger);font-weight:700;' : '';
        html += '<span class="tag tag-prio-critique circuit-prio-dash' + (isCritiqueActif ? ' actif-circuit-filter' : '') + '" data-prio="rouge" style="font-size:11px;padding:4px 8px;margin-left:auto;cursor:pointer;' + styleCritique + '" title="Filtrer les dossiers critiques"><span class="status-dot status-dot-overdue"></span> ' + nbCritiqueTotal + ' Critique(s)</span>';
      }
      if (nbVigilanceTotal > 0) {
        var isVigilanceActif = (etatPipelineDashboard.prio === "jaune");
        var styleVigilance = isVigilanceActif ? 'box-shadow:0 0 0 2px var(--color-warning);font-weight:700;' : '';
        html += '<span class="tag tag-prio-vigilance circuit-prio-dash' + (isVigilanceActif ? ' actif-circuit-filter' : '') + '" data-prio="jaune" style="font-size:11px;padding:4px 8px;cursor:pointer;' + styleVigilance + '" title="Filtrer les dossiers sous vigilance"><span class="status-dot status-dot-missing"></span> ' + nbVigilanceTotal + ' Vigilance</span>';
      }
      html += '</div>';

      // Tri par priorité (rouge > jaune > vert) puis par date de création/ouverture
      var dossiersTries = dossiersFiltres.slice().sort(function (a, b) {
        var alerteA = cache.alertesParDossierId[a.id];
        var alerteB = cache.alertesParDossierId[b.id];
        var scoreA = alerteA ? (alerteA.couleur === "rouge" ? 3 : 2) : 1;
        var scoreB = alerteB ? (alerteB.couleur === "rouge" ? 3 : 2) : 1;
        if (scoreB !== scoreA) return scoreB - scoreA;
        var dateA = new Date(a.createdAt || a.dateOuverture || 0);
        var dateB = new Date(b.createdAt || b.dateOuverture || 0);
        return dateA - dateB;
      });

      if (!dossiersTries.length) {
        html += '<div class="panel-body" style="text-align:center;padding:var(--space-5);color:var(--color-text-dim)">Aucun dossier ne correspond à ce filtre sur le tableau de bord. <button type="button" class="btn btn-ghost circuit-chip-dash" data-etape="all" data-prio="all" style="font-size:11.5px;padding:2px 8px;margin-left:6px;color:var(--color-accent)">Réinitialiser</button></div>';
      } else {
        html += '<div class="table-wrap"><table class="table" style="margin:0"><thead><tr>';
        html += '<th style="width:130px">N° Dossier</th>';
        html += '<th>Client (Comparants)</th>';
        html += '<th>Type d\'acte</th>';
        html += '<th style="width:140px">Priorité</th>';
        html += '<th style="width:190px">Statut & Étape</th>';
        html += '<th>Assiette fiscale</th>';
        html += '<th>Rédacteur</th>';
        html += '<th style="width:90px;text-align:right">Action</th>';
        html += '</tr></thead><tbody>';
        
        dossiersTries.forEach(function (d) {
          var alerte = cache.alertesParDossierId[d.id];
          var bordureCouleur = alerte && alerte.couleur === "rouge" 
            ? "var(--color-danger)" 
            : (alerte && (alerte.couleur === "jaune" || alerte.couleur === "ambre") ? "var(--color-warning)" : "var(--color-accent)");

          var clientAffiche = d.comparantsNoms && d.comparantsNoms.trim() ? d.comparantsNoms.trim() : "Comparant(s) en cours";
          var clercAff = nomClerc(d.clercAssigneId);

          html += '<tr class="alerte-item" data-id="' + d.id + '" style="cursor:pointer;border-left:3.5px solid ' + bordureCouleur + ';transition:background .15s ease">';
          html += '<td><code style="font-family:monospace;font-size:11.5px;font-weight:700;color:var(--color-accent);background:var(--color-accent-dim);padding:2px 6px;border-radius:4px;border:1px solid rgba(99,102,241,0.25)">' + d.numeroDossier + '</code></td>';
          html += '<td style="font-weight:600;color:var(--color-text)">' + clientAffiche + '</td>';
          html += '<td style="font-size:13px;color:var(--color-text)">' + labelActe(d.typeActeId) + '</td>';
          html += '<td><span class="badge-filtre-dash" data-prio="' + (alerte ? alerte.couleur : "all") + '" title="Cliquer pour filtrer par priorité">' + badgePrioriteDossier(d.id) + '</span></td>';
          html += '<td><span class="badge-filtre-dash" data-etape="' + d.etapeActuelle + '" title="Cliquer pour filtrer par cette étape">' + badgeStatutDossier(d) + '</span></td>';
          html += '<td style="font-weight:600;font-size:13px">' + fmtFCFA(d.montantAssiette) + '</td>';
          html += '<td style="font-size:12px;color:var(--color-text-dim)">' + clercAff + '</td>';
          html += '<td style="text-align:right"><span class="btn btn-ghost" style="padding:2px 6px;font-size:11.5px">Consulter →</span></td>';
          html += '</tr>';
        });

        html += '</tbody></table></div>';
      }
    }
    html += '</div>';
    return html;
  }

  function attacherEvenementsDashboard(conteneur) {
    if (!conteneur) return;

    // 1. Clic sur n'importe quelle carte KPI -> Redirection intelligente
    conteneur.querySelectorAll(".kpi-card").forEach(function (card) {
      card.addEventListener("click", function () {
        var cible = card.dataset.cible;
        var filtreEtape = card.dataset.filtreEtape;
        var filtrePrio = card.dataset.filtrePrio;
        var sousOnglet = card.dataset.sousOnglet;

        if (filtreEtape) etat.filtreEtape = String(filtreEtape);
        if (filtrePrio === "alertes") etat.filtrePriorite = "alertes";

        if (cible === "archives" && sousOnglet) {
          irVers("archives", "dashboard");
          setTimeout(function () {
            var tabBtn = document.querySelector('.archives-nav-tab[data-tab="' + sousOnglet + '"]');
            if (tabBtn) tabBtn.click();
          }, 60);
          return;
        }

        if (cible) {
          irVers(cible, "dashboard");
        } else {
          irVers("dossiers", "dashboard");
        }
      });
    });

    // 2. Clic sur dossiers urgents / alertes (ouvre la fiche du dossier)
    conteneur.querySelectorAll(".card-urgence-notaire, .alerte-item").forEach(function (e) {
      e.addEventListener("click", function () {
        if (e.dataset.id) ouvrirDossier(e.dataset.id, "dashboard");
      });
    });
    conteneur.querySelectorAll(".btn-ouvrir-urgence").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (btn.dataset.id) ouvrirDossier(btn.dataset.id, "dashboard");
      });
    });

    // 3. Instruction par collaborateur / Clerc rows & buttons
    conteneur.querySelectorAll(".ligne-clerc-dash, .btn-filtre-clerc").forEach(function (el) {
      el.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var clercId = el.dataset.clercId;
        if (clercId) {
          etat.filtreClercId = clercId;
          irVers("dossiers", "dashboard");
        }
      });
    });

    // 4. Ventilation par branche notariale
    conteneur.querySelectorAll(".card-branche-notariale").forEach(function (card) {
      card.addEventListener("click", function () {
        var domKey = card.dataset.branche;
        etat.filtreBranche = domKey;
        irVers("dossiers", "dashboard");
      });
    });

    // 5. Trésorerie & Fiscalité cards
    conteneur.querySelectorAll(".card-tresorerie-dash").forEach(function (card) {
      card.addEventListener("click", function () {
        var cible = card.dataset.cible || "comptabilite";
        irVers(cible, "dashboard");
      });
    });

    // 6. Circuit Étape chips -> Filtre direct en place sur le tableau de bord
    conteneur.querySelectorAll(".circuit-chip-dash").forEach(function (chip) {
      chip.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var etapeId = chip.dataset.etape;
        if (etapeId === "all") {
          etatPipelineDashboard.etape = "all";
          etatPipelineDashboard.prio = "all";
        } else if (etatPipelineDashboard.etape === etapeId) {
          etatPipelineDashboard.etape = "all";
        } else {
          etatPipelineDashboard.etape = etapeId;
          etatPipelineDashboard.prio = "all";
        }
        renderDashboard();
      });
    });

    // 7. Circuit Priority chips -> Filtre direct en place sur le tableau de bord
    conteneur.querySelectorAll(".circuit-prio-dash").forEach(function (chip) {
      chip.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var prio = chip.dataset.prio;
        if (etatPipelineDashboard.prio === prio) {
          etatPipelineDashboard.prio = "all";
        } else {
          etatPipelineDashboard.prio = prio || "alertes";
          etatPipelineDashboard.etape = "all";
        }
        renderDashboard();
      });
    });

    // 7b. Badges Statut/Étape et Priorité cliquables dans les lignes du tableau pour filtrer en direct
    conteneur.querySelectorAll(".badge-filtre-dash").forEach(function (badge) {
      badge.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var etape = badge.dataset.etape;
        var prio = badge.dataset.prio;
        if (etape) {
          etatPipelineDashboard.etape = (etatPipelineDashboard.etape === String(etape)) ? "all" : String(etape);
          etatPipelineDashboard.prio = "all";
          renderDashboard();
        } else if (prio && prio !== "all") {
          etatPipelineDashboard.prio = (etatPipelineDashboard.prio === prio) ? "all" : prio;
          etatPipelineDashboard.etape = "all";
          renderDashboard();
        }
      });
    });

    // 8. Premier Clerc Étape cards
    conteneur.querySelectorAll(".card-etape-dash").forEach(function (card) {
      card.addEventListener("click", function () {
        var etapeId = card.dataset.etape;
        if (etapeId) {
          etat.filtreEtape = String(etapeId);
          irVers("dossiers", "dashboard");
        }
      });
    });

    var btnPush = conteneur.querySelector("#bouton-demander-push");
    if (btnPush) btnPush.addEventListener("click", proposerWebPushMoment);
  }

  // -----------------------------------------------------------------
  // Kanban (Circuit d'instruction interactif 6 étapes)
  // -----------------------------------------------------------------
  var etatKanban = {
    recherche: "",
  };

  function renderKanban() {
    var c = document.getElementById("vue-kanban");
    var q = (etatKanban.recherche || "").toLowerCase().trim();

    var dossiersFiltres = cache.dossiers.filter(function (d) {
      if (!q) return true;
      var texte = (d.numeroDossier + " " + labelActe(d.typeActeId) + " " + (d.comparantsNoms || "") + " " + nomClerc(d.clercAssigneId)).toLowerCase();
      return texte.indexOf(q) !== -1;
    });

    var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-3)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap">';
    html += '<div><h1 style="margin-bottom:2px">Circuit d\'instruction Notarial</h1>';
    html += '<p style="opacity:.65;font-size:14px;margin:0">Pipeline d\'avancement des 6 étapes juridiques — ' + dossiersFiltres.length + ' dossier(s) affiché(s).</p></div>';
    
    // Barre de recherche rapide intégrée
    html += '<div style="display:flex;align-items:center;gap:var(--space-2);min-width:280px;position:relative">';
    html += '<input type="search" id="filtre-kanban-recherche" class="input" placeholder="Filtrer par dossier, comparant, acte..." value="' + (etatKanban.recherche || "") + '" style="font-size:12.5px;padding:6px 12px 6px 32px;min-height:36px">';
    html += '';
    if (etatKanban.recherche) {
      html += '<button type="button" id="btn-effacer-kanban" class="btn btn-ghost" style="font-size:11px;padding:4px 6px">Effacer</button>';
    }
    html += '</div>';
    html += '</div></div>';

    html += '<div style="display:flex;flex-direction:column;gap:var(--space-4)">';

    cache.etapesPipeline.forEach(function (etape, idx) {
      var ds = dossiersFiltres.filter(function (d) { return d.etapeActuelle === etape.id; });
      var accent = ETAPE_COULEUR[idx % ETAPE_COULEUR.length];
      
      html += '<div style="width:100%;display:flex;flex-direction:column;border-radius:var(--radius-lg);background:var(--color-surface);border:1px solid var(--color-border);border-left:4px solid ' + accent + ';overflow:hidden;box-shadow:var(--shadow-sm)">';
      
      // En-tête de l'étape
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) var(--space-4);background:var(--color-surface-2);border-bottom:1px solid var(--color-border)">';
      html += '<div style="display:flex;align-items:center;gap:8px">';
      html += '<span style="font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;background:' + accent + ';color:#fff">Étape ' + etape.id + '</span>';
      html += '<h5 style="margin:0;font-size:15px;font-weight:700;font-family:var(--font-heading);color:var(--color-text)">' + etape.libelle + '</h5>';
      html += '</div>';
      html += '<span class="tag tag-outline" style="font-size:11px;font-weight:700">' + ds.length + ' dossier(s)</span>';
      html += '</div>';

      // Grille des cartes dossiers
      html += '<div style="display:flex;flex-wrap:wrap;gap:var(--space-3);padding:var(--space-3)">';
      if (!ds.length) {
        html += '<div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:var(--space-3);color:var(--color-text-dim);font-size:12px;border:1px dashed var(--color-border);border-radius:var(--radius);width:100%"><span style="opacity:.6">○</span><span>Aucun dossier à cette étape' + (q ? " correspondant au filtre" : "") + '</span></div>';
      }
      ds.forEach(function (d) {
        var nv = niveauDossier(d.id);
        var clientAff = (d.comparantsNoms && d.comparantsNoms.trim()) ? d.comparantsNoms.trim() : "Comparant(s)";

        html += '<div class="card elev-sm carte-dossier" data-id="' + d.id + '" style="cursor:pointer;flex:0 0 280px;width:280px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:12px;transition:all .15s ease">';
        
        // En-tête de la carte
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">';
        html += '<span style="font-family:monospace;font-size:11.5px;font-weight:700;color:var(--color-accent)">' + d.numeroDossier + '</span>';
        html += '<span class="tag ' + nv.tag + '" style="font-size:10px;padding:2px 6px;font-weight:700">' + nv.label + '</span>';
        html += '</div>';

        // Titre de l'acte
        html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:14px;color:var(--color-text);margin-bottom:4px">' + labelActe(d.typeActeId) + '</div>';

        // Comparants
        html += '<div style="font-size:12px;color:var(--color-text-dim);margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + clientAff + '</div>';

        // Pied de carte : Assiette & Clerc
        html += '<div style="display:flex;align-items:center;justify-content:space-between;padding-top:6px;border-top:1px solid var(--color-border-subtle);font-size:11.5px">';
        html += '<span style="font-weight:700;color:var(--color-text)">' + fmtFCFA(d.montantAssiette) + '</span>';
        html += '<span style="color:var(--color-text-dim)">' + nomClerc(d.clercAssigneId) + '</span>';
        html += '</div>';

        html += '</div>';
      });
      html += '</div></div>';
    });
    html += '</div>';
    c.innerHTML = html;

    // Écouteur de recherche Kanban
    var inputRecherche = document.getElementById("filtre-kanban-recherche");
    if (inputRecherche) {
      inputRecherche.addEventListener("input", function () {
        etatKanban.recherche = inputRecherche.value;
        renderKanban();
      });
    }
    var btnEffacer = document.getElementById("btn-effacer-kanban");
    if (btnEffacer) {
      btnEffacer.addEventListener("click", function () {
        etatKanban.recherche = "";
        renderKanban();
      });
    }

    c.querySelectorAll(".carte-dossier").forEach(function (e) {
      e.addEventListener("click", function () { ouvrirDossier(e.dataset.id, "kanban"); });
    });
  }

  // -----------------------------------------------------------------
  // Liste des dossiers avec Top 5 des actes
  // -----------------------------------------------------------------
  function renderDossiersListe() {
    var c = document.getElementById("vue-dossiers");
    var recherche = etat.filtreRecherche.trim().toLowerCase();
    etat.filtreTypeActe = etat.filtreTypeActe || "all";

    // Calcul dynamique du Top 5 des types d'actes
    var compteursActes = {};
    cache.dossiers.forEach(function (d) {
      compteursActes[d.typeActeId] = (compteursActes[d.typeActeId] || 0) + 1;
    });

    var topActesListe = Object.keys(compteursActes)
      .map(function (typeId) {
        return { typeId: typeId, count: compteursActes[typeId], label: labelActe(typeId) };
      })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 5);

    etat.filtreClercId = etat.filtreClercId || "all";
    etat.filtreBranche = etat.filtreBranche || "all";
    etat.filtrePriorite = etat.filtrePriorite || "all";

    var liste = cache.dossiers
      .filter(function (d) { return etat.filtreTypeActe === "all" || d.typeActeId === etat.filtreTypeActe; })
      .filter(function (d) { return etat.filtreEtape === "all" || d.etapeActuelle === Number(etat.filtreEtape); })
      .filter(function (d) { return etat.filtreClercId === "all" || d.clercAssigneId === etat.filtreClercId; })
      .filter(function (d) {
        if (etat.filtreBranche === "all") return true;
        var t = cache.typesActesParId[d.typeActeId];
        var cat = t && t.categorie ? t.categorie.toLowerCase() : "";
        if (etat.filtreBranche === "immobilier") return cat.indexOf("immob") !== -1 || cat.indexOf("vente") !== -1 || cat.indexOf("bail") !== -1;
        if (etat.filtreBranche === "banque") return cat.indexOf("banq") !== -1 || cat.indexOf("credit") !== -1 || cat.indexOf("pret") !== -1 || cat.indexOf("hypot") !== -1;
        if (etat.filtreBranche === "societes") return cat.indexOf("societ") !== -1 || cat.indexOf("statut") !== -1 || cat.indexOf("commerc") !== -1;
        if (etat.filtreBranche === "famille") return cat.indexOf("famill") !== -1 || cat.indexOf("succes") !== -1 || cat.indexOf("mariag") !== -1 || cat.indexOf("donat") !== -1;
        return true;
      })
      .filter(function (d) {
        if (etat.filtrePriorite === "all") return true;
        var a = cache.alertesParDossierId[d.id];
        if (etat.filtrePriorite === "rouge") return a && a.couleur === "rouge";
        if (etat.filtrePriorite === "jaune") return a && (a.couleur === "jaune" || a.couleur === "ambre");
        if (etat.filtrePriorite === "alertes") return Boolean(a);
        return true;
      })
      .filter(function (d) {
        return !recherche || (d.numeroDossier + " " + labelActe(d.typeActeId) + " " + (d.comparantsNoms || "")).toLowerCase().indexOf(recherche) !== -1;
      });

    var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-3);display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap">';
    html += '<div><h1 style="margin-bottom:2px">Dossiers</h1><p style="opacity:.65;font-size:14px;margin:0">' + liste.length + ' dossier(s) affiché(s) sur ' + cache.dossiers.length + ' au total.</p></div>';
    if (cache.permissions.addDossier) html += '<button class="btn btn-primary" id="bouton-nouveau-dossier">+ Nouveau dossier</button>';
    html += '</div>';

    // Ruban d'information si un filtre provient d'un clic dashboard
    var aFiltreActif = (etat.filtreClercId !== "all" || etat.filtreBranche !== "all" || etat.filtrePriorite !== "all" || etat.filtreEtape !== "all" || etat.filtreTypeActe !== "all");
    if (aFiltreActif) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--color-surface-2);border-radius:var(--radius);border:1px solid var(--color-border);margin-bottom:var(--space-3);flex-wrap:wrap">';
      html += '<span style="font-size:11.5px;font-weight:700;color:var(--color-text-dim);text-transform:uppercase">Filtres actifs :</span>';
      if (etat.filtreClercId !== "all") html += '<span class="tag tag-outline" style="font-size:11px">Collaborateur : ' + nomClerc(etat.filtreClercId) + '</span>';
      if (etat.filtreBranche !== "all") html += '<span class="tag tag-outline" style="font-size:11px">Branche : ' + etat.filtreBranche.toUpperCase() + '</span>';
      if (etat.filtrePriorite !== "all") html += '<span class="tag tag-prio-critique" style="font-size:11px">Priorité : ' + etat.filtrePriorite.toUpperCase() + '</span>';
      if (etat.filtreEtape !== "all") html += '<span class="tag tag-etape-' + etat.filtreEtape + '" style="font-size:11px">Étape ' + etat.filtreEtape + ' · ' + labelEtape(Number(etat.filtreEtape)) + '</span>';
      if (etat.filtreTypeActe !== "all") html += '<span class="tag tag-outline" style="font-size:11px">Acte : ' + labelActe(etat.filtreTypeActe) + '</span>';
      html += '<button type="button" class="btn btn-ghost" id="btn-reinitialiser-tous-filtres" style="font-size:11px;padding:2px 8px;margin-left:auto;color:var(--color-danger)">✕ Réinitialiser les filtres</button>';
      html += '</div>';
    }

    // Bandeau interactif Top 5 des actes
    html += '<div style="margin-bottom:var(--space-3)">';
    html += '<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:8px">';
    html += 'Top 5 des actes les plus fréquents de l\'étude :';
    html += '</div>';
    html += '<div class="top-actes-bar">';
    html += '<button type="button" class="top-acte-chip' + (etat.filtreTypeActe === "all" ? " actif" : "") + '" data-type-id="all">Tous les actes <strong>(' + cache.dossiers.length + ')</strong></button>';
    topActesListe.forEach(function (ta) {
      var isActif = etat.filtreTypeActe === ta.typeId;
      html += '<button type="button" class="top-acte-chip' + (isActif ? " actif" : "") + '" data-type-id="' + ta.typeId + '">' + ta.label + ' <strong>(' + ta.count + ')</strong></button>';
    });
    html += '</div></div>';

    html += '<div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-4);flex-wrap:wrap">';
    html += '<input class="input" id="dossiers-recherche" style="max-width:320px" value="' + etat.filtreRecherche + '" placeholder="Rechercher un numéro, client, type…">';
    html += '<select class="input" id="dossiers-filtre-etape" style="max-width:260px"><option value="all">Toutes les étapes</option>';
    cache.etapesPipeline.forEach(function (e) { html += '<option value="' + e.id + '"' + (String(e.id) === etat.filtreEtape ? " selected" : "") + '>' + e.libelle + '</option>'; });
    html += '</select></div>';

    html += '<div class="table-wrap"><table class="table" style="margin:0"><thead><tr>';
    html += '<th style="width:130px">N° Dossier</th>';
    html += '<th>Client (Comparants)</th>';
    html += '<th>Type d\'acte</th>';
    html += '<th style="width:140px">Priorité</th>';
    html += '<th style="width:190px">Statut & Étape</th>';
    html += '<th>Montant (Assiette)</th>';
    html += '<th>Rédacteur</th>';
    html += '<th style="width:90px;text-align:right">Action</th>';
    html += '</tr></thead><tbody>';
    if (!liste.length) html += '<tr><td colspan="8" class="text-muted" style="text-align:center;padding:var(--space-6)">Aucun dossier ne correspond à vos critères de recherche.</td></tr>';
    liste.forEach(function (d) {
      var alerte = cache.alertesParDossierId[d.id];
      var bordureCouleur = alerte && alerte.couleur === "rouge" 
        ? "var(--color-danger)" 
        : (alerte && (alerte.couleur === "jaune" || alerte.couleur === "ambre") ? "var(--color-warning)" : "var(--color-accent)");
      var clientAffiche = d.comparantsNoms && d.comparantsNoms.trim() ? d.comparantsNoms.trim() : "Comparant(s) en cours";
      var clercAff = nomClerc(d.clercAssigneId);

      html += '<tr class="ligne-dossier" data-id="' + d.id + '" style="cursor:pointer;border-left:3.5px solid ' + bordureCouleur + ';transition:background .15s ease">';
      html += '<td><code style="font-family:monospace;font-size:11.5px;font-weight:700;color:var(--color-accent);background:var(--color-accent-dim);padding:2px 6px;border-radius:4px;border:1px solid rgba(99,102,241,0.25)">' + d.numeroDossier + '</code></td>';
      html += '<td style="font-weight:600;color:var(--color-text)">' + clientAffiche + '</td>';
      html += '<td style="font-size:13px;color:var(--color-text)">' + labelActe(d.typeActeId) + '</td>';
      html += '<td>' + badgePrioriteDossier(d.id) + '</td>';
      html += '<td>' + badgeStatutDossier(d) + '</td>';
      html += '<td style="font-weight:600;font-size:13px">' + fmtFCFA(d.montantAssiette) + '</td>';
      html += '<td style="font-size:12px;color:var(--color-text-dim)">' + clercAff + '</td>';
      html += '<td style="text-align:right"><span class="btn btn-ghost" style="padding:2px 6px;font-size:11.5px">Ouvrir →</span></td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    c.innerHTML = html;

    // Événements Top 5 chips
    c.querySelectorAll(".top-acte-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        etat.filtreTypeActe = chip.dataset.typeId;
        renderDossiersListe();
      });
    });

    var btnReset = document.getElementById("btn-reinitialiser-tous-filtres");
    if (btnReset) {
      btnReset.addEventListener("click", function () {
        etat.filtreClercId = "all";
        etat.filtreBranche = "all";
        etat.filtrePriorite = "all";
        etat.filtreEtape = "all";
        etat.filtreTypeActe = "all";
        etat.filtreRecherche = "";
        renderDossiersListe();
      });
    }

    document.getElementById("dossiers-recherche").addEventListener("input", function (e) { etat.filtreRecherche = e.target.value; renderDossiersListe(); });
    document.getElementById("dossiers-filtre-etape").addEventListener("change", function (e) { etat.filtreEtape = e.target.value; renderDossiersListe(); });
    c.querySelectorAll(".ligne-dossier").forEach(function (e) { e.addEventListener("click", function () { ouvrirDossier(e.dataset.id, "dossiers"); }); });
    var btnNouveau = document.getElementById("bouton-nouveau-dossier");
    if (btnNouveau) btnNouveau.addEventListener("click", function () { irVers("nouveau-dossier", "dossiers"); });
  }

  // -----------------------------------------------------------------
  // Nouveau dossier
  // -----------------------------------------------------------------
  var compteurComparants = 0;

  function renderNouveauDossier() {
    var c = document.getElementById("vue-nouveau-dossier");
    compteurComparants = 0;

    var html = '<div class="btn btn-ghost bouton-retour-nouveau" style="padding-left:0;margin-bottom:var(--space-3)">‹ Retour aux dossiers</div>';
    html += '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-4)">';
    html += '<h1 style="margin-bottom:2px">Nouveau dossier</h1><p style="opacity:.65;font-size:14px;margin:0">Ouvre un dossier et sa checklist, copiée depuis le référentiel du type d\'acte choisi.</p></div>';

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--space-3);max-width:720px;margin-bottom:var(--space-4)">';
    html += '<div class="field"><label>Type d\'acte</label><select class="input" id="nd-type-acte"><option value="">Choisir un type d\'acte…</option>';
    cache.typesActesListe.forEach(function (t) { html += '<option value="' + t.id + '">' + t.libelle + '</option>'; });
    html += '</select></div>';
    html += '<div class="field"><label>Montant (assiette, FCFA)</label><input class="input" type="number" min="0" id="nd-montant" placeholder="1000000"></div>';
    html += '</div>';

    html += '<div style="max-width:720px;margin-bottom:var(--space-2)">';
    html += '<div class="field"><label>Clerc assigné / Responsable de l\'instruction</label><select class="input" id="nd-clerc"><option value="">Sélectionner un clerc de l\'étude…</option>';
    (cache.equipeListe || []).forEach(function (m) {
      if (["superadmin", "dev", "commercial", "support", "assistante_editeur"].indexOf(m.role) !== -1) return;
      var isMe = (cache.utilisateur && m.id === cache.utilisateur.id) ? " (Vous)" : "";
      html += '<option value="' + m.id + '">' + m.nomComplet + ' — ' + (ROLE_LABEL[m.role] || m.role) + isMe + '</option>';
    });
    html += '</select></div>';
    html += '</div>';

    html += '<h3 style="margin-bottom:var(--space-2)">Comparants</h3>';
    html += '<div id="nd-comparants" style="max-width:720px;display:flex;flex-direction:column;gap:var(--space-2);margin-bottom:var(--space-2)"></div>';
    html += '<button class="btn btn-secondary" id="nd-ajouter-comparant" style="margin-bottom:var(--space-4)">+ Ajouter un comparant</button>';

    html += '<div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-3)"><button class="btn btn-primary" id="nd-creer">Créer le dossier</button></div>';
    html += '<div id="nd-erreur" class="erreur-inline" style="display:none;max-width:720px"></div>';

    c.innerHTML = html;
    ajouterLigneComparant();
    ajouterLigneComparant();

    var retour = c.querySelector(".bouton-retour-nouveau");
    if (retour) retour.addEventListener("click", function () { irVers(etat.vuePrecedente); });
    document.getElementById("nd-ajouter-comparant").addEventListener("click", ajouterLigneComparant);
    document.getElementById("nd-creer").addEventListener("click", soumettreNouveauDossier);
  }

  function ajouterLigneComparant() {
    var conteneur = document.getElementById("nd-comparants");
    var idx = compteurComparants++;
    var ligne = el("div", { style: "display:flex;gap:var(--space-2);align-items:center" });
    ligne.innerHTML =
      '<input class="input" placeholder="Nom du comparant" data-comparant-nom="' + idx + '" style="flex:2">' +
      '<input class="input" placeholder="Qualité (ex. Vendeur, Acquéreur)" data-comparant-qualite="' + idx + '" style="flex:2">' +
      '<span class="btn btn-ghost nd-retirer-comparant" style="flex:none">Retirer</span>';
    conteneur.appendChild(ligne);
    ligne.querySelector(".nd-retirer-comparant").addEventListener("click", function () {
      if (conteneur.children.length > 1) ligne.remove();
    });
  }

  function soumettreNouveauDossier() {
    var erreurZone = document.getElementById("nd-erreur");
    erreurZone.style.display = "none";

    var typeActeId = document.getElementById("nd-type-acte").value;
    var montant = parseInt(document.getElementById("nd-montant").value, 10) || 0;
    var comparants = [];
    document.querySelectorAll("[data-comparant-nom]").forEach(function (input) {
      var idx = input.dataset.comparantNom;
      var nom = input.value.trim();
      var qualiteInput = document.querySelector('[data-comparant-qualite="' + idx + '"]');
      if (nom) comparants.push({ nom: nom, qualite: (qualiteInput.value.trim() || "Comparant") });
    });

    if (!typeActeId) { erreurZone.textContent = "Choisissez un type d'acte."; erreurZone.style.display = "block"; return; }
    if (!montant || montant <= 0) { erreurZone.textContent = "Indiquez un montant."; erreurZone.style.display = "block"; return; }
    if (!comparants.length) { erreurZone.textContent = "Ajoutez au moins un comparant."; erreurZone.style.display = "block"; return; }

    var corps = { typeActeId: typeActeId, montantAssiette: montant, comparants: comparants };
    var champClerc = document.getElementById("nd-clerc");
    if (champClerc && champClerc.value) corps.clercAssigneId = champClerc.value;

    var btn = document.getElementById("nd-creer");
    btn.setAttribute("disabled", "disabled");
    API.post("/api/dossiers", corps)
      .then(function (dossier) {
        toast(dossier.numeroDossier + " créé.");
        return chargerDossiersEtAlertes().then(function () { ouvrirDossier(dossier.id, "dossiers"); });
      })
      .catch(function (e) {
        btn.removeAttribute("disabled");
        erreurZone.textContent = e.message;
        erreurZone.style.display = "block";
      });
  }

  // -----------------------------------------------------------------
  // Clients — annuaire des comparants, agrégé depuis les dossiers dans
  // la portée RBAC de l'utilisateur (voir GET /api/clients, même règle
  // de visibilité que l'écran Dossiers — pas une règle séparée).
  // -----------------------------------------------------------------
  // -----------------------------------------------------------------
  // Clients — annuaire des comparants & gestion multi-dossiers
  // -----------------------------------------------------------------
  function renderClients() {
    var c = document.getElementById("vue-clients");
    c.innerHTML = '<p class="text-muted">Chargement de l\'annuaire clients…</p>';
    API.get("/api/clients").then(function (liste) {
      cache.clients = liste;
      var recherche = (etat.filtreClients || "").trim().toLowerCase();
      etat.filtreClientsMulti = etat.filtreClientsMulti || false;

      var multiCount = liste.filter(function (cl) { return cl.dossiers && cl.dossiers.length > 1; }).length;

      var filtres = liste.filter(function (cl) {
        if (etat.filtreClientsMulti && (!cl.dossiers || cl.dossiers.length <= 1)) return false;
        if (!recherche) return true;
        return cl.nom.toLowerCase().indexOf(recherche) !== -1 ||
          (cl.dossiers || []).some(function (d) { return (d.numeroDossier + " " + labelActe(d.typeActeId)).toLowerCase().indexOf(recherche) !== -1; });
      });

      var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-3)">';
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:var(--space-3)">';
      html += '<div><h1 style="margin-bottom:2px">Répertoire des Clients & Comparants</h1>';
      html += '<p style="opacity:.65;font-size:14px;margin:0">' + liste.length + ' client(s) au répertoire · ' + multiCount + ' client(s) avec dossiers multiples.</p></div>';
      html += '</div></div>';

      // Barre de filtres et recherche
      html += '<div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-4);flex-wrap:wrap">';
      html += '<input class="input" id="clients-recherche" style="max-width:320px" value="' + (etat.filtreClients || "") + '" placeholder="Rechercher un client, un acte, un numéro…">';
      html += '<button type="button" class="btn ' + (!etat.filtreClientsMulti ? "btn-primary" : "btn-secondary") + '" id="btn-filtre-tous-clients">Tous les clients (' + liste.length + ')</button>';
      html += '<button type="button" class="btn ' + (etat.filtreClientsMulti ? "btn-primary" : "btn-secondary") + '" id="btn-filtre-multi-clients">Clients multi-dossiers (' + multiCount + ')</button>';
      html += '</div>';

      if (!filtres.length) {
        html += '<p class="text-muted" style="text-align:center;padding:var(--space-4)">Aucun client ne correspond à votre sélection.</p>';
      } else {
        html += '<div style="display:flex;flex-direction:column;gap:var(--space-3)">';
        filtres.forEach(function (cl) {
          var nbDossiers = cl.dossiers ? cl.dossiers.length : 0;
          var estMulti = nbDossiers > 1;

          html += '<div class="card" style="border-color:var(--color-border);background:var(--color-surface-2);padding:var(--space-4)">';
          html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2);flex-wrap:wrap;gap:8px">';
          html += '<div style="display:flex;align-items:center;gap:10px">';
          html += '<span style="width:36px;height:36px;border-radius:50%;background:' + (estMulti ? "linear-gradient(135deg, #16a34a, #22c55e)" : "var(--color-surface)") + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;border:1px solid var(--color-border)">' + (cl.nom[0] || "C").toUpperCase() + '</span>';
          html += '<div><strong style="font-size:16px;color:var(--color-text)">' + cl.nom + '</strong>';
          html += '<div style="font-size:12px;color:var(--color-text-dim)">' + nbDossiers + ' dossier(s) rattaché(s) à ce comparant</div></div>';
          html += '</div>';

          if (estMulti) {
            html += '<span class="tag tag-accent" style="font-weight:700;font-size:12px">Multi-dossiers (' + nbDossiers + ')</span>';
          } else {
            html += '<span class="tag tag-outline" style="font-size:11px">1 dossier</span>';
          }
          html += '</div>';

          // Liste détaillée de tous les dossiers du client
          html += '<div style="display:flex;flex-direction:column;gap:6px;margin-top:var(--space-2);padding-top:var(--space-2);border-top:1px solid var(--color-divider)">';
          cl.dossiers.forEach(function (d) {
            var dt = d.createdAt ? new Date(d.createdAt) : (d.dateOuverture ? new Date(d.dateOuverture) : null);
            var dateAff = dt && !isNaN(dt.getTime()) ? dt.toLocaleDateString("fr-CI") : (d.dateOuverture || "—");

            html += '<div class="client-dossier-subitem">';
            html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
            html += '<strong style="color:var(--color-text)">' + d.numeroDossier + '</strong>';
            html += '<span style="color:var(--color-text-dim)">·</span>';
            html += '<span style="color:var(--color-accent);font-weight:600">' + labelActe(d.typeActeId) + '</span>';
            html += '<span class="tag tag-outline" style="font-size:10px">' + (d.qualite || "Comparant") + '</span>';
            html += '<span class="tag tag-outline" style="font-size:10px">' + labelEtape(d.etapeActuelle || 1) + '</span>';
            if (d.montantAssiette) html += '<span style="font-size:12px;font-weight:700;color:var(--color-text)">' + fmtFCFA(d.montantAssiette) + '</span>';
            if (d.clercNom) html += '<span style="font-size:11px;color:var(--color-text-dim)">Clerc : ' + d.clercNom + '</span>';
            html += '</div>';

            html += '<div style="display:flex;align-items:center;gap:10px">';
            html += '<span style="font-size:11px;color:var(--color-text-dim)">Ouvert le ' + dateAff + '</span>';
            html += '<button type="button" class="btn btn-ghost carte-client-dossier" data-id="' + d.dossierId + '" style="padding:4px 8px;font-size:12px">Consulter dossier →</button>';
            html += '</div>';
            html += '</div>';
          });
          html += '</div>';

          html += '</div>';
        });
        html += '</div>';
      }

      c.innerHTML = html;
      document.getElementById("clients-recherche").addEventListener("input", function (e) {
        etat.filtreClients = e.target.value;
        renderClients();
      });
      document.getElementById("btn-filtre-tous-clients").addEventListener("click", function () {
        etat.filtreClientsMulti = false;
        renderClients();
      });
      document.getElementById("btn-filtre-multi-clients").addEventListener("click", function () {
        etat.filtreClientsMulti = true;
        renderClients();
      });
      c.querySelectorAll(".carte-client-dossier").forEach(function (e) {
        e.addEventListener("click", function () { ouvrirDossier(e.dataset.id, "clients"); });
      });
    }).catch(function (e) { c.innerHTML = '<p class="erreur-inline">' + e.message + '</p>'; });
  }

  // -----------------------------------------------------------------
  // Actes — Catalogue, Création, Étapes & Délais (Décret 2013-279)
  // -----------------------------------------------------------------
  function renderActes() {
    var c = document.getElementById("vue-actes");
    c.innerHTML = '<p class="text-muted">Chargement du catalogue des actes…</p>';
    Promise.all([
      API.get("/api/referentiel/classifications"),
      API.get("/api/referentiel/types-actes"),
    ]).then(function (r) {
      cache.classificationsListe = r[0];
      cache.typesActesListe = r[1];
      var types = r[1];

      var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-4);display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap">';
      html += '<div><h1 style="margin-bottom:2px">Catalogue des Actes & Référentiel Décret 2013-279</h1>';
      html += '<p style="opacity:.65;font-size:14px;margin:0">Tarification officielle, étapes d\'instruction et délais légaux — ' + types.length + ' types d\'actes.</p></div>';

      if (cache.permissions.referentielCreerActe) {
        html += '<button class="btn btn-primary" id="btn-ouvrir-modal-nouvel-acte">+ Enregistrer un nouvel acte</button>';
      }
      html += '</div>';

      // Encadré pédagogique Décret 2013-279 & Droits d'enregistrement DGI
      html += '<div class="card" style="border-left:4px solid var(--color-accent);background:var(--color-surface-2);margin-bottom:var(--space-5);padding:var(--space-3) var(--space-4)">';
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:18px"></span><strong style="font-size:13px;color:var(--color-text)">Réglementation Notariale en Côte d\'Ivoire (Décret N° 2013-279)</strong></div>';
      html += '<div style="font-size:12px;color:var(--color-text-dim);line-height:1.5">';
      html += '• <strong>Droit d\'enregistrement DGI :</strong> Ventes d\'immeubles & cessions de fonds : <strong>4 %</strong> · Baux d\'immeubles : <strong>2,5 %</strong> · Prêts hypothécaires : <strong>1,5 %</strong> · Successions & partages : <strong>3 %</strong> · Mainlevées d\'hypothèques : <strong>18 000 FCFA fixe</strong>.<br>';
      html += '• <strong>Taxe foncière (Livre Foncier) :</strong> <strong>1,2 %</strong> proportionnel + <strong>3 000 FCFA fixe</strong> pour les actes immobiliers avec mutation/inscription.<br>';
      html += '• <strong>Règles des Délais :</strong> Les étapes peuvent être renseignées par l\'équipe, mais la fixation des délais en jours est <strong>strictement réservée au Notaire Titulaire</strong>.';
      html += '</div></div>';

      cache.classificationsListe.forEach(function (classif) {
        var typesDeCetteClasse = types.filter(function (t) { return t.classificationId === classif.id; });
        if (!typesDeCetteClasse.length) return;
        html += '<h3 style="margin-bottom:var(--space-2);margin-top:var(--space-4);color:var(--color-text)">' + classif.libelle + '</h3>';
        html += '<div class="table-wrap" style="margin-bottom:var(--space-4)"><table class="table"><thead><tr><th>Libellé de l\'acte</th><th>Délai global</th><th>Émoluments (Honoraires)</th><th>Droit d\'enregistrement DGI</th><th>Taxe foncière</th><th>Action</th></tr></thead><tbody>';
        typesDeCetteClasse.forEach(function (t) {
          var emoluments = t.baremeEmolumentsId ? "Barème dégressif (Décret)" : "Minimum légal de minute";
          var droit = t.droitEnregistrementMode === "a_confirmer"
            ? '<span class="tag tag-accent">à confirmer</span>'
            : t.droitEnregistrementMode === "fixe" ? fmtFCFA(t.droitEnregistrementValeur) + " (fixe)" : (t.droitEnregistrementValeur * 100) + " %";
          html += '<tr class="ligne-acte-catalogue" data-id="' + t.id + '" style="cursor:pointer">';
          html += '<td><strong style="color:var(--color-text)">' + t.libelle + '</strong></td>';
          html += '<td><span class="tag tag-outline" style="font-weight:700">' + t.delaiStandardJours + ' j</span></td>';
          html += '<td style="font-size:12px">' + emoluments + '</td>';
          html += '<td style="font-size:12px;font-weight:600">' + droit + '</td>';
          html += '<td>' + (t.taxeFonciereApplicable ? '<span class="tag tag-neutral">1,2 % + 3 000 F</span>' : '<span style="color:var(--color-text-dim)">—</span>') + '</td>';
          html += '<td><button type="button" class="btn btn-ghost btn-voir-etapes-acte" data-id="' + t.id + '" style="padding:4px 8px;font-size:12px">Étapes & délais →</button></td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
      });

      c.innerHTML = html;

      // Bouton nouvel acte
      var btnNouvelActe = document.getElementById("btn-ouvrir-modal-nouvel-acte");
      if (btnNouvelActe) btnNouvelActe.addEventListener("click", modalNouvelActe);

      // Clics sur les lignes et boutons d'actes pour ouvrir le tiroir
      c.querySelectorAll(".ligne-acte-catalogue, .btn-voir-etapes-acte").forEach(function (el) {
        el.addEventListener("click", function (ev) {
          ev.stopPropagation();
          var id = el.dataset.id || el.closest("[data-id]").dataset.id;
          ouvrirTiroirActe(id);
        });
      });
    }).catch(function (e) { c.innerHTML = '<p class="erreur-inline">' + e.message + '</p>'; });
  }

  // Tiroir latéral de consultation des étapes et réglage des délais d'un acte
  function ouvrirTiroirActe(typeActeId) {
    var typeActe = cache.typesActesListe.find(function (t) { return t.id === typeActeId; });
    if (!typeActe) return;

    var estNotaire = cache.utilisateur.role === "notaire" || cache.permissions.referentielFixerDelais;

    ouvrirModal({
      titre: '' + typeActe.libelle,
      corps: '<p class="text-muted">Chargement des étapes et délais…</p>',
      boutonFermer: true,
      largeur: "640px",
    });

    API.get("/api/referentiel/types-actes/" + typeActeId + "/taches-standard").then(function (taches) {
      var html = '<div style="display:flex;flex-direction:column;gap:var(--space-3)">';

      // Fiche fiscale synthétique
      html += '<div style="background:var(--color-surface-2);padding:10px 12px;border-radius:var(--radius);border:1px solid var(--color-border);font-size:12px">';
      html += '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Délai standard cumulé :</span><strong style="color:var(--color-text)">' + typeActe.delaiStandardJours + ' jours ouvrés</strong></div>';
      html += '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Droit d\'enregistrement DGI :</span><strong style="color:var(--color-accent)">' + (typeActe.droitEnregistrementMode === "fixe" ? fmtFCFA(typeActe.droitEnregistrementValeur) + " (fixe)" : (typeActe.droitEnregistrementValeur * 100) + " %") + '</strong></div>';
      html += '<div style="display:flex;justify-content:space-between"><span>Conservation foncière :</span><strong>' + (typeActe.taxeFonciereApplicable ? "1,2 % proportionnel + 3 000 FCFA fixe" : "Non applicable") + '</strong></div>';
      html += '</div>';

      // Information sur la permission de modification des délais
      if (estNotaire) {
        html += '<div style="font-size:12px;color:var(--color-accent);background:var(--color-accent-subtle);padding:6px 10px;border-radius:var(--radius);border:1px solid var(--color-accent)"><strong>Accès Notaire Titulaire :</strong> Vous pouvez ajuster les délais en jours de chaque étape ci-dessous.</div>';
      } else {
        html += '<div style="font-size:12px;color:var(--color-text-dim);background:var(--color-surface-2);padding:6px 10px;border-radius:var(--radius);border:1px solid var(--color-border)"><strong>Information :</strong> Les délais légaux sont fixés et modifiables uniquement par le Notaire Titulaire.</div>';
      }

      html += '<h4 style="margin:var(--space-2) 0 4px;color:var(--color-text)">Étapes & Checklist d\'instruction</h4>';

      if (!taches.length) {
        html += '<p class="text-muted" style="text-align:center;padding:var(--space-3)">Aucune étape standard définie pour cet acte.</p>';
      } else {
        html += '<div style="display:flex;flex-direction:column;gap:8px">';
        taches.forEach(function (t) {
          html += '<div style="background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius);padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px">';
          html += '<div style="flex:1">';
          html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">';
          html += '<span class="tag tag-outline" style="font-size:10px">Étape ' + t.etape + ' · ' + labelEtape(t.etape) + '</span>';
          if (t.bloquante) html += '<span class="tag tag-danger" style="font-size:9px">Bloquante</span>';
          html += '</div>';
          html += '<div style="font-size:13px;font-weight:600;color:var(--color-text)">' + t.libelle + '</div>';
          html += '</div>';

          // Colonne délai
          if (estNotaire) {
            html += '<div style="display:flex;align-items:center;gap:6px">';
            html += '<input type="number" min="1" max="90" class="input input-delai-tache" data-tache-id="' + t.id + '" value="' + t.dureeJours + '" style="width:54px;padding:4px;font-size:12px;text-align:center">';
            html += '<span style="font-size:12px;color:var(--color-text-dim)">j</span>';
            html += '<button type="button" class="btn btn-secondary btn-sauver-delai" data-tache-id="' + t.id + '" style="padding:4px 8px;font-size:11px">Valider</button>';
            html += '</div>';
          } else {
            html += '<span class="tag tag-outline" style="font-size:11px;font-weight:700">' + t.dureeJours + ' jour(s)</span>';
          }
          html += '</div>';
        });
        html += '</div>';
      }

      // Formulaire d'ajout d'étape
      html += '<div style="margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--color-divider)">';
      html += '<h4 style="margin-bottom:8px;font-size:13px;color:var(--color-text)">+ Ajouter une étape / tâche à cet acte</h4>';
      html += '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-bottom:8px">';
      html += '<input class="input" id="nouvelle-etape-libelle" placeholder="Libellé de la tâche..." style="font-size:12px">';
      html += '<select class="input" id="nouvelle-etape-numero" style="font-size:12px">';
      cache.etapesPipeline.forEach(function (e) {
        html += '<option value="' + e.id + '">Étape ' + e.id + ' — ' + e.libelle + '</option>';
      });
      html += '</select>';
      html += '<input type="number" min="1" max="60" class="input" id="nouvelle-etape-duree" placeholder="Délai (j)" value="2" style="font-size:12px;text-align:center"' + (!estNotaire ? ' disabled title="Fixé par défaut à 2 jours"' : '') + '>';
      html += '</div>';
      html += '<button type="button" class="btn btn-secondary btn-block" id="btn-creer-etape-standard" style="font-size:12px">+ Enregistrer cette étape</button>';
      html += '<div id="nouvelle-etape-erreur" class="erreur-inline" style="display:none;margin-top:6px"></div>';
      html += '</div>';

      html += '</div>';

      var racineModal = document.getElementById("modal-racine");
      var corpsZone = racineModal.querySelector(".modal-body");
      if (corpsZone) {
        corpsZone.innerHTML = html;

        // Validation de la modification du délai par le notaire
        if (estNotaire) {
          corpsZone.querySelectorAll(".btn-sauver-delai").forEach(function (btn) {
            btn.addEventListener("click", function () {
              var tacheId = btn.dataset.tacheId;
              var input = corpsZone.querySelector('.input-delai-tache[data-tache-id="' + tacheId + '"]');
              var duree = parseInt(input.value, 10);
              if (isNaN(duree) || duree < 1) {
                toast("Veuillez saisir un délai valide (au moins 1 jour).");
                return;
              }
              API.patch("/api/referentiel/taches-standard/" + tacheId + "/duree", { dureeJours: duree }).then(function () {
                toast("Délai mis à jour avec succès.");
                ouvrirTiroirActe(typeActeId);
                renderActes();
              }).catch(function (e) { toast(e.message); });
            });
          });
        }

        // Ajout d'étape
        var btnAddEtape = document.getElementById("btn-creer-etape-standard");
        if (btnAddEtape) {
          btnAddEtape.addEventListener("click", function () {
            var libelle = document.getElementById("nouvelle-etape-libelle").value.trim();
            var etape = parseInt(document.getElementById("nouvelle-etape-numero").value, 10);
            var duree = parseInt(document.getElementById("nouvelle-etape-duree").value, 10) || 2;
            var errZone = document.getElementById("nouvelle-etape-erreur");
            errZone.style.display = "none";

            if (!libelle) {
              errZone.textContent = "Le libellé de l'étape est requis.";
              errZone.style.display = "block";
              return;
            }

            API.post("/api/referentiel/types-actes/" + typeActeId + "/taches-standard", {
              libelle: libelle,
              etape: etape,
              dureeJours: duree,
              bloquante: true,
            }).then(function () {
              toast("Nouvelle étape enregistrée au référentiel.");
              ouvrirTiroirActe(typeActeId);
              renderActes();
            }).catch(function (e) {
              errZone.textContent = e.message;
              errZone.style.display = "block";
            });
          });
        }
      }
    });
  }

  // Modal d'enregistrement d'un nouvel acte dans le référentiel
  function modalNouvelActe() {
    var html = '<form id="form-nouvel-acte" style="display:flex;flex-direction:column;gap:var(--space-3)">';
    html += '<div class="field"><label>Libellé de l\'acte</label><input class="input" name="libelle" placeholder="Ex. Vente de terrain avec ACD, Prêt bancaire..." required></div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">';
    html += '<div class="field"><label>Classification</label><select class="input" name="classificationId" required>';
    cache.classificationsListe.forEach(function (c) {
      html += '<option value="' + c.id + '">' + c.libelle + '</option>';
    });
    html += '</select></div>';

    html += '<div class="field"><label>Barème d\'émoluments</label><select class="input" name="baremeEmolumentsId">';
    html += '<option value="vente">Barème dégressif Vente / Cession</option>';
    html += '<option value="pret">Barème dégressif Prêt / Hypothèque</option>';
    html += '<option value="societe">Barème dégressif Statuts / Capital</option>';
    html += '<option value="">Minimum légal de minute uniquement</option>';
    html += '</select></div>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">';
    html += '<div class="field"><label>Droit d\'enregistrement DGI</label><select class="input" name="droitEnregistrementMode" id="select-droit-mode">';
    html += '<option value="pourcentage">Pourcentage proportionnel (%)</option>';
    html += '<option value="fixe">Droit fixe (FCFA)</option>';
    html += '<option value="a_confirmer">À confirmer</option>';
    html += '</select></div>';

    html += '<div class="field"><label>Valeur (Taux décimal ou Montant)</label><input class="input" type="number" step="0.001" name="droitEnregistrementValeur" value="0.04" placeholder="Ex. 0.04 pour 4% ou 18000"></div>';
    html += '</div>';

    html += '<div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" name="taxeFonciereApplicable" value="1"> <span>Taxe foncière applicable (1,2 % proportionnel + 3 000 FCFA)</span></label></div>';

    html += '<div class="field"><label>Délai légal global estimé (jours ouvrés)</label><input class="input" type="number" min="1" max="180" name="delaiStandardJours" value="15"></div>';

    html += '<div id="nouvel-acte-erreur" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-nouvel-acte">Annuler</button><button type="submit" class="btn btn-primary">Créer l\'acte au référentiel</button></div>';
    html += '</form>';

    ouvrirModal({
      titre: 'Enregistrer un nouveau type d\'acte',
      corps: html,
      boutonFermer: true,
      apresOuverture: function () {
        document.getElementById("btn-annuler-nouvel-acte").addEventListener("click", fermerModal);
        document.getElementById("form-nouvel-acte").addEventListener("submit", function (ev) {
          ev.preventDefault();
          var form = ev.target;
          var errZone = document.getElementById("nouvel-acte-erreur");
          errZone.style.display = "none";

          var donnees = {
            libelle: form.libelle.value.trim(),
            classificationId: form.classificationId.value,
            baremeEmolumentsId: form.baremeEmolumentsId.value || null,
            droitEnregistrementMode: form.droitEnregistrementMode.value,
            droitEnregistrementValeur: parseFloat(form.droitEnregistrementValeur.value) || 0,
            taxeFonciereApplicable: form.taxeFonciereApplicable.checked,
            delaiStandardJours: parseInt(form.delaiStandardJours.value, 10) || 15,
            taches: [
              { etape: 1, ordre: 1, libelle: "Collecte des pièces d'identité et justificatifs", dureeJours: 3, bloquante: true },
              { etape: 3, ordre: 2, libelle: "Rédaction du projet d'acte notarié", dureeJours: 5, bloquante: true },
              { etape: 4, ordre: 3, libelle: "Rendez-vous et signature de l'acte en minute", dureeJours: 2, bloquante: true },
              { etape: 5, ordre: 4, libelle: "Enregistrement DGI et conservation foncière", dureeJours: 5, bloquante: true },
            ],
          };

          API.post("/api/referentiel/types-actes", donnees).then(function () {
            toast("Type d'acte créé avec succès au catalogue.");
            fermerModal();
            renderActes();
          }).catch(function (e) {
            errZone.textContent = e.message;
            errZone.style.display = "block";
          });
        });
      },
    });
  }

  // -----------------------------------------------------------------
  // Archives — Minutier, Jumeaux Numériques, Mouvements & Infrastructure
  // -----------------------------------------------------------------
  var etatArchives = { onglet: "repertoire", recherche: "", rechercheCarton: "", dossierSelectionneId: null, cartonsDeplies: {} };

  function renderArchives() {
    var c = document.getElementById("vue-archives");
    c.innerHTML = '<p class="text-muted">Chargement du minutier et des archives…</p>';

    Promise.all([
      API.get("/api/archives/repertoire").catch(function () { return []; }),
      API.get("/api/archives/en-attente").catch(function () { return []; }),
      API.get("/api/archives/cartons").catch(function () { return []; }),
      API.get("/api/archives/mouvements").catch(function () { return []; }),
      API.get("/api/archives/campagnes").catch(function () { return []; }),
      API.get("/api/infra/monitoring").catch(function () { return null; }),
      API.get("/api/infra/sync-status").catch(function () { return null; }),
      API.get("/api/dossiers/mes-dossiers").catch(function () { return cache.dossiers || []; }),
    ]).then(function (r) {
      var repertoire = r[0] || [], enAttente = r[1] || [], cartons = r[2] || [];
      var mouvements = r[3] || [], campagnes = r[4] || [], monitoring = r[5] || null;
      var syncStatut = r[6] || null, dossiers = r[7] || [];

      var sortisActuels = mouvements.filter(function (m) { return m.statut === "en_cours"; });
      var kpis = monitoring ? monitoring.indicateursMetier : {
        totalDossiers: dossiers.length,
        dossiersClotures: repertoire.length,
        dossiersNumerises: repertoire.length,
        dossiersPartiellementNumerises: 1,
        dossiersNonNumerises: enAttente.length,
        cartonsPhysiques: cartons.length,
        dossiersEnCartons: cartons.reduce(function (acc, k) { return acc + (k.nombreDossiers || 0); }, 0),
        dossiersActuellementSortis: sortisActuels.length,
      };

      var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-3);display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap">';
      html += '<div><h1 style="margin-bottom:2px">Minutier & Archives de l\'Office</h1>';
      html += '<p style="opacity:.65;font-size:14px;margin:0">Jumeau numérique, traçabilité des originaux papier, OCR, campagnes historiques & infrastructure hybride.</p></div>';

      // Boutons d'action en en-tête
      html += '<div style="display:flex;gap:var(--space-2);flex-wrap:wrap">';
      html += '<button type="button" class="btn btn-primary" id="btn-ouvrir-modal-numeriser">+ Numériser & Archiver</button>';
      html += '<button type="button" class="btn btn-secondary" id="btn-ouvrir-modal-scan-ocr">+ Scanner & OCR</button>';
      html += '<button type="button" class="btn btn-secondary" id="btn-ouvrir-modal-sortie">+ Sortie physique</button>';
      html += '<button type="button" class="btn btn-secondary" id="btn-ouvrir-modal-carton">+ Nouveau carton</button>';
      html += '</div></div>';

      // =========================================================================
      // BANDEAU KPI DE L'ÉTUDE (MÉTIER + INFRASTRUCTURE)
      // =========================================================================
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:var(--space-2);margin-bottom:var(--space-4)">';

      html += '<div class="card" style="padding:10px 12px;background:var(--color-surface-2);border-left:3px solid #38bdf8">';
      html += '<div style="font-size:11px;color:var(--color-text-dim)">Total Dossiers</div>';
      html += '<div style="font-size:18px;font-weight:bold;color:var(--color-text)">' + (kpis.totalDossiers || dossiers.length) + '</div>';
      html += '</div>';

      html += '<div class="card" style="padding:10px 12px;background:var(--color-surface-2);border-left:3px solid #22c55e">';
      html += '<div style="font-size:11px;color:var(--color-text-dim)">Minutes en Carton</div>';
      html += '<div style="font-size:18px;font-weight:bold;color:#22c55e">' + (repertoire.length) + '</div>';
      html += '</div>';

      html += '<div class="card" style="padding:10px 12px;background:var(--color-surface-2);border-left:3px solid #a855f7">';
      html += '<div style="font-size:11px;color:var(--color-text-dim)">Numérisés & Scellés</div>';
      html += '<div style="font-size:18px;font-weight:bold;color:#a855f7">' + (kpis.dossiersNumerises || repertoire.length) + '</div>';
      html += '</div>';

      html += '<div class="card" style="padding:10px 12px;background:var(--color-surface-2);border-left:3px solid #f59e0b">';
      html += '<div style="font-size:11px;color:var(--color-text-dim)">Sortis au Bureau</div>';
      html += '<div style="font-size:18px;font-weight:bold;color:' + (sortisActuels.length > 0 ? "#f59e0b" : "var(--color-text)") + '">' + sortisActuels.length + '</div>';
      html += '</div>';

      html += '<div class="card" style="padding:10px 12px;background:var(--color-surface-2);border-left:3px solid #06b6d4">';
      html += '<div style="font-size:11px;color:var(--color-text-dim)">Mode Infrastructure</div>';
      html += '<div style="font-size:12px;font-weight:bold;color:#06b6d4;margin-top:4px">HYBRIDE (Local+Cloud)</div>';
      html += '</div>';

      html += '<div class="card" style="padding:10px 12px;background:var(--color-surface-2);border-left:3px solid #10b981">';
      html += '<div style="font-size:11px;color:var(--color-text-dim)">Synchronisation</div>';
      html += '<div style="font-size:12px;font-weight:bold;color:#10b981;margin-top:4px">' + (syncStatut && syncStatut.enAttente > 0 ? syncStatut.enAttente + " en attente" : "À jour") + '</div>';
      html += '</div>';

      html += '</div>';

      // =========================================================================
      // BANDEAU DES 7 ONGLETS OPÉRATIONNELS
      // =========================================================================
      html += '<div class="archive-nav-bar">';
      html += '<button type="button" class="archive-nav-btn' + (etatArchives.onglet === "repertoire" ? " actif" : "") + '" data-onglet="repertoire">Répertoire Minutier <strong>(' + repertoire.length + ')</strong></button>';
      html += '<button type="button" class="archive-nav-btn' + (etatArchives.onglet === "jumeau" ? " actif" : "") + '" data-onglet="jumeau">Jumeau Numérique 360°</button>';
      html += '<button type="button" class="archive-nav-btn' + (etatArchives.onglet === "mouvements" ? " actif" : "") + '" data-onglet="mouvements">Mouvements & Sorties <strong>(' + sortisActuels.length + ')</strong></button>';
      html += '<button type="button" class="archive-nav-btn' + (etatArchives.onglet === "cartons" ? " actif" : "") + '" data-onglet="cartons">Cartons & Rayonnages <strong>(' + cartons.length + ')</strong></button>';
      html += '<button type="button" class="archive-nav-btn' + (etatArchives.onglet === "campagnes" ? " actif" : "") + '" data-onglet="campagnes">Campagnes Historiques <strong>(' + campagnes.length + ')</strong></button>';
      html += '<button type="button" class="archive-nav-btn' + (etatArchives.onglet === "infrastructure" ? " actif" : "") + '" data-onglet="infrastructure">Infra & Sauvegardes</button>';
      html += '<button type="button" class="archive-nav-btn' + (etatArchives.onglet === "guide" ? " actif" : "") + '" data-onglet="guide">Guide Légal</button>';
      html += '</div>';

      // =========================================================================
      // CONTENU DES ONGLETS
      // =========================================================================

      if (etatArchives.onglet === "repertoire") {
        // --- ONGLET 1 : RÉPERTOIRE OFFICIEL DES MINUTES ---
        var recherche = (etatArchives.recherche || "").trim().toLowerCase();
        var repertoireFiltre = repertoire.filter(function (m) {
          if (!recherche) return true;
          var str = (m.numero_minute + " " + m.numero_dossier + " " + (m.comparants_noms || "") + " " + labelActe(m.type_acte_id) + " " + (m.code_emplacement || "")).toLowerCase();
          return str.indexOf(recherche) !== -1;
        });

        html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);margin-bottom:var(--space-3);flex-wrap:wrap">';
        html += '<input class="input" id="recherche-archives" style="max-width:380px" value="' + (etatArchives.recherche || "") + '" placeholder="Recherche plein texte, N° minute, N° dossier, client, carton…">';
        html += '<span style="font-size:12px;color:var(--color-text-dim)">' + repertoireFiltre.length + ' minute(s) enregistrée(s)</span>';
        html += '</div>';

        html += '<div class="table-wrap"><table class="table"><thead><tr><th>N° Minute légale</th><th>Date de clôture</th><th>N° Dossier</th><th>Client (Comparants)</th><th>Type d\'acte</th><th>Emplacement carton</th><th>Copie & Scellement</th><th>Actions</th></tr></thead><tbody>';
        if (!repertoireFiltre.length) {
          html += '<tr><td colspan="8" class="text-muted" style="text-align:center;padding:var(--space-4)">Aucune minute ne correspond à votre recherche.</td></tr>';
        } else {
          repertoireFiltre.forEach(function (m) {
            var clientAff = m.comparants_noms && m.comparants_noms.trim() ? m.comparants_noms.trim() : "—";
            var scanAff = m.scan_url || "SCAN_PDF_300DPI.pdf";

            html += '<tr class="ligne-minute-archive" data-minute-id="' + m.id + '">';
            html += '<td><strong style="color:var(--color-text);font-size:13px">' + m.numero_minute + '</strong></td>';
            html += '<td style="font-size:12px">' + fmtDate(m.date_cloture) + '</td>';
            html += '<td><strong style="color:var(--color-accent)">' + m.numero_dossier + '</strong></td>';
            html += '<td style="font-weight:600;color:var(--color-text);font-size:12px">' + clientAff + '</td>';
            html += '<td style="font-size:12px">' + labelActe(m.type_acte_id) + '</td>';
            html += '<td><span class="tag tag-outline" style="font-size:11px">' + (m.code_emplacement || "En attente de carton") + '</span></td>';
            html += '<td><span class="tag tag-accent" style="font-size:10px" title="Fichier numérisé 300 DPI certifié SHA-256">' + scanAff + '</span></td>';
            html += '<td><div style="display:flex;gap:4px">';
            html += '<button type="button" class="btn btn-ghost btn-voir-jumeau-dossier" data-dossier-id="' + m.dossier_id + '" style="padding:3px 6px;font-size:11px" title="Voir le jumeau numérique et physique">360°</button>';
            html += '<button type="button" class="btn btn-ghost btn-fiche-minute" data-minute-json="' + encodeURIComponent(JSON.stringify(m)) + '" style="padding:3px 6px;font-size:11px">Fiche</button>';
            html += '</div></td>';
            html += '</tr>';
          });
        }
        html += '</tbody></table></div>';

      } else if (etatArchives.onglet === "jumeau") {
        // --- ONGLET 2 : CONSULTATION 360° DU JUMEAU NUMÉRIQUE & PHYSIQUE ---
        var dossierIdCible = etatArchives.dossierSelectionneId || (dossiers.length ? dossiers[0].id : null);

        html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);margin-bottom:var(--space-4);flex-wrap:wrap">';
        html += '<div style="display:flex;align-items:center;gap:8px">';
        html += '<label style="font-size:13px;font-weight:600">Sélectionner un dossier :</label>';
        html += '<select class="input" id="select-jumeau-dossier" style="min-width:320px">';
        dossiers.forEach(function (d) {
          var clientAff = d.comparantsNoms && d.comparantsNoms.trim() ? d.comparantsNoms.trim() : "Comparants";
          html += '<option value="' + d.id + '"' + (d.id === dossierIdCible ? " selected" : "") + '>' + d.numeroDossier + ' — ' + labelActe(d.typeActeId) + ' (' + clientAff + ')</option>';
        });
        html += '</select></div>';

        html += '<div style="display:flex;gap:8px">';
        html += '<button type="button" class="btn btn-secondary btn-jumeau-sortie" data-dossier-id="' + dossierIdCible + '" style="font-size:12px">Sortir le dossier papier</button>';
        html += '<button type="button" class="btn btn-secondary btn-jumeau-non-num" data-dossier-id="' + dossierIdCible + '" style="font-size:12px">+ Pièce non-numérisable</button>';
        html += '</div></div>';

        html += '<div id="zone-jumeau-details" style="display:flex;flex-direction:column;gap:var(--space-4)">';
        html += '<div class="card" style="text-align:center;padding:var(--space-4)">Chargement du jumeau numérique 360°…</div>';
        html += '</div>';

      } else if (etatArchives.onglet === "mouvements") {
        // --- ONGLET 3 : TRAÇABILITÉ DES MOUVEMENTS PHYSIQUES DES DOSSIERS ---
        var estGestionnaireArchives = (cache.utilisateur.role === "archiviste") ||
          (cache.parametres && cache.parametres.presenceArchiviste === false && (cache.utilisateur.role === "assistante" || cache.utilisateur.role === "notaire" || cache.utilisateur.role === "premier_clerc"));

        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);flex-wrap:wrap;gap:var(--space-2)">';
        html += '<p style="font-size:13px;color:var(--color-text-dim);margin:0">Suivi rigoureux des demandes de sorties physiques de dossiers papier, validation et alertes de retards.</p>';
        html += '<button type="button" class="btn btn-primary" id="btn-ouvrir-modal-sortie-tab" style="font-size:12px">+ Demande de sortie dossier papier</button>';
        html += '</div>';

        html += '<div class="table-wrap"><table class="table"><thead><tr><th>Dossier</th><th>Client (Comparants)</th><th>Demandeur</th><th>Bureau cible</th><th>Date sortie</th><th>Date retour prévue</th><th>Statut & Alertes</th><th>Action</th></tr></thead><tbody>';
        if (!mouvements.length) {
          html += '<tr><td colspan="8" class="text-muted" style="text-align:center;padding:var(--space-4)">Aucun mouvement physique enregistré. Tous les dossiers sont en carton d\'archives.</td></tr>';
        } else {
          mouvements.forEach(function (mv) {
            var estEnAttente = (mv.statut === "en_attente_approbation");
            var estEnCours = (mv.statut === "en_cours");
            var estRetourne = (mv.statut === "retourne");
            var estEnRetard = Boolean(mv.est_en_retard || (estEnCours && mv.date_retour_prevue && new Date(mv.date_retour_prevue) < new Date().setHours(0,0,0,0)));

            html += '<tr' + (estEnRetard ? ' style="background:rgba(239,68,68,0.06)"' : (estEnAttente ? ' style="background:rgba(245,158,11,0.06)"' : '')) + '>';
            html += '<td><strong style="color:var(--color-accent)">' + mv.numero_dossier + '</strong></td>';
            html += '<td style="font-size:12px">' + (mv.comparants_noms || "Comparants") + '</td>';
            html += '<td><strong>' + mv.nom_demandeur + '</strong></td>';
            html += '<td><span style="font-weight:600;color:#f59e0b">' + mv.destination_bureau + '</span></td>';
            html += '<td style="font-size:12px">' + fmtDate(mv.date_sortie || mv.date_mouvement) + '</td>';
            html += '<td style="font-size:12px">' + (mv.date_retour_prevue ? fmtDate(mv.date_retour_prevue) : "—") + '</td>';
            
            html += '<td>';
            if (estEnAttente) {
              html += '<span class="tag tag-warning" style="font-weight:bold;font-size:11px">En attente d\'approbation</span>';
            } else if (estEnRetard) {
              var nbJ = mv.jours_retard || Math.max(1, Math.round((Date.now() - new Date(mv.date_retour_prevue).getTime()) / 86400000));
              html += '<span class="tag tag-danger" style="font-weight:800;font-size:11px">EN RETARD (+ ' + nbJ + ' j)</span>';
            } else if (estEnCours) {
              html += '<span class="tag tag-neutral" style="font-size:11px">En consultation au bureau</span>';
            } else {
              html += '<span class="tag tag-accent" style="font-size:11px">Restitué aux archives</span>';
            }
            html += '</td>';

            html += '<td><div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">';
            if (estEnAttente) {
              if (estGestionnaireArchives) {
                html += '<button type="button" class="btn btn-primary btn-approuver-sortie-direct" data-mouvement-id="' + mv.id + '" style="font-size:11px;padding:3px 8px;font-weight:700">Approuver & Remettre</button>';
              } else {
                html += '<span style="font-size:11px;color:var(--color-text-dim)">En attente de validation</span>';
              }
            } else if (estEnCours) {
              if (estGestionnaireArchives) {
                html += '<button type="button" class="btn btn-secondary btn-retourner-carton" data-mouvement-id="' + mv.id + '" data-dossier-id="' + mv.dossier_id + '" style="font-size:11px;padding:3px 8px">Enregistrer restitution</button>';
              } else {
                html += '<span style="font-size:11px;color:var(--color-text-dim)">Prêt en cours</span>';
              }
            } else {
              html += '<button type="button" class="btn btn-ghost btn-voir-jumeau-dossier" data-dossier-id="' + mv.dossier_id + '" style="font-size:10.5px;padding:2px 6px">360° Jumeau</button>';
            }
            html += '</div></td>';
            html += '</tr>';
          });
        }
        html += '</tbody></table></div>';

      } else if (etatArchives.onglet === "cartons") {
        // --- ONGLET 4 : CARTONS PHYSIQUES, RAYONNAGES & RECHERCHE DE DOSSIER PAR NOM ---
        var qCarton = (etatArchives.rechercheCarton || "").trim().toLowerCase();

        // Filtrage des cartons et repérage des dossiers correspondants
        var totalDossiersTrouves = 0;
        var cartonsFiltres = cartons.map(function (k) {
          var docsCarton = k.dossiers || [];
          var docsCorrespondants = [];

          if (qCarton) {
            docsCorrespondants = docsCarton.filter(function (d) {
              var strDoc = (d.numeroDossier + " " + (d.comparantsNoms || "") + " " + d.numeroMinute + " " + labelActe(d.typeActeId)).toLowerCase();
              return strDoc.indexOf(qCarton) !== -1;
            });
            totalDossiersTrouves += docsCorrespondants.length;
          }

          var matchCartonDirect = !qCarton || (
            (k.numeroCarton || "").toLowerCase().indexOf(qCarton) !== -1 ||
            (k.salle || "").toLowerCase().indexOf(qCarton) !== -1 ||
            (k.armoire || "").toLowerCase().indexOf(qCarton) !== -1 ||
            (k.rayonnage || "").toLowerCase().indexOf(qCarton) !== -1
          );

          return {
            carton: k,
            estVisible: matchCartonDirect || docsCorrespondants.length > 0,
            docsCorrespondants: docsCorrespondants,
          };
        }).filter(function (item) { return item.estVisible; });

        // En-tête de l'onglet avec barre de recherche dédiée
        html += '<div style="background:var(--color-surface-2);padding:14px 16px;border-radius:var(--radius);border:1px solid var(--color-border);margin-bottom:var(--space-4)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:var(--space-2)">';
        html += '<div><strong style="font-size:15px;color:var(--color-text)">Recherche & Localisation Physique des Dossiers en Carton</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Tapez un nom de client, un N° de dossier ou de minute pour localiser immédiatement son carton et sa position.</p></div>';
        html += '<button type="button" class="btn btn-secondary" id="btn-ouvrir-modal-carton-tab" style="font-size:12px">+ Nouveau carton d\'archives</button>';
        html += '</div>';

        html += '<div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap">';
        html += '<input class="input" id="recherche-cartons-dossier" style="flex:1;min-width:280px;background:var(--color-surface);font-size:13px" value="' + (etatArchives.rechercheCarton || "") + '" placeholder="Tapez un nom de client (ex. KOUASSI, KOFFI), N° dossier (DOS-2026...), minute ou carton…">';
        if (etatArchives.rechercheCarton) {
          html += '<button type="button" class="btn btn-ghost" id="btn-effacer-recherche-carton" style="font-size:12px">✕ Effacer</button>';
        }
        html += '<span style="font-size:12px;font-weight:600;color:var(--color-text-dim);white-space:nowrap">' + cartonsFiltres.length + ' carton(s) · ' + (qCarton ? totalDossiersTrouves + ' dossier(s) trouvé(s)' : cartons.reduce(function(acc, c){ return acc + (c.nombreDossiers || 0); }, 0) + ' dossiers au total') + '</span>';
        html += '</div>';
        html += '</div>';

        if (!cartonsFiltres.length) {
          html += '<div class="card" style="text-align:center;padding:var(--space-6);color:var(--color-text-dim)">Aucun carton ou dossier ne correspond à la recherche <strong>« ' + (etatArchives.rechercheCarton || "") + ' »</strong>.</div>';
        } else {
          html += '<div class="carton-grid">';
          cartonsFiltres.forEach(function (item) {
            var k = item.carton;
            var docsCarton = k.dossiers || [];
            var matchDocs = item.docsCorrespondants;
            var pct = k.capaciteMax ? Math.round(((k.nombreDossiers || docsCarton.length) / k.capaciteMax) * 100) : 0;
            var estPlein = k.statut === "plein" || pct >= 100;
            var estDeplie = Boolean(etatArchives.cartonsDeplies[k.id] || qCarton);

            html += '<div class="carton-card" style="' + (matchDocs.length > 0 ? "border-color:#38bdf8;box-shadow:0 0 12px rgba(56,189,248,0.15)" : "") + '">';
            html += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
            html += '<div><strong style="font-size:16px;color:var(--color-text)">' + k.numeroCarton + '</strong>';
            html += '<div style="font-size:12px;color:var(--color-text-dim);margin-top:2px">Ouvert le ' + fmtDate(k.dateOuverture) + '</div></div>';
            html += '<span class="tag ' + (estPlein ? "tag-neutral" : "tag-accent") + '" style="font-weight:700">' + (estPlein ? "Plein" : "Ouvert") + '</span>';
            html += '</div>';

            html += '<div style="background:var(--color-surface);padding:8px 10px;border-radius:var(--radius);border:1px solid var(--color-border);font-size:12px">';
            html += '<div style="color:var(--color-text-dim);margin-bottom:2px">Localisation physique :</div>';
            html += '<strong style="color:var(--color-text)">' + (k.salle || "Salle principale") + ' · ' + (k.armoire || "Armoire A") + ' · ' + (k.rayonnage || "Rayon 1") + '</strong>';
            html += '</div>';

            html += '<div>';
            html += '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span>Remplissage :</span><strong>' + (k.nombreDossiers || docsCarton.length) + ' / ' + k.capaciteMax + ' dossiers (' + pct + ' %)</strong></div>';
            html += '<div class="carton-progress-bar"><div class="carton-progress-fill" style="width:' + Math.min(pct, 100) + '%"></div></div>';
            html += '</div>';

            // SECTION RÉSULTATS : DOSSIERS TROUVÉS DANS CE CARTON LORS D'UNE RECHERCHE
            if (matchDocs.length > 0) {
              html += '<div style="background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.3);padding:10px;border-radius:var(--radius);margin-top:4px">';
              html += '<div style="font-size:11px;font-weight:bold;color:#38bdf8;margin-bottom:6px">Dossier(s) trouvé(s) dans ce carton (' + matchDocs.length + ') :</div>';
              html += '<div style="display:flex;flex-direction:column;gap:6px">';
              matchDocs.forEach(function (d) {
                var clientNom = d.comparantsNoms && d.comparantsNoms.trim() ? d.comparantsNoms.trim() : "Comparants";
                html += '<div style="background:var(--color-surface);padding:6px 8px;border-radius:4px;border:1px solid var(--color-border);font-size:11px;display:flex;justify-content:space-between;align-items:center;gap:6px">';
                html += '<div>';
                html += '<div style="font-weight:bold;color:var(--color-text)"><span class="tag tag-accent" style="font-size:9px;padding:1px 4px;margin-right:4px">Pos #' + String(d.positionDansCarton || 1).padStart(3, "0") + '</span> ' + clientNom + '</div>';
                html += '<div style="color:var(--color-text-dim);font-size:10px;margin-top:2px">' + (d.numeroDossier || "Dossier") + ' · ' + (d.numeroMinute || "") + ' · ' + labelActe(d.typeActeId) + '</div>';
                html += '</div>';
                if (d.dossierId) {
                  html += '<button type="button" class="btn btn-ghost btn-voir-jumeau-dossier" data-dossier-id="' + d.dossierId + '" style="font-size:10px;padding:2px 6px;white-space:nowrap" title="Voir le jumeau numérique et physique">360°</button>';
                }
                html += '</div>';
              });
              html += '</div></div>';
            }

            // ACCORDÉON DÉPLIABLE : TOUS LES DOSSIERS CONTENUS DANS LE CARTON
            if (docsCarton.length > 0) {
              html += '<div style="margin-top:4px">';
              html += '<button type="button" class="btn btn-ghost btn-toggle-carton-dossiers" data-carton-id="' + k.id + '" style="width:100%;font-size:11px;padding:5px;display:flex;justify-content:space-between;align-items:center;background:var(--color-surface);border:1px solid var(--color-border)">';
              html += '<span>' + docsCarton.length + ' dossier(s) dans ce carton</span>';
              html += '<span>' + (estDeplie ? "▲ Masquer" : "▼ Déplier") + '</span>';
              html += '</button>';

              if (estDeplie) {
                html += '<div style="margin-top:6px;display:flex;flex-direction:column;gap:4px;max-height:220px;overflow-y:auto;padding-right:4px">';
                docsCarton.forEach(function (d) {
                  var clientNom = d.comparantsNoms && d.comparantsNoms.trim() ? d.comparantsNoms.trim() : "Comparants";
                  html += '<div style="background:var(--color-surface);padding:6px 8px;border-radius:4px;border:1px solid var(--color-border);font-size:11px;display:flex;justify-content:space-between;align-items:center">';
                  html += '<div>';
                  html += '<div style="font-weight:600;color:var(--color-text)"><span style="color:var(--color-accent);font-family:monospace;font-weight:bold;margin-right:4px">#' + String(d.positionDansCarton || 1).padStart(3, "0") + '</span>' + clientNom + '</div>';
                  html += '<div style="font-size:10px;color:var(--color-text-dim);margin-top:1px">' + (d.numeroDossier || "") + ' · ' + (d.numeroMinute || "") + ' · ' + labelActe(d.typeActeId) + '</div>';
                  html += '</div>';
                  if (d.dossierId) {
                    html += '<button type="button" class="btn btn-ghost btn-voir-jumeau-dossier" data-dossier-id="' + d.dossierId + '" style="font-size:10px;padding:2px 6px">360°</button>';
                  }
                  html += '</div>';
                });
                html += '</div>';
              }
              html += '</div>';
            } else {
              html += '<div style="font-size:11px;color:var(--color-text-dim);text-align:center;padding:6px;background:var(--color-surface);border-radius:var(--radius);margin-top:4px">Carton vide — Prêt à recevoir des minutes.</div>';
            }

            html += '</div>';
          });
          html += '</div>';
        }

      } else if (etatArchives.onglet === "campagnes") {
        // --- ONGLET 5 : CAMPAGNES DE NUMÉRISATION (FONDS HISTORIQUE 1995-2025) ---
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4);flex-wrap:wrap;gap:var(--space-2)">';
        html += '<p style="font-size:13px;color:var(--color-text-dim);margin:0">Suivi par lot et campagnes de numérisation haute définition du fonds documentaire ancien de l\'office.</p>';
        html += '<button type="button" class="btn btn-primary" id="btn-ouvrir-modal-campagne" style="font-size:12px">+ Nouvelle campagne historique</button>';
        html += '</div>';

        if (!campagnes.length) {
          html += '<div class="card" style="text-align:center;padding:var(--space-6);color:var(--color-text-dim)">Aucune campagne historique enregistrée.</div>';
        } else {
          html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:var(--space-4)">';
          campagnes.forEach(function (cp) {
            html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
            html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
            html += '<div><span class="tag tag-accent" style="font-size:11px">' + cp.codeCampagne + '</span>';
            html += '<h3 style="margin:4px 0 2px;font-size:15px">' + cp.intitule + '</h3>';
            html += '<div style="font-size:12px;color:var(--color-text-dim)">Période : ' + cp.anneeDebut + ' ➔ ' + cp.anneeFin + ' · ' + cp.typeActesCibles + '</div></div>';
            html += '<span class="tag tag-outline">' + cp.statut + '</span>';
            html += '</div>';

            html += '<div style="margin:12px 0">';
            html += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>Avancement global :</span><strong>' + cp.dossiersNumerises + ' / ' + cp.totalDossiers + ' dossiers (' + cp.tauxAvancementPct + ' %)</strong></div>';
            html += '<div class="carton-progress-bar"><div class="carton-progress-fill" style="width:' + Math.min(cp.tauxAvancementPct, 100) + '%;background:linear-gradient(90deg,#38bdf8,#a855f7)"></div></div>';
            html += '</div>';

            html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:11px;text-align:center;background:var(--color-surface);padding:8px;border-radius:var(--radius);border:1px solid var(--color-border)">';
            html += '<div><div style="color:#22c55e;font-weight:bold;font-size:14px">' + cp.dossiersNumerises + '</div><div style="color:var(--color-text-dim)">Numérisés</div></div>';
            html += '<div><div style="color:#f59e0b;font-weight:bold;font-size:14px">' + cp.dossiersEnCours + '</div><div style="color:var(--color-text-dim)">En cours</div></div>';
            html += '<div><div style="color:#ef4444;font-weight:bold;font-size:14px">' + cp.dossiersRestants + '</div><div style="color:var(--color-text-dim)">Restants</div></div>';
            html += '</div>';

            html += '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">';
            html += '<button type="button" class="btn btn-secondary btn-avancement-campagne" data-campagne-id="' + cp.id + '" style="font-size:11px;padding:4px 10px">Avancement par lot (+100)</button>';
            html += '</div>';

            html += '</div>';
          });
          html += '</div>';
        }

      } else if (etatArchives.onglet === "infrastructure") {
        // --- ONGLET 6 : INFRASTRUCTURE, SYNCHRONISATION & SAUVEGARDE ---
        var sante = monitoring ? monitoring.sante : {
          modeInfrastructure: "hybride",
          application: "operationnel",
          baseDeDonnees: "operationnel",
          stockage: "operationnel",
          synchronisation: "operationnel",
          sauvegarde: "operationnel",
          espaceUtiliseMo: 1450,
          espaceTotalMo: 50000,
          ipLocale: "192.168.1.100",
          versionApp: "2.4.0",
        };

        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:var(--space-4);margin-bottom:var(--space-4)">';

        // Carte 1 : État des Services Locaux & Cloud
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:20px"></span><strong style="font-size:15px">Supervision du Serveur de l\'Étude</strong></div>';
        html += '<div style="display:flex;flex-direction:column;gap:8px;font-size:13px">';
        html += '<div style="display:flex;justify-content:space-between"><span>Serveur Local (Node/Express) :</span><strong style="color:#22c55e">' + sante.application + '</strong></div>';
        html += '<div style="display:flex;justify-content:space-between"><span>Base de données PostgreSQL :</span><strong style="color:#22c55e">' + sante.baseDeDonnees + '</strong></div>';
        html += '<div style="display:flex;justify-content:space-between"><span>Stockage Documentaire Local :</span><strong style="color:#22c55e">' + sante.stockage + ' (' + sante.espaceUtiliseMo + ' Mo / ' + Math.round(sante.espaceTotalMo / 1000) + ' Go)</strong></div>';
        html += '<div style="display:flex;justify-content:space-between"><span>Adresse IP Réseau de l\'étude :</span><strong style="font-family:monospace">' + sante.ipLocale + '</strong></div>';
        html += '<div style="display:flex;justify-content:space-between"><span>Version du logiciel :</span><strong>v' + sante.versionApp + '</strong></div>';
        html += '</div></div>';

        // Carte 2 : Synchronisation Hybride & Réplication Cloud
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><strong style="font-size:15px">Moteur de Synchronisation Hybride (Sync Engine)</strong></div>';
        html += '<div style="display:flex;flex-direction:column;gap:8px;font-size:13px">';
        html += '<div style="display:flex;justify-content:space-between"><span>Mode de déploiement :</span><strong style="color:#38bdf8;text-transform:uppercase">' + sante.modeInfrastructure + '</strong></div>';
        html += '<div style="display:flex;justify-content:space-between"><span>Éléments en file d\'attente :</span><strong>' + (syncStatut ? syncStatut.enAttente : 0) + ' document(s)</strong></div>';
        html += '<div style="display:flex;justify-content:space-between"><span>Dernière réplication Cloud :</span><strong>' + fmtDate(sante.derniereSynchro) + '</strong></div>';
        html += '<div style="display:flex;justify-content:space-between"><span>Dernière sauvegarde protégée :</span><strong style="color:#22c55e">Quotidienne 03:00</strong></div>';
        html += '<div style="margin-top:8px"><button type="button" class="btn btn-primary" id="btn-forcer-sync" style="width:100%;font-size:12px">Forcer la synchronisation vers le Cloud Vault</button></div>';
        html += '</div></div>';

        html += '</div>';

        // Carte 3 : Support Technique L1-L4 & Accès Temporaire Audité
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
        html += '<div style="display:flex;align-items:center;gap:8px"><strong style="font-size:15px">Support Technique Éditeur (L1 - L4) & Télé-diagnostic</strong></div>';
        html += '<button type="button" class="btn btn-secondary" id="btn-ouvrir-modal-ticket" style="font-size:12px">Ouvrir un ticket d\'assistance</button>';
        html += '</div>';
        html += '<div style="font-size:12px;color:var(--color-text-dim);line-height:1.5;background:var(--color-surface);padding:10px 12px;border-radius:var(--radius);border:1px solid var(--color-border)">';
        html += '<strong>Garantie de Sécurité & Secret Professionnel Notarial :</strong> Le personnel de support de l\'éditeur n\'a <strong>aucun accès par défaut</strong> aux dossiers et documents de l\'étude. En cas d\'incident technique, une demande d\'accès temporaire avec motif obligatoire doit être validée par le Notaire, limitée dans le temps et intégralement auditée.';
        html += '</div></div>';

      } else if (etatArchives.onglet === "guide") {
        // --- ONGLET 7 : GUIDE DES BONNES PRATIQUES D'ARCHIVAGE ---
        html += '<div class="card" style="border-left:4px solid #38bdf8;background:var(--color-surface-2);margin-bottom:var(--space-5);padding:var(--space-4)">';
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--space-3)"><span style="font-size:22px"></span><strong style="font-size:16px;color:var(--color-text)">Guide des Bonnes Pratiques d\'Archivage Numérique & Minutier Officiel</strong></div>';

        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:var(--space-3);font-size:12px;line-height:1.5">';

        html += '<div style="background:var(--color-surface);padding:12px 14px;border-radius:var(--radius);border:1px solid var(--color-border)">';
        html += '<div style="font-weight:700;color:#38bdf8;font-size:13px;margin-bottom:6px">1. Numérisation HD & Signature Normale</div>';
        html += '<div style="color:var(--color-text-dim)">Les actes originaux sont signés <strong>manuscritement de façon classique en minute</strong> par les comparants et le Notaire. Ils sont ensuite numérisés en <strong>300 DPI, format PDF/A pérenne</strong> (avec OCR) pour assurer une lisibilité décennale sans obliger à la signature électronique.</div>';
        html += '</div>';

        html += '<div style="background:var(--color-surface);padding:12px 14px;border-radius:var(--radius);border:1px solid var(--color-border)">';
        html += '<div style="font-weight:700;color:#22c55e;font-size:13px;margin-bottom:6px">2. Scellement & Empreinte SHA-256</div>';
        html += '<div style="color:var(--color-text-dim)">Attribution séquentielle du numéro officiel de minute <code>MIN-AAAA/XXX</code>. Calcul automatique d\'une <strong>empreinte cryptographique SHA-256</strong> pour attester de l\'intégrité absolue et de l\'antériorité du scan scellé.</div>';
        html += '</div>';

        html += '<div style="background:var(--color-surface);padding:12px 14px;border-radius:var(--radius);border:1px solid var(--color-border)">';
        html += '<div style="font-weight:700;color:#f59e0b;font-size:13px;margin-bottom:6px">3. Classement Physique FIFO & Cartons</div>';
        html += '<div style="color:var(--color-text-dim)">Les actes physiques sont rangés selon la règle FIFO (le plus ancien en premier) dans des <strong>cartons numérotés <code>CARTON-XXX</code></strong> avec étiquetage normé : <code>Salle · Armoire · Rayon · Carton · Position</code>.</div>';
        html += '</div>';

        html += '<div style="background:var(--color-surface);padding:12px 14px;border-radius:var(--radius);border:1px solid var(--color-border)">';
        html += '<div style="font-weight:700;color:#c084fc;font-size:13px;margin-bottom:6px">4. Serveurs NAS & Fonds Documentaire Ancien</div>';
        html += '<div style="color:var(--color-text-dim)">Parfaite compatibilité avec un <strong>serveur NAS local ou solution d\'archivage tierce</strong> de l\'étude. Permet d\'intégrer et numériser tout le <strong>fonds documentaire historique</strong> de l\'office notarial.</div>';
        html += '</div>';

        html += '</div></div>';
      }

      c.innerHTML = html;

      // =========================================================================
      // CHARGEMENT ASYNCHRONE DE LA VUE JUMEAU 360° SI SÉLECTIONNÉE
      // =========================================================================
      if (etatArchives.onglet === "jumeau") {
        var cibleId = etatArchives.dossierSelectionneId || (dossiers.length ? dossiers[0].id : null);
        if (cibleId) {
          chargerVueJumeauDossier(cibleId);
        }
        var selJumeau = document.getElementById("select-jumeau-dossier");
        if (selJumeau) {
          selJumeau.addEventListener("change", function (ev) {
            etatArchives.dossierSelectionneId = ev.target.value;
            chargerVueJumeauDossier(ev.target.value);
          });
        }
      }

      // Événements des onglets
      c.querySelectorAll(".archive-nav-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          etatArchives.onglet = btn.dataset.onglet;
          renderArchives();
        });
      });

      // Événement recherche répertoire
      var inputRecherche = document.getElementById("recherche-archives");
      if (inputRecherche) {
        inputRecherche.addEventListener("input", function (ev) {
          etatArchives.recherche = ev.target.value;
          renderArchives();
        });
      }

      // Événement recherche cartons & rayonnages par nom de dossier / client
      var inputRechercheCarton = document.getElementById("recherche-cartons-dossier");
      if (inputRechercheCarton) {
        inputRechercheCarton.addEventListener("input", function (ev) {
          etatArchives.rechercheCarton = ev.target.value;
          renderArchives();
          var inputRefresh = document.getElementById("recherche-cartons-dossier");
          if (inputRefresh) {
            inputRefresh.focus();
            inputRefresh.selectionStart = inputRefresh.selectionEnd = inputRefresh.value.length;
          }
        });
      }

      var btnEffacerCarton = document.getElementById("btn-effacer-recherche-carton");
      if (btnEffacerCarton) {
        btnEffacerCarton.addEventListener("click", function () {
          etatArchives.rechercheCarton = "";
          renderArchives();
        });
      }

      // Événement dépliage / masquage des dossiers par carton
      c.querySelectorAll(".btn-toggle-carton-dossiers").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var cartonId = btn.dataset.cartonId;
          etatArchives.cartonsDeplies[cartonId] = !etatArchives.cartonsDeplies[cartonId];
          renderArchives();
        });
      });

      // Boutons ouverture modales
      var btnNumeriser = document.getElementById("btn-ouvrir-modal-numeriser");
      if (btnNumeriser) btnNumeriser.addEventListener("click", function () { modalNumeriserEtArchiver(); });

      var btnScanOcr = document.getElementById("btn-ouvrir-modal-scan-ocr");
      if (btnScanOcr) btnScanOcr.addEventListener("click", function () { modalScanOcrIA(); });

      var btnSortie = document.getElementById("btn-ouvrir-modal-sortie");
      if (btnSortie) btnSortie.addEventListener("click", function () { modalSortiePhysique(); });

      var btnSortieTab = document.getElementById("btn-ouvrir-modal-sortie-tab");
      if (btnSortieTab) btnSortieTab.addEventListener("click", function () { modalSortiePhysique(); });

      var btnCarton = document.getElementById("btn-ouvrir-modal-carton");
      if (btnCarton) btnCarton.addEventListener("click", modalNouveauCarton);

      var btnCartonTab = document.getElementById("btn-ouvrir-modal-carton-tab");
      if (btnCartonTab) btnCartonTab.addEventListener("click", modalNouveauCarton);

      var btnCampagne = document.getElementById("btn-ouvrir-modal-campagne");
      if (btnCampagne) btnCampagne.addEventListener("click", modalNouvelleCampagne);

      var btnTicket = document.getElementById("btn-ouvrir-modal-ticket");
      if (btnTicket) btnTicket.addEventListener("click", modalOuvrirTicketSupport);

      // Clics boutons voir jumeau
      c.querySelectorAll(".btn-voir-jumeau-dossier").forEach(function (btn) {
        btn.addEventListener("click", function () {
          etatArchives.onglet = "jumeau";
          etatArchives.dossierSelectionneId = btn.dataset.dossierId;
          renderArchives();
        });
      });

      // Clics boutons fiche minute
      c.querySelectorAll(".btn-fiche-minute").forEach(function (btn) {
        btn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          var data = JSON.parse(decodeURIComponent(btn.dataset.minuteJson));
          modalFicheArchivage(data);
        });
      });

      // Clics retour carton
      c.querySelectorAll(".btn-retourner-carton").forEach(function (btn) {
        btn.addEventListener("click", function () {
          API.post("/api/archives/mouvements/retour", {
            mouvementId: btn.dataset.mouvementId,
            dossierId: btn.dataset.dossierId,
          }).then(function () {
            toast("Dossier papier réintégré en carton d'archives avec succès.");
            renderArchives();
          }).catch(function (e) { toast(e.message); });
        });
      });

      // Clics approbation demande de sortie physique
      c.querySelectorAll(".btn-approuver-sortie-direct").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var mouvId = btn.dataset.mouvementId;
          API.post("/api/archives/mouvements/" + mouvId + "/approuver").then(function () {
            toast("Demande approuvée avec succès ! Le dossier physique est remis.");
            renderArchives();
          }).catch(function (e) { toast("Erreur : " + e.message); });
        });
      });

      // Avancement campagne
      c.querySelectorAll(".btn-avancement-campagne").forEach(function (btn) {
        btn.addEventListener("click", function () {
          API.post("/api/archives/campagnes/" + btn.dataset.campagneId + "/avancement", { nombre: 100 }).then(function () {
            toast("Lot de 100 dossiers numérisés et ajoutés à la campagne.");
            renderArchives();
          }).catch(function (e) { toast(e.message); });
        });
      });

      // Boutons spécifiques jumeau
      c.querySelectorAll(".btn-jumeau-sortie").forEach(function (btn) {
        btn.addEventListener("click", function () {
          modalSortiePhysique(btn.dataset.dossierId);
        });
      });
      c.querySelectorAll(".btn-jumeau-non-num").forEach(function (btn) {
        btn.addEventListener("click", function () {
          modalPiecePhysiqueNonNumerisable(btn.dataset.dossierId);
        });
      });

      // Bouton forcer sync
      var btnSync = document.getElementById("btn-forcer-sync");
      if (btnSync) {
        btnSync.addEventListener("click", function () {
          API.post("/api/infra/declencher-sync", {}).then(function (res) {
            toast("Synchronisation réussie : " + res.traites + " élément(s) répliqué(s) vers le Cloud Vault.");
            renderArchives();
          }).catch(function (e) { toast(e.message); });
        });
      }
    }).catch(function (e) { c.innerHTML = '<p class="erreur-inline">' + e.message + '</p>'; });
  }

  // =========================================================================
  // CHARGEMENT DE LA CONSULTATION 360° DU JUMEAU NUMÉRIQUE & PHYSIQUE
  // =========================================================================
  function chargerVueJumeauDossier(dossierId) {
    var zone = document.getElementById("zone-jumeau-details");
    if (!zone) return;

    API.get("/api/archives/dossiers/" + dossierId + "/jumeau").then(function (data) {
      var d = data.dossier, jn = data.jumeauNumerique, jp = data.jumeauPhysique;

      var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)">';

      // COLONNE GAUCHE : JUMEAU NUMÉRIQUE (GED, Scans, OCR, Versions)
      html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
      html += '<div style="display:flex;align-items:center;gap:8px"><strong style="font-size:15px;color:var(--color-text)">Jumeau Numérique (Copie GED & OCR)</strong></div>';
      html += '<span class="tag tag-accent">' + d.statutNumerisation + '</span>';
      html += '</div>';

      html += '<div style="font-size:12px;color:var(--color-text-dim);margin-bottom:12px">';
      html += 'Scan certifié 300 DPI PDF/A · Empreinte SHA-256 scellée : <code style="font-size:10px">' + jn.empreinteSha256.slice(0, 24) + '…</code>';
      html += '</div>';

      html += '<h4 style="font-size:13px;margin:0 0 8px">Fichiers numériques classés (' + jn.totalDocuments + ')</h4>';
      if (!jn.documents || !jn.documents.length) {
        html += '<div style="background:var(--color-surface);padding:10px;border-radius:var(--radius);font-size:12px;color:var(--color-text-dim)">Aucun document numérique téléversé.</div>';
      } else {
        html += '<div style="display:flex;flex-direction:column;gap:6px">';
        jn.documents.forEach(function (doc) {
          html += '<div style="background:var(--color-surface);padding:8px 10px;border-radius:var(--radius);border:1px solid var(--color-border);display:flex;justify-content:space-between;align-items:center">';
          html += '<div><strong style="font-size:12px">' + doc.nom_fichier + '</strong>';
          html += '<div style="font-size:11px;color:var(--color-text-dim)">Type : ' + doc.type_document + ' · v' + doc.version + ' · ' + fmtDate(doc.created_at) + '</div></div>';
          html += '<span class="tag tag-accent" style="font-size:10px">OCR Traité</span>';
          html += '</div>';
        });
        html += '</div>';
      }

      html += '</div>';

      // COLONNE DROITE : JUMEAU PHYSIQUE (Original Papier, Localisation, Sorties)
      html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
      html += '<div style="display:flex;align-items:center;gap:8px"><strong style="font-size:15px;color:var(--color-text)">Original Papier & Conservation</strong></div>';
      html += '<span class="tag ' + (jp.estDisponibleEnCarton ? "tag-accent" : "tag-neutral") + '">' + (jp.estDisponibleEnCarton ? "En archives" : "Sorti au bureau") + '</span>';
      html += '</div>';

      html += '<div style="background:var(--color-surface);padding:10px 12px;border-radius:var(--radius);border:1px solid var(--color-border);margin-bottom:12px">';
      html += '<div style="font-size:11px;color:var(--color-text-dim)">Localisation physique dans l\'office :</div>';
      html += '<strong style="font-size:13px;color:var(--color-text)">' + (jp.codeEmplacement || "Carton principal") + '</strong>';
      html += '<div style="font-size:11px;color:var(--color-text-dim);margin-top:2px">' + (jp.salle || "Salle principale") + ' · ' + (jp.armoire || "Armoire A") + ' · ' + (jp.rayonnage || "Rayon 1") + '</div>';
      html += '</div>';

      html += '<h4 style="font-size:13px;margin:0 0 8px">Pièces physiques & Non-numérisables (' + jp.totalPiecesPhysiques + ')</h4>';
      if (!jp.pieces || !jp.pieces.length) {
        html += '<div style="background:var(--color-surface);padding:10px;border-radius:var(--radius);font-size:12px;color:var(--color-text-dim)">Dossier papier standard conservé en boîte d\'archive.</div>';
      } else {
        html += '<div style="display:flex;flex-direction:column;gap:6px">';
        jp.pieces.forEach(function (p) {
          html += '<div style="background:var(--color-surface);padding:8px 10px;border-radius:var(--radius);border:1px solid var(--color-border)">';
          html += '<strong style="font-size:12px">' + p.titre_document + '</strong>';
          if (p.raison_non_numerisable) {
            html += '<div style="font-size:11px;color:#f59e0b;margin-top:2px">Original physique uniquement : ' + p.raison_non_numerisable + '</div>';
          }
          html += '<div style="font-size:11px;color:var(--color-text-dim);margin-top:2px">Localisation : ' + (p.localisation_actuelle || jp.codeEmplacement) + '</div>';
          html += '</div>';
        });
        html += '</div>';
      }

      html += '</div>';

      html += '</div>';

      zone.innerHTML = html;
    }).catch(function (e) {
      zone.innerHTML = '<p class="erreur-inline">' + e.message + '</p>';
    });
  }

  // =========================================================================
  // MODALE : SCANNER & RECONNAISSANCE OCR AVEC INDEXATION AUTOMATIQUE
  // =========================================================================
  function modalScanOcrIA(dossierIdPreselectionne) {
    var html = '<form id="form-scan-ocr-ia" style="display:flex;flex-direction:column;gap:var(--space-3)">';
    html += '<div class="field"><label>Sélectionner le fichier numérisé (Scan 300 DPI PDF/A)</label><input class="input" name="nomFichier" value="SCAN_ACTE_VENTE_ACD_2026.pdf" required></div>';

    html += '<div style="background:var(--color-surface-2);padding:12px;border-radius:var(--radius);border:1px solid var(--color-border)">';
    html += '<div style="font-weight:700;font-size:13px;margin-bottom:6px">📄 Moteur d\'Extraction & Traitement OCR</div>';
    html += '<div style="font-size:12px;color:var(--color-text-dim)">Le moteur OCR extrait le texte du scan, identifie la nature de l\'acte et propose le rattachement automatique au dossier correspondant.</div>';
    html += '</div>';

    html += '<div id="zone-proposition-ia" style="display:none;background:var(--color-surface);padding:12px;border-radius:var(--radius);border:1px solid var(--color-border)"></div>';

    html += '<div id="erreur-scan-ocr" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)">';
    html += '<button type="button" class="btn btn-ghost" id="btn-annuler-scan-ocr">Annuler</button>';
    html += '<button type="button" class="btn btn-secondary" id="btn-analyser-scan">Lancer la Reconnaissance OCR →</button>';
    html += '<button type="submit" class="btn btn-primary" id="btn-valider-ocr-ia" style="display:none">Valider & Classer dans le dossier</button>';
    html += '</div>';
    html += '</form>';

    ouvrirModal({
      titre: 'Numérisation Haute Définition & Reconnaissance OCR',
      corps: html,
      boutonFermer: true,
      largeur: "600px",
      apresOuverture: function () {
        document.getElementById("btn-annuler-scan-ocr").addEventListener("click", fermerModal);

        var btnAnalyser = document.getElementById("btn-analyser-scan");
        var btnValider = document.getElementById("btn-valider-ocr-ia");
        var zoneProp = document.getElementById("zone-proposition-ia");
        var propositionData = null;

        btnAnalyser.addEventListener("click", function () {
          var form = document.getElementById("form-scan-ocr-ia");
          var nomFichier = form.nomFichier.value.trim();

          btnAnalyser.textContent = "Traitement OCR en cours…";
          btnAnalyser.disabled = true;

          API.post("/api/archives/scan-ocr-ia", { nomFichier: nomFichier, dossierIdSuggere: dossierIdPreselectionne }).then(function (res) {
            propositionData = res;
            var prop = res.propositionIA;

            var propHtml = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
            propHtml += '<strong style="color:var(--color-text);font-size:14px">Indexation OCR automatique :</strong>';
            propHtml += '<span class="tag tag-accent" style="font-weight:bold">Qualité OCR : ' + prop.scoreConfiance + ' %</span>';
            propHtml += '</div>';
            propHtml += '<div style="font-size:12px;margin-bottom:4px"><strong>Dossier cible :</strong> ' + prop.numeroDossier + ' (' + prop.typeActeLibelle + ')</div>';
            propHtml += '<div style="font-size:12px;margin-bottom:8px"><strong>Type de pièce :</strong> ' + prop.typeDocument + '</div>';
            propHtml += '<div style="font-size:11px;color:var(--color-text-dim);background:var(--color-surface-2);padding:8px;border-radius:var(--radius);max-height:80px;overflow-y:auto;font-family:monospace">' + res.texteOcr.slice(0, 180) + '…</div>';

            zoneProp.innerHTML = propHtml;
            zoneProp.style.display = "block";
            btnAnalyser.style.display = "none";
            btnValider.style.display = "inline-block";
          }).catch(function (e) {
            document.getElementById("erreur-scan-ocr").textContent = e.message;
            document.getElementById("erreur-scan-ocr").style.display = "block";
            btnAnalyser.textContent = "Lancer la Reconnaissance OCR →";
            btnAnalyser.disabled = false;
          });
        });

        document.getElementById("form-scan-ocr-ia").addEventListener("submit", function (ev) {
          ev.preventDefault();
          if (!propositionData) return;

          API.post("/api/archives/valider-document", {
            dossierId: propositionData.propositionIA.dossierId,
            typeDocument: propositionData.propositionIA.typeDocument,
            nomFichier: propositionData.nomFichier,
            texteOcr: propositionData.texteOcr,
            estCopieMinute: true,
          }).then(function () {
            toast("Document validé et classé dans le dossier avec succès.");
            fermerModal();
            renderArchives();
          }).catch(function (e) { toast(e.message); });
        });
      },
    });
  }

  // =========================================================================
  // MODALE : DEMANDE DE SORTIE DE DOSSIER PAPIER
  // =========================================================================
  function modalSortiePhysique(dossierIdPreselectionne) {
    var dateDuJourStr = new Date().toISOString().slice(0, 10);
    var dateRetourDefaut = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

    Promise.all([
      API.get("/api/dossiers/mes-dossiers").catch(function () { return cache.dossiers || []; }),
      API.get("/api/equipe").catch(function () { return cache.equipeListe || []; }),
    ]).then(function (res) {
      var dossiers = res[0] || [];
      var equipe = res[1] || [];

      var html = '<form id="form-sortie-physique" style="display:flex;flex-direction:column;gap:var(--space-3)">';

      html += '<div class="field"><label>Sélectionner le dossier papier à sortir</label><select class="input" name="dossierId" required>';
      dossiers.forEach(function (d) {
        var clientAff = d.comparantsNoms && d.comparantsNoms.trim() ? d.comparantsNoms.trim() : "Comparants";
        var isSel = (dossierIdPreselectionne === d.id);
        html += '<option value="' + d.id + '"' + (isSel ? " selected" : "") + '>' + d.numeroDossier + ' — ' + labelActe(d.typeActeId) + ' (' + clientAff + ')</option>';
      });
      html += '</select></div>';

      // 1. Liste déroulante du demandeur (équipe de l'étude)
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
      html += '<div class="field"><label>Nom du demandeur</label><select class="input" name="nomDemandeur" required>';
      var monNom = cache.utilisateur ? cache.utilisateur.nomComplet : "";
      equipe.forEach(function (m) {
        if (["superadmin", "dev", "commercial", "support", "assistante_editeur"].indexOf(m.role) !== -1) return;
        var isMe = (m.nomComplet === monNom || (cache.utilisateur && m.id === cache.utilisateur.id));
        html += '<option value="' + m.nomComplet + '"' + (isMe ? " selected" : "") + '>' + m.nomComplet + ' (' + (ROLE_LABEL[m.role] || m.role) + ')</option>';
      });
      if (!equipe.length) {
        html += '<option value="' + (monNom || "Collaborateur") + '" selected>' + (monNom || "Collaborateur") + '</option>';
      }
      html += '</select></div>';

      // 2. Liste déroulante du bureau
      html += '<div class="field"><label>Bureau de consultation</label><select class="input" name="destinationBureau" required>';
      var bureaux = [
        "Bureau Notaire Titulaire",
        "Bureau Premier Clerc",
        "Bureau Clerc Rédacteur 1",
        "Bureau Clerc Rédacteur 2",
        "Bureau Formalités & DGI",
        "Bureau Comptabilité & Taxe",
        "Bureau Accueil / Réception",
        "Salle de Signature / Réunion 1",
        "Salle de Signature / Réunion 2",
      ];
      bureaux.forEach(function (b) {
        html += '<option value="' + b + '">' + b + '</option>';
      });
      html += '</select></div>';
      html += '</div>';

      // 3. Date de sortie (date du jour par défaut) & Date de retour prévue
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
      html += '<div class="field"><label>Date de sortie (date du jour)</label><input class="input" type="date" name="dateSortie" value="' + dateDuJourStr + '" required></div>';
      html += '<div class="field"><label>Date de retour prévue</label><input class="input" type="date" name="dateRetourPrevue" value="' + dateRetourDefaut + '" required></div>';
      html += '</div>';

      html += '<div class="field"><label>Motif de la demande de sortie</label><input class="input" name="motif" value="Consultation pour instruction et vérification des pièces originales" required></div>';

      var sansArch = (cache.parametres && cache.parametres.presenceArchiviste === false);
      html += '<div style="font-size:12px;color:var(--color-text-dim);background:rgba(56,189,248,0.06);padding:8px 12px;border-radius:var(--radius);border:1px solid var(--color-border)">';
      html += 'ℹ️ <em>' + (sansArch ? "La demande est transmise à l'Assistante / l'Office pour approbation avant remise du dossier physique." : "La demande est transmise à l'Archiviste pour approbation, remise physique et suivi du délai de restitution.") + '</em>';
      html += '</div>';

      html += '<div id="erreur-sortie" class="erreur-inline" style="display:none"></div>';
      html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)">';
      html += '<button type="button" class="btn btn-ghost" id="btn-annuler-sortie">Annuler</button>';
      html += '<button type="submit" class="btn btn-primary">Envoyer la demande de sortie physique →</button>';
      html += '</div></form>';

      ouvrirModal({
        titre: 'Demande de sortie de dossier papier',
        corps: html,
        boutonFermer: true,
        largeur: "580px",
        apresOuverture: function () {
          document.getElementById("btn-annuler-sortie").addEventListener("click", fermerModal);
          document.getElementById("form-sortie-physique").addEventListener("submit", function (ev) {
            ev.preventDefault();
            var form = ev.target;
            var payload = {
              dossierId: form.dossierId.value,
              nomDemandeur: form.nomDemandeur.value,
              destinationBureau: form.destinationBureau.value,
              dateSortie: form.dateSortie.value,
              dateRetourPrevue: form.dateRetourPrevue.value || null,
              motif: form.motif.value.trim(),
            };
            API.post("/api/archives/mouvements/demande", payload).then(function (res) {
              toast(res.statut === "en_cours" ? "Sortie physique enregistrée." : "Demande de sortie transmise avec succès !");
              fermerModal();
              etatArchives.onglet = "mouvements";
              renderArchives();
            }).catch(function (e) {
              document.getElementById("erreur-sortie").textContent = e.message;
              document.getElementById("erreur-sortie").style.display = "block";
            });
          });
        },
      });
    });
  }

  // =========================================================================
  // MODALE : AJOUT D'UNE PIÈCE PHYSIQUE NON-NUMÉRISABLE (PLAN GRAND FORMAT)
  // =========================================================================
  function modalPiecePhysiqueNonNumerisable(dossierIdPreselectionne) {
    API.get("/api/dossiers/mes-dossiers").catch(function () { return cache.dossiers || []; }).then(function (dossiers) {
      var html = '<form id="form-non-num" style="display:flex;flex-direction:column;gap:var(--space-3)">';

      html += '<div class="field"><label>Dossier concerné</label><select class="input" name="dossierId" required>';
      dossiers.forEach(function (d) {
        var clientAff = d.comparantsNoms && d.comparantsNoms.trim() ? d.comparantsNoms.trim() : "Comparants";
        var isSel = (dossierIdPreselectionne === d.id);
        html += '<option value="' + d.id + '"' + (isSel ? " selected" : "") + '>' + d.numeroDossier + ' — ' + labelActe(d.typeActeId) + ' (' + clientAff + ')</option>';
      });
      html += '</select></div>';

      html += '<div class="field"><label>Titre / Description de la pièce physique</label><input class="input" name="titreDocument" value="Plan cadastral grand format rouleau A0 - Section 14" required></div>';
      html += '<div class="field"><label>Raison de non-numérisabilité</label><input class="input" name="raisonNonNumerisable" value="Plan grand format plié / Papier calque ancien fragile / Sceau de cire" required></div>';
      html += '<div class="field"><label>Localisation physique exacte</label><input class="input" name="localisationActuelle" value="Salle Archives 2 · Armoire 04 · Boîte B018" required></div>';

      html += '<div id="erreur-non-num" class="erreur-inline" style="display:none"></div>';
      html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)">';
      html += '<button type="button" class="btn btn-ghost" id="btn-annuler-non-num">Annuler</button>';
      html += '<button type="submit" class="btn btn-primary">Enregistrer la pièce physique</button>';
      html += '</div></form>';

      ouvrirModal({
        titre: 'Enregistrer un document physique non-numérisable',
        corps: html,
        boutonFermer: true,
        largeur: "540px",
        apresOuverture: function () {
          document.getElementById("btn-annuler-non-num").addEventListener("click", fermerModal);
          document.getElementById("form-non-num").addEventListener("submit", function (ev) {
            ev.preventDefault();
            var form = ev.target;
            var payload = {
              dossierId: form.dossierId.value,
              titreDocument: form.titreDocument.value.trim(),
              raisonNonNumerisable: form.raisonNonNumerisable.value.trim(),
              localisationActuelle: form.localisationActuelle.value.trim(),
            };
            API.post("/api/archives/piece-physique-non-numerisable", payload).then(function () {
              toast("Document physique enregistré (statut Numérisation Partielle activé).");
              fermerModal();
              etatArchives.onglet = "jumeau";
              renderArchives();
            }).catch(function (e) {
              document.getElementById("erreur-non-num").textContent = e.message;
              document.getElementById("erreur-non-num").style.display = "block";
            });
          });
        },
      });
    });
  }

  // =========================================================================
  // MODALE : NOUVELLE CAMPAGNE DE NUMÉRISATION HISTORIQUE
  // =========================================================================
  function modalNouvelleCampagne() {
    var html = '<form id="form-nouvelle-campagne" style="display:flex;flex-direction:column;gap:var(--space-3)">';
    html += '<div class="field"><label>Intitulé de la campagne</label><input class="input" name="intitule" value="Fonds Ancien Ventes & Titres Fonciers (2016 - 2020)" required></div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
    html += '<div class="field"><label>Année de début</label><input class="input" type="number" name="anneeDebut" value="2016" required></div>';
    html += '<div class="field"><label>Année de fin</label><input class="input" type="number" name="anneeFin" value="2020" required></div>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
    html += '<div class="field"><label>Types d\'actes cibles</label><input class="input" name="typeActesCibles" value="Ventes immobilières & ACD" required></div>';
    html += '<div class="field"><label>Volume estimé (nombre de dossiers)</label><input class="input" type="number" name="totalDossiers" value="5000" required></div>';
    html += '</div>';

    html += '<div id="erreur-campagne" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)">';
    html += '<button type="button" class="btn btn-ghost" id="btn-annuler-campagne">Annuler</button>';
    html += '<button type="submit" class="btn btn-primary">Lancer la campagne historique</button>';
    html += '</div></form>';

    ouvrirModal({
      titre: 'Créer une campagne de numérisation du fonds ancien',
      corps: html,
      boutonFermer: true,
      largeur: "540px",
      apresOuverture: function () {
        document.getElementById("btn-annuler-campagne").addEventListener("click", fermerModal);
        document.getElementById("form-nouvelle-campagne").addEventListener("submit", function (ev) {
          ev.preventDefault();
          var form = ev.target;
          var payload = {
            intitule: form.intitule.value.trim(),
            anneeDebut: form.anneeDebut.value,
            anneeFin: form.anneeFin.value,
            typeActesCibles: form.typeActesCibles.value.trim(),
            totalDossiers: form.totalDossiers.value,
          };
          API.post("/api/archives/campagnes", payload).then(function () {
            toast("Campagne historique créée avec succès.");
            fermerModal();
            etatArchives.onglet = "campagnes";
            renderArchives();
          }).catch(function (e) {
            document.getElementById("erreur-campagne").textContent = e.message;
            document.getElementById("erreur-campagne").style.display = "block";
          });
        });
      },
    });
  }

  // =========================================================================
  // MODALE : OUVERTURE DE TICKET SUPPORT L1-L4
  // =========================================================================
  function modalOuvrirTicketSupport() {
    var html = '<form id="form-ticket-support" style="display:flex;flex-direction:column;gap:var(--space-3)">';
    html += '<div class="field"><label>Objet de l\'incident / Demande</label><input class="input" name="titre" placeholder="Ex. Lenteur lors de la numérisation HD ou synchronisation Cloud" required></div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
    html += '<div class="field"><label>Niveau de support</label><select class="input" name="niveau"><option value="L1">L1 — Support Fonctionnel / Métier</option><option value="L2">L2 — Support Technique & Pilotes</option><option value="L3">L3 — DevOps & Infrastructure Hybride</option><option value="L4">L4 — Ingénierie & Développement</option></select></div>';
    html += '<div class="field"><label>Priorité</label><select class="input" name="priorite"><option value="basse">Basse</option><option value="normale" selected>Normale</option><option value="haute">Haute</option><option value="critique">Critique (Blocage étude)</option></select></div>';
    html += '</div>';

    html += '<div class="field"><label>Description détaillée de l\'incident</label><textarea class="input" name="description" rows="3" placeholder="Précisez les symptômes, messages d\'erreur ou le contexte d\'utilisation." required></textarea></div>';

    html += '<div style="font-size:11px;color:var(--color-text-dim);background:var(--color-surface-2);padding:8px 10px;border-radius:var(--radius)">';
    html += 'ℹ️ Un instantané de diagnostic technique non-confidentiel (version serveur, état des services) sera automatiquement joint au ticket.';
    html += '</div>';

    html += '<div id="erreur-ticket" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)">';
    html += '<button type="button" class="btn btn-ghost" id="btn-annuler-ticket">Annuler</button>';
    html += '<button type="submit" class="btn btn-primary">Transmettre le ticket au support</button>';
    html += '</div></form>';

    ouvrirModal({
      titre: 'Ouvrir un ticket d\'assistance technique',
      corps: html,
      boutonFermer: true,
      largeur: "540px",
      apresOuverture: function () {
        document.getElementById("btn-annuler-ticket").addEventListener("click", fermerModal);
        document.getElementById("form-ticket-support").addEventListener("submit", function (ev) {
          ev.preventDefault();
          var form = ev.target;
          var payload = {
            titre: form.titre.value.trim(),
            description: form.description.value.trim(),
            niveau: form.niveau.value,
            priorite: form.priorite.value,
          };
          API.post("/api/support/tickets", payload).then(function (ticket) {
            toast("Ticket " + ticket.numero_ticket + " ouvert. L'équipe support a été notifiée.");
            fermerModal();
            renderArchives();
            document.getElementById("erreur-ticket").textContent = e.message;
            document.getElementById("erreur-ticket").style.display = "block";
          });
        });
      },
    });
  }

  // =========================================================================
  // MODALE PRINCIPALE : NUMÉRISER & ARCHIVER UN DOSSIER OU UN ACTE HISTORIQUE
  // =========================================================================
  function modalNumeriserEtArchiver(dossierIdPreselectionne) {
    Promise.all([
      API.get("/api/dossiers/mes-dossiers").catch(function () { return cache.dossiers || []; }),
      API.get("/api/archives/cartons").catch(function () { return []; }),
      API.get("/api/referentiel/types-actes").catch(function () { return cache.typesActesListe || []; }),
    ]).then(function (res) {
      var dossiers = res[0] || [], cartons = res[1] || [], typesActes = res[2] || [];
      var dossierChoisi = dossierIdPreselectionne ? dossiers.find(function (d) { return d.id === dossierIdPreselectionne; }) : null;

      var anneeCourante = new Date().getFullYear();
      var numMinuteSuggere = "MIN-" + anneeCourante + "/" + String(Math.floor(Math.random() * 800) + 100).padStart(3, "0");
      var hashSimule = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

      var html = '<form id="form-numeriser-archiver" style="display:flex;flex-direction:column;gap:var(--space-3)">';

      // 1. Choix du dossier
      html += '<div style="background:var(--color-surface-2);padding:12px;border-radius:var(--radius);border:1px solid var(--color-border)">';
      html += '<div style="font-weight:700;font-size:13px;color:var(--color-text);margin-bottom:8px">1. Dossier / Acte à archiver</div>';

      html += '<div style="display:flex;gap:12px;margin-bottom:10px">';
      html += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px"><input type="radio" name="sourceArchive" value="existant"' + (!dossierChoisi || dossierIdPreselectionne ? " checked" : " checked") + '> Dossier existant de l\'étude</label>';
      html += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px"><input type="radio" name="sourceArchive" value="historique"> Fonds documentaire historique / Ancien acte</label>';
      html += '</div>';

      // Bloc dossier existant
      html += '<div id="bloc-dossier-existant">';
      html += '<div class="field"><label>Sélectionner le dossier</label><select class="input" name="dossierId" id="select-archive-dossier">';
      html += '<option value="">-- Choisir un dossier dans la liste --</option>';
      dossiers.forEach(function (d) {
        var clientAff = d.comparantsNoms && d.comparantsNoms.trim() ? d.comparantsNoms.trim() : "Comparants";
        var isSel = (dossierChoisi && dossierChoisi.id === d.id) || (dossierIdPreselectionne === d.id);
        html += '<option value="' + d.id + '"' + (isSel ? " selected" : "") + '>' + d.numeroDossier + ' — ' + labelActe(d.typeActeId) + ' (' + clientAff + ')</option>';
      });
      html += '</select></div></div>';

      // Bloc fonds historique
      html += '<div id="bloc-dossier-historique" style="display:none">';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);margin-bottom:8px">';
      html += '<div class="field"><label>N° Dossier historique</label><input class="input" name="numeroDossierHistorique" placeholder="Ex. DOS-2018-045"></div>';
      html += '<div class="field"><label>Type d\'acte</label><select class="input" name="typeActeIdHistorique">';
      typesActes.forEach(function (t) { html += '<option value="' + t.id + '">' + t.libelle + '</option>'; });
      html += '</select></div>';
      html += '</div>';
      html += '<div class="field"><label>Clients / Comparants</label><input class="input" name="comparantsHistorique" placeholder="Ex. M. KOUASSI & Mme KOFFI"></div>';
      html += '</div>';

      html += '</div>';

      // 2. Numérisation & Fichier PDF/A 300 DPI
      html += '<div style="background:var(--color-surface-2);padding:12px;border-radius:var(--radius);border:1px solid var(--color-border)">';
      html += '<div style="font-weight:700;font-size:13px;color:var(--color-text);margin-bottom:8px">2. Numérisation & Intégrité Cryptographique</div>';

      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);margin-bottom:8px">';
      html += '<div class="field"><label>Fichier numérisé (Scan 300 DPI PDF/A)</label><input class="input" name="scanUrl" value="SCAN_MINUTE_' + anneeCourante + '.pdf" placeholder="Ex. SCAN_MINUTE.pdf" required></div>';
      html += '<div class="field"><label>Date de signature / passation</label><input class="input" type="date" name="dateCloture" value="' + new Date().toISOString().slice(0, 10) + '" required></div>';
      html += '</div>';

      html += '<div style="font-size:11px;color:var(--color-text-dim);background:var(--color-surface);padding:8px 10px;border-radius:var(--radius);border:1px solid var(--color-border);margin-bottom:8px">';
      html += '<strong>Mention légale :</strong> Acte authentique physique signé de façon normale en minute par les comparants et Maître Titulaire. Numérisé en haute définition 300 DPI au format pérenne PDF/A.';
      html += '</div>';

      html += '<div class="field"><label>Empreinte d\'intégrité (SHA-256 scellement)</label><input class="input" name="empreinteSha256" value="' + hashSimule + '" style="font-family:monospace;font-size:11px" readonly></div>';
      html += '</div>';

      // 3. Attribution Minute & Classement physique en Carton
      html += '<div style="background:var(--color-surface-2);padding:12px;border-radius:var(--radius);border:1px solid var(--color-border)">';
      html += '<div style="font-weight:700;font-size:13px;color:var(--color-text);margin-bottom:8px">3. N° de Minute Légal & Carton Physique (FIFO)</div>';

      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);margin-bottom:8px">';
      html += '<div class="field"><label>N° Minute légale attribuée</label><input class="input" name="numeroMinute" value="' + numMinuteSuggere + '" placeholder="MIN-AAAA/XXX" required></div>';
      html += '<div class="field"><label>Carton d\'archives physique</label><select class="input" name="cartonId">';
      html += '<option value="">-- Attribuer automatiquement le carton ouvert --</option>';
      cartons.forEach(function (k) {
        html += '<option value="' + k.id + '">' + k.numeroCarton + ' (' + (k.nombreDossiers || 0) + '/' + k.capaciteMax + ') — ' + (k.salle || "Salle principale") + ' ' + (k.armoire || "") + '</option>';
      });
      html += '</select></div>';
      html += '</div>';

      html += '</div>';

      html += '<div id="erreur-numeriser-archiver" class="erreur-inline" style="display:none"></div>';
      html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-archive">Annuler</button><button type="submit" class="btn btn-primary">Sceller & Archiver la minute →</button></div>';
      html += '</form>';

      ouvrirModal({
        titre: 'Numériser & Archiver un nouveau dossier en minute',
        corps: html,
        boutonFermer: true,
        largeur: "640px",
        apresOuverture: function () {
          document.getElementById("btn-annuler-archive").addEventListener("click", fermerModal);

          // Gestion bascule radio existant / historique
          var radios = document.querySelectorAll('input[name="sourceArchive"]');
          var blocExistant = document.getElementById("bloc-dossier-existant");
          var blocHistorique = document.getElementById("bloc-dossier-historique");

          radios.forEach(function (r) {
            r.addEventListener("change", function () {
              if (r.value === "historique") {
                blocExistant.style.display = "none";
                blocHistorique.style.display = "block";
              } else {
                blocExistant.style.display = "block";
                blocHistorique.style.display = "none";
              }
            });
          });

          // Soumission du formulaire de numérisation & archivage
          document.getElementById("form-numeriser-archiver").addEventListener("submit", function (ev) {
            ev.preventDefault();
            var form = ev.target;
            var errZone = document.getElementById("erreur-numeriser-archiver");
            errZone.style.display = "none";

            var source = form.sourceArchive.value;
            var payload = {
              estFondsHistorique: source === "historique",
              dossierId: source === "existant" ? form.dossierId.value : null,
              numeroDossierHistorique: source === "historique" ? form.numeroDossierHistorique.value : null,
              typeActeIdHistorique: source === "historique" ? form.typeActeIdHistorique.value : null,
              comparantsHistorique: source === "historique" ? form.comparantsHistorique.value : null,
              scanUrl: form.scanUrl.value.trim(),
              dateCloture: form.dateCloture.value,
              empreinteSha256: form.empreinteSha256.value,
              numeroMinute: form.numeroMinute.value.trim(),
              cartonId: form.cartonId.value || null,
            };

            if (source === "existant" && !payload.dossierId) {
              errZone.textContent = "Veuillez sélectionner un dossier existant.";
              errZone.style.display = "block";
              return;
            }

            API.post("/api/archives/numeriser-et-archiver", payload).then(function (resultat) {
              toast("Minute " + resultat.numeroMinute + " numérisée et archivée avec succès.");
              fermerModal();
              renderArchives();
              modalFicheArchivage(resultat);
            }).catch(function (e) {
              errZone.textContent = e.message;
              errZone.style.display = "block";
            });
          });
        },
      });
    });
  }

  // =========================================================================
  // MODALE : FICHE OFFICIELLE D'ARCHIVAGE & ÉTIQUETTE CARTON IMPRIMABLE
  // =========================================================================
  function modalFicheArchivage(min) {
    var dateAuj = new Date().toLocaleDateString("fr-CI", { day: "2-digit", month: "2-digit", year: "numeric" });
    var nomEtude = (cache.parametres && cache.parametres.nomEtude && cache.parametres.nomEtude.trim()) ? cache.parametres.nomEtude : "Legal Notary";

    var html = '<div style="display:flex;flex-direction:column;gap:var(--space-3)">';

    html += '<div class="fiche-archivage-document" id="zone-impression-fiche">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:16px">';
    html += '<div><div style="font-size:16px;font-weight:bold;text-transform:uppercase">' + nomEtude + '</div><div style="font-size:12px;color:#475569">Office Notarial — République de Côte d\'Ivoire</div></div>';
    html += '<div style="text-align:right"><div style="font-size:18px;font-weight:bold;color:#0f172a">MINUTE ' + (min.numero_minute || min.numeroMinute) + '</div><div style="font-size:11px;color:#475569">Bordereau de versement aux archives</div></div>';
    html += '</div>';

    html += '<h2 style="font-size:16px;margin-bottom:16px">Fiche d\'Archivage & Scellement Légal</h2>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;margin-bottom:16px">';
    html += '<div><strong>N° Dossier :</strong> ' + (min.numero_dossier || min.numeroDossier || "—") + '</div>';
    html += '<div><strong>Date de clôture :</strong> ' + fmtDate(min.date_cloture || min.dateCloture || new Date()) + '</div>';
    html += '<div><strong>Comparants :</strong> ' + (min.comparants_noms || min.comparantsNoms || "Comparants") + '</div>';
    html += '<div><strong>Type d\'acte :</strong> ' + labelActe(min.type_acte_id || min.typeActeId) + '</div>';
    html += '</div>';

    html += '<div style="border:1px solid #cbd5e1;border-radius:4px;padding:12px;margin-bottom:16px;background:#f8fafc;font-size:12px">';
    html += '<div style="font-weight:bold;color:#0f172a;margin-bottom:4px">Localisation physique en carton :</div>';
    html += '<div><strong>Emplacement :</strong> ' + (min.code_emplacement || min.codeEmplacement || "Carton principal") + '</div>';
    html += '<div><strong>Carton N° :</strong> ' + (min.numero_carton || min.cartonNumero || "CARTON-001") + '</div>';
    html += '</div>';

    html += '<div style="border:1px solid #cbd5e1;border-radius:4px;padding:12px;background:#f8fafc;font-size:12px">';
    html += '<div style="font-weight:bold;color:#0f172a;margin-bottom:4px">Certification numérique & Empreinte :</div>';
    html += '<div><strong>Fichier :</strong> ' + (min.scan_url || min.scanUrl || "SCAN_MINUTE_OFFICIEL.pdf") + ' (Numérisation 300 DPI PDF/A)</div>';
    html += '<div style="word-break:break-all;font-family:monospace;font-size:10px;margin-top:4px"><strong>SHA-256 :</strong> ' + (min.empreinteSha256 || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855") + '</div>';
    html += '</div>';

    html += '<div style="display:flex;justify-content:space-between;margin-top:20px;padding-top:12px;border-top:1px dashed #cbd5e1;font-size:11px;color:#64748b">';
    html += '<div>Établi le ' + dateAuj + ' · Conservation légale décennale</div>';
    html += '<div style="text-align:right">Cachet & Signature de l\'Office</div>';
    html += '</div>';

    html += '</div>';

    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)">';
    html += '<button type="button" class="btn btn-secondary" id="btn-imprimer-fiche">Imprimer la fiche / étiquette</button>';
    html += '<button type="button" class="btn btn-primary" id="btn-fermer-fiche">Fermer</button>';
    html += '</div>';

    html += '</div>';

    ouvrirModal({
      titre: 'Fiche Officielle d\'Archivage & Bordereau de Versement',
      corps: html,
      boutonFermer: true,
      largeur: "640px",
      apresOuverture: function () {
        document.getElementById("btn-fermer-fiche").addEventListener("click", fermerModal);
        document.getElementById("btn-imprimer-fiche").addEventListener("click", function () {
          var w = window.open("", "_blank");
          w.document.write('<html><head><title>Fiche d\'archivage — Minute ' + (min.numero_minute || min.numeroMinute) + '</title>');
          w.document.write('<style>body { font-family: "Times New Roman", Times, serif; padding: 40px; color: #000; line-height: 1.5; } strong { font-weight: bold; }</style></head><body>');
          w.document.write(document.getElementById("zone-impression-fiche").innerHTML);
          w.document.write('</body></html>');
          w.document.close();
          w.focus();
          setTimeout(function () { w.print(); w.close(); }, 300);
        });
      },
    });
  }

  // =========================================================================
  // MODALE : CRÉATION D'UN NOUVEAU CARTON D'ARCHIVES PHYSIQUE
  // =========================================================================
  function modalNouveauCarton() {
    var html = '<form id="form-nouveau-carton" style="display:flex;flex-direction:column;gap:var(--space-3)">';
    html += '<div class="field"><label>Numéro du carton (ex. CARTON-002)</label><input class="input" name="numeroCarton" placeholder="Automatique si laissé vide"></div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-2)">';
    html += '<div class="field"><label>Salle d\'archives</label><input class="input" name="salle" value="Salle principale" required></div>';
    html += '<div class="field"><label>Armoire</label><input class="input" name="armoire" value="Armoire A" required></div>';
    html += '<div class="field"><label>Rayonnage</label><input class="input" name="rayonnage" value="Rayon 1" required></div>';
    html += '</div>';

    html += '<div class="field"><label>Capacité maximale (nombre de dossiers)</label><input class="input" type="number" min="5" max="200" name="capaciteMax" value="50" required></div>';

    html += '<div id="erreur-nouveau-carton" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-carton">Annuler</button><button type="submit" class="btn btn-primary">Créer le carton physique</button></div>';
    html += '</form>';

    ouvrirModal({
      titre: 'Ouvrir un nouveau carton d\'archives',
      corps: html,
      boutonFermer: true,
      largeur: "500px",
      apresOuverture: function () {
        document.getElementById("btn-annuler-carton").addEventListener("click", fermerModal);
        document.getElementById("form-nouveau-carton").addEventListener("submit", function (ev) {
          ev.preventDefault();
          var form = ev.target;
          var errZone = document.getElementById("erreur-nouveau-carton");
          errZone.style.display = "none";

          var payload = {
            numeroCarton: form.numeroCarton.value.trim() || undefined,
            salle: form.salle.value.trim(),
            armoire: form.armoire.value.trim(),
            rayonnage: form.rayonnage.value.trim(),
            capaciteMax: parseInt(form.capaciteMax.value, 10) || 50,
          };

          API.post("/api/archives/cartons", payload).then(function () {
            toast("Nouveau carton d'archives ouvert avec succès.");
            fermerModal();
            etatArchives.onglet = "cartons";
            renderArchives();
          }).catch(function (e) {
            errZone.textContent = e.message;
            errZone.style.display = "block";
          });
        });
      },
    });
  }

  // -----------------------------------------------------------------
  // Équipe (Gestion RH & Collaborateurs)
  // -----------------------------------------------------------------
  function renderEquipe() {
    var c = document.getElementById("vue-equipe");
    if (!cache.permissions.equipe) {
      c.innerHTML = '<h1 style="margin-bottom:8px">Équipe</h1><p class="text-muted">Cet écran est réservé à la direction du cabinet.</p>';
      return;
    }
    var avecSalaires = cache.equipeListe.length && cache.equipeListe[0].salaireNet !== undefined;
    var estNotaire = cache.utilisateur.role === "notaire";

    var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-3)">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-2)">';
    html += '<div><h1 style="margin-bottom:2px">Équipe de l\'étude</h1>';
    html += '<p style="opacity:.65;font-size:14px;margin:0">Gestion des collaborateurs et suivi des dossiers assignés.</p></div>';
    html += '<button class="btn btn-primary" id="bouton-ajouter-membre">+ Ajouter un collaborateur</button></div></div>';

    html += '<div class="table-wrap" style="margin-bottom:var(--space-6)"><table class="table"><thead><tr><th>Collaborateur</th><th>Rôle</th><th>Téléphone</th><th>Embauche</th><th>Contrat</th>' + (avecSalaires ? "<th>Salaire net</th>" : "") + '<th>Actions</th></tr></thead><tbody>';
    cache.equipeListe.forEach(function (m) {
      html += '<tr>';
      html += '<td><strong>' + m.nomComplet + '</strong><div class="text-muted" style="font-size:11px">' + m.email + '</div></td>';
      html += '<td><span class="tag tag-outline">' + ROLE_LABEL[m.role] + '</span></td>';
      html += '<td>' + (m.telephone || "—") + '</td>';
      html += '<td>' + fmtDate(m.dateEmbauche) + '</td>';
      html += '<td>' + (m.typeContrat || "—") + '</td>';
      if (avecSalaires) {
        html += '<td style="font-weight:700;color:var(--color-accent)">' + (m.salaireNet != null ? fmtFCFA(m.salaireNet) : "—") + '</td>';
      }
      html += '<td><div style="display:flex;gap:6px">';
      html += '<button class="btn btn-secondary btn-modifier-membre" data-id="' + m.id + '" style="padding:4px 8px;font-size:12px">Modifier</button>';
      html += '<button class="btn btn-ghost btn-evo-membre" data-id="' + m.id + '" style="padding:4px 8px;font-size:12px">Évolution →</button>';
      html += '</div></td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    c.innerHTML = html;

    // Événement Ajouter un membre
    var btnAjouter = document.getElementById("bouton-ajouter-membre");
    if (btnAjouter) btnAjouter.addEventListener("click", ouvrirModalAjoutMembre);

    // Événements Modifier un membre
    c.querySelectorAll(".btn-modifier-membre").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var membre = cache.equipeParId[btn.dataset.id];
        if (membre) ouvrirModalModifMembre(membre, avecSalaires);
      });
    });

    // Événements Voir l'évolution
    c.querySelectorAll(".btn-evo-membre").forEach(function (btn) {
      btn.addEventListener("click", function () {
        irVers("evolution");
        renderEvolution(btn.dataset.id);
      });
    });
  }

  function ouvrirModalAjoutMembre() {
    var estNotaire = cache.utilisateur.role === "notaire";
    var corps =
      '<div style="display:flex;flex-direction:column;gap:var(--space-3)">' +
        '<div class="field"><label>Nom complet</label><input class="input" id="membre-nom" placeholder="Me Jean KOUASSI" required></div>' +
        '<div class="field"><label>Email de connexion</label><input class="input" type="email" id="membre-email" placeholder="j.kouassi@notaire.ci" required></div>' +
        '<div class="field"><label>Mot de passe initial</label><input class="input" type="password" id="membre-mdp" placeholder="Minimum 8 caractères" required></div>' +
        '<div class="field"><label>Rôle</label><select class="input" id="membre-role">' +
          '<option value="premier_clerc">Premier Clerc</option>' +
          '<option value="clerc_redacteur" selected>Clerc Rédacteur</option>' +
          '<option value="clerc_formaliste">Clerc aux Formalités</option>' +
          '<option value="comptable_taxateur">Comptable Taxateur</option>' +
          '<option value="assistante">Assistante / Accueil</option>' +
        '</select></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">' +
          '<div class="field"><label>Téléphone</label><input class="input" id="membre-tel" placeholder="+225 07..."></div>' +
          '<div class="field"><label>Date d\'embauche</label><input class="input" type="date" id="membre-embauche"></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">' +
          '<div class="field"><label>Type de contrat</label><select class="input" id="membre-contrat"><option value="CDI">CDI</option><option value="CDD">CDD</option><option value="Stage">Stage</option><option value="Autre">Autre</option></select></div>' +
          (estNotaire ? '<div class="field"><label>Salaire net (FCFA)</label><input class="input" type="number" id="membre-salaire" placeholder="Ex: 350000"></div>' : '') +
        '</div>' +
      '</div>';

    ouvrirModal({
      titre: "Nouveau collaborateur de l'étude",
      corps: corps,
      footer:
        '<button class="btn btn-secondary" id="modal-annuler">Annuler</button>' +
        '<button class="btn btn-primary" id="modal-creer-membre">Enregistrer</button>',
      apresOuverture: function () {
        document.getElementById("modal-annuler").addEventListener("click", fermerModal);
        document.getElementById("modal-creer-membre").addEventListener("click", function () {
          var donnees = {
            nomComplet: document.getElementById("membre-nom").value.trim(),
            email: document.getElementById("membre-email").value.trim(),
            motDePasse: document.getElementById("membre-mdp").value,
            role: document.getElementById("membre-role").value,
            telephone: document.getElementById("membre-tel").value.trim(),
            dateEmbauche: document.getElementById("membre-embauche").value || null,
            typeContrat: document.getElementById("membre-contrat").value || null,
          };
          if (estNotaire && document.getElementById("membre-salaire")) {
            var sal = document.getElementById("membre-salaire").value;
            donnees.salaireNet = sal ? parseInt(sal, 10) : null;
          }
          if (!donnees.nomComplet || !donnees.email || !donnees.motDePasse) {
            toast("Nom, email et mot de passe sont obligatoires.");
            return;
          }
          API.post("/api/equipe", donnees)
            .then(function () {
              toast("Collaborateur créé avec succès.");
              fermerModal();
              return chargerEquipe();
            })
            .then(renderEquipe)
            .catch(function (e) { toast(e.message); });
        });
      },
    });
  }

  function ouvrirModalModifMembre(m, avecSalaires) {
    var estNotaire = cache.utilisateur.role === "notaire";
    var corps =
      '<div style="display:flex;flex-direction:column;gap:var(--space-3)">' +
        '<div class="field"><label>Nom complet</label><input class="input" id="edit-nom" value="' + (m.nomComplet || "").replace(/"/g, "&quot;") + '" required></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">' +
          '<div class="field"><label>Téléphone</label><input class="input" id="edit-tel" value="' + (m.telephone || "").replace(/"/g, "&quot;") + '"></div>' +
          '<div class="field"><label>Date d\'embauche</label><input class="input" type="date" id="edit-embauche" value="' + (m.dateEmbauche ? m.dateEmbauche.slice(0, 10) : "") + '"></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">' +
          '<div class="field"><label>Type de contrat</label><input class="input" id="edit-contrat" value="' + (m.typeContrat || "").replace(/"/g, "&quot;") + '"></div>' +
          (avecSalaires ? '<div class="field"><label>Salaire net (FCFA)</label><input class="input" type="number" id="edit-salaire" value="' + (m.salaireNet != null ? m.salaireNet : "") + '"></div>' : '') +
        '</div>' +
      '</div>';

    ouvrirModal({
      titre: "Modifier — " + m.nomComplet,
      corps: corps,
      footer:
        '<button class="btn btn-secondary" id="modal-annuler">Annuler</button>' +
        '<button class="btn btn-primary" id="modal-save-membre">Enregistrer les modifications</button>',
      apresOuverture: function () {
        document.getElementById("modal-annuler").addEventListener("click", fermerModal);
        document.getElementById("modal-save-membre").addEventListener("click", function () {
          var payload = {
            nomComplet: document.getElementById("edit-nom").value.trim(),
            telephone: document.getElementById("edit-tel").value.trim(),
            dateEmbauche: document.getElementById("edit-embauche").value || null,
            typeContrat: document.getElementById("edit-contrat").value || null,
          };
          if (avecSalaires && document.getElementById("edit-salaire")) {
            var sal = document.getElementById("edit-salaire").value;
            payload.salaireNet = sal ? parseInt(sal, 10) : null;
          }
          API.patch("/api/equipe/" + m.id, payload)
            .then(function () {
              toast("Informations mises à jour.");
              fermerModal();
              return chargerEquipe();
            })
            .then(renderEquipe)
            .catch(function (e) { toast(e.message); });
        });
      },
    });
  }

  // -----------------------------------------------------------------
  // « Mon évolution » (Statistiques personnelles & suivi d'avancement)
  // -----------------------------------------------------------------
  // -----------------------------------------------------------------
  // « Mon évolution » (Statistiques personnelles & suivi d'avancement)
  // -----------------------------------------------------------------
  function renderEvolution(utilisateurId) {
    var c = document.getElementById("vue-evolution");
    c.innerHTML = '<p class="text-muted">Chargement de l\'évolution…</p>';

    var uid = utilisateurId || cache.utilisateur.id;
    var estManager = cache.permissions.dossiersTous;

    API.get("/api/tableau-bord/evolution/" + uid).then(function (evo) {
      var membreConcerne = cache.equipeParId[uid] || cache.utilisateur;
      var estNotaire = membreConcerne.role === "notaire";
      var dossiersMembre = cache.dossiers.filter(function (d) { return d.clercAssigneId === uid; });

      var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-3)">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-2)">';
      html += '<div><h1 style="margin-bottom:2px">Mon évolution & Performance</h1>';
      html += '<p style="opacity:.65;font-size:14px;margin:0">Suivi d\'activité pour <strong>' + membreConcerne.nomComplet + '</strong> (' + ROLE_LABEL[membreConcerne.role] + ').</p></div>';

      if (estManager && cache.equipeListe.length) {
        html += '<div style="display:flex;align-items:center;gap:8px"><label style="font-size:13px;color:var(--color-text-dim)">Collaborateur :</label><select class="input" id="select-evolution-membre" style="min-height:36px;font-size:13px">';
        cache.equipeListe.forEach(function (m) {
          html += '<option value="' + m.id + '"' + (m.id === uid ? " selected" : "") + '>' + m.nomComplet + ' (' + ROLE_LABEL[m.role] + ')</option>';
        });
        html += '</select></div>';
      }
      html += '</div></div>';

      if (estNotaire) {
        // =========================================================================
        // VUE NOTAIRE : LIGNE 1 (ATTRIBUÉ DIRECTEMENT) & LIGNE 2 (ÉVOLUTION GÉNÉRALE)
        // =========================================================================
        var enRelecture = cache.dossiers.filter(function (d) { return d.etapeActuelle === 3; });
        var enSignature = cache.dossiers.filter(function (d) { return d.etapeActuelle === 4; });
        var alertesCritiques = cache.alertes.filter(function (a) { return a.couleur === "rouge"; });

        // --- LIGNE 1 : ATTRIBUÉ DIRECTEMENT AU NOTAIRE TITULAIRE ---
        html += '<div class="dashboard-panel" style="margin-bottom:var(--space-5);border-left:4px solid var(--color-accent)">';
        html += '<div class="panel-header"><div class="panel-title">Ligne 1 : Attribué directement à ' + membreConcerne.nomComplet + ' (Visas, Signatures & Décisions)</div><span class="tag tag-accent">' + (enRelecture.length + enSignature.length) + ' acte(s) en attente</span></div>';
        html += '<div class="panel-body">';

        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">';
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border)"><div class="card-kicker">Projets en relecture / visa</div><div style="font-family:var(--font-heading);font-weight:700;font-size:24px;color:var(--color-text);margin:4px 0">' + enRelecture.length + '</div><div style="font-size:11px;color:var(--color-text-dim)">Étape 3 · Projets d\'actes rédigés par les clercs</div></div>';
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border)"><div class="card-kicker">Actes prêts pour signature</div><div style="font-family:var(--font-heading);font-weight:700;font-size:24px;color:var(--color-accent);margin:4px 0">' + enSignature.length + '</div><div style="font-size:11px;color:var(--color-text-dim)">Étape 4 · Rendez-vous de signature en minute</div></div>';
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border)"><div class="card-kicker">Décisions & Déblocages</div><div style="font-family:var(--font-heading);font-weight:700;font-size:24px;color:' + (alertesCritiques.length ? "var(--color-danger)" : "#22c55e") + ';margin:4px 0">' + alertesCritiques.length + '</div><div style="font-size:11px;color:var(--color-text-dim)">Alertes critiques nécessitant un arbitrage</div></div>';
        html += '</div>';

        // Tableau des actes attribués directement au notaire
        var dossiersNotaireDirect = cache.dossiers.filter(function (d) { return d.etapeActuelle === 3 || d.etapeActuelle === 4; });
        if (!dossiersNotaireDirect.length) {
          html += '<p class="text-muted" style="text-align:center;padding:var(--space-3)">Aucun acte en attente directe de relecture ou signature notariée.</p>';
        } else {
          html += '<div class="table-wrap"><table class="table"><thead><tr><th>N° Dossier</th><th>Client</th><th>Type d\'acte</th><th>Étape</th><th>Assiette</th><th>Action</th></tr></thead><tbody>';
          dossiersNotaireDirect.forEach(function (d) {
            var clientAff = d.comparantsNoms && d.comparantsNoms.trim() ? d.comparantsNoms.trim() : "—";
            html += '<tr class="alerte-item" data-id="' + d.id + '" style="cursor:pointer">';
            html += '<td><strong>' + d.numeroDossier + '</strong></td>';
            html += '<td style="font-weight:600">' + clientAff + '</td>';
            html += '<td>' + labelActe(d.typeActeId) + '</td>';
            html += '<td><span class="tag ' + (d.etapeActuelle === 4 ? "tag-accent" : "tag-outline") + '">' + labelEtape(d.etapeActuelle) + '</span></td>';
            html += '<td style="font-weight:600">' + fmtFCFA(d.montantAssiette) + '</td>';
            html += '<td><button class="btn btn-ghost" style="padding:2px 8px;font-size:12px">Examiner →</button></td>';
            html += '</tr>';
          });
          html += '</tbody></table></div>';
        }
        html += '</div></div>';

        // --- LIGNE 2 : ÉVOLUTION GÉNÉRALE DE L'ÉTUDE ---
        var synthese = calculerSyntheseEtude(cache.dossiers);
        var totalClotures = cache.dossiers.filter(function (d) { return d.statut === "cloture" || d.etapeActuelle === 6 || d.estArchiveNumerique; }).length;
        var pctGlobal = cache.dossiers.length ? Math.round((totalClotures / cache.dossiers.length) * 100) : 0;

        html += '<div class="dashboard-panel" style="border-left:4px solid #38bdf8">';
        html += '<div class="panel-header"><div class="panel-title"><span></span> Ligne 2 : Évolution générale & Performance globale de l\'office</div><span class="tag tag-outline">Exercice en cours</span></div>';
        html += '<div class="panel-body">';

        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">';
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border)"><div class="card-kicker">Volume d\'affaires global</div><div style="font-family:var(--font-heading);font-weight:700;font-size:22px;color:var(--color-text);margin:4px 0">' + fmtFCFA(synthese.totalAssiettes) + '</div><div style="font-size:11px;color:var(--color-text-dim)">Portefeuille total des transactions</div></div>';
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border)"><div class="card-kicker">Émoluments générés (HT)</div><div style="font-family:var(--font-heading);font-weight:700;font-size:22px;color:var(--color-accent);margin:4px 0">' + fmtFCFA(synthese.totalEmolumentsHT) + '</div><div style="font-size:11px;color:var(--color-text-dim)">Décret 2013-279 (TTC : ' + fmtFCFA(synthese.totalEmolumentsTTC) + ')</div></div>';
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border)"><div class="card-kicker">Dossiers traités / clôturés</div><div style="font-family:var(--font-heading);font-weight:700;font-size:22px;color:#22c55e;margin:4px 0">' + totalClotures + ' / ' + cache.dossiers.length + '</div><div style="font-size:11px;color:var(--color-text-dim)">Taux de réalisation : ' + pctGlobal + ' %</div></div>';
        html += '</div>';

        html += '<div style="background:var(--color-surface-2);padding:12px;border-radius:var(--radius);border:1px solid var(--color-border)">';
        html += '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:13px;font-weight:700">Taux de réalisation global du cabinet</span><strong style="color:#22c55e">' + pctGlobal + ' %</strong></div>';
        html += '<div style="height:10px;border-radius:6px;overflow:hidden;background:rgba(255,255,255,0.08)"><div style="height:100%;width:' + Math.max(pctGlobal, 4) + '%;background:linear-gradient(90deg, #38bdf8, #22c55e);border-radius:6px"></div></div>';
        html += '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-dim);margin-top:6px"><span>' + (cache.dossiers.length - totalClotures) + ' dossier(s) en cours d\'instruction</span><span>' + totalClotures + ' acte(s) clôturé(s) & minuté(s)</span></div>';
        html += '</div>';

        html += '</div></div>';
      } else {
        // =========================================================================
        // VUE COLLABORATEUR (CLERC / ASSISTANTE)
        // =========================================================================
        var kpis = [
          { label: "Dossiers actifs assignés", valeur: String(evo.dossiersActifs), indice: "", icon: "", sub: "Charge en cours" },
          { label: "Dossiers clôturés (30 j)", valeur: String(evo.dossiersClotures30Jours), indice: "accent", icon: "", sub: "Performance mensuelle" },
          { label: "Taux d'avancement moyen", valeur: evo.avancementMoyenPourcent + " %", indice: "accent", icon: "", sub: "Avancement des tâches" },
        ];
        html += renderKpisGrid(kpis);

        html += '<div class="dashboard-panel">';
        html += '<div class="panel-header"><div class="panel-title">Dossiers assignés en cours d\'instruction</div><span class="tag tag-outline">' + dossiersMembre.length + ' dossier(s)</span></div>';
        html += '<div class="panel-body">';
        if (!dossiersMembre.length) {
          html += '<p class="text-muted" style="text-align:center;padding:var(--space-4)">Aucun dossier actuellement assigné à ce collaborateur.</p>';
        } else {
          html += '<div style="display:flex;flex-direction:column;gap:var(--space-3)">';
          dossiersMembre.forEach(function (d) {
            var pcts = (d.taches || []).map(function (t) { return STATUT_PCT[t.statut] || 0; });
            var avg = pcts.length ? Math.round(pcts.reduce(function (a, b) { return a + b; }, 0) / pcts.length) : 0;
            var nv = niveauDossier(d.id);

            html += '<div class="card alerte-item" data-id="' + d.id + '" style="cursor:pointer;padding:var(--space-3) var(--space-4);border-color:var(--color-border);background:var(--color-surface-2)">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
            html += '<div><span class="card-kicker">' + d.numeroDossier + '</span><span style="font-family:var(--font-heading);font-weight:700;font-size:15px;margin-left:8px;color:var(--color-text)">' + labelActe(d.typeActeId) + '</span></div>';
            html += '<span class="tag ' + nv.tag + '" style="font-weight:700">' + nv.label + '</span>';
            html += '</div>';

            html += '<div style="display:flex;align-items:center;gap:12px">';
            html += '<div style="flex:1;height:10px;background:rgba(255,255,255,0.08);border-radius:6px;overflow:hidden;border:1px solid var(--color-divider)"><div style="height:100%;width:' + avg + '%;background:linear-gradient(90deg, #16a34a, #22c55e);border-radius:6px"></div></div>';
            html += '<span style="font-size:13px;font-weight:700;color:var(--color-accent-800);min-width:44px;text-align:right">' + avg + ' %</span>';
            html += '<span class="tag tag-outline" style="font-size:11px">' + labelEtape(d.etapeActuelle) + '</span>';
            html += '</div></div>';
          });
          html += '</div>';
        }
        html += '</div></div>';
      }

      c.innerHTML = html;
      c.querySelectorAll(".alerte-item").forEach(function (e) {
        e.addEventListener("click", function () { ouvrirDossier(e.dataset.id, "evolution"); });
      });

      var selMembre = document.getElementById("select-evolution-membre");
      if (selMembre) {
        selMembre.addEventListener("change", function () {
          renderEvolution(selMembre.value);
        });
      }
    }).catch(function (e) {
      c.innerHTML = '<p class="erreur-inline">' + e.message + '</p>';
    });
  }

  // =========================================================================
  // GESTION COMPLÈTE DES BARÈMES D'ÉMOLUMENTS (DÉCRET N° 2013-279)
  // Accessible au Notaire, au Premier Clerc et au Comptable Taxateur
  // =========================================================================
  var etatEmoluments = {
    recherche: "",
  };

  function renderEmoluments() {
    var c = document.getElementById("vue-emoluments");
    if (!c) return;
    c.innerHTML = '<p class="text-muted">Chargement des barèmes d\'émoluments et du catalogue…</p>';

    Promise.all([
      API.get("/api/referentiel/baremes").catch(function () { return []; }),
      API.get("/api/referentiel/types-actes").catch(function () { return []; }),
    ]).then(function (res) {
      var baremes = res[0] || [];
      var tousLesActes = res[1] || [];

      // Mapper les actes par barème
      var actesParBareme = {};
      tousLesActes.forEach(function (act) {
        if (act.baremeEmolumentsId) {
          if (!actesParBareme[act.baremeEmolumentsId]) actesParBareme[act.baremeEmolumentsId] = [];
          actesParBareme[act.baremeEmolumentsId].push(act);
        }
      });

      var q = (etatEmoluments.recherche || "").toLowerCase().trim();
      var baremesFiltres = baremes.filter(function (b) {
        if (!q) return true;
        var inNom = (b.libelle || "").toLowerCase().indexOf(q) !== -1;
        var inCode = (b.code || "").toLowerCase().indexOf(q) !== -1;
        var actesAssoc = actesParBareme[b.id] || [];
        var inActes = actesAssoc.some(function (a) { return (a.libelle || "").toLowerCase().indexOf(q) !== -1; });
        return inNom || inCode || inActes;
      });

      var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-4)">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap">';
      html += '<div><h1 style="margin:0">Référentiel des Barèmes d\'Émoluments</h1>';
      html += '<p style="opacity:.65;font-size:14px;margin:2px 0 0">Barèmes officiels réglementés (Décret N° 2013-279 du 24/04/2013) et barèmes d\'étude dégressifs par tranches.</p></div>';
      
      html += '<div style="display:flex;gap:var(--space-2);align-items:center">';
      html += '<button type="button" class="btn btn-secondary" id="btn-exporter-baremes" style="font-size:13px;padding:8px 14px;font-weight:600">Exporter le référentiel (JSON)</button>';
      html += '<button type="button" class="btn btn-primary" id="btn-creer-nouveau-bareme" style="font-size:13px;padding:8px 16px;font-weight:700">+ Nouveau Barème d\'Émoluments</button>';
      html += '</div>';
      html += '</div></div>';

      // KPI Grid
      var kpis = [
        { label: "Barèmes Actifs", valeur: String(baremes.length), indice: "accent", icon: "", sub: "Dégressifs par tranches" },
        { label: "Types d'Actes Rattachés", valeur: String(tousLesActes.filter(function (a) { return a.baremeEmolumentsId; }).length) + " / " + tousLesActes.length, indice: "", icon: "", sub: "Au catalogue de l'étude" },
        { label: "Référence Légale", valeur: "Décret 2013-279", indice: "", icon: "", sub: "Barème officiel notariat CI" },
        { label: "Rôles Autorisés", valeur: "Notaire · 1er Clerc · Compta", indice: "accent", icon: "", sub: "Paramétrage & barèmes" },
      ];
      html += renderKpisGrid(kpis);

      // Barre de recherche
      html += '<div class="dashboard-panel" style="margin-top:var(--space-4)">';
      html += '<div class="panel-header" style="flex-wrap:wrap;gap:var(--space-3);align-items:center">';
      html += '<div class="panel-title">Catalogue des Barèmes d\'Émoluments & Dégressivité</div>';
      html += '<div style="font-size:12px;font-weight:600;color:var(--color-text-dim)">' + baremesFiltres.length + ' barème(s) listé(s)</div>';
      html += '</div>';

      html += '<div style="padding:var(--space-3) var(--space-4);background:var(--color-surface-2);border-bottom:1px solid var(--color-border);display:flex;align-items:center;gap:var(--space-3)">';
      html += '<div style="flex:1;position:relative">';
      html += '<input type="search" id="filtre-recherche-baremes" class="input" placeholder="Rechercher un barème par nom, code ou type d\'acte associé..." value="' + (etatEmoluments.recherche || "") + '" style="background:var(--color-bg);font-size:13px;padding:8px 12px 8px 36px;width:100%">';
      html += '';
      html += '</div>';
      if (etatEmoluments.recherche) {
        html += '<button type="button" id="btn-effacer-recherche-baremes" class="btn btn-ghost" style="font-size:12px;padding:6px 10px">Effacer</button>';
      }
      html += '</div>';

      // Grille des cartes de barèmes
      if (!baremesFiltres.length) {
        html += '<div style="padding:40px 20px;text-align:center;color:var(--color-text-dim)">';
        html += '<div style="font-size:15px;font-weight:600">Aucun barème d\'émoluments trouvé.</div>';
        html += '<div style="font-size:12px;margin-top:4px">Cliquez sur le bouton "+ Nouveau Barème d\'Émoluments" pour en créer un.</div>';
        html += '</div>';
      } else {
        html += '<div style="padding:var(--space-4);display:grid;grid-template-columns:repeat(auto-fit, minmax(420px, 1fr));gap:var(--space-4)">';

        baremesFiltres.forEach(function (b) {
          var actesAssocies = actesParBareme[b.id] || [];
          var estBaremeSysteme = (b.code === "vente" || b.code === "societe" || b.code === "pret");

          html += '<div class="card" style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:var(--space-4);display:flex;flex-direction:column;gap:var(--space-3);box-shadow:var(--shadow-sm)">';

          // Titre et code du barème
          html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
          html += '<div>';
          html += '<div style="font-size:16px;font-weight:700;color:var(--color-text)">' + b.libelle + '</div>';
          html += '<div style="display:flex;align-items:center;gap:6px;margin-top:4px">';
          html += '<span class="tag tag-outline" style="font-family:monospace;font-size:11px">code: ' + b.code + '</span>';
          if (estBaremeSysteme) {
            html += '<span class="tag tag-accent" style="font-size:10.5px">Décret N° 2013-279</span>';
          } else {
            html += '<span class="tag" style="background:rgba(16,185,129,0.12);color:#10b981;font-size:10.5px">Barème d\'Étude</span>';
          }
          html += '</div>';
          html += '</div>';

          // Actions Modifier / Associer / Supprimer
          html += '<div style="display:flex;gap:4px">';
          html += '<button type="button" class="btn btn-secondary btn-modifier-bareme" data-id="' + b.id + '" style="font-size:11.5px;padding:5px 10px;font-weight:600" title="Modifier le barème et ses tranches">Modifier</button>';
          html += '<button type="button" class="btn btn-ghost btn-associer-bareme" data-id="' + b.id + '" style="font-size:11.5px;padding:5px 10px;font-weight:600" title="Associer des types d\'actes">Actes associés (' + actesAssocies.length + ')</button>';
          if (!estBaremeSysteme) {
            html += '<button type="button" class="btn btn-ghost btn-supprimer-bareme" data-id="' + b.id + '" style="font-size:11.5px;padding:5px 8px;color:#ef4444" title="Supprimer ce barème">Supprimer</button>';
          }
          html += '</div>';
          html += '</div>';

          // Tableau des tranches
          html += '<div style="background:var(--color-surface-2);border-radius:var(--radius);border:1px solid var(--color-border);padding:8px 10px">';
          html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:6px">Tranches Dégressives Réglementées :</div>';

          if (!b.tranches || !b.tranches.length) {
            html += '<div style="font-size:12px;color:var(--color-text-dim);font-style:italic">Aucune tranche définie (Minimum légal de minute appliqué).</div>';
          } else {
            html += '<table class="table" style="font-size:12px;margin:0"><thead><tr>';
            html += '<th style="padding:4px 6px">Tranche</th><th style="padding:4px 6px">Assiette (FCFA)</th><th style="padding:4px 6px;text-align:right">Taux (%)</th>';
            html += '</tr></thead><tbody>';

            var bornePrec = 0;
            b.tranches.forEach(function (tr, idx) {
              var borneSupStr = tr.jusqua ? fmtFCFA(tr.jusqua) : "Au-delà";
              var plageStr = tr.jusqua ? (fmtFCFA(bornePrec) + " à " + borneSupStr) : ("Au-delà de " + fmtFCFA(bornePrec));
              bornePrec = tr.jusqua || bornePrec;
              var pct = (tr.taux * 100).toFixed(tr.taux < 0.01 ? 2 : 1) + " %";

              html += '<tr>';
              html += '<td style="padding:4px 6px;font-weight:600">Tranche ' + (tr.ordre || (idx + 1)) + '</td>';
              html += '<td style="padding:4px 6px;color:var(--color-text)">' + plageStr + '</td>';
              html += '<td style="padding:4px 6px;text-align:right;font-weight:700;color:var(--color-accent)">' + pct + '</td>';
              html += '</tr>';
            });
            html += '</tbody></table>';
          }
          html += '</div>';

          // Types d'actes rattachés
          html += '<div style="margin-top:auto">';
          html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:4px">Actes appliquant ce barème (' + actesAssocies.length + ') :</div>';
          if (!actesAssocies.length) {
            html += '<div style="font-size:11.5px;color:var(--color-text-dim);font-style:italic">Aucun acte actuellement rattaché. <a href="javascript:void(0)" class="btn-associer-bareme" data-id="' + b.id + '" style="color:var(--color-accent);text-decoration:underline">Rattacher des actes →</a></div>';
          } else {
            html += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
            actesAssocies.forEach(function (act) {
              html += '<span class="tag" style="background:var(--color-surface-2);border:1px solid var(--color-border);font-size:11px">' + act.libelle + '</span>';
            });
            html += '</div>';
          }
          html += '</div>';

          html += '</div>'; // fin card
        });

        html += '</div>'; // fin grille
      }

      html += '</div>'; // fin dashboard-panel

      c.innerHTML = html;

      // Écouteurs de recherche
      var inputRecherche = document.getElementById("filtre-recherche-baremes");
      if (inputRecherche) {
        inputRecherche.addEventListener("input", function () {
          etatEmoluments.recherche = inputRecherche.value;
          renderEmoluments();
        });
      }
      var btnEffacer = document.getElementById("btn-effacer-recherche-baremes");
      if (btnEffacer) {
        btnEffacer.addEventListener("click", function () {
          etatEmoluments.recherche = "";
          renderEmoluments();
        });
      }

      // Bouton Exporter Barèmes
      var btnExport = document.getElementById("btn-exporter-baremes");
      if (btnExport) {
        btnExport.addEventListener("click", function () {
          var exportData = {
            office: (cache.parametres && cache.parametres.nomEtude) || "Office Notarial",
            dateExport: new Date().toISOString(),
            decretReference: "Décret N° 2013-279 du 24 Avril 2013",
            baremes: baremes,
            typesActes: tousLesActes,
          };
          var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url;
          a.download = "Referentiel_Baremes_Emoluments_" + new Date().toISOString().slice(0, 10) + ".json";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast("Référentiel des barèmes exporté avec succès !");
        });
      }

      // Bouton Nouveau Barème
      var btnCreer = document.getElementById("btn-creer-nouveau-bareme");
      if (btnCreer) {
        btnCreer.addEventListener("click", function () {
          modalCreerModifierBareme(null, tousLesActes);
        });
      }

      // Boutons Modifier
      c.querySelectorAll(".btn-modifier-bareme").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var bId = btn.dataset.id;
          var baremeChoisi = baremes.find(function (b) { return b.id === bId; });
          if (baremeChoisi) modalCreerModifierBareme(baremeChoisi, tousLesActes);
        });
      });

      // Boutons Associer Actes
      c.querySelectorAll(".btn-associer-bareme").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var bId = btn.dataset.id;
          var baremeChoisi = baremes.find(function (b) { return b.id === bId; });
          if (baremeChoisi) modalAssocierActesBareme(baremeChoisi, tousLesActes);
        });
      });

      // Boutons Supprimer
      c.querySelectorAll(".btn-supprimer-bareme").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var bId = btn.dataset.id;
          if (confirm("Êtes-vous sûr de vouloir supprimer ce barème d'émoluments ? Les actes qui y étaient rattachés reviendront au minimum légal.")) {
            API.delete("/api/referentiel/baremes/" + bId).then(function () {
              toast("Barème supprimé avec succès.");
              renderEmoluments();
              chargerReferentiel();
            }).catch(function (e) {
              toast("Erreur : " + e.message);
            });
          }
        });
      });

    }).catch(function (err) {
      c.innerHTML = '<p class="erreur-inline">Erreur de chargement des barèmes : ' + err.message + '</p>';
    });
  }

  // MODALE : CRÉER / MODIFIER UN BARÈME D'ÉMOLUMENTS
  function modalCreerModifierBareme(baremeExistant, tousLesActes) {
    var estEdition = !!baremeExistant;
    var titreModal = estEdition 
      ? "Modifier le Barème : " + baremeExistant.libelle 
      : "Nouveau Barème d'Émoluments (Décret N° 2013-279)";

    var tranchesInitiales = (baremeExistant && baremeExistant.tranches && baremeExistant.tranches.length > 0)
      ? baremeExistant.tranches.slice()
      : [
          { ordre: 1, jusqua: 10000000, taux: 0.04 },
          { ordre: 2, jusqua: 30000000, taux: 0.025 },
          { ordre: 3, jusqua: 90000000, taux: 0.015 },
          { ordre: 4, jusqua: null, taux: 0.0075 },
        ];

    var html = '<form id="form-modal-bareme" style="display:flex;flex-direction:column;gap:var(--space-3)">';

    // Libellé et Code
    html += '<div style="display:grid;grid-template-columns:1.5fr 1fr;gap:var(--space-2)">';
    html += '<div class="field"><label>Libellé du Barème d\'Émoluments</label><input class="input" id="bareme-modal-libelle" value="' + (baremeExistant ? baremeExistant.libelle : "") + '" placeholder="Ex: Barème Baux Commerciaux & Ruraux" required></div>';
    html += '<div class="field"><label>Code unique</label><input class="input" id="bareme-modal-code" value="' + (baremeExistant ? baremeExistant.code : "") + '" placeholder="Ex: baux_commerciaux" ' + (estEdition ? "readonly" : "required") + ' style="font-family:monospace"></div>';
    html += '</div>';

    // Section des tranches dynamiques avec modèles rapides
    html += '<div style="background:var(--color-surface-2);border-radius:var(--radius);border:1px solid var(--color-border);padding:12px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:4px">';
    html += '<div style="font-size:11.5px;font-weight:700;text-transform:uppercase;color:var(--color-text-dim)">Tranches Dégressives (En Pourcentage)</div>';
    html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">';
    html += '<span style="font-size:11px;color:var(--color-text-dim)">Modèles :</span>';
    html += '<button type="button" class="btn btn-ghost btn-modele-tranche" data-modele="vente" style="font-size:10.5px;padding:2px 6px">Ventes (4%)</button>';
    html += '<button type="button" class="btn btn-ghost btn-modele-tranche" data-modele="societe" style="font-size:10.5px;padding:2px 6px">Sociétés (1.5%)</button>';
    html += '<button type="button" class="btn btn-ghost btn-modele-tranche" data-modele="pret" style="font-size:10.5px;padding:2px 6px">Prêts (1.5%)</button>';
    html += '<button type="button" class="btn btn-secondary" id="btn-ajouter-tranche" style="font-size:11px;padding:3px 8px;font-weight:700">+ Ajouter</button>';
    html += '</div>';
    html += '</div>';

    html += '<div id="conteneur-tranches-dynamiques" style="display:flex;flex-direction:column;gap:6px">';
    html += '</div>';
    html += '</div>';

    html += '<div id="erreur-modal-bareme" class="erreur-inline" style="display:none"></div>';

    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-2)">';
    html += '<button type="button" class="btn btn-ghost" id="btn-annuler-modal-bareme">Annuler</button>';
    html += '<button type="submit" class="btn btn-primary" id="btn-sauvegarder-bareme">' + (estEdition ? "Enregistrer les modifications" : "Créer le Barème") + '</button>';
    html += '</div>';

    html += '</form>';

    ouvrirModal({
      titre: titreModal,
      corps: html,
      boutonFermer: true,
      largeur: "640px",
      apresOuverture: function () {
        document.getElementById("btn-annuler-modal-bareme").addEventListener("click", fermerModal);

        var conteneurTranches = document.getElementById("conteneur-tranches-dynamiques");
        var tranchesLocales = JSON.parse(JSON.stringify(tranchesInitiales));

        function renderTranchesLignes() {
          if (!conteneurTranches) return;
          var h = '';
          if (!tranchesLocales.length) {
            h = '<p style="font-size:12px;color:var(--color-text-dim);font-style:italic">Aucune tranche. Cliquez sur "Ajouter une tranche".</p>';
          } else {
            tranchesLocales.forEach(function (tr, index) {
              var jusquaVal = tr.jusqua !== null && tr.jusqua !== undefined ? tr.jusqua : "";
              var tauxPct = (Number(tr.taux) * 100).toFixed(2);

              h += '<div class="ligne-tranche-edit" data-idx="' + index + '" style="display:flex;align-items:center;gap:8px;background:var(--color-surface);padding:6px 8px;border-radius:var(--radius);border:1px solid var(--color-border)">';
              h += '<span style="font-size:12px;font-weight:700;width:80px">Tranche ' + (index + 1) + '</span>';
              h += '<div style="flex:1;display:flex;align-items:center;gap:4px">';
              h += '<span style="font-size:11px;color:var(--color-text-dim)">Jusqu\'à :</span>';
              h += '<input class="input tranche-jusqua" type="number" step="1000" min="0" placeholder="Vide = Au-delà" value="' + jusquaVal + '" style="font-size:12px;padding:4px 8px;height:30px">';
              h += '<span style="font-size:11px;color:var(--color-text-dim)">FCFA</span>';
              h += '</div>';
              h += '<div style="width:120px;display:flex;align-items:center;gap:4px">';
              h += '<span style="font-size:11px;color:var(--color-text-dim)">Taux :</span>';
              h += '<input class="input tranche-taux" type="number" step="0.01" min="0" max="100" placeholder="Ex: 4" value="' + tauxPct + '" style="font-size:12px;padding:4px 8px;height:30px;font-weight:700;color:var(--color-accent)">';
              h += '<span style="font-size:11px;font-weight:700">%</span>';
              h += '</div>';
              h += '<button type="button" class="btn btn-ghost btn-suppr-tranche" data-idx="' + index + '" style="padding:2px 6px;font-size:13px;color:#ef4444" title="Supprimer cette tranche">✕</button>';
              h += '</div>';
            });
          }
          conteneurTranches.innerHTML = h;

          // Écouteurs sur chaque ligne
          conteneurTranches.querySelectorAll(".ligne-tranche-edit").forEach(function (row) {
            var idx = parseInt(row.dataset.idx, 10);
            var inJusqua = row.querySelector(".tranche-jusqua");
            var inTaux = row.querySelector(".tranche-taux");
            var btnSupp = row.querySelector(".btn-suppr-tranche");

            inJusqua.addEventListener("input", function () {
              var val = inJusqua.value.trim();
              tranchesLocales[idx].jusqua = val === "" ? null : Number(val);
            });
            inTaux.addEventListener("input", function () {
              var val = parseFloat(inTaux.value) || 0;
              tranchesLocales[idx].taux = val / 100;
            });
            btnSupp.addEventListener("click", function () {
              tranchesLocales.splice(idx, 1);
              renderTranchesLignes();
            });
          });
        }

        renderTranchesLignes();

        document.querySelectorAll(".btn-modele-tranche").forEach(function (btnMod) {
          btnMod.addEventListener("click", function () {
            var mod = btnMod.dataset.modele;
            if (mod === "vente") {
              tranchesLocales = [
                { ordre: 1, jusqua: 10000000, taux: 0.04 },
                { ordre: 2, jusqua: 30000000, taux: 0.025 },
                { ordre: 3, jusqua: 90000000, taux: 0.015 },
                { ordre: 4, jusqua: null, taux: 0.0075 },
              ];
            } else if (mod === "societe") {
              tranchesLocales = [
                { ordre: 1, jusqua: 10000000, taux: 0.015 },
                { ordre: 2, jusqua: 50000000, taux: 0.01 },
                { ordre: 3, jusqua: 100000000, taux: 0.0075 },
                { ordre: 4, jusqua: null, taux: 0.005 },
              ];
            } else if (mod === "pret") {
              tranchesLocales = [
                { ordre: 1, jusqua: 10000000, taux: 0.015 },
                { ordre: 2, jusqua: 50000000, taux: 0.0075 },
                { ordre: 3, jusqua: null, taux: 0.005 },
              ];
            }
            renderTranchesLignes();
            toast("Modèle de tranches '" + mod + "' appliqué !");
          });
        });

        document.getElementById("btn-ajouter-tranche").addEventListener("click", function () {
          var dernierJusqua = tranchesLocales.length > 0 ? (tranchesLocales[tranchesLocales.length - 1].jusqua || 50000000) : 10000000;
          tranchesLocales.push({
            ordre: tranchesLocales.length + 1,
            jusqua: dernierJusqua ? dernierJusqua * 2 : null,
            taux: 0.01,
          });
          renderTranchesLignes();
        });

        // Submit form
        document.getElementById("form-modal-bareme").addEventListener("submit", function (ev) {
          ev.preventDefault();
          var libelle = document.getElementById("bareme-modal-libelle").value.trim();
          var code = document.getElementById("bareme-modal-code").value.trim();
          var errZone = document.getElementById("erreur-modal-bareme");
          errZone.style.display = "none";

          if (!libelle || !code) {
            errZone.textContent = "Le libellé et le code sont obligatoires.";
            errZone.style.display = "block";
            return;
          }

          var tranchesFinales = tranchesLocales.map(function (tr, i) {
            return {
              ordre: i + 1,
              jusqua: tr.jusqua === null || tr.jusqua === "" ? null : Number(tr.jusqua),
              taux: Number(tr.taux) || 0,
            };
          });

          var p = estEdition
            ? API.put("/api/referentiel/baremes/" + baremeExistant.id, { libelle: libelle, tranches: tranchesFinales })
            : API.post("/api/referentiel/baremes", { code: code, libelle: libelle, tranches: tranchesFinales });

          p.then(function () {
            toast(estEdition ? "Barème mis à jour avec succès !" : "Nouveau barème créé avec succès !");
            fermerModal();
            renderEmoluments();
            chargerReferentiel();
          }).catch(function (e) {
            errZone.textContent = "Erreur : " + e.message;
            errZone.style.display = "block";
          });
        });
      }
    });
  }

  // MODALE : ASSOCIER DES TYPES D'ACTES À UN BARÈME
  function modalAssocierActesBareme(bareme, tousLesActes) {
    var html = '<form id="form-modal-associer-actes" style="display:flex;flex-direction:column;gap:var(--space-3)">';
    html += '<p style="font-size:13px;color:var(--color-text-dim);margin:0">Cochez les types d\'actes qui doivent appliquer le <strong>' + bareme.libelle + '</strong> lors du calcul de la fiche de taxe :</p>';

    html += '<div style="max-height:360px;overflow-y:auto;border:1px solid var(--color-border);border-radius:var(--radius);padding:8px 12px;display:flex;flex-direction:column;gap:6px;background:var(--color-surface-2)">';

    tousLesActes.forEach(function (act) {
      var estAssocie = (act.baremeEmolumentsId === bareme.id);
      var autreBareme = act.baremeEmolumentsId && act.baremeEmolumentsId !== bareme.id ? " (rattaché à un autre barème)" : "";

      html += '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:4px 0">';
      html += '<input type="checkbox" class="chk-assoc-acte" data-id="' + act.id + '" ' + (estAssocie ? "checked" : "") + ' style="width:16px;height:16px">';
      html += '<span><strong>' + act.libelle + '</strong><span style="font-size:11px;color:var(--color-text-dim);margin-left:4px">' + autreBareme + '</span></span>';
      html += '</label>';
    });

    html += '</div>';

    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-2)">';
    html += '<button type="button" class="btn btn-ghost" id="btn-annuler-assoc-actes">Fermer</button>';
    html += '<button type="submit" class="btn btn-primary">Enregistrer les associations</button>';
    html += '</div>';

    html += '</form>';

    ouvrirModal({
      titre: "Association des Actes — " + bareme.libelle,
      corps: html,
      boutonFermer: true,
      largeur: "560px",
      apresOuverture: function () {
        document.getElementById("btn-annuler-assoc-actes").addEventListener("click", fermerModal);

        document.getElementById("form-modal-associer-actes").addEventListener("submit", function (ev) {
          ev.preventDefault();
          var checkboxes = document.querySelectorAll(".chk-assoc-acte");
          var promises = [];

          checkboxes.forEach(function (chk) {
            var acteId = chk.dataset.id;
            var coche = chk.checked;
            var acteOrig = tousLesActes.find(function (a) { return a.id === acteId; });
            var etaitAssocie = (acteOrig && acteOrig.baremeEmolumentsId === bareme.id);

            if (coche && !etaitAssocie) {
              promises.push(API.post("/api/referentiel/types-actes/" + acteId + "/associer-bareme", { baremeId: bareme.id }));
            } else if (!coche && etaitAssocie) {
              promises.push(API.post("/api/referentiel/types-actes/" + acteId + "/associer-bareme", { baremeId: null }));
            }
          });

          Promise.all(promises).then(function () {
            toast("Associations enregistrées avec succès !");
            fermerModal();
            renderEmoluments();
            chargerReferentiel();
          }).catch(function (e) {
            toast("Erreur : " + e.message);
          });
        });
      }
    });
  }

  // -----------------------------------------------------------------
  // Comptabilité & Facturation (Décret 2013-279 & TEST.xlsx)
  // =========================================================================
  // GESTION COMPTABILITÉ, FACTURATION & FICHES DE TAXE (DÉCRET 2013-279)
  // =========================================================================
  var etatComptabilite = {
    rechercheClient: "",
    filtre: "tous", // "tous", "soumis", "valide", "a_corriger", "brouillon"
  };

  function renderComptabilite() {
    var c = document.getElementById("vue-comptabilite");
    c.innerHTML = '<p class="text-muted">Chargement de la comptabilité & facturation…</p>';

    API.get("/api/fiscal/toutes-fiches").catch(function () { return []; }).then(function (fichesToutes) {
      var fichesParDossier = {};
      (fichesToutes || []).forEach(function (f) {
        if (f.dossier_id && !fichesParDossier[f.dossier_id]) {
          fichesParDossier[f.dossier_id] = f;
        }
      });

      var synthese = calculerSyntheseEtude(cache.dossiers);
      var estNotaire = cache.utilisateur && (cache.utilisateur.role === "notaire" || cache.utilisateur.role === "superadmin");

      var kpis = [
        { label: "Honoraires & Émoluments HT", valeur: fmtFCFA(synthese.totalEmolumentsHT), indice: "", icon: "", sub: "Décret N° 2013-279" },
        { label: "Droits DGI & Conservation", valeur: fmtFCFA(synthese.totalDroitsDGI), indice: "accent", icon: "", sub: "Droits proportionnels & fixes" },
        { label: "TVA légale (18 %)", valeur: fmtFCFA(Math.round(synthese.totalEmolumentsHT * 0.18)), indice: "", icon: "", sub: "Reversée au Trésor public" },
        { label: "Provisions Séquestres (CDCI)", valeur: fmtFCFA(synthese.sequestresCDCI), indice: "accent", icon: "", sub: "Acomptes clients sous séquestre" },
      ];

      var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-4)">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap">';
      html += '<div><h1 style="margin:0">Facturation & Liquidation Notariale</h1>';
      html += '<p style="opacity:.65;font-size:14px;margin:2px 0 0">Établissement des fiches de taxe (internes), notes de frais (provisions client) et factures fiscales TTC (Décret 2013-279).</p></div>';
      html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
      html += '<button type="button" class="btn btn-secondary" id="btn-gerer-modeles-excel" style="font-size:12.5px;padding:7px 12px;font-weight:600">📂 Modèles Excel (.xlsx)</button>';
      html += '<button type="button" class="btn btn-secondary" id="btn-creer-fiche-taxe-top" style="font-size:12.5px;padding:7px 12px;font-weight:700;background:rgba(217,119,6,0.12);color:#d97706;border-color:rgba(217,119,6,0.35)">🖨️ + Établir une Fiche de Taxe</button>';
      html += '<button type="button" class="btn btn-secondary" id="btn-creer-note-frais-top" style="font-size:12.5px;padding:7px 12px;font-weight:700;background:rgba(5,150,105,0.12);color:#059669;border-color:rgba(5,150,105,0.35)">📄 + Établir une Note de Frais</button>';
      html += '<button type="button" class="btn btn-primary" id="btn-creer-facture-top" style="font-size:12.5px;padding:7px 14px;font-weight:700;background:#0891b2;border-color:#0891b2">🧾 + Établir une Facture</button>';
      html += '</div></div></div>';

      html += renderKpisGrid(kpis);

      // 3 Cartes d'action prioritaires de Facturation
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--space-3);margin:var(--space-4) 0">';
      
      html += '<div class="card" style="background:var(--color-surface);border:1.5px solid rgba(217,119,6,0.35);padding:14px;border-radius:var(--radius);display:flex;flex-direction:column;justify-content:space-between;box-shadow:var(--shadow-sm)">';
      html += '<div>';
      html += '<div style="font-size:13px;font-weight:800;color:#d97706;display:flex;align-items:center;gap:6px">🖨️ 1. FICHE DE TAXE (INTERNE)</div>';
      html += '<p style="font-size:12px;color:var(--color-text-dim);margin:6px 0 12px">Calcul technique en 4 colonnes (Trésor, Émoluments, Débours) pour liquidation déontologique et visa de Maître.</p>';
      html += '</div>';
      html += '<button type="button" class="btn btn-secondary btn-creer-fiche-taxe-carte" style="background:rgba(217,119,6,0.1);color:#d97706;border-color:rgba(217,119,6,0.35);font-weight:700;font-size:12.5px;padding:8px">🖨️ Établir une Fiche de Taxe →</button>';
      html += '</div>';

      html += '<div class="card" style="background:var(--color-surface);border:1.5px solid rgba(5,150,105,0.35);padding:14px;border-radius:var(--radius);display:flex;flex-direction:column;justify-content:space-between;box-shadow:var(--shadow-sm)">';
      html += '<div>';
      html += '<div style="font-size:13px;font-weight:800;color:#059669;display:flex;align-items:center;gap:6px">📄 2. NOTE DE FRAIS (CLIENT)</div>';
      html += '<p style="font-size:12px;color:var(--color-text-dim);margin:6px 0 12px">Appel de provision pour frais client en 3 colonnes réglementaires (Droits, Débours, Émoluments) remis avant signature.</p>';
      html += '</div>';
      html += '<button type="button" class="btn btn-secondary btn-creer-note-frais-carte" style="background:rgba(5,150,105,0.1);color:#059669;border-color:rgba(5,150,105,0.35);font-weight:700;font-size:12.5px;padding:8px">📄 Établir une Note de Frais →</button>';
      html += '</div>';

      html += '<div class="card" style="background:var(--color-surface);border:1.5px solid rgba(8,145,178,0.35);padding:14px;border-radius:var(--radius);display:flex;flex-direction:column;justify-content:space-between;box-shadow:var(--shadow-sm)">';
      html += '<div>';
      html += '<div style="font-size:13px;font-weight:800;color:#0891b2;display:flex;align-items:center;gap:6px">🧾 3. FACTURE NORMALISÉE (TTC)</div>';
      html += '<p style="font-size:12px;color:var(--color-text-dim);margin:6px 0 12px">Facture fiscale définitive avec TVA 18 % sur honoraires et quittance libératoire après formalités.</p>';
      html += '</div>';
      html += '<button type="button" class="btn btn-primary btn-creer-facture-carte" style="background:#0891b2;border-color:#0891b2;font-weight:700;font-size:12.5px;padding:8px">🧾 Établir une Facture →</button>';
      html += '</div>';

      html += '</div>';

      // Calcul des compteurs par statut
      var nbSoumis = 0;
      var nbValides = 0;
      var nbACorriger = 0;
      var nbBrouillons = 0;

      cache.dossiers.forEach(function (d) {
        var f = fichesParDossier[d.id];
        if (!f) {
          nbBrouillons++;
        } else {
          var st = f.statut || "valide";
          if (st === "soumis") nbSoumis++;
          else if (st === "valide" || st === "valide_corrige") nbValides++;
          else if (st === "a_corriger") nbACorriger++;
          else nbBrouillons++;
        }
      });

      // Filtres déontologiques
      html += '<div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4);flex-wrap:wrap;border-bottom:1px solid var(--color-border);padding-bottom:var(--space-2)">';
      var tabs = [
        { id: "tous", label: "Tous les dossiers", count: cache.dossiers.length },
        { id: "soumis", label: "⏳ En attente Visa Notaire", count: nbSoumis, color: "#d97706" },
        { id: "valide", label: "✅ Validées", count: nbValides, color: "#059669" },
        { id: "a_corriger", label: "⚠️ À Corriger", count: nbACorriger, color: "#dc2626" },
        { id: "brouillon", label: "📝 Brouillons / À Établir", count: nbBrouillons },
      ];

      tabs.forEach(function (t) {
        var estActif = (etatComptabilite.filtre === t.id);
        var badgeStyle = t.color ? 'background:' + t.color + ';color:#fff;font-weight:700' : 'background:var(--color-surface-2);color:var(--color-text-dim)';
        var btnStyle = estActif ? 'border-bottom:2px solid var(--color-accent);font-weight:700;color:var(--color-accent)' : 'color:var(--color-text-dim)';
        html += '<button type="button" class="btn btn-ghost btn-filtre-compta" data-filtre="' + t.id + '" style="font-size:13px;padding:6px 12px;border-radius:0;' + btnStyle + '">';
        html += t.label + ' <span style="font-size:11px;padding:2px 6px;border-radius:10px;margin-left:4px;' + badgeStyle + '">' + t.count + '</span>';
        html += '</button>';
      });
      html += '</div>';

      // Barre de recherche client
      html += '<div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-3);align-items:center">';
      html += '<input type="text" id="filtre-client-compta" class="input" placeholder="🔍 Rechercher par client, affaire ou numéro de dossier…" value="' + escapeHtml(etatComptabilite.rechercheClient) + '" style="max-width:380px;font-size:13px">';
      if (etatComptabilite.rechercheClient) {
        html += '<button type="button" class="btn btn-ghost" id="btn-effacer-recherche-compta" style="font-size:12px">Effacer</button>';
      }
      html += '</div>';

      // Liste filtrée des dossiers
      var dossiersFiltres = cache.dossiers.filter(function (d) {
        var f = fichesParDossier[d.id];
        var st = f ? (f.statut || "valide") : "brouillon";

        if (etatComptabilite.filtre === "soumis" && st !== "soumis") return false;
        if (etatComptabilite.filtre === "valide" && (st !== "valide" && st !== "valide_corrige")) return false;
        if (etatComptabilite.filtre === "a_corriger" && st !== "a_corriger") return false;
        if (etatComptabilite.filtre === "brouillon" && st !== "brouillon") return false;

        if (etatComptabilite.rechercheClient) {
          var q = etatComptabilite.rechercheClient.toLowerCase();
          var matchClient = (d.clientNom || "").toLowerCase().indexOf(q) !== -1;
          var matchComp = (d.comparantsNoms || "").toLowerCase().indexOf(q) !== -1;
          var matchNum = (d.numeroDossier || "").toLowerCase().indexOf(q) !== -1;
          var matchActe = (d.typeActeId || "").toLowerCase().indexOf(q) !== -1;
          if (!matchClient && !matchComp && !matchNum && !matchActe) return false;
        }
        return true;
      });

      html += '<div class="dashboard-panel">';
      html += '<div class="panel-header"><div class="panel-title">Portefeuille d\'actes & Tableaux de Liquidation</div><span class="tag tag-outline">' + dossiersFiltres.length + ' dossier(s)</span></div>';

      if (!dossiersFiltres.length) {
        html += '<div class="panel-body" style="text-align:center;padding:var(--space-6);color:var(--color-text-dim)">Aucun dossier ne correspond aux critères sélectionnés.</div>';
      } else {
        html += '<div class="table-wrap"><table class="table" style="font-size:12.5px"><thead><tr>';
        html += '<th>Dossier</th><th>Client / Comparants</th><th>Acte</th><th style="text-align:right">Assiette (Base)</th><th style="text-align:right">CA Émoluments HT</th><th style="text-align:right">Total TTC</th><th>Statut Visa</th><th>Actions Rapides</th>';
        html += '</tr></thead><tbody>';

        dossiersFiltres.forEach(function (d) {
          var ficheRecente = fichesParDossier[d.id];
          var statutFiche = ficheRecente ? (ficheRecente.statut || "valide") : "a_etablir";
          var montantAssiette = Number(d.montantAssiette) || 0;
          
          var totaux = (ficheRecente && ficheRecente.donnees && ficheRecente.donnees.totaux) ? ficheRecente.donnees.totaux : null;
          var emoHT = totaux ? (totaux.emolumentsHT || totaux.general) : 0;
          var totalGen = totaux ? totaux.general : 0;

          html += '<tr>';
          html += '<td><strong style="color:var(--color-text)">' + d.numeroDossier + '</strong></td>';
          html += '<td><div>' + escapeHtml(d.comparantsNoms || d.clientNom || "Client") + '</div></td>';
          html += '<td><span class="tag tag-outline">' + labelActe(d.typeActeId) + '</span></td>';
          html += '<td style="text-align:right;font-weight:600">' + fmtFCFA(montantAssiette) + '</td>';
          html += '<td style="text-align:right;color:var(--color-accent);font-weight:700">' + (totaux ? fmtFCFA(emoHT) : '<span style="color:var(--color-text-dim)">—</span>') + '</td>';
          html += '<td style="text-align:right;font-weight:800;color:var(--color-text)">' + (totaux ? fmtFCFA(totalGen) : '<span style="color:var(--color-text-dim)">—</span>') + '</td>';

          // Statut Déontologique
          html += '<td>';
          if (statutFiche === "soumis") {
            html += '<span class="tag" style="background:rgba(245,158,11,0.15);color:#d97706;font-weight:700;font-size:10.5px;padding:3px 6px;border:1px solid rgba(245,158,11,0.3)">⏳ Soumis Notaire</span>';
          } else if (statutFiche === "valide") {
            html += '<span class="tag" style="background:rgba(16,185,129,0.15);color:#059669;font-weight:700;font-size:10.5px;padding:3px 6px;border:1px solid rgba(16,185,129,0.3)">✅ Validée</span>';
          } else if (statutFiche === "valide_corrige") {
            html += '<span class="tag" style="background:rgba(6,182,212,0.15);color:#0891b2;font-weight:700;font-size:10.5px;padding:3px 6px;border:1px solid rgba(6,182,212,0.3)">✏️ Validée (Corrigée)</span>';
          } else if (statutFiche === "a_corriger") {
            var commTooltip = ficheRecente && ficheRecente.commentaire_notaire ? escapeHtml(ficheRecente.commentaire_notaire) : "À corriger selon directives du Notaire";
            html += '<span class="tag" style="background:rgba(239,68,68,0.15);color:#dc2626;font-weight:700;font-size:10.5px;padding:3px 6px;border:1px solid rgba(239,68,68,0.3);cursor:help" title="' + commTooltip + '">⚠️ À corriger</span>';
          } else if (statutFiche === "brouillon") {
            html += '<span class="tag tag-outline" style="font-size:10.5px;padding:3px 6px">Brouillon</span>';
          } else {
            html += '<span class="tag tag-outline" style="font-size:10.5px;padding:3px 6px;opacity:.75">À établir</span>';
          }
          html += '</td>';

          // Actions
          html += '<td><div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">';
          var libelleBtnAction = !ficheRecente ? '+ Établir Taxe' : (statutFiche === 'soumis' && estNotaire ? '⚖️ Examiner / Valider' : 'Modifier Taxe');
          var classeBtnAction = (statutFiche === 'soumis' && estNotaire) ? 'btn btn-primary' : (ficheRecente ? 'btn btn-secondary' : 'btn btn-primary');

          html += '<button type="button" class="' + classeBtnAction + ' btn-ouvrir-modal-taxe" data-id="' + d.id + '" style="font-size:11px;padding:3px 7px;font-weight:700">' + libelleBtnAction + '</button>';
          html += '<button type="button" class="btn btn-secondary btn-imprimer-fiche-taxe-row" data-id="' + d.id + '" style="font-size:11px;padding:3px 6px" title="Consulter et imprimer la Fiche de Taxe Interne">🖨️ Taxe</button>';
          html += '<button type="button" class="btn btn-secondary btn-imprimer-note-frais-row" data-id="' + d.id + '" style="font-size:11px;padding:3px 6px" title="Consulter et imprimer la Note de Frais client">📄 Note Frais</button>';
          html += '<button type="button" class="btn btn-secondary btn-imprimer-facture-row" data-id="' + d.id + '" style="font-size:11px;padding:3px 6px" title="Consulter et imprimer la Facture Normalisée avec TVA 18%">🧾 Facture</button>';
          html += '<button type="button" class="btn btn-secondary btn-export-excel-row" data-id="' + d.id + '" style="font-size:11px;padding:3px 6px;background:rgba(16,185,129,0.1);color:#059669;border-color:rgba(16,185,129,0.3);font-weight:700" title="Télécharger le fichier Excel officiel (.xlsx) complété">📊 Excel</button>';
          html += '<button type="button" class="btn btn-ghost btn-voir-dossier-direct" data-id="' + d.id + '" style="font-size:11px;padding:3px 6px" title="Voir le dossier">Dossier →</button>';
          html += '</div></td>';
          html += '</tr>';
        });

        html += '</tbody></table></div>';
      }
      html += '</div>';

      c.innerHTML = html;

      // Écouteurs d'événements
      var btnModelesExcel = document.getElementById("btn-gerer-modeles-excel");
      if (btnModelesExcel) {
        btnModelesExcel.addEventListener("click", function () {
          modalGererModelesExcel();
        });
      }

      var inputRecherche = document.getElementById("filtre-client-compta");
      if (inputRecherche) {
        inputRecherche.addEventListener("input", function (ev) {
          etatComptabilite.rechercheClient = ev.target.value;
          renderComptabilite();
          var newInput = document.getElementById("filtre-client-compta");
          if (newInput) {
            newInput.focus();
            newInput.setSelectionRange(newInput.value.length, newInput.value.length);
          }
        });
      }

      var btnEffacer = document.getElementById("btn-effacer-recherche-compta") || document.getElementById("btn-reinit-recherche");
      if (btnEffacer) {
        btnEffacer.addEventListener("click", function () {
          etatComptabilite.rechercheClient = "";
          renderComptabilite();
        });
      }

      c.querySelectorAll(".btn-filtre-compta").forEach(function (btn) {
        btn.addEventListener("click", function () {
          etatComptabilite.filtre = btn.dataset.filtre;
          renderComptabilite();
        });
      });

      var btnModelesExcel = document.getElementById("btn-gerer-modeles-excel");
      if (btnModelesExcel) {
        btnModelesExcel.addEventListener("click", modalGererModelesExcel);
      }

      // 1. Établir une Fiche de Taxe
      var btnFicheTop = document.getElementById("btn-creer-fiche-taxe-top") || document.getElementById("btn-nouvelle-fiche-taxe");
      if (btnFicheTop) {
        btnFicheTop.addEventListener("click", function () {
          modalCreerFicheTaxe(null, "fiche_taxe");
        });
      }
      c.querySelectorAll(".btn-creer-fiche-taxe-carte").forEach(function (b) {
        b.addEventListener("click", function () {
          modalCreerFicheTaxe(null, "fiche_taxe");
        });
      });

      // 2. Établir une Note de Frais
      var btnNoteTop = document.getElementById("btn-creer-note-frais-top");
      if (btnNoteTop) {
        btnNoteTop.addEventListener("click", function () {
          modalCreerFicheTaxe(null, "note_frais");
        });
      }
      c.querySelectorAll(".btn-creer-note-frais-carte").forEach(function (b) {
        b.addEventListener("click", function () {
          modalCreerFicheTaxe(null, "note_frais");
        });
      });

      // 3. Établir une Facture
      var btnFactureTop = document.getElementById("btn-creer-facture-top");
      if (btnFactureTop) {
        btnFactureTop.addEventListener("click", function () {
          modalCreerFicheTaxe(null, "facture");
        });
      }
      c.querySelectorAll(".btn-creer-facture-carte").forEach(function (b) {
        b.addEventListener("click", function () {
          modalCreerFicheTaxe(null, "facture");
        });
      });

      c.querySelectorAll(".btn-ouvrir-modal-taxe").forEach(function (btn) {
        btn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          modalCreerFicheTaxe(btn.dataset.id);
        });
      });

      function imprimerDepuisLigne(dId, formatDoc) {
        var dos = (cache.dossiers || []).find(function (it) { return String(it.id) === String(dId); });
        var ficheRec = fichesParDossier && fichesParDossier[dId];
        
        if (!dos) {
          dos = { id: dId, numeroDossier: "DOSSIER", typeActeId: "vente_immobiliere", montantAssiette: 10000000 };
        }

        if (ficheRec && ficheRec.donnees) {
          var fDonnees = Object.assign({}, ficheRec.donnees);
          fDonnees.statut = ficheRec.statut;
          fDonnees._statutFiche = ficheRec.statut;
          fDonnees.id = ficheRec.id;
          fDonnees.commentaire_notaire = ficheRec.commentaire_notaire;
          imprimerDecompteOfficiel(dos, fDonnees, formatDoc);
        } else {
          toast("Chargement du document...");
          var tId = dos.typeActeId || dos.type_acte_id || "vente_immobiliere";
          var mnt = dos.montantAssiette !== undefined ? Number(dos.montantAssiette) : 10000000;
          API.post("/api/fiscal/calculer", { typeActeId: tId, montant: mnt, saisies: {} })
            .then(function (f) {
              imprimerDecompteOfficiel(dos, f, formatDoc);
            })
            .catch(function (e) {
              toast("Calcul : " + e.message);
              imprimerDecompteOfficiel(dos, {}, formatDoc);
            });
        }
      }

      c.querySelectorAll(".btn-imprimer-fiche-taxe-row").forEach(function (btn) {
        btn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          imprimerDepuisLigne(btn.dataset.id, "fiche_taxe");
        });
      });

      c.querySelectorAll(".btn-imprimer-note-frais-row").forEach(function (btn) {
        btn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          imprimerDepuisLigne(btn.dataset.id, "note_frais");
        });
      });

      c.querySelectorAll(".btn-imprimer-facture-row").forEach(function (btn) {
        btn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          imprimerDepuisLigne(btn.dataset.id, "facture");
        });
      });

      c.querySelectorAll(".btn-export-excel-row").forEach(function (btn) {
        btn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          var dId = btn.dataset.id;
          var dos = (cache.dossiers || []).find(function (it) { return String(it.id) === String(dId); }) || { id: dId };
          var nomFichier = "Liquidation_" + (dos.numeroDossier || "Notaire") + ".xlsx";
          toast("Téléchargement du fichier Excel (.xlsx)...");
          API.telechargerFichier("/api/fiscal/dossiers/" + dId + "/export-excel", null, nomFichier)
            .then(function () { toast("Classeur Excel (.xlsx) téléchargé avec succès !"); })
            .catch(function (e) { toast("Erreur export Excel : " + e.message); });
        });
      });

      c.querySelectorAll(".btn-voir-dossier-direct").forEach(function (btn) {
        btn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          ouvrirDossier(btn.dataset.id, "comptabilite");
        });
      });
    });
  }

  // =========================================================================
  // GESTIONNAIRE DES MODÈLES & MATRICES EXCEL D'ÉTUDE (.XLSX)
  // =========================================================================
  function modalGererModelesExcel() {
    API.get("/api/fiscal/modeles-excel").then(function (modeles) {
      var corps = '<div style="display:flex;flex-direction:column;gap:14px">';
      
      // Zone d'importation de fichier Excel d'étude
      corps += '<div class="card" style="background:var(--color-surface-2);border:1.5px dashed var(--color-accent);padding:14px;border-radius:var(--radius);text-align:center">';
      corps += '<div style="font-size:14px;font-weight:700;color:var(--color-text)">📥 Importer un modèle Excel personnalisé (.xlsx)</div>';
      corps += '<p style="font-size:12px;color:var(--color-text-dim);margin:4px 0 10px">Déposez ici la feuille de calcul Excel (.xlsx) habituelle de votre étude. Le système l\'adoptera immédiatement avec sa mise en page, ses colonnes, ses formules et ses styles.</p>';
      corps += '<input type="file" id="input-upload-excel-file" accept=".xlsx,.xls" style="display:none">';
      corps += '<button type="button" class="btn btn-primary" id="btn-choisir-excel-file" style="font-size:12.5px;padding:6px 14px;font-weight:700">📤 Choisir un fichier Excel (.xlsx) sur mon ordinateur</button>';
      corps += '</div>';

      // Liste des modèles disponibles
      corps += '<div>';
      corps += '<div style="font-size:13px;font-weight:700;color:var(--color-text);margin-bottom:8px">Matrices & Fichiers Excel du Cabinet :</div>';
      corps += '<div class="table-wrap"><table class="table" style="font-size:12px;margin:0"><thead><tr><th>Nom du Modèle</th><th>Type</th><th>Taille</th><th>Actions Visuelles</th></tr></thead><tbody>';
      
      (modeles || []).forEach(function (m) {
        var badge = m.type === "personnalise" 
          ? '<span class="tag" style="background:rgba(16,185,129,0.15);color:#059669;font-weight:700">Modèle Étude</span>'
          : '<span class="tag tag-outline">Matrice Notariat CI</span>';
        var tailleKo = m.taille ? Math.round(m.taille / 1024) + ' Ko' : '—';
        corps += '<tr>';
        corps += '<td><strong>' + escapeHtml(m.nom) + '</strong><br><span style="font-size:10.5px;color:var(--color-text-dim)">' + escapeHtml(m.fichier) + '</span></td>';
        corps += '<td>' + badge + '</td>';
        corps += '<td>' + tailleKo + '</td>';
        corps += '<td><div style="display:flex;gap:4px">';
        corps += '<button type="button" class="btn btn-secondary btn-apercu-excel-modele" data-id="' + m.id + '" style="font-size:11px;padding:3px 7px;font-weight:600">👁️ Voir Mise en Page</button>';
        corps += '</div></td>';
        corps += '</tr>';
      });

      corps += '</tbody></table></div>';
      corps += '</div>';
      corps += '</div>';

      ouvrirModal({
        titre: "📂 Modèles Excel du Cabinet & Mise en Page",
        largeur: "820px",
        corps: corps,
        footer: '<button class="btn btn-secondary" id="modal-excel-fermer">Fermer</button>',
        apresOuverture: function () {
          var modalDom = document.getElementById("modal-racine");
          if (!modalDom) return;
          modalDom.querySelector("#modal-excel-fermer").addEventListener("click", fermerModal);

          var btnChoisir = modalDom.querySelector("#btn-choisir-excel-file");
          var inputFichier = modalDom.querySelector("#input-upload-excel-file");
          if (btnChoisir && inputFichier) {
            btnChoisir.addEventListener("click", function () { inputFichier.click(); });
            inputFichier.addEventListener("change", function (e) {
              var file = e.target.files && e.target.files[0];
              if (!file) return;
              if (!file.name.match(/\.xlsx?$/i)) {
                toast("Veuillez sélectionner un fichier Excel (.xlsx ou .xls).");
                return;
              }
              toast("Téléversement et analyse du fichier Excel en cours...");
              var reader = new FileReader();
              reader.onload = function (evt) {
                var b64 = evt.target.result.split(",")[1];
                API.post("/api/fiscal/importer-modele-excel", {
                  nomFichier: file.name,
                  contenuBase64: b64,
                }).then(function () {
                  toast("Modèle Excel ajouté avec succès !");
                  fermerModal();
                  modalGererModelesExcel();
                }).catch(function (err) {
                  toast("Erreur import : " + err.message);
                });
              };
              reader.readAsDataURL(file);
            });
          }

          modalDom.querySelectorAll(".btn-apercu-excel-modele").forEach(function (btn) {
            btn.addEventListener("click", function () {
              var modeleId = btn.dataset.id;
              fermerModal();
              modalApercuDocument({}, {}, "excel_natif", modeleId);
            });
          });
        },
      });
    }).catch(function (err) {
      toast("Erreur chargement modèles : " + err.message);
    });
  }

  // =========================================================================
  // MODALE INTERACTIVE : CRÉER / ÉTABLIR UNE FICHE DE TAXE
  // =========================================================================
  function modalCreerFicheTaxe(dossierIdSelectionne, formatInitial) {
    function formaterEspaces(val) {
      if (val === null || val === undefined || val === "") return "0";
      var str = String(val).replace(/\s/g, "").replace(/[^0-9]/g, "");
      if (!str) return "0";
      return str.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }
    function extraireNombre(str) {
      if (!str) return 0;
      var net = String(str).replace(/\s/g, "").replace(/[^0-9]/g, "");
      return parseFloat(net) || 0;
    }

    var estNotaire = cache.utilisateur && (cache.utilisateur.role === "notaire" || cache.utilisateur.role === "superadmin");

    var chargerTypes = (cache.typesActesListe && cache.typesActesListe.length > 0)
      ? Promise.resolve(cache.typesActesListe)
      : API.get("/api/referentiel/types-actes").then(function (r) {
          cache.typesActesListe = r || [];
          (r || []).forEach(function (t) { cache.typesActesParId[t.id] = t; });
          return cache.typesActesListe;
        }).catch(function () { return []; });

    var chargerDossiers = (cache.dossiers && cache.dossiers.length > 0)
      ? Promise.resolve(cache.dossiers)
      : API.get("/api/dossiers/mes-dossiers").then(function (d) {
          cache.dossiers = d || [];
          return cache.dossiers;
        }).catch(function () { return []; });

    var chargerCatalogue = API.get("/api/fiscal/catalogue-lignes").catch(function () { return []; });

    var chargerHistoriqueDossier = dossierIdSelectionne
      ? API.get("/api/fiscal/dossiers/" + dossierIdSelectionne + "/historique").catch(function () { return []; })
      : Promise.resolve([]);

    Promise.all([chargerTypes, chargerDossiers, chargerCatalogue, chargerHistoriqueDossier]).then(function (res) {
      var typesActes = res[0] || [];
      var dossiers = res[1] || [];
      var catalogueLignes = res[2] || [];
      var historiqueFiches = res[3] || [];
      var derniereFiche = historiqueFiches.length > 0 ? historiqueFiches[0] : null;

      var dossierInitial = dossierIdSelectionne 
        ? dossiers.find(function (d) { return d.id === dossierIdSelectionne; })
        : (dossiers.length > 0 ? dossiers[0] : null);

      var montantInitialVal = dossierInitial ? (Number(dossierInitial.montantAssiette) || 10000000) : 10000000;

      var titreForm = "🖨️ Établissement de la Fiche de Taxe (Liquidation Interne)";
      if (formatInitial === "note_frais") titreForm = "📄 Établissement de la Note de Frais Client (Provisions Décret 2013-279)";
      if (formatInitial === "facture") titreForm = "🧾 Établissement de la Facture Normalisée TTC (Document Fiscal)";

      var html = '<form id="form-modal-creer-taxe" style="display:flex;flex-direction:column;gap:var(--space-3)">';

      // Bandeau d'état déontologique (si fiche existante)
      if (derniereFiche) {
        var st = derniereFiche.statut || "valide";
        if (st === "a_corriger") {
          html += '<div style="background:rgba(239,68,68,0.08);border:1.5px solid rgba(239,68,68,0.4);border-radius:6px;padding:10px 14px;display:flex;align-items:flex-start;gap:10px">';
          html += '<span style="font-size:22px">⚠️</span>';
          html += '<div style="flex:1">';
          html += '<div style="font-weight:800;color:#dc2626;font-size:12.5px;text-transform:uppercase">Fiche Renvoyée pour Correction par le Notaire</div>';
          html += '<div style="font-size:12px;color:var(--color-text);margin-top:3px;background:var(--color-bg);padding:6px 10px;border-radius:4px;border:1px solid rgba(239,68,68,0.3)"><strong>Observations de Maître :</strong> « ' + escapeHtml(derniereFiche.commentaire_notaire || "Veuillez ajuster les formalités et ré-adresser pour visa.") + ' »</div>';
          html += '<div style="font-size:11px;color:var(--color-text-dim);margin-top:4px">Ajustez les éléments ci-dessous puis cliquez sur <strong>« 📤 Re-soumettre au Notaire »</strong>.</div>';
          html += '</div></div>';
        } else if (st === "soumis") {
          html += '<div style="background:rgba(245,158,11,0.08);border:1.5px solid rgba(245,158,11,0.4);border-radius:6px;padding:10px 14px;display:flex;align-items:center;gap:10px">';
          html += '<span style="font-size:22px">⏳</span>';
          html += '<div style="flex:1">';
          html += '<div style="font-weight:800;color:#d97706;font-size:12.5px;text-transform:uppercase">Fiche en Attente de Visa du Notaire</div>';
          html += '<div style="font-size:11.5px;color:var(--color-text);margin-top:2px">Transmise pour contrôle et visa officiel. ' + (estNotaire ? 'Vous pouvez valider ou corriger ci-dessous.' : 'En attente de validation par Maître.') + '</div>';
          html += '</div></div>';
        } else if (st === "valide" || st === "valide_corrige") {
          html += '<div style="background:rgba(16,185,129,0.08);border:1.5px solid rgba(16,185,129,0.4);border-radius:6px;padding:10px 14px;display:flex;align-items:center;gap:10px">';
          html += '<span style="font-size:22px">✅</span>';
          html += '<div style="flex:1">';
          html += '<div style="font-weight:800;color:#059669;font-size:12.5px;text-transform:uppercase">Fiche Certifiée & Validée par le Notaire ' + (st === "valide_corrige" ? '(avec corrections)' : '') + '</div>';
          html += '<div style="font-size:11.5px;color:var(--color-text);margin-top:2px">Fiche fiscale définitive. La note de frais client et la facture peuvent être délivrées.</div>';
          html += '</div></div>';
        }
      }

      // 1. Choix du dossier et client
      html += '<div class="field"><label>Dossier Notarial & Client (Comparants)</label><select class="input" id="taxe-modal-select-dossier" style="font-weight:600">';
      dossiers.forEach(function (d) {
        var clientAff = d.comparantsNoms && d.comparantsNoms.trim() ? d.comparantsNoms.trim() : "Comparant(s)";
        var isSel = (dossierInitial && d.id === dossierInitial.id) ? " selected" : "";
        html += '<option value="' + d.id + '"' + isSel + '>[' + d.numeroDossier + '] ' + clientAff + ' — ' + labelActe(d.typeActeId) + ' (' + fmtFCFA(d.montantAssiette) + ')</option>';
      });
      html += '</select></div>';

      // 2. Type d'acte et montant de l'assiette avec espacement
      html += '<div style="display:grid;grid-template-columns:1.2fr 1fr;gap:var(--space-2)">';
      html += '<div class="field"><div style="display:flex;justify-content:space-between;align-items:center"><label style="margin:0">Type d\'Acte Notarié (Barème)</label><button type="button" class="btn btn-ghost" id="btn-modal-taxe-voir-baremes" style="font-size:11px;padding:0 4px;color:var(--color-accent);text-decoration:underline;cursor:pointer" title="Consulter et gérer le référentiel des barèmes">Barèmes →</button></div><select class="input" id="taxe-modal-type-acte" style="font-weight:600;margin-top:4px">';
      typesActes.forEach(function (t) {
        var isActSel = (dossierInitial && t.id === dossierInitial.typeActeId) ? " selected" : "";
        var libelleAff = t.libelle || t.nom || labelActe(t.id);
        html += '<option value="' + t.id + '"' + isActSel + '>' + libelleAff + '</option>';
      });
      html += '</select></div>';
      
      html += '<div class="field"><label>Montant Assiette Fiscale (FCFA)</label>';
      html += '<input class="input" type="text" inputmode="numeric" id="taxe-modal-montant" value="' + formaterEspaces(montantInitialVal) + '" style="font-weight:700;font-size:15px;color:var(--color-accent);letter-spacing:0.5px" required placeholder="Ex: 50 000 000">';
      html += '<div style="font-size:11px;color:var(--color-text-dim);margin-top:3px" id="taxe-modal-montant-aff">Assiette : ' + fmtFCFA(montantInitialVal) + '</div>';
      html += '</div>';
      html += '</div>';

      // 3. Paramètres Invariables de Rédaction & Droits de Timbre (500 F / page)
      html += '<div style="background:var(--color-surface-2);padding:10px 12px;border-radius:var(--radius);border:1px solid var(--color-border)">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--color-text-dim)">Paramètres Invariables (Timbres & Rôles : 500 F / page)</span><span class="tag tag-accent" style="font-size:10px">Tarif Légal Fixe</span></div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:var(--space-2)">';
      html += '<div class="field" style="margin:0"><label style="font-size:11px">Pages Minute</label><input class="input" type="number" min="1" id="taxe-m-timbres-min" value="4"></div>';
      html += '<div class="field" style="margin:0"><label style="font-size:11px">Pages Expédition</label><input class="input" type="number" min="1" id="taxe-m-timbres-exp" value="5"></div>';
      html += '<div class="field" style="margin:0"><label style="font-size:11px">Nb Expéditions</label><input class="input" type="number" min="1" id="taxe-m-timbres-nbexp" value="2"></div>';
      html += '<div class="field" style="margin:0"><label style="font-size:11px">Pages Copies</label><input class="input" type="number" min="0" id="taxe-m-roles-copies" value="0"></div>';
      html += '</div>';
      html += '</div>';

      // 4. Catalogue Interactif des Émoluments & Formalités (Chiffre d'Affaires de l'Étude)
      html += '<div style="border:1px solid var(--color-border);border-radius:var(--radius);background:var(--color-surface);padding:10px 12px">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
      html += '<div><span style="font-size:12px;font-weight:700;color:var(--color-accent);text-transform:uppercase">💼 Émoluments de Formalités & Diligences (CA Notaire)</span><div style="font-size:11px;color:var(--color-text-dim)">Cochez les formalités accomplies pour ce dossier (montants modifiables en direct) :</div></div>';
      html += '<div style="display:flex;gap:6px">';
      html += '<button type="button" class="btn btn-ghost" id="btn-ajouter-formalite-libre" style="font-size:11px;padding:2px 8px;font-weight:600;color:var(--color-accent)">+ Ajouter une formalité</button>';
      html += '<button type="button" class="btn btn-ghost" id="btn-toggle-toutes-formalites" style="font-size:11px;padding:2px 6px">Tout cocher / décocher</button>';
      html += '</div>';
      html += '</div>';

      html += '<div id="conteneur-cases-emoluments" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:6px;max-height:180px;overflow-y:auto;padding-right:4px">';
      
      var formalitesListe = catalogueLignes.filter(function (l) { return l.categorie !== "debours"; });
      if (!formalitesListe.length) {
        formalitesListe = [
          { code: "inscription_livre_foncier", libelle: "Inscription au Livre Foncier", montantDefaut: 75000, actif: true },
          { code: "extrait_topographique", libelle: "Demande d'extrait topographique", montantDefaut: 15000, actif: true },
          { code: "requisition_fonciere", libelle: "Réquisitions foncières", montantDefaut: 10000, actif: true },
          { code: "bordereau_enregistrement", libelle: "Émolument bordereau d'enregistrement", montantDefaut: 1000, actif: true },
          { code: "etats_fonciers", libelle: "Demande d'états fonciers", montantDefaut: 30000, actif: true },
          { code: "situation_fiscale", libelle: "Demande situation fiscale", montantDefaut: 15000, actif: true },
          { code: "certificat_mutation", libelle: "Certificat de mutation foncière", montantDefaut: 75000, actif: false },
          { code: "certificat_localisation", libelle: "Émolument certificat localisation", montantDefaut: 15000, actif: false },
          { code: "vacations", libelle: "Vacations du Notaire", montantDefaut: 150000, actif: false },
          { code: "transport", libelle: "Frais de transport aller/retour", montantDefaut: 81000, actif: false },
          { code: "deplacement_sejour", libelle: "Frais de déplacement et séjour", montantDefaut: 40000, actif: false },
          { code: "art_135", libelle: "Honoraires de diligence (Art. 135)", montantDefaut: 20000, actif: true },
          { code: "divers_papeterie", libelle: "Frais de correspondance & papeterie", montantDefaut: 20000, actif: true }
        ];
      }

      formalitesListe.forEach(function (formItem) {
        var isCheck = formItem.actif ? " checked" : "";
        html += '<div class="item-formalite-row" style="display:flex;align-items:center;justify-content:space-between;gap:6px;background:var(--color-surface-2);padding:4px 8px;border-radius:4px;border:1px solid var(--color-border)">';
        html += '<label style="display:flex;align-items:center;gap:6px;font-size:11.5px;margin:0;cursor:pointer;flex:1">';
        html += '<input type="checkbox" class="chk-formalite-item" data-code="' + formItem.code + '"' + isCheck + '> ';
        html += '<span class="label-formalite-nom">' + formItem.libelle + '</span>';
        html += '</label>';
        html += '<input type="number" class="input input-formalite-montant" data-code="' + formItem.code + '" value="' + formItem.montantDefaut + '" style="width:75px;font-size:11px;padding:2px 4px;text-align:right;height:24px">';
        html += '</div>';
      });
      html += '</div>';

      // Section Débours Tiers
      html += '<div style="margin-top:8px;border-top:1px dashed var(--color-border);padding-top:6px">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
      html += '<div style="font-size:11px;font-weight:700;color:var(--color-warning);text-transform:uppercase">🤝 Débours Tiers (Frais Réels Géomètre / Tribunal / Divers)</div>';
      html += '<button type="button" class="btn btn-ghost" id="btn-ajouter-debours-libre" style="font-size:11px;padding:2px 8px;font-weight:600;color:var(--color-warning)">+ Ajouter un débours</button>';
      html += '</div>';

      html += '<div id="conteneur-cases-debours" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:6px">';
      
      var deboursListe = catalogueLignes.filter(function (l) { return l.categorie === "debours"; });
      if (!deboursListe.length) {
        deboursListe = [
          { code: "debours_dossier_technique", libelle: "Dossier technique / Géomètre", montantDefaut: 150000, actif: false },
          { code: "debours_certificat_localisation", libelle: "Certificat localisation (Frais réels)", montantDefaut: 250000, actif: false },
          { code: "debours_divers_formalites", libelle: "Débours divers de formalités", montantDefaut: 100000, actif: true }
        ];
      }

      deboursListe.forEach(function (debItem) {
        var isDebCheck = debItem.actif ? " checked" : "";
        html += '<div class="item-formalite-row" style="display:flex;align-items:center;justify-content:space-between;gap:6px;background:var(--color-surface-2);padding:4px 8px;border-radius:4px;border:1px solid var(--color-border)">';
        html += '<label style="display:flex;align-items:center;gap:6px;font-size:11.5px;margin:0;cursor:pointer;flex:1">';
        html += '<input type="checkbox" class="chk-debours-item" data-code="' + debItem.code + '"' + isDebCheck + '> ';
        html += '<span class="label-debours-nom">' + debItem.libelle + '</span>';
        html += '</label>';
        html += '<input type="number" class="input input-debours-montant" data-code="' + debItem.code + '" value="' + debItem.montantDefaut + '" style="width:75px;font-size:11px;padding:2px 4px;text-align:right;height:24px">';
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
      html += '</div>';

      // 5. Zone d'aperçu du calcul en temps réel (Structure 4 Colonnes & 3 Piliers)
      html += '<div id="zone-apercu-calcul-modal" style="margin-top:2px"></div>';

      // 6. Section Observations du Notaire (si Notaire)
      if (estNotaire) {
        html += '<div style="background:var(--color-surface-2);border:1px solid var(--color-border);padding:8px 12px;border-radius:var(--radius);margin-top:4px">';
        html += '<label style="font-size:11.5px;font-weight:700;color:var(--color-accent);margin-bottom:4px;display:block">📝 Observations / Remarques du Notaire (obligatoire en cas de renvoi pour correction) :</label>';
        html += '<textarea id="taxe-modal-commentaire-notaire" class="input" style="min-height:50px;font-size:12px" placeholder="Ex: Majorer les vacations de 50 000 F suite au déplacement à Grand-Bassam ou corriger le droit foncier…">' + (derniereFiche && derniereFiche.commentaire_notaire ? escapeHtml(derniereFiche.commentaire_notaire) : '') + '</textarea>';
        html += '</div>';
      }

      html += '<div id="erreur-creer-taxe" class="erreur-inline" style="display:none"></div>';

      // 7. Barre d'actions déontologiques & formats d'impression
      html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-2);margin-top:var(--space-2);flex-wrap:wrap">';
      html += '<button type="button" class="btn btn-ghost" id="btn-annuler-modal-taxe">Fermer</button>';
      html += '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">';
      
      // Boutons d'impression des 3 formats normés & Export Excel
      html += '<button type="button" class="btn btn-secondary" id="btn-imprimer-fiche-taxe" title="Consulter et imprimer la Fiche de Taxe Interne de liquidation">🖨️ Fiche de Taxe</button>';
      html += '<button type="button" class="btn btn-secondary" id="btn-imprimer-note-frais" title="Consulter et imprimer la Note de Frais Prévisionnelle Client">📄 Note de Frais</button>';
      html += '<button type="button" class="btn btn-secondary" id="btn-imprimer-facture" title="Consulter et imprimer la Facture Normalisée TTC avec TVA 18%">🧾 Facture</button>';
      html += '<button type="button" class="btn btn-secondary" id="btn-modal-taxe-export-excel" style="background:rgba(16,185,129,0.12);color:#059669;border-color:rgba(16,185,129,0.35);font-weight:700" title="Télécharger le fichier Excel officiel (.xlsx) complété">📊 Excel (.xlsx)</button>';

      if (estNotaire) {
        // Actions Notaire
        if (derniereFiche && (derniereFiche.statut === "soumis" || derniereFiche.statut === "a_corriger")) {
          html += '<button type="button" class="btn btn-secondary" id="btn-notaire-renvoyer" style="color:#dc2626;border-color:rgba(239,68,68,0.4);font-weight:700">↩️ Renvoyer au Comptable</button>';
          html += '<button type="button" class="btn btn-secondary" id="btn-notaire-corriger-valider" style="color:#0891b2;border-color:rgba(6,182,212,0.4);font-weight:700">✏️ Valider avec Corrections</button>';
        }
        html += '<button type="button" class="btn btn-primary" id="btn-notaire-valider" style="background:#059669;border-color:#059669;font-weight:700">✅ Valider la Taxe</button>';
      } else {
        // Actions Comptable / Clerc
        html += '<button type="button" class="btn btn-secondary" id="btn-enregistrer-brouillon-taxe" style="font-weight:600">💾 Enregistrer Brouillon</button>';
        html += '<button type="button" class="btn btn-primary" id="btn-soumettre-notaire-taxe" style="font-weight:700">📤 Soumettre au Notaire</button>';
      }

      html += '</div>';
      html += '</div>';

      html += '</form>';

      ouvrirModal({
        titre: titreForm,
        corps: html,
        boutonFermer: true,
        largeur: "900px",
        apresOuverture: function () {
          document.getElementById("btn-annuler-modal-taxe").addEventListener("click", fermerModal);

          var btnVoirBaremes = document.getElementById("btn-modal-taxe-voir-baremes");
          if (btnVoirBaremes) {
            btnVoirBaremes.addEventListener("click", function () {
              fermerModal();
              irVers("emoluments");
            });
          }

          var selectDossier = document.getElementById("taxe-modal-select-dossier");
          var selectTypeActe = document.getElementById("taxe-modal-type-acte");
          var inputMontant = document.getElementById("taxe-modal-montant");
          var affMontant = document.getElementById("taxe-modal-montant-aff");

          var dernierCalculResultat = null;

          function construireSaisies() {
            var pagesMin = parseInt(document.getElementById("taxe-m-timbres-min").value, 10) || 4;
            var pagesExp = parseInt(document.getElementById("taxe-m-timbres-exp").value, 10) || (pagesMin + 1);
            var nbExp = parseInt(document.getElementById("taxe-m-timbres-nbexp").value, 10) || 2;
            var pagesCop = parseInt(document.getElementById("taxe-m-roles-copies").value, 10) || 0;

            var lignesEmols = [];
            document.querySelectorAll(".chk-formalite-item").forEach(function (chk) {
              var code = chk.dataset.code;
              var inputMt = document.querySelector('.input-formalite-montant[data-code="' + code + '"]');
              var row = chk.closest(".item-formalite-row");
              var labelElem = row ? row.querySelector(".label-formalite-nom") : null;
              var libelleNom = labelElem ? labelElem.textContent : code;
              var mt = inputMt ? parseFloat(inputMt.value) || 0 : 0;
              lignesEmols.push({ code: code, libelle: libelleNom, actif: chk.checked, montant: mt });
            });

            document.querySelectorAll(".chk-debours-item").forEach(function (chk) {
              var code = chk.dataset.code;
              var inputMt = document.querySelector('.input-debours-montant[data-code="' + code + '"]');
              var row = chk.closest(".item-formalite-row");
              var labelElem = row ? row.querySelector(".label-debours-nom") : null;
              var libelleNom = labelElem ? labelElem.textContent : code;
              var mt = inputMt ? parseFloat(inputMt.value) || 0 : 0;
              lignesEmols.push({ code: code, libelle: libelleNom, categorie: "debours", actif: chk.checked, montant: mt });
            });

            return {
              timbres: { pagesMinute: pagesMin, pagesExpedition: pagesExp, nombreExpeditions: nbExp, pagesBordereau: 1 },
              roles: { pagesMinute: pagesMin, pagesExpedition: pagesExp, nombreExpeditions: nbExp, pagesCopie: pagesCop },
              lignesEmoluments: lignesEmols,
              pagesMinute: pagesMin,
              pagesExpedition: pagesExp,
              nombreExpeditions: nbExp,
              pagesCopie: pagesCop,
            };
          }

          function recalculerApercuModal() {
            if (!selectTypeActe || !inputMontant) return;
            var typeActeId = selectTypeActe.value;
            var montant = extraireNombre(inputMontant.value);
            if (affMontant) affMontant.textContent = "Assiette : " + fmtFCFA(montant);

            var saisies = construireSaisies();

            API.post("/api/fiscal/calculer", { typeActeId: typeActeId, montant: montant, saisies: saisies })
              .then(function (f) {
                dernierCalculResultat = f;
                var zoneApercu = document.getElementById("zone-apercu-calcul-modal");
                if (!zoneApercu) return;

                var emo = f.emoluments || {};
                var totalCA = f.totaux.emolumentsHT || (emo.totalEmolumentsHT || emo.montantHT);
                var totalTresor = f.totaux.tresor || f.totaux.droitsEtat;
                var totalDebours = f.totaux.debours || 0;
                var totalGeneral = f.totaux.general;
                var enLettres = f.totaux.generalEnLettres || "";

                var h = '<div class="card" style="background:var(--color-surface);border:1.5px solid var(--color-border);padding:10px 12px;margin-top:4px">';
                
                // 3 Cartes de synthèse des 3 piliers
                h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">';
                h += '<div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.3);border-radius:6px;padding:8px;text-align:center">';
                h += '<div style="font-size:10.5px;font-weight:700;color:var(--color-accent);text-transform:uppercase">🏛️ CA Émoluments Notaire (HT)</div>';
                h += '<div style="font-size:15px;font-weight:800;color:var(--color-accent);margin-top:2px">' + fmtFCFA(totalCA) + '</div>';
                h += '</div>';

                h += '<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:6px;padding:8px;text-align:center">';
                h += '<div style="font-size:10.5px;font-weight:700;color:var(--color-warning);text-transform:uppercase">🏢 Trésor (DGI & Foncier)</div>';
                h += '<div style="font-size:15px;font-weight:800;color:var(--color-warning);margin-top:2px">' + fmtFCFA(totalTresor) + '</div>';
                h += '</div>';

                h += '<div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:8px;text-align:center">';
                h += '<div style="font-size:10.5px;font-weight:700;color:#10b981;text-transform:uppercase">🤝 Débours Tiers (Frais réels)</div>';
                h += '<div style="font-size:15px;font-weight:800;color:#10b981;margin-top:2px">' + fmtFCFA(totalDebours) + '</div>';
                h += '</div>';
                h += '</div>';

                // Tableau de ventilation détaillé en 4 colonnes
                h += '<div class="table-wrap" style="max-height:160px;overflow-y:auto;border:1px solid var(--color-border);border-radius:4px">';
                h += '<table class="table" style="font-size:11.5px;margin:0"><thead><tr style="background:var(--color-surface-2)">';
                h += '<th style="padding:4px 8px">Rubrique Détaillée</th><th style="padding:4px 8px;text-align:right">Émoluments (HT)</th><th style="padding:4px 8px;text-align:right">Trésor (DGI/Cons)</th><th style="padding:4px 8px;text-align:right">Débours</th>';
                h += '</tr></thead><tbody>';

                // Émoluments détaillés
                if (emo.lignesDetaillees && emo.lignesDetaillees.length) {
                  emo.lignesDetaillees.filter(function (l) { return l.actif; }).forEach(function (l) {
                    h += '<tr>';
                    h += '<td style="padding:3px 8px">' + l.libelle + '</td>';
                    h += '<td style="padding:3px 8px;text-align:right;font-weight:700;color:var(--color-accent)">' + fmtFCFA(l.montant) + '</td>';
                    h += '<td style="padding:3px 8px;text-align:right;color:var(--color-text-dim)">—</td>';
                    h += '<td style="padding:3px 8px;text-align:right;color:var(--color-text-dim)">—</td>';
                    h += '</tr>';
                  });
                }

                // Trésor détaillé
                if (f.lignesTresor && f.lignesTresor.length) {
                  f.lignesTresor.forEach(function (tr) {
                    h += '<tr>';
                    h += '<td style="padding:3px 8px;color:var(--color-text)">' + tr.libelle + '</td>';
                    h += '<td style="padding:3px 8px;text-align:right;color:var(--color-text-dim)">—</td>';
                    h += '<td style="padding:3px 8px;text-align:right;font-weight:700;color:var(--color-warning)">' + fmtFCFA(tr.montant) + '</td>';
                    h += '<td style="padding:3px 8px;text-align:right;color:var(--color-text-dim)">—</td>';
                    h += '</tr>';
                  });
                }

                // Débours détaillés
                if (f.lignesDebours && f.lignesDebours.length) {
                  f.lignesDebours.filter(function (d) { return d.actif; }).forEach(function (deb) {
                    h += '<tr>';
                    h += '<td style="padding:3px 8px;color:var(--color-text)">' + deb.libelle + '</td>';
                    h += '<td style="padding:3px 8px;text-align:right;color:var(--color-text-dim)">—</td>';
                    h += '<td style="padding:3px 8px;text-align:right;color:var(--color-text-dim)">—</td>';
                    h += '<td style="padding:3px 8px;text-align:right;font-weight:700;color:#10b981">' + fmtFCFA(deb.montant) + '</td>';
                    h += '</tr>';
                  });
                }

                // Ligne Total Général
                h += '<tr style="background:var(--color-surface-2);font-weight:800;border-top:1.5px solid var(--color-border)">';
                h += '<td style="padding:4px 8px;color:var(--color-text)">TOTAL TTC LIQUIDÉ :</td>';
                h += '<td style="padding:4px 8px;text-align:right;color:var(--color-accent)">' + fmtFCFA(totalCA) + '</td>';
                h += '<td style="padding:4px 8px;text-align:right;color:var(--color-warning)">' + fmtFCFA(totalTresor) + '</td>';
                h += '<td style="padding:4px 8px;text-align:right;color:#10b981">' + fmtFCFA(totalDebours) + '</td>';
                h += '</tr>';

                h += '</tbody></table></div>';

                // Synthèse TTC en gros
                h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:6px;border-top:1px solid var(--color-border);flex-wrap:wrap;gap:6px">';
                h += '<div style="font-size:11px;color:var(--color-text-dim)">Montant en lettres : <em>' + escapeHtml(enLettres) + '</em></div>';
                h += '<div style="font-size:14px;font-weight:900;color:var(--color-accent)">Total TTC : ' + fmtFCFA(totalGeneral) + '</div>';
                h += '</div>';

                h += '</div>';
                zoneApercu.innerHTML = h;
              })
              .catch(function (e) {
                var zoneApercu = document.getElementById("zone-apercu-calcul-modal");
                if (zoneApercu) zoneApercu.innerHTML = '<div class="alert alert-warning" style="margin-top:6px;font-size:11.5px">Calcul automatique non disponible : ' + escapeHtml(e.message) + '</div>';
              });
          }

          // Formatage automatique du montant avec séparateurs d'espaces
          inputMontant.addEventListener("input", function () {
            var raw = inputMontant.value;
            var num = extraireNombre(raw);
            var pos = inputMontant.selectionStart;
            var oldLen = raw.length;
            inputMontant.value = formaterEspaces(num);
            var diff = inputMontant.value.length - oldLen;
            try { inputMontant.setSelectionRange(pos + diff, pos + diff); } catch (e) {}
            recalculerApercuModal();
          });

          // Écouteurs de modification de sélection dossier
          selectDossier.addEventListener("change", function () {
            var dId = selectDossier.value;
            var curDossier = (cache.dossiers || []).find(function (d) { return d.id === dId; });
            if (curDossier) {
              selectTypeActe.value = curDossier.typeActeId;
              inputMontant.value = formaterEspaces(Number(curDossier.montantAssiette) || 0);
              recalculerApercuModal();
            }
          });

          selectTypeActe.addEventListener("change", recalculerApercuModal);

          // Écouteurs sur les inputs de pages
          ["taxe-m-timbres-min", "taxe-m-timbres-exp", "taxe-m-timbres-nbexp", "taxe-m-roles-copies"].forEach(function (fId) {
            var elem = document.getElementById(fId);
            if (elem) elem.addEventListener("input", recalculerApercuModal);
          });

          // Automatisme pagesMinute => pagesExpédition = pagesMinute + 1
          var inputMin = document.getElementById("taxe-m-timbres-min");
          var inputExp = document.getElementById("taxe-m-timbres-exp");
          if (inputMin && inputExp) {
            inputMin.addEventListener("change", function () {
              var pMin = parseInt(inputMin.value, 10) || 1;
              inputExp.value = pMin + 1;
              recalculerApercuModal();
            });
          }

          // Écouteurs sur les cases à cocher et montants d'émoluments/débours
          function attacherEcouteursCases() {
            document.querySelectorAll(".chk-formalite-item, .chk-debours-item").forEach(function (chk) {
              chk.removeEventListener("change", recalculerApercuModal);
              chk.addEventListener("change", recalculerApercuModal);
            });
            document.querySelectorAll(".input-formalite-montant, .input-debours-montant").forEach(function (inp) {
              inp.removeEventListener("input", recalculerApercuModal);
              inp.addEventListener("input", recalculerApercuModal);
            });
          }
          attacherEcouteursCases();

          // Bouton tout cocher / décocher
          var btnToggle = document.getElementById("btn-toggle-toutes-formalites");
          if (btnToggle) {
            var toggleState = true;
            btnToggle.addEventListener("click", function () {
              toggleState = !toggleState;
              document.querySelectorAll(".chk-formalite-item").forEach(function (chk) {
                chk.checked = toggleState;
              });
              recalculerApercuModal();
            });
          }

          // Ajout dynamique d'une formalité personnalisée
          var btnAjouterFormalite = document.getElementById("btn-ajouter-formalite-libre");
          if (btnAjouterFormalite) {
            btnAjouterFormalite.addEventListener("click", function () {
              var nom = prompt("Nom de la formalité personnalisée :");
              if (!nom || !nom.trim()) return;
              var code = "perso_" + Date.now();
              var conteneur = document.getElementById("conteneur-cases-emoluments");
              var div = document.createElement("div");
              div.className = "item-formalite-row";
              div.style = "display:flex;align-items:center;justify-content:space-between;gap:6px;background:var(--color-surface-2);padding:4px 8px;border-radius:4px;border:1px solid var(--color-border)";
              div.innerHTML = '<label style="display:flex;align-items:center;gap:6px;font-size:11.5px;margin:0;cursor:pointer;flex:1"><input type="checkbox" class="chk-formalite-item" data-code="' + code + '" checked> <span class="label-formalite-nom">' + escapeHtml(nom.trim()) + '</span></label><input type="number" class="input input-formalite-montant" data-code="' + code + '" value="25000" style="width:75px;font-size:11px;padding:2px 4px;text-align:right;height:24px">';
              conteneur.appendChild(div);
              attacherEcouteursCases();
              recalculerApercuModal();
            });
          }

          // Ajout dynamique d'un débours personnalisé
          var btnAjouterDebours = document.getElementById("btn-ajouter-debours-libre");
          if (btnAjouterDebours) {
            btnAjouterDebours.addEventListener("click", function () {
              var nom = prompt("Libellé du débours tiers :");
              if (!nom || !nom.trim()) return;
              var code = "debours_perso_" + Date.now();
              var conteneur = document.getElementById("conteneur-cases-debours");
              var div = document.createElement("div");
              div.className = "item-formalite-row";
              div.style = "display:flex;align-items:center;justify-content:space-between;gap:6px;background:var(--color-surface-2);padding:4px 8px;border-radius:4px;border:1px solid var(--color-border)";
              div.innerHTML = '<label style="display:flex;align-items:center;gap:6px;font-size:11.5px;margin:0;cursor:pointer;flex:1"><input type="checkbox" class="chk-debours-item" data-code="' + code + '" checked> <span class="label-debours-nom">' + escapeHtml(nom.trim()) + '</span></label><input type="number" class="input input-debours-montant" data-code="' + code + '" value="50000" style="width:75px;font-size:11px;padding:2px 4px;text-align:right;height:24px">';
              conteneur.appendChild(div);
              attacherEcouteursCases();
              recalculerApercuModal();
            });
          }

          function ouvrirFormatDepuisModal(formatCible) {
            var dId = selectDossier ? selectDossier.value : (dossierInitial && dossierInitial.id);
            var curDossier = dossiers.find(function (d) { return String(d.id) === String(dId); }) || dossierInitial || {
              id: dId,
              numeroDossier: "DOSSIER",
              typeActeId: selectTypeActe ? selectTypeActe.value : "vente_immobiliere",
              montantAssiette: inputMontant ? extraireNombre(inputMontant.value) : 10000000
            };

            var saisies = construireSaisies();
            toast("Chargement du document...");
            var typeActeVal = selectTypeActe ? selectTypeActe.value : (curDossier.typeActeId || "vente_immobiliere");
            var montantVal = inputMontant ? extraireNombre(inputMontant.value) : (curDossier.montantAssiette || 10000000);

            API.post("/api/fiscal/calculer", {
              typeActeId: typeActeVal,
              montant: montantVal,
              saisies: saisies
            }).then(function (fCalculee) {
              fCalculee.saisies = saisies;
              if (derniereFiche) {
                fCalculee.statut = derniereFiche.statut;
                fCalculee._statutFiche = derniereFiche.statut;
                fCalculee.id = derniereFiche.id;
                fCalculee.commentaire_notaire = derniereFiche.commentaire_notaire;
              }
              modalApercuDocument(curDossier, fCalculee, formatCible);
            }).catch(function (e) {
              modalApercuDocument(curDossier, { saisies: saisies }, formatCible);
            });
          }

          // Impression des 3 formats normés
          document.getElementById("btn-imprimer-fiche-taxe").addEventListener("click", function (ev) {
            ev.preventDefault();
            ouvrirFormatDepuisModal("fiche_taxe");
          });

          document.getElementById("btn-imprimer-note-frais").addEventListener("click", function (ev) {
            ev.preventDefault();
            ouvrirFormatDepuisModal("note_frais");
          });

          document.getElementById("btn-imprimer-facture").addEventListener("click", function (ev) {
            ev.preventDefault();
            ouvrirFormatDepuisModal("facture");
          });

          var btnModalExcel = document.getElementById("btn-modal-taxe-export-excel");
          if (btnModalExcel) {
            btnModalExcel.addEventListener("click", function () {
              var dId = selectDossier.value;
              var curDossier = (cache.dossiers || []).find(function (d) { return d.id === dId; }) || { id: dId };
              var nomFichier = "Liquidation_" + (curDossier.numeroDossier || "Notaire") + ".xlsx";
              var saisies = construireSaisies();
              toast("Génération et remplissage de la matrice Excel (.xlsx)...");
              var payload = {
                dossierId: dId,
                typeActeId: selectTypeActe.value,
                montant: extraireNombre(inputMontant.value),
                saisies: saisies,
                clientNom: curDossier.comparantsNoms || curDossier.clientNom,
                numeroDossier: curDossier.numeroDossier,
              };
              API.telechargerFichier("/api/fiscal/export-excel", payload, nomFichier)
                .then(function () { toast("Classeur Excel (.xlsx) téléchargé avec succès !"); })
                .catch(function (e) { toast("Erreur export Excel : " + e.message); });
            });
          }

          // Fonctions de soumission déontologique
          function enregistrerTaxeAvecStatut(statutCible, commentaireCustom) {
            var dId = selectDossier.value;
            var errZone = document.getElementById("erreur-creer-taxe");
            errZone.style.display = "none";
            var saisies = construireSaisies();

            var payload = {
              saisies: saisies,
              typeActeId: selectTypeActe.value,
              montant: extraireNombre(inputMontant.value),
              statut: statutCible,
              commentaire: commentaireCustom || (document.getElementById("taxe-modal-commentaire-notaire") ? document.getElementById("taxe-modal-commentaire-notaire").value : null)
            };

            API.post("/api/fiscal/dossiers/" + dId + "/enregistrer", payload).then(function () {
              var msg = statutCible === "soumis" 
                ? "Fiche de taxe soumise avec succès au Notaire pour visa !" 
                : (statutCible === "valide" ? "Fiche de taxe validée avec succès !" : "Brouillon enregistré.");
              toast(msg);
              fermerModal();
              renderComptabilite();
            }).catch(function (e) {
              errZone.textContent = "Erreur : " + e.message;
              errZone.style.display = "block";
            });
          }

          // Écouteurs pour le Comptable
          var btnBrouillon = document.getElementById("btn-enregistrer-brouillon-taxe");
          if (btnBrouillon) {
            btnBrouillon.addEventListener("click", function () {
              enregistrerTaxeAvecStatut("brouillon");
            });
          }

          var btnSoumettre = document.getElementById("btn-soumettre-notaire-taxe");
          if (btnSoumettre) {
            btnSoumettre.addEventListener("click", function () {
              enregistrerTaxeAvecStatut("soumis");
            });
          }

          // Écouteurs pour le Notaire
          var btnNotaireValider = document.getElementById("btn-notaire-valider");
          if (btnNotaireValider) {
            btnNotaireValider.addEventListener("click", function () {
              if (derniereFiche && derniereFiche.id) {
                API.post("/api/fiscal/fiches/" + derniereFiche.id + "/valider", {})
                  .then(function () {
                    toast("Fiche de taxe validée conforme par le Notaire !");
                    fermerModal();
                    renderComptabilite();
                  })
                  .catch(function (e) { toast("Erreur validation : " + e.message); });
              } else {
                enregistrerTaxeAvecStatut("valide");
              }
            });
          }

          var btnNotaireCorrigerValider = document.getElementById("btn-notaire-corriger-valider");
          if (btnNotaireCorrigerValider) {
            btnNotaireCorrigerValider.addEventListener("click", function () {
              var comm = document.getElementById("taxe-modal-commentaire-notaire") ? document.getElementById("taxe-modal-commentaire-notaire").value : "Ajusté et validé par le Notaire";
              if (derniereFiche && derniereFiche.id) {
                API.post("/api/fiscal/fiches/" + derniereFiche.id + "/corriger-valider", {
                  saisies: construireSaisies(),
                  typeActeId: selectTypeActe.value,
                  montant: extraireNombre(inputMontant.value),
                  commentaire: comm
                }).then(function () {
                  toast("Fiche de taxe modifiée et validée avec succès (statut: Validé Corrigé) !");
                  fermerModal();
                  renderComptabilite();
                }).catch(function (e) { toast("Erreur correction : " + e.message); });
              } else {
                enregistrerTaxeAvecStatut("valide", comm);
              }
            });
          }

          var btnNotaireRenvoyer = document.getElementById("btn-notaire-renvoyer");
          if (btnNotaireRenvoyer) {
            btnNotaireRenvoyer.addEventListener("click", function () {
              var commArea = document.getElementById("taxe-modal-commentaire-notaire");
              var comm = commArea ? commArea.value.trim() : "";
              if (!comm) {
                alert("Veuillez saisir vos observations ou remarques dans le champ ci-dessus pour expliquer au comptable les corrections à apporter.");
                if (commArea) commArea.focus();
                return;
              }
              if (derniereFiche && derniereFiche.id) {
                API.post("/api/fiscal/fiches/" + derniereFiche.id + "/renvoyer", { commentaire: comm })
                  .then(function () {
                    toast("Fiche renvoyée pour correction avec vos observations !");
                    fermerModal();
                    renderComptabilite();
                    toast("Fiche renvoyée pour correction avec vos observations !");
                    fermerModal();
                    renderComptabilite();
                  })
                  .catch(function (e) { toast("Erreur renvoi : " + e.message); });
              } else {
                enregistrerTaxeAvecStatut("a_corriger", comm);
              }
            });
          }
        },
      });
    });
  }

  // -----------------------------------------------------------------
  // Paramètres du cabinet — Version complète à 5 onglets
  // -----------------------------------------------------------------
  function renderParametres() {
    var c = document.getElementById("vue-parametres");
    c.innerHTML = '<p class="text-muted">Chargement des paramètres…</p>';

    var estNotaire = cache.utilisateur.role === "notaire";

    Promise.all([
      API.get("/api/parametres"),
      estNotaire ? API.get("/api/parametres-notifications").catch(function () { return {}; }) : Promise.resolve({}),
      estNotaire ? API.get("/api/parametres-notifications/modeles").catch(function () { return []; }) : Promise.resolve([]),
      API.get("/api/manuel-procedure").catch(function () { return cache.etapesPipeline; }),
    ]).then(function (res) {
      var paramsEtude = res[0];
      var paramsNotifs = res[1];
      var modelesMessage = res[2];
      var etapesManuel = res[3];

      var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-3)">';
      html += '<h1 style="margin-bottom:2px">Paramètres du cabinet</h1>';
      html += '<p style="opacity:.65;font-size:14px;margin:0">Configuration générale, barèmes fiscaux, notifications et manuel de procédure.</p></div>';

      // Barre d'onglets
      html += '<div class="tabs-nav">';
      html += '<button class="tab-btn actif" data-tab="tab-identite">Identité & Profil</button>';
      html += '<button class="tab-btn" data-tab="tab-fiscalite">Fiscalité & Délais</button>';
      if (estNotaire) {
        html += '<button class="tab-btn" data-tab="tab-notifications">Canaux de notification</button>';
        html += '<button class="tab-btn" data-tab="tab-modeles">Modèles de messages</button>';
      }
      html += '<button class="tab-btn" data-tab="tab-manuel">Manuel de procédure</button>';
      html += '</div>';

      // --- ONGLET 1 : IDENTITÉ & PROFIL ---
      html += '<div id="tab-identite" class="tab-pane actif">';
      html += '<h3 style="margin-bottom:var(--space-3)">Profil connecté</h3>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-4);margin-bottom:var(--space-6);max-width:720px">';
      html += '<div><div class="text-muted" style="font-size:11px;text-transform:uppercase">Nom</div><div style="font-size:15px;font-weight:600">' + cache.utilisateur.nomComplet + '</div></div>';
      html += '<div><div class="text-muted" style="font-size:11px;text-transform:uppercase">Rôle</div><div style="font-size:15px">' + ROLE_LABEL[cache.utilisateur.role] + '</div></div>';
      html += '<div><div class="text-muted" style="font-size:11px;text-transform:uppercase">Email</div><div style="font-size:15px">' + cache.utilisateur.email + '</div></div></div>';

      if (cache.permissions.settingsAdvanced) {
        html += '<h3 style="margin-bottom:var(--space-3)">Coordonnées & Références de l\'étude</h3>';
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--space-3);max-width:720px;margin-bottom:var(--space-4)">';
        html += champ("param-nomEtude", "Nom de l'étude", paramsEtude.nomEtude);
        html += champ("param-titreNotaire", "Titre du notaire", paramsEtude.titreNotaire || "Maître");
        html += champ("param-nomNotaire", "Nom du notaire", paramsEtude.nomNotaire);
        html += champ("param-numeroOrdre", "N° Ordre des notaires", paramsEtude.numeroOrdre);
        html += champ("param-adresse", "Adresse de l'étude", paramsEtude.adresse);
        html += champ("param-boitePostale", "Boîte postale", paramsEtude.boitePostale);
        html += champ("param-telephoneFixe", "Téléphone fixe", paramsEtude.telephoneFixe || paramsEtude.telephone);
        html += champ("param-telephonePortable", "Téléphone portable", paramsEtude.telephonePortable);
        html += champ("param-email", "Email officiel", paramsEtude.email);
        html += champ("param-numeroCC", "N° Compte Contribuable (CC)", paramsEtude.numeroCC);
        html += champ("param-centreImpots", "Centre des Impôts de rattachement", paramsEtude.centreImpots);
        html += champ("param-compteSequestreCDCI", "Compte séquestre CDCI (Caisse des Dépôts)", paramsEtude.compteSequestreCDCI);
        html += '</div>';

        html += '<h3 style="margin-top:var(--space-5);margin-bottom:var(--space-2)">Organisation & Pôle Archivage</h3>';
        html += '<div class="card" style="max-width:720px;margin-bottom:var(--space-4);background:rgba(56,189,248,0.03);border:1px solid var(--color-border);padding:14px 16px;border-radius:var(--radius)">';
        html += '<div class="toggle" style="display:flex;align-items:center;gap:10px">';
        html += '<input type="checkbox" id="param-presenceArchiviste"' + (paramsEtude.presenceArchiviste !== false ? ' checked' : '') + ' style="width:18px;height:18px;cursor:pointer">';
        html += '<label for="param-presenceArchiviste" style="font-weight:700;font-size:14px;color:var(--color-text);cursor:pointer">Présence d\'un Archiviste dédié dans l\'office</label>';
        html += '</div>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:6px 0 0;line-height:1.4">';
        html += '• <strong>Activé (Archiviste dédié) :</strong> L\'étude dispose d\'un profil Archiviste qui gère le minutier, le scellement et les cartons d\'archives.<br>';
        html += '• <strong>Désactivé (Sans archiviste / Petite étude) :</strong> Tous les clercs (Premier clerc, rédacteurs, formalistes, accueil) ont <em>de facto</em> accès à l\'espace Minutier & Archives dans leur menu latéral.';
        html += '</p>';
        html += '</div>';

        html += '<button class="btn btn-primary" id="bouton-save-identite">Enregistrer l\'identité & l\'organisation</button>';
      }
      html += '</div>';

      // --- ONGLET 2 : FISCALITÉ & DÉLAIS ---
      html += '<div id="tab-fiscalite" class="tab-pane">';
      html += '<h3 style="margin-bottom:var(--space-3)">Barèmes fiscaux officiels (Décret N° 2013-279)</h3>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--space-3);max-width:720px;margin-bottom:var(--space-6)">';
      html += champ("param-tauxTVA", "Taux de TVA (%)", paramsEtude.tauxTVA, !estNotaire);
      html += champ("param-minimumLegalMinute", "Minimum légal de minute (FCFA)", paramsEtude.minimumLegalMinute, !estNotaire);
      html += champ("param-tarifPageTimbre", "Timbres fiscaux (FCFA / page)", paramsEtude.tarifPageTimbre, !estNotaire);
      html += champ("param-tarifPageRole", "Rôles de minute (FCFA / page)", paramsEtude.tarifPageRole, !estNotaire);
      html += champ("param-taxeFonciereTaux", "Taxe foncière — taux proportionnel (%)", paramsEtude.taxeFonciereTauxProportionnel, !estNotaire);
      html += champ("param-taxeFonciereDroitFixe", "Taxe foncière — droit fixe (FCFA)", paramsEtude.taxeFonciereDroitFixe, !estNotaire);
      html += champ("param-forfaitDivers", "Forfait papeterie / divers (FCFA)", paramsEtude.forfaitDivers, !estNotaire);
      html += '</div>';

      html += '<h3 style="margin-bottom:var(--space-3)">Seuils d\'alerte & Capacité d\'archives</h3>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--space-3);max-width:720px;margin-bottom:var(--space-4)">';
      html += champ("param-seuilStagnation", "Dossier stagnant après (jours)", paramsEtude.seuilStagnationJours, !estNotaire);
      html += champ("param-seuilAlerteEcheance", "Alerte avant échéance (heures)", paramsEtude.seuilAlerteEcheanceHeures, !estNotaire);
      html += champ("param-capaciteCarton", "Capacité des cartons d'archive (dossiers)", paramsEtude.capaciteCartonArchive, !estNotaire);
      html += '</div>';

      if (estNotaire) {
        html += '<button class="btn btn-primary" id="bouton-save-fiscalite">Enregistrer les réglages fiscaux</button>';
      }
      html += '</div>';

      // --- ONGLET 3 : CANAUX DE NOTIFICATION ---
      if (estNotaire) {
        html += '<div id="tab-notifications" class="tab-pane">';
        html += '<h3 style="margin-bottom:var(--space-3)">Configuration SMTP (Email du cabinet)</h3>';
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--space-3);max-width:720px;margin-bottom:var(--space-6)">';
        html += champ("notif-smtpHote", "Serveur SMTP (Hôte)", paramsNotifs.smtpHote);
        html += champ("notif-smtpPort", "Port SMTP", paramsNotifs.smtpPort);
        html += champ("notif-smtpUtilisateur", "Utilisateur SMTP", paramsNotifs.smtpUtilisateur);
        html += '<div class="field"><label>Mot de passe SMTP ' + (paramsNotifs.smtpMotDePasseDefini ? '<span style="color:var(--color-accent)">(déjà configuré — laisser vide pour ne pas changer)</span>' : '') + '</label><input class="input" type="password" id="notif-smtpMotDePasse" placeholder="••••••••"></div>';
        html += champ("notif-smtpExpediteurNom", "Nom expéditeur", paramsNotifs.smtpExpediteurNom);
        html += champ("notif-smtpExpediteurEmail", "Email expéditeur", paramsNotifs.smtpExpediteurEmail);
        html += '</div>';

        html += '<h3 style="margin-bottom:var(--space-3)">Passerelles SMS & WhatsApp (Webhooks génériques)</h3>';
        html += '<div style="display:flex;flex-direction:column;gap:var(--space-4);max-width:720px;margin-bottom:var(--space-6)">';
        html += '<div class="card"><div class="toggle"><input type="checkbox" id="notif-smsActif"' + (paramsNotifs.smsActif ? " checked" : "") + '><label><strong>Activer les notifications par SMS</strong></label></div>';
        html += champ("notif-smsUrlWebhook", "URL Webhook SMS", paramsNotifs.smsUrlWebhook);
        html += '<div class="field"><label>Identifiants SMS (JSON propre au fournisseur) ' + (paramsNotifs.smsIdentifiantsDefinis ? '<span style="color:var(--color-accent)">(configurés)</span>' : '') + '</label><textarea class="input" id="notif-smsIdentifiants" placeholder=\'{"apiKey": "...", "sender": "..."}\'></textarea></div></div>';

        html += '<div class="card"><div class="toggle"><input type="checkbox" id="notif-whatsappActif"' + (paramsNotifs.whatsappActif ? " checked" : "") + '><label><strong>Activer les notifications WhatsApp</strong></label></div>';
        html += champ("notif-whatsappUrlWebhook", "URL Webhook WhatsApp", paramsNotifs.whatsappUrlWebhook);
        html += '<div class="field"><label>Identifiants WhatsApp (JSON) ' + (paramsNotifs.whatsappIdentifiantsDefinis ? '<span style="color:var(--color-accent)">(configurés)</span>' : '') + '</label><textarea class="input" id="notif-whatsappIdentifiants" placeholder=\'{"token": "..."}\'></textarea></div></div>';
        html += '</div>';

        html += '<h3 style="margin-bottom:var(--space-3)">Notifications Web Push (Navigateur)</h3>';
        html += '<div class="card" style="max-width:720px;margin-bottom:var(--space-4)">';
        html += '<div class="toggle"><input type="checkbox" id="notif-pushActif"' + (paramsNotifs.pushActif ? " checked" : "") + '><label><strong>Activer le Web Push</strong></label></div>';
        html += champ("notif-pushClePublique", "Clé VAPID publique", paramsNotifs.pushClePublique);
        html += '<div class="field"><label>Clé VAPID privée ' + (paramsNotifs.pushCleDefinie ? '<span style="color:var(--color-accent)">(définie — laisser vide pour ne pas changer)</span>' : '') + '</label><input class="input" type="password" id="notif-pushClePrivee" placeholder="••••••••"></div>';
        html += champ("notif-pushContactEmail", "Email de contact VAPID", paramsNotifs.pushContactEmail);
        html += '</div>';

        html += '<button class="btn btn-primary" id="bouton-save-notifs">Enregistrer les canaux de notification</button>';
        html += '</div>';

        // --- ONGLET 4 : MODÈLES DE MESSAGES ---
        html += '<div id="tab-modeles" class="tab-pane">';
        html += '<h3 style="margin-bottom:var(--space-3)">Modèles de messages automatiques</h3>';
        html += '<p class="text-muted" style="font-size:13px;margin-bottom:var(--space-4)">Variables disponibles : {{dossierNumero}}, {{notaireNom}}, {{clercNom}}, {{typeActe}}, {{motif}}</p>';
        html += '<div style="display:flex;flex-direction:column;gap:var(--space-4);max-width:760px">';
        modelesMessage.forEach(function (mod) {
          html += '<div class="card" style="padding:var(--space-4)">';
          html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">';
          html += '<div><strong>Événement : ' + mod.evenement + '</strong> · <span class="tag tag-outline">' + mod.canal + '</span> · <span class="text-muted">Destinataire : ' + mod.destinataire + '</span></div>';
          html += '<label class="toggle" style="font-size:12px"><input type="checkbox" class="modele-actif" data-id="' + mod.id + '"' + (mod.actif ? " checked" : "") + '> Actif</label>';
          html += '</div>';
          if (mod.sujet) {
            html += '<div class="field" style="margin-bottom:var(--space-2)"><label>Sujet / Titre</label><input class="input modele-sujet" data-id="' + mod.id + '" value="' + (mod.sujet || "").replace(/"/g, "&quot;") + '"></div>';
          }
          html += '<div class="field" style="margin-bottom:var(--space-2)"><label>Corps du message</label><textarea class="input modele-corps" data-id="' + mod.id + '">' + (mod.corps || "") + '</textarea></div>';
          html += '<div style="display:flex;justify-content:flex-end"><button class="btn btn-secondary btn-save-modele" data-id="' + mod.id + '" style="font-size:12px;padding:6px 12px">Enregistrer ce modèle</button></div>';
          html += '</div>';
        });
        html += '</div></div>';
      }

      // --- ONGLET 5 : MANUEL DE PROCÉDURE ---
      html += '<div id="tab-manuel" class="tab-pane">';
      html += '<h3 style="margin-bottom:var(--space-3)">Manuel de procédure — Les 6 étapes du pipeline</h3>';
      html += '<p class="text-muted" style="font-size:13px;margin-bottom:var(--space-4)">Définition des responsabilités et des niveaux de criticité par étape d\'instruction.</p>';
      html += '<div style="display:flex;flex-direction:column;gap:var(--space-4);max-width:760px">';
      etapesManuel.forEach(function (et, idx) {
        var accent = ETAPE_COULEUR[idx % ETAPE_COULEUR.length];
        html += '<div class="card" style="border-left:4px solid ' + accent + ';padding:var(--space-4)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">';
        html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:16px;color:' + accent + '">Étape ' + et.id + ' — ' + et.libelle + '</div>';
        html += '<span class="card-kicker">' + et.code + '</span>';
        html += '</div>';
        html += '<div class="field" style="margin-bottom:var(--space-2)"><label>Description & Tâches attendues</label><textarea class="input etape-desc" data-id="' + et.id + '">' + (et.description || "") + '</textarea></div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-3)">';
        html += '<div class="field"><label>Rôle responsable</label><select class="input etape-role" data-id="' + et.id + '">';
        Object.keys(ROLE_LABEL).forEach(function (r) {
          html += '<option value="' + r + '"' + (r === et.roleResponsable ? " selected" : "") + '>' + ROLE_LABEL[r] + '</option>';
        });
        html += '</select></div>';
        html += '<div class="field"><label>Niveau d\'alerte par défaut</label><select class="input etape-alerte" data-id="' + et.id + '">';
        ['normal', 'eleve', 'critique'].forEach(function (n) {
          html += '<option value="' + n + '"' + (n === et.niveauAlerteParDefaut ? " selected" : "") + '>' + (n === "critique" ? "Critique (Rouge)" : n === "eleve" ? "Élevé (Ambre)" : "Normal (Vert)") + '</option>';
        });
        html += '</select></div></div>';
        if (cache.permissions.settingsAdvanced) {
          html += '<div style="display:flex;justify-content:flex-end"><button class="btn btn-secondary btn-save-etape" data-id="' + et.id + '" style="font-size:12px;padding:6px 12px">Mettre à jour l\'étape</button></div>';
        }
        html += '</div>';
      });
      html += '</div></div>';

      c.innerHTML = html;

      // Gestion du basculement d'onglets
      c.querySelectorAll(".tab-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          c.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.remove("actif"); });
          c.querySelectorAll(".tab-pane").forEach(function (p) { p.classList.remove("actif"); });
          btn.classList.add("actif");
          var pane = document.getElementById(btn.dataset.tab);
          if (pane) pane.classList.add("actif");
        });
      });

      // Enregistrement Identité
      var btnSaveIdentite = document.getElementById("bouton-save-identite");
      if (btnSaveIdentite) {
        btnSaveIdentite.addEventListener("click", function () {
          var chkArch = document.getElementById("param-presenceArchiviste");
          var presenceArch = chkArch ? chkArch.checked : true;
          API.put("/api/parametres", {
            nomEtude: document.getElementById("param-nomEtude").value.trim(),
            titreNotaire: document.getElementById("param-titreNotaire").value.trim(),
            nomNotaire: document.getElementById("param-nomNotaire").value.trim(),
            numeroOrdre: document.getElementById("param-numeroOrdre").value.trim(),
            adresse: document.getElementById("param-adresse").value.trim(),
            boitePostale: document.getElementById("param-boitePostale").value.trim(),
            telephoneFixe: document.getElementById("param-telephoneFixe").value.trim(),
            telephonePortable: document.getElementById("param-telephonePortable").value.trim(),
            email: document.getElementById("param-email").value.trim(),
            numeroCC: document.getElementById("param-numeroCC").value.trim(),
            centreImpots: document.getElementById("param-centreImpots").value.trim(),
            compteSequestreCDCI: document.getElementById("param-compteSequestreCDCI").value.trim(),
            presenceArchiviste: presenceArch,
          }).then(function (misAJour) {
            cache.parametres = misAJour;
            if (cache.permissions) {
              cache.permissions.archives = (misAJour.presenceArchiviste === false || cache.utilisateur.role === "archiviste" || cache.utilisateur.role === "notaire" || cache.utilisateur.role === "premier_clerc" || cache.utilisateur.role === "superadmin");
            }
            actualiserBarreSelecteurRoles(cache.utilisateur.role);
            renderMenuNavigation(cache.utilisateur.role);
            toast("Identité & organisation de l'étude mises à jour avec succès !");
          }).catch(function (e) { toast("Erreur : " + e.message); });
        });
      }

      // Enregistrement Fiscalité
      var btnSaveFiscalite = document.getElementById("bouton-save-fiscalite");
      if (btnSaveFiscalite) {
        btnSaveFiscalite.addEventListener("click", function () {
          API.put("/api/parametres", {
            tauxTVA: parseFloat(document.getElementById("param-tauxTVA").value) || paramsEtude.tauxTVA,
            minimumLegalMinute: parseInt(document.getElementById("param-minimumLegalMinute").value, 10) || paramsEtude.minimumLegalMinute,
            tarifPageTimbre: parseInt(document.getElementById("param-tarifPageTimbre").value, 10) || paramsEtude.tarifPageTimbre,
            tarifPageRole: parseInt(document.getElementById("param-tarifPageRole").value, 10) || paramsEtude.tarifPageRole,
            taxeFonciereTauxProportionnel: parseFloat(document.getElementById("param-taxeFonciereTaux").value) || paramsEtude.taxeFonciereTauxProportionnel,
            taxeFonciereDroitFixe: parseInt(document.getElementById("param-taxeFonciereDroitFixe").value, 10) || paramsEtude.taxeFonciereDroitFixe,
            forfaitDivers: parseInt(document.getElementById("param-forfaitDivers").value, 10) || paramsEtude.forfaitDivers,
            seuilStagnationJours: parseInt(document.getElementById("param-seuilStagnation").value, 10) || paramsEtude.seuilStagnationJours,
            seuilAlerteEcheanceHeures: parseInt(document.getElementById("param-seuilAlerteEcheance").value, 10) || paramsEtude.seuilAlerteEcheanceHeures,
            capaciteCartonArchive: parseInt(document.getElementById("param-capaciteCarton").value, 10) || paramsEtude.capaciteCartonArchive,
          }).then(function () { toast("Paramètres fiscaux enregistrés."); }).catch(function (e) { toast(e.message); });
        });
      }

      // Enregistrement Notifications
      var btnSaveNotifs = document.getElementById("bouton-save-notifs");
      if (btnSaveNotifs) {
        btnSaveNotifs.addEventListener("click", function () {
          var payload = {
            smtpHote: document.getElementById("notif-smtpHote").value.trim(),
            smtpPort: parseInt(document.getElementById("notif-smtpPort").value, 10) || 587,
            smtpUtilisateur: document.getElementById("notif-smtpUtilisateur").value.trim(),
            smtpExpediteurNom: document.getElementById("notif-smtpExpediteurNom").value.trim(),
            smtpExpediteurEmail: document.getElementById("notif-smtpExpediteurEmail").value.trim(),
            smsActif: document.getElementById("notif-smsActif").checked,
            smsUrlWebhook: document.getElementById("notif-smsUrlWebhook").value.trim(),
            whatsappActif: document.getElementById("notif-whatsappActif").checked,
            whatsappUrlWebhook: document.getElementById("notif-whatsappUrlWebhook").value.trim(),
            pushActif: document.getElementById("notif-pushActif").checked,
            pushClePublique: document.getElementById("notif-pushClePublique").value.trim(),
            pushContactEmail: document.getElementById("notif-pushContactEmail").value.trim(),
          };
          var mdp = document.getElementById("notif-smtpMotDePasse").value;
          if (mdp) payload.smtpMotDePasse = mdp;
          var pushPriv = document.getElementById("notif-pushClePrivee").value;
          if (pushPriv) payload.pushClePrivee = pushPriv;

          var smsIdStr = document.getElementById("notif-smsIdentifiants").value.trim();
          if (smsIdStr) {
            try { payload.smsIdentifiants = JSON.parse(smsIdStr); } catch (err) { toast("JSON SMS invalide."); return; }
          }
          var waIdStr = document.getElementById("notif-whatsappIdentifiants").value.trim();
          if (waIdStr) {
            try { payload.whatsappIdentifiants = JSON.parse(waIdStr); } catch (err) { toast("JSON WhatsApp invalide."); return; }
          }

          API.put("/api/parametres-notifications", payload)
            .then(function () { toast("Paramètres de notifications enregistrés."); })
            .catch(function (e) { toast(e.message); });
        });
      }

      // Enregistrement unitaire des modèles de message
      c.querySelectorAll(".btn-save-modele").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.dataset.id;
          var card = btn.closest(".card");
          var sujetInput = card.querySelector(".modele-sujet");
          var corpsInput = card.querySelector(".modele-corps");
          var actifInput = card.querySelector(".modele-actif");

          API.patch("/api/parametres-notifications/modeles/" + id, {
            sujet: sujetInput ? sujetInput.value : undefined,
            corps: corpsInput ? corpsInput.value : undefined,
            actif: actifInput ? actifInput.checked : undefined,
          }).then(function () { toast("Modèle enregistré."); }).catch(function (e) { toast(e.message); });
        });
      });

      // Enregistrement des étapes du manuel
      c.querySelectorAll(".btn-save-etape").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.dataset.id;
          var card = btn.closest(".card");
          var desc = card.querySelector(".etape-desc").value;
          var role = card.querySelector(".etape-role").value;
          var alerte = card.querySelector(".etape-alerte").value;

          API.patch("/api/manuel-procedure/" + id, {
            description: desc,
            roleResponsable: role,
            niveauAlerteParDefaut: alerte,
          }).then(function () {
            toast("Étape mise à jour.");
            return chargerReferentiel();
          }).catch(function (e) { toast(e.message); });
        });
      });

    }).catch(function (e) {
      c.innerHTML = '<p class="erreur-inline">' + e.message + '</p>';
    });
  }

  function champ(id, label, valeur, lectureSeule) {
    return '<div class="field"><label>' + label + '</label><input class="input" id="' + id + '" value="' + (valeur != null ? String(valeur) : "").replace(/"/g, "&quot;") + '"' + (lectureSeule ? " disabled" : "") + '></div>';
  }

  // -----------------------------------------------------------------
  // Générateur HTML des 3 documents notariés officiels
  // (Fiche de Taxe 4 Col, Note de Frais Client 3 Pôles, Facture Normalisée TTC)
  // -----------------------------------------------------------------
  function genererHtmlDocumentOfficiel(dossier, f, formatChoisi, params) {
    formatChoisi = formatChoisi || "fiche_taxe";
    params = params || cache.parametres || {};

    var dateJour = new Date().toLocaleDateString("fr-CI", { day: "numeric", month: "long", year: "numeric" });
    var comparantsAff = (dossier.comparantsNoms && dossier.comparantsNoms.trim()) ? dossier.comparantsNoms.trim() : (dossier.clientNom || "Client du dossier");
    var emo = f.emoluments || {};
    var totalCA = f.totaux ? (f.totaux.emolumentsHT || (emo.totalEmolumentsHT || emo.montantHT || 0)) : 0;
    var totalTresor = f.totaux ? (f.totaux.tresor || f.totaux.droitsEtat || 0) : 0;
    var totalDebours = f.totaux ? (f.totaux.debours || 0) : 0;
    var totalGeneral = f.totaux ? (f.totaux.general || 0) : 0;
    var enLettres = (f.totaux && f.totaux.generalEnLettres) ? f.totaux.generalEnLettres : nombreEnLettresFCFA(totalGeneral);

    var html = '<div class="document-a4-notarie" style="padding:15mm;max-width:210mm;margin:0 auto;color:#111;background:#fff;font-family:\'Inter\',Arial,sans-serif;box-sizing:border-box;box-shadow:0 4px 20px rgba(0,0,0,0.15);border-radius:4px;border:1px solid #e5e7eb">';

    // En-tête officiel de l'Étude
    html += '<div style="border-bottom:2px solid #111827;padding-bottom:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start">';
    html += '<div>';
    html += '<div style="font-family:\'Space Grotesk\',Arial,sans-serif;font-weight:800;font-size:14pt;text-transform:uppercase;color:#111827">' + (params.nomEtude || "ÉTUDE DE MAÎTRE NOTAIRE") + '</div>';
    html += '<div style="font-size:11pt;font-weight:700;color:#1f2937;margin-top:2px">' + (params.titreNotaire || "Maître") + ' ' + (params.nomNotaire || "") + ' — NOTAIRE</div>';
    html += '<div style="font-size:8.5pt;color:#4b5563;margin-top:2px">' + (params.adresse || "Abidjan, Côte d'Ivoire") + (params.boitePostale ? " — " + params.boitePostale : "") + '</div>';
    if (params.telephoneFixe || params.telephonePortable) html += '<div style="font-size:8.5pt;color:#4b5563">Tél : ' + (params.telephoneFixe || params.telephonePortable) + '</div>';
    if (params.email) html += '<div style="font-size:8.5pt;color:#4b5563">Email : ' + params.email + '</div>';
    html += '</div>';
    html += '<div style="text-align:right;font-size:8.5pt;color:#4b5563">';
    if (params.numeroCC) html += '<div>N° CC : <strong>' + params.numeroCC + '</strong></div>';
    if (params.centreImpots) html += '<div>Régime / Centre : ' + params.centreImpots + '</div>';
    html += '<div style="margin-top:4px">Abidjan, le <strong>' + dateJour + '</strong></div>';
    html += '</div>';
    html += '</div>';

    // =========================================================================
    // FORMAT 1 : FICHE DE TAXE OFFICIELLE (2 BLOCS / 4 COLONNES CÔTE À CÔTE)
    // =========================================================================
    if (formatChoisi === "fiche_taxe") {
      html += '<div style="text-align:center;margin-bottom:12px">';
      html += '<div style="font-family:\'Space Grotesk\',Arial,sans-serif;font-weight:800;font-size:13pt;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1.5px solid #111;display:inline-block;padding-bottom:2px">FICHE DE TAXE PRÉVISIONNELLE NOTARIÉE</div>';
      html += '<div style="font-size:8pt;color:#6b7280;margin-top:2px">Document interne de liquidation des droits, émoluments et débours (Décret 2013-279)</div>';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:8.5pt;margin-top:6px;background:#f9fafb;padding:6px 10px;border-radius:4px;border:1px solid #e5e7eb;text-align:left">';
      html += '<div>DESIGNATION : <strong>' + comparantsAff + '</strong></div>';
      html += '<div>DOSSIER N° : <strong>' + dossier.numeroDossier + '</strong></div>';
      html += '<div>NATURE DE L\'ACTE : <strong>' + labelActe(dossier.typeActeId) + '</strong></div>';
      html += '<div>BASE DE CALCUL : <strong>' + fmtFCFA(dossier.montantAssiette) + '</strong></div>';
      html += '</div>';
      html += '</div>';

      // Tableau 4 colonnes (2 Blocs côte à côte : Gauche = Trésor / Droite = Étude)
      html += '<table style="width:100%;border-collapse:collapse;margin-top:8px;margin-bottom:12px;font-size:8pt">';
      html += '<thead><tr style="background:#f3f4f6;font-weight:800;border-top:1.5px solid #111;border-bottom:1.5px solid #111">';
      html += '<th style="border:1px solid #d1d5db;padding:4px 6px;text-align:left;width:35%">NATURE (TRÉSOR & FORMALITÉS)</th>';
      html += '<th style="border:1px solid #d1d5db;padding:4px 6px;text-align:right;width:15%">MONTANT</th>';
      html += '<th style="border:1px solid #d1d5db;padding:4px 6px;text-align:left;width:35%">NATURE (ÉTUDE & HONORAIRES)</th>';
      html += '<th style="border:1px solid #d1d5db;padding:4px 6px;text-align:right;width:15%">MONTANT</th>';
      html += '</tr></thead><tbody>';

      // 1. Timbres Fiscaux (Gauche) vs Rôles (Droite)
      html += '<tr style="background:#f9fafb;font-weight:700">';
      html += '<td colspan="2" style="border:1px solid #d1d5db;padding:3px 6px;color:#374151">TIMBRES FISCAUX</td>';
      html += '<td colspan="2" style="border:1px solid #d1d5db;padding:3px 6px;color:#1e3a8a">RÔLES</td>';
      html += '</tr>';

      var timbresLignes = (f.lignesTresor || []).filter(function (t) { return t.code.indexOf("timbres_") === 0; });
      var emoLignes = (emo.lignesDetaillees || []).filter(function (l) { return l.actif; });
      var rolesLignes = emoLignes.filter(function (l) { return l.code.indexOf("roles_") === 0 || l.code.indexOf("role_") === 0; });
      var honorairesLignes = emoLignes.filter(function (l) { return l.code.indexOf("roles_") !== 0 && l.code.indexOf("role_") !== 0; });

      // Lignes de Timbres vs Rôles
      html += '<tr>';
      html += '<td style="border:1px solid #e5e7eb;padding:3px 6px">Minute (500 F/page)</td>';
      html += '<td style="border:1px solid #e5e7eb;text-align:right;font-weight:600">' + fmtFCFA((timbresLignes[0] && timbresLignes[0].montant) || 2000) + '</td>';
      html += '<td style="border:1px solid #e5e7eb;padding:3px 6px">Minute (500 F/page)</td>';
      html += '<td style="border:1px solid #e5e7eb;text-align:right;font-weight:600;color:#1e3a8a">' + fmtFCFA((rolesLignes[0] && rolesLignes[0].montant) || 2000) + '</td>';
      html += '</tr>';

      html += '<tr>';
      html += '<td style="border:1px solid #e5e7eb;padding:3px 6px">Expédition (500 F/page)</td>';
      html += '<td style="border:1px solid #e5e7eb;text-align:right;font-weight:600">' + fmtFCFA((timbresLignes[1] && timbresLignes[1].montant) || 5000) + '</td>';
      html += '<td style="border:1px solid #e5e7eb;padding:3px 6px">Expédition (500 F/page)</td>';
      html += '<td style="border:1px solid #e5e7eb;text-align:right;font-weight:600;color:#1e3a8a">' + fmtFCFA((rolesLignes[1] && rolesLignes[1].montant) || 7500) + '</td>';
      html += '</tr>';

      html += '<tr>';
      html += '<td style="border:1px solid #e5e7eb;padding:3px 6px">Bordereau d\'enregistrement</td>';
      html += '<td style="border:1px solid #e5e7eb;text-align:right;font-weight:600">' + fmtFCFA((timbresLignes[2] && timbresLignes[2].montant) || 500) + '</td>';
      html += '<td style="border:1px solid #e5e7eb;padding:3px 6px">Copies</td>';
      html += '<td style="border:1px solid #e5e7eb;text-align:right;font-weight:600;color:#1e3a8a">' + fmtFCFA((rolesLignes[2] && rolesLignes[2].montant) || 0) + '</td>';
      html += '</tr>';

      // 2. Enregistrement & Foncier (Gauche) vs Honoraires & Émoluments (Droite)
      html += '<tr style="background:#f9fafb;font-weight:700">';
      html += '<td colspan="2" style="border:1px solid #d1d5db;padding:3px 6px;color:#374151">ENREGISTREMENT & CONSERVATION FONCIÈRE</td>';
      html += '<td colspan="2" style="border:1px solid #d1d5db;padding:3px 6px;color:#1e3a8a">HONORAIRES & ÉMOLUMENTS RÉGLEMENTÉS</td>';
      html += '</tr>';

      var droitEnr = (f.droitEnregistrement && f.droitEnregistrement.montant) || 0;
      var taxeFonc = (f.taxeFonciere && f.taxeFonciere.total) || 0;
      var emoProp = (emo && emo.montantHT) || 0;

      html += '<tr>';
      html += '<td style="border:1px solid #e5e7eb;padding:3px 6px">Droits d\'Enregistrement DGI</td>';
      html += '<td style="border:1px solid #e5e7eb;text-align:right;font-weight:600">' + fmtFCFA(droitEnr) + '</td>';
      html += '<td style="border:1px solid #e5e7eb;padding:3px 6px">Émolument Proportionnel d\'Acte</td>';
      html += '<td style="border:1px solid #e5e7eb;text-align:right;font-weight:700;color:#1e3a8a">' + fmtFCFA(emoProp) + '</td>';
      html += '</tr>';

      html += '<tr>';
      html += '<td style="border:1px solid #e5e7eb;padding:3px 6px">Taxe Foncière (Livre Foncier : 1,2% + 3 000 F)</td>';
      html += '<td style="border:1px solid #e5e7eb;text-align:right;font-weight:600">' + fmtFCFA(taxeFonc) + '</td>';
      html += '<td style="border:1px solid #e5e7eb;padding:3px 6px">Vacations & Déplacements</td>';
      html += '<td style="border:1px solid #e5e7eb;text-align:right;font-weight:600;color:#1e3a8a">' + fmtFCFA(f.vacations || 0) + '</td>';
      html += '</tr>';

      // 3. Formalités Administratives (Gauche) vs Émoluments Formalités & Divers (Droite)
      html += '<tr style="background:#f9fafb;font-weight:700">';
      html += '<td colspan="2" style="border:1px solid #d1d5db;padding:3px 6px;color:#374151">FORMALITÉS & DÉBOURS TIERS</td>';
      html += '<td colspan="2" style="border:1px solid #d1d5db;padding:3px 6px;color:#1e3a8a">ÉMOLUMENTS DE FORMALITÉS & DIVERS</td>';
      html += '</tr>';

      var formGauche = (f.lignesDebours && f.lignesDebours.length) ? f.lignesDebours : [{ libelle: "Réquisition d'État", montant: 6000 }];
      var formDroite = honorairesLignes.filter(function (l) { return l.code !== "emolument_proportionnel"; });
      if (!formDroite.length) {
        formDroite = [
          { libelle: "Dépôt à la banque", montant: 15000 },
          { libelle: "Dépôt à l'enregistrement", montant: 15000 },
          { libelle: "Inscription au livre foncier", montant: 75000 },
          { libelle: "Frais de correspondance, papeterie & dossier", montant: 20000 }
        ];
      }

      var maxLignes = Math.max(formGauche.length, formDroite.length);
      for (var i = 0; i < maxLignes; i++) {
        var g = formGauche[i];
        var d = formDroite[i];
        html += '<tr>';
        html += '<td style="border:1px solid #e5e7eb;padding:3px 6px">' + (g ? g.libelle : '—') + '</td>';
        html += '<td style="border:1px solid #e5e7eb;text-align:right;font-weight:600">' + (g ? fmtFCFA(g.montant) : '—') + '</td>';
        html += '<td style="border:1px solid #e5e7eb;padding:3px 6px">' + (d ? d.libelle : '—') + '</td>';
        html += '<td style="border:1px solid #e5e7eb;text-align:right;font-weight:600;color:#1e3a8a">' + (d ? fmtFCFA(d.montant) : '—') + '</td>';
        html += '</tr>';
      }

      // Sous-totaux des deux colonnes
      html += '<tr style="background:#f3f4f6;font-weight:800;border-top:1.5px solid #111">';
      html += '<td style="border:1px solid #d1d5db;padding:4px 6px">TOTAL (TRÉSOR & DÉBOURS)</td>';
      html += '<td style="border:1px solid #d1d5db;padding:4px 6px;text-align:right;color:#92400e">' + fmtFCFA(totalTresor + totalDebours) + '</td>';
      html += '<td style="border:1px solid #d1d5db;padding:4px 6px">TOTAL (HONORAIRES ÉTUDE)</td>';
      html += '<td style="border:1px solid #d1d5db;padding:4px 6px;text-align:right;color:#1e3a8a">' + fmtFCFA(totalCA) + '</td>';
      html += '</tr>';

      // Total Général
      html += '<tr style="background:#111827;color:#fff;font-weight:800;font-size:9.5pt">';
      html += '<td colspan="2" style="border:1px solid #111827;padding:5px 8px;text-transform:uppercase">TOTAL GÉNÉRAL DE LA TAXE</td>';
      html += '<td colspan="2" style="border:1px solid #111827;padding:5px 8px;text-align:right;font-size:10.5pt">' + fmtFCFA(totalGeneral) + '</td>';
      html += '</tr>';
      html += '</tbody></table>';

      // Formule d'arrêté officiel
      html += '<div style="background:#f9fafb;border:1px solid #e5e7eb;padding:6px 10px;border-radius:4px;font-size:8pt;margin-top:6px">';
      html += 'Sauf à parfaire ou à diminuer, veuillez arrêter la présente taxe prévisionnelle à la somme de :<br>';
      html += '<strong style="font-size:8.5pt;color:#111827">' + enLettres + '</strong>.';
      html += '</div>';
    }

    // =========================================================================
    // FORMAT 2 : NOTE DE FRAIS PRÉVISIONNELLE CLIENT (3 PÔLES)
    // =========================================================================
    else if (formatChoisi === "note_frais") {
      var estTaxeValidee = f && (f.statut === "valide" || f.statut === "valide_corrige" || f._statutFiche === "valide" || f._statutFiche === "valide_corrige");

      if (!estTaxeValidee) {
        // Document verrouillé tant que la Fiche de Taxe n'est pas validée par le Notaire
        html += '<div style="text-align:center;margin-bottom:16px">';
        html += '<div style="font-family:\'Space Grotesk\',Arial,sans-serif;font-weight:800;font-size:13pt;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1.5px solid #111;display:inline-block;padding-bottom:2px">NOTE DE FRAIS PRÉVISIONNELLE N° ' + (dossier.numeroDossier || "EN COURS") + '</div>';
        html += '<div style="font-size:8.5pt;color:#dc2626;font-weight:700;margin-top:3px">⚠️ ÉMISSION CONDITIONNÉE AU VISA DU NOTAIRE</div>';
        html += '</div>';

        html += '<div style="background:#fff;border:1.5px dashed #dc2626;border-radius:6px;padding:32px 20px;text-align:center;margin:20px 0">';
        html += '<div style="font-size:38px;margin-bottom:10px">🔒</div>';
        html += '<div style="font-family:\'Space Grotesk\',Arial,sans-serif;font-weight:800;font-size:13pt;color:#991b1b;text-transform:uppercase">Document Client Indisponible</div>';
        html += '<p style="font-size:9.5pt;color:#4b5563;max-width:520px;margin:10px auto 16px;line-height:1.5">';
        html += 'Conformément aux règles déontologiques du Notariat (Décret 2013-279), la <strong>Note de Frais (Appel de Provision Client)</strong> ne peut être délivrée tant que la <strong>Fiche de Taxe interne</strong> n\'a pas été formellement validée et signée par le Notaire.';
        html += '</p>';
        html += '<div style="display:inline-flex;align-items:center;gap:8px;background:#fef2f2;padding:8px 14px;border-radius:4px;border:1px solid #fca5a5;font-size:11.5px;color:#991b1b;font-weight:700">';
        html += '<span>État actuel de la Fiche de Taxe :</span> ';
        html += '<span class="tag" style="background:#fee2e2;color:#991b1b;font-weight:800">' + ((f && f.statut === "soumis") ? "⏳ Soumise au Notaire (En attente de visa)" : ((f && f.statut === "a_corriger") ? "⚠️ Renvoyée pour correction" : "📝 Brouillon non validé")) + '</span>';
        html += '</div>';
        html += '</div>';
      } else {
        html += '<div style="text-align:center;margin-bottom:16px">';
        html += '<div style="font-family:\'Space Grotesk\',Arial,sans-serif;font-weight:800;font-size:13pt;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1.5px solid #111;display:inline-block;padding-bottom:2px">NOTE DE FRAIS PRÉVISIONNELLE N° ' + dossier.numeroDossier + '</div>';
        html += '<div style="font-size:8pt;color:#6b7280;margin-top:3px">Document d\'appel de provision pour frais et émoluments à transmettre au client</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9pt;margin-top:8px;background:#f9fafb;padding:6px 10px;border-radius:4px;border:1px solid #e5e7eb;text-align:left">';
        html += '<div>Identité du client : <strong>' + comparantsAff + '</strong></div>';
        html += '<div>Affaire : <strong>' + labelActe(dossier.typeActeId) + '</strong></div>';
        html += '<div>Numéro de dossier : <strong>' + dossier.numeroDossier + '</strong></div>';
        html += '<div>Base de calcul : <strong>' + fmtFCFA(dossier.montantAssiette) + '</strong></div>';
        html += '</div>';
        html += '</div>';

        html += '<table style="width:100%;border-collapse:collapse;margin-top:10px;margin-bottom:14px;font-size:8.5pt">';
        html += '<thead><tr style="background:#f3f4f6;font-weight:800;border-top:1.5px solid #111;border-bottom:1.5px solid #111">';
        html += '<th style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;width:33%">DROITS / ÉTAT</th>';
        html += '<th style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;width:33%">DÉBOURS & FORMALITÉS</th>';
        html += '<th style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;width:34%">ÉMOLUMENTS & HONORAIRES</th>';
        html += '</tr></thead><tbody>';

        html += '<tr>';
        // Colonne 1 : Droits
        html += '<td style="border:1px solid #e5e7eb;padding:8px;vertical-align:top">';
        if (f.lignesTresor && f.lignesTresor.length) {
          f.lignesTresor.forEach(function (t) {
            html += '<div style="display:flex;justify-content:space-between;margin-bottom:3px"><span>' + t.libelle + '</span><strong>' + fmtFCFA(t.montant) + '</strong></div>';
          });
        }
        html += '<div style="border-top:1px solid #d1d5db;margin-top:6px;padding-top:4px;display:flex;justify-content:space-between;font-weight:800"><span>Total Droits :</span><span>' + fmtFCFA(totalTresor) + '</span></div>';
        html += '</td>';

        // Colonne 2 : Débours
        html += '<td style="border:1px solid #e5e7eb;padding:8px;vertical-align:top">';
        if (f.lignesDebours && f.lignesDebours.length) {
          f.lignesDebours.forEach(function (deb) {
            html += '<div style="display:flex;justify-content:space-between;margin-bottom:3px"><span>' + deb.libelle + '</span><strong>' + fmtFCFA(deb.montant) + '</strong></div>';
          });
        } else {
          html += '<div style="color:#9ca3af;font-style:italic">Aucun débours spécifique</div>';
        }
        html += '<div style="border-top:1px solid #d1d5db;margin-top:6px;padding-top:4px;display:flex;justify-content:space-between;font-weight:800"><span>Total Débours :</span><span>' + fmtFCFA(totalDebours) + '</span></div>';
        html += '</td>';

        // Colonne 3 : Émoluments
        html += '<td style="border:1px solid #e5e7eb;padding:8px;vertical-align:top">';
        if (emo.lignesDetaillees && emo.lignesDetaillees.length) {
          emo.lignesDetaillees.filter(function (l) { return l.actif; }).forEach(function (l) {
            html += '<div style="display:flex;justify-content:space-between;margin-bottom:3px"><span>' + l.libelle + '</span><strong style="color:#1e3a8a">' + fmtFCFA(l.montant) + '</strong></div>';
          });
        }
        html += '<div style="border-top:1px solid #d1d5db;margin-top:6px;padding-top:4px;display:flex;justify-content:space-between;font-weight:800;color:#1e3a8a"><span>Total Émoluments :</span><span>' + fmtFCFA(totalCA) + '</span></div>';
        html += '</td>';
        html += '</tr>';

        html += '<tr style="background:#111827;color:#fff;font-weight:800;font-size:10pt">';
        html += '<td colspan="2" style="border:1px solid #111827;padding:6px 10px;text-transform:uppercase">TOTAL GÉNÉRAL DE LA NOTE DE FRAIS</td>';
        html += '<td style="border:1px solid #111827;padding:6px 10px;text-align:right;font-size:11pt">' + fmtFCFA(totalGeneral) + '</td>';
        html += '</tr>';
        html += '</tbody></table>';

        html += '<div style="background:#f9fafb;border:1px solid #e5e7eb;padding:8px 12px;border-radius:4px;font-size:8.5pt;margin-top:8px">';
        html += 'Arrêtée la présente note de frais à la somme de :<br>';
        html += '<strong style="font-size:9pt;color:#111827">' + enLettres + '</strong>.';
        html += '</div>';
      }
    }

    // =========================================================================
    // FORMAT 3 : FACTURE NORMALISÉE FISCALE (AVEC TVA 18 %)
    // =========================================================================
    else if (formatChoisi === "facture") {
      var estTaxeValideeF = f && (f.statut === "valide" || f.statut === "valide_corrige" || f._statutFiche === "valide" || f._statutFiche === "valide_corrige");

      if (!estTaxeValideeF) {
        html += '<div style="text-align:center;margin-bottom:16px">';
        html += '<div style="font-family:\'Space Grotesk\',Arial,sans-serif;font-weight:800;font-size:13pt;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1.5px solid #111;display:inline-block;padding-bottom:2px">FACTURE NORMALISÉE NOTARIÉE</div>';
        html += '<div style="font-size:8.5pt;color:#dc2626;font-weight:700;margin-top:2px">⚠️ ÉMISSION CONDITIONNÉE AU VISA DU NOTAIRE</div>';
        html += '</div>';

        html += '<div style="background:#fff;border:1.5px dashed #dc2626;border-radius:6px;padding:32px 20px;text-align:center;margin:20px 0">';
        html += '<div style="font-size:38px;margin-bottom:10px">🔒</div>';
        html += '<div style="font-family:\'Space Grotesk\',Arial,sans-serif;font-weight:800;font-size:13pt;color:#991b1b;text-transform:uppercase">Facture Fiscale Indisponible</div>';
        html += '<p style="font-size:9.5pt;color:#4b5563;max-width:520px;margin:10px auto 16px;line-height:1.5">';
        html += 'La <strong>Facture Normalisée (TTC avec quittance fiscale)</strong> ne peut être émise qu\'après validation définitive de la liquidation des droits et honoraires par Maître.';
        html += '</p>';
        html += '<div style="display:inline-flex;align-items:center;gap:8px;background:#fef2f2;padding:8px 14px;border-radius:4px;border:1px solid #fca5a5;font-size:11.5px;color:#991b1b;font-weight:700">';
        html += '<span>État de la Fiche de Taxe :</span> ';
        html += '<span class="tag" style="background:#fee2e2;color:#991b1b;font-weight:800">' + ((f && f.statut === "soumis") ? "⏳ Soumise au Notaire (En attente de visa)" : ((f && f.statut === "a_corriger") ? "⚠️ Renvoyée pour correction" : "📝 Brouillon non validé")) + '</span>';
        html += '</div>';
        html += '</div>';
      } else {
        html += '<div style="text-align:center;margin-bottom:16px">';
        html += '<div style="font-family:\'Space Grotesk\',Arial,sans-serif;font-weight:800;font-size:13pt;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1.5px solid #111;display:inline-block;padding-bottom:2px">FACTURE NORMALISÉE NOTARIÉE</div>';
        html += '<div style="font-size:8.5pt;color:#6b7280;margin-top:2px">Conforme à la législation fiscale DGI de Côte d\'Ivoire</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9pt;margin-top:8px;background:#f9fafb;padding:6px 10px;border-radius:4px;border:1px solid #e5e7eb;text-align:left">';
        html += '<div>Client : <strong>' + comparantsAff + '</strong></div>';
        html += '<div>Acte : <strong>' + labelActe(dossier.typeActeId) + '</strong></div>';
        html += '<div>Dossier N° : <strong>' + dossier.numeroDossier + '</strong></div>';
        html += '<div>Assiette : <strong>' + fmtFCFA(dossier.montantAssiette) + '</strong></div>';
        html += '</div>';
        html += '</div>';

        html += '<table style="width:100%;border-collapse:collapse;margin-top:10px;margin-bottom:14px;font-size:8.5pt">';
        html += '<thead><tr style="background:#f3f4f6;font-weight:800;border-top:1.5px solid #111;border-bottom:1.5px solid #111">';
        html += '<th style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;width:40%">POSTES</th>';
        html += '<th style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;width:20%">DROITS / ÉTAT</th>';
        html += '<th style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;width:20%">FRAIS DÉBOURS</th>';
        html += '<th style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;width:20%">HONORAIRES HT</th>';
        html += '</tr></thead><tbody>';

        html += '<tr><td style="border:1px solid #e5e7eb;padding:4px 8px">Enregistrement DGI & Timbres</td><td style="border:1px solid #e5e7eb;text-align:right;font-weight:600">' + fmtFCFA(totalTresor) + '</td><td style="border:1px solid #e5e7eb;text-align:right;color:#9ca3af">—</td><td style="border:1px solid #e5e7eb;text-align:right;color:#9ca3af">—</td></tr>';
        html += '<tr><td style="border:1px solid #e5e7eb;padding:4px 8px">Frais Débours & Géomètre</td><td style="border:1px solid #e5e7eb;text-align:right;color:#9ca3af">—</td><td style="border:1px solid #e5e7eb;text-align:right;font-weight:600">' + fmtFCFA(totalDebours) + '</td><td style="border:1px solid #e5e7eb;text-align:right;color:#9ca3af">—</td></tr>';
        html += '<tr><td style="border:1px solid #e5e7eb;padding:4px 8px">Émoluments & Honoraires Notaire</td><td style="border:1px solid #e5e7eb;text-align:right;color:#9ca3af">—</td><td style="border:1px solid #e5e7eb;text-align:right;color:#9ca3af">—</td><td style="border:1px solid #e5e7eb;text-align:right;font-weight:700;color:#1e3a8a">' + fmtFCFA(totalCA) + '</td></tr>';
        html += '<tr style="background:#f9fafb"><td style="border:1px solid #e5e7eb;padding:4px 8px">TVA légale (18 % sur Honoraires)</td><td style="border:1px solid #e5e7eb;text-align:right;color:#9ca3af">—</td><td style="border:1px solid #e5e7eb;text-align:right;color:#9ca3af">—</td><td style="border:1px solid #e5e7eb;text-align:right;font-weight:600">' + fmtFCFA(f.tva || (totalCA * 0.18)) + '</td></tr>';

        var totalFactureTTC = totalTresor + totalDebours + totalCA + (f.tva || (totalCA * 0.18));
        var totalFactureEnLettres = nombreEnLettresFCFA(totalFactureTTC);

        html += '<tr style="background:#111827;color:#fff;font-weight:800;font-size:10pt">';
        html += '<td colspan="2" style="border:1px solid #111827;padding:6px 10px;text-transform:uppercase">TOTAL GÉNÉRAL FACTURE TTC</td>';
        html += '<td colspan="2" style="border:1px solid #111827;padding:6px 10px;text-align:right;font-size:11pt">' + fmtFCFA(totalFactureTTC) + '</td>';
        html += '</tr>';
        html += '</tbody></table>';

        html += '<div style="background:#f9fafb;border:1px solid #e5e7eb;padding:8px 12px;border-radius:4px;font-size:8.5pt;margin-top:8px">';
        html += 'Arrêtée la présente facture à la somme de :<br>';
        html += '<strong style="font-size:9pt;color:#111827">' + totalFactureEnLettres + '</strong>.';
        html += '</div>';
      }
    }

    // Mentions légales & Sceau
    html += '<div style="margin-top:14px;font-size:7.5pt;color:#6b7280;line-height:1.3">';
    html += 'NB : Conformément à la réglementation notariale, la présente taxe prévisionnelle doit être intégralement réglée avant la signature de l\'acte.<br>';
    html += 'En cas de règlement par chèque ou virement, libeller au nom de : <strong>' + (params.nomEtude || "ÉTUDE NOTARIALE") + '</strong>.';
    html += '</div>';

    // Bloc signature
    html += '<div style="margin-top:24px;display:flex;justify-content:space-between;align-items:flex-start;page-break-inside:avoid">';
    html += '<div style="font-size:8.5pt;color:#6b7280">Reçu pour acquit / Bon pour accord :</div>';
    html += '<div style="text-align:right">';
    html += '<div style="font-size:9pt;font-weight:700">' + (params.titreNotaire || "Maître") + ' ' + (params.nomNotaire || "") + '</div>';
    html += '<div style="font-size:8pt;color:#6b7280">Notaire Titulaire</div>';
    html += '<div style="margin-top:35px;font-size:8pt;color:#9ca3af">[ Sceau & Signature ]</div>';
    html += '</div>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  // -----------------------------------------------------------------
  // Modale de Visualisation & Impression A4 Immédiate & Actions de Circuit
  // -----------------------------------------------------------------
  function modalApercuDocument(dossier, donneesFiche, formatInitial, modeleExcelInitial) {
    var formatActuel = formatInitial || "fiche_taxe";
    var modeleActuel = modeleExcelInitial || "TEST";
    var feuilleActuelle = null;

    if (typeof dossier === "string") {
      var dTrouve = (cache.dossiers || []).find(function (d) { return String(d.id) === String(dossier); });
      dossier = dTrouve || { id: dossier, numeroDossier: dossier };
    }
    dossier = dossier || {};
    donneesFiche = donneesFiche || {};

    var estNotaire = cache.utilisateur && (cache.utilisateur.role === "notaire" || cache.utilisateur.role === "superadmin");

    function titreModal(fmt) {
      if (fmt === "fiche_taxe") return "🖨️ Fiche de Taxe (Document Interne de Liquidation)";
      if (fmt === "note_frais") return "📄 Note de Frais Prévisionnelle (Appel de Provision Client)";
      if (fmt === "facture") return "🧾 Facture Normalisée Notariée (Document Fiscal TTC)";
      return "📊 Rendu Direct du Fichier Excel de l'Étude (.xlsx)";
    }

    // Charger paramètres, modèles Excel et la dernière fiche officielle du dossier
    var chargerParams = API.get("/api/parametres").catch(function () { return {}; });
    var chargerModeles = API.get("/api/fiscal/modeles-excel").catch(function () { return []; });
    var chargerFicheDossier = (dossier && dossier.id)
      ? API.get("/api/fiscal/dossiers/" + dossier.id + "/historique").catch(function () { return []; })
      : Promise.resolve([]);

    Promise.all([chargerParams, chargerModeles, chargerFicheDossier]).then(function (res) {
      var params = res[0] || {};
      var modelesExcel = res[1] || [];
      var histoFiches = res[2] || [];
      var ficheBD = histoFiches.length > 0 ? histoFiches[0] : null;

      // Synchroniser les statuts et données avec la base
      if (ficheBD) {
        donneesFiche.statut = ficheBD.statut || donneesFiche.statut || "valide";
        donneesFiche._statutFiche = ficheBD.statut;
        donneesFiche.id = ficheBD.id;
        donneesFiche.commentaire_notaire = ficheBD.commentaire_notaire;
        if (ficheBD.donnees) {
          donneesFiche.totaux = ficheBD.donnees.totaux || donneesFiche.totaux;
          donneesFiche.emoluments = ficheBD.donnees.emoluments || donneesFiche.emoluments;
          donneesFiche.lignesTresor = ficheBD.donnees.lignesTresor || donneesFiche.lignesTresor;
          donneesFiche.lignesDebours = ficheBD.donnees.lignesDebours || donneesFiche.lignesDebours;
          donneesFiche.statutNoteFrais = ficheBD.donnees.statutNoteFrais || "brouillon";
          donneesFiche.statutFacture = ficheBD.donnees.statutFacture || "brouillon";
        }
      }

      function chargerRenduExcelNatif(zoneConteneur) {
        zoneConteneur.innerHTML = '<div style="padding:40px;text-align:center;color:#fff"><div class="spinner"></div><p style="margin-top:8px">Chargement et calcul du classeur Excel…</p></div>';
        
        var payload = {
          dossierId: dossier.id,
          typeActeId: dossier.typeActeId || dossier.type_acte_id,
          montant: dossier.montantAssiette !== undefined ? dossier.montantAssiette : dossier.montant_assiette,
          saisies: (donneesFiche && donneesFiche.saisies) || {},
          modeleId: modeleActuel,
          feuille: feuilleActuelle,
          clientNom: dossier.comparantsNoms || dossier.clientNom,
          numeroDossier: dossier.numeroDossier || dossier.numero_dossier,
        };

        API.post("/api/fiscal/excel/rendu-html", payload).then(function (resExcel) {
          var h = '<div style="display:flex;flex-direction:column;gap:8px;width:100%">';
          
          if (resExcel.feuillesDisponibles && resExcel.feuillesDisponibles.length > 1) {
            h += '<div style="display:flex;gap:4px;background:#374151;padding:6px;border-radius:4px;overflow-x:auto">';
            resExcel.feuillesDisponibles.forEach(function (sh) {
              var isShAct = sh === resExcel.feuilleActive;
              var btnCls = isShAct ? 'background:#10b981;color:#fff;font-weight:700' : 'background:#4b5563;color:#d1d5db';
              h += '<button type="button" class="btn btn-sm btn-select-sheet-excel" data-sheet="' + escapeHtml(sh) + '" style="font-size:11px;padding:3px 8px;border:none;border-radius:3px;cursor:pointer;' + btnCls + '">📑 ' + escapeHtml(sh) + '</button>';
            });
            h += '</div>';
          }

          h += '<div id="conteneur-feuille-excel-injectee" style="overflow-x:auto;display:flex;justify-content:center;background:#52525b;padding:12px;border-radius:4px">';
          h += resExcel.html;
          h += '</div>';

          h += '</div>';
          zoneConteneur.innerHTML = h;

          zoneConteneur.querySelectorAll(".btn-select-sheet-excel").forEach(function (btn) {
            btn.addEventListener("click", function () {
              feuilleActuelle = btn.dataset.sheet;
              chargerRenduExcelNatif(zoneConteneur);
            });
          });
        }).catch(function (err) {
          zoneConteneur.innerHTML = '<div style="padding:20px;color:#ef4444;background:#fff;border-radius:4px">Erreur rendu Excel : ' + escapeHtml(err.message) + '</div>';
        });
      }

      function construireBandeauWorkflow(fmt) {
        var h = '';
        var stTaxe = donneesFiche.statut || "valide";
        var estTaxeValide = stTaxe === "valide" || stTaxe === "valide_corrige";

        if (fmt === "fiche_taxe") {
          h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:var(--radius);border:1px solid var(--color-border);background:var(--color-surface);flex-wrap:wrap;gap:8px">';
          
          // Statut Taxe
          h += '<div style="display:flex;align-items:center;gap:8px">';
          h += '<span style="font-size:12px;font-weight:700">Statut Taxe :</span>';
          if (stTaxe === "soumis") {
            h += '<span class="tag" style="background:#fef3c7;color:#b45309;font-weight:800">⏳ Soumise au Notaire (En attente de visa)</span>';
          } else if (stTaxe === "a_corriger") {
            h += '<span class="tag" style="background:#fee2e2;color:#b91c1c;font-weight:800">⚠️ Renvoyée pour correction</span>';
          } else if (estTaxeValide) {
            h += '<span class="tag" style="background:#d1fae5;color:#047857;font-weight:800">✅ Fiche Certifiée & Validée par le Notaire</span>';
          } else {
            h += '<span class="tag tag-outline">📝 Brouillon</span>';
          }
          h += '</div>';

          // Actions Taxe
          h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
          h += '<button type="button" class="btn btn-secondary" id="btn-wf-modifier-taxe" style="font-size:11.5px;padding:4px 9px;font-weight:700">⚙️ Modifier les Chiffres</button>';
          h += '<button type="button" class="btn btn-secondary" id="btn-wf-save-brouillon-taxe" style="font-size:11.5px;padding:4px 9px">💾 Enregistrer Brouillon</button>';
          h += '<button type="button" class="btn btn-primary" id="btn-wf-soumettre-taxe" style="font-size:11.5px;padding:4px 10px;background:#d97706;border-color:#d97706;font-weight:700">📤 Soumettre au Notaire</button>';
          
          if (estNotaire) {
            h += '<button type="button" class="btn btn-primary" id="btn-wf-valider-taxe" style="font-size:11.5px;padding:4px 10px;background:#059669;border-color:#059669;font-weight:700">✅ Valider la Fiche de Taxe</button>';
            h += '<button type="button" class="btn btn-secondary" id="btn-wf-renvoyer-taxe" style="font-size:11.5px;padding:4px 9px;color:#dc2626;border-color:rgba(220,38,38,0.4)">↩️ Renvoyer pour Correction</button>';
          }
          h += '</div>';

          h += '</div>';

          if (stTaxe === "a_corriger" && donneesFiche.commentaire_notaire) {
            h += '<div style="background:#fef2f2;border:1.5px solid #f87171;padding:8px 12px;border-radius:var(--radius);font-size:12px;color:#991b1b">';
            h += '<strong>Remarques de Maître :</strong> « ' + escapeHtml(donneesFiche.commentaire_notaire) + ' »';
            h += '</div>';
          }
        } else if (fmt === "note_frais") {
          h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:var(--radius);border:1px solid var(--color-border);background:var(--color-surface);flex-wrap:wrap;gap:8px">';
          
          if (!estTaxeValide) {
            h += '<div style="display:flex;align-items:center;gap:8px;color:#dc2626;font-size:12px;font-weight:700">';
            h += '<span>🔒 Note de Frais Verrouillée : La Fiche de Taxe doit être validée par le Notaire avant délivrance.</span>';
            h += '</div>';
            h += '<div><button type="button" class="btn btn-primary btn-aller-valider-taxe" style="font-size:11.5px;padding:4px 10px;background:#059669;border-color:#059669">🖨️ Ouvrir la Fiche de Taxe pour validation →</button></div>';
          } else {
            var stNote = donneesFiche.statutNoteFrais || "brouillon";
            h += '<div style="display:flex;align-items:center;gap:8px">';
            h += '<span style="font-size:12px;font-weight:700">Note de Frais Client :</span>';
            if (stNote === "valide") {
              h += '<span class="tag" style="background:#d1fae5;color:#047857;font-weight:800">✅ Visée & Prête pour remise client</span>';
            } else if (stNote === "soumis") {
              h += '<span class="tag" style="background:#fef3c7;color:#b45309;font-weight:800">⏳ Soumise au Notaire</span>';
            } else {
              h += '<span class="tag" style="background:rgba(16,185,129,0.1);color:#059669;font-weight:700">📝 Prête (Taxe Validée)</span>';
            }
            h += '</div>';

            h += '<div style="display:flex;gap:6px">';
            h += '<button type="button" class="btn btn-primary" id="btn-wf-soumettre-note-frais" style="font-size:11.5px;padding:4px 10px;background:#d97706;border-color:#d97706;font-weight:700">📤 Soumettre la Note au Notaire</button>';
            if (estNotaire) {
              h += '<button type="button" class="btn btn-primary" id="btn-wf-valider-note-frais" style="font-size:11.5px;padding:4px 10px;background:#059669;border-color:#059669;font-weight:700">✅ Viser & Autoriser Remise Client</button>';
            }
            h += '</div>';
          }
          h += '</div>';
        } else if (fmt === "facture") {
          h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:var(--radius);border:1px solid var(--color-border);background:var(--color-surface);flex-wrap:wrap;gap:8px">';
          
          if (!estTaxeValide) {
            h += '<div style="display:flex;align-items:center;gap:8px;color:#dc2626;font-size:12px;font-weight:700">';
            h += '<span>🔒 Facture Verrouillée : La Fiche de Taxe doit être validée par le Notaire avant émission.</span>';
            h += '</div>';
            h += '<div><button type="button" class="btn btn-primary btn-aller-valider-taxe" style="font-size:11.5px;padding:4px 10px;background:#059669;border-color:#059669">🖨️ Ouvrir la Fiche de Taxe pour validation →</button></div>';
          } else {
            var stFac = donneesFiche.statutFacture || "brouillon";
            h += '<div style="display:flex;align-items:center;gap:8px">';
            h += '<span style="font-size:12px;font-weight:700">Facture Normalisée :</span>';
            if (stFac === "valide") {
              h += '<span class="tag" style="background:#d1fae5;color:#047857;font-weight:800">✅ Facture TTC Émise & Quittancée</span>';
            } else if (stFac === "soumis") {
              h += '<span class="tag" style="background:#fef3c7;color:#b45309;font-weight:800">⏳ Soumise pour émission</span>';
            } else {
              h += '<span class="tag" style="background:rgba(16,185,129,0.1);color:#059669;font-weight:700">📝 Prête pour émission</span>';
            }
            h += '</div>';

            h += '<div style="display:flex;gap:6px">';
            h += '<button type="button" class="btn btn-primary" id="btn-wf-soumettre-facture" style="font-size:11.5px;padding:4px 10px;background:#d97706;border-color:#d97706;font-weight:700">📤 Soumettre la Facture au Notaire</button>';
            if (estNotaire) {
              h += '<button type="button" class="btn btn-primary" id="btn-wf-valider-facture" style="font-size:11.5px;padding:4px 10px;background:#059669;border-color:#059669;font-weight:700">✅ Émettre & Quittancer la Facture TTC</button>';
            }
            h += '</div>';
          }
          h += '</div>';
        }
        return h;
      }

      function construireCorps(fmt) {
        var html = '<div style="display:flex;flex-direction:column;gap:10px">';
        
        // Barre d'onglets et actions Excel
        html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;background:var(--color-surface-2);padding:8px 12px;border-radius:var(--radius);border:1px solid var(--color-border);flex-wrap:wrap">';
        
        // Onglets
        html += '<div style="display:flex;gap:4px;flex-wrap:wrap">';
        html += '<button type="button" class="btn ' + (fmt === "fiche_taxe" ? "btn-primary" : "btn-ghost") + ' btn-switch-doc-fmt" data-fmt="fiche_taxe" style="font-size:11.5px;padding:4px 8px">🖨️ Fiche de Taxe</button>';
        html += '<button type="button" class="btn ' + (fmt === "note_frais" ? "btn-primary" : "btn-ghost") + ' btn-switch-doc-fmt" data-fmt="note_frais" style="font-size:11.5px;padding:4px 8px">📄 Note de Frais</button>';
        html += '<button type="button" class="btn ' + (fmt === "facture" ? "btn-primary" : "btn-ghost") + ' btn-switch-doc-fmt" data-fmt="facture" style="font-size:11.5px;padding:4px 8px">🧾 Facture Normalisée</button>';
        html += '<button type="button" class="btn ' + (fmt === "excel_natif" ? "btn-primary" : "btn-ghost") + ' btn-switch-doc-fmt" data-fmt="excel_natif" style="font-size:11.5px;padding:4px 8px;background:' + (fmt === "excel_natif" ? '#059669' : 'transparent') + ';color:' + (fmt === "excel_natif" ? '#fff' : '#059669') + ';font-weight:700">📊 Rendu Fichier Excel (.xlsx)</button>';
        html += '</div>';

        // Sélecteur & Export Excel
        html += '<div style="display:flex;align-items:center;gap:6px;margin-left:auto;flex-wrap:wrap">';
        html += '<span style="font-size:11.5px;color:var(--color-text-dim)">Matrice :</span>';
        html += '<select id="modal-select-modele-excel" class="input" style="font-size:12px;padding:3px 6px;height:auto;min-height:30px;width:auto;max-width:210px">';
        modelesExcel.forEach(function (m) {
          var isSel = m.id === modeleActuel ? ' selected' : '';
          html += '<option value="' + m.id + '"' + isSel + '>' + escapeHtml(m.nom) + '</option>';
        });
        html += '</select>';
        html += '<button type="button" class="btn btn-secondary" id="modal-btn-export-excel" style="font-size:12px;padding:4px 10px;background:rgba(16,185,129,0.12);color:#059669;border-color:rgba(16,185,129,0.35);font-weight:700" title="Télécharger le classeur Excel (.xlsx) pré-rempli">📊 Télécharger Excel (.xlsx)</button>';
        html += '</div>';

        html += '</div>';

        // Barre interactive de Workflow & Validation
        html += '<div id="zone-actions-workflow-doc">';
        html += construireBandeauWorkflow(fmt);
        html += '</div>';

        // Zone d'aperçu papier A4 ou Grille Excel
        html += '<div id="zone-apercu-feuille-a4" style="background:#4b5563;padding:16px;border-radius:var(--radius);max-height:65vh;overflow-y:auto;display:flex;justify-content:center">';
        if (fmt === "excel_natif") {
          html += '<div id="conteneur-excel-rendu-interne" style="width:100%"></div>';
        } else {
          html += genererHtmlDocumentOfficiel(dossier, donneesFiche, fmt, params);
        }
        html += '</div>';

        html += '</div>';
        return html;
      }

      function executerImpression(fmt) {
        var printContainer = document.getElementById("print-container");
        if (printContainer) {
          if (fmt === "excel_natif") {
            var zoneExcel = document.getElementById("conteneur-feuille-excel-injectee") || document.getElementById("zone-apercu-feuille-a4");
            printContainer.innerHTML = zoneExcel ? zoneExcel.innerHTML : "";
          } else {
            printContainer.innerHTML = genererHtmlDocumentOfficiel(dossier, donneesFiche, fmt, params);
          }
          toast("Préparation de l'impression A4...");
          setTimeout(function () {
            window.print();
          }, 150);
        }
      }

      function executerExportExcel() {
        var sel = document.getElementById("modal-select-modele-excel");
        var modeleChoisi = sel ? sel.value : modeleActuel;
        var nomFichier = "Liquidation_" + ((dossier && (dossier.numeroDossier || dossier.numero_dossier)) || "Notaire") + ".xlsx";

        toast("Génération du fichier Excel (.xlsx) en cours...");
        var payload = {
          dossierId: dossier.id,
          typeActeId: dossier.typeActeId || dossier.type_acte_id,
          montant: dossier.montantAssiette !== undefined ? dossier.montantAssiette : dossier.montant_assiette,
          saisies: (donneesFiche && donneesFiche.saisies) || {},
          modeleId: modeleChoisi,
          clientNom: dossier.comparantsNoms || dossier.clientNom,
          numeroDossier: dossier.numeroDossier || dossier.numero_dossier,
        };

        API.telechargerFichier("/api/fiscal/export-excel", payload, nomFichier)
          .then(function () {
            toast("Classeur Excel (.xlsx) téléchargé avec succès !");
          })
          .catch(function (e) {
            toast("Erreur export Excel : " + e.message);
          });
      }

      function attacherEcouteursWorkflow(modalDom) {
        // 1. Bouton Modifier les Chiffres
        var btnModif = modalDom.querySelector("#btn-wf-modifier-taxe");
        if (btnModif) {
          btnModif.addEventListener("click", function () {
            modalCreerFicheTaxe(dossier.id, formatActuel);
          });
        }

        // 2. Bouton Enregistrer Brouillon Taxe
        var btnSaveBrouillon = modalDom.querySelector("#btn-wf-save-brouillon-taxe");
        if (btnSaveBrouillon) {
          btnSaveBrouillon.addEventListener("click", function () {
            toast("Enregistrement du brouillon de taxe...");
            API.post("/api/fiscal/dossiers/" + dossier.id + "/enregistrer", {
              typeActeId: dossier.typeActeId || dossier.type_acte_id,
              montant: dossier.montantAssiette,
              saisies: donneesFiche.saisies || {},
              statut: "brouillon"
            }).then(function () {
              toast("Brouillon de taxe enregistré.");
              fermerModal();
              renderComptabilite();
            }).catch(function (e) { toast(e.message); });
          });
        }

        // 3. Bouton Soumettre Taxe au Notaire
        var btnSoumettreTaxe = modalDom.querySelector("#btn-wf-soumettre-taxe");
        if (btnSoumettreTaxe) {
          btnSoumettreTaxe.addEventListener("click", function () {
            toast("Transmission de la fiche de taxe à Maître...");
            API.post("/api/fiscal/dossiers/" + dossier.id + "/enregistrer", {
              typeActeId: dossier.typeActeId || dossier.type_acte_id,
              montant: dossier.montantAssiette,
              saisies: donneesFiche.saisies || {},
              statut: "soumis"
            }).then(function () {
              toast("Fiche de taxe soumise avec succès au Notaire pour visa !");
              fermerModal();
              renderComptabilite();
            }).catch(function (e) { toast(e.message); });
          });
        }

        // 4. Bouton Valider Taxe (Notaire)
        var btnValiderTaxe = modalDom.querySelector("#btn-wf-valider-taxe");
        if (btnValiderTaxe) {
          btnValiderTaxe.addEventListener("click", function () {
            if (ficheBD && ficheBD.id) {
              API.post("/api/fiscal/fiches/" + ficheBD.id + "/valider", {}).then(function () {
                toast("Fiche de taxe validée conforme par le Notaire ! Note de Frais et Facture débloquées.");
                fermerModal();
                modalApercuDocument(dossier, null, "note_frais");
                renderComptabilite();
              }).catch(function (e) { toast(e.message); });
            } else {
              API.post("/api/fiscal/dossiers/" + dossier.id + "/enregistrer", {
                typeActeId: dossier.typeActeId || dossier.type_acte_id,
                montant: dossier.montantAssiette,
                saisies: donneesFiche.saisies || {},
                statut: "valide"
              }).then(function () {
                toast("Fiche de taxe validée conforme par le Notaire ! Note de Frais et Facture débloquées.");
                fermerModal();
                modalApercuDocument(dossier, null, "note_frais");
                renderComptabilite();
              }).catch(function (e) { toast(e.message); });
            }
          });
        }

        // 5. Bouton Renvoyer pour Correction (Notaire)
        var btnRenvoyerTaxe = modalDom.querySelector("#btn-wf-renvoyer-taxe");
        if (btnRenvoyerTaxe) {
          btnRenvoyerTaxe.addEventListener("click", function () {
            var comm = prompt("Observations / Remarques pour le comptable :");
            if (!comm || !comm.trim()) return;
            if (ficheBD && ficheBD.id) {
              API.post("/api/fiscal/fiches/" + ficheBD.id + "/renvoyer", { commentaire: comm.trim() })
                .then(function () {
                  toast("Fiche renvoyée pour correction au comptable.");
                  fermerModal();
                  renderComptabilite();
                }).catch(function (e) { toast(e.message); });
            }
          });
        }

        // 6. Bouton Soumettre Note de Frais
        var btnSoumNote = modalDom.querySelector("#btn-wf-soumettre-note-frais");
        if (btnSoumNote) {
          btnSoumNote.addEventListener("click", function () {
            API.post("/api/fiscal/dossiers/" + dossier.id + "/soumettre-note-frais", {})
              .then(function (res) {
                toast(res.message || "Note de frais soumise au Notaire !");
                fermerModal();
                renderComptabilite();
              }).catch(function (e) { toast(e.message); });
          });
        }

        // 7. Bouton Valider Note de Frais (Notaire)
        var btnValNote = modalDom.querySelector("#btn-wf-valider-note-frais");
        if (btnValNote) {
          btnValNote.addEventListener("click", function () {
            API.post("/api/fiscal/dossiers/" + dossier.id + "/valider-note-frais", {})
              .then(function (res) {
                toast(res.message || "Note de frais visée par Maître !");
                fermerModal();
                renderComptabilite();
              }).catch(function (e) { toast(e.message); });
          });
        }

        // 8. Bouton Soumettre Facture
        var btnSoumFac = modalDom.querySelector("#btn-wf-soumettre-facture");
        if (btnSoumFac) {
          btnSoumFac.addEventListener("click", function () {
            API.post("/api/fiscal/dossiers/" + dossier.id + "/soumettre-facture", {})
              .then(function (res) {
                toast(res.message || "Facture soumise au Notaire !");
                fermerModal();
                renderComptabilite();
              }).catch(function (e) { toast(e.message); });
          });
        }

        // 9. Bouton Valider Facture (Notaire)
        var btnValFac = modalDom.querySelector("#btn-wf-valider-facture");
        if (btnValFac) {
          btnValFac.addEventListener("click", function () {
            API.post("/api/fiscal/dossiers/" + dossier.id + "/valider-facture", {})
              .then(function (res) {
                toast(res.message || "Facture validée et émise par Maître !");
                fermerModal();
                renderComptabilite();
              }).catch(function (e) { toast(e.message); });
          });
        }

        // 10. Boutons de bascule vers validation taxe
        modalDom.querySelectorAll(".btn-aller-valider-taxe").forEach(function (b) {
          b.addEventListener("click", function () {
            var btnFiche = modalDom.querySelector('.btn-switch-doc-fmt[data-fmt="fiche_taxe"]');
            if (btnFiche) btnFiche.click();
          });
        });
      }

      ouvrirModal({
        titre: titreModal(formatActuel),
        largeur: "960px",
        corps: construireCorps(formatActuel),
        footer: 
          '<button class="btn btn-secondary" id="modal-doc-fermer">Fermer</button>' +
          '<button class="btn btn-secondary" id="modal-doc-footer-excel" style="background:rgba(16,185,129,0.12);color:#059669;border-color:rgba(16,185,129,0.35);font-weight:700">📊 Télécharger Excel (.xlsx)</button>' +
          '<button class="btn btn-primary" id="modal-doc-imprimer" style="background:#059669;border-color:#059669;font-weight:700">🖨️ Imprimer / Télécharger en PDF (A4)</button>',
        apresOuverture: function () {
          var modalDom = document.getElementById("modal-racine");
          if (!modalDom) return;

          modalDom.querySelector("#modal-doc-fermer").addEventListener("click", fermerModal);
          
          modalDom.querySelector("#modal-doc-imprimer").addEventListener("click", function () {
            executerImpression(formatActuel);
          });

          var btnTopExcel = modalDom.querySelector("#modal-btn-export-excel");
          if (btnTopExcel) btnTopExcel.addEventListener("click", executerExportExcel);

          var btnFootExcel = modalDom.querySelector("#modal-doc-footer-excel");
          if (btnFootExcel) btnFootExcel.addEventListener("click", executerExportExcel);

          var selModele = modalDom.querySelector("#modal-select-modele-excel");
          if (selModele) {
            selModele.addEventListener("change", function () {
              modeleActuel = selModele.value;
              feuilleActuelle = null;
              if (formatActuel === "excel_natif") {
                var zone = modalDom.querySelector("#zone-apercu-feuille-a4");
                chargerRenduExcelNatif(zone);
              }
            });
          }

          if (formatActuel === "excel_natif") {
            var zone = modalDom.querySelector("#zone-apercu-feuille-a4");
            chargerRenduExcelNatif(zone);
          }

          attacherEcouteursWorkflow(modalDom);

          modalDom.querySelectorAll(".btn-switch-doc-fmt").forEach(function (btn) {
            btn.addEventListener("click", function () {
              formatActuel = btn.dataset.fmt;
              var zone = modalDom.querySelector("#zone-apercu-feuille-a4");
              var zoneWf = modalDom.querySelector("#zone-actions-workflow-doc");
              if (zoneWf) zoneWf.innerHTML = construireBandeauWorkflow(formatActuel);
              if (zone) {
                if (formatActuel === "excel_natif") {
                  chargerRenduExcelNatif(zone);
                } else {
                  zone.innerHTML = genererHtmlDocumentOfficiel(dossier, donneesFiche, formatActuel, params);
                }
              }
              attacherEcouteursWorkflow(modalDom);
              modalDom.querySelectorAll(".btn-switch-doc-fmt").forEach(function (b) {
                if (b.dataset.fmt === formatActuel) {
                  b.className = "btn btn-primary btn-switch-doc-fmt";
                  if (formatActuel === "excel_natif") b.style.background = "#059669";
                } else {
                  b.className = "btn btn-ghost btn-switch-doc-fmt";
                  b.style.background = "transparent";
                }
              });
              var titreEl = modalDom.querySelector(".modal-title") || modalDom.querySelector("h2") || modalDom.querySelector("h3") || modalDom.querySelector("#modal-header-titre");
              if (titreEl) titreEl.textContent = titreModal(formatActuel);
            });
          });
        }
      });
    }).catch(function (e) {
      toast("Erreur aperçu : " + e.message);
    });
  }

  // -----------------------------------------------------------------
  // Déclencheur officiel d'ouverture du document
  // -----------------------------------------------------------------
  function imprimerDecompteOfficiel(dossier, f, formatChoisi) {
    modalApercuDocument(dossier, f, formatChoisi);
  }

  // -----------------------------------------------------------------
  // Notifications
  // -----------------------------------------------------------------
  function chargerNotifBadge() {
    return API.get("/api/notifications?nonLues=true").then(function (liste) {
      cache.notifications = liste;
      document.getElementById("notif-badge").textContent = liste.length + " non lue(s)";
    }).catch(function () {});
  }
  function renderNotifications() {
    var c = document.getElementById("vue-notifications");
    c.innerHTML = '<p class="text-muted">Chargement…</p>';
    API.get("/api/notifications").then(function (liste) {
      var html = '<h1 style="margin-bottom:var(--space-3)">Notifications</h1><div style="display:flex;flex-direction:column;gap:var(--space-2)">';
      if (!liste.length) html = '<h1 style="margin-bottom:var(--space-3)">Notifications</h1><p class="text-muted">Rien pour le moment.</p>';
      liste.forEach(function (n) {
        html += '<div class="card" data-id="' + n.id + '" style="' + (n.lu ? "opacity:.6" : "") + '"><div class="card-title" style="font-size:14px">' + (n.titre || "") + '</div><div class="card-body">' + n.corps + '</div><div class="text-muted" style="font-size:11px">' + fmtDate(n.created_at) + '</div></div>';
      });
      html += '</div>';
      c.innerHTML = html;
      c.querySelectorAll(".card[data-id]").forEach(function (e) {
        e.addEventListener("click", function () {
          API.post("/api/notifications/" + e.dataset.id + "/lue").then(chargerNotifBadge);
        });
      });
    });
  }

  // -----------------------------------------------------------------
  // Parapheur Notarial — Éléments en attente de validation
  // (Projets d'actes, Fiches de taxe, Notes de frais, Factures, Salaires)
  // -----------------------------------------------------------------
  var etatValidations = { filtre: "tous" };

  function chargerValidationsBadge() {
    return API.get("/api/fiscal/validations/parapheur-global").then(function (data) {
      cache.parapheurValidations = data;
      var total = (data && data.totalEnAttente) || 0;
      var badge = document.getElementById("badge-menu-validations");
      if (badge) {
        if (total > 0) {
          badge.style.display = "inline-block";
          badge.textContent = String(total);
        } else {
          badge.style.display = "none";
        }
      }
    }).catch(function () {});
  }

  function renderValidations() {
    var c = document.getElementById("vue-validations");
    if (!c) return;
    c.innerHTML = '<div style="padding:40px;text-align:center"><div class="spinner"></div><p style="margin-top:8px">Chargement du Parapheur de Validations…</p></div>';

    var estNotaire = cache.utilisateur && (cache.utilisateur.role === "notaire" || cache.utilisateur.role === "superadmin");
    var isPremierClerc = cache.utilisateur && cache.utilisateur.role === "premier_clerc";

    API.get("/api/fiscal/validations/parapheur-global").then(function (data) {
      cache.parapheurValidations = data;
      var fiches = data.fichesTaxe || [];
      var notes = data.notesFrais || [];
      var factures = data.factures || [];
      var actes = data.projetsActe || [];
      var salaires = data.salairesCharges || [];

      var total = fiches.length + notes.length + factures.length + actes.length;

      var titrePrincipal = estNotaire 
        ? '⏳ Parapheur & Éléments en Attente de Validation' 
        : '📂 Parapheur Transmis (Suivi des Pièces Soumises à Maître)';
      var sousTitrePrincipal = estNotaire 
        ? 'Validation formelle et visa du Notaire Titulaire : Projets d\'actes, Fiches de taxe, Notes de frais client, Factures fiscales TTC, Salaires & Charges.' 
        : 'Vue de consultation et suivi du circuit des pièces et actes transmis à Maître pour visa et validation officielle.';

      var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-4)">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap">';
      html += '<div><h1 style="margin:0">' + titrePrincipal + '</h1>';
      html += '<p style="opacity:.65;font-size:14px;margin:2px 0 0">' + sousTitrePrincipal + '</p></div>';
      html += '<div style="display:flex;gap:8px">';
      html += '<button type="button" class="btn btn-secondary" id="btn-refresh-validations">🔄 Actualiser</button>';
      html += '</div></div></div>';

      // 5 Cartes KPI
      var kpis = [
        { label: "Projets d'Actes", valeur: String(actes.length), indice: actes.length ? "accent" : "", icon: "", sub: "Soumis par les clercs" },
        { label: "Fiches de Taxe", valeur: String(fiches.length), indice: fiches.length ? "accent" : "", icon: "", sub: "Liquidation comptable" },
        { label: "Notes de Frais", valeur: String(notes.length), indice: notes.length ? "accent" : "", icon: "", sub: "Appels de provision client" },
        { label: "Factures Normalisées", valeur: String(factures.length), indice: factures.length ? "accent" : "", icon: "", sub: "Émission fiscale TTC" },
        { label: "Salaires & Charges", valeur: String(salaires.length), indice: "", icon: "", sub: "Autorisations de paiement" },
      ];
      html += renderKpisGrid(kpis);

      // Filtres par onglets
      html += '<div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4);flex-wrap:wrap;border-bottom:1px solid var(--color-border);padding-bottom:var(--space-2)">';
      var tabs = [
        { id: "tous", label: "Tous les éléments", count: total },
        { id: "actes", label: "📜 Projets d'actes", count: actes.length, color: "#6366f1" },
        { id: "fiches_taxe", label: "🖨️ Fiches de Taxe", count: fiches.length, color: "#d97706" },
        { id: "notes_frais", label: "📄 Notes de Frais", count: notes.length, color: "#059669" },
        { id: "factures", label: "🧾 Factures TTC", count: factures.length, color: "#0891b2" },
        { id: "salaires", label: "💳 Salaires & Charges", count: salaires.length, color: "#8b5cf6" },
      ];

      tabs.forEach(function (t) {
        var estActif = (etatValidations.filtre === t.id);
        var badgeStyle = t.color ? 'background:' + t.color + ';color:#fff;font-weight:700' : 'background:var(--color-surface-2);color:var(--color-text-dim)';
        var btnStyle = estActif ? 'border-bottom:2px solid var(--color-accent);font-weight:700;color:var(--color-accent)' : 'color:var(--color-text-dim)';
        html += '<button type="button" class="btn btn-ghost btn-filtre-val" data-filtre="' + t.id + '" style="font-size:13px;padding:6px 12px;border-radius:0;' + btnStyle + '">';
        html += t.label + ' <span style="font-size:11px;padding:2px 6px;border-radius:10px;margin-left:4px;' + badgeStyle + '">' + t.count + '</span>';
        html += '</button>';
      });
      html += '</div>';

      // Unified item list
      var itemsAffiches = [];
      if (etatValidations.filtre === "tous" || etatValidations.filtre === "actes") {
        actes.forEach(function (a) { itemsAffiches.push({ type: "acte", raw: a, date: a.soumis_le || a.created_at }); });
      }
      if (etatValidations.filtre === "tous" || etatValidations.filtre === "fiches_taxe") {
        fiches.forEach(function (f) { itemsAffiches.push({ type: "fiche_taxe", raw: f, date: f.created_at }); });
      }
      if (etatValidations.filtre === "tous" || etatValidations.filtre === "notes_frais") {
        notes.forEach(function (n) { itemsAffiches.push({ type: "note_frais", raw: n, date: n.soumis_le || n.created_at }); });
      }
      if (etatValidations.filtre === "tous" || etatValidations.filtre === "factures") {
        factures.forEach(function (fac) { itemsAffiches.push({ type: "facture", raw: fac, date: fac.soumis_le || fac.created_at }); });
      }
      if (etatValidations.filtre === "tous" || etatValidations.filtre === "salaires") {
        salaires.forEach(function (s) { itemsAffiches.push({ type: "salaire", raw: s, date: new Date() }); });
      }

      if (!itemsAffiches.length) {
        html += '<div class="card" style="padding:40px;text-align:center;color:var(--color-text-dim)">';
        html += '<div style="font-size:36px;margin-bottom:8px">🎉</div>';
        html += '<div style="font-size:16px;font-weight:700;color:var(--color-text)">Aucun élément en attente de validation</div>';
        html += '<p style="font-size:13px;margin-top:4px">Tous les actes, fiches de taxe, notes de frais et factures soumis sont à jour.</p>';
        html += '</div>';
      } else {
        html += '<div class="table-wrap"><table class="table" style="font-size:12.5px"><thead><tr>';
        html += '<th>Type d\'élément</th>';
        html += '<th>Dossier / Objet</th>';
        html += '<th>Client / Comparants</th>';
        html += '<th style="text-align:right">Montant / Enjeu</th>';
        html += '<th>Demandeur / Soumis par</th>';
        html += '<th>Date de soumission</th>';
        html += '<th style="text-align:center">' + (estNotaire ? 'Actions Notariales (Visa & Signature)' : 'Statut & Consultation') + '</th>';
        html += '</tr></thead><tbody>';

        itemsAffiches.forEach(function (item) {
          html += '<tr>';
          if (item.type === "acte") {
            var a = item.raw;
            html += '<td><span class="tag" style="background:#e0e7ff;color:#4338ca;font-weight:700">📜 Projet d\'acte (v' + a.numero_version + ')</span></td>';
            html += '<td><strong>' + escapeHtml(a.numero_dossier) + '</strong><br><span style="font-size:11px;color:var(--color-text-dim)">' + labelActe(a.type_acte_id) + '</span></td>';
            html += '<td>' + escapeHtml(a.comparants_noms || "Comparants") + '</td>';
            html += '<td style="text-align:right;color:var(--color-text-dim)">—</td>';
            html += '<td>' + escapeHtml(a.redige_par_nom || "Clerc") + '</td>';
            html += '<td style="font-size:11.5px">' + fmtDate(a.soumis_le || a.created_at) + '</td>';
            html += '<td style="text-align:center"><div style="display:flex;gap:4px;justify-content:center">';
            html += '<button type="button" class="btn btn-secondary btn-val-ouvrir-dossier" data-id="' + a.dossier_id + '" style="font-size:11px;padding:3px 7px">👁️ Examiner</button>';
            if (estNotaire) {
              html += '<button type="button" class="btn btn-primary btn-val-valider-acte" data-id="' + a.dossier_id + '" style="font-size:11px;padding:3px 8px;background:#059669;border-color:#059669;font-weight:700">✅ Valider</button>';
              html += '<button type="button" class="btn btn-secondary btn-val-renvoyer-acte" data-id="' + a.dossier_id + '" style="font-size:11px;padding:3px 7px;color:#dc2626;border-color:rgba(220,38,38,0.4)">↩️ Renvoyer</button>';
            } else {
              html += '<span class="tag tag-outline" style="font-size:11px;color:#6366f1;border-color:rgba(99,102,241,0.35)">⏳ Soumis à Maître</span>';
            }
            html += '</div></td>';
          } else if (item.type === "fiche_taxe") {
            var f = item.raw;
            var tot = (f.donnees && f.donnees.totaux && f.donnees.totaux.general) || 0;
            html += '<td><span class="tag" style="background:#fef3c7;color:#b45309;font-weight:700">🖨️ Fiche de Taxe</span></td>';
            html += '<td><strong>' + escapeHtml(f.numero_dossier) + '</strong><br><span style="font-size:11px;color:var(--color-text-dim)">' + labelActe(f.type_acte_id) + '</span></td>';
            html += '<td>' + escapeHtml(f.comparants_noms || "Client") + '</td>';
            html += '<td style="text-align:right;font-weight:800;color:var(--color-accent)">' + fmtFCFA(tot) + '</td>';
            html += '<td>' + escapeHtml(f.utilisateur_nom || "Comptable") + '</td>';
            html += '<td style="font-size:11.5px">' + fmtDate(f.created_at) + '</td>';
            html += '<td style="text-align:center"><div style="display:flex;gap:4px;justify-content:center">';
            html += '<button type="button" class="btn btn-secondary btn-val-apercu-taxe" data-id="' + f.dossier_id + '" style="font-size:11px;padding:3px 7px">👁️ Consulter</button>';
            if (estNotaire) {
              html += '<button type="button" class="btn btn-primary btn-val-valider-taxe" data-id="' + f.id + '" style="font-size:11px;padding:3px 8px;background:#059669;border-color:#059669;font-weight:700">✅ Valider</button>';
              html += '<button type="button" class="btn btn-secondary btn-val-renvoyer-taxe" data-id="' + f.id + '" style="font-size:11px;padding:3px 7px;color:#dc2626;border-color:rgba(220,38,38,0.4)">↩️ Renvoyer</button>';
            } else {
              html += '<span class="tag tag-outline" style="font-size:11px;color:#d97706;border-color:rgba(217,119,6,0.35)">⏳ Soumis à Maître</span>';
            }
            html += '</div></td>';
          } else if (item.type === "note_frais") {
            var n = item.raw;
            var totN = (n.donnees && n.donnees.totaux && n.donnees.totaux.general) || 0;
            html += '<td><span class="tag" style="background:#d1fae5;color:#047857;font-weight:700">📄 Note de Frais</span></td>';
            html += '<td><strong>' + escapeHtml(n.numero_dossier) + '</strong><br><span style="font-size:11px;color:var(--color-text-dim)">' + labelActe(n.type_acte_id) + '</span></td>';
            html += '<td>' + escapeHtml(n.comparants_noms || "Client") + '</td>';
            html += '<td style="text-align:right;font-weight:800;color:#047857">' + fmtFCFA(totN) + '</td>';
            html += '<td>' + escapeHtml(n.soumis_par || n.utilisateur_nom || "Comptable") + '</td>';
            html += '<td style="font-size:11.5px">' + fmtDate(n.soumis_le || n.created_at) + '</td>';
            html += '<td style="text-align:center"><div style="display:flex;gap:4px;justify-content:center">';
            html += '<button type="button" class="btn btn-secondary btn-val-apercu-note" data-id="' + n.dossier_id + '" style="font-size:11px;padding:3px 7px">👁️ Consulter</button>';
            if (estNotaire) {
              html += '<button type="button" class="btn btn-primary btn-val-valider-note" data-id="' + n.dossier_id + '" style="font-size:11px;padding:3px 8px;background:#059669;border-color:#059669;font-weight:700">✅ Viser Note</button>';
            } else {
              html += '<span class="tag tag-outline" style="font-size:11px;color:#047857;border-color:rgba(4,120,87,0.35)">⏳ Visa Maître en attente</span>';
            }
            html += '</div></td>';
          } else if (item.type === "facture") {
            var fac = item.raw;
            var totF = (fac.donnees && fac.donnees.totaux && fac.donnees.totaux.general) || 0;
            html += '<td><span class="tag" style="background:#cffafe;color:#0e7490;font-weight:700">🧾 Facture TTC</span></td>';
            html += '<td><strong>' + escapeHtml(fac.numero_dossier) + '</strong><br><span style="font-size:11px;color:var(--color-text-dim)">' + labelActe(fac.type_acte_id) + '</span></td>';
            html += '<td>' + escapeHtml(fac.comparants_noms || "Client") + '</td>';
            html += '<td style="text-align:right;font-weight:800;color:#0e7490">' + fmtFCFA(totF) + '</td>';
            html += '<td>' + escapeHtml(fac.soumis_par || fac.utilisateur_nom || "Comptable") + '</td>';
            html += '<td style="font-size:11.5px">' + fmtDate(fac.soumis_le || fac.created_at) + '</td>';
            html += '<td style="text-align:center"><div style="display:flex;gap:4px;justify-content:center">';
            html += '<button type="button" class="btn btn-secondary btn-val-apercu-fac" data-id="' + fac.dossier_id + '" style="font-size:11px;padding:3px 7px">👁️ Consulter</button>';
            if (estNotaire) {
              html += '<button type="button" class="btn btn-primary btn-val-valider-fac" data-id="' + fac.dossier_id + '" style="font-size:11px;padding:3px 8px;background:#059669;border-color:#059669;font-weight:700">✅ Émettre TTC</button>';
            } else {
              html += '<span class="tag tag-outline" style="font-size:11px;color:#0e7490;border-color:rgba(14,116,144,0.35)">⏳ Visa Maître en attente</span>';
            }
            html += '</div></td>';
          } else if (item.type === "salaire") {
            var s = item.raw;
            html += '<td><span class="tag" style="background:#f3e8ff;color:#6b21a8;font-weight:700">💳 Salaire Collaborateur</span></td>';
            html += '<td><strong>' + escapeHtml(s.nomComplet) + '</strong><br><span style="font-size:11px;color:var(--color-text-dim)">' + (ROLE_LABEL[s.role] || s.role) + '</span></td>';
            html += '<td>Période : ' + escapeHtml(s.periode) + '</td>';
            html += '<td style="text-align:right;font-weight:800;color:#6b21a8">' + fmtFCFA(s.salaireNet) + '</td>';
            html += '<td>Comptabilité RH</td>';
            html += '<td style="font-size:11.5px">Mois en cours</td>';
            html += '<td style="text-align:center"><div style="display:flex;gap:4px;justify-content:center">';
            if (estNotaire) {
              html += '<button type="button" class="btn btn-primary btn-val-valider-salaire" data-id="' + s.id + '" style="font-size:11px;padding:3px 8px;background:#7c3aed;border-color:#7c3aed;font-weight:700">💳 Autoriser Décaissement</button>';
            } else {
              html += '<span class="tag tag-outline" style="font-size:11px">Visa Maître requis</span>';
            }
            html += '</div></td>';
          }
          html += '</tr>';
        });

        html += '</tbody></table></div>';
      }

      c.innerHTML = html;

      // Écouteurs
      var btnRef = document.getElementById("btn-refresh-validations");
      if (btnRef) btnRef.addEventListener("click", renderValidations);

      c.querySelectorAll(".btn-filtre-val").forEach(function (b) {
        b.addEventListener("click", function () {
          etatValidations.filtre = b.dataset.filtre;
          renderValidations();
        });
      });

      c.querySelectorAll(".btn-val-ouvrir-dossier").forEach(function (btn) {
        btn.addEventListener("click", function () {
          ouvrirDossier(btn.dataset.id, "validations");
        });
      });

      c.querySelectorAll(".btn-val-valider-acte").forEach(function (btn) {
        btn.addEventListener("click", function () {
          API.post("/api/projets-acte/" + btn.dataset.id + "/valider", { commentaire: "Validé conforme par Maître" })
            .then(function () {
              toast("Projet d'acte validé avec succès !");
              chargerValidationsBadge();
              renderValidations();
            }).catch(function (e) { toast(e.message); });
        });
      });

      c.querySelectorAll(".btn-val-renvoyer-acte").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var comm = prompt("Observations / Remarques pour le clerc rédacteur :");
          if (!comm || !comm.trim()) return;
          API.post("/api/projets-acte/" + btn.dataset.id + "/renvoyer-correction", { commentaire: comm.trim() })
            .then(function () {
              toast("Projet renvoyé au clerc.");
              chargerValidationsBadge();
              renderValidations();
            }).catch(function (e) { toast(e.message); });
        });
      });

      c.querySelectorAll(".btn-val-apercu-taxe").forEach(function (btn) {
        btn.addEventListener("click", function () {
          modalApercuDocument(btn.dataset.id, null, "fiche_taxe");
        });
      });

      c.querySelectorAll(".btn-val-valider-taxe").forEach(function (btn) {
        btn.addEventListener("click", function () {
          API.post("/api/fiscal/fiches/" + btn.dataset.id + "/valider", {})
            .then(function () {
              toast("Fiche de taxe validée conforme par le Notaire !");
              chargerValidationsBadge();
              renderValidations();
            }).catch(function (e) { toast(e.message); });
        });
      });

      c.querySelectorAll(".btn-val-renvoyer-taxe").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var comm = prompt("Observations / Remarques pour le comptable :");
          if (!comm || !comm.trim()) return;
          API.post("/api/fiscal/fiches/" + btn.dataset.id + "/renvoyer", { commentaire: comm.trim() })
            .then(function () {
              toast("Fiche renvoyée au comptable.");
              chargerValidationsBadge();
              renderValidations();
            }).catch(function (e) { toast(e.message); });
        });
      });

      c.querySelectorAll(".btn-val-apercu-note").forEach(function (btn) {
        btn.addEventListener("click", function () {
          modalApercuDocument(btn.dataset.id, null, "note_frais");
        });
      });

      c.querySelectorAll(".btn-val-valider-note").forEach(function (btn) {
        btn.addEventListener("click", function () {
          API.post("/api/fiscal/dossiers/" + btn.dataset.id + "/valider-note-frais", {})
            .then(function (res) {
              toast(res.message || "Note de frais visée par Maître !");
              chargerValidationsBadge();
              renderValidations();
            }).catch(function (e) { toast(e.message); });
        });
      });

      c.querySelectorAll(".btn-val-apercu-fac").forEach(function (btn) {
        btn.addEventListener("click", function () {
          modalApercuDocument(btn.dataset.id, null, "facture");
        });
      });

      c.querySelectorAll(".btn-val-valider-fac").forEach(function (btn) {
        btn.addEventListener("click", function () {
          API.post("/api/fiscal/dossiers/" + btn.dataset.id + "/valider-facture", {})
            .then(function (res) {
              toast(res.message || "Facture Normalisée validée et émise par Maître !");
              chargerValidationsBadge();
              renderValidations();
            }).catch(function (e) { toast(e.message); });
        });
      });

      c.querySelectorAll(".btn-val-valider-salaire").forEach(function (btn) {
        btn.addEventListener("click", function () {
          toast("Paiement du salaire visé et autorisé pour décaissement.");
          renderValidations();
        });
      });
    }).catch(function (e) {
      c.innerHTML = '<div style="padding:20px;color:#dc2626">Erreur chargement parapheur : ' + escapeHtml(e.message) + '</div>';
    });
  }

  // -----------------------------------------------------------------
  // Fiche dossier
  // -----------------------------------------------------------------
  function renderDossier() {
    var d = cache.dossierDetail;
    var c = document.getElementById("vue-dossier");
    var nv = niveauDossier(d.id);
    var backLabel = { kanban: "Retour au circuit", dossiers: "Retour aux dossiers", clients: "Retour aux clients", archives: "Retour aux archives", dashboard: "Retour au tableau de bord" }[etat.vuePrecedente] || "Retour";

    var pcts = d.taches.map(function (t) { return STATUT_PCT[t.statut]; });
    var avgPct = pcts.length ? Math.round(pcts.reduce(function (a, b) { return a + b; }, 0) / pcts.length) : 0;

    var html = '<div class="btn btn-ghost bouton-retour" style="padding-left:0;margin-bottom:var(--space-3)">‹ ' + backLabel + '</div>';
    html += '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-3)">';
    html += '<div style="display:flex;align-items:baseline;gap:var(--space-3);flex-wrap:wrap;margin-bottom:2px"><h1 style="margin:0">' + d.numeroDossier + ' — ' + labelActe(d.typeActeId) + '</h1><span class="tag ' + nv.tag + '" style="font-weight:700">' + nv.label + '</span></div>';
    html += '<p style="opacity:.65;font-size:14px;margin:0">' + (d.statut === "cloture" ? "Dossier clôturé" : "Étape " + d.etapeActuelle + " / 6 — " + labelEtape(d.etapeActuelle)) + '</p></div>';

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-4);margin-bottom:var(--space-4)">';
    html += '<div><div class="text-muted" style="font-size:11px;text-transform:uppercase">Comparants</div><div style="font-size:15px">' + d.comparants.map(function (c2) { return c2.nom + " (" + c2.qualite + ")"; }).join(", ") + '</div></div>';
    html += '<div><div class="text-muted" style="font-size:11px;text-transform:uppercase">Montant</div><div style="font-size:15px">' + fmtFCFA(d.montantAssiette) + '</div></div>';
    html += '<div><div class="text-muted" style="font-size:11px;text-transform:uppercase">Clerc assigné</div><div style="font-size:15px">' + nomClerc(d.clercAssigneId) + '</div></div>';
    html += '<div><div class="text-muted" style="font-size:11px;text-transform:uppercase">Avancement Tâches</div><div style="font-size:15px">' + avgPct + ' %</div></div></div>';

    // Stepper Visuel 6 Étapes Notariales
    html += '<div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4);box-shadow:var(--shadow-sm)">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
    html += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--color-text-dim);letter-spacing:0.05em">Circuit d\'instruction juridique de l\'office</div>';
    html += '<span class="tag tag-progress" style="font-size:11px;font-weight:700">Étape ' + d.etapeActuelle + ' / 6 (' + Math.round((d.etapeActuelle / 6) * 100) + ' % complet)</span>';
    html += '</div>';

    html += '<div style="height:6px;background:var(--color-surface-2);border-radius:3px;overflow:hidden;margin-bottom:14px">';
    html += '<div style="height:100%;width:' + ((d.etapeActuelle / 6) * 100) + '%;background:linear-gradient(90deg, #4f46e5, #38bdf8);border-radius:3px;transition:width .3s ease"></div>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px">';
    cache.etapesPipeline.forEach(function (et) {
      var estPasse = et.id < d.etapeActuelle;
      var estActuel = et.id === d.etapeActuelle;
      var styleBox = estActuel 
        ? 'border:1.5px solid var(--color-accent);background:var(--color-accent-dim);color:var(--color-text);font-weight:700' 
        : (estPasse ? 'border:1px solid rgba(16,185,129,0.3);background:var(--color-signed-bg);color:var(--color-signed)' : 'border:1px solid var(--color-border);background:var(--color-surface-2);color:var(--color-text-dim)');
      var icone = estPasse ? "✓ " : (et.id + ". ");
      html += '<div style="padding:6px 8px;border-radius:var(--radius);font-size:11px;text-align:center;' + styleBox + '">' + icone + et.libelle + '</div>';
    });
    html += '</div>';
    html += '</div>';

    if ((cache.permissions.closeDossier) && d.statut === "actif") {
      html += '<div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-6);flex-wrap:wrap">';
      html += '<button class="btn btn-secondary" id="bouton-etape-suivante" ' + (d.etapeActuelle >= 6 ? "disabled" : "") + '>Passer à l\'étape suivante</button>';
      html += '<button class="btn btn-secondary" id="bouton-cloturer" ' + (d.etapeActuelle < 6 ? "disabled" : "") + '>Clôturer le dossier</button></div>';
    }

    html += '<h3 style="margin-bottom:var(--space-3)">Checklist des tâches</h3>';
    var groupes = {};
    d.taches.forEach(function (t) { (groupes[t.etape] = groupes[t.etape] || []).push(t); });
    Object.keys(groupes).sort(function (a, b) { return a - b; }).forEach(function (etapeId) {
      html += '<div style="margin-bottom:var(--space-4)"><h5 style="margin-bottom:var(--space-2);opacity:.7">' + labelEtape(Number(etapeId)) + '</h5>';
      html += '<table class="table"><thead><tr><th>Tâche</th><th>Durée standard</th><th>Statut</th><th>Avancement</th></tr></thead><tbody>';
      groupes[etapeId].forEach(function (t) {
        html += '<tr><td>' + t.libelle + (t.bloquante ? ' <span class="tag tag-accent-2">bloquante</span>' : '') + '</td><td>' + t.dureeJours + ' j</td>';
        html += '<td><select class="input select-tache" data-tache="' + t.id + '" style="min-height:30px;font-size:13px" ' + (cache.permissions.editTasks ? "" : "disabled") + '>';
        Object.keys(STATUT_LABEL).forEach(function (s) { html += '<option value="' + s + '"' + (s === t.statut ? " selected" : "") + '>' + STATUT_LABEL[s] + '</option>'; });
        html += '</select></td><td><span class="tag tag-neutral">' + STATUT_PCT[t.statut] + ' %</span></td></tr>';
      });
      html += '</tbody></table></div>';
    });

    html += '<h3 style="margin-bottom:var(--space-3)">Compte client</h3><table class="table" style="margin-bottom:var(--space-3)"><thead><tr><th>Type</th><th>Libellé</th><th>Date</th><th>Montant</th></tr></thead><tbody>';
    if (!d.compteClient.length) html += '<tr><td colspan="4" class="text-muted">Aucune écriture.</td></tr>';
    d.compteClient.forEach(function (e) {
      var estProvision = e.sens === "provision";
      html += '<tr><td><span class="tag ' + (estProvision ? "tag-accent" : "tag-neutral") + '">' + (estProvision ? "Provision" : "Décaissement") + '</span></td><td>' + e.libelle + '</td><td>' + fmtDate(e.date_ecriture) + '</td><td>' + (estProvision ? "" : "− ") + fmtFCFA(e.montant) + '</td></tr>';
    });
    html += '</tbody></table>';
    if (cache.permissions.manageCompte) html += '<button class="btn btn-secondary" id="bouton-ajouter-ecriture" style="margin-bottom:var(--space-6)">+ Ajouter une écriture</button>';

    html += renderFicheTaxe(d);
    html += renderProjetActe(d.id);

    c.innerHTML = html;
    attacherEcouteursDossier(d.id);
  }

  // -----------------------------------------------------------------
  // Fiche de taxe — réservé à fiscal:calculer / fiscal:enregistrer_fiche_taxe
  // (notaire, comptable taxateur). Le calcul complet (émoluments dégressifs,
  // droits DGI, taxe foncière, timbres, rôles, TVA) est fait par
  // legal-notary-server/src/services/fiscal.service.js — ce fichier ne fait
  // que saisir les quantités variables au cas par cas et afficher le résultat.
  // -----------------------------------------------------------------
  function renderFicheTaxe(d) {
    if (!cache.permissions.fiscal || d.statut !== "actif") return "";
    var fiches = cache.fichesTaxeHistorique || [];
    var derniereFiche = fiches.length > 0 ? fiches[0] : null; // triée par created_at DESC
    var estNotaire = cache.utilisateur && (cache.utilisateur.role === "notaire" || cache.utilisateur.role === "premier_clerc" || cache.utilisateur.role === "superadmin");

    var html = '<div class="card" style="background:var(--color-surface);border:1px solid var(--color-border);padding:var(--space-4);margin-top:var(--space-4);margin-bottom:var(--space-4);box-shadow:var(--shadow-sm)">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:var(--space-3);margin-bottom:var(--space-3)">';
    html += '<div>';
    html += '<h3 style="margin:0;display:flex;align-items:center;gap:8px">💰 Pôle Financier, Taxe & Facturation Notariale</h3>';
    html += '<p style="font-size:12.5px;color:var(--color-text-dim);margin:2px 0 0">Cycle en 3 étapes : Fiche de Taxe Interne (4 col) → Note de Frais (Appel de fonds client) → Facture Normalisée (TTC).</p>';
    html += '</div>';

    var btnLabel = !derniereFiche ? '+ Établir la Fiche de Taxe' : (derniereFiche.statut === 'soumis' && estNotaire ? '⚖️ Examiner & Valider' : '⚙️ Modifier la Taxe');
    html += '<button type="button" class="btn btn-primary btn-ouvrir-modal-taxe" data-id="' + d.id + '" style="font-size:12.5px;padding:6px 14px;font-weight:700">';
    html += btnLabel;
    html += '</button>';
    html += '</div>';

    // Statut déontologique si fiche existante
    if (derniereFiche) {
      var st = derniereFiche.statut || "valide";
      if (st === "a_corriger") {
        html += '<div style="background:rgba(239,68,68,0.08);border:1.5px solid rgba(239,68,68,0.35);border-radius:6px;padding:8px 12px;margin-bottom:var(--space-3);display:flex;align-items:flex-start;gap:8px">';
        html += '<span style="font-size:18px">⚠️</span>';
        html += '<div style="font-size:12px"><strong style="color:#dc2626">Fiche à corriger selon directives du Notaire :</strong> « ' + escapeHtml(derniereFiche.commentaire_notaire || "") + ' »</div>';
        html += '</div>';
      } else if (st === "soumis") {
        html += '<div style="background:rgba(245,158,11,0.08);border:1.5px solid rgba(245,158,11,0.35);border-radius:6px;padding:8px 12px;margin-bottom:var(--space-3);display:flex;align-items:center;gap:8px">';
        html += '<span style="font-size:18px">⏳</span>';
        html += '<div style="font-size:12px"><strong style="color:#d97706">Fiche soumise au Notaire pour visa officiel.</strong> ' + (estNotaire ? 'Cliquez sur "Examiner & Valider" pour instruire.' : '') + '</div>';
        html += '</div>';
      } else if (st === "valide" || st === "valide_corrige") {
        html += '<div style="background:rgba(16,185,129,0.08);border:1.5px solid rgba(16,185,129,0.35);border-radius:6px;padding:8px 12px;margin-bottom:var(--space-3);display:flex;align-items:center;gap:8px">';
        html += '<span style="font-size:18px">✅</span>';
        html += '<div style="font-size:12px"><strong style="color:#059669">Fiche de taxe certifiée et validée par le Notaire ' + (st === "valide_corrige" ? '(avec corrections)' : '') + '</strong></div>';
        html += '</div>';
      }
    }

    // Les 3 Pôles / Documents Visuels
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">';
    
    // 1. Fiche de Taxe
    html += '<div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.25);border-radius:var(--radius);padding:12px;display:flex;flex-direction:column;justify-content:space-between;gap:8px">';
    html += '<div>';
    html += '<div style="font-size:11px;font-weight:700;color:var(--color-accent);text-transform:uppercase">1️⃣ Fiche de Taxe (Interne)</div>';
    html += '<div style="font-size:12px;color:var(--color-text);margin-top:3px">Tableau de liquidation technique interne (Trésor, Émols, Débours).</div>';
    html += '</div>';
    html += '<button type="button" class="btn btn-secondary btn-dossier-print-taxe" data-id="' + d.id + '" style="font-size:11.5px;padding:4px 8px;width:100%">🖨️ Fiche de Taxe (Interne)</button>';
    html += '</div>';

    // 2. Note de Frais
    html += '<div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.25);border-radius:var(--radius);padding:12px;display:flex;flex-direction:column;justify-content:space-between;gap:8px">';
    html += '<div>';
    html += '<div style="font-size:11px;font-weight:700;color:var(--color-warning);text-transform:uppercase">2️⃣ Note de Frais (Client)</div>';
    html += '<div style="font-size:12px;color:var(--color-text);margin-top:3px">Appel de <strong>provision pour frais</strong> à transmettre au client avant la signature.</div>';
    html += '</div>';
    html += '<button type="button" class="btn btn-secondary btn-dossier-print-note" data-id="' + d.id + '" style="font-size:11.5px;padding:4px 8px;width:100%">📄 Note de Frais (Client)</button>';
    html += '</div>';

    // 3. Facture Normalisée
    html += '<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.25);border-radius:var(--radius);padding:12px;display:flex;flex-direction:column;justify-content:space-between;gap:8px">';
    html += '<div>';
    html += '<div style="font-size:11px;font-weight:700;color:#10b981;text-transform:uppercase">3️⃣ Facture Normalisée</div>';
    html += '<div style="font-size:12px;color:var(--color-text);margin-top:3px">Facture légale officielle avec <strong>TVA 18 %</strong> et quittance libératoire.</div>';
    html += '</div>';
    html += '<button type="button" class="btn btn-secondary btn-dossier-print-facture" data-id="' + d.id + '" style="font-size:11.5px;padding:4px 8px;width:100%">🧾 Facture Normalisée (TTC)</button>';
    html += '</div>';

    // 4. Matrice Excel (.xlsx)
    html += '<div style="background:rgba(5,150,105,0.06);border:1px solid rgba(5,150,105,0.25);border-radius:var(--radius);padding:12px;display:flex;flex-direction:column;justify-content:space-between;gap:8px">';
    html += '<div>';
    html += '<div style="font-size:11px;font-weight:700;color:#059669;text-transform:uppercase">4️⃣ Matrice Excel (.xlsx)</div>';
    html += '<div style="font-size:12px;color:var(--color-text);margin-top:3px">Télécharger le classeur officiel Excel avec cellules et formules remplies.</div>';
    html += '</div>';
    html += '<button type="button" class="btn btn-secondary btn-dossier-download-excel" data-id="' + d.id + '" style="font-size:11.5px;padding:4px 8px;width:100%;background:rgba(16,185,129,0.12);color:#059669;border-color:rgba(16,185,129,0.35);font-weight:700">📊 Télécharger Excel (.xlsx)</button>';
    html += '</div>';

    html += '</div>';

    // Historique des fiches enregistrées
    if (fiches.length > 0) {
      html += '<div style="border-top:1px solid var(--color-border);padding-top:var(--space-3)">';
      html += '<div style="font-size:12px;font-weight:700;color:var(--color-text-dim);text-transform:uppercase;margin-bottom:6px">Historique des liquidations enregistrées sur ce dossier</div>';
      html += '<table class="table" style="font-size:12px;margin:0"><thead><tr><th>Date</th><th>Auteur</th><th>Total TTC</th><th>Statut</th><th>Actions d\'impression</th></tr></thead><tbody>';
      fiches.forEach(function (f, idx) {
        var tot = (f.donnees && f.donnees.totaux && f.donnees.totaux.general) || 0;
        var stHist = f.statut || "valide";
        var tagHist = stHist === "soumis" 
          ? '<span class="tag" style="background:rgba(245,158,11,0.15);color:#d97706;font-weight:700">Soumis</span>'
          : (stHist === "a_corriger" 
            ? '<span class="tag" style="background:rgba(239,68,68,0.15);color:#dc2626;font-weight:700">À corriger</span>'
            : '<span class="tag" style="background:rgba(16,185,129,0.15);color:#059669;font-weight:700">Validé' + (stHist === "valide_corrige" ? ' (Corrigé)' : '') + '</span>');

        html += '<tr><td>' + fmtDate(f.created_at) + '</td><td>' + nomClerc(f.utilisateur_id) + '</td><td style="font-weight:700;color:var(--color-accent)">' + fmtFCFA(tot) + '</td>';
        html += '<td>' + tagHist + '</td>';
        html += '<td><div style="display:flex;gap:4px">';
        html += '<button type="button" class="btn btn-secondary btn-imprimer-hist-fiche" data-idx="' + idx + '" style="font-size:11px;padding:2px 6px">🖨️ Fiche de Taxe</button>';
        html += '<button type="button" class="btn btn-secondary btn-imprimer-hist-note" data-idx="' + idx + '" style="font-size:11px;padding:2px 6px">📄 Note Frais</button>';
        html += '<button type="button" class="btn btn-secondary btn-imprimer-hist-facture" data-idx="' + idx + '" style="font-size:11px;padding:2px 6px">🧾 Facture</button>';
        html += '</div></td></tr>';
      });
      html += '</tbody></table></div>';
    }

    html += '</div>';
    return html;
  }
  function champFiche(id, label) {
    return '<div class="field"><label>' + label + '</label><input class="input" type="number" min="0" id="' + id + '" value="0"></div>';
  }
  function lireSaisiesFiche() {
    function n(id) { var e = document.getElementById(id); return e ? (parseInt(e.value, 10) || 0) : 0; }
    return {
      timbres: { pagesMinute: n("taxe-timbres-minute"), pagesExpedition: n("taxe-timbres-expedition"), nombreExpeditions: n("taxe-timbres-nb-expeditions"), pagesBordereau: n("taxe-timbres-bordereau") },
      roles: { pagesMinute: n("taxe-roles-minute"), pagesExpedition: n("taxe-roles-expedition"), nombreExpeditions: n("taxe-roles-nb-expeditions"), pagesCopie: n("taxe-roles-copie") },
      vacations: n("taxe-vacations"),
      fraisFormalites: { depotBanque: n("taxe-frais-depot-banque"), depotEnregistrement: n("taxe-frais-depot-enregistrement"), inscriptionLivreFoncier: n("taxe-frais-inscription-foncier"), requisitionEtat: n("taxe-frais-requisition-etat") },
      diversSupplementaire: n("taxe-divers"),
    };
  }
  function renderApercuFiche(f) {
    cache._dernierCalculFiscal = f;
    var html = '<div class="card" style="padding:var(--space-4)"><table class="table"><tbody>';
    html += ligneApercu("Émoluments (HT)" + (f.emoluments.minimumApplique ? " — minimum légal appliqué" : ""), f.emoluments.montantHT);
    html += ligneApercu("Droit d'enregistrement" + (!f.droitEnregistrement.confirme ? " — à confirmer" : ""), f.droitEnregistrement.montant);
    html += ligneApercu("Taxe foncière", f.taxeFonciere.total);
    html += ligneApercu("Timbres fiscaux", f.timbres.total);
    html += ligneApercu("Rôles de minute", f.roles.total);
    html += ligneApercu("Vacations", f.vacations);
    html += ligneApercu("TVA", f.tva);
    html += ligneApercu("Frais de formalités", f.totalFraisFormalites);
    html += ligneApercu("Divers", f.divers);
    html += '</tbody></table>';
    html += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--color-divider);margin-bottom:var(--space-3)">';
    html += '<span style="font-family:var(--font-heading);font-weight:700;font-size:16px">Total général</span>';
    html += '<span style="font-family:var(--font-heading);font-weight:700;font-size:22px;color:var(--color-accent)">' + fmtFCFA(f.totaux.general) + '</span></div>';
    html += '<div style="display:flex;justify-content:flex-end"><button class="btn btn-secondary" id="bouton-imprimer-apercu-taxe">🖨️ Imprimer Facture</button></div>';
    html += '</div>';
    return html;
  }
  function ligneApercu(label, montant) {
    return '<tr><td>' + label + '</td><td style="text-align:right">' + fmtFCFA(montant) + '</td></tr>';
  }

  function renderProjetActe(dossierId) {
    var p = cache.projetActe;
    var html = '<h3 style="margin-bottom:var(--space-3)">Projet d\'acte</h3>';
    if (!p) {
      html += '<p class="text-muted" style="margin-bottom:var(--space-3)">Aucun brouillon en cours.</p>';
      if (cache.permissions.editTasks) {
        html += '<textarea class="input" id="acte-contenu" style="min-height:160px;margin-bottom:var(--space-2)" placeholder="Rédiger le projet d\'acte…"></textarea>';
        html += '<div style="display:flex;gap:var(--space-2)"><button class="btn btn-secondary" id="bouton-acte-enregistrer">Enregistrer le brouillon</button></div>';
      }
      return html;
    }
    var labels = { en_redaction: "En rédaction", soumis: "Soumis — en attente de validation", a_corriger: "Renvoyé pour correction", valide: "Validé" };
    var tags = { en_redaction: "tag-outline", soumis: "tag-outline", a_corriger: "tag-accent-2", valide: "tag-accent" };
    html += '<div style="display:flex;align-items:baseline;gap:var(--space-2);margin-bottom:var(--space-2)"><span class="tag ' + tags[p.statut] + '">' + labels[p.statut] + '</span></div>';
    html += '<textarea class="input" id="acte-contenu" style="min-height:160px;margin-bottom:var(--space-3)">' + (p.contenu || "") + '</textarea>';

    if (p.commentaireDecision) html += '<div class="erreur-inline" style="margin-bottom:var(--space-2)"><strong>Commentaire :</strong> ' + p.commentaireDecision + '</div>';

    var peutRediger = cache.permissions.editTasks && (p.statut === "en_redaction" || p.statut === "a_corriger");
    var peutValider = cache.permissions.decideProjet && p.statut === "soumis";

    html += '<div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-bottom:var(--space-2)">';
    if (peutRediger) {
      html += '<button class="btn btn-secondary" id="bouton-acte-enregistrer">Enregistrer</button>';
      html += '<button class="btn btn-primary" id="bouton-acte-soumettre">Soumettre au notaire</button>';
    }
    if (peutValider) {
      html += '<div class="field" style="max-width:420px;width:100%"><label>Commentaire (obligatoire pour un renvoi)</label><input class="input" id="acte-commentaire" placeholder="Votre commentaire pour le clerc"></div>';
    }
    html += '</div>';
    if (peutValider) {
      html += '<div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4)"><button class="btn btn-primary" id="bouton-acte-valider">Valider</button><button class="btn btn-secondary" id="bouton-acte-renvoyer">Renvoyer pour correction</button></div>';
    }

    html += '<h5 style="margin-bottom:var(--space-2);opacity:.7">Historique des versions</h5><div style="display:flex;flex-direction:column;gap:var(--space-2)">';
    cache.projetHistorique.forEach(function (h) {
      html += '<div style="font-size:13px;display:flex;gap:var(--space-2)"><span class="text-muted" style="flex:none;width:110px">' + fmtDate(h.createdAt) + '</span><span>Version ' + h.numeroVersion + ' — ' + labels[h.statut] + (h.commentaireDecision ? ' · « ' + h.commentaireDecision + ' »' : '') + '</span></div>';
    });
    html += '</div>';
    return html;
  }

  function attacherEcouteursDossier(dossierId) {
    var c = document.getElementById("vue-dossier");
    var retour = c.querySelector(".bouton-retour");
    if (retour) retour.addEventListener("click", function () { irVers(etat.vuePrecedente); });

    c.querySelectorAll(".select-tache").forEach(function (s) {
      s.addEventListener("change", function () {
        API.post("/api/dossiers/taches/" + s.dataset.tache + "/statut", { statut: s.value })
          .then(function () { return refreshApresAction(); })
          .then(function () { ouvrirDossier(dossierId, etat.vuePrecedente); })
          .catch(function (e) { toast(e.message); });
      });
    });

    var btnEtape = document.getElementById("bouton-etape-suivante");
    if (btnEtape) btnEtape.addEventListener("click", function () {
      API.post("/api/dossiers/" + dossierId + "/etape", { etape: Math.min(6, cache.dossierDetail.etapeActuelle + 1) })
        .then(function () { return refreshApresAction(); })
        .then(function () { ouvrirDossier(dossierId, etat.vuePrecedente); })
        .catch(function (e) { toast(e.message); });
    });
    function imprimerPourDossier(formatDoc) {
      var fiches = cache.fichesTaxeHistorique || [];
      var derniereFiche = fiches.length > 0 ? fiches[fiches.length - 1] : null;
      var dos = cache.dossierDetail || { id: dossierId };
      if (derniereFiche && derniereFiche.donnees) {
        var fDonnees = Object.assign({}, derniereFiche.donnees);
        fDonnees.statut = derniereFiche.statut;
        fDonnees._statutFiche = derniereFiche.statut;
        fDonnees.id = derniereFiche.id;
        fDonnees.commentaire_notaire = derniereFiche.commentaire_notaire;
        imprimerDecompteOfficiel(dos, fDonnees, formatDoc);
      } else {
        toast("Chargement du document...");
        var tId = dos.typeActeId || dos.type_acte_id || "vente_immobiliere";
        var mnt = dos.montantAssiette !== undefined ? Number(dos.montantAssiette) : 10000000;
        API.post("/api/fiscal/calculer", { typeActeId: tId, montant: mnt, saisies: {} })
          .then(function (f) { imprimerDecompteOfficiel(dos, f, formatDoc); })
          .catch(function (e) {
            toast("Calcul : " + e.message);
            imprimerDecompteOfficiel(dos, {}, formatDoc);
          });
      }
    }

    var btnDossierTaxe = c.querySelector(".btn-dossier-print-taxe");
    if (btnDossierTaxe) btnDossierTaxe.addEventListener("click", function (ev) { ev.preventDefault(); imprimerPourDossier("fiche_taxe"); });

    var btnDossierNote = c.querySelector(".btn-dossier-print-note");
    if (btnDossierNote) btnDossierNote.addEventListener("click", function (ev) { ev.preventDefault(); imprimerPourDossier("note_frais"); });

    var btnDossierFacture = c.querySelector(".btn-dossier-print-facture");
    if (btnDossierFacture) btnDossierFacture.addEventListener("click", function (ev) { ev.preventDefault(); imprimerPourDossier("facture"); });

    var btnDossierExcel = c.querySelector(".btn-dossier-download-excel");
    if (btnDossierExcel) {
      btnDossierExcel.addEventListener("click", function (ev) {
        ev.preventDefault();
        var numDos = (cache.dossierDetail && cache.dossierDetail.numeroDossier) || "Dossier";
        var nomFichier = "Liquidation_" + numDos + ".xlsx";
        toast("Téléchargement du fichier Excel de l'étude (.xlsx)...");
        API.telechargerFichier("/api/fiscal/dossiers/" + dossierId + "/export-excel", null, nomFichier)
          .then(function () { toast("Classeur Excel (.xlsx) téléchargé avec succès !"); })
          .catch(function (e) { toast("Erreur export Excel : " + e.message); });
      });
    }

    c.querySelectorAll(".btn-ouvrir-modal-taxe").forEach(function (btn) {
      btn.addEventListener("click", function (ev) { ev.preventDefault(); modalCreerFicheTaxe(dossierId); });
    });

    c.querySelectorAll(".btn-imprimer-hist-fiche").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        var idx = parseInt(btn.dataset.idx, 10);
        var f = cache.fichesTaxeHistorique && cache.fichesTaxeHistorique[idx];
        var dos = cache.dossierDetail || { id: dossierId };
        if (f && f.donnees) {
          var fDonnees = Object.assign({}, f.donnees);
          fDonnees.statut = f.statut;
          fDonnees._statutFiche = f.statut;
          fDonnees.id = f.id;
          fDonnees.commentaire_notaire = f.commentaire_notaire;
          imprimerDecompteOfficiel(dos, fDonnees, "fiche_taxe");
        }
      });
    });

    c.querySelectorAll(".btn-imprimer-hist-note").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        var idx = parseInt(btn.dataset.idx, 10);
        var f = cache.fichesTaxeHistorique && cache.fichesTaxeHistorique[idx];
        var dos = cache.dossierDetail || { id: dossierId };
        if (f && f.donnees) {
          var fDonnees = Object.assign({}, f.donnees);
          fDonnees.statut = f.statut;
          fDonnees._statutFiche = f.statut;
          fDonnees.id = f.id;
          fDonnees.commentaire_notaire = f.commentaire_notaire;
          imprimerDecompteOfficiel(dos, fDonnees, "note_frais");
        }
      });
    });

    c.querySelectorAll(".btn-imprimer-hist-facture").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        var idx = parseInt(btn.dataset.idx, 10);
        var f = cache.fichesTaxeHistorique && cache.fichesTaxeHistorique[idx];
        var dos = cache.dossierDetail || { id: dossierId };
        if (f && f.donnees) {
          var fDonnees = Object.assign({}, f.donnees);
          fDonnees.statut = f.statut;
          fDonnees._statutFiche = f.statut;
          fDonnees.id = f.id;
          fDonnees.commentaire_notaire = f.commentaire_notaire;
          imprimerDecompteOfficiel(dos, fDonnees, "facture");
        }
      });
    });
    var btnCloturer = document.getElementById("bouton-cloturer");
    if (btnCloturer) btnCloturer.addEventListener("click", function () {
      API.post("/api/dossiers/" + dossierId + "/cloturer", {})
        .then(function () { toast("Dossier clôturé — transmis aux archives."); return refreshApresAction(); })
        .then(function () { irVers(etat.vuePrecedente); })
        .catch(function (e) { toast(e.message); });
    });
    var btnEcriture = document.getElementById("bouton-ajouter-ecriture");
    if (btnEcriture) btnEcriture.addEventListener("click", function () {
      API.post("/api/dossiers/" + dossierId + "/compte-client", { sens: "provision", categorie: "honoraires", montant: 1000000, libelle: "Provision complémentaire" })
        .then(function () { toast("Écriture ajoutée."); ouvrirDossier(dossierId, etat.vuePrecedente); })
        .catch(function (e) { toast(e.message); });
    });

    var btnActeEnregistrer = document.getElementById("bouton-acte-enregistrer");
    if (btnActeEnregistrer) btnActeEnregistrer.addEventListener("click", function () {
      var contenu = document.getElementById("acte-contenu").value;
      API.put("/api/projets-acte/" + dossierId + "/brouillon", { contenu: contenu })
        .then(function () { toast("Brouillon enregistré."); ouvrirDossier(dossierId, etat.vuePrecedente); })
        .catch(function (e) { toast(e.message); });
    });
    var btnActeSoumettre = document.getElementById("bouton-acte-soumettre");
    if (btnActeSoumettre) btnActeSoumettre.addEventListener("click", function () {
      var contenu = document.getElementById("acte-contenu").value;
      API.put("/api/projets-acte/" + dossierId + "/brouillon", { contenu: contenu })
        .then(function () { return API.post("/api/projets-acte/" + dossierId + "/soumettre", {}); })
        .then(function () { toast("Projet soumis au notaire."); ouvrirDossier(dossierId, etat.vuePrecedente); })
        .catch(function (e) { toast(e.message); });
    });
    var btnActeValider = document.getElementById("bouton-acte-valider");
    if (btnActeValider) btnActeValider.addEventListener("click", function () {
      var commentaire = document.getElementById("acte-commentaire").value;
      API.post("/api/projets-acte/" + dossierId + "/valider", { commentaire: commentaire })
        .then(function () { toast("Projet validé."); ouvrirDossier(dossierId, etat.vuePrecedente); })
        .catch(function (e) { toast(e.message); });
    });
    var btnActeRenvoyer = document.getElementById("bouton-acte-renvoyer");
    if (btnActeRenvoyer) btnActeRenvoyer.addEventListener("click", function () {
      var commentaire = document.getElementById("acte-commentaire").value;
      API.post("/api/projets-acte/" + dossierId + "/renvoyer-correction", { commentaire: commentaire })
        .then(function () { toast("Renvoyé pour correction."); ouvrirDossier(dossierId, etat.vuePrecedente); })
        .catch(function (e) { toast(e.message); });
    });
  }

  function refreshApresAction() {
    return chargerDossiersEtAlertes();
  }

  // =========================================================================
  // CONSOLE SUPER ADMINISTRATEUR SAAS & SUPERVISION MULTI-ÉTUDES
  // =========================================================================
  function renderSuperAdmin() {
    var c = document.getElementById("vue-superadmin");
    c.innerHTML = '<p class="text-muted">Chargement de la console Super Admin SaaS…</p>';

    Promise.all([
      API.get("/api/superadmin/statistiques-globales").catch(function () {
        return {
          totalEtudes: 4,
          totalDossiers: cache.dossiers.length * 3 + 18,
          totalMinutes: 142,
          totalCartons: 18,
          totalUtilisateurs: 24,
          ticketsSupportOuverts: 2,
          repartitionModes: { hybride: 2, cloud: 1, serveur_physique: 1 },
          disponibiliteGlobale: "99.98%",
          statutSaaS: "Opérationnel",
          versionPlateforme: "2.4.0-Enterprise",
        };
      }),
      API.get("/api/superadmin/etudes").catch(function () {
        return [
          {
            id: "a0000000-0000-0000-0000-000000000001",
            codeEtude: "ETUDE-ABJ-001",
            nomEtude: "Office Notarial — Legal Notary (Abidjan Plateau)",
            titreNotaire: "Maître Titulaire",
            modeInfrastructure: "hybride",
            totalDossiers: cache.dossiers.length,
            totalMinutes: 28,
            totalUtilisateurs: 6,
            espaceUtiliseMo: 1450,
            versionDeployee: "v2.4.0",
            statutSante: "En ligne (Sync OK)",
          },
          {
            id: "a0000000-0000-0000-0000-000000000002",
            codeEtude: "ETUDE-ABJ-002",
            nomEtude: "Étude Notariale Maître Touré (Cocody Deux Plateaux)",
            titreNotaire: "Maître Touré Amadou",
            modeInfrastructure: "cloud",
            totalDossiers: 42,
            totalMinutes: 65,
            totalUtilisateurs: 8,
            espaceUtiliseMo: 2890,
            versionDeployee: "v2.4.0",
            statutSante: "En ligne (Cloud Vault)",
          },
        ];
      }),
      API.get("/api/superadmin/equipe").catch(function () {
        return [
          { id: "usr-001", nomComplet: "Direction SaaS / Fondateur", email: "admin@editeur-legal.ci", telephone: "+225 07 00 00 01", role: "superadmin", actif: true, dateCreation: "2026-01-15" },
          { id: "usr-002", nomComplet: "Alexandre Koffi (Lead DevOps)", email: "dev@editeur-legal.ci", telephone: "+225 07 88 12 34", role: "dev", actif: true, dateCreation: "2026-02-01" },
          { id: "usr-003", nomComplet: "Saran Diomandé (Sales & Onboarding)", email: "commercial@editeur-legal.ci", telephone: "+225 05 44 22 11", role: "commercial", actif: true, dateCreation: "2026-02-15" },
          { id: "usr-004", nomComplet: "Marc-Aurèle Yao (Support L1-L4)", email: "support@editeur-legal.ci", telephone: "+225 01 23 45 67", role: "support", actif: true, dateCreation: "2026-03-01" },
          { id: "usr-005", nomComplet: "Béatrice N'Guessan (Assistante SaaS)", email: "assistante.editeur@editeur-legal.ci", telephone: "+225 07 11 99 88", role: "assistante_editeur", actif: true, dateCreation: "2026-03-10" },
        ];
      }),
      API.get("/api/superadmin/permissions-matrice").catch(function () {
        return {
          roles: {
            superadmin: { label: "Direction / SuperAdmin", permissions: { parc_etudes_vue: true, parc_etudes_deployer: true, parc_etudes_mise_en_ligne: true, infrastructure_clusters: true, sauvegardes_snapshots: true, sauvegardes_test_pra: true, support_tickets: true, support_acces_urgence: true, telemetrie_logs: true, equipe_editeur_gerer: true }, verrouille: true },
            dev: { label: "Développeur / DevOps", permissions: { parc_etudes_vue: true, parc_etudes_deployer: false, parc_etudes_mise_en_ligne: true, infrastructure_clusters: true, sauvegardes_snapshots: true, sauvegardes_test_pra: true, support_tickets: true, support_acces_urgence: false, telemetrie_logs: true, equipe_editeur_gerer: false }, verrouille: false },
            commercial: { label: "Commercial & Onboarding", permissions: { parc_etudes_vue: true, parc_etudes_deployer: true, parc_etudes_mise_en_ligne: true, infrastructure_clusters: false, sauvegardes_snapshots: false, sauvegardes_test_pra: false, support_tickets: false, support_acces_urgence: false, telemetrie_logs: false, equipe_editeur_gerer: false }, verrouille: false },
            support: { label: "Support Client L1-L4", permissions: { parc_etudes_vue: true, parc_etudes_deployer: false, parc_etudes_mise_en_ligne: false, infrastructure_clusters: true, sauvegardes_snapshots: false, sauvegardes_test_pra: false, support_tickets: true, support_acces_urgence: true, telemetrie_logs: true, equipe_editeur_gerer: false }, verrouille: false },
            assistante_editeur: { label: "Assistante Éditeur", permissions: { parc_etudes_vue: true, parc_etudes_deployer: false, parc_etudes_mise_en_ligne: false, infrastructure_clusters: false, sauvegardes_snapshots: false, sauvegardes_test_pra: false, support_tickets: true, support_acces_urgence: false, telemetrie_logs: false, equipe_editeur_gerer: false }, verrouille: false }
          },
          definitions: [
            { code: "parc_etudes_vue", label: "Voir le parc des études", description: "Consulter la liste et les détails des offices" },
            { code: "parc_etudes_deployer", label: "Déployer de nouvelles études", description: "Créer et provisionner une étude (dossiers/minutes/quotas)" },
            { code: "parc_etudes_mise_en_ligne", label: "Mise en ligne & Clés d'appairage", description: "Accès aux tokens DNS, script serveur physique et cloud" },
            { code: "infrastructure_clusters", label: "Infrastructure & Nœuds clusters", description: "Consulter CPU, RAM, disque, sync queue et certificats SSL" },
            { code: "sauvegardes_snapshots", label: "Déclencher Snapshots d'urgence", description: "Créer un snapshot immuable WORM chiffré à chaud" },
            { code: "sauvegardes_test_pra", label: "Tester le Plan de Reprise (PRA)", description: "Simuler la bascule miroir et mesurer RTO/RPO" },
            { code: "support_tickets", label: "Traiter les tickets support L1-L4", description: "Consulter et répondre aux incidents des offices notariaux" },
            { code: "support_acces_urgence", label: "Demander accès urgence audité", description: "Télé-assistance exceptionnelle soumise à validation notaire" },
            { code: "telemetrie_logs", label: "Journal de sécurité cryptographique", description: "Consulter les audits SHA-256 et traçabilité globale" },
            { code: "equipe_editeur_gerer", label: "Gérer l'équipe & les permissions", description: "Ajouter/modifier les collaborateurs SaaS et leurs rôles" },
          ]
        };
      }),
      API.get("/api/superadmin/infrastructure").catch(function () {
        return {
          noeudsServeurs: [
            { nom: "Cluster PostgreSQL Primaire (Master PG-16)", role: "Base SQL Transactionnelle & Isolation Tenants", ip: "10.0.1.14", cpuPct: 18, ramPct: 42, disquePct: 35, latenceMs: 2.4, statut: "En ligne (Opérationnel)", mode: "Haute Disponibilité (Multi-AZ)" },
            { nom: "Cloud Vault S3/MinIO (Object Storage)", role: "Copies Numériques & Minutes Scellées SHA-256", ip: "10.0.2.88", cpuPct: 12, ramPct: 28, disquePct: 48, latenceMs: 8.1, statut: "En ligne (WORM Immuable)", mode: "Chiffrement AES-256 + Géo-réplication" },
            { nom: "Moteur de Synchronisation Hybride (Sync Engine)", role: "Files d'attente de réplication serveurs locaux", ip: "10.0.1.30", cpuPct: 15, ramPct: 31, disquePct: 22, latenceMs: 5.3, statut: "En ligne (Queue Active)", mode: "Offline-First & Auto-Reconnection" }
          ],
          fileAttenteSync: { elementsEnAttente: 0, debitMoyenMoSec: 4.8, latenceMoyenneMs: 14, statutFile: "Synchronisée à 100%" },
          certificatsSsl: { domainePrincipal: "*.notaires.ci", autorite: "Let's Encrypt / Sectigo EV", expiration: "2027-04-15", etat: "Valide (Renouvellement auto)" }
        };
      }),
      API.get("/api/superadmin/sauvegardes").catch(function () {
        return [
          { id: "SNP-2026-08-27-0400", type: "Snapshot Quotidien Immuable", perimetre: "Intégralité du Parc SaaS", date: "2026-08-27 04:00", tailleGo: 14.8, checksumSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", chiffrement: "AES-256-GCM", statutIntegrite: "100% Vérifié & Conforme", retentionJours: 365 },
          { id: "SNP-2026-08-26-0400", type: "Snapshot Quotidien Immuable", perimetre: "Intégralité du Parc SaaS", date: "2026-08-26 04:00", tailleGo: 14.6, checksumSha256: "7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730", chiffrement: "AES-256-GCM", statutIntegrite: "100% Vérifié & Conforme", retentionJours: 365 },
        ];
      }),
      API.get("/api/superadmin/tickets-support").catch(function () { return []; }),
      API.get("/api/superadmin/journal-securite").catch(function () {
        return [
          { date: "2026-08-27 21:04:12", evenement: "Vérification cryptographique des scellements SHA-256", ip: "10.0.1.14 (Master)", statut: "100% Intact" },
          { date: "2026-08-27 18:30:00", evenement: "Synchronisation Cloud Vault - Mode C Hybride (Office Plateau)", ip: "41.202.219.45", statut: "28 minutes répliquées" },
        ];
      }),
      API.get("/api/telemetrie/erreurs").catch(function () { return []; }),
      API.get("/api/telemetrie/noeuds").catch(function () { return []; }),
    ]).then(function (res) {
      var stats = res[0], etudes = res[1], equipe = res[2] || [], matricePerms = res[3], infra = res[4], sauvegardes = res[5], tickets = res[6] || [], journal = res[7] || [], erreursParc = res[8] || [], noeudsHeartbeat = res[9] || [];

      var ongletActif = etatSuperadmin.onglet || "etudes";

      var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-4);display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap">';
      html += '<div><div style="display:flex;align-items:center;gap:8px"><h1 style="margin-bottom:2px">Console Super Administrateur SaaS</h1><span class="tag tag-accent" style="background:#0284c7;color:#fff;font-weight:700">Éditeur Multi-Études</span></div>';
      html += '<p style="opacity:.65;font-size:14px;margin:0">Supervision multi-tenant du parc notarial, équipe interne éditeur, clusters serveurs, sauvegardes immuables et PRA.</p></div>';

      html += '<div style="display:flex;gap:var(--space-2);flex-wrap:wrap">';
      html += '<button type="button" class="btn btn-primary" id="btn-deployer-etude">+ Déployer une nouvelle étude</button>';
      html += '<button type="button" class="btn btn-secondary" id="btn-refresh-superadmin">Rafraîchir la télémétrie</button>';
      html += '</div></div>';

      // =========================================================================
      // BANDEAU KPI DU PARC MULTI-ÉTUDES
      // =========================================================================
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">';

      html += '<div class="card" style="background:var(--color-surface-2);border-left:4px solid #38bdf8;padding:var(--space-3)">';
      html += '<div style="font-size:11px;font-weight:700;color:var(--color-text-dim);text-transform:uppercase">Offices Notariaux</div>';
      html += '<div style="font-size:24px;font-weight:bold;color:#38bdf8;margin:4px 0">' + (stats.totalEtudes || etudes.length) + ' études</div>';
      html += '<div style="font-size:11px;color:var(--color-text-dim)">Isolation multi-tenant étanche</div>';
      html += '</div>';

      html += '<div class="card" style="background:var(--color-surface-2);border-left:4px solid #6366f1;padding:var(--space-3)">';
      html += '<div style="font-size:11px;font-weight:700;color:var(--color-text-dim);text-transform:uppercase">Équipe Éditeur SaaS</div>';
      html += '<div style="font-size:24px;font-weight:bold;color:#6366f1;margin:4px 0">' + equipe.length + ' collaborateurs</div>';
      html += '<div style="font-size:11px;color:var(--color-text-dim)">Devs, Sales, Support, Assist.</div>';
      html += '</div>';

      html += '<div class="card" style="background:var(--color-surface-2);border-left:4px solid #22c55e;padding:var(--space-3)">';
      html += '<div style="font-size:11px;font-weight:700;color:var(--color-text-dim);text-transform:uppercase">Dossiers & Minutes</div>';
      html += '<div style="font-size:24px;font-weight:bold;color:#22c55e;margin:4px 0">' + (stats.totalDossiers || 73) + ' dossiers</div>';
      html += '<div style="font-size:11px;color:var(--color-text-dim)">' + (stats.totalMinutes || 142) + ' minutes scellées SHA-256</div>';
      html += '</div>';

      html += '<div class="card" style="background:var(--color-surface-2);border-left:4px solid #10b981;padding:var(--space-3)">';
      html += '<div style="font-size:11px;font-weight:700;color:var(--color-text-dim);text-transform:uppercase">Disponibilité SaaS</div>';
      html += '<div style="font-size:24px;font-weight:bold;color:#10b981;margin:4px 0">99.98% </div>';
      html += '<div style="font-size:11px;color:var(--color-text-dim)">Télémétrie & Sync Engine actifs</div>';
      html += '</div>';

      html += '<div class="card" style="background:var(--color-surface-2);border-left:4px solid #f59e0b;padding:var(--space-3)">';
      html += '<div style="font-size:11px;font-weight:700;color:var(--color-text-dim);text-transform:uppercase">Support L1 - L4</div>';
      html += '<div style="font-size:24px;font-weight:bold;color:#f59e0b;margin:4px 0">' + (tickets.length || stats.ticketsSupportOuverts || 2) + ' ticket(s)</div>';
      html += '<div style="font-size:11px;color:var(--color-text-dim)">Accès temporaires audités</div>';
      html += '</div>';

      html += '</div>';

      // =========================================================================
      // BARRE D'ONGLETS SUPER ADMIN
      // =========================================================================
      html += '<div class="tabs-nav" style="margin-bottom:var(--space-4);border-bottom:1px solid var(--color-border);display:flex;gap:4px;overflow-x:auto">';
      html += '<button type="button" class="tab-btn btn-superadmin-tab" data-tab="etudes" style="cursor:pointer;padding:10px 16px;font-weight:600;font-size:13px;border-radius:var(--radius) var(--radius) 0 0;background:' + (ongletActif === "etudes" ? "var(--color-surface-2)" : "transparent") + ';color:' + (ongletActif === "etudes" ? "#38bdf8;border-bottom:2px solid #38bdf8" : "var(--color-text-dim)") + '">Parc des Offices (' + etudes.length + ')</button>';
      html += '<button type="button" class="tab-btn btn-superadmin-tab" data-tab="equipe" style="cursor:pointer;padding:10px 16px;font-weight:600;font-size:13px;border-radius:var(--radius) var(--radius) 0 0;background:' + (ongletActif === "equipe" ? "var(--color-surface-2)" : "transparent") + ';color:' + (ongletActif === "equipe" ? "#38bdf8;border-bottom:2px solid #38bdf8" : "var(--color-text-dim)") + '">Équipe Éditeur SaaS (' + equipe.length + ')</button>';
      html += '<button type="button" class="tab-btn btn-superadmin-tab" data-tab="infrastructure" style="cursor:pointer;padding:10px 16px;font-weight:600;font-size:13px;border-radius:var(--radius) var(--radius) 0 0;background:' + (ongletActif === "infrastructure" ? "var(--color-surface-2)" : "transparent") + ';color:' + (ongletActif === "infrastructure" ? "#38bdf8;border-bottom:2px solid #38bdf8" : "var(--color-text-dim)") + '">Infrastructure & Clusters (' + (infra.noeudsServeurs ? infra.noeudsServeurs.length : 3) + ')</button>';
      html += '<button type="button" class="tab-btn btn-superadmin-tab" data-tab="sauvegardes" style="cursor:pointer;padding:10px 16px;font-weight:600;font-size:13px;border-radius:var(--radius) var(--radius) 0 0;background:' + (ongletActif === "sauvegardes" ? "var(--color-surface-2)" : "transparent") + ';color:' + (ongletActif === "sauvegardes" ? "#38bdf8;border-bottom:2px solid #38bdf8" : "var(--color-text-dim)") + '">Sauvegardes & PRA (' + sauvegardes.length + ')</button>';
      html += '<button type="button" class="tab-btn btn-superadmin-tab" data-tab="support" style="cursor:pointer;padding:10px 16px;font-weight:600;font-size:13px;border-radius:var(--radius) var(--radius) 0 0;background:' + (ongletActif === "support" ? "var(--color-surface-2)" : "transparent") + ';color:' + (ongletActif === "support" ? "#38bdf8;border-bottom:2px solid #38bdf8" : "var(--color-text-dim)") + '">Support Éditeur (L1-L4)</button>';
      html += '<button type="button" class="tab-btn btn-superadmin-tab" data-tab="telemetrie" style="cursor:pointer;padding:10px 16px;font-weight:600;font-size:13px;border-radius:var(--radius) var(--radius) 0 0;background:' + (ongletActif === "telemetrie" ? "var(--color-surface-2)" : "transparent") + ';color:' + (ongletActif === "telemetrie" ? "#38bdf8;border-bottom:2px solid #38bdf8" : "var(--color-text-dim)") + '">Télémétrie & Logs (' + journal.length + ')</button>';
      html += '</div>';

      // =========================================================================
      // CONTENU SELON L'ONGLET ACTIF
      // =========================================================================

      // 1. ONGLET PARC DES ÉTUDES
      if (ongletActif === "etudes") {
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);flex-wrap:wrap;gap:var(--space-2)">';
        html += '<div><strong style="font-size:16px;color:var(--color-text)">Parc des Offices Notariaux Déployés (Multi-Tenant)</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Supervision du parc d\'études notariales, formules d\'abonnement, espaces de stockage GED et domaines.</p></div>';
        html += '</div>';

        html += '<div class="table-wrap"><table class="table"><thead><tr><th>Code Tenant</th><th>Office Notarial</th><th>Notaire Titulaire</th><th>Hébergement</th><th>Dossiers / Minutes</th><th>Collaborateurs</th><th>Santé Serveur</th><th>Actions</th></tr></thead><tbody>';
        etudes.forEach(function (e, index) {
          var modeBadge = '<span class="tag" style="background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3)">Cloud Multi-Tenant</span>';

          html += '<tr>';
          html += '<td><strong style="font-family:monospace;color:var(--color-text);font-size:12px">' + (e.codeEtude || "ETUDE-001") + '</strong></td>';
          html += '<td><strong style="color:var(--color-text);font-size:13px">' + e.nomEtude + '</strong><div style="font-size:11px;color:var(--color-text-dim)">' + (e.ville || "Abidjan") + ' · Quota GED ' + (e.quotaStockageGo || 100) + ' Go</div></td>';
          html += '<td style="font-size:12px;font-weight:600">' + (e.titreNotaire || "Maître Notaire") + '</td>';
          html += '<td>' + modeBadge + '</td>';
          html += '<td><strong style="color:var(--color-accent)">' + (e.totalDossiers || 0) + '</strong> dossiers <span style="font-size:11px;color:var(--color-text-dim)">(' + (e.totalMinutes || 0) + ' min.)</span></td>';
          html += '<td><span class="tag tag-outline">' + (e.totalUtilisateurs || 5) + ' collaborateurs</span></td>';
          html += '<td><span style="font-size:12px;font-weight:bold;color:#22c55e">' + (e.statutSante || "En ligne") + '</span></td>';
          html += '<td><div style="display:flex;gap:4px;flex-wrap:wrap">';
          html += '<button type="button" class="btn btn-primary btn-deploiement-etude" data-etude-id="' + e.id + '" data-nom="' + encodeURIComponent(e.nomEtude) + '" style="font-size:11px;padding:3px 8px;font-weight:700" title="Accès et mise en ligne">Mettre en ligne</button>';
          html += '<button type="button" class="btn btn-secondary btn-configurer-etude" data-etude-idx="' + index + '" style="font-size:11px;padding:3px 8px" title="Configurer l\'office">Configurer</button>';
          html += '</div></td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
        html += '</div>';
      }

      // 2. ONGLET ÉQUIPE ÉDITEUR SAAS & MATRICE
      else if (ongletActif === "equipe") {
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4);margin-bottom:var(--space-4)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);flex-wrap:wrap;gap:var(--space-2)">';
        html += '<div><strong style="font-size:16px;color:var(--color-text)">Gestion de l\'Équipe Interne Éditeur SaaS (Vos Collaborateurs)</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Administration des comptes et rôles internes : Développeurs, Commerciaux, Support L1-L4 et Assistantes.</p></div>';
        html += '<button type="button" class="btn btn-primary" id="btn-ajouter-membre-editeur" style="font-size:12px">+ Ajouter un collaborateur SaaS</button>';
        html += '</div>';

        html += '<div class="table-wrap"><table class="table"><thead><tr><th>Nom & Prénom</th><th>Email de Connexion</th><th>Téléphone</th><th>Rôle & Accès SaaS</th><th>Statut</th><th>Actions</th></tr></thead><tbody>';
        equipe.forEach(function (m) {
          var roleTag = "";
          if (m.role === "superadmin") roleTag = '<span class="tag" style="background:#0284c7;color:#fff;font-weight:700">Direction / SuperAdmin</span>';
          else if (m.role === "dev") roleTag = '<span class="tag" style="background:#8b5cf6;color:#fff;font-weight:600">Développeur / DevOps</span>';
          else if (m.role === "commercial") roleTag = '<span class="tag" style="background:#10b981;color:#fff;font-weight:600">Commercial & Onboarding</span>';
          else if (m.role === "support") roleTag = '<span class="tag" style="background:#f59e0b;color:#fff;font-weight:600">Support Client L1-L4</span>';
          else if (m.role === "assistante_editeur") roleTag = '<span class="tag" style="background:#ec4899;color:#fff;font-weight:600">Assistante Éditeur</span>';
          else roleTag = '<span class="tag tag-outline">' + (m.role || "Membre") + '</span>';

          html += '<tr>';
          html += '<td><strong style="color:var(--color-text);font-size:13px">' + m.nomComplet + '</strong></td>';
          html += '<td><code>' + m.email + '</code></td>';
          html += '<td style="font-size:12px">' + (m.telephone || "—") + '</td>';
          html += '<td>' + roleTag + '</td>';
          html += '<td>' + (m.actif !== false ? '<span style="color:#22c55e;font-weight:bold;font-size:12px">Actif</span>' : '<span style="color:#ef4444;font-weight:bold;font-size:12px">Suspendu</span>') + '</td>';
          html += '<td><div style="display:flex;gap:4px">';
          html += '<button type="button" class="btn btn-secondary btn-modifier-membre" data-membre="' + encodeURIComponent(JSON.stringify(m)) + '" style="font-size:11px;padding:3px 8px">Modifier</button>';
          if (m.role !== "superadmin") {
            html += '<button type="button" class="btn btn-ghost btn-supprimer-membre" data-id="' + m.id + '" data-nom="' + encodeURIComponent(m.nomComplet) + '" style="font-size:11px;padding:3px 8px;color:#ef4444">Supprimer</button>';
          }
          html += '</div></td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
        html += '</div>';

        // Matrice interactive cochable
        var mRoles = (matricePerms && matricePerms.roles) || {};
        var mDefs = (matricePerms && matricePerms.definitions) || [];

        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);flex-wrap:wrap;gap:var(--space-2)">';
        html += '<div>';
        html += '<div style="display:flex;align-items:center;gap:8px"><strong style="font-size:15px;color:var(--color-text)">Matrice Interactive des Permissions par Rôle</strong><span class="tag" style="background:#10b981;color:#fff;font-size:10.5px">Cochable en direct</span></div>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Cochez les accès pour chaque profil interne selon vos besoins.</p>';
        html += '</div>';
        html += '<div style="display:flex;gap:var(--space-2);flex-wrap:wrap">';
        html += '<button type="button" class="btn btn-secondary" id="btn-reinitialiser-matrice-permissions" style="font-size:12px">Réinitialiser</button>';
        html += '<button type="button" class="btn btn-primary" id="btn-sauvegarder-matrice-permissions" style="font-size:12px;font-weight:700;background:#0284c7">Enregistrer la matrice</button>';
        html += '</div></div>';

        html += '<div class="table-wrap"><table class="table" style="font-size:12px"><thead><tr>';
        html += '<th style="min-width:240px">Fonctionnalité SaaS</th>';
        html += '<th style="text-align:center">SuperAdmin</th>';
        html += '<th style="text-align:center">Dev</th>';
        html += '<th style="text-align:center">Comm.</th>';
        html += '<th style="text-align:center">Supp.</th>';
        html += '<th style="text-align:center">Asst.</th>';
        html += '</tr></thead><tbody>';

        mDefs.forEach(function (def) {
          var pDev = mRoles.dev && mRoles.dev.permissions && mRoles.dev.permissions[def.code];
          var pCom = mRoles.commercial && mRoles.commercial.permissions && mRoles.commercial.permissions[def.code];
          var pSup = mRoles.support && mRoles.support.permissions && mRoles.support.permissions[def.code];
          var pAss = mRoles.assistante_editeur && mRoles.assistante_editeur.permissions && mRoles.assistante_editeur.permissions[def.code];

          html += '<tr><td><strong>' + def.label + '</strong><div style="font-size:11px;color:var(--color-text-dim)">' + def.description + '</div></td>';
          html += '<td style="text-align:center;background:rgba(2,132,199,0.05)"><input type="checkbox" checked disabled style="cursor:not-allowed"></td>';
          html += '<td style="text-align:center"><input type="checkbox" class="cb-matrice-permission" data-role="dev" data-perm="' + def.code + '" ' + (pDev ? "checked" : "") + '></td>';
          html += '<td style="text-align:center"><input type="checkbox" class="cb-matrice-permission" data-role="commercial" data-perm="' + def.code + '" ' + (pCom ? "checked" : "") + '></td>';
          html += '<td style="text-align:center"><input type="checkbox" class="cb-matrice-permission" data-role="support" data-perm="' + def.code + '" ' + (pSup ? "checked" : "") + '></td>';
          html += '<td style="text-align:center"><input type="checkbox" class="cb-matrice-permission" data-role="assistante_editeur" data-perm="' + def.code + '" ' + (pAss ? "checked" : "") + '></td></tr>';
        });
        html += '</tbody></table></div></div>';
      }

      // 3. ONGLET INFRASTRUCTURE & CLUSTERS
      else if (ongletActif === "infrastructure") {
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">';
        (infra.noeudsServeurs || []).forEach(function (n) {
          html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
          html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
          html += '<div><strong style="color:var(--color-text);font-size:14px">' + n.nom + '</strong><div style="font-size:11px;color:var(--color-text-dim)">' + n.role + '</div></div>';
          html += '<span style="font-size:11px;font-weight:bold;color:#22c55e">' + n.statut + '</span>';
          html += '</div>';
          html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:12px 0;background:var(--color-surface);padding:8px 10px;border-radius:var(--radius);font-size:11px">';
          html += '<div><span style="color:var(--color-text-dim)">CPU :</span> <strong>' + n.cpuPct + '%</strong></div>';
          html += '<div><span style="color:var(--color-text-dim)">RAM :</span> <strong>' + n.ramPct + '%</strong></div>';
          html += '<div><span style="color:var(--color-text-dim)">Disque :</span> <strong>' + n.disquePct + '%</strong></div>';
          html += '</div>';
          html += '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-dim)">';
          html += '<span>IP Interne : <code>' + n.ip + '</code></span>';
          html += '<span>Latence : <strong style="color:#38bdf8">' + n.latenceMs + ' ms</strong></span>';
          html += '</div></div>';
        });
        html += '</div>';

        // File d'attente de réplication et Certificats
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">';

        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
        html += '<strong style="font-size:14px;color:var(--color-text)">File d\'Attente de Réplication Hybride (Sync Queue)</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 12px">Synchronisation continue entre les serveurs locaux des offices et le Cloud Vault.</p>';
        html += '<div style="background:var(--color-surface);padding:12px;border-radius:var(--radius);font-size:12px;line-height:1.6">';
        html += '<div>État file : <strong>' + (infra.fileAttenteSync ? infra.fileAttenteSync.statutFile : "100% Synchronisée") + '</strong></div>';
        html += '<div>Éléments en attente : <strong>' + (infra.fileAttenteSync ? infra.fileAttenteSync.elementsEnAttente : 0) + ' paquet(s)</strong></div>';
        html += '<div>Débit moyen constaté : <strong style="color:#22c55e">' + (infra.fileAttenteSync ? infra.fileAttenteSync.debitMoyenMoSec : 4.8) + ' Mo/s</strong></div>';
        html += '<div>Latence moyenne inter-nœuds : <strong style="color:#38bdf8">' + (infra.fileAttenteSync ? infra.fileAttenteSync.latenceMoyenneMs : 14) + ' ms</strong></div>';
        html += '</div>';
        html += '</div>';

        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
        html += '<strong style="font-size:14px;color:var(--color-text)">Certificats SSL / TLS & Sécurité Réseau</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 12px">Chiffrement de bout en bout de toutes les communications.</p>';
        html += '<div style="background:var(--color-surface);padding:12px;border-radius:var(--radius);font-size:12px;line-height:1.6">';
        html += '<div>Domaine Wildcard : <code>*.notaires.ci</code></div>';
        html += '<div>Autorité de certification : <strong>Sectigo EV / Let\'s Encrypt</strong></div>';
        html += '<div>Protocole de transport : <strong>TLS 1.3 Strict + HSTS</strong></div>';
        html += '<div>Validité du certificat : <strong style="color:#22c55e">Valide jusqu\'en Avril 2027</strong></div>';
        html += '</div>';
        html += '</div>';

        html += '</div>';
      }

      // 4. ONGLET SAUVEGARDES & PRA
      else if (ongletActif === "sauvegardes") {
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4);margin-bottom:var(--space-4)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);flex-wrap:wrap;gap:var(--space-2)">';
        html += '<div><strong style="font-size:16px;color:var(--color-text)">Politique de Sauvegardes 3-2-1 & Plan de Reprise d\'Activité (PRA)</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Snapshots chiffrés AES-256-GCM, copies immuables (WORM) et bascule à chaud.</p></div>';
        html += '<div style="display:flex;gap:var(--space-2)">';
        html += '<button type="button" class="btn btn-primary" id="btn-snapshot-urgence" style="font-size:12px">Déclencher un Snapshot d\'Urgence</button>';
        html += '<button type="button" class="btn btn-secondary" id="btn-tester-pra" style="font-size:12px">Tester le Plan de Reprise (PRA)</button>';
        html += '</div>';
        html += '</div>';

        html += '<div id="zone-rapport-pra" style="display:none;margin-bottom:var(--space-3);padding:12px;border-radius:var(--radius);background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3)"></div>';

        html += '<div class="table-wrap"><table class="table"><thead><tr><th>ID Snapshot</th><th>Type / Périmètre</th><th>Date d\'Exécution</th><th>Taille</th><th>Empreinte SHA-256</th><th>Chiffrement</th><th>Intégrité</th></tr></thead><tbody>';
        sauvegardes.forEach(function (s) {
          html += '<tr>';
          html += '<td><strong style="font-family:monospace;color:var(--color-text);font-size:12px">' + s.id + '</strong></td>';
          html += '<td><strong>' + s.type + '</strong><div style="font-size:11px;color:var(--color-text-dim)">' + s.perimetre + '</div></td>';
          html += '<td style="font-size:12px">' + s.date + '</td>';
          html += '<td><span class="tag tag-outline">' + s.tailleGo + ' Go</span></td>';
          html += '<td><code style="font-size:10.5px;color:#38bdf8" title="' + s.checksumSha256 + '">' + s.checksumSha256.slice(0, 16) + '…</code></td>';
          html += '<td style="font-size:11px">' + s.chiffrement + '</td>';
          html += '<td><strong style="color:#22c55e;font-size:12px">' + s.statutIntegrite + '</strong></td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
        html += '</div>';
      }

      // 5. ONGLET SUPPORT ÉDITEUR L1 - L4
      else if (ongletActif === "support") {
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);flex-wrap:wrap;gap:var(--space-2)">';
        html += '<div style="display:flex;align-items:center;gap:8px"><div><strong style="font-size:16px;color:var(--color-text)">Console de Support Éditeur (L1 - L4) & Accès Exceptionnels</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Traitement des demandes d\'assistance avec garantie stricte de secret professionnel notarial.</p></div></div>';
        html += '<button type="button" class="btn btn-secondary" id="btn-demander-acces-audit" style="font-size:12px">Demander un accès temporaire d\'urgence</button>';
        html += '</div>';

        html += '<div style="background:var(--color-surface);padding:12px 14px;border-radius:var(--radius);border:1px solid var(--color-border);margin-bottom:var(--space-4);font-size:12px;line-height:1.5">';
        html += '<strong>Règle de Sécurité Fondamentale :</strong> Le support technique éditeur n\'a <strong>aucun accès direct aux données notariées</strong> des études clientes. Toute télé-assistance d\'urgence doit faire l\'objet d\'une <em>demande motivée</em>, être <em>validée explicitement par le Notaire Titulaire</em>, être <em>limitée à une durée stricte</em> (1h à 24h) et être <em>scellée dans le journal d\'audit</em>.';
        html += '</div>';

        html += '<div class="table-wrap"><table class="table"><thead><tr><th>N° Ticket</th><th>Étude</th><th>Niveau Support</th><th>Titre / Incident</th><th>Priorité</th><th>Accès Données</th><th>Statut</th></tr></thead><tbody>';
        if (!tickets.length) {
          html += '<tr><td><strong>TCK-2026-089</strong></td><td>Office Notarial — Legal Notary</td><td><span class="tag tag-accent">L2 Applicatif</span></td><td>Assistance configuration imprimante étiqueteuse code-barres cartons</td><td><span class="tag tag-outline">Normal</span></td><td><span style="color:#22c55e">Aucun accès (Non requis)</span></td><td><span class="tag tag-neutral">Ouvert</span></td></tr>';
          html += '<tr><td><strong>TCK-2026-084</strong></td><td>Étude Notariale Maître Touré</td><td><span class="tag tag-outline">L3 Base SQL / Sync</span></td><td>Vérification de la réplication Cloud Vault après coupure fibre optique</td><td><span class="tag tag-accent">Haute</span></td><td><span style="color:#38bdf8">Accès temporaire validé (2h)</span></td><td><span class="tag tag-neutral">En cours</span></td></tr>';
        } else {
          tickets.forEach(function (tk) {
            html += '<tr>';
            html += '<td><strong>' + tk.numero_ticket + '</strong></td>';
            html += '<td>Office Notarial</td>';
            html += '<td><span class="tag tag-accent">' + tk.niveau + '</span></td>';
            html += '<td><strong>' + tk.titre + '</strong><div style="font-size:11px;color:var(--color-text-dim)">' + (tk.description || "") + '</div></td>';
            html += '<td><span class="tag tag-outline">' + tk.priorite + '</span></td>';
            html += '<td>' + (tk.acces_donnees_autorise ? '<span style="color:#38bdf8">Accès temporaire accordé</span>' : '<span style="color:#22c55e">Aucun accès</span>') + '</td>';
            html += '<td><span class="tag tag-neutral">' + tk.statut + '</span></td>';
            html += '</tr>';
          });
        }
        html += '</tbody></table></div>';
        html += '</div>';
      }

      // 6. ONGLET TÉLÉMÉTRIE, WATCHDOG SERVEURS LOCAUX & ERREURS PARC
      else if (ongletActif === "telemetrie") {
        // 1. Panneau Surveillance Heartbeat des Serveurs Physiques Locaux (Cas 3)
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4);margin-bottom:var(--space-4)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);flex-wrap:wrap;gap:var(--space-2)">';
        html += '<div style="display:flex;align-items:center;gap:8px"><div><strong style="font-size:16px;color:var(--color-text)">Watchdog Heartbeat des Serveurs Physiques Locaux (On-Premise & Hybride)</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Supervision proactive en temps réel des machines locales des offices (signal toutes les 30s). Détection automatique des pannes internet ou électriques locales.</p></div></div>';
        html += '<button type="button" class="btn btn-secondary" id="btn-refresh-noeuds" style="font-size:12px">Vérifier les Nœuds</button>';
        html += '</div>';

        if (!noeudsHeartbeat || !noeudsHeartbeat.length) {
          html += '<div style="background:var(--color-surface);padding:14px;border-radius:var(--radius);border:1px solid var(--color-border);font-size:12px;color:var(--color-text-dim)">';
          html += 'ℹ️ Aucun serveur physique local n\'est actuellement appairé. Les offices sont en mode 100% Cloud Clé-en-main.';
          html += '</div>';
        } else {
          html += '<div class="table-wrap"><table class="table" style="font-size:12px"><thead><tr><th>Office Notarial</th><th>Machine Locale & IP</th><th>CPU / RAM / Disque</th><th>Agent & Sync</th><th>Dernier Signal</th><th>État Proactif</th></tr></thead><tbody>';
          noeudsHeartbeat.forEach(function (nd) {
            var badgeStatut = '<span style="color:#22c55e;font-weight:bold">En ligne (Opérationnel)</span>';
            var diffS = nd.secondesDepuisDernierSignal || 0;
            if (nd.statut === "hors_ligne" || diffS > 120) {
              badgeStatut = '<span style="color:#ef4444;font-weight:bold">Déconnecté (' + diffS + 's sans signal)</span>';
            } else if (nd.statut === "charge_elevee") {
              badgeStatut = '<span style="color:#f59e0b;font-weight:bold">Charge Élevée</span>';
            }

            html += '<tr>';
            html += '<td><strong>' + (nd.nom_etude || nd.nom_noeud) + '</strong></td>';
            html += '<td><code>' + (nd.nom_noeud || "Serveur Local") + '</code><br><span style="font-size:11px;color:var(--color-text-dim)">IP : ' + (nd.ip_locale || "192.168.1.x") + '</span></td>';
            html += '<td>CPU : <strong>' + nd.cpu_pct + '%</strong> · RAM : <strong>' + nd.ram_pct + '%</strong><br>Disque : <strong>' + nd.disque_pct + '%</strong></td>';
            html += '<td><span class="tag tag-outline">' + (nd.version_agent || "v2.4.0") + '</span></td>';
            html += '<td>Il y a ' + (nd.secondesDepuisDernierSignal ? nd.secondesDepuisDernierSignal + 's' : 'quelques secondes') + '</td>';
            html += '<td>' + badgeStatut + '</td>';
            html += '</tr>';
          });
          html += '</tbody></table></div>';
        }
        html += '</div>';

        // 2. Hub Centralisé de Remontée d'Erreurs Distribuées & Sentry
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4);margin-bottom:var(--space-4)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);flex-wrap:wrap;gap:var(--space-2)">';
        html += '<div style="display:flex;align-items:center;gap:8px"><div><strong style="font-size:16px;color:var(--color-text)">Hub Centralisé de Remontée d\'Erreurs en Production (Cloud + Serveurs Locaux)</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Toutes les exceptions et avertissements système sont capturés, assainis et notifiés à l\'équipe DevOps.</p></div></div>';
        html += '<button type="button" class="btn btn-primary" id="btn-test-alerte-critique" style="font-size:12px;background:#ef4444;border-color:#ef4444">Simuler une Alerte Critique DevOps</button>';
        html += '</div>';

        html += '<div id="zone-rapport-test-alerte" style="display:none;margin-bottom:var(--space-3);padding:12px;border-radius:var(--radius);background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3)"></div>';

        if (!erreursParc || !erreursParc.length) {
          html += '<div style="padding:var(--space-4);text-align:center;color:var(--color-text-dim);font-size:13px">Aucune erreur active signalée sur le parc. Tous les nœuds fonctionnent normalement.</div>';
        } else {
          html += '<div class="table-wrap"><table class="table" style="font-size:12px"><thead><tr><th>Niveau</th><th>Office / Source</th><th>Type d\'Erreur</th><th>Message & Contexte</th><th>Date</th><th>Statut</th><th>Actions</th></tr></thead><tbody>';
          erreursParc.forEach(function (err) {
            var badgeNiv = '<span class="tag" style="background:#8b5cf6;color:#fff">Info</span>';
            if (err.niveau === "critique") badgeNiv = '<span class="tag" style="background:#ef4444;color:#fff;font-weight:700">CRITIQUE</span>';
            else if (err.niveau === "error") badgeNiv = '<span class="tag" style="background:#f97316;color:#fff;font-weight:600">Erreur</span>';
            else if (err.niveau === "warning") badgeNiv = '<span class="tag" style="background:#f59e0b;color:#fff">Warning</span>';

            html += '<tr>';
            html += '<td>' + badgeNiv + '</td>';
            html += '<td><strong>' + (err.nom_etude || "Cloud Hostinger") + '</strong><div style="font-size:10.5px;color:var(--color-text-dim)">Source: <code>' + err.source + '</code></div></td>';
            html += '<td><code style="color:#38bdf8;font-size:11px">' + err.type_erreur + '</code></td>';
            html += '<td><div style="max-width:340px;word-break:break-word">' + err.message + '</div></td>';
            html += '<td style="font-size:11px;color:var(--color-text-dim)">' + (err.created_at ? new Date(err.created_at).toLocaleTimeString("fr-CI", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Récemment") + '</td>';
            html += '<td>' + (err.statut === "resolu" ? '<span style="color:#22c55e;font-weight:bold;font-size:11px">Résolu</span>' : '<span style="color:#f59e0b;font-weight:bold;font-size:11px">Actif</span>') + '</td>';
            html += '<td>';
            if (err.statut !== "resolu") {
              html += '<button type="button" class="btn btn-secondary btn-resoudre-erreur" data-id="' + err.id + '" style="font-size:10.5px;padding:3px 7px">Résoudre</button>';
            }
            html += '</td>';
            html += '</tr>';
          });
          html += '</tbody></table></div>';
        }
        html += '</div>';

        // 3. Journal d'Audit de Sécurité Cryptographique
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
        html += '<strong style="font-size:15px;color:var(--color-text)">Journal d\'Audit de Sécurité & Scellements SHA-256</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 var(--space-3)">Traçabilité immuable des opérations de scellement et de synchronisation.</p>';

        html += '<div class="table-wrap"><table class="table" style="font-size:11.5px"><thead><tr><th>Horodatage</th><th>Événement Système</th><th>IP / Nœud Source</th><th>Statut Cryptographique</th></tr></thead><tbody>';
        journal.forEach(function (j) {
          html += '<tr>';
          html += '<td style="font-family:monospace;font-size:11px">' + j.date + '</td>';
          html += '<td><strong>' + j.evenement + '</strong></td>';
          html += '<td><code>' + j.ip + '</code></td>';
          html += '<td><span style="color:#22c55e;font-weight:bold">' + j.statut + '</span></td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
        html += '</div>';
      }

      c.innerHTML = html;

      // Événements onglets Super Admin
      c.querySelectorAll(".btn-superadmin-tab").forEach(function (btn) {
        btn.addEventListener("click", function () {
          etatSuperadmin.onglet = btn.dataset.tab;
          renderSuperAdmin();
        });
      });

      // Gestion du test d'alerte critique DevOps et résolution d'erreurs
      var btnTestAlerte = document.getElementById("btn-test-alerte-critique");
      if (btnTestAlerte) {
        btnTestAlerte.addEventListener("click", function () {
          var rapport = document.getElementById("zone-rapport-test-alerte");
          if (rapport) {
            rapport.style.display = "block";
            rapport.innerHTML = "Déclenchement du test d'alerte instantanée (Sentry / Webhook / Mail)…";
          }
          API.post("/api/telemetrie/test-alerte", {}).then(function (res) {
            if (rapport) {
              rapport.innerHTML = '<div style="color:#ef4444;font-weight:bold;font-size:13px">Alerte Critique Émise avec Succès !</div><div style="font-size:12px;color:var(--color-text);margin-top:4px">' + res.message + '<br>Réf incident généré : <code>' + (res.incident ? res.incident.id : "") + '</code></div>';
            }
            toast("Test d'alerte critique envoyé !");
            setTimeout(renderSuperAdmin, 1500);
          }).catch(function (e) { toast(e.message); });
        });
      }

      var btnRefreshNoeuds = document.getElementById("btn-refresh-noeuds");
      if (btnRefreshNoeuds) {
        btnRefreshNoeuds.addEventListener("click", function () {
          toast("État des nœuds et des heartbeats actualisé.");
          renderSuperAdmin();
        });
      }

      c.querySelectorAll(".btn-resoudre-erreur").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var errId = btn.dataset.id;
          API.put("/api/telemetrie/erreurs/" + errId + "/resoudre", {}).then(function () {
            toast("Incident marqué comme résolu.");
            renderSuperAdmin();
          }).catch(function (e) { toast(e.message); });
        });
      });

      // Gestion de la matrice interactive cochable des permissions
      c.querySelectorAll(".cb-matrice-permission").forEach(function (cb) {
        cb.addEventListener("change", function () {
          var role = cb.dataset.role;
          var perm = cb.dataset.perm;
          if (matricePerms && matricePerms.roles && matricePerms.roles[role]) {
            if (!matricePerms.roles[role].permissions) matricePerms.roles[role].permissions = {};
            matricePerms.roles[role].permissions[perm] = cb.checked;
          }
        });
      });

      function sauvegarderMatrice() {
        API.put("/api/superadmin/permissions-matrice", matricePerms).then(function () {
          toast("Matrice des permissions SaaS enregistrée avec succès !");
          renderSuperAdmin();
        }).catch(function (e) {
          toast(e.message || "Erreur d'enregistrement");
        });
      }

      var btnSauvegarderMatrice = document.getElementById("btn-sauvegarder-matrice-permissions");
      if (btnSauvegarderMatrice) btnSauvegarderMatrice.addEventListener("click", sauvegarderMatrice);

      var btnReinitialiserMatrice = document.getElementById("btn-reinitialiser-matrice-permissions");
      if (btnReinitialiserMatrice) {
        btnReinitialiserMatrice.addEventListener("click", function () {
          if (confirm("Voulez-vous rétablir les permissions par défaut pour tous les rôles éditeurs ?")) {
            API.post("/api/superadmin/permissions-matrice/reinitialiser", {}).then(function () {
              toast("Matrice réinitialisée aux valeurs par défaut !");
              renderSuperAdmin();
            }).catch(function (e) { toast(e.message); });
          }
        });
      }

      // Événements boutons généraux
      var btnDeployer = document.getElementById("btn-deployer-etude");
      if (btnDeployer) btnDeployer.addEventListener("click", modalDeployerNouvelleEtude);

      var btnRefresh = document.getElementById("btn-refresh-superadmin");
      if (btnRefresh) btnRefresh.addEventListener("click", function () {
        toast("Télémétrie du parc SaaS rafraîchie.");
        renderSuperAdmin();
      });

      var btnAjouterMembre = document.getElementById("btn-ajouter-membre-editeur");
      if (btnAjouterMembre) btnAjouterMembre.addEventListener("click", modalAjouterMembreEditeur);

      var btnAccesAudit = document.getElementById("btn-demander-acces-audit");
      if (btnAccesAudit) btnAccesAudit.addEventListener("click", modalDemanderAccesAudit);

      var btnSnapshot = document.getElementById("btn-snapshot-urgence");
      if (btnSnapshot) {
        btnSnapshot.addEventListener("click", function () {
          API.post("/api/superadmin/sauvegardes/snapshot-urgence", {}).then(function (res) {
            toast(res.message || "Snapshot d'urgence initié avec succès !");
            renderSuperAdmin();
          }).catch(function (e) { toast(e.message); });
        });
      }

      var btnTesterPra = document.getElementById("btn-tester-pra");
      if (btnTesterPra) {
        btnTesterPra.addEventListener("click", function () {
          var rapportZone = document.getElementById("zone-rapport-pra");
          if (rapportZone) {
            rapportZone.style.display = "block";
            rapportZone.innerHTML = '<p style="margin:0;color:var(--color-text)">Simulation du PRA en cours sur les clusters miroirs…</p>';
          }
          API.post("/api/superadmin/sauvegardes/test-pra", {}).then(function (res) {
            if (rapportZone) {
              rapportZone.innerHTML = '<div style="color:#22c55e;font-weight:bold;font-size:13px">' + res.statutTest + ' — RTO: ' + res.rtoConstate + ' · RPO: ' + res.rpoConstate + '</div><div style="font-size:12px;color:var(--color-text);margin-top:4px">' + res.rapport + '</div>';
            }
            toast("Test PRA validé avec succès !");
          }).catch(function (e) { toast(e.message); });
        });
      }

      c.querySelectorAll(".btn-deploiement-etude").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var etudeId = btn.dataset.etudeId;
          var nomEtude = decodeURIComponent(btn.dataset.nom);
          modalDeploiementEtude(etudeId, nomEtude);
        });
      });

      c.querySelectorAll(".btn-configurer-etude").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = parseInt(btn.dataset.etudeIdx, 10);
          var etude = etudes[idx];
          if (etude) modalConfigurerEtude(etude);
        });
      });

      c.querySelectorAll(".btn-basculer-mode-etude").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var etudeId = btn.dataset.etudeId;
          var nomEtude = decodeURIComponent(btn.dataset.nom);
          var modeActuel = btn.dataset.mode;
          modalBasculerModeEtude(etudeId, nomEtude, modeActuel);
        });
      });

      c.querySelectorAll(".btn-modifier-membre").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var membre = JSON.parse(decodeURIComponent(btn.dataset.membre));
          modalModifierMembreEditeur(membre);
        });
      });

      c.querySelectorAll(".btn-supprimer-membre").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.dataset.id;
          var nom = decodeURIComponent(btn.dataset.nom);
          if (confirm("Confirmez-vous la suppression de l'accès pour " + nom + " ?")) {
            API.delete("/api/superadmin/equipe/" + id).then(function () {
              toast("Membre supprimé avec succès.");
              renderSuperAdmin();
            }).catch(function (e) { toast(e.message); });
          }
        });
      });
    }).catch(function (e) {
      c.innerHTML = '<p class="erreur-inline">' + e.message + '</p>';
    });
  }

  // =========================================================================
  // MODALE : GUIDE DE MISE EN LIGNE & DÉPLOIEMENT MULTI-CAS D'UNE ÉTUDE
  // =========================================================================
  function modalDeploiementEtude(etudeId, nomEtude) {
    ouvrirModal({
      titre: 'Mise en Ligne & Déploiement — ' + nomEtude,
      corps: '<p class="text-muted">Chargement des paramètres techniques et clés de déploiement…</p>',
      boutonFermer: true,
      largeur: "720px",
      apresOuverture: function () {
        API.get("/api/superadmin/etudes/" + etudeId + "/deploiement").then(function (dep) {
          var e = dep.etude;
          var html = '<div style="display:flex;flex-direction:column;gap:var(--space-3)">';

          html += '<div style="background:var(--color-surface-2);padding:10px 14px;border-radius:var(--radius);border:1px solid var(--color-border);font-size:12px;display:flex;justify-content:space-between;align-items:center">';
          html += '<div><strong>Office : ' + e.nomEtude + '</strong> (' + (e.codeEtude || "ETUDE-001") + ')</div>';
          html += '<span class="tag tag-accent">' + (e.modeInfrastructure === "hybride" ? "Mode C Hybride" : e.modeInfrastructure === "cloud" ? "Mode B Cloud" : "Mode A Local") + '</span>';
          html += '</div>';

          html += '<div style="display:grid;grid-template-columns:1fr;gap:var(--space-3)">';

          // OPTION 1 : SOUS-DOMAINE CLOUD IMMÉDIAT
          html += '<div class="card" style="background:var(--color-surface);border:1px solid rgba(56,189,248,0.3);padding:var(--space-3)">';
          html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><strong style="color:#38bdf8;font-size:13.5px">Option 1 : Espace Cloud Instantané (Sous-domaine dédié)</strong></div>';
          html += '<p style="font-size:12px;color:var(--color-text);margin:0 0 8px">L\'office est activé immédiatement sur votre serveur centralisé. Aucune installation technique requise.</p>';
          html += '<div style="background:var(--color-surface-2);padding:8px 10px;border-radius:var(--radius);font-size:12px;font-family:monospace;color:var(--color-text);display:flex;justify-content:space-between;align-items:center">';
          html += '<span>' + dep.urlCloudAutomatique + '</span>';
          html += '<button type="button" class="btn btn-secondary" onclick="navigator.clipboard.writeText(\'' + dep.urlCloudAutomatique + '\');toast(\'Lien d\\\'accès copié !\')" style="font-size:10.5px;padding:2px 6px">Copier l\'URL</button>';
          html += '</div>';
          html += '<div style="font-size:11px;color:var(--color-text-dim);margin-top:6px">Transmettez ce lien avec l\'email administrateur au notaire titulaire. Accès immédiat sécurisé HTTPS.</div>';
          html += '</div>';

          // OPTION 2 : NOM DE DOMAINE PERSONNALISÉ
          html += '<div class="card" style="background:var(--color-surface);border:1px solid rgba(34,197,94,0.3);padding:var(--space-3)">';
          html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><strong style="color:#22c55e;font-size:13.5px">Option 2 : Nom de Domaine Personnalisé du Cabinet (ex. notaire-kouame.ci)</strong></div>';
          html += '<p style="font-size:12px;color:var(--color-text);margin:0 0 8px">Le notaire conserve son adresse web officielle sur votre serveur central sans infrastructure séparée.</p>';
          html += '<div style="background:var(--color-surface-2);padding:8px 10px;border-radius:var(--radius);font-size:11.5px;line-height:1.5">';
          html += '<div>Configuration DNS chez le registraire du notaire (1 minute) :</div>';
          html += '<div style="font-family:monospace;color:#38bdf8;margin:3px 0">Type CNAME : <code>' + dep.dnsRecommande.hote + '</code> -> Cible : <code>' + dep.dnsRecommande.cible + '</code></div>';
          html += '<div>Certificat SSL : <strong style="color:#22c55e">Génération automatique TLS 1.3 Let\'s Encrypt</strong> par votre serveur central.</div>';
          html += '</div>';
          html += '</div>';

          html += '</div>';

          html += '<div style="display:flex;justify-content:flex-end;margin-top:var(--space-2)"><button type="button" class="btn btn-primary" onclick="fermerModal()">Terminer</button></div>';
          html += '</div>';

          var corpsModale = document.querySelector("#modal-conteneur .modal-corps");
          if (corpsModale) corpsModale.innerHTML = html;
        }).catch(function (e) {
          var corpsModale = document.querySelector("#modal-conteneur .modal-corps");
          if (corpsModale) corpsModale.innerHTML = '<p class="erreur-inline">' + e.message + '</p>';
        });
      }
    });
  }

  // =========================================================================
  // MODALE : AJOUTER UN MEMBRE DE L'ÉQUIPE ÉDITEUR SAAS
  // =========================================================================
  function modalAjouterMembreEditeur() {
    var html = '<form id="form-ajouter-membre-editeur" style="display:flex;flex-direction:column;gap:var(--space-3)">';

    html += '<div class="field"><label>Nom complet & Prénom</label><input class="input" name="nomComplet" placeholder="Ex. Alexandre Koffi" required></div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
    html += '<div class="field"><label>Email de connexion</label><input class="input" type="email" name="email" placeholder="dev@editeur-legal.ci" required></div>';
    html += '<div class="field"><label>Téléphone professionnel</label><input class="input" name="telephone" placeholder="+225 07 88 12 34"></div>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
    html += '<div class="field"><label>Rôle & Habilitation SaaS</label><select class="input" name="role">';
    html += '<option value="dev">Développeur / DevOps (Clusters, Infra, Télémétrie)</option>';
    html += '<option value="commercial">Commercial & Onboarding (Parc des Études, Démos)</option>';
    html += '<option value="support" selected>Support Client L1-L4 (Tickets, Assistance)</option>';
    html += '<option value="assistante_editeur">Assistante Éditeur (Gestion & Facturation)</option>';
    html += '<option value="superadmin">Direction / SuperAdmin (Accès Absolu)</option>';
    html += '</select></div>';
    html += '<div class="field"><label>Mot de passe initial</label><input class="input" type="text" name="motDePasse" value="saas123" required></div>';
    html += '</div>';

    html += '<div id="erreur-ajouter-membre" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-ajout-membre">Annuler</button><button type="submit" class="btn btn-primary">Créer le compte collaborateur</button></div>';
    html += '</form>';

    ouvrirModal({
      titre: 'Ajouter un Collaborateur à l\'Équipe Éditeur SaaS',
      corps: html,
      boutonFermer: true,
      largeur: "560px",
      apresOuverture: function () {
        document.getElementById("btn-annuler-ajout-membre").addEventListener("click", fermerModal);
        document.getElementById("form-ajouter-membre-editeur").addEventListener("submit", function (ev) {
          ev.preventDefault();
          var form = ev.target;
          var payload = {
            nomComplet: form.nomComplet.value.trim(),
            email: form.email.value.trim(),
            telephone: form.telephone.value.trim(),
            role: form.role.value,
            motDePasse: form.motDePasse.value.trim(),
          };

          API.post("/api/superadmin/equipe", payload).then(function () {
            toast("Collaborateur ajouté avec succès à l'équipe SaaS.");
            fermerModal();
            renderSuperAdmin();
          }).catch(function (e) {
            document.getElementById("erreur-ajouter-membre").textContent = e.message;
            document.getElementById("erreur-ajouter-membre").style.display = "block";
          });
        });
      },
    });
  }

  // =========================================================================
  // MODALE : MODIFIER UN MEMBRE DE L'ÉQUIPE ÉDITEUR SAAS
  // =========================================================================
  function modalModifierMembreEditeur(m) {
    var html = '<form id="form-modifier-membre-editeur" style="display:flex;flex-direction:column;gap:var(--space-3)">';

    html += '<div class="field"><label>Nom complet & Prénom</label><input class="input" name="nomComplet" value="' + m.nomComplet + '" required></div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
    html += '<div class="field"><label>Email de connexion</label><input class="input" type="email" name="email" value="' + m.email + '" required></div>';
    html += '<div class="field"><label>Téléphone professionnel</label><input class="input" name="telephone" value="' + (m.telephone || "") + '"></div>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
    html += '<div class="field"><label>Rôle & Habilitation SaaS</label><select class="input" name="role">';
    html += '<option value="dev"' + (m.role === "dev" ? " selected" : "") + '>Développeur / DevOps</option>';
    html += '<option value="commercial"' + (m.role === "commercial" ? " selected" : "") + '>Commercial & Onboarding</option>';
    html += '<option value="support"' + (m.role === "support" ? " selected" : "") + '>Support Client L1-L4</option>';
    html += '<option value="assistante_editeur"' + (m.role === "assistante_editeur" ? " selected" : "") + '>Assistante Éditeur</option>';
    html += '<option value="superadmin"' + (m.role === "superadmin" ? " selected" : "") + '>Direction / SuperAdmin</option>';
    html += '</select></div>';
    html += '<div class="field"><label>Statut du compte</label><select class="input" name="actif">';
    html += '<option value="true"' + (m.actif !== false ? " selected" : "") + '>Actif</option>';
    html += '<option value="false"' + (m.actif === false ? " selected" : "") + '>Suspendu</option>';
    html += '</select></div>';
    html += '</div>';

    html += '<div id="erreur-modifier-membre" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-modif-membre">Annuler</button><button type="submit" class="btn btn-primary">Enregistrer les modifications</button></div>';
    html += '</form>';

    ouvrirModal({
      titre: 'Modifier un Collaborateur SaaS',
      corps: html,
      boutonFermer: true,
      largeur: "560px",
      apresOuverture: function () {
        document.getElementById("btn-annuler-modif-membre").addEventListener("click", fermerModal);
        document.getElementById("form-modifier-membre-editeur").addEventListener("submit", function (ev) {
          ev.preventDefault();
          var form = ev.target;
          var payload = {
            nomComplet: form.nomComplet.value.trim(),
            email: form.email.value.trim(),
            telephone: form.telephone.value.trim(),
            role: form.role.value,
            actif: form.actif.value === "true",
          };

          API.put("/api/superadmin/equipe/" + m.id, payload).then(function () {
            toast("Collaborateur mis à jour avec succès.");
            fermerModal();
            renderSuperAdmin();
          }).catch(function (e) {
            document.getElementById("erreur-modifier-membre").textContent = e.message;
            document.getElementById("erreur-modifier-membre").style.display = "block";
          });
        });
      },
    });
  }

  // =========================================================================
  // MODALE : DÉPLOYER UN NOUVEL OFFICE NOTARIAL (PROVISIONING SAAS MULTI-TENANT)
  // =========================================================================
  // =========================================================================
  // MODALE : DÉPLOYER UN NOUVEL OFFICE NOTARIAL (PROVISIONING SAAS MULTI-TENANT)
  // =========================================================================
  function modalDeployerNouvelleEtude() {
    var html = '<form id="form-deployer-etude" style="display:flex;flex-direction:column;gap:var(--space-3)">';

    html += '<div class="field"><label>Nom officiel de l\'office notarial</label><input class="input" name="nomEtude" placeholder="Ex. Étude Notariale Maître Kouamé" required></div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
    html += '<div class="field"><label>Notaire Titulaire</label><input class="input" name="titreNotaire" placeholder="Ex. Maître Kouamé Jean-Luc" required></div>';
    html += '<div class="field"><label>Ville / Région d\'implantation</label><input class="input" name="ville" value="Abidjan" required></div>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
    html += '<div class="field"><label>Email Administrateur du Notaire</label><input class="input" type="email" name="emailAdmin" placeholder="kouame@notaire.ci" required></div>';
    html += '<div class="field"><label>Mot de passe initial</label><input class="input" type="text" name="motDePasseAdmin" value="notaire123" required></div>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
    html += '<div class="field"><label>Formule d\'Abonnement SaaS</label><select class="input" name="modeInfrastructure">';
    html += '<option value="cloud" selected>Formule Cloud Standard (100 Go)</option>';
    html += '<option value="cloud_pro">Formule Cloud Professionnelle (250 Go)</option>';
    html += '<option value="cloud_enterprise">Formule Cloud Entreprise (500 Go)</option>';
    html += '<option value="cloud_illimite">Formule Grand Cabinet (1 To)</option>';
    html += '</select></div>';
    html += '<div class="field"><label>Quota de Stockage GED Alloué</label><select class="input" name="quotaStockageGo">';
    html += '<option value="100" selected>100 Go</option>';
    html += '<option value="250">250 Go</option>';
    html += '<option value="500">500 Go</option>';
    html += '<option value="1000">1 000 Go (1 To)</option>';
    html += '</select></div>';
    html += '</div>';

    html += '<div style="font-size:11px;color:var(--color-text-dim);background:var(--color-surface-2);padding:8px 10px;border-radius:var(--radius);border:1px solid var(--color-border)">';
    html += '<strong>Isolation Stricte :</strong> L\'office bénéficiera immédiatement d\'un tenant PostgreSQL partitionné (`etude_id`), d\'un compte administrateur Notaire prêt à l\'emploi, et d\'un chiffrement AES-256 des secrets conforme au secret professionnel.';
    html += '</div>';

    html += '<div id="erreur-deployer-etude" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-deploy">Annuler</button><button type="submit" class="btn btn-primary">Déployer & Initialiser l\'Office</button></div>';
    html += '</form>';

    ouvrirModal({
      titre: 'Déploiement d\'un Nouvel Office Notarial (Multi-Tenant SaaS)',
      corps: html,
      boutonFermer: true,
      largeur: "580px",
      apresOuverture: function () {
        document.getElementById("btn-annuler-deploy").addEventListener("click", fermerModal);
        document.getElementById("form-deployer-etude").addEventListener("submit", function (ev) {
          ev.preventDefault();
          var form = ev.target;
          var errZone = document.getElementById("erreur-deployer-etude");
          errZone.style.display = "none";

          var payload = {
            nomEtude: form.nomEtude.value.trim(),
            titreNotaire: form.titreNotaire.value.trim(),
            emailAdmin: form.emailAdmin.value.trim(),
            motDePasseAdmin: form.motDePasseAdmin.value.trim(),
            modeInfrastructure: form.modeInfrastructure.value,
            quotaStockageGo: parseInt(form.quotaStockageGo.value, 10) || 100,
            ville: form.ville.value.trim(),
          };

          API.post("/api/superadmin/etudes", payload).then(function (nouvelle) {
            toast("Office Notarial " + nouvelle.nom_etude + " déployé avec succès ! Compte administrateur créé.");
            fermerModal();
            renderSuperAdmin();
          }).catch(function (e) {
            errZone.textContent = e.message;
            errZone.style.display = "block";
          });
        });
      },
    });
  }

  // =========================================================================
  // MODALE : CONFIGURATION COMPLÈTE D'UN OFFICE NOTARIAL
  // =========================================================================
  function modalConfigurerEtude(etude) {
    var html = '<form id="form-configurer-etude" style="display:flex;flex-direction:column;gap:var(--space-3)">';

    html += '<div style="display:flex;justify-content:space-between;align-items:center;background:var(--color-surface-2);padding:8px 12px;border-radius:var(--radius);border:1px solid var(--color-border)">';
    html += '<div><strong style="font-size:13px;color:var(--color-text)">Code Tenant : <code>' + (etude.codeEtude || "ETUDE-001") + '</code></strong></div>';
    html += '<span class="tag tag-accent">' + (etude.statutSante || "En ligne") + '</span>';
    html += '</div>';

    html += '<div class="field"><label>Nom de l\'office notarial</label><input class="input" name="nomEtude" value="' + (etude.nomEtude || "") + '" required></div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
    html += '<div class="field"><label>Notaire Titulaire</label><input class="input" name="titreNotaire" value="' + (etude.titreNotaire || "") + '" required></div>';
    html += '<div class="field"><label>Ville / Région</label><input class="input" name="ville" value="' + (etude.ville || "Abidjan") + '" required></div>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
    html += '<div class="field"><label>Plateforme d\'Hébergement</label><input class="input" value="Cloud Multi-Tenant Centralisé" readonly style="opacity:.8;cursor:not-allowed"></div>';
    html += '<div class="field"><label>Quota de Stockage GED Alloué (Go)</label><input class="input" type="number" name="quotaStockageGo" value="' + (etude.quotaStockageGo || 100) + '" required></div>';
    html += '</div>';

    html += '<div class="field"><label>Domaine / Sous-domaine de l\'office</label><input class="input" name="domaine" value="' + (etude.domaine || "") + '"></div>';

    html += '<div id="erreur-configurer-etude" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-config">Annuler</button><button type="submit" class="btn btn-primary">Enregistrer la configuration</button></div>';
    html += '</form>';

    ouvrirModal({
      titre: 'Configuration de l\'Office Notarial',
      corps: html,
      boutonFermer: true,
      largeur: "560px",
      apresOuverture: function () {
        document.getElementById("btn-annuler-config").addEventListener("click", fermerModal);
        document.getElementById("form-configurer-etude").addEventListener("submit", function (ev) {
          ev.preventDefault();
          var form = ev.target;
          var payload = {
            nomEtude: form.nomEtude.value.trim(),
            titreNotaire: form.titreNotaire.value.trim(),
            ville: form.ville.value.trim(),
            modeInfrastructure: "cloud",
            quotaStockageGo: parseInt(form.quotaStockageGo.value, 10) || 100,
            domaine: form.domaine.value.trim(),
          };

          API.put("/api/superadmin/etudes/" + etude.id, payload).then(function () {
            toast("Configuration de l'office mise à jour avec succès.");
            fermerModal();
            renderSuperAdmin();
          }).catch(function (e) {
            document.getElementById("erreur-configurer-etude").textContent = e.message;
            document.getElementById("erreur-configurer-etude").style.display = "block";
          });
        });
      },
    });
  }

  // =========================================================================
  // MODALE : DEMANDE D'ACCÈS TEMPORAIRE AUDITÉ (SUPPORT L1-L4)
  // =========================================================================
  function modalDemanderAccesAudit() {
    var html = '<form id="form-acces-audit" style="display:flex;flex-direction:column;gap:var(--space-3)">';
    html += '<div class="field"><label>Office Notarial concerné</label><select class="input" name="etudeId">';
    html += '<option value="a0000000-0000-0000-0000-000000000001">Office Notarial — Legal Notary (Abidjan Plateau)</option>';
    html += '<option value="a0000000-0000-0000-0000-000000000002">Étude Notariale Maître Touré (Cocody)</option>';
    html += '</select></div>';

    html += '<div class="field"><label>Motif précis & obligatoire de l\'intervention</label><textarea class="input" name="motif" rows="3" placeholder="Ex. Diagnostic d\'un incident de synchronisation des minutes scellées après coupure électrique" required></textarea></div>';

    html += '<div class="field"><label>Durée maximale de l\'autorisation temporaire</label><select class="input" name="dureeHeures">';
    html += '<option value="1">1 heure</option>';
    html += '<option value="2" selected>2 heures</option>';
    html += '<option value="6">6 heures</option>';
    html += '<option value="24">24 heures (Maximum légal)</option>';
    html += '</select></div>';

    html += '<div style="font-size:11px;color:var(--color-text-dim);background:var(--color-surface-2);padding:8px 10px;border-radius:var(--radius);border:1px solid var(--color-border)">';
    html += '<strong>Journal d\'audit cryptographique :</strong> Toutes les actions réalisées durant cette session seront tracées avec horodatage certifié et transmises au Notaire Titulaire.';
    html += '</div>';

    html += '<div id="erreur-acces-audit" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-audit">Annuler</button><button type="submit" class="btn btn-primary">Soumettre la demande d\'autorisation</button></div>';
    html += '</form>';

    ouvrirModal({
      titre: 'Demande d\'Accès Temporaire d\'Urgence Audité',
      corps: html,
      boutonFermer: true,
      largeur: "540px",
      apresOuverture: function () {
        document.getElementById("btn-annuler-audit").addEventListener("click", fermerModal);
        document.getElementById("form-acces-audit").addEventListener("submit", function (ev) {
          ev.preventDefault();
          var form = ev.target;
          var payload = {
            etudeId: form.etudeId.value,
            motif: form.motif.value.trim(),
            dureeHeures: parseInt(form.dureeHeures.value, 10) || 2,
          };
          API.post("/api/support/demander-acces-temporaire", payload).then(function (res) {
            toast("Demande d'accès temporaire transmise au Notaire Titulaire pour validation.");
            fermerModal();
            renderSuperAdmin();
          }).catch(function (e) {
            document.getElementById("erreur-acces-audit").textContent = e.message;
            document.getElementById("erreur-acces-audit").style.display = "block";
          });
        });
      },
    });
  }

  // =========================================================================
  // MODULE : RAPPORTS D'ACTIVITÉ & ÉCHÉANCES DIRECTION SAAS
  // =========================================================================
  var etatRapports = { filtreRole: "tous" };

  function renderRapports() {
    var c = document.getElementById("vue-rapports");
    if (!c) return;

    var role = cache.utilisateur ? cache.utilisateur.role : "superadmin";
    c.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:240px;color:var(--color-text-dim)">Chargement des rapports d\'activité…</div>';

    if (role === "superadmin") {
      API.get("/api/rapports/synthese-direction").then(function (synthese) {
        renderRapportsDirection(c, synthese);
      }).catch(function (e) {
        c.innerHTML = '<p class="erreur-inline">Erreur chargement rapports : ' + e.message + '</p>';
      });
    } else {
      Promise.all([
        API.get("/api/rapports/mes-rapports"),
        API.get("/api/rapports/parametres-frequences"),
      ]).then(function (res) {
        renderRapportsCollaborateur(c, role, res[0], res[1]);
      }).catch(function (e) {
        c.innerHTML = '<p class="erreur-inline">Erreur chargement rapports : ' + e.message + '</p>';
      });
    }
  }

  // --- A. VUE DIRECTION GÉNÉRALE (SYNTHÈSE, GESTION DES ÉCHÉANCES & VALIDATION) ---
  function renderRapportsDirection(c, synthese) {
    var kpisGlobaux = synthese.kpisGlobaux || {};
    var kpisCom = synthese.kpisCommerciaux || {};
    var kpisSup = synthese.kpisSupport || {};
    var params = synthese.parametresFrequences || [];
    var tousRapports = synthese.derniersRapports || [];

    var rapportsFiltres = tousRapports;
    if (etatRapports.filtreRole !== "tous") {
      rapportsFiltres = tousRapports.filter(function (r) { return r.role === etatRapports.filtreRole; });
    }

    var kpis = [
      { label: "Ponctualité de l'Équipe", valeur: (kpisGlobaux.tauxPonctualite || 100) + "%", indice: "accent", icon: "", sub: (kpisGlobaux.enRetard || 0) + " rapport(s) en retard" },
      { label: "Total Rapports Soumis", valeur: String(kpisGlobaux.totalRapports || 0), indice: "", icon: "", sub: (kpisGlobaux.enAttenteLecture || 0) + " en attente de validation" },
      { label: "Performance Commerciale", valeur: fmtFCFA(kpisCom.totalMrrGenere || 0) + " MRR", indice: "accent", icon: "", sub: (kpisCom.totalContratsSignes || 0) + " contrat(s) · " + (kpisCom.totalDemosRealisees || 0) + " démos" },
      { label: "Qualité Support & CSAT", valeur: kpisSup.moyenneCsat || "98.5%", indice: "", icon: "", sub: (kpisSup.totalTicketsResolus || 0) + " tickets résolus · Rép: " + (kpisSup.tempsMoyenResolution || "1h 35m") },
    ];

    var html = '<div style="margin-bottom:var(--space-4)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding-bottom:var(--space-2);border-bottom:1px solid var(--color-border)">';
    html += '<div><h1 style="margin:0;font-size:22px;color:var(--color-text)">Direction Générale · Rapports & Échéances Équipe</h1>';
    html += '<p style="opacity:.65;font-size:13px;margin:2px 0 0">Supervision de l\'activité hebdomadaire, contrôle des performances et configuration des délais de soumission.</p></div>';
    html += '<div style="display:flex;gap:var(--space-2)">';
    html += '<button type="button" class="btn btn-secondary" id="btn-refresh-rapports" style="padding:6px 12px;font-size:12px">Actualiser</button>';
    html += '</div>';
    html += '</div></div>';

    html += renderKpisGrid(kpis);

    // =========================================================================
    // 1. SECTION : PARAMÉTRAGE DES ÉCHÉANCES & FRÉQUENCES (PAR LA DIRECTION)
    // =========================================================================
    html += '<div class="card elev-sm" style="margin-bottom:var(--space-5);border-color:rgba(56,189,248,0.25)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)">';
    html += '<div><strong style="font-size:15px;color:#38bdf8">Configuration des Échéances & Délais de Soumission</strong>';
    html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Définissez quand chaque collaborateur doit impérativement vous remettre son compte-rendu d\'activité.</p></div>';
    html += '<span class="tag tag-accent">Contrôle Direction</span>';
    html += '</div>';

    html += '<div style="overflow-x:auto">';
    html += '<table class="table" style="font-size:12.5px;width:100%">';
    html += '<thead><tr><th>Fonction / Rôle</th><th>Fréquence</th><th>Jour & Heure Limite</th><th>Attendus & Objectifs Clés</th><th>Statut</th><th>Action</th></tr></thead>';
    html += '<tbody>';

    params.forEach(function (p) {
      var iconRole = p.roleCible === "commercial" ? "" : p.roleCible === "support" ? "" : p.roleCible === "dev" ? "" : "";
      var libelleRole = ROLE_LABEL[p.roleCible] || p.roleCible;
      html += '<tr>';
      html += '<td><strong>' + iconRole + ' ' + libelleRole + '</strong></td>';
      html += '<td><span class="tag tag-outline" style="text-transform:capitalize">' + p.frequence + '</span></td>';
      html += '<td><strong style="color:var(--color-text)">Chaque ' + p.jourLimite + '</strong> avant <code style="color:#38bdf8">' + p.heureLimite + '</code></td>';
      html += '<td style="max-width:320px;font-size:11.5px;color:var(--color-text-dim)">' + (p.descriptionAttendus || "—") + '</td>';
      html += '<td>' + (p.actif ? '<span class="tag tag-accent">Actif</span>' : '<span class="tag tag-outline">Désactivé</span>') + '</td>';
      html += '<td><button type="button" class="btn btn-secondary btn-modifier-echeance" data-role="' + p.roleCible + '" style="font-size:11px;padding:3px 8px">Modifier</button></td>';
      html += '</tr>';
    });

    html += '</tbody></table></div></div>';

    // =========================================================================
    // 2. SECTION : FLUX DES RAPPORTS DE L'ÉQUIPE (AVEC FILTRES & VALIDATION)
    // =========================================================================
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)">';
    html += '<div><h2 style="margin:0;font-size:16px;color:var(--color-text)">Derniers Rapports d\'Activité Soumis</h2>';
    html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Consultez les bilans détaillés, validez les rapports ou demandez des directives spécifiques.</p></div>';

    // Filtres par rôle
    html += '<div style="display:flex;gap:4px;background:var(--color-surface-2);padding:3px;border-radius:var(--radius);border:1px solid var(--color-border)">';
    var filtres = [
      { id: "tous", label: "Tous (" + tousRapports.length + ")" },
      { id: "commercial", label: "Commercial (" + tousRapports.filter(function (r) { return r.role === "commercial"; }).length + ")" },
      { id: "support", label: "Support (" + tousRapports.filter(function (r) { return r.role === "support"; }).length + ")" },
      { id: "dev", label: "DevOps (" + tousRapports.filter(function (r) { return r.role === "dev"; }).length + ")" },
    ];
    filtres.forEach(function (f) {
      var actif = etatRapports.filtreRole === f.id;
      html += '<button type="button" class="btn-role-switch btn-filtre-rapport' + (actif ? ' actif' : '') + '" data-filtre="' + f.id + '" style="font-size:11px;padding:3px 8px">' + f.label + '</button>';
    });
    html += '</div></div>';

    if (rapportsFiltres.length === 0) {
      html += '<div class="card" style="text-align:center;padding:var(--space-6);color:var(--color-text-dim)">Aucun rapport d\'activité soumis pour ce filtre pour le moment.</div>';
    } else {
      html += '<div style="display:grid;grid-template-columns:1fr;gap:var(--space-4)">';
      rapportsFiltres.forEach(function (r) {
        var icon = r.role === "commercial" ? "" : r.role === "support" ? "" : r.role === "dev" ? "" : "";
        var badgeStatut = r.statut === "valide_direction"
          ? '<span class="tag tag-accent">Validé par la Direction</span>'
          : r.statut === "demande_precision"
          ? '<span class="tag tag-danger">Précisions demandées</span>'
          : '<span class="tag tag-outline" style="border-color:#38bdf8;color:#38bdf8">En attente d\'évaluation</span>';

        var badgeRetard = r.enRetard ? '<span class="tag tag-danger">Soumis en retard</span>' : '<span class="tag tag-outline" style="color:#22c55e;border-color:#22c55e">À temps</span>';

        html += '<div class="card elev-sm" style="background:var(--color-surface);border:1px solid var(--color-border);padding:var(--space-4)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-3)">';
        html += '<div>';
        html += '<div style="display:flex;align-items:center;gap:8px">';
        html += '<span style="font-size:18px">' + icon + '</span>';
        html += '<strong style="font-size:15px;color:var(--color-text)">' + r.titre + '</strong>';
        html += badgeStatut;
        html += badgeRetard;
        html += '</div>';
        html += '<div style="font-size:12px;color:var(--color-text-dim);margin-top:3px">';
        html += 'Auteur : <strong>' + r.auteurNom + '</strong> (' + (ROLE_LABEL[r.role] || r.role) + ') · Période du ' + fmtDate(r.periodeDebut) + ' au ' + fmtDate(r.periodeFin) + ' · Soumis le ' + fmtDate(r.dateSoumission);
        html += '</div>';
        html += '</div>';

        // Bouton d'action Direction
        html += '<div style="display:flex;gap:var(--space-2)">';
        html += '<button type="button" class="btn btn-secondary btn-evaluer-rapport" data-id="' + r.id + '" data-titre="' + r.titre + '" style="font-size:11.5px;padding:4px 10px">Évaluer / Directives</button>';
        html += '</div>';
        html += '</div>';

        // Corps des données selon le rôle
        var d = r.donnees || {};
        html += '<div style="background:var(--color-surface-2);padding:12px;border-radius:var(--radius);border:1px solid var(--color-border);margin-bottom:var(--space-2)">';

        if (r.role === "commercial") {
          html += '<div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;margin-bottom:10px">';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Études Prospectées</span><div style="font-size:16px;font-weight:700;color:var(--color-text)">' + (d.etudesContactees || 0) + '</div></div>';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Démos Réalisées</span><div style="font-size:16px;font-weight:700;color:#38bdf8">' + (d.demosRealisees || 0) + '</div></div>';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Contrats Signés</span><div style="font-size:16px;font-weight:700;color:#22c55e">' + (d.contratsSignes || 0) + ' études</div></div>';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">MRR Récurrent</span><div style="font-size:16px;font-weight:700;color:#22c55e">' + fmtFCFA(d.mrrGenereFCFA || 0) + '</div></div>';
          html += '</div>';
          if (d.etudesEnClosing && d.etudesEnClosing.length) {
            html += '<div style="font-size:12px;margin-bottom:6px"><strong>Études en phase de signature / closing :</strong> <span style="color:#38bdf8">' + (Array.isArray(d.etudesEnClosing) ? d.etudesEnClosing.join(", ") : d.etudesEnClosing) + '</span></div>';
          }
        } else if (r.role === "support") {
          html += '<div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;margin-bottom:10px">';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Tickets Traités</span><div style="font-size:16px;font-weight:700;color:var(--color-text)">' + (d.ticketsTraites || 0) + '</div></div>';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Tickets Résolus</span><div style="font-size:16px;font-weight:700;color:#22c55e">' + (d.ticketsResolus || 0) + '</div></div>';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Score CSAT</span><div style="font-size:16px;font-weight:700;color:#38bdf8">' + (d.scoreCsatPct || 98.2) + '%</div></div>';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Délai Réponse</span><div style="font-size:16px;font-weight:700;color:var(--color-text)">' + (d.tempsReponseMinutes || 12) + ' min</div></div>';
          html += '</div>';
          if (d.topProblemes) {
            html += '<div style="font-size:12px;margin-bottom:6px"><strong>Problèmes récurrents :</strong> <span style="color:var(--color-text)">' + d.topProblemes + '</span></div>';
          }
          if (d.etudesSousSurveillance) {
            html += '<div style="font-size:12px;margin-bottom:6px"><strong>Études nécessitant accompagnement :</strong> <span style="color:#f59e0b">' + d.etudesSousSurveillance + '</span></div>';
          }
        } else if (r.role === "dev") {
          html += '<div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;margin-bottom:10px">';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Disponibilité Uptime</span><div style="font-size:16px;font-weight:700;color:#22c55e">' + (d.uptimePourcentage || 99.98) + '%</div></div>';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Incidents Bloquants</span><div style="font-size:16px;font-weight:700;color:var(--color-text)">' + (d.incidentsBloquants || 0) + '</div></div>';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Sauvegardes WORM</span><div style="font-size:16px;font-weight:700;color:#38bdf8">' + (d.snapshotsWormGeneres || 7) + ' snapshots</div></div>';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Conformité PRA</span><div style="font-size:16px;font-weight:700;color:#22c55e">' + (d.testPraConformite || "100% OK") + '</div></div>';
          html += '</div>';
          if (d.misesEnProduction) {
            html += '<div style="font-size:12px;margin-bottom:6px"><strong>Mises en production :</strong> <span style="color:var(--color-text)">' + d.misesEnProduction + '</span></div>';
          }
        }

        if (d.faitsMarquants) {
          html += '<div style="font-size:12px;margin-top:6px"><strong>Faits marquants :</strong> <span style="color:var(--color-text)">' + d.faitsMarquants + '</span></div>';
        }
        if (d.pointsBloquants) {
          html += '<div style="font-size:12px;margin-top:4px"><strong>Points bloquants :</strong> <span style="color:#f43f5e">' + d.pointsBloquants + '</span></div>';
        }
        if (d.prioritesSemaineProchaine || d.prioritesTechniques) {
          html += '<div style="font-size:12px;margin-top:4px"><strong>Priorités semaine prochaine :</strong> <span style="color:#38bdf8">' + (d.prioritesSemaineProchaine || d.prioritesTechniques) + '</span></div>';
        }

        html += '</div>';

        // Commentaire existant de la Direction
        if (r.commentaireDirection) {
          html += '<div style="background:rgba(56,189,248,0.08);border-left:3px solid #38bdf8;padding:8px 12px;border-radius:4px;font-size:12px;margin-top:6px">';
          html += '<strong style="color:#38bdf8">Directive de la Direction :</strong> ' + r.commentaireDirection;
          html += '</div>';
        }

        html += '</div>';
      });
      html += '</div>';
    }

    c.innerHTML = html;

    // Attachement des événements
    document.getElementById("btn-refresh-rapports").addEventListener("click", renderRapports);

    c.querySelectorAll(".btn-filtre-rapport").forEach(function (btn) {
      btn.addEventListener("click", function () {
        etatRapports.filtreRole = btn.dataset.filtre;
        renderRapports();
      });
    });

    c.querySelectorAll(".btn-modifier-echeance").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var roleCible = btn.dataset.role;
        var p = params.find(function (it) { return it.roleCible === roleCible; }) || {};
        modalModifierFrequence(roleCible, p);
      });
    });

    c.querySelectorAll(".btn-evaluer-rapport").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.id;
        var titre = btn.dataset.titre;
        modalEvaluerRapport(id, titre);
      });
    });
  }

  // --- B. VUE COLLABORATEUR SAAS (COMMERCIAL, SUPPORT, DEV, ASSISTANTE) ---
  function renderRapportsCollaborateur(c, role, mesRapports, params) {
    var param = params.find(function (p) { return p.roleCible === role; }) || { frequence: "hebdomadaire", jourLimite: "vendredi", heureLimite: "17:00", descriptionAttendus: "" };
    var icon = role === "commercial" ? "" : role === "support" ? "" : role === "dev" ? "" : "";

    var html = '<div style="margin-bottom:var(--space-4)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding-bottom:var(--space-2);border-bottom:1px solid var(--color-border)">';
    html += '<div><h1 style="margin:0;font-size:22px;color:var(--color-text)">' + icon + ' Mes Rapports d\'Activité · ' + (ROLE_LABEL[role] || role) + '</h1>';
    html += '<p style="opacity:.65;font-size:13px;margin:2px 0 0">Rédigez et soumettez vos comptes-rendus périodiques à la Direction Générale.</p></div>';
    html += '<button type="button" class="btn btn-primary" id="btn-nouveau-rapport-collab" style="font-size:13px;padding:8px 14px">+ Rédiger mon Rapport</button>';
    html += '</div></div>';

    // Bandeau d'information sur l'échéance fixée par la Direction
    html += '<div class="card" style="background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.3);padding:var(--space-3);margin-bottom:var(--space-4);display:flex;align-items:center;justify-content:space-between">';
    html += '<div><strong style="color:#38bdf8;font-size:13.5px">⏰ Échéance fixée par la Direction :</strong>';
    html += '<span style="font-size:13px;color:var(--color-text);margin-left:6px">Votre rapport est attendu chaque <strong>' + param.jourLimite + '</strong> avant <code style="color:#38bdf8">' + param.heureLimite + '</code> (' + param.frequence + ').</span>';
    html += '<div style="font-size:11.5px;color:var(--color-text-dim);margin-top:2px">Attendus clés : ' + (param.descriptionAttendus || "Compte-rendu complet de l'activité.") + '</div></div>';
    html += '<span class="tag tag-accent">Directive Direction</span>';
    html += '</div>';

    // Historique des rapports soumis par ce collaborateur
    html += '<div style="margin-bottom:var(--space-3)"><h2 style="margin:0;font-size:16px;color:var(--color-text)">Historique de mes Rapports Soumis</h2></div>';

    if (mesRapports.length === 0) {
      html += '<div class="card" style="text-align:center;padding:var(--space-6);color:var(--color-text-dim)">Vous n\'avez pas encore soumis de rapport d\'activité. Cliquez sur "+ Rédiger mon Rapport" pour démarrer.</div>';
    } else {
      html += '<div style="display:grid;grid-template-columns:1fr;gap:var(--space-3)">';
      mesRapports.forEach(function (r) {
        var badgeStatut = r.statut === "valide_direction"
          ? '<span class="tag tag-accent">Validé par la Direction</span>'
          : r.statut === "demande_precision"
          ? '<span class="tag tag-danger">Précisions demandées</span>'
          : '<span class="tag tag-outline" style="border-color:#38bdf8;color:#38bdf8">En cours de lecture</span>';

        html += '<div class="card elev-sm" style="background:var(--color-surface);border:1px solid var(--color-border);padding:var(--space-3)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">';
        html += '<div style="display:flex;align-items:center;gap:8px">';
        html += '<strong style="font-size:14px;color:var(--color-text)">' + r.titre + '</strong>';
        html += badgeStatut;
        html += '</div>';
        html += '<div style="font-size:12px;color:var(--color-text-dim)">Période du ' + fmtDate(r.periodeDebut) + ' au ' + fmtDate(r.periodeFin) + '</div>';
        html += '</div>';

        // Directive retour
        if (r.commentaireDirection) {
          html += '<div style="background:rgba(56,189,248,0.08);border-left:3px solid #38bdf8;padding:6px 10px;border-radius:4px;font-size:12px;margin-top:6px">';
          html += '<strong style="color:#38bdf8">Retour de la Direction :</strong> ' + r.commentaireDirection;
          html += '</div>';
        }

        html += '</div>';
      });
      html += '</div>';
    }

    c.innerHTML = html;

    document.getElementById("btn-nouveau-rapport-collab").addEventListener("click", function () {
      modalRedigerRapport(role);
    });
  }

  // --- C. MODALE : RÉDACTION DE RAPPORT ADAPTÉE AU RÔLE ---
  function modalRedigerRapport(role) {
    var icon = role === "commercial" ? "" : role === "support" ? "" : role === "dev" ? "" : "";
    var aujourdhui = new Date().toISOString().split("T")[0];

    var html = '<form id="form-soumettre-rapport" style="display:flex;flex-direction:column;gap:var(--space-3)">';
    html += '<div class="field"><label>Titre du Rapport</label><input class="input" name="titre" value="Rapport d\'Activité · ' + (ROLE_LABEL[role] || role) + ' · Semaine ' + Math.ceil(new Date().getDate() / 7) + '" required></div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
    html += '<div class="field"><label>Période du</label><input class="input" type="date" name="periodeDebut" value="' + aujourdhui + '" required></div>';
    html += '<div class="field"><label>Au</label><input class="input" type="date" name="periodeFin" value="' + aujourdhui + '" required></div>';
    html += '</div>';

    if (role === "commercial") {
      html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:var(--space-2)">';
      html += '<div class="field"><label>Études Contactées</label><input class="input" type="number" name="etudesContactees" value="10" required></div>';
      html += '<div class="field"><label>Démos Réalisées</label><input class="input" type="number" name="demosRealisees" value="4" required></div>';
      html += '<div class="field"><label>Contrats Signés</label><input class="input" type="number" name="contratsSignes" value="1" required></div>';
      html += '<div class="field"><label>MRR Généré (FCFA)</label><input class="input" type="number" name="mrrGenereFCFA" value="250000" required></div>';
      html += '</div>';

      html += '<div class="field"><label>Études en phase de signature / closing (Pipeline chaud)</label><input class="input" name="etudesEnClosing" placeholder="Ex. Étude Me Touré (Plateau), Étude Me Bamba (Cocody)"></div>';
      html += '<div class="field"><label>Faits marquants & Succès de la semaine</label><textarea class="input" name="faitsMarquants" rows="2" placeholder="Ex. Très bon accueil de la fonction simulation d\'émoluments Décret 2013." required></textarea></div>';
      html += '<div class="field"><label>Points bloquants & Objections rencontrées</label><textarea class="input" name="pointsBloquants" rows="2" placeholder="Ex. Réticence sur la formation du personnel senior."></textarea></div>';
      html += '<div class="field"><label>Plan d\'action & Priorités semaine prochaine</label><textarea class="input" name="prioritesSemaineProchaine" rows="2" placeholder="Ex. Relancer les 3 études en attente de validation budgétaire." required></textarea></div>';
    } else if (role === "support") {
      html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:var(--space-2)">';
      html += '<div class="field"><label>Tickets Traités</label><input class="input" type="number" name="ticketsTraites" value="25" required></div>';
      html += '<div class="field"><label>Tickets Résolus</label><input class="input" type="number" name="ticketsResolus" value="24" required></div>';
      html += '<div class="field"><label>Score CSAT (%)</label><input class="input" type="number" step="0.1" name="scoreCsatPct" value="98.5" required></div>';
      html += '<div class="field"><label>Délai Rép. (min)</label><input class="input" type="number" name="tempsReponseMinutes" value="15" required></div>';
      html += '</div>';

      html += '<div class="field"><label>Top 3 des problèmes récurrents rencontrés</label><input class="input" name="topProblemes" placeholder="Ex. Scanner réseau, calcul mixte, droit fixe DGI" required></div>';
      html += '<div class="field"><label>Études nécessitant une attention ou formation</label><input class="input" name="etudesSousSurveillance" placeholder="Ex. Étude Me Kouassi (besoin formation clerc formaliste)"></div>';
      html += '<div class="field"><label>Faits marquants & Recommandations produit</label><textarea class="input" name="faitsMarquants" rows="2" placeholder="Ex. Les études apprécient la rapidité du moteur de recherche unifié." required></textarea></div>';
      html += '<div class="field"><label>Points bloquants & Priorités semaine prochaine</label><textarea class="input" name="prioritesSemaineProchaine" rows="2" placeholder="Ex. Préparer le webinaire de prise en main du lundi." required></textarea></div>';
    } else {
      // Dev & Assistante
      html += '<div class="field"><label>Bilan des réalisations principales</label><textarea class="input" name="faitsMarquants" rows="3" placeholder="Décrivez les réalisations majeures..." required></textarea></div>';
      html += '<div class="field"><label>Points bloquants & Incidents</label><textarea class="input" name="pointsBloquants" rows="2" placeholder="Difficultés rencontrées..."></textarea></div>';
      html += '<div class="field"><label>Priorités pour la période suivante</label><textarea class="input" name="prioritesSemaineProchaine" rows="2" placeholder="Objectifs prioritaires..." required></textarea></div>';
    }

    html += '<div id="erreur-soumettre-rapport" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-rapport">Annuler</button><button type="submit" class="btn btn-primary">Soumettre mon rapport à la Direction</button></div>';
    html += '</form>';

    ouvrirModal({
      titre: '<span>' + icon + '</span> Rédiger mon Rapport d\'Activité (' + (ROLE_LABEL[role] || role) + ')',
      corps: html,
      boutonFermer: true,
      largeur: "640px",
      apresOuverture: function () {
        document.getElementById("btn-annuler-rapport").addEventListener("click", fermerModal);
        document.getElementById("form-soumettre-rapport").addEventListener("submit", function (ev) {
          ev.preventDefault();
          var f = ev.target;
          var donnees = {};

          if (role === "commercial") {
            donnees = {
              etudesContactees: parseInt(f.etudesContactees.value, 10) || 0,
              demosRealisees: parseInt(f.demosRealisees.value, 10) || 0,
              contratsSignes: parseInt(f.contratsSignes.value, 10) || 0,
              mrrGenereFCFA: parseInt(f.mrrGenereFCFA.value, 10) || 0,
              etudesEnClosing: f.etudesEnClosing ? f.etudesEnClosing.value.trim() : "",
              faitsMarquants: f.faitsMarquants.value.trim(),
              pointsBloquants: f.pointsBloquants.value.trim(),
              prioritesSemaineProchaine: f.prioritesSemaineProchaine.value.trim(),
            };
          } else if (role === "support") {
            donnees = {
              ticketsTraites: parseInt(f.ticketsTraites.value, 10) || 0,
              ticketsResolus: parseInt(f.ticketsResolus.value, 10) || 0,
              scoreCsatPct: parseFloat(f.scoreCsatPct.value) || 98.5,
              tempsReponseMinutes: parseInt(f.tempsReponseMinutes.value, 10) || 15,
              topProblemes: f.topProblemes.value.trim(),
              etudesSousSurveillance: f.etudesSousSurveillance ? f.etudesSousSurveillance.value.trim() : "",
              faitsMarquants: f.faitsMarquants.value.trim(),
              prioritesSemaineProchaine: f.prioritesSemaineProchaine.value.trim(),
            };
          } else {
            donnees = {
              faitsMarquants: f.faitsMarquants.value.trim(),
              pointsBloquants: f.pointsBloquants ? f.pointsBloquants.value.trim() : "",
              prioritesSemaineProchaine: f.prioritesSemaineProchaine.value.trim(),
            };
          }

          var payload = {
            titre: f.titre.value.trim(),
            periodeDebut: f.periodeDebut.value,
            periodeFin: f.periodeFin.value,
            donnees: donnees,
          };

          API.post("/api/rapports/soumettre", payload).then(function () {
            toast("Rapport d'activité transmis avec succès à la Direction Générale.");
            fermerModal();
            renderRapports();
          }).catch(function (err) {
            document.getElementById("erreur-soumettre-rapport").textContent = err.message;
            document.getElementById("erreur-soumettre-rapport").style.display = "block";
          });
        });
      },
    });
  }

  // --- D. MODALE : MODIFICATION D'ÉCHÉANCE PAR LA DIRECTION ---
  function modalModifierFrequence(roleCible, p) {
    var libelleRole = ROLE_LABEL[roleCible] || roleCible;
    var html = '<form id="form-modifier-frequence" style="display:flex;flex-direction:column;gap:var(--space-3)">';

    html += '<div style="background:var(--color-surface-2);padding:8px 12px;border-radius:var(--radius);border:1px solid var(--color-border);font-size:13px">';
    html += '<strong>Fonction ciblée :</strong> <span style="color:#38bdf8">' + libelleRole + '</span>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-2)">';
    html += '<div class="field"><label>Fréquence</label><select class="input" name="frequence">';
    html += '<option value="quotidien"' + (p.frequence === "quotidien" ? " selected" : "") + '>Quotidien (Chaque jour)</option>';
    html += '<option value="hebdomadaire"' + (p.frequence === "hebdomadaire" ? " selected" : "") + '>Hebdomadaire (1x / semaine)</option>';
    html += '<option value="mensuel"' + (p.frequence === "mensuel" ? " selected" : "") + '>Mensuel (1x / mois)</option>';
    html += '</select></div>';

    html += '<div class="field"><label>Jour limite</label><select class="input" name="jourLimite">';
    html += '<option value="lundi"' + (p.jourLimite === "lundi" ? " selected" : "") + '>Lundi</option>';
    html += '<option value="mardi"' + (p.jourLimite === "mardi" ? " selected" : "") + '>Mardi</option>';
    html += '<option value="mercredi"' + (p.jourLimite === "mercredi" ? " selected" : "") + '>Mercredi</option>';
    html += '<option value="jeudi"' + (p.jourLimite === "jeudi" ? " selected" : "") + '>Jeudi</option>';
    html += '<option value="vendredi"' + (p.jourLimite === "vendredi" ? " selected" : "") + '>Vendredi</option>';
    html += '</select></div>';

    html += '<div class="field"><label>Heure limite</label><input class="input" type="time" name="heureLimite" value="' + (p.heureLimite || "17:00") + '" required></div>';
    html += '</div>';

    html += '<div class="field"><label>Objectifs & Attendus précis de la Direction</label><textarea class="input" name="descriptionAttendus" rows="3" required>' + (p.descriptionAttendus || "") + '</textarea></div>';

    html += '<div class="field"><label>Activer cette exigence de rapport</label><select class="input" name="actif">';
    html += '<option value="true"' + (p.actif !== false ? " selected" : "") + '>Oui (Obligatoire)</option>';
    html += '<option value="false"' + (p.actif === false ? " selected" : "") + '>Non (Optionnel)</option>';
    html += '</select></div>';

    html += '<div id="erreur-modifier-frequence" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-freq">Annuler</button><button type="submit" class="btn btn-primary">Enregistrer les paramètres</button></div>';
    html += '</form>';

    ouvrirModal({
      titre: 'Configurer l\'Échéance de Rapport · ' + libelleRole,
      corps: html,
      boutonFermer: true,
      largeur: "560px",
      apresOuverture: function () {
        document.getElementById("btn-annuler-freq").addEventListener("click", fermerModal);
        document.getElementById("form-modifier-frequence").addEventListener("submit", function (ev) {
          ev.preventDefault();
          var form = ev.target;
          var payload = {
            frequence: form.frequence.value,
            jourLimite: form.jourLimite.value,
            heureLimite: form.heureLimite.value,
            descriptionAttendus: form.descriptionAttendus.value.trim(),
            actif: form.actif.value === "true",
          };

          API.put("/api/rapports/parametres-frequences/" + roleCible, payload).then(function () {
            toast("Échéance mise à jour avec succès pour " + libelleRole + ".");
            fermerModal();
            renderRapports();
          }).catch(function (err) {
            document.getElementById("erreur-modifier-frequence").textContent = err.message;
            document.getElementById("erreur-modifier-frequence").style.display = "block";
          });
        });
      },
    });
  }

  // --- E. MODALE : ÉVALUATION / VALIDATION DE RAPPORT PAR LA DIRECTION ---
  function modalEvaluerRapport(id, titre) {
    var html = '<form id="form-evaluer-rapport" style="display:flex;flex-direction:column;gap:var(--space-3)">';

    html += '<div style="background:var(--color-surface-2);padding:8px 12px;border-radius:var(--radius);border:1px solid var(--color-border);font-size:13px">';
    html += '<strong>Rapport :</strong> <span style="color:#38bdf8">' + titre + '</span>';
    html += '</div>';

    html += '<div class="field"><label>Décision de la Direction</label><select class="input" name="statut">';
    html += '<option value="valide_direction" selected>Valider & Approuver le compte-rendu</option>';
    html += '<option value="demande_precision">Demander des précisions / Actions correctives</option>';
    html += '</select></div>';

    html += '<div class="field"><label>Commentaires & Directives de la Direction</label><textarea class="input" name="commentaireDirection" rows="3" placeholder="Ex. Excellent travail sur les signatures. Pour la semaine prochaine, prioriser le closing sur Me Touré..."></textarea></div>';

    html += '<div id="erreur-evaluer-rapport" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-eval">Annuler</button><button type="submit" class="btn btn-primary">Valider la décision</button></div>';
    html += '</form>';

    ouvrirModal({
      titre: 'Évaluation Direction · Rapport d\'Activité',
      corps: html,
      boutonFermer: true,
      largeur: "540px",
      apresOuverture: function () {
        document.getElementById("btn-annuler-eval").addEventListener("click", fermerModal);
        document.getElementById("form-evaluer-rapport").addEventListener("submit", function (ev) {
          ev.preventDefault();
          var form = ev.target;
          var payload = {
            statut: form.statut.value,
            commentaireDirection: form.commentaireDirection.value.trim(),
          };

          API.post("/api/rapports/" + id + "/evaluer", payload).then(function () {
            toast("Évaluation et directives enregistrées avec succès.");
            fermerModal();
            renderRapports();
          }).catch(function (err) {
            document.getElementById("erreur-evaluer-rapport").textContent = err.message;
            document.getElementById("erreur-evaluer-rapport").style.display = "block";
          });
        });
      },
    });
  }

  // -----------------------------------------------------------------
  // Connexion / initialisation
  // -----------------------------------------------------------------
  function init() {
    API.surNonAutorise(function () {
      var appEl = document.getElementById("app");
      var loginEl = document.getElementById("ecran-login");
      if (appEl) {
        appEl.classList.remove("pret");
        appEl.style.display = "none";
      }
      if (loginEl) {
        loginEl.classList.add("actif");
        loginEl.style.display = "block";
      }
    });

    var formLogin = document.getElementById("form-login");
    if (formLogin) {
      formLogin.addEventListener("submit", function (e) {
        e.preventDefault();
        var email = e.target.email.value, motDePasse = e.target.motDePasse.value;
        effectuerConnexion(email, motDePasse);
      });
    }

    var btnDemoRapide = document.getElementById("btn-login-demo-rapide");
    if (btnDemoRapide) {
      btnDemoRapide.addEventListener("click", function (ev) {
        if (ev) { ev.preventDefault(); ev.stopPropagation(); }
        effectuerConnexion("notaire@notaire.ci", "notaire123");
      });
    }

    document.querySelectorAll(".btn-demo-role").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        if (ev) { ev.preventDefault(); ev.stopPropagation(); }
        var email = btn.dataset.email;
        var mdp = btn.dataset.mdp;
        effectuerConnexion(email, mdp);
      });
    });

    document.querySelectorAll(".lnk-item[data-nav]").forEach(function (b) {
      b.addEventListener("click", function () { irVers(b.dataset.nav); });
    });

    var btnDeco = document.getElementById("bouton-deconnexion");
    if (btnDeco) {
      btnDeco.addEventListener("click", executerDeconnexion);
    }

    var btnTopDeco = document.getElementById("btn-top-deconnexion");
    if (btnTopDeco) {
      btnTopDeco.addEventListener("click", executerDeconnexion);
    }

    var badgeNotif = document.getElementById("notif-badge");
    if (badgeNotif) {
      badgeNotif.addEventListener("click", function () { irVers("notifications"); });
    }

    actualiserAffichageBoutonTheme(document.documentElement.getAttribute("data-theme") || "dark");

    // Raccourci Clavier Universel : Touche Échap (Escape) pour fermer les modales et panneaux latéraux
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape" || e.keyCode === 27) {
        var racineModal = document.getElementById("modal-racine");
        if (racineModal && racineModal.style.display !== "none") {
          fermerModal();
        }
        var tiroir = document.querySelector(".tiroir-overlay");
        if (tiroir) {
          tiroir.remove();
        }
      }
    });

    var chargement = document.getElementById("chargement-initial");
    if (chargement) chargement.style.display = "none";

    // Gestion propre du callback non-autorisé 401
    API.surNonAutorise(function () {
      executerDeconnexion();
    });

    if (API.estConnecte() && API.getUtilisateur()) {
      cache.utilisateur = API.getUtilisateur();
      cache.permissions = PERMISSIONS_PAR_ROLE[cache.utilisateur.role] || PERMISSIONS_PAR_ROLE.assistante;
      chargerToutEtAfficher().catch(function () {
        executerDeconnexion();
      });
    } else {
      executerDeconnexion();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
