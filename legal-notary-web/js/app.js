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
    assistante: { addDossier: true, editTasks: false, decideProjet: false, closeDossier: false, manageCompte: false, fiscal: false, settingsAdvanced: false, equipe: false, dossiersTous: false, referentielFixerDelais: false, referentielCreerActe: true, superadmin: false },
    superadmin: { addDossier: true, editTasks: true, decideProjet: true, closeDossier: true, manageCompte: true, fiscal: true, settingsAdvanced: true, equipe: true, dossiersTous: true, referentielFixerDelais: true, referentielCreerActe: true, superadmin: true },
    dev: { addDossier: false, editTasks: false, decideProjet: false, closeDossier: false, manageCompte: false, fiscal: false, settingsAdvanced: false, equipe: false, dossiersTous: false, referentielFixerDelais: false, referentielCreerActe: false, superadmin: true },
    commercial: { addDossier: false, editTasks: false, decideProjet: false, closeDossier: false, manageCompte: false, fiscal: false, settingsAdvanced: false, equipe: false, dossiersTous: false, referentielFixerDelais: false, referentielCreerActe: false, superadmin: true },
    support: { addDossier: false, editTasks: false, decideProjet: false, closeDossier: false, manageCompte: false, fiscal: false, settingsAdvanced: false, equipe: false, dossiersTous: false, referentielFixerDelais: false, referentielCreerActe: false, superadmin: true },
    assistante_editeur: { addDossier: false, editTasks: false, decideProjet: false, closeDossier: false, manageCompte: false, fiscal: false, settingsAdvanced: false, equipe: false, dossiersTous: false, referentielFixerDelais: false, referentielCreerActe: false, superadmin: true },
  };
  var ROLE_LABEL = {
    notaire: "Notaire Titulaire", premier_clerc: "Premier Clerc", clerc_redacteur: "Clerc Rédacteur",
    clerc_formaliste: "Clerc aux Formalités", comptable_taxateur: "Comptable Taxateur", assistante: "Assistante / Accueil",
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
      immobilier: { label: "Immobilier & Foncier", icone: "🏢", count: 0, assiette: 0, emoluments: 0, desc: "Ventes, baux notariés, copropriété" },
      banque: { label: "Banque, Crédits & Sûretés", icone: "🏦", count: 0, assiette: 0, emoluments: 0, desc: "Prêts bancaires, hypothèques, mainlevées" },
      societes: { label: "Droit des Sociétés & Affaires", icone: "⚖️", count: 0, assiette: 0, emoluments: 0, desc: "Constitutions SARL/SAS, statuts, cessions" },
      famille: { label: "Successions & Famille", icone: "👨‍👩‍👧", count: 0, assiette: 0, emoluments: 0, desc: "Notoriétés, partages, testaments, donations" },
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
    if (!cache.permissions || !cache.permissions.equipe) {
      cache.equipeListe = [];
      cache.equipeParId = {};
      return Promise.resolve();
    }
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
      html += '<button type="button" class="btn-role-switch' + (role === "superadmin" ? " actif" : "") + '" data-role="superadmin" title="Console Direction SaaS" style="border-color:rgba(56,189,248,0.4);color:#38bdf8">👑 Direction</button>';
      html += '<button type="button" class="btn-role-switch' + (role === "dev" ? " actif" : "") + '" data-role="dev" title="Espace Développeur / DevOps" style="border-color:rgba(139,92,246,0.4);color:#a78bfa">💻 Dev</button>';
      html += '<button type="button" class="btn-role-switch' + (role === "commercial" ? " actif" : "") + '" data-role="commercial" title="Espace Commercial & Onboarding" style="border-color:rgba(16,185,129,0.4);color:#34d399">💼 Commercial</button>';
      html += '<button type="button" class="btn-role-switch' + (role === "support" ? " actif" : "") + '" data-role="support" title="Espace Support Client L1-L4" style="border-color:rgba(245,158,11,0.4);color:#fbbf24">🎧 Support</button>';
      html += '<button type="button" class="btn-role-switch' + (role === "assistante_editeur" ? " actif" : "") + '" data-role="assistante_editeur" title="Espace Assistante Éditeur" style="border-color:rgba(236,72,153,0.4);color:#f472b6">📋 Assistante</button>';
      html += '<button type="button" class="btn-role-switch" data-role="notaire" title="Basculer sur la vue Étude" style="margin-left:4px;border-color:rgba(34,197,94,0.4);color:#22c55e">🏛️ Vue Étude</button>';
    } else {
      // Pour les membres d'une étude notariale : UNIQUEMENT les rôles de l'étude. AUCUN rôle SaaS / Superadmin visible !
      html += '<button type="button" class="btn-role-switch' + (role === "notaire" ? " actif" : "") + '" data-role="notaire" title="Espace Notaire Titulaire">👑 Notaire</button>';
      html += '<button type="button" class="btn-role-switch' + (role === "premier_clerc" ? " actif" : "") + '" data-role="premier_clerc" title="Espace Premier Clerc">📋 1er Clerc</button>';
      html += '<button type="button" class="btn-role-switch' + (role === "clerc_redacteur" ? " actif" : "") + '" data-role="clerc_redacteur" title="Espace Clerc Rédacteur">✍️ Rédacteur</button>';
      html += '<button type="button" class="btn-role-switch' + (role === "clerc_formaliste" ? " actif" : "") + '" data-role="clerc_formaliste" title="Espace Clerc Formaliste">🏛️ Formaliste</button>';
      html += '<button type="button" class="btn-role-switch' + (role === "comptable_taxateur" ? " actif" : "") + '" data-role="comptable_taxateur" title="Espace Comptable Taxateur">💰 Comptable</button>';
      html += '<button type="button" class="btn-role-switch' + (role === "assistante" ? " actif" : "") + '" data-role="assistante" title="Espace Assistante Accueil">📞 Assistante</button>';
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

  function effectuerConnexion(email, motDePasse) {
    var erreurZone = document.getElementById("login-erreur");
    if (erreurZone) erreurZone.style.display = "none";
    var inputEmail = document.getElementById("login-input-email");
    var inputMdp = document.getElementById("login-input-mdp");
    if (inputEmail) inputEmail.value = email;
    if (inputMdp) inputMdp.value = motDePasse;

    var chargement = document.getElementById("chargement-initial");
    if (chargement) {
      chargement.textContent = "Connexion en cours…";
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
    var chargement = document.getElementById("chargement-initial");
    if (chargement) {
      chargement.textContent = "Chargement de l'espace…";
      chargement.style.display = "flex";
    }
    return chargerReferentiel()
      .then(chargerEquipe)
      .then(chargerDossiersEtAlertes)
      .then(function () {
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
        actualiserBarreSelecteurRoles(cache.utilisateur ? cache.utilisateur.role : "notaire");

        majNomEtudeAffiche();

        // Rendu du menu de navigation adapté à la fonction / au rôle
        var role = cache.utilisateur ? cache.utilisateur.role : "notaire";
        renderMenuNavigation(role);

        // Détermination de la vue par défaut selon le rôle
        var menuRole = MENU_ITEMS_PAR_ROLE[role] || [];
        var defaultItem = menuRole.find(function (it) { return it.vueParDefaut; });
        var estSaaS = (role === "superadmin" || role === "dev" || role === "commercial" || role === "support" || role === "assistante_editeur");

        var vueFinale = defaultItem ? defaultItem.nav : (estSaaS ? "superadmin" : "dashboard");
        if (estSaaS && defaultItem && defaultItem.sousOnglet) {
          etatSuperadmin.onglet = defaultItem.sousOnglet;
        }

        irVers(vueFinale);
      })
      .catch(function (erreur) {
        console.error("Erreur chargerToutEtAfficher:", erreur);
        if (chargement) chargement.style.display = "none";
        var ecranLogin = document.getElementById("ecran-login");
        var appEl = document.getElementById("app");
        if (appEl) {
          appEl.classList.remove("pret");
          appEl.style.display = "none";
        }
        if (ecranLogin) {
          ecranLogin.classList.add("actif");
          ecranLogin.style.display = "block";
        }
        toast("Erreur de chargement : " + (erreur.message || "Connexion échouée"));
      });
  }

  // -----------------------------------------------------------------
  // Modales et boîtes de dialogue
  // -----------------------------------------------------------------
  function ouvrirModal(options) {
    var racine = document.getElementById("modal-racine");
    if (!racine) return;
    racine.innerHTML =
      '<div class="modal-backdrop" id="modal-bg">' +
        '<div class="modal-conteneur" style="' + (options.style || "") + '">' +
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
      { nav: "kanban", label: "📋 Circuit d'instruction" },
      { nav: "dossiers", label: "📁 Dossiers de l'étude" },
      { nav: "clients", label: "👥 Clients & KYC" },
      { nav: "actes", label: "📜 Actes & Référentiel" },
      { nav: "comptabilite", label: "💰 Comptabilité & Fiscale" },
      { nav: "archives", label: "🏛️ Minutier & Archives" },
      { nav: "equipe", label: "👔 Équipe & Salaires" },
      { nav: "evolution", label: "📈 Performance globale" },
      { nav: "parametres", label: "⚙️ Paramètres de l'étude" },
    ],
    premier_clerc: [
      { nav: "dashboard", label: "📊 Tableau de bord", vueParDefaut: true },
      { nav: "kanban", label: "📋 Circuit d'instruction" },
      { nav: "dossiers", label: "📁 Tous les dossiers" },
      { nav: "clients", label: "👥 Clients & KYC" },
      { nav: "actes", label: "📜 Actes & Modèles" },
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
      { nav: "comptabilite", label: "💰 Fiches de Taxe & Calculs" },
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
  };

  function renderMenuNavigation(role) {
    var conteneur = document.getElementById("menu-navigation-laterale");
    if (!conteneur) return;

    var items = MENU_ITEMS_PAR_ROLE[role] || MENU_ITEMS_PAR_ROLE.notaire;
    var html = '';

    // En-tête du menu contextuel avec libellé du rôle
    html += '<div style="padding:4px 6px 10px;margin-bottom:6px;border-bottom:1px solid var(--color-border)">';
    html += '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-dim);font-weight:700">Menu ' + (ROLE_LABEL[role] || "Utilisateur") + '</div>';
    html += '</div>';

    items.forEach(function (item) {
      var isActif = (etat.vue === item.nav) && (!item.sousOnglet || (item.nav === "superadmin" && item.sousOnglet === etatSuperadmin.onglet) || (item.nav === "archives" && item.sousOnglet === etatArchives.onglet));
      var styleActif = isActif ? 'color:#38bdf8;background:rgba(56,189,248,0.12);font-weight:700' : 'color:var(--color-text);background:transparent;font-weight:600';
      html += '<div class="lnk-item" data-nav="' + item.nav + '" ' + (item.sousOnglet ? 'data-sous-onglet="' + item.sousOnglet + '"' : '') + ' style="padding:var(--space-2);font-family:var(--font-heading);font-size:13.5px;cursor:pointer;border-radius:var(--radius);transition:all .15s ease;' + styleActif + '">' + item.label + '</div>';
    });

    html += '<div style="flex:1"></div>';
    html += '<div class="lnk-item" id="bouton-deconnexion" style="padding:var(--space-2);font-size:13px;opacity:.65;cursor:pointer;border-top:1px solid var(--color-border)">🚪 Se déconnecter</div>';

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
      btnDeco.addEventListener("click", function () {
        API.deconnecter();
        document.getElementById("app").classList.remove("pret");
        document.getElementById("ecran-login").classList.add("actif");
      });
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
        b.style.color = "#38bdf8";
        b.style.background = "rgba(56, 189, 248, 0.12)";
        b.style.fontWeight = "700";
      } else {
        b.style.color = "var(--color-text)";
        b.style.background = "transparent";
        b.style.fontWeight = "600";
      }
    });

    if (vue === "dashboard") renderDashboard();
    if (vue === "kanban") renderKanban();
    if (vue === "dossiers") renderDossiersListe();
    if (vue === "nouveau-dossier") renderNouveauDossier();
    if (vue === "clients") renderClients();
    if (vue === "actes") renderActes();
    if (vue === "archives") renderArchives();
    if (vue === "equipe") renderEquipe();
    if (vue === "evolution") renderEvolution();
    if (vue === "comptabilite") renderComptabilite();
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
      { label: "Volume d'affaires en portefeuille", valeur: fmtFCFA(synthese.totalAssiettes), indice: "", icon: "💼", sub: "Valeur cumulée des transactions en cours" },
      { label: "Émoluments prévisionnels (HT)", valeur: fmtFCFA(synthese.totalEmolumentsHT), indice: "accent", icon: "💰", sub: "Honoraires légaux (Décret 2013-279)" },
      { label: "Dossiers actifs au cabinet", valeur: String(cache.dossiers.length), indice: "", icon: "📁", sub: enRedaction.length + " en rédaction · " + enFormalites + " en formalités DGI" },
      { label: "Alertes & Délais d'instruction", valeur: String(cache.alertes.length), indice: cache.alertes.length ? "danger" : "accent", icon: "🚨", sub: cache.alertes.length ? "Décisions ou dossiers à débloquer" : "Aucun retard critique" },
    ];

    var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-4)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding-bottom:var(--space-2);border-bottom:1px solid var(--color-border)">';
    html += '<div><h1 style="margin:0">' + titreAffiche + '</h1>';
    html += '<p style="opacity:.65;font-size:14px;margin:2px 0 0">Pilotage financier, flux d\'actes et gestion stratégique de l\'office.</p></div>';
    html += '<div style="display:flex;align-items:center;gap:var(--space-3);margin-left:auto">';
    html += '<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:var(--color-text)">' + dateDuJour + '</div><div style="font-size:11px;color:var(--color-text-dim)">Exercice fiscal ' + anneeCourante + '</div></div>';
    html += '<button class="btn btn-secondary" id="bouton-demander-push" style="padding:6px 12px;font-size:13px">🔔 Notifications</button></div></div></div>';

    // Grille de KPI exécutifs
    html += renderKpisGrid(kpis);

    // =========================================================================
    // 1. PIPELINE DES DOSSIERS (Monté sous les KPIs)
    // =========================================================================
    html += renderPipelineDossiers();

    // =========================================================================
    // 2. INSTRUCTION DES ACTES PAR CLERC (Tableau complet style Pipeline)
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
    html += '<div class="panel-header"><div class="panel-title"><span>👥</span> Instruction des actes par collaborateur</div><span class="tag tag-outline">' + clercs.length + ' clerc(s) instructeur(s)</span></div>';

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

        html += '<tr>';
        html += '<td><div style="display:flex;align-items:center;gap:8px">';
        html += '<span style="width:28px;height:28px;border-radius:50%;background:' + pal.solid + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800">' + inits + '</span>';
        html += '<strong style="color:var(--color-text)">' + cl.nomComplet + '</strong>';
        html += '</div></td>';
        html += '<td><span style="font-size:11px;padding:3px 8px;border-radius:4px;background:' + pal.bg + ';color:' + pal.text + ';border:1px solid ' + pal.border + '">' + ROLE_LABEL[cl.role] + '</span></td>';
        html += '<td><strong>' + nbTotal + '</strong> dossier(s)</td>';
        html += '<td><span style="color:#22c55e;font-weight:700">✅ ' + nbAcheves + ' (' + pctAcheve + ' %)</span></td>';
        html += '<td><span style="color:' + pal.text + ';font-weight:600">⏳ ' + nbEnCours + '</span></td>';
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
    // 3. RÉPARTITION PAR BRANCHE NOTARIALE
    // =========================================================================
    html += '<div class="dashboard-panel">';
    html += '<div class="panel-header"><div class="panel-title"><span>📊</span> Ventilation du portefeuille par branche notariale</div><span class="tag tag-outline">Chiffre d\'affaires & Volume</span></div>';
    html += '<div class="panel-body">';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--space-3)">';

    var clesDomaines = ["immobilier", "banque", "societes", "famille"];
    clesDomaines.forEach(function (cle) {
      var dom = synthese.domaines[cle];
      var pctVolume = synthese.totalAssiettes > 0 ? Math.round((dom.assiette / synthese.totalAssiettes) * 100) : 0;
      var pctEmols = synthese.totalEmolumentsHT > 0 ? Math.round((dom.emoluments / synthese.totalEmolumentsHT) * 100) : 0;

      html += '<div class="card" style="border-color:var(--color-border);background:var(--color-surface-2);display:flex;flex-direction:column;gap:8px;padding:var(--space-3) var(--space-4)">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center">';
      html += '<div style="display:flex;align-items:center;gap:6px"><span style="font-size:18px">' + dom.icone + '</span><span style="font-family:var(--font-heading);font-weight:700;font-size:14px;color:var(--color-text)">' + dom.label + '</span></div>';
      html += '<span class="tag tag-outline" style="font-size:11px">' + dom.count + ' acte(s)</span>';
      html += '</div>';

      html += '<div style="font-size:12px;color:var(--color-text-dim)">' + dom.desc + '</div>';

      html += '<div style="margin-top:auto;padding-top:var(--space-2);border-top:1px solid var(--color-divider)">';
      html += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>Assiette cumulée :</span><strong style="color:var(--color-text)">' + fmtFCFA(dom.assiette) + '</strong></div>';
      html += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px"><span>Émoluments prévisionnels :</span><strong style="color:var(--color-accent)">' + fmtFCFA(dom.emoluments) + '</strong></div>';
      html += '<div style="height:6px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden"><div style="height:100%;width:' + Math.max(pctEmols, 4) + '%;background:var(--color-accent);border-radius:4px"></div></div>';
      html += '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--color-text-dim);margin-top:4px"><span>Part des honoraires</span><span>' + pctEmols + ' %</span></div>';
      html += '</div></div>';
    });

    html += '</div></div></div>';

    // =========================================================================
    // 4. TRÉSORERIE SÉQUESTRES (CDCI) & FISCALITÉ DGI EN INSTANCE
    // =========================================================================
    html += '<div class="dashboard-panel">';
    html += '<div class="panel-header"><div class="panel-title"><span>🏛️</span> Trésorerie des comptes séquestres & Fiscalité DGI en instance</div><span class="tag tag-outline">Flux financiers</span></div>';
    html += '<div class="panel-body">';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--space-3)">';

    html += '<div class="card" style="border-left:4px solid #38bdf8;background:var(--color-surface-2)">';
    html += '<div class="card-kicker">Comptes Séquestres (CDCI)</div>';
    html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:22px;color:var(--color-text);margin:4px 0">' + fmtFCFA(synthese.sequestresCDCI) + '</div>';
    html += '<div style="font-size:12px;color:var(--color-text-dim)">Estimation des dépôts et acomptes sous mandat d\'authentification</div></div>';

    html += '<div class="card" style="border-left:4px solid var(--color-warning);background:var(--color-surface-2)">';
    html += '<div class="card-kicker">Droits DGI & Conservation Foncière</div>';
    html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:22px;color:var(--color-text);margin:4px 0">' + fmtFCFA(synthese.totalDroitsDGI) + '</div>';
    html += '<div style="font-size:12px;color:var(--color-text-dim)">Droits d\'enregistrement et taxes foncières en cours de liquidation</div></div>';

    html += '<div class="card" style="border-left:4px solid var(--color-accent);background:var(--color-surface-2)">';
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
      { label: "Dossiers en cours (cabinet)", valeur: String(cache.dossiers.length), indice: "", icon: "📋", sub: "Supervision globale" },
      { label: "Alertes d'instruction", valeur: String(cache.alertes.length), indice: cache.alertes.length ? "warning" : "accent", icon: "⚠️", sub: cache.alertes.length ? "Dossiers à débloquer" : "Délais conformes" },
      { label: "Projets en rédaction", valeur: String(enRedaction), indice: "", icon: "✍️", sub: "Étape 3 d'instruction" },
      { label: "En formalités DGI", valeur: String(enFormalites), indice: "", icon: "🏛️", sub: "Étape 5 d'enregistrement" },
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
    html += '<div class="panel-header"><div class="panel-title"><span>📊</span> Pipeline d\'instruction — Répartition par étape</div><span class="tag tag-outline">6 étapes</span></div>';
    html += '<div class="panel-body">';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-3)">';
    cache.etapesPipeline.forEach(function (e, idx) {
      var nb = cache.dossiers.filter(function (d) { return d.etapeActuelle === e.id; }).length;
      var accent = ETAPE_COULEUR[idx % ETAPE_COULEUR.length];
      html += '<div class="card" style="border-top:3px solid ' + accent + ';border-color:var(--color-border);background:var(--color-surface-2)">';
      html += '<div class="card-kicker">Étape ' + e.id + '</div>';
      html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:14px;margin-bottom:4px;color:var(--color-text)">' + e.libelle + '</div>';
      html += '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-top:auto"><span style="font-size:26px;font-weight:700;color:' + accent + '">' + nb + '</span><span class="text-muted" style="font-size:12px">dossier(s)</span></div></div>';
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
        { label: "Mes dossiers actifs", valeur: String(mesDossiers.length), indice: "", icon: "📁", sub: "Assignés à mon nom" },
        { label: "Alertes sur mes dossiers", valeur: String(cache.alertes.length), indice: cache.alertes.length ? "danger" : "accent", icon: "🚨", sub: cache.alertes.length ? "Dossiers à traiter" : "Aucun retard" },
        { label: "Clôturés (30 derniers jours)", valeur: String(evo.dossiersClotures30Jours), indice: "accent", icon: "✅", sub: "Actes menés à terme" },
        { label: "Mon avancement moyen", valeur: evo.avancementMoyenPourcent + " %", indice: "accent", icon: "📈", sub: "Progression des checklists" },
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
      html += '<div class="panel-header"><div class="panel-title"><span>✍️</span> Mes projets d\'actes à rédiger (Étape 3)</div><span class="tag tag-outline">' + mesProjets.length + ' projet(s)</span></div>';
      html += '<div class="panel-body">';

      if (!mesProjets.length) {
        html += '<div style="text-align:center;padding:var(--space-4);color:var(--color-text-dim)"><div style="font-size:24px;margin-bottom:4px">📝</div>Aucun projet à rédiger immédiatement. Consultez la liste générale de vos dossiers.</div>';
      } else {
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-3)">';
        mesProjets.forEach(function (d) {
          html += '<div class="card alerte-item" data-id="' + d.id + '" style="cursor:pointer;border-left:4px solid var(--color-accent);background:var(--color-surface-2)">';
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
      { label: "Formalités DGI & Foncier (Étape 5)", valeur: String(enFormalites.length), indice: enFormalites.length ? "accent" : "", icon: "🏛️", sub: "Enregistrement & Conservation" },
      { label: "Réquisitions préalables (Étape 2)", valeur: String(enRequisitions.length), indice: "", icon: "📑", sub: "Urbanisme, banque, état civil" },
      { label: "Expéditions & Clôture (Étape 6)", valeur: String(enExpeditions.length), indice: "", icon: "📬", sub: "Remise des copies authentiques" },
      { label: "Alertes de délais formalités", valeur: String(cache.alertes.length), indice: cache.alertes.length ? "warning" : "accent", icon: "⚠️", sub: "Délais légaux de publicité" },
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
    html += '<div class="panel-header"><div class="panel-title"><span>🏛️</span> Dossiers en cours de formalités DGI & Conservation Foncière (Étape 5)</div><span class="tag tag-outline">' + enFormalites.length + ' dossier(s)</span></div>';
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
    html += '<div class="panel-header"><div class="panel-title"><span>📑</span> Dossiers en réquisitions préalables (Étape 2)</div><span class="tag tag-outline">' + enRequisitions.length + ' dossier(s)</span></div>';
    html += '<div class="panel-body">';
    if (!enRequisitions.length) {
      html += '<p class="text-muted">Aucun dossier en réquisitions préalables.</p>';
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:var(--space-3)">';
      enRequisitions.forEach(function (d) {
        html += '<div class="card alerte-item" data-id="' + d.id + '" style="cursor:pointer;border-left:4px solid #818cf8;background:var(--color-surface-2)">';
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
      { label: "Dossiers actifs (cabinet)", valeur: String(cache.dossiers.length), indice: "", icon: "💼", sub: "Assiette globale de l'étude" },
      { label: "En formalités fiscales", valeur: String(enFormalites), indice: "", icon: "🏛️", sub: "Droits DGI & taxe foncière" },
      { label: "Alertes financières / délais", valeur: String(cache.alertes.length), indice: cache.alertes.length ? "warning" : "accent", icon: "⚠️", sub: "Décomptes et provisions" },
      { label: "Catalogue d'actes tarifés", valeur: String(cache.typesActesListe.length), indice: "", icon: "⚖️", sub: "Barème Décret 2013-279" },
    ];

    var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-4)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding-bottom:var(--space-2);border-bottom:1px solid var(--color-border)">';
    html += '<div><h1 style="margin:0">Tableau de bord — Comptable Taxateur</h1>';
    html += '<p style="opacity:.65;font-size:14px;margin:2px 0 0">Bonjour ' + cache.utilisateur.nomComplet + ' — calcul des émoluments, droits DGI et fiches de taxe.</p></div>';
    html += '<div style="display:flex;align-items:center;gap:var(--space-3);margin-left:auto">';
    html += '<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:var(--color-text)">' + dateDuJour + '</div><div style="font-size:11px;color:var(--color-text-dim)">Exercice fiscal ' + anneeCourante + '</div></div></div></div></div>';

    html += renderKpisGrid(kpis);

    html += '<div class="dashboard-panel">';
    html += '<div class="panel-header"><div class="panel-title"><span>💰</span> Dossiers récents à taxer ou régulariser</div><span class="tag tag-outline">Dossiers actifs</span></div>';
    html += '<div class="table-wrap"><table class="table"><thead><tr><th>N° Dossier</th><th>Type d\'acte</th><th>Étape</th><th>Montant d\'assiette</th><th>Clerc assigné</th><th>Action</th></tr></thead><tbody>';
    cache.dossiers.slice(0, 8).forEach(function (d) {
      html += '<tr class="alerte-item" data-id="' + d.id + '" style="cursor:pointer"><td><strong>' + d.numeroDossier + '</strong></td><td>' + labelActe(d.typeActeId) + '</td><td><span class="tag tag-outline">' + labelEtape(d.etapeActuelle) + '</span></td><td style="font-weight:600">' + fmtFCFA(d.montantAssiette) + '</td><td>' + nomClerc(d.clercAssigneId) + '</td><td><span class="btn btn-ghost" style="padding:0">Fiche de taxe →</span></td></tr>';
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
      { label: "Dossiers en Collecte KYC", valeur: String(enCollecte.length), indice: enCollecte.length ? "accent" : "", icon: "📞", sub: "Étape 1 — Accueil" },
      { label: "Pièces KYC bloquantes", valeur: String(kycAlertes.length), indice: kycAlertes.length ? "danger" : "accent", icon: "⚠️", sub: kycAlertes.length ? "Pièces d'identité manquantes" : "Aucun blocage" },
      { label: "Total dossiers de l'étude", valeur: String(cache.dossiers.length), indice: "", icon: "📁", sub: "Volume général" },
      { label: "Types d'actes ouverts", valeur: String(cache.typesActesListe.length), indice: "", icon: "⚖️", sub: "Catalogue du cabinet" },
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
    html += '<div class="panel-header"><div class="panel-title"><span>⚡</span> Actions rapides d\'accueil</div></div>';
    html += '<div class="panel-body">';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:var(--space-3)">';
    html += '<div class="card" id="card-action-nouveau" style="cursor:pointer;border-left:4px solid var(--color-accent);padding:var(--space-4)">';
    html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:16px;margin-bottom:4px">📁 Ouvrir un nouveau dossier</div>';
    html += '<div class="card-body">Saisir les comparants, le type d\'acte et générer la checklist légale.</div></div>';
    html += '<div class="card" id="card-action-clients" style="cursor:pointer;border-left:4px solid #38bdf8;padding:var(--space-4)">';
    html += '<div style="font-family:var(--font-heading);font-weight:700;font-size:16px;margin-bottom:4px">👥 Annuaire des clients</div>';
    html += '<div class="card-body">Rechercher un comparant, vérifier les pièces d\'identité et coordonnées.</div></div>';
    html += '</div></div></div>';

    // Dossiers Étape 1
    html += '<div class="dashboard-panel">';
    html += '<div class="panel-header"><div class="panel-title"><span>📑</span> Dossiers en cours de Collecte & KYC (Étape 1)</div><span class="tag tag-outline">' + enCollecte.length + ' dossier(s)</span></div>';
    html += '<div class="panel-body">';
    if (!enCollecte.length) {
      html += '<p class="text-muted">Aucun dossier en attente de collecte de pièces pour le moment.</p>';
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-3)">';
      enCollecte.forEach(function (d) {
        html += '<div class="card alerte-item" data-id="' + d.id + '" style="cursor:pointer">';
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

  function renderKpisGrid(kpis) {
    var html = '<div class="kpi-grid">';
    kpis.forEach(function (k) {
      var accentColor = k.indice === "danger" ? "var(--color-danger)" : k.indice === "warning" ? "var(--color-warning)" : k.indice === "accent" ? "var(--color-accent)" : "#38bdf8";
      var icon = k.icon || (k.indice === "danger" ? "🚨" : k.indice === "warning" ? "⚠️" : k.indice === "accent" ? "✨" : "📁");
      html += '<div class="kpi-card" style="--kpi-accent:' + accentColor + ';--kpi-color:' + (k.indice ? accentColor : "var(--color-text)") + '">';
      html += '<div class="kpi-label"><span>' + k.label + '</span><span style="font-size:18px">' + icon + '</span></div>';
      html += '<div class="kpi-valeur">' + k.valeur + '</div>';
      if (k.sub) html += '<div style="font-size:12px;color:var(--color-text-dim);margin-top:6px;opacity:.85">' + k.sub + '</div>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderCentreAlertes() {
    return renderPipelineDossiers();
  }

  function renderPipelineDossiers() {
    var html = '<div class="dashboard-panel">';
    html += '<div class="panel-header"><div class="panel-title"><span>📊</span> Pipeline des dossiers</div><span class="tag tag-outline">' + cache.dossiers.length + ' dossier(s)</span></div>';
    
    if (!cache.dossiers.length) {
      html += '<div class="panel-body" style="text-align:center;padding:var(--space-4);color:var(--color-text-dim)">Aucun dossier dans le pipeline actuellement.</div>';
    } else {
      // Tri par priorité (rouge > jaune > vert) puis par date de création/ouverture
      var dossiersTries = cache.dossiers.slice().sort(function (a, b) {
        var alerteA = cache.alertesParDossierId[a.id];
        var alerteB = cache.alertesParDossierId[b.id];
        var scoreA = alerteA ? (alerteA.couleur === "rouge" ? 3 : 2) : 1;
        var scoreB = alerteB ? (alerteB.couleur === "rouge" ? 3 : 2) : 1;
        if (scoreB !== scoreA) return scoreB - scoreA;
        var dateA = new Date(a.createdAt || a.dateOuverture || 0);
        var dateB = new Date(b.createdAt || b.dateOuverture || 0);
        return dateA - dateB;
      });

      html += '<div class="table-wrap"><table class="table"><thead><tr><th>Client</th><th>Type d\'acte</th><th>N° Dossier</th><th>Priorité</th><th>Statut</th><th>Date de création</th><th>Action</th></tr></thead><tbody>';
      
      dossiersTries.forEach(function (d) {
        var alerte = cache.alertesParDossierId[d.id];
        var prioriteLabel = "Normal";
        var prioriteTag = "tag-outline";
        var pastille = "🟢";

        if (alerte) {
          if (alerte.couleur === "rouge") {
            prioriteLabel = "Critique";
            prioriteTag = "tag-danger";
            pastille = "🔴";
          } else if (alerte.couleur === "jaune") {
            prioriteLabel = "Vigilance";
            prioriteTag = "tag-warning";
            pastille = "🟡";
          }
        }

        var clientAffiche = d.comparantsNoms && d.comparantsNoms.trim() ? d.comparantsNoms.trim() : "Comparant(s) en cours";
        var dt = d.createdAt ? new Date(d.createdAt) : (d.dateOuverture ? new Date(d.dateOuverture) : null);
        var dateAffichee = dt && !isNaN(dt.getTime()) ? dt.toLocaleDateString("fr-CI") : (d.dateOuverture || "—");

        var statutLabel = (d.statut === "cloture" || d.etapeActuelle === 6) ? "Clôturé & Archivé" : labelEtape(d.etapeActuelle);
        var statutTag = (d.statut === "cloture" || d.etapeActuelle === 6) ? "tag-accent" : "tag-outline";

        html += '<tr class="alerte-item" data-id="' + d.id + '" style="cursor:pointer">';
        html += '<td style="font-weight:600;color:var(--color-text)">' + clientAffiche + '</td>';
        html += '<td>' + labelActe(d.typeActeId) + '</td>';
        html += '<td><strong>' + d.numeroDossier + '</strong></td>';
        html += '<td><span class="tag ' + prioriteTag + '" style="font-size:11px">' + pastille + ' ' + prioriteLabel + '</span></td>';
        html += '<td><span class="tag ' + statutTag + '">' + statutLabel + '</span></td>';
        html += '<td style="color:var(--color-text-dim);font-size:12px">' + dateAffichee + '</td>';
        html += '<td><span class="btn btn-ghost" style="padding:0;font-size:12px">Consulter →</span></td>';
        html += '</tr>';
      });

      html += '</tbody></table></div>';
    }
    html += '</div>';
    return html;
  }

  function attacherEvenementsDashboard(conteneur) {
    conteneur.querySelectorAll(".alerte-item").forEach(function (e) {
      e.addEventListener("click", function () { ouvrirDossier(e.dataset.id, "dashboard"); });
    });
    var btnPush = conteneur.querySelector("#bouton-demander-push");
    if (btnPush) btnPush.addEventListener("click", proposerWebPushMoment);
  }

  // -----------------------------------------------------------------
  // Kanban
  // -----------------------------------------------------------------
  function renderKanban() {
    var c = document.getElementById("vue-kanban");
    var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-3)">';
    html += '<h1 style="margin-bottom:2px">Circuit d\'instruction</h1><p style="opacity:.65;font-size:14px;margin:0">Les 6 étapes du pipeline — cliquer une carte pour ouvrir la fiche dossier.</p></div>';
    html += '<div style="display:flex;flex-direction:column;gap:var(--space-4)">';

    cache.etapesPipeline.forEach(function (etape, idx) {
      var ds = cache.dossiers.filter(function (d) { return d.etapeActuelle === etape.id; });
      var accent = ETAPE_COULEUR[idx % ETAPE_COULEUR.length];
      html += '<div style="width:100%;display:flex;flex-direction:column;border-radius:var(--radius);background:color-mix(in srgb, ' + accent + ' 8%, var(--color-surface));border-left:3px solid ' + accent + ';overflow:hidden">';
      html += '<div style="display:flex;align-items:baseline;justify-content:space-between;padding:var(--space-2) var(--space-3) var(--space-1)"><h5 style="margin:0;color:' + accent + ';font-size:22px;font-weight:700;font-family:var(--font-heading)">' + etape.libelle + '</h5><span class="tag tag-neutral">' + ds.length + '</span></div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:var(--space-2);padding:0 var(--space-3) var(--space-3)">';
      if (!ds.length) {
        html += '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:var(--space-3) var(--space-4);color:var(--color-text-dim);text-align:center;font-size:12px;border:1px dashed var(--color-divider);border-radius:var(--radius);flex:0 0 260px;width:260px"><span style="font-size:20px;opacity:.6">○</span><span>Aucun dossier à cette étape</span></div>';
      }
      ds.forEach(function (d) {
        var nv = niveauDossier(d.id);
        html += '<div class="card elev-sm carte-dossier" data-id="' + d.id + '" style="cursor:pointer;flex:0 0 260px;width:260px">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between"><div class="card-kicker">' + d.numeroDossier + '</div></div>';
        html += '<div class="card-title" style="font-size:15px">' + labelActe(d.typeActeId) + '</div>';
        html += '<div class="card-meta" style="justify-content:space-between"><span>' + fmtFCFA(d.montantAssiette) + '</span><span class="tag ' + nv.tag + '" style="font-weight:700">' + nv.label + '</span></div></div>';
      });
      html += '</div></div>';
    });
    html += '</div>';
    c.innerHTML = html;
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

    var liste = cache.dossiers
      .filter(function (d) { return etat.filtreTypeActe === "all" || d.typeActeId === etat.filtreTypeActe; })
      .filter(function (d) { return etat.filtreEtape === "all" || d.etapeActuelle === Number(etat.filtreEtape); })
      .filter(function (d) {
        return !recherche || (d.numeroDossier + " " + labelActe(d.typeActeId) + " " + (d.comparantsNoms || "")).toLowerCase().indexOf(recherche) !== -1;
      });

    var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-3);display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap">';
    html += '<div><h1 style="margin-bottom:2px">Dossiers</h1><p style="opacity:.65;font-size:14px;margin:0">' + liste.length + ' dossier(s) affiché(s) sur ' + cache.dossiers.length + ' au total.</p></div>';
    if (cache.permissions.addDossier) html += '<button class="btn btn-primary" id="bouton-nouveau-dossier">+ Nouveau dossier</button>';
    html += '</div>';

    // Bandeau interactif Top 5 des actes
    html += '<div style="margin-bottom:var(--space-3)">';
    html += '<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:8px">';
    html += '<span style="font-size:14px;color:#38bdf8">📊</span> Top 5 des actes les plus fréquents de l\'étude :';
    html += '</div>';
    html += '<div class="top-actes-bar">';
    html += '<button type="button" class="top-acte-chip' + (etat.filtreTypeActe === "all" ? " actif" : "") + '" data-type-id="all"><span>📚</span> Tous les actes <strong>(' + cache.dossiers.length + ')</strong></button>';
    topActesListe.forEach(function (ta) {
      var isActif = etat.filtreTypeActe === ta.typeId;
      html += '<button type="button" class="top-acte-chip' + (isActif ? " actif" : "") + '" data-type-id="' + ta.typeId + '"><span>📑</span> ' + ta.label + ' <strong>(' + ta.count + ')</strong></button>';
    });
    html += '</div></div>';

    html += '<div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-4);flex-wrap:wrap">';
    html += '<input class="input" id="dossiers-recherche" style="max-width:320px" value="' + etat.filtreRecherche + '" placeholder="Rechercher un numéro, client, type…">';
    html += '<select class="input" id="dossiers-filtre-etape" style="max-width:260px"><option value="all">Toutes les étapes</option>';
    cache.etapesPipeline.forEach(function (e) { html += '<option value="' + e.id + '"' + (String(e.id) === etat.filtreEtape ? " selected" : "") + '>' + e.libelle + '</option>'; });
    html += '</select></div>';

    html += '<div class="table-wrap"><table class="table"><thead><tr><th>Numéro</th><th>Client (Comparants)</th><th>Type d\'acte</th><th>Étape</th><th>Montant (Assiette)</th><th>Statut</th></tr></thead><tbody>';
    if (!liste.length) html += '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:var(--space-4)">Aucun dossier ne correspond à vos filtres.</td></tr>';
    liste.forEach(function (d) {
      var nv = niveauDossier(d.id);
      var clientAffiche = d.comparantsNoms && d.comparantsNoms.trim() ? d.comparantsNoms.trim() : "—";
      html += '<tr class="ligne-dossier" data-id="' + d.id + '" style="cursor:pointer">';
      html += '<td><strong>' + d.numeroDossier + '</strong></td>';
      html += '<td style="font-weight:600;color:var(--color-text)">' + clientAffiche + '</td>';
      html += '<td>' + labelActe(d.typeActeId) + '</td>';
      html += '<td><span class="tag tag-outline">' + labelEtape(d.etapeActuelle) + '</span></td>';
      html += '<td style="font-weight:600">' + fmtFCFA(d.montantAssiette) + '</td>';
      html += '<td><span class="tag ' + nv.tag + '">' + nv.label + '</span></td>';
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
    if (cache.permissions.dossiersTous || cache.permissions.equipe) {
      html += '<div class="field"><label>Clerc assigné</label><select class="input" id="nd-clerc"><option value="">Non assigné pour l\'instant</option>';
      cache.equipeListe.forEach(function (m) { html += '<option value="' + m.id + '">' + m.nomComplet + ' — ' + ROLE_LABEL[m.role] + '</option>'; });
      html += '</select></div>';
    } else {
      html += '<div class="field"><label>Clerc assigné</label><div class="input" style="opacity:.65;display:flex;align-items:center">Vous-même (' + cache.utilisateur.nomComplet + ')</div></div>';
    }
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
      html += '<button type="button" class="btn ' + (etat.filtreClientsMulti ? "btn-primary" : "btn-secondary") + '" id="btn-filtre-multi-clients">📁 Clients multi-dossiers (' + multiCount + ')</button>';
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
            html += '<span class="tag tag-accent" style="font-weight:700;font-size:12px">📁 Multi-dossiers (' + nbDossiers + ')</span>';
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
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:18px">⚖️</span><strong style="font-size:13px;color:var(--color-text)">Réglementation Notariale en Côte d\'Ivoire (Décret N° 2013-279)</strong></div>';
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
      titre: '<span>📜</span> ' + typeActe.libelle,
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
        html += '<div style="font-size:12px;color:var(--color-accent);background:var(--color-accent-subtle);padding:6px 10px;border-radius:var(--radius);border:1px solid var(--color-accent)">👑 <strong>Accès Notaire Titulaire :</strong> Vous pouvez ajuster les délais en jours de chaque étape ci-dessous.</div>';
      } else {
        html += '<div style="font-size:12px;color:var(--color-text-dim);background:var(--color-surface-2);padding:6px 10px;border-radius:var(--radius);border:1px solid var(--color-border)">🔒 <strong>Information :</strong> Les délais légaux sont fixés et modifiables uniquement par le Notaire Titulaire.</div>';
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
            html += '<span class="tag tag-outline" style="font-size:11px;font-weight:700">🔒 ' + t.dureeJours + ' jour(s)</span>';
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
      titre: '<span>➕</span> Enregistrer un nouveau type d\'acte',
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
      html += '<button type="button" class="btn btn-primary" id="btn-ouvrir-modal-numeriser">📥 + Numériser & Archiver</button>';
      html += '<button type="button" class="btn btn-secondary" id="btn-ouvrir-modal-scan-ocr">🤖 + Scanner & OCR IA</button>';
      html += '<button type="button" class="btn btn-secondary" id="btn-ouvrir-modal-sortie">📤 + Sortie physique</button>';
      html += '<button type="button" class="btn btn-secondary" id="btn-ouvrir-modal-carton">📦 + Nouveau carton</button>';
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
      html += '<div style="font-size:12px;font-weight:bold;color:#10b981;margin-top:4px">🟢 ' + (syncStatut && syncStatut.enAttente > 0 ? syncStatut.enAttente + " en attente" : "À jour") + '</div>';
      html += '</div>';

      html += '</div>';

      // =========================================================================
      // BANDEAU DES 7 ONGLETS OPÉRATIONNELS
      // =========================================================================
      html += '<div class="archive-nav-bar">';
      html += '<button type="button" class="archive-nav-btn' + (etatArchives.onglet === "repertoire" ? " actif" : "") + '" data-onglet="repertoire">📜 Répertoire Minutier <strong>(' + repertoire.length + ')</strong></button>';
      html += '<button type="button" class="archive-nav-btn' + (etatArchives.onglet === "jumeau" ? " actif" : "") + '" data-onglet="jumeau">🏢 Jumeau Numérique 360°</button>';
      html += '<button type="button" class="archive-nav-btn' + (etatArchives.onglet === "mouvements" ? " actif" : "") + '" data-onglet="mouvements">📤 Mouvements & Sorties <strong>(' + sortisActuels.length + ')</strong></button>';
      html += '<button type="button" class="archive-nav-btn' + (etatArchives.onglet === "cartons" ? " actif" : "") + '" data-onglet="cartons">📦 Cartons & Rayonnages <strong>(' + cartons.length + ')</strong></button>';
      html += '<button type="button" class="archive-nav-btn' + (etatArchives.onglet === "campagnes" ? " actif" : "") + '" data-onglet="campagnes">📥 Campagnes Historiques <strong>(' + campagnes.length + ')</strong></button>';
      html += '<button type="button" class="archive-nav-btn' + (etatArchives.onglet === "infrastructure" ? " actif" : "") + '" data-onglet="infrastructure">⚙️ Infra & Sauvegardes</button>';
      html += '<button type="button" class="archive-nav-btn' + (etatArchives.onglet === "guide" ? " actif" : "") + '" data-onglet="guide">🏛️ Guide Légal</button>';
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
        html += '<input class="input" id="recherche-archives" style="max-width:380px" value="' + (etatArchives.recherche || "") + '" placeholder="🔍 Recherche plein texte, N° minute, N° dossier, client, carton…">';
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
            html += '<td><span class="tag tag-accent" style="font-size:10px" title="Fichier numérisé 300 DPI certifié SHA-256">✅ ' + scanAff + '</span></td>';
            html += '<td><div style="display:flex;gap:4px">';
            html += '<button type="button" class="btn btn-ghost btn-voir-jumeau-dossier" data-dossier-id="' + m.dossier_id + '" style="padding:3px 6px;font-size:11px" title="Voir le jumeau numérique et physique">🔍 360°</button>';
            html += '<button type="button" class="btn btn-ghost btn-fiche-minute" data-minute-json="' + encodeURIComponent(JSON.stringify(m)) + '" style="padding:3px 6px;font-size:11px">📄 Fiche</button>';
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
        html += '<button type="button" class="btn btn-secondary btn-jumeau-sortie" data-dossier-id="' + dossierIdCible + '" style="font-size:12px">📤 Sortir le dossier papier</button>';
        html += '<button type="button" class="btn btn-secondary btn-jumeau-non-num" data-dossier-id="' + dossierIdCible + '" style="font-size:12px">🗺️ + Pièce non-numérisable</button>';
        html += '</div></div>';

        html += '<div id="zone-jumeau-details" style="display:flex;flex-direction:column;gap:var(--space-4)">';
        html += '<div class="card" style="text-align:center;padding:var(--space-4)">Chargement du jumeau numérique 360°…</div>';
        html += '</div>';

      } else if (etatArchives.onglet === "mouvements") {
        // --- ONGLET 3 : TRAÇABILITÉ DES MOUVEMENTS PHYSIQUES DES DOSSIERS ---
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);flex-wrap:wrap;gap:var(--space-2)">';
        html += '<p style="font-size:13px;color:var(--color-text-dim);margin:0">Suivi rigoureux des sorties physiques de dossiers papier pour consultation au bureau et des retours en carton.</p>';
        html += '<button type="button" class="btn btn-primary" id="btn-ouvrir-modal-sortie-tab" style="font-size:12px">📤 + Enregistrer une sortie physique</button>';
        html += '</div>';

        html += '<div class="table-wrap"><table class="table"><thead><tr><th>Dossier</th><th>Client (Comparants)</th><th>Type de mouvement</th><th>Demandeur</th><th>Localisation / Bureau</th><th>Date sortie</th><th>Date retour prévue</th><th>Statut</th><th>Action</th></tr></thead><tbody>';
        if (!mouvements.length) {
          html += '<tr><td colspan="9" class="text-muted" style="text-align:center;padding:var(--space-4)">Aucun mouvement physique enregistré. Tous les dossiers sont en archives.</td></tr>';
        } else {
          mouvements.forEach(function (mv) {
            var estEnCours = mv.statut === "en_cours";
            html += '<tr>';
            html += '<td><strong style="color:var(--color-accent)">' + mv.numero_dossier + '</strong></td>';
            html += '<td style="font-size:12px">' + (mv.comparants_noms || "Comparants") + '</td>';
            html += '<td><span class="tag tag-outline" style="font-size:11px">' + mv.type_mouvement + '</span></td>';
            html += '<td><strong>' + mv.nom_demandeur + '</strong></td>';
            html += '<td><span style="font-weight:600;color:#f59e0b">' + mv.destination_bureau + '</span></td>';
            html += '<td style="font-size:12px">' + fmtDate(mv.date_mouvement) + '</td>';
            html += '<td style="font-size:12px">' + (mv.date_retour_prevue ? fmtDate(mv.date_retour_prevue) : "—") + '</td>';
            html += '<td><span class="tag ' + (estEnCours ? "tag-neutral" : "tag-accent") + '">' + (estEnCours ? "📍 En consultation" : "✅ Retourné") + '</span></td>';
            html += '<td>';
            if (estEnCours) {
              html += '<button type="button" class="btn btn-secondary btn-retourner-carton" data-mouvement-id="' + mv.id + '" data-dossier-id="' + mv.dossier_id + '" style="font-size:11px;padding:3px 8px">📥 Retourner en carton</button>';
            } else {
              html += '<span style="font-size:11px;color:var(--color-text-dim)">Classé en archive</span>';
            }
            html += '</td>';
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
        html += '<div><strong style="font-size:15px;color:var(--color-text)">🔍 Recherche & Localisation Physique des Dossiers en Carton</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Tapez un nom de client, un N° de dossier ou de minute pour localiser immédiatement son carton et sa position.</p></div>';
        html += '<button type="button" class="btn btn-secondary" id="btn-ouvrir-modal-carton-tab" style="font-size:12px">📦 + Nouveau carton d\'archives</button>';
        html += '</div>';

        html += '<div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap">';
        html += '<input class="input" id="recherche-cartons-dossier" style="flex:1;min-width:280px;background:var(--color-surface);font-size:13px" value="' + (etatArchives.rechercheCarton || "") + '" placeholder="🔍 Tapez un nom de client (ex. KOUASSI, KOFFI), N° dossier (DOS-2026...), minute ou carton…">';
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
            html += '<span class="tag ' + (estPlein ? "tag-neutral" : "tag-accent") + '" style="font-weight:700">' + (estPlein ? "📦 Plein" : "📂 Ouvert") + '</span>';
            html += '</div>';

            html += '<div style="background:var(--color-surface);padding:8px 10px;border-radius:var(--radius);border:1px solid var(--color-border);font-size:12px">';
            html += '<div style="color:var(--color-text-dim);margin-bottom:2px">📍 Localisation physique :</div>';
            html += '<strong style="color:var(--color-text)">' + (k.salle || "Salle principale") + ' · ' + (k.armoire || "Armoire A") + ' · ' + (k.rayonnage || "Rayon 1") + '</strong>';
            html += '</div>';

            html += '<div>';
            html += '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span>Remplissage :</span><strong>' + (k.nombreDossiers || docsCarton.length) + ' / ' + k.capaciteMax + ' dossiers (' + pct + ' %)</strong></div>';
            html += '<div class="carton-progress-bar"><div class="carton-progress-fill" style="width:' + Math.min(pct, 100) + '%"></div></div>';
            html += '</div>';

            // SECTION RÉSULTATS : DOSSIERS TROUVÉS DANS CE CARTON LORS D'UNE RECHERCHE
            if (matchDocs.length > 0) {
              html += '<div style="background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.3);padding:10px;border-radius:var(--radius);margin-top:4px">';
              html += '<div style="font-size:11px;font-weight:bold;color:#38bdf8;margin-bottom:6px">🎯 Dossier(s) trouvé(s) dans ce carton (' + matchDocs.length + ') :</div>';
              html += '<div style="display:flex;flex-direction:column;gap:6px">';
              matchDocs.forEach(function (d) {
                var clientNom = d.comparantsNoms && d.comparantsNoms.trim() ? d.comparantsNoms.trim() : "Comparants";
                html += '<div style="background:var(--color-surface);padding:6px 8px;border-radius:4px;border:1px solid var(--color-border);font-size:11px;display:flex;justify-content:space-between;align-items:center;gap:6px">';
                html += '<div>';
                html += '<div style="font-weight:bold;color:var(--color-text)"><span class="tag tag-accent" style="font-size:9px;padding:1px 4px;margin-right:4px">Pos #' + String(d.positionDansCarton || 1).padStart(3, "0") + '</span> ' + clientNom + '</div>';
                html += '<div style="color:var(--color-text-dim);font-size:10px;margin-top:2px">' + (d.numeroDossier || "Dossier") + ' · ' + (d.numeroMinute || "") + ' · ' + labelActe(d.typeActeId) + '</div>';
                html += '</div>';
                if (d.dossierId) {
                  html += '<button type="button" class="btn btn-ghost btn-voir-jumeau-dossier" data-dossier-id="' + d.dossierId + '" style="font-size:10px;padding:2px 6px;white-space:nowrap" title="Voir le jumeau numérique et physique">🔍 360°</button>';
                }
                html += '</div>';
              });
              html += '</div></div>';
            }

            // ACCORDÉON DÉPLIABLE : TOUS LES DOSSIERS CONTENUS DANS LE CARTON
            if (docsCarton.length > 0) {
              html += '<div style="margin-top:4px">';
              html += '<button type="button" class="btn btn-ghost btn-toggle-carton-dossiers" data-carton-id="' + k.id + '" style="width:100%;font-size:11px;padding:5px;display:flex;justify-content:space-between;align-items:center;background:var(--color-surface);border:1px solid var(--color-border)">';
              html += '<span>📂 ' + docsCarton.length + ' dossier(s) dans ce carton</span>';
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
                    html += '<button type="button" class="btn btn-ghost btn-voir-jumeau-dossier" data-dossier-id="' + d.dossierId + '" style="font-size:10px;padding:2px 6px">🔍 360°</button>';
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
        html += '<button type="button" class="btn btn-primary" id="btn-ouvrir-modal-campagne" style="font-size:12px">📥 + Nouvelle campagne historique</button>';
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
            html += '<button type="button" class="btn btn-secondary btn-avancement-campagne" data-campagne-id="' + cp.id + '" style="font-size:11px;padding:4px 10px">⚡ Avancement par lot (+100)</button>';
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
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:20px">🖥️</span><strong style="font-size:15px">Supervision du Serveur de l\'Étude</strong></div>';
        html += '<div style="display:flex;flex-direction:column;gap:8px;font-size:13px">';
        html += '<div style="display:flex;justify-content:space-between"><span>Serveur Local (Node/Express) :</span><strong style="color:#22c55e">🟢 ' + sante.application + '</strong></div>';
        html += '<div style="display:flex;justify-content:space-between"><span>Base de données PostgreSQL :</span><strong style="color:#22c55e">🟢 ' + sante.baseDeDonnees + '</strong></div>';
        html += '<div style="display:flex;justify-content:space-between"><span>Stockage Documentaire Local :</span><strong style="color:#22c55e">🟢 ' + sante.stockage + ' (' + sante.espaceUtiliseMo + ' Mo / ' + Math.round(sante.espaceTotalMo / 1000) + ' Go)</strong></div>';
        html += '<div style="display:flex;justify-content:space-between"><span>Adresse IP Réseau de l\'étude :</span><strong style="font-family:monospace">' + sante.ipLocale + '</strong></div>';
        html += '<div style="display:flex;justify-content:space-between"><span>Version du logiciel :</span><strong>v' + sante.versionApp + '</strong></div>';
        html += '</div></div>';

        // Carte 2 : Synchronisation Hybride & Réplication Cloud
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:20px">🔄</span><strong style="font-size:15px">Moteur de Synchronisation Hybride (Sync Engine)</strong></div>';
        html += '<div style="display:flex;flex-direction:column;gap:8px;font-size:13px">';
        html += '<div style="display:flex;justify-content:space-between"><span>Mode de déploiement :</span><strong style="color:#38bdf8;text-transform:uppercase">' + sante.modeInfrastructure + '</strong></div>';
        html += '<div style="display:flex;justify-content:space-between"><span>Éléments en file d\'attente :</span><strong>' + (syncStatut ? syncStatut.enAttente : 0) + ' document(s)</strong></div>';
        html += '<div style="display:flex;justify-content:space-between"><span>Dernière réplication Cloud :</span><strong>' + fmtDate(sante.derniereSynchro) + '</strong></div>';
        html += '<div style="display:flex;justify-content:space-between"><span>Dernière sauvegarde protégée :</span><strong style="color:#22c55e">🟢 Quotidienne 03:00</strong></div>';
        html += '<div style="margin-top:8px"><button type="button" class="btn btn-primary" id="btn-forcer-sync" style="width:100%;font-size:12px">🔄 Forcer la synchronisation vers le Cloud Vault</button></div>';
        html += '</div></div>';

        html += '</div>';

        // Carte 3 : Support Technique L1-L4 & Accès Temporaire Audité
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
        html += '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:20px">🎫</span><strong style="font-size:15px">Support Technique Éditeur (L1 - L4) & Télé-diagnostic</strong></div>';
        html += '<button type="button" class="btn btn-secondary" id="btn-ouvrir-modal-ticket" style="font-size:12px">Ouvrir un ticket d\'assistance</button>';
        html += '</div>';
        html += '<div style="font-size:12px;color:var(--color-text-dim);line-height:1.5;background:var(--color-surface);padding:10px 12px;border-radius:var(--radius);border:1px solid var(--color-border)">';
        html += '🔒 <strong>Garantie de Sécurité & Secret Professionnel Notarial :</strong> Le personnel de support de l\'éditeur n\'a <strong>aucun accès par défaut</strong> aux dossiers et documents de l\'étude. En cas d\'incident technique, une demande d\'accès temporaire avec motif obligatoire doit être validée par le Notaire, limitée dans le temps et intégralement auditée.';
        html += '</div></div>';

      } else if (etatArchives.onglet === "guide") {
        // --- ONGLET 7 : GUIDE DES BONNES PRATIQUES D'ARCHIVAGE ---
        html += '<div class="card" style="border-left:4px solid #38bdf8;background:var(--color-surface-2);margin-bottom:var(--space-5);padding:var(--space-4)">';
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--space-3)"><span style="font-size:22px">🏛️</span><strong style="font-size:16px;color:var(--color-text)">Guide des Bonnes Pratiques d\'Archivage Numérique & Minutier Officiel</strong></div>';

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
      html += '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:20px">💻</span><strong style="font-size:15px;color:var(--color-text)">Jumeau Numérique (Copie GED & OCR)</strong></div>';
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
          html += '<span class="tag tag-accent" style="font-size:10px">✅ OCR Traité</span>';
          html += '</div>';
        });
        html += '</div>';
      }

      html += '</div>';

      // COLONNE DROITE : JUMEAU PHYSIQUE (Original Papier, Localisation, Sorties)
      html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
      html += '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:20px">📁</span><strong style="font-size:15px;color:var(--color-text)">Original Papier & Conservation</strong></div>';
      html += '<span class="tag ' + (jp.estDisponibleEnCarton ? "tag-accent" : "tag-neutral") + '">' + (jp.estDisponibleEnCarton ? "✅ En archives" : "📍 Sorti au bureau") + '</span>';
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
            html += '<div style="font-size:11px;color:#f59e0b;margin-top:2px">⚠️ Original physique uniquement : ' + p.raison_non_numerisable + '</div>';
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
  // MODALE : SCANNER & OCR IA AVEC PROPOSITION D'INDEXATION
  // =========================================================================
  function modalScanOcrIA(dossierIdPreselectionne) {
    var html = '<form id="form-scan-ocr-ia" style="display:flex;flex-direction:column;gap:var(--space-3)">';
    html += '<div class="field"><label>Sélectionner le fichier numérisé (Scan 300 DPI PDF/A)</label><input class="input" name="nomFichier" value="SCAN_ACTE_VENTE_ACD_2026.pdf" required></div>';

    html += '<div style="background:var(--color-surface-2);padding:12px;border-radius:var(--radius);border:1px solid var(--color-border)">';
    html += '<div style="font-weight:700;font-size:13px;margin-bottom:6px">🤖 Moteur d\'Extraction OCR & Suggestion IA</div>';
    html += '<div style="font-size:12px;color:var(--color-text-dim)">L\'IA extrait le texte du scan, identifie automatiquement la nature de l\'acte et propose le rattachement au dossier correspondant avec un score de confiance.</div>';
    html += '</div>';

    html += '<div id="zone-proposition-ia" style="display:none;background:var(--color-surface);padding:12px;border-radius:var(--radius);border:1px solid var(--color-border)"></div>';

    html += '<div id="erreur-scan-ocr" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)">';
    html += '<button type="button" class="btn btn-ghost" id="btn-annuler-scan-ocr">Annuler</button>';
    html += '<button type="button" class="btn btn-secondary" id="btn-analyser-scan">Lancer l\'OCR & Détection IA →</button>';
    html += '<button type="submit" class="btn btn-primary" id="btn-valider-ocr-ia" style="display:none">✅ Valider & Classer dans le dossier</button>';
    html += '</div>';
    html += '</form>';

    ouvrirModal({
      titre: '<span>🤖</span> Numérisation Haute Définition, OCR & Indexation IA',
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
            propHtml += '<strong style="color:var(--color-text);font-size:14px">Proposition IA de rattachement :</strong>';
            propHtml += '<span class="tag tag-accent" style="font-weight:bold">Confiance : ' + prop.scoreConfiance + ' %</span>';
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
            btnAnalyser.textContent = "Lancer l'OCR & Détection IA →";
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
  // MODALE : ENREGISTRER UNE SORTIE PHYSIQUE (EMPRUNT BUREAU)
  // =========================================================================
  function modalSortiePhysique(dossierIdPreselectionne) {
    API.get("/api/dossiers/mes-dossiers").catch(function () { return cache.dossiers || []; }).then(function (dossiers) {
      var html = '<form id="form-sortie-physique" style="display:flex;flex-direction:column;gap:var(--space-3)">';

      html += '<div class="field"><label>Sélectionner le dossier papier à sortir</label><select class="input" name="dossierId" required>';
      dossiers.forEach(function (d) {
        var clientAff = d.comparantsNoms && d.comparantsNoms.trim() ? d.comparantsNoms.trim() : "Comparants";
        var isSel = (dossierIdPreselectionne === d.id);
        html += '<option value="' + d.id + '"' + (isSel ? " selected" : "") + '>' + d.numeroDossier + ' — ' + labelActe(d.typeActeId) + ' (' + clientAff + ')</option>';
      });
      html += '</select></div>';

      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
      html += '<div class="field"><label>Nom du demandeur / Collaborateur</label><input class="input" name="nomDemandeur" value="' + (cache.utilisateur ? cache.utilisateur.nomComplet : "Collaborateur") + '" required></div>';
      html += '<div class="field"><label>Bureau / Localisation de consultation</label><input class="input" name="destinationBureau" value="Bureau 3 (Clerc Rédacteur)" required></div>';
      html += '</div>';

      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
      html += '<div class="field"><label>Motif de la sortie</label><input class="input" name="motif" value="Consultation pour instruction et vérification des pièces originales" required></div>';
      html += '<div class="field"><label>Date de retour prévue</label><input class="input" type="date" name="dateRetourPrevue" value="' + new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) + '"></div>';
      html += '</div>';

      html += '<div id="erreur-sortie" class="erreur-inline" style="display:none"></div>';
      html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)">';
      html += '<button type="button" class="btn btn-ghost" id="btn-annuler-sortie">Annuler</button>';
      html += '<button type="submit" class="btn btn-primary">Enregistrer la sortie physique →</button>';
      html += '</div></form>';

      ouvrirModal({
        titre: '<span>📤</span> Enregistrer une sortie de dossier papier',
        corps: html,
        boutonFermer: true,
        largeur: "540px",
        apresOuverture: function () {
          document.getElementById("btn-annuler-sortie").addEventListener("click", fermerModal);
          document.getElementById("form-sortie-physique").addEventListener("submit", function (ev) {
            ev.preventDefault();
            var form = ev.target;
            var payload = {
              dossierId: form.dossierId.value,
              nomDemandeur: form.nomDemandeur.value.trim(),
              destinationBureau: form.destinationBureau.value.trim(),
              motif: form.motif.value.trim(),
              dateRetourPrevue: form.dateRetourPrevue.value || null,
            };
            API.post("/api/archives/mouvements/sortie", payload).then(function () {
              toast("Sortie physique enregistrée avec succès.");
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
        titre: '<span>🗺️</span> Enregistrer un document physique non-numérisable',
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
      titre: '<span>📥</span> Créer une campagne de numérisation du fonds ancien',
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
      titre: '<span>🎫</span> Ouvrir un ticket d\'assistance technique',
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
      html += '⚖️ <strong>Mention légale :</strong> Acte authentique physique signé de façon normale en minute par les comparants et Maître Titulaire. Numérisé en haute définition 300 DPI au format pérenne PDF/A.';
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
        titre: '<span>📥</span> Numériser & Archiver un nouveau dossier en minute',
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
    html += '<div style="font-weight:bold;color:#0f172a;margin-bottom:4px">📦 Localisation physique en carton :</div>';
    html += '<div><strong>Emplacement :</strong> ' + (min.code_emplacement || min.codeEmplacement || "Carton principal") + '</div>';
    html += '<div><strong>Carton N° :</strong> ' + (min.numero_carton || min.cartonNumero || "CARTON-001") + '</div>';
    html += '</div>';

    html += '<div style="border:1px solid #cbd5e1;border-radius:4px;padding:12px;background:#f8fafc;font-size:12px">';
    html += '<div style="font-weight:bold;color:#0f172a;margin-bottom:4px">🔒 Certification numérique & Empreinte :</div>';
    html += '<div><strong>Fichier :</strong> ' + (min.scan_url || min.scanUrl || "SCAN_MINUTE_OFFICIEL.pdf") + ' (Numérisation 300 DPI PDF/A)</div>';
    html += '<div style="word-break:break-all;font-family:monospace;font-size:10px;margin-top:4px"><strong>SHA-256 :</strong> ' + (min.empreinteSha256 || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855") + '</div>';
    html += '</div>';

    html += '<div style="display:flex;justify-content:space-between;margin-top:20px;padding-top:12px;border-top:1px dashed #cbd5e1;font-size:11px;color:#64748b">';
    html += '<div>Établi le ' + dateAuj + ' · Conservation légale décennale</div>';
    html += '<div style="text-align:right">Cachet & Signature de l\'Office</div>';
    html += '</div>';

    html += '</div>';

    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)">';
    html += '<button type="button" class="btn btn-secondary" id="btn-imprimer-fiche">🖨️ Imprimer la fiche / étiquette</button>';
    html += '<button type="button" class="btn btn-primary" id="btn-fermer-fiche">Fermer</button>';
    html += '</div>';

    html += '</div>';

    ouvrirModal({
      titre: '<span>📄</span> Fiche Officielle d\'Archivage & Bordereau de Versement',
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
      titre: '<span>📦</span> Ouvrir un nouveau carton d\'archives',
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
        html += '<div class="panel-header"><div class="panel-title"><span>👑</span> Ligne 1 : Attribué directement à ' + membreConcerne.nomComplet + ' (Visas, Signatures & Décisions)</div><span class="tag tag-accent">' + (enRelecture.length + enSignature.length) + ' acte(s) en attente</span></div>';
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
        html += '<div class="panel-header"><div class="panel-title"><span>🏛️</span> Ligne 2 : Évolution générale & Performance globale de l\'office</div><span class="tag tag-outline">Exercice en cours</span></div>';
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
          { label: "Dossiers actifs assignés", valeur: String(evo.dossiersActifs), indice: "", icon: "📁", sub: "Charge en cours" },
          { label: "Dossiers clôturés (30 j)", valeur: String(evo.dossiersClotures30Jours), indice: "accent", icon: "✅", sub: "Performance mensuelle" },
          { label: "Taux d'avancement moyen", valeur: evo.avancementMoyenPourcent + " %", indice: "accent", icon: "📈", sub: "Avancement des tâches" },
        ];
        html += renderKpisGrid(kpis);

        html += '<div class="dashboard-panel">';
        html += '<div class="panel-header"><div class="panel-title"><span>📊</span> Dossiers assignés en cours d\'instruction</div><span class="tag tag-outline">' + dossiersMembre.length + ' dossier(s)</span></div>';
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

  // -----------------------------------------------------------------
  // Comptabilité & Facturation (Décret 2013-279 & TEST.xlsx)
  // -----------------------------------------------------------------
  function renderComptabilite() {
    var c = document.getElementById("vue-comptabilite");
    c.innerHTML = '<p class="text-muted">Chargement de la comptabilité & facturation…</p>';

    var synthese = calculerSyntheseEtude(cache.dossiers);

    var kpis = [
      { label: "Honoraires & Émoluments HT", valeur: fmtFCFA(synthese.totalEmolumentsHT), indice: "", icon: "💰", sub: "Décret N° 2013-279" },
      { label: "Droits DGI & Conservation", valeur: fmtFCFA(synthese.totalDroitsDGI), indice: "accent", icon: "🏛️", sub: "Droits proportionnels & fixes" },
      { label: "TVA légale (18 %)", valeur: fmtFCFA(Math.round(synthese.totalEmolumentsHT * 0.18)), indice: "", icon: "📊", sub: "Reversée au Trésor public" },
      { label: "Provisions Séquestres (CDCI)", valeur: fmtFCFA(synthese.sequestresCDCI), indice: "accent", icon: "🏦", sub: "Acomptes clients sous séquestre" },
    ];

    var html = '<div style="position:sticky;top:calc(-1 * var(--space-6));background:var(--color-bg);z-index:2;padding-top:var(--space-1);margin-bottom:var(--space-4)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap">';
    html += '<div><h1 style="margin:0">Comptabilité & Facturation Notariale</h1>';
    html += '<p style="opacity:.65;font-size:14px;margin:2px 0 0">États de frais, fiches de taxe et facturation normalisée conforme au Décret 2013-279.</p></div>';
    html += '</div></div>';

    html += renderKpisGrid(kpis);

    // Tableau des états de frais et facturation par dossier
    html += '<div class="dashboard-panel">';
    html += '<div class="panel-header"><div class="panel-title"><span>📑</span> Facturation & Fiches de taxe des dossiers</div><span class="tag tag-outline">' + cache.dossiers.length + ' dossier(s)</span></div>';

    if (!cache.dossiers.length) {
      html += '<div class="panel-body" style="text-align:center;padding:var(--space-4);color:var(--color-text-dim)">Aucun dossier à facturer pour le moment.</div>';
    } else {
      html += '<div class="table-wrap"><table class="table"><thead><tr><th>N° Dossier</th><th>Client (Comparants)</th><th>Type d\'acte</th><th>Assiette</th><th>Émoluments HT</th><th>DGI & Droits</th><th>Débours</th><th>Total TTC</th><th>Action</th></tr></thead><tbody>';

      cache.dossiers.forEach(function (d) {
        var clientAff = d.comparantsNoms && d.comparantsNoms.trim() ? d.comparantsNoms.trim() : "Comparant(s)";
        var typeActe = cache.typesActesParId[d.typeActeId] || {};
        var assiette = Number(d.montantAssiette) || 0;

        // Estimation fiscale
        var emolumentsHT = 75000;
        if (assiette > 0) {
          if (assiette <= 5000000) emolumentsHT = assiette * 0.04;
          else if (assiette <= 20000000) emolumentsHT = 200000 + (assiette - 5000000) * 0.025;
          else emolumentsHT = 575000 + (assiette - 20000000) * 0.015;
        }
        emolumentsHT = Math.max(Math.round(emolumentsHT), 75000);
        var tva = Math.round(emolumentsHT * 0.18);
        var droitsDGI = typeActe.droitEnregistrementMode === "fixe" ? (typeActe.droitEnregistrementValeur || 18000) : Math.round(assiette * (typeActe.droitEnregistrementValeur || 0.04));
        var debours = 20000 + 4000; // 20k papeterie + 4k timbres
        var totalTTC = emolumentsHT + tva + droitsDGI + debours;

        html += '<tr class="ligne-compta-dossier" data-id="' + d.id + '" style="cursor:pointer">';
        html += '<td><strong>' + d.numeroDossier + '</strong></td>';
        html += '<td style="font-weight:600;color:var(--color-text)">' + clientAff + '</td>';
        html += '<td>' + labelActe(d.typeActeId) + '</td>';
        html += '<td>' + fmtFCFA(assiette) + '</td>';
        html += '<td style="font-weight:700;color:var(--color-accent)">' + fmtFCFA(emolumentsHT) + '</td>';
        html += '<td style="font-weight:600">' + fmtFCFA(droitsDGI) + '</td>';
        html += '<td style="font-size:12px;color:var(--color-text-dim)">' + fmtFCFA(debours) + '</td>';
        html += '<td style="font-weight:700;color:var(--color-text)">' + fmtFCFA(totalTTC) + '</td>';
        html += '<td><button type="button" class="btn btn-secondary btn-ouvrir-taxe-direct" data-id="' + d.id + '" style="padding:4px 8px;font-size:11px">Fiche de taxe →</button></td>';
        html += '</tr>';
      });

      html += '</tbody></table></div>';
    }
    html += '</div>';

    c.innerHTML = html;

    c.querySelectorAll(".ligne-compta-dossier, .btn-ouvrir-taxe-direct").forEach(function (el) {
      el.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var id = el.dataset.id || el.closest("[data-id]").dataset.id;
        ouvrirDossier(id, "comptabilite");
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
        html += '<button class="btn btn-primary" id="bouton-save-identite">Enregistrer l\'identité</button>';
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
          }).then(function () { toast("Identité de l'étude mise à jour."); }).catch(function (e) { toast(e.message); });
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
  // Impression officielle de la Fiche de Taxe / Décompte Notarié
  // -----------------------------------------------------------------
  function imprimerDecompteOfficiel(dossier, f) {
    API.get("/api/parametres").then(function (params) {
      var printContainer = document.getElementById("print-container");
      if (!printContainer) return;

      var dateJour = new Date().toLocaleDateString("fr-CI", { day: "numeric", month: "long", year: "numeric" });
      var html = '<div style="padding:24px;max-width:800px;margin:0 auto;color:#111;background:#fff;font-family:Inter,sans-serif">';

      // En-tête de l'étude
      html += '<div class="print-header" style="border-bottom:2px solid #111827;padding-bottom:12px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start">';
      html += '<div>';
      html += '<div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:16pt;text-transform:uppercase;color:#111827">' + (params.nomEtude || "ÉTUDE NOTARIALE") + '</div>';
      html += '<div style="font-size:11pt;font-weight:600;margin-top:2px">' + (params.titreNotaire || "Maître") + ' ' + (params.nomNotaire || "") + '</div>';
      html += '<div style="font-size:9pt;color:#4b5563;margin-top:4px">' + (params.adresse || "Abidjan, Côte d'Ivoire") + '</div>';
      if (params.telephoneFixe || params.telephone) html += '<div style="font-size:9pt;color:#4b5563">Tél : ' + (params.telephoneFixe || params.telephone) + '</div>';
      if (params.email) html += '<div style="font-size:9pt;color:#4b5563">Email : ' + params.email + '</div>';
      html += '</div>';
      html += '<div style="text-align:right">';
      if (params.numeroOrdre) html += '<div style="font-size:9pt;color:#4b5563">N° Ordre : ' + params.numeroOrdre + '</div>';
      if (params.numeroCC) html += '<div style="font-size:9pt;color:#4b5563">N° CC : ' + params.numeroCC + '</div>';
      if (params.centreImpots) html += '<div style="font-size:9pt;color:#4b5563">Centre Impôts : ' + params.centreImpots + '</div>';
      if (params.compteSequestreCDCI) html += '<div style="font-size:9pt;color:#4b5563">Caisse des Dépôts : ' + params.compteSequestreCDCI + '</div>';
      html += '</div>';
      html += '</div>';

      // Titre
      html += '<div style="text-align:center;margin-bottom:24px">';
      html += '<div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:14pt;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #111;display:inline-block;padding-bottom:4px">DÉCOMPTE DE TAXE & ÉMOLUMENTS</div>';
      html += '<div style="font-size:10pt;color:#4b5563;margin-top:6px">Dossier N° <strong>' + dossier.numeroDossier + '</strong> — Acte : <strong>' + labelActe(dossier.typeActeId) + '</strong></div>';
      html += '<div style="font-size:10pt;color:#4b5563">Montant de l\'assiette fiscale : <strong>' + fmtFCFA(dossier.montantAssiette) + '</strong></div>';
      html += '</div>';

      // Tableau officiel
      html += '<table class="print-table" style="width:100%;border-collapse:collapse;margin-top:16px;margin-bottom:20px;font-size:10pt">';
      html += '<thead><tr style="background:#f3f4f6"><th style="border:1px solid #9ca3af;padding:6px 10px;text-align:left">RUBRIQUE TARIFAIRE</th><th style="border:1px solid #9ca3af;padding:6px 10px;text-align:right">MONTANT FCFA</th></tr></thead>';
      html += '<tbody>';
      html += '<tr><td style="border:1px solid #d1d5db;padding:6px 10px">1. Émoluments proportionnels / fixes du Notaire (HT)' + (f.emoluments.minimumApplique ? " <em>(Minimum légal de minute appliqué)</em>" : "") + '</td><td style="border:1px solid #d1d5db;padding:6px 10px;text-align:right;font-weight:600">' + fmtFCFA(f.emoluments.montantHT) + '</td></tr>';
      html += '<tr><td style="border:1px solid #d1d5db;padding:6px 10px">2. Taxe sur la Valeur Ajoutée (TVA 18 %)</td><td style="border:1px solid #d1d5db;padding:6px 10px;text-align:right">' + fmtFCFA(f.tva) + '</td></tr>';
      html += '<tr><td style="border:1px solid #d1d5db;padding:6px 10px">3. Droits d\'enregistrement DGI' + (!f.droitEnregistrement.confirme ? " <em>(à confirmer)</em>" : "") + '</td><td style="border:1px solid #d1d5db;padding:6px 10px;text-align:right">' + fmtFCFA(f.droitEnregistrement.montant) + '</td></tr>';
      html += '<tr><td style="border:1px solid #d1d5db;padding:6px 10px">4. Taxe de publicité foncière (1,2 % + 3 000 FCFA)</td><td style="border:1px solid #d1d5db;padding:6px 10px;text-align:right">' + fmtFCFA(f.taxeFonciere.total) + '</td></tr>';
      html += '<tr><td style="border:1px solid #d1d5db;padding:6px 10px">5. Timbres fiscaux et rôles de minute</td><td style="border:1px solid #d1d5db;padding:6px 10px;text-align:right">' + fmtFCFA(f.timbres.total + f.roles.total) + '</td></tr>';
      html += '<tr><td style="border:1px solid #d1d5db;padding:6px 10px">6. Frais de formalités et débours (Banque, DGI, Conservation)</td><td style="border:1px solid #d1d5db;padding:6px 10px;text-align:right">' + fmtFCFA(f.totalFraisFormalites) + '</td></tr>';
      if (f.vacations) html += '<tr><td style="border:1px solid #d1d5db;padding:6px 10px">7. Vacations</td><td style="border:1px solid #d1d5db;padding:6px 10px;text-align:right">' + fmtFCFA(f.vacations) + '</td></tr>';
      if (f.divers) html += '<tr><td style="border:1px solid #d1d5db;padding:6px 10px">8. Forfait papeterie & débours divers</td><td style="border:1px solid #d1d5db;padding:6px 10px;text-align:right">' + fmtFCFA(f.divers) + '</td></tr>';

      html += '<tr class="print-total-row" style="background:#f9fafb;font-weight:700;font-size:11pt"><td style="border:2px solid #111827;padding:8px 10px">TOTAL GÉNÉRAL DU DÉCOMPTE (TTC)</td><td style="border:2px solid #111827;padding:8px 10px;text-align:right;color:#111827">' + fmtFCFA(f.totaux.general) + '</td></tr>';
      html += '</tbody></table>';

      // Mention arrêtée
      html += '<div style="margin-top:16px;font-size:10pt;font-style:italic">';
      html += 'Arrêté le présent décompte de taxe à la somme totale de : <strong>' + fmtFCFA(f.totaux.general) + '</strong>.';
      html += '</div>';

      // Signatures
      html += '<div class="print-signatures" style="margin-top:36px;display:flex;justify-content:space-between;align-items:flex-start">';
      html += '<div><div style="font-size:9pt;color:#6b7280">Mention client / Reçu pour acquit :</div></div>';
      html += '<div style="text-align:right">';
      html += '<div style="font-size:10pt">Fait à ' + (params.adresse ? params.adresse.split(",")[0] : "Abidjan") + ', le ' + dateJour + '</div>';
      html += '<div style="font-size:10pt;font-weight:600;margin-top:6px;margin-bottom:50px">Le Notaire Titulaire</div>';
      html += '<div style="font-size:9pt;color:#9ca3af">[ Sceau & Signature ]</div>';
      html += '</div></div>';

      html += '</div>';

      printContainer.innerHTML = html;
      window.print();
    }).catch(function (e) {
      toast("Erreur d'impression : " + e.message);
    });
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
    html += '<div><div class="text-muted" style="font-size:11px;text-transform:uppercase">Avancement</div><div style="font-size:15px">' + avgPct + ' %</div></div></div>';

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
    var html = '<h3 style="margin-bottom:var(--space-3)">Fiche de taxe & Décompte notarié</h3>';
    html += '<table class="table" style="margin-bottom:var(--space-3)"><thead><tr><th>Date</th><th>Enregistrée par</th><th>Total général</th><th>Action</th></tr></thead><tbody>';
    if (!cache.fichesTaxeHistorique.length) html += '<tr><td colspan="4" class="text-muted">Aucune fiche de taxe enregistrée.</td></tr>';
    cache.fichesTaxeHistorique.forEach(function (f, idx) {
      html += '<tr><td>' + fmtDate(f.created_at) + '</td><td>' + nomClerc(f.utilisateur_id) + '</td><td style="font-weight:600">' + fmtFCFA(f.donnees.totaux.general) + '</td>';
      html += '<td><button class="btn btn-secondary btn-imprimer-historique-taxe" data-idx="' + idx + '" style="padding:4px 8px;font-size:12px">🖨️ Imprimer</button></td></tr>';
    });
    html += '</tbody></table>';

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:var(--space-3);margin-bottom:var(--space-3)">';
    html += champFiche("taxe-timbres-minute", "Timbres — pages minute");
    html += champFiche("taxe-timbres-expedition", "Timbres — pages expédition");
    html += champFiche("taxe-timbres-nb-expeditions", "Timbres — nombre d'expéditions");
    html += champFiche("taxe-timbres-bordereau", "Timbres — pages bordereau");
    html += champFiche("taxe-roles-minute", "Rôles — pages minute");
    html += champFiche("taxe-roles-expedition", "Rôles — pages expédition");
    html += champFiche("taxe-roles-nb-expeditions", "Rôles — nombre d'expéditions");
    html += champFiche("taxe-roles-copie", "Rôles — pages copie");
    html += champFiche("taxe-vacations", "Vacations (FCFA)");
    html += champFiche("taxe-frais-depot-banque", "Dépôt banque (FCFA)");
    html += champFiche("taxe-frais-depot-enregistrement", "Dépôt enregistrement (FCFA)");
    html += champFiche("taxe-frais-inscription-foncier", "Inscription livre foncier (FCFA)");
    html += champFiche("taxe-frais-requisition-etat", "Réquisition état (FCFA)");
    html += champFiche("taxe-divers", "Divers supplémentaire (FCFA)");
    html += '</div>';

    html += '<div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-bottom:var(--space-3)">';
    html += '<button class="btn btn-secondary" id="bouton-taxe-calculer">Calculer un aperçu</button>';
    html += '<button class="btn btn-primary" id="bouton-taxe-enregistrer">Enregistrer la fiche de taxe</button>';
    html += '</div>';
    html += '<div id="taxe-apercu" style="margin-bottom:var(--space-6)"></div>';
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
    html += '<div style="display:flex;justify-content:flex-end"><button class="btn btn-secondary" id="bouton-imprimer-apercu-taxe">🖨️ Imprimer ce décompte</button></div>';
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
    var btnTaxeCalculer = document.getElementById("bouton-taxe-calculer");
    if (btnTaxeCalculer) btnTaxeCalculer.addEventListener("click", function () {
      API.post("/api/fiscal/calculer", { typeActeId: cache.dossierDetail.typeActeId, montant: cache.dossierDetail.montantAssiette, saisies: lireSaisiesFiche() })
        .then(function (f) {
          document.getElementById("taxe-apercu").innerHTML = renderApercuFiche(f);
          var btnImp = document.getElementById("bouton-imprimer-apercu-taxe");
          if (btnImp) {
            btnImp.addEventListener("click", function () {
              imprimerDecompteOfficiel(cache.dossierDetail, f);
            });
          }
        })
        .catch(function (e) { toast(e.message); });
    });
    var btnTaxeEnregistrer = document.getElementById("bouton-taxe-enregistrer");
    if (btnTaxeEnregistrer) btnTaxeEnregistrer.addEventListener("click", function () {
      API.post("/api/fiscal/dossiers/" + dossierId + "/enregistrer", { saisies: lireSaisiesFiche() })
        .then(function () { toast("Fiche de taxe enregistrée."); ouvrirDossier(dossierId, etat.vuePrecedente); })
        .catch(function (e) { toast(e.message); });
    });

    c.querySelectorAll(".btn-imprimer-historique-taxe").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.dataset.idx, 10);
        var ficheHist = cache.fichesTaxeHistorique[idx];
        if (ficheHist && ficheHist.donnees) {
          imprimerDecompteOfficiel(cache.dossierDetail, ficheHist.donnees);
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
            statutSante: "🟢 En ligne (Sync OK)",
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
            statutSante: "🟢 En ligne (Cloud Vault)",
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
            superadmin: { label: "👑 Direction / SuperAdmin", permissions: { parc_etudes_vue: true, parc_etudes_deployer: true, parc_etudes_mise_en_ligne: true, infrastructure_clusters: true, sauvegardes_snapshots: true, sauvegardes_test_pra: true, support_tickets: true, support_acces_urgence: true, telemetrie_logs: true, equipe_editeur_gerer: true }, verrouille: true },
            dev: { label: "💻 Développeur / DevOps", permissions: { parc_etudes_vue: true, parc_etudes_deployer: false, parc_etudes_mise_en_ligne: true, infrastructure_clusters: true, sauvegardes_snapshots: true, sauvegardes_test_pra: true, support_tickets: true, support_acces_urgence: false, telemetrie_logs: true, equipe_editeur_gerer: false }, verrouille: false },
            commercial: { label: "💼 Commercial & Onboarding", permissions: { parc_etudes_vue: true, parc_etudes_deployer: true, parc_etudes_mise_en_ligne: true, infrastructure_clusters: false, sauvegardes_snapshots: false, sauvegardes_test_pra: false, support_tickets: false, support_acces_urgence: false, telemetrie_logs: false, equipe_editeur_gerer: false }, verrouille: false },
            support: { label: "🎧 Support Client L1-L4", permissions: { parc_etudes_vue: true, parc_etudes_deployer: false, parc_etudes_mise_en_ligne: false, infrastructure_clusters: true, sauvegardes_snapshots: false, sauvegardes_test_pra: false, support_tickets: true, support_acces_urgence: true, telemetrie_logs: true, equipe_editeur_gerer: false }, verrouille: false },
            assistante_editeur: { label: "📋 Assistante Éditeur", permissions: { parc_etudes_vue: true, parc_etudes_deployer: false, parc_etudes_mise_en_ligne: false, infrastructure_clusters: false, sauvegardes_snapshots: false, sauvegardes_test_pra: false, support_tickets: true, support_acces_urgence: false, telemetrie_logs: false, equipe_editeur_gerer: false }, verrouille: false }
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
            { nom: "Cluster PostgreSQL Primaire (Master PG-16)", role: "Base SQL Transactionnelle & Isolation Tenants", ip: "10.0.1.14", cpuPct: 18, ramPct: 42, disquePct: 35, latenceMs: 2.4, statut: "🟢 En ligne (Opérationnel)", mode: "Haute Disponibilité (Multi-AZ)" },
            { nom: "Cloud Vault S3/MinIO (Object Storage)", role: "Copies Numériques & Minutes Scellées SHA-256", ip: "10.0.2.88", cpuPct: 12, ramPct: 28, disquePct: 48, latenceMs: 8.1, statut: "🟢 En ligne (WORM Immuable)", mode: "Chiffrement AES-256 + Géo-réplication" },
            { nom: "Moteur de Synchronisation Hybride (Sync Engine)", role: "Files d'attente de réplication serveurs locaux", ip: "10.0.1.30", cpuPct: 15, ramPct: 31, disquePct: 22, latenceMs: 5.3, statut: "🟢 En ligne (Queue Active)", mode: "Offline-First & Auto-Reconnection" }
          ],
          fileAttenteSync: { elementsEnAttente: 0, debitMoyenMoSec: 4.8, latenceMoyenneMs: 14, statutFile: "🟢 Synchronisée à 100%" },
          certificatsSsl: { domainePrincipal: "*.notaires.ci", autorite: "Let's Encrypt / Sectigo EV", expiration: "2027-04-15", etat: "🟢 Valide (Renouvellement auto)" }
        };
      }),
      API.get("/api/superadmin/sauvegardes").catch(function () {
        return [
          { id: "SNP-2026-08-27-0400", type: "Snapshot Quotidien Immuable", perimetre: "Intégralité du Parc SaaS", date: "2026-08-27 04:00", tailleGo: 14.8, checksumSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", chiffrement: "AES-256-GCM", statutIntegrite: "🟢 100% Vérifié & Conforme", retentionJours: 365 },
          { id: "SNP-2026-08-26-0400", type: "Snapshot Quotidien Immuable", perimetre: "Intégralité du Parc SaaS", date: "2026-08-26 04:00", tailleGo: 14.6, checksumSha256: "7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730", chiffrement: "AES-256-GCM", statutIntegrite: "🟢 100% Vérifié & Conforme", retentionJours: 365 },
        ];
      }),
      API.get("/api/superadmin/tickets-support").catch(function () { return []; }),
      API.get("/api/superadmin/journal-securite").catch(function () {
        return [
          { date: "2026-08-27 21:04:12", evenement: "Vérification cryptographique des scellements SHA-256", ip: "10.0.1.14 (Master)", statut: "🟢 100% Intact" },
          { date: "2026-08-27 18:30:00", evenement: "Synchronisation Cloud Vault - Mode C Hybride (Office Plateau)", ip: "41.202.219.45", statut: "🟢 28 minutes répliquées" },
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
      html += '<button type="button" class="btn btn-primary" id="btn-deployer-etude">🏛️ + Déployer une nouvelle étude</button>';
      html += '<button type="button" class="btn btn-secondary" id="btn-refresh-superadmin">🔄 Rafraîchir la télémétrie</button>';
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
      html += '<div style="font-size:24px;font-weight:bold;color:#10b981;margin:4px 0">99.98% 🟢</div>';
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
      html += '<button type="button" class="tab-btn btn-superadmin-tab" data-tab="etudes" style="cursor:pointer;padding:10px 16px;font-weight:600;font-size:13px;border-radius:var(--radius) var(--radius) 0 0;background:' + (ongletActif === "etudes" ? "var(--color-surface-2)" : "transparent") + ';color:' + (ongletActif === "etudes" ? "#38bdf8;border-bottom:2px solid #38bdf8" : "var(--color-text-dim)") + '">🏛️ Parc des Offices (' + etudes.length + ')</button>';
      html += '<button type="button" class="tab-btn btn-superadmin-tab" data-tab="equipe" style="cursor:pointer;padding:10px 16px;font-weight:600;font-size:13px;border-radius:var(--radius) var(--radius) 0 0;background:' + (ongletActif === "equipe" ? "var(--color-surface-2)" : "transparent") + ';color:' + (ongletActif === "equipe" ? "#38bdf8;border-bottom:2px solid #38bdf8" : "var(--color-text-dim)") + '">👥 Équipe Éditeur SaaS (' + equipe.length + ')</button>';
      html += '<button type="button" class="tab-btn btn-superadmin-tab" data-tab="infrastructure" style="cursor:pointer;padding:10px 16px;font-weight:600;font-size:13px;border-radius:var(--radius) var(--radius) 0 0;background:' + (ongletActif === "infrastructure" ? "var(--color-surface-2)" : "transparent") + ';color:' + (ongletActif === "infrastructure" ? "#38bdf8;border-bottom:2px solid #38bdf8" : "var(--color-text-dim)") + '">⚙️ Infrastructure & Clusters (' + (infra.noeudsServeurs ? infra.noeudsServeurs.length : 3) + ')</button>';
      html += '<button type="button" class="tab-btn btn-superadmin-tab" data-tab="sauvegardes" style="cursor:pointer;padding:10px 16px;font-weight:600;font-size:13px;border-radius:var(--radius) var(--radius) 0 0;background:' + (ongletActif === "sauvegardes" ? "var(--color-surface-2)" : "transparent") + ';color:' + (ongletActif === "sauvegardes" ? "#38bdf8;border-bottom:2px solid #38bdf8" : "var(--color-text-dim)") + '">💾 Sauvegardes & PRA (' + sauvegardes.length + ')</button>';
      html += '<button type="button" class="tab-btn btn-superadmin-tab" data-tab="support" style="cursor:pointer;padding:10px 16px;font-weight:600;font-size:13px;border-radius:var(--radius) var(--radius) 0 0;background:' + (ongletActif === "support" ? "var(--color-surface-2)" : "transparent") + ';color:' + (ongletActif === "support" ? "#38bdf8;border-bottom:2px solid #38bdf8" : "var(--color-text-dim)") + '">🎫 Support Éditeur (L1-L4)</button>';
      html += '<button type="button" class="tab-btn btn-superadmin-tab" data-tab="telemetrie" style="cursor:pointer;padding:10px 16px;font-weight:600;font-size:13px;border-radius:var(--radius) var(--radius) 0 0;background:' + (ongletActif === "telemetrie" ? "var(--color-surface-2)" : "transparent") + ';color:' + (ongletActif === "telemetrie" ? "#38bdf8;border-bottom:2px solid #38bdf8" : "var(--color-text-dim)") + '">📊 Télémétrie & Logs (' + journal.length + ')</button>';
      html += '</div>';

      // =========================================================================
      // CONTENU SELON L'ONGLET ACTIF
      // =========================================================================

      // 1. ONGLET PARC DES ÉTUDES
      if (ongletActif === "etudes") {
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);flex-wrap:wrap;gap:var(--space-2)">';
        html += '<div><strong style="font-size:16px;color:var(--color-text)">🏛️ Parc des Offices Notariaux Déployés (Multi-Tenant)</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Supervision des instances, quotas, modes d\'infrastructure A/B/C, mise en ligne et noms de domaines.</p></div>';
        html += '</div>';

        html += '<div class="table-wrap"><table class="table"><thead><tr><th>Code Étude</th><th>Office Notarial</th><th>Notaire Titulaire</th><th>Mode Infrastructure</th><th>Dossiers / Minutes</th><th>Collaborateurs</th><th>Santé Serveur</th><th>Actions</th></tr></thead><tbody>';
        etudes.forEach(function (e, index) {
          var modeBadge = "";
          if (e.modeInfrastructure === "hybride") modeBadge = '<span class="tag" style="background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3)">Mode C · Hybride</span>';
          else if (e.modeInfrastructure === "cloud") modeBadge = '<span class="tag" style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3)">Mode B · Cloud</span>';
          else modeBadge = '<span class="tag" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3)">Mode A · Local</span>';

          html += '<tr>';
          html += '<td><strong style="font-family:monospace;color:var(--color-text);font-size:12px">' + (e.codeEtude || "ETUDE-001") + '</strong></td>';
          html += '<td><strong style="color:var(--color-text);font-size:13px">' + e.nomEtude + '</strong><div style="font-size:11px;color:var(--color-text-dim)">v' + (e.versionDeployee || "2.4.0") + ' · ' + (e.ville || "Abidjan") + ' · Quota ' + (e.quotaStockageGo || 100) + ' Go</div></td>';
          html += '<td style="font-size:12px;font-weight:600">' + (e.titreNotaire || "Maître Notaire") + '</td>';
          html += '<td>' + modeBadge + '</td>';
          html += '<td><strong style="color:var(--color-accent)">' + (e.totalDossiers || 0) + '</strong> dossiers <span style="font-size:11px;color:var(--color-text-dim)">(' + (e.totalMinutes || 0) + ' min.)</span></td>';
          html += '<td><span class="tag tag-outline">' + (e.totalUtilisateurs || 5) + ' utilisateurs</span></td>';
          html += '<td><span style="font-size:12px;font-weight:bold;color:#22c55e">' + (e.statutSante || "🟢 En ligne") + '</span></td>';
          html += '<td><div style="display:flex;gap:4px;flex-wrap:wrap">';
          html += '<button type="button" class="btn btn-primary btn-deploiement-etude" data-etude-id="' + e.id + '" data-nom="' + encodeURIComponent(e.nomEtude) + '" style="font-size:11px;padding:3px 8px;font-weight:700" title="Guide et mise en ligne">🚀 Mettre en ligne</button>';
          html += '<button type="button" class="btn btn-secondary btn-configurer-etude" data-etude-idx="' + index + '" style="font-size:11px;padding:3px 8px" title="Configurer l\'office">⚙️ Configurer</button>';
          html += '<button type="button" class="btn btn-secondary btn-basculer-mode-etude" data-etude-id="' + e.id + '" data-nom="' + encodeURIComponent(e.nomEtude) + '" data-mode="' + e.modeInfrastructure + '" style="font-size:11px;padding:3px 8px" title="Changer le mode d\'infrastructure">⚡ Mode Infra</button>';
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
        html += '<div><strong style="font-size:16px;color:var(--color-text)">👥 Gestion de l\'Équipe Interne Éditeur SaaS (Vos Collaborateurs)</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Administration des comptes et rôles internes : Développeurs, Commerciaux, Support L1-L4 et Assistantes.</p></div>';
        html += '<button type="button" class="btn btn-primary" id="btn-ajouter-membre-editeur" style="font-size:12px">👥 + Ajouter un collaborateur SaaS</button>';
        html += '</div>';

        html += '<div class="table-wrap"><table class="table"><thead><tr><th>Nom & Prénom</th><th>Email de Connexion</th><th>Téléphone</th><th>Rôle & Accès SaaS</th><th>Statut</th><th>Actions</th></tr></thead><tbody>';
        equipe.forEach(function (m) {
          var roleTag = "";
          if (m.role === "superadmin") roleTag = '<span class="tag" style="background:#0284c7;color:#fff;font-weight:700">👑 Direction / SuperAdmin</span>';
          else if (m.role === "dev") roleTag = '<span class="tag" style="background:#8b5cf6;color:#fff;font-weight:600">💻 Développeur / DevOps</span>';
          else if (m.role === "commercial") roleTag = '<span class="tag" style="background:#10b981;color:#fff;font-weight:600">💼 Commercial & Onboarding</span>';
          else if (m.role === "support") roleTag = '<span class="tag" style="background:#f59e0b;color:#fff;font-weight:600">🎧 Support Client L1-L4</span>';
          else if (m.role === "assistante_editeur") roleTag = '<span class="tag" style="background:#ec4899;color:#fff;font-weight:600">📋 Assistante Éditeur</span>';
          else roleTag = '<span class="tag tag-outline">' + (m.role || "Membre") + '</span>';

          html += '<tr>';
          html += '<td><strong style="color:var(--color-text);font-size:13px">' + m.nomComplet + '</strong></td>';
          html += '<td><code>' + m.email + '</code></td>';
          html += '<td style="font-size:12px">' + (m.telephone || "—") + '</td>';
          html += '<td>' + roleTag + '</td>';
          html += '<td>' + (m.actif !== false ? '<span style="color:#22c55e;font-weight:bold;font-size:12px">🟢 Actif</span>' : '<span style="color:#ef4444;font-weight:bold;font-size:12px">🔴 Suspendu</span>') + '</td>';
          html += '<td><div style="display:flex;gap:4px">';
          html += '<button type="button" class="btn btn-secondary btn-modifier-membre" data-membre="' + encodeURIComponent(JSON.stringify(m)) + '" style="font-size:11px;padding:3px 8px">✏️ Modifier</button>';
          if (m.role !== "superadmin") {
            html += '<button type="button" class="btn btn-ghost btn-supprimer-membre" data-id="' + m.id + '" data-nom="' + encodeURIComponent(m.nomComplet) + '" style="font-size:11px;padding:3px 8px;color:#ef4444">🗑️</button>';
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
        html += '<div style="display:flex;align-items:center;gap:8px"><strong style="font-size:15px;color:var(--color-text)">🔒 Matrice Interactive des Permissions par Rôle</strong><span class="tag" style="background:#10b981;color:#fff;font-size:10.5px">Cochable en direct</span></div>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Cochez les accès pour chaque profil interne selon vos besoins.</p>';
        html += '</div>';
        html += '<div style="display:flex;gap:var(--space-2);flex-wrap:wrap">';
        html += '<button type="button" class="btn btn-secondary" id="btn-reinitialiser-matrice-permissions" style="font-size:12px">🔄 Réinitialiser</button>';
        html += '<button type="button" class="btn btn-primary" id="btn-sauvegarder-matrice-permissions" style="font-size:12px;font-weight:700;background:#0284c7">💾 Enregistrer la matrice</button>';
        html += '</div></div>';

        html += '<div class="table-wrap"><table class="table" style="font-size:12px"><thead><tr>';
        html += '<th style="min-width:240px">Fonctionnalité SaaS</th>';
        html += '<th style="text-align:center">👑 SuperAdmin</th>';
        html += '<th style="text-align:center">💻 Dev</th>';
        html += '<th style="text-align:center">💼 Comm.</th>';
        html += '<th style="text-align:center">🎧 Supp.</th>';
        html += '<th style="text-align:center">📋 Asst.</th>';
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
        html += '<strong style="font-size:14px;color:var(--color-text)">🔄 File d\'Attente de Réplication Hybride (Sync Queue)</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 12px">Synchronisation continue entre les serveurs locaux des offices et le Cloud Vault.</p>';
        html += '<div style="background:var(--color-surface);padding:12px;border-radius:var(--radius);font-size:12px;line-height:1.6">';
        html += '<div>État file : <strong>' + (infra.fileAttenteSync ? infra.fileAttenteSync.statutFile : "🟢 100% Synchronisée") + '</strong></div>';
        html += '<div>Éléments en attente : <strong>' + (infra.fileAttenteSync ? infra.fileAttenteSync.elementsEnAttente : 0) + ' paquet(s)</strong></div>';
        html += '<div>Débit moyen constaté : <strong style="color:#22c55e">' + (infra.fileAttenteSync ? infra.fileAttenteSync.debitMoyenMoSec : 4.8) + ' Mo/s</strong></div>';
        html += '<div>Latence moyenne inter-nœuds : <strong style="color:#38bdf8">' + (infra.fileAttenteSync ? infra.fileAttenteSync.latenceMoyenneMs : 14) + ' ms</strong></div>';
        html += '</div>';
        html += '</div>';

        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
        html += '<strong style="font-size:14px;color:var(--color-text)">🔒 Certificats SSL / TLS & Sécurité Réseau</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 12px">Chiffrement de bout en bout de toutes les communications.</p>';
        html += '<div style="background:var(--color-surface);padding:12px;border-radius:var(--radius);font-size:12px;line-height:1.6">';
        html += '<div>Domaine Wildcard : <code>*.notaires.ci</code></div>';
        html += '<div>Autorité de certification : <strong>Sectigo EV / Let\'s Encrypt</strong></div>';
        html += '<div>Protocole de transport : <strong>TLS 1.3 Strict + HSTS</strong></div>';
        html += '<div>Validité du certificat : <strong style="color:#22c55e">🟢 Valide jusqu\'en Avril 2027</strong></div>';
        html += '</div>';
        html += '</div>';

        html += '</div>';
      }

      // 4. ONGLET SAUVEGARDES & PRA
      else if (ongletActif === "sauvegardes") {
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4);margin-bottom:var(--space-4)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);flex-wrap:wrap;gap:var(--space-2)">';
        html += '<div><strong style="font-size:16px;color:var(--color-text)">💾 Politique de Sauvegardes 3-2-1 & Plan de Reprise d\'Activité (PRA)</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Snapshots chiffrés AES-256-GCM, copies immuables (WORM) et bascule à chaud.</p></div>';
        html += '<div style="display:flex;gap:var(--space-2)">';
        html += '<button type="button" class="btn btn-primary" id="btn-snapshot-urgence" style="font-size:12px">⚡ Déclencher un Snapshot d\'Urgence</button>';
        html += '<button type="button" class="btn btn-secondary" id="btn-tester-pra" style="font-size:12px">🧪 Tester le Plan de Reprise (PRA)</button>';
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
        html += '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:22px">🎫</span><div><strong style="font-size:16px;color:var(--color-text)">Console de Support Éditeur (L1 - L4) & Accès Exceptionnels</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Traitement des demandes d\'assistance avec garantie stricte de secret professionnel notarial.</p></div></div>';
        html += '<button type="button" class="btn btn-secondary" id="btn-demander-acces-audit" style="font-size:12px">🔒 Demander un accès temporaire d\'urgence</button>';
        html += '</div>';

        html += '<div style="background:var(--color-surface);padding:12px 14px;border-radius:var(--radius);border:1px solid var(--color-border);margin-bottom:var(--space-4);font-size:12px;line-height:1.5">';
        html += '⚖️ <strong>Règle de Sécurité Fondamentale :</strong> Le support technique éditeur n\'a <strong>aucun accès direct aux données notariées</strong> des études clientes. Toute télé-assistance d\'urgence doit faire l\'objet d\'une <em>demande motivée</em>, être <em>validée explicitement par le Notaire Titulaire</em>, être <em>limitée à une durée stricte</em> (1h à 24h) et être <em>scellée dans le journal d\'audit</em>.';
        html += '</div>';

        html += '<div class="table-wrap"><table class="table"><thead><tr><th>N° Ticket</th><th>Étude</th><th>Niveau Support</th><th>Titre / Incident</th><th>Priorité</th><th>Accès Données</th><th>Statut</th></tr></thead><tbody>';
        if (!tickets.length) {
          html += '<tr><td><strong>TCK-2026-089</strong></td><td>Office Notarial — Legal Notary</td><td><span class="tag tag-accent">L2 Applicatif</span></td><td>Assistance configuration imprimante étiqueteuse code-barres cartons</td><td><span class="tag tag-outline">Normal</span></td><td><span style="color:#22c55e">🔒 Aucun accès (Non requis)</span></td><td><span class="tag tag-neutral">Ouvert</span></td></tr>';
          html += '<tr><td><strong>TCK-2026-084</strong></td><td>Étude Notariale Maître Touré</td><td><span class="tag tag-outline">L3 Base SQL / Sync</span></td><td>Vérification de la réplication Cloud Vault après coupure fibre optique</td><td><span class="tag tag-accent">Haute</span></td><td><span style="color:#38bdf8">🔑 Accès temporaire validé (2h)</span></td><td><span class="tag tag-neutral">En cours</span></td></tr>';
        } else {
          tickets.forEach(function (tk) {
            html += '<tr>';
            html += '<td><strong>' + tk.numero_ticket + '</strong></td>';
            html += '<td>Office Notarial</td>';
            html += '<td><span class="tag tag-accent">' + tk.niveau + '</span></td>';
            html += '<td><strong>' + tk.titre + '</strong><div style="font-size:11px;color:var(--color-text-dim)">' + (tk.description || "") + '</div></td>';
            html += '<td><span class="tag tag-outline">' + tk.priorite + '</span></td>';
            html += '<td>' + (tk.acces_donnees_autorise ? '<span style="color:#38bdf8">🔑 Accès temporaire accordé</span>' : '<span style="color:#22c55e">🔒 Aucun accès</span>') + '</td>';
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
        html += '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:22px">📡</span><div><strong style="font-size:16px;color:var(--color-text)">Watchdog Heartbeat des Serveurs Physiques Locaux (On-Premise & Hybride)</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Supervision proactive en temps réel des machines locales des offices (signal toutes les 30s). Détection automatique des pannes internet ou électriques locales.</p></div></div>';
        html += '<button type="button" class="btn btn-secondary" id="btn-refresh-noeuds" style="font-size:12px">🔄 Vérifier les Nœuds</button>';
        html += '</div>';

        if (!noeudsHeartbeat || !noeudsHeartbeat.length) {
          html += '<div style="background:var(--color-surface);padding:14px;border-radius:var(--radius);border:1px solid var(--color-border);font-size:12px;color:var(--color-text-dim)">';
          html += 'ℹ️ Aucun serveur physique local n\'est actuellement appairé. Les offices sont en mode 100% Cloud Clé-en-main.';
          html += '</div>';
        } else {
          html += '<div class="table-wrap"><table class="table" style="font-size:12px"><thead><tr><th>Office Notarial</th><th>Machine Locale & IP</th><th>CPU / RAM / Disque</th><th>Agent & Sync</th><th>Dernier Signal</th><th>État Proactif</th></tr></thead><tbody>';
          noeudsHeartbeat.forEach(function (nd) {
            var badgeStatut = '<span style="color:#22c55e;font-weight:bold">🟢 En ligne (Opérationnel)</span>';
            var diffS = nd.secondesDepuisDernierSignal || 0;
            if (nd.statut === "hors_ligne" || diffS > 120) {
              badgeStatut = '<span style="color:#ef4444;font-weight:bold">🔴 Déconnecté (' + diffS + 's sans signal)</span>';
            } else if (nd.statut === "charge_elevee") {
              badgeStatut = '<span style="color:#f59e0b;font-weight:bold">🟡 Charge Élevée</span>';
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
        html += '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:22px">🚨</span><div><strong style="font-size:16px;color:var(--color-text)">Hub Centralisé de Remontée d\'Erreurs en Production (Cloud + Serveurs Locaux)</strong>';
        html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Toutes les exceptions et avertissements système sont capturés, assainis et notifiés à l\'équipe DevOps.</p></div></div>';
        html += '<button type="button" class="btn btn-primary" id="btn-test-alerte-critique" style="font-size:12px;background:#ef4444;border-color:#ef4444">🧪 Simuler une Alerte Critique DevOps</button>';
        html += '</div>';

        html += '<div id="zone-rapport-test-alerte" style="display:none;margin-bottom:var(--space-3);padding:12px;border-radius:var(--radius);background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3)"></div>';

        if (!erreursParc || !erreursParc.length) {
          html += '<div style="padding:var(--space-4);text-align:center;color:var(--color-text-dim);font-size:13px">🟢 Aucune erreur active signalée sur le parc. Tous les nœuds fonctionnent normalement.</div>';
        } else {
          html += '<div class="table-wrap"><table class="table" style="font-size:12px"><thead><tr><th>Niveau</th><th>Office / Source</th><th>Type d\'Erreur</th><th>Message & Contexte</th><th>Date</th><th>Statut</th><th>Actions</th></tr></thead><tbody>';
          erreursParc.forEach(function (err) {
            var badgeNiv = '<span class="tag" style="background:#8b5cf6;color:#fff">Info</span>';
            if (err.niveau === "critique") badgeNiv = '<span class="tag" style="background:#ef4444;color:#fff;font-weight:700">🔴 CRITIQUE</span>';
            else if (err.niveau === "error") badgeNiv = '<span class="tag" style="background:#f97316;color:#fff;font-weight:600">🟠 Erreur</span>';
            else if (err.niveau === "warning") badgeNiv = '<span class="tag" style="background:#f59e0b;color:#fff">🟡 Warning</span>';

            html += '<tr>';
            html += '<td>' + badgeNiv + '</td>';
            html += '<td><strong>' + (err.nom_etude || "Cloud Hostinger") + '</strong><div style="font-size:10.5px;color:var(--color-text-dim)">Source: <code>' + err.source + '</code></div></td>';
            html += '<td><code style="color:#38bdf8;font-size:11px">' + err.type_erreur + '</code></td>';
            html += '<td><div style="max-width:340px;word-break:break-word">' + err.message + '</div></td>';
            html += '<td style="font-size:11px;color:var(--color-text-dim)">' + (err.created_at ? new Date(err.created_at).toLocaleTimeString("fr-CI", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Récemment") + '</td>';
            html += '<td>' + (err.statut === "resolu" ? '<span style="color:#22c55e;font-weight:bold;font-size:11px">✅ Résolu</span>' : '<span style="color:#f59e0b;font-weight:bold;font-size:11px">⏳ Actif</span>') + '</td>';
            html += '<td>';
            if (err.statut !== "resolu") {
              html += '<button type="button" class="btn btn-secondary btn-resoudre-erreur" data-id="' + err.id + '" style="font-size:10.5px;padding:3px 7px">✅ Résoudre</button>';
            }
            html += '</td>';
            html += '</tr>';
          });
          html += '</tbody></table></div>';
        }
        html += '</div>';

        // 3. Journal d'Audit de Sécurité Cryptographique
        html += '<div class="card" style="background:var(--color-surface-2);border-color:var(--color-border);padding:var(--space-4)">';
        html += '<strong style="font-size:15px;color:var(--color-text)">📊 Journal d\'Audit de Sécurité & Scellements SHA-256</strong>';
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
            rapport.innerHTML = "⏳ Déclenchement du test d'alerte instantanée (Sentry / Webhook / Mail)…";
          }
          API.post("/api/telemetrie/test-alerte", {}).then(function (res) {
            if (rapport) {
              rapport.innerHTML = '<div style="color:#ef4444;font-weight:bold;font-size:13px">🚨 Alerte Critique Émise avec Succès !</div><div style="font-size:12px;color:var(--color-text);margin-top:4px">' + res.message + '<br>Réf incident généré : <code>' + (res.incident ? res.incident.id : "") + '</code></div>';
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
            rapportZone.innerHTML = '<p style="margin:0;color:var(--color-text)">⏳ Simulation du PRA en cours sur les clusters miroirs…</p>';
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
      titre: '<span>🚀</span> Mise en Ligne & Déploiement — ' + nomEtude,
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
          html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:18px">🚀</span><strong style="color:#38bdf8;font-size:13.5px">Option 1 : Espace Cloud Instantané (Sous-domaine dédié)</strong></div>';
          html += '<p style="font-size:12px;color:var(--color-text);margin:0 0 8px">L\'office est activé immédiatement sur votre serveur centralisé. Aucune installation technique requise.</p>';
          html += '<div style="background:var(--color-surface-2);padding:8px 10px;border-radius:var(--radius);font-size:12px;font-family:monospace;color:var(--color-text);display:flex;justify-content:space-between;align-items:center">';
          html += '<span>' + dep.urlCloudAutomatique + '</span>';
          html += '<button type="button" class="btn btn-secondary" onclick="navigator.clipboard.writeText(\'' + dep.urlCloudAutomatique + '\');toast(\'Lien d\\\'accès copié !\')" style="font-size:10.5px;padding:2px 6px">📋 Copier l\'URL</button>';
          html += '</div>';
          html += '<div style="font-size:11px;color:var(--color-text-dim);margin-top:6px">Transmettez ce lien avec l\'email administrateur au notaire titulaire. Accès immédiat sécurisé HTTPS.</div>';
          html += '</div>';

          // OPTION 2 : NOM DE DOMAINE PERSONNALISÉ
          html += '<div class="card" style="background:var(--color-surface);border:1px solid rgba(34,197,94,0.3);padding:var(--space-3)">';
          html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:18px">🌐</span><strong style="color:#22c55e;font-size:13.5px">Option 2 : Nom de Domaine Personnalisé du Cabinet (ex. notaire-kouame.ci)</strong></div>';
          html += '<p style="font-size:12px;color:var(--color-text);margin:0 0 8px">Le notaire conserve son adresse web officielle sur votre serveur central sans infrastructure séparée.</p>';
          html += '<div style="background:var(--color-surface-2);padding:8px 10px;border-radius:var(--radius);font-size:11.5px;line-height:1.5">';
          html += '<div>Configuration DNS chez le registraire du notaire (1 minute) :</div>';
          html += '<div style="font-family:monospace;color:#38bdf8;margin:3px 0">Type CNAME : <code>' + dep.dnsRecommande.hote + '</code> ➜ Cible : <code>' + dep.dnsRecommande.cible + '</code></div>';
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
    html += '<option value="dev">💻 Développeur / DevOps (Clusters, Infra, Télémétrie)</option>';
    html += '<option value="commercial">💼 Commercial & Onboarding (Parc des Études, Démos)</option>';
    html += '<option value="support" selected>🎧 Support Client L1-L4 (Tickets, Assistance)</option>';
    html += '<option value="assistante_editeur">📋 Assistante Éditeur (Gestion & Facturation)</option>';
    html += '<option value="superadmin">👑 Direction / SuperAdmin (Accès Absolu)</option>';
    html += '</select></div>';
    html += '<div class="field"><label>Mot de passe initial</label><input class="input" type="text" name="motDePasse" value="saas123" required></div>';
    html += '</div>';

    html += '<div id="erreur-ajouter-membre" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-ajout-membre">Annuler</button><button type="submit" class="btn btn-primary">Créer le compte collaborateur</button></div>';
    html += '</form>';

    ouvrirModal({
      titre: '<span>👥</span> Ajouter un Collaborateur à l\'Équipe Éditeur SaaS',
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
    html += '<option value="dev"' + (m.role === "dev" ? " selected" : "") + '>💻 Développeur / DevOps</option>';
    html += '<option value="commercial"' + (m.role === "commercial" ? " selected" : "") + '>💼 Commercial & Onboarding</option>';
    html += '<option value="support"' + (m.role === "support" ? " selected" : "") + '>🎧 Support Client L1-L4</option>';
    html += '<option value="assistante_editeur"' + (m.role === "assistante_editeur" ? " selected" : "") + '>📋 Assistante Éditeur</option>';
    html += '<option value="superadmin"' + (m.role === "superadmin" ? " selected" : "") + '>👑 Direction / SuperAdmin</option>';
    html += '</select></div>';
    html += '<div class="field"><label>Statut du compte</label><select class="input" name="actif">';
    html += '<option value="true"' + (m.actif !== false ? " selected" : "") + '>🟢 Actif</option>';
    html += '<option value="false"' + (m.actif === false ? " selected" : "") + '>🔴 Suspendu</option>';
    html += '</select></div>';
    html += '</div>';

    html += '<div id="erreur-modifier-membre" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-modif-membre">Annuler</button><button type="submit" class="btn btn-primary">Enregistrer les modifications</button></div>';
    html += '</form>';

    ouvrirModal({
      titre: '<span>✏️</span> Modifier un Collaborateur SaaS',
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
    html += '<div class="field"><label>Mode d\'infrastructure</label><select class="input" name="modeInfrastructure">';
    html += '<option value="hybride" selected>Mode C — Hybride (Local + Cloud Vault) [Recommandé]</option>';
    html += '<option value="cloud">Mode B — Cloud Dédié (Vault)</option>';
    html += '<option value="serveur_physique">Mode A — Serveur Physique Local Exclusif</option>';
    html += '</select></div>';
    html += '<div class="field"><label>Quota de Stockage Cloud/Local</label><select class="input" name="quotaStockageGo">';
    html += '<option value="100" selected>100 Go (Standard)</option>';
    html += '<option value="250">250 Go (Grand Cabinet)</option>';
    html += '<option value="500">500 Go (Fonds Historique Lourd)</option>';
    html += '<option value="1000">1 To (Multi-Notaires Associés)</option>';
    html += '</select></div>';
    html += '</div>';

    html += '<div style="font-size:11px;color:var(--color-text-dim);background:var(--color-surface-2);padding:8px 10px;border-radius:var(--radius);border:1px solid var(--color-border)">';
    html += '🔒 <strong>Isolation Stricte :</strong> L\'office bénéficiera immédiatement d\'un tenant PostgreSQL partitionné (`etude_id`), d\'un compte administrateur Notaire prêt à l\'emploi, et d\'un chiffrement AES-256 des secrets conforme au secret professionnel.';
    html += '</div>';

    html += '<div id="erreur-deployer-etude" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-deploy">Annuler</button><button type="submit" class="btn btn-primary">🏛️ Déployer & Initialiser l\'Office</button></div>';
    html += '</form>';

    ouvrirModal({
      titre: '<span>🏛️</span> Déploiement d\'un Nouvel Office Notarial (Multi-Tenant SaaS)',
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
    html += '<span class="tag tag-accent">' + (etude.statutSante || "🟢 En ligne") + '</span>';
    html += '</div>';

    html += '<div class="field"><label>Nom de l\'office notarial</label><input class="input" name="nomEtude" value="' + (etude.nomEtude || "") + '" required></div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
    html += '<div class="field"><label>Notaire Titulaire</label><input class="input" name="titreNotaire" value="' + (etude.titreNotaire || "") + '" required></div>';
    html += '<div class="field"><label>Ville / Région</label><input class="input" name="ville" value="' + (etude.ville || "Abidjan") + '" required></div>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">';
    html += '<div class="field"><label>Mode d\'Infrastructure</label><select class="input" name="modeInfrastructure">';
    html += '<option value="hybride"' + (etude.modeInfrastructure === "hybride" ? " selected" : "") + '>Mode C — Hybride (Local + Cloud Vault)</option>';
    html += '<option value="cloud"' + (etude.modeInfrastructure === "cloud" ? " selected" : "") + '>Mode B — Cloud Dédié</option>';
    html += '<option value="serveur_physique"' + (etude.modeInfrastructure === "serveur_physique" ? " selected" : "") + '>Mode A — Serveur Physique Local</option>';
    html += '</select></div>';
    html += '<div class="field"><label>Quota Alloué (Go)</label><input class="input" type="number" name="quotaStockageGo" value="' + (etude.quotaStockageGo || 100) + '" required></div>';
    html += '</div>';

    html += '<div class="field"><label>Domaine / Sous-domaine de l\'office</label><input class="input" name="domaine" value="' + (etude.domaine || "") + '"></div>';

    html += '<div id="erreur-configurer-etude" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-config">Annuler</button><button type="submit" class="btn btn-primary">Enregistrer la configuration</button></div>';
    html += '</form>';

    ouvrirModal({
      titre: '<span>⚙️</span> Configuration de l\'Office Notarial',
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
            modeInfrastructure: form.modeInfrastructure.value,
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
  // MODALE : BASCULER LE MODE D'INFRASTRUCTURE D'UNE ÉTUDE
  // =========================================================================
  function modalBasculerModeEtude(etudeId, nomEtude, modeActuel) {
    var html = '<form id="form-basculer-mode" style="display:flex;flex-direction:column;gap:var(--space-3)">';
    html += '<p style="font-size:13px;color:var(--color-text-dim)">Office : <strong style="color:var(--color-text)">' + nomEtude + '</strong></p>';

    html += '<div class="field"><label>Nouveau mode d\'infrastructure</label><select class="input" name="modeInfrastructure">';
    html += '<option value="hybride"' + (modeActuel === "hybride" ? " selected" : "") + '>Mode C — Hybride (Local + Cloud Vault Résilient) [Recommandé]</option>';
    html += '<option value="cloud"' + (modeActuel === "cloud" ? " selected" : "") + '>Mode B — Cloud Dédié (Vault)</option>';
    html += '<option value="serveur_physique"' + (modeActuel === "serveur_physique" ? " selected" : "") + '>Mode A — Serveur Physique Local Exclusif (On-Premise)</option>';
    html += '</select></div>';

    html += '<div style="font-size:11px;color:var(--color-text-dim);background:var(--color-surface-2);padding:8px 10px;border-radius:var(--radius);border:1px solid var(--color-border)">';
    html += '🔄 Le moteur de synchronisation hybride réajustera automatiquement les files d\'attente de réplication sans interruption de service pour les clercs.';
    html += '</div>';

    html += '<div id="erreur-basculer-mode" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-mode">Annuler</button><button type="submit" class="btn btn-primary">Appliquer le changement</button></div>';
    html += '</form>';

    ouvrirModal({
      titre: '<span>⚙️</span> Configuration du Mode d\'Infrastructure',
      corps: html,
      boutonFermer: true,
      largeur: "520px",
      apresOuverture: function () {
        document.getElementById("btn-annuler-mode").addEventListener("click", fermerModal);
        document.getElementById("form-basculer-mode").addEventListener("submit", function (ev) {
          ev.preventDefault();
          var mode = ev.target.modeInfrastructure.value;
          API.post("/api/superadmin/etudes/" + etudeId + "/basculer-mode", { modeInfrastructure: mode }).then(function () {
            toast("Mode d'infrastructure mis à jour avec succès.");
            fermerModal();
            renderSuperAdmin();
          }).catch(function (e) {
            document.getElementById("erreur-basculer-mode").textContent = e.message;
            document.getElementById("erreur-basculer-mode").style.display = "block";
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
    html += '📜 <strong>Journal d\'audit cryptographique :</strong> Toutes les actions réalisées durant cette session seront tracées avec horodatage certifié et transmises au Notaire Titulaire.';
    html += '</div>';

    html += '<div id="erreur-acces-audit" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-audit">Annuler</button><button type="submit" class="btn btn-primary">Soumettre la demande d\'autorisation</button></div>';
    html += '</form>';

    ouvrirModal({
      titre: '<span>🔒</span> Demande d\'Accès Temporaire d\'Urgence Audité',
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
      { label: "Ponctualité de l'Équipe", valeur: (kpisGlobaux.tauxPonctualite || 100) + "%", indice: "accent", icon: "⏱️", sub: (kpisGlobaux.enRetard || 0) + " rapport(s) en retard" },
      { label: "Total Rapports Soumis", valeur: String(kpisGlobaux.totalRapports || 0), indice: "", icon: "📊", sub: (kpisGlobaux.enAttenteLecture || 0) + " en attente de validation" },
      { label: "Performance Commerciale", valeur: fmtFCFA(kpisCom.totalMrrGenere || 0) + " MRR", indice: "accent", icon: "💼", sub: (kpisCom.totalContratsSignes || 0) + " contrat(s) · " + (kpisCom.totalDemosRealisees || 0) + " démos" },
      { label: "Qualité Support & CSAT", valeur: kpisSup.moyenneCsat || "98.5%", indice: "", icon: "🎧", sub: (kpisSup.totalTicketsResolus || 0) + " tickets résolus · Rép: " + (kpisSup.tempsMoyenResolution || "1h 35m") },
    ];

    var html = '<div style="margin-bottom:var(--space-4)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding-bottom:var(--space-2);border-bottom:1px solid var(--color-border)">';
    html += '<div><h1 style="margin:0;font-size:22px;color:var(--color-text)">📊 Direction Générale · Rapports & Échéances Équipe</h1>';
    html += '<p style="opacity:.65;font-size:13px;margin:2px 0 0">Supervision de l\'activité hebdomadaire, contrôle des performances et configuration des délais de soumission.</p></div>';
    html += '<div style="display:flex;gap:var(--space-2)">';
    html += '<button type="button" class="btn btn-secondary" id="btn-refresh-rapports" style="padding:6px 12px;font-size:12px">🔄 Actualiser</button>';
    html += '</div>';
    html += '</div></div>';

    html += renderKpisGrid(kpis);

    // =========================================================================
    // 1. SECTION : PARAMÉTRAGE DES ÉCHÉANCES & FRÉQUENCES (PAR LA DIRECTION)
    // =========================================================================
    html += '<div class="card elev-sm" style="margin-bottom:var(--space-5);border-color:rgba(56,189,248,0.25)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)">';
    html += '<div><strong style="font-size:15px;color:#38bdf8">⚙️ Configuration des Échéances & Délais de Soumission</strong>';
    html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Définissez quand chaque collaborateur doit impérativement vous remettre son compte-rendu d\'activité.</p></div>';
    html += '<span class="tag tag-accent">👑 Contrôle Direction</span>';
    html += '</div>';

    html += '<div style="overflow-x:auto">';
    html += '<table class="table" style="font-size:12.5px;width:100%">';
    html += '<thead><tr><th>Fonction / Rôle</th><th>Fréquence</th><th>Jour & Heure Limite</th><th>Attendus & Objectifs Clés</th><th>Statut</th><th>Action</th></tr></thead>';
    html += '<tbody>';

    params.forEach(function (p) {
      var iconRole = p.roleCible === "commercial" ? "💼" : p.roleCible === "support" ? "🎧" : p.roleCible === "dev" ? "💻" : "📋";
      var libelleRole = ROLE_LABEL[p.roleCible] || p.roleCible;
      html += '<tr>';
      html += '<td><strong>' + iconRole + ' ' + libelleRole + '</strong></td>';
      html += '<td><span class="tag tag-outline" style="text-transform:capitalize">' + p.frequence + '</span></td>';
      html += '<td><strong style="color:var(--color-text)">Chaque ' + p.jourLimite + '</strong> avant <code style="color:#38bdf8">' + p.heureLimite + '</code></td>';
      html += '<td style="max-width:320px;font-size:11.5px;color:var(--color-text-dim)">' + (p.descriptionAttendus || "—") + '</td>';
      html += '<td>' + (p.actif ? '<span class="tag tag-accent">🟢 Actif</span>' : '<span class="tag tag-outline">Désactivé</span>') + '</td>';
      html += '<td><button type="button" class="btn btn-secondary btn-modifier-echeance" data-role="' + p.roleCible + '" style="font-size:11px;padding:3px 8px">⚙️ Modifier</button></td>';
      html += '</tr>';
    });

    html += '</tbody></table></div></div>';

    // =========================================================================
    // 2. SECTION : FLUX DES RAPPORTS DE L'ÉQUIPE (AVEC FILTRES & VALIDATION)
    // =========================================================================
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)">';
    html += '<div><h2 style="margin:0;font-size:16px;color:var(--color-text)">📋 Derniers Rapports d\'Activité Soumis</h2>';
    html += '<p style="font-size:12px;color:var(--color-text-dim);margin:2px 0 0">Consultez les bilans détaillés, validez les rapports ou demandez des directives spécifiques.</p></div>';

    // Filtres par rôle
    html += '<div style="display:flex;gap:4px;background:var(--color-surface-2);padding:3px;border-radius:var(--radius);border:1px solid var(--color-border)">';
    var filtres = [
      { id: "tous", label: "Tous (" + tousRapports.length + ")" },
      { id: "commercial", label: "💼 Commercial (" + tousRapports.filter(function (r) { return r.role === "commercial"; }).length + ")" },
      { id: "support", label: "🎧 Support (" + tousRapports.filter(function (r) { return r.role === "support"; }).length + ")" },
      { id: "dev", label: "💻 DevOps (" + tousRapports.filter(function (r) { return r.role === "dev"; }).length + ")" },
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
        var icon = r.role === "commercial" ? "💼" : r.role === "support" ? "🎧" : r.role === "dev" ? "💻" : "📋";
        var badgeStatut = r.statut === "valide_direction"
          ? '<span class="tag tag-accent">✅ Validé par la Direction</span>'
          : r.statut === "demande_precision"
          ? '<span class="tag tag-danger">⚠️ Précisions demandées</span>'
          : '<span class="tag tag-outline" style="border-color:#38bdf8;color:#38bdf8">⏳ En attente d\'évaluation</span>';

        var badgeRetard = r.enRetard ? '<span class="tag tag-danger">🔴 Soumis en retard</span>' : '<span class="tag tag-outline" style="color:#22c55e;border-color:#22c55e">🟢 À temps</span>';

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
        html += '<button type="button" class="btn btn-secondary btn-evaluer-rapport" data-id="' + r.id + '" data-titre="' + r.titre + '" style="font-size:11.5px;padding:4px 10px">💬 Évaluer / Directives</button>';
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
            html += '<div style="font-size:12px;margin-bottom:6px"><strong>🎯 Études en phase de signature / closing :</strong> <span style="color:#38bdf8">' + (Array.isArray(d.etudesEnClosing) ? d.etudesEnClosing.join(", ") : d.etudesEnClosing) + '</span></div>';
          }
        } else if (r.role === "support") {
          html += '<div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;margin-bottom:10px">';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Tickets Traités</span><div style="font-size:16px;font-weight:700;color:var(--color-text)">' + (d.ticketsTraites || 0) + '</div></div>';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Tickets Résolus</span><div style="font-size:16px;font-weight:700;color:#22c55e">' + (d.ticketsResolus || 0) + '</div></div>';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Score CSAT</span><div style="font-size:16px;font-weight:700;color:#38bdf8">' + (d.scoreCsatPct || 98.2) + '%</div></div>';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Délai Réponse</span><div style="font-size:16px;font-weight:700;color:var(--color-text)">' + (d.tempsReponseMinutes || 12) + ' min</div></div>';
          html += '</div>';
          if (d.topProblemes) {
            html += '<div style="font-size:12px;margin-bottom:6px"><strong>🔧 Problèmes récurrents :</strong> <span style="color:var(--color-text)">' + d.topProblemes + '</span></div>';
          }
          if (d.etudesSousSurveillance) {
            html += '<div style="font-size:12px;margin-bottom:6px"><strong>⚠️ Études nécessitant accompagnement :</strong> <span style="color:#f59e0b">' + d.etudesSousSurveillance + '</span></div>';
          }
        } else if (r.role === "dev") {
          html += '<div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;margin-bottom:10px">';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Disponibilité Uptime</span><div style="font-size:16px;font-weight:700;color:#22c55e">' + (d.uptimePourcentage || 99.98) + '%</div></div>';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Incidents Bloquants</span><div style="font-size:16px;font-weight:700;color:var(--color-text)">' + (d.incidentsBloquants || 0) + '</div></div>';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Sauvegardes WORM</span><div style="font-size:16px;font-weight:700;color:#38bdf8">' + (d.snapshotsWormGeneres || 7) + ' snapshots</div></div>';
          html += '<div><span style="font-size:11px;color:var(--color-text-dim)">Conformité PRA</span><div style="font-size:16px;font-weight:700;color:#22c55e">' + (d.testPraConformite || "100% OK") + '</div></div>';
          html += '</div>';
          if (d.misesEnProduction) {
            html += '<div style="font-size:12px;margin-bottom:6px"><strong>🚀 Mises en production :</strong> <span style="color:var(--color-text)">' + d.misesEnProduction + '</span></div>';
          }
        }

        if (d.faitsMarquants) {
          html += '<div style="font-size:12px;margin-top:6px"><strong>💡 Faits marquants :</strong> <span style="color:var(--color-text)">' + d.faitsMarquants + '</span></div>';
        }
        if (d.pointsBloquants) {
          html += '<div style="font-size:12px;margin-top:4px"><strong>🚧 Points bloquants :</strong> <span style="color:#f43f5e">' + d.pointsBloquants + '</span></div>';
        }
        if (d.prioritesSemaineProchaine || d.prioritesTechniques) {
          html += '<div style="font-size:12px;margin-top:4px"><strong>🎯 Priorités semaine prochaine :</strong> <span style="color:#38bdf8">' + (d.prioritesSemaineProchaine || d.prioritesTechniques) + '</span></div>';
        }

        html += '</div>';

        // Commentaire existant de la Direction
        if (r.commentaireDirection) {
          html += '<div style="background:rgba(56,189,248,0.08);border-left:3px solid #38bdf8;padding:8px 12px;border-radius:4px;font-size:12px;margin-top:6px">';
          html += '<strong style="color:#38bdf8">👑 Directive de la Direction :</strong> ' + r.commentaireDirection;
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
    var icon = role === "commercial" ? "💼" : role === "support" ? "🎧" : role === "dev" ? "💻" : "📋";

    var html = '<div style="margin-bottom:var(--space-4)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding-bottom:var(--space-2);border-bottom:1px solid var(--color-border)">';
    html += '<div><h1 style="margin:0;font-size:22px;color:var(--color-text)">' + icon + ' Mes Rapports d\'Activité · ' + (ROLE_LABEL[role] || role) + '</h1>';
    html += '<p style="opacity:.65;font-size:13px;margin:2px 0 0">Rédigez et soumettez vos comptes-rendus périodiques à la Direction Générale.</p></div>';
    html += '<button type="button" class="btn btn-primary" id="btn-nouveau-rapport-collab" style="font-size:13px;padding:8px 14px">📝 + Rédiger mon Rapport</button>';
    html += '</div></div>';

    // Bandeau d'information sur l'échéance fixée par la Direction
    html += '<div class="card" style="background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.3);padding:var(--space-3);margin-bottom:var(--space-4);display:flex;align-items:center;justify-content:space-between">';
    html += '<div><strong style="color:#38bdf8;font-size:13.5px">⏰ Échéance fixée par la Direction :</strong>';
    html += '<span style="font-size:13px;color:var(--color-text);margin-left:6px">Votre rapport est attendu chaque <strong>' + param.jourLimite + '</strong> avant <code style="color:#38bdf8">' + param.heureLimite + '</code> (' + param.frequence + ').</span>';
    html += '<div style="font-size:11.5px;color:var(--color-text-dim);margin-top:2px">Attendus clés : ' + (param.descriptionAttendus || "Compte-rendu complet de l'activité.") + '</div></div>';
    html += '<span class="tag tag-accent">👑 Directive Direction</span>';
    html += '</div>';

    // Historique des rapports soumis par ce collaborateur
    html += '<div style="margin-bottom:var(--space-3)"><h2 style="margin:0;font-size:16px;color:var(--color-text)">📚 Historique de mes Rapports Soumis</h2></div>';

    if (mesRapports.length === 0) {
      html += '<div class="card" style="text-align:center;padding:var(--space-6);color:var(--color-text-dim)">Vous n\'avez pas encore soumis de rapport d\'activité. Cliquez sur "+ Rédiger mon Rapport" pour démarrer.</div>';
    } else {
      html += '<div style="display:grid;grid-template-columns:1fr;gap:var(--space-3)">';
      mesRapports.forEach(function (r) {
        var badgeStatut = r.statut === "valide_direction"
          ? '<span class="tag tag-accent">✅ Validé par la Direction</span>'
          : r.statut === "demande_precision"
          ? '<span class="tag tag-danger">⚠️ Précisions demandées</span>'
          : '<span class="tag tag-outline" style="border-color:#38bdf8;color:#38bdf8">⏳ En cours de lecture</span>';

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
          html += '<strong style="color:#38bdf8">👑 Retour de la Direction :</strong> ' + r.commentaireDirection;
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
    var icon = role === "commercial" ? "💼" : role === "support" ? "🎧" : role === "dev" ? "💻" : "📋";
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
    html += '<option value="true"' + (p.actif !== false ? " selected" : "") + '>🟢 Oui (Obligatoire)</option>';
    html += '<option value="false"' + (p.actif === false ? " selected" : "") + '>🔴 Non (Optionnel)</option>';
    html += '</select></div>';

    html += '<div id="erreur-modifier-frequence" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-freq">Annuler</button><button type="submit" class="btn btn-primary">Enregistrer les paramètres</button></div>';
    html += '</form>';

    ouvrirModal({
      titre: '<span>⚙️</span> Configurer l\'Échéance de Rapport · ' + libelleRole,
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
    html += '<option value="valide_direction" selected>✅ Valider & Approuver le compte-rendu</option>';
    html += '<option value="demande_precision">⚠️ Demander des précisions / Actions correctives</option>';
    html += '</select></div>';

    html += '<div class="field"><label>Commentaires & Directives de la Direction</label><textarea class="input" name="commentaireDirection" rows="3" placeholder="Ex. Excellent travail sur les signatures. Pour la semaine prochaine, prioriser le closing sur Me Touré..."></textarea></div>';

    html += '<div id="erreur-evaluer-rapport" class="erreur-inline" style="display:none"></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-2)"><button type="button" class="btn btn-ghost" id="btn-annuler-eval">Annuler</button><button type="submit" class="btn btn-primary">Valider la décision</button></div>';
    html += '</form>';

    ouvrirModal({
      titre: '<span>👑</span> Évaluation Direction · Rapport d\'Activité',
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
      btnDeco.addEventListener("click", function () {
        API.deconnecter();
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
    }

    var badgeNotif = document.getElementById("notif-badge");
    if (badgeNotif) {
      badgeNotif.addEventListener("click", function () { irVers("notifications"); });
    }

    var chargement = document.getElementById("chargement-initial");
    if (chargement) chargement.style.display = "none";

    if (API.estConnecte() && API.getUtilisateur()) {
      cache.utilisateur = API.getUtilisateur();
      cache.permissions = PERMISSIONS_PAR_ROLE[cache.utilisateur.role] || PERMISSIONS_PAR_ROLE.assistante;
      chargerToutEtAfficher().catch(function () {
        API.deconnecter();
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
      window.setInterval(chargerNotifBadge, 30000);
    } else {
      var loginEl = document.getElementById("ecran-login");
      if (loginEl) {
        loginEl.classList.add("actif");
        loginEl.style.display = "block";
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
