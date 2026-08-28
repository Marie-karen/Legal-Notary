/**
 * js/app.js — Contrôleur applicatif de Legal Notary
 *
 * Relie le référentiel (js/data.js), le moteur fiscal (js/tax-engine.js) et
 * le stockage LocalStorage (js/sample-dossiers.js) à l'interface. Gère les
 * vues (dashboard, kanban, liste, archives, paramètres), la fiche dossier en
 * modal, la fiche de taxe imprimable, le RBAC (rôle actif) et le centre
 * d'alertes proactives.
 *
 * Chargé en <script> classique en dernier, après data.js, tax-engine.js et
 * sample-dossiers.js (voir index.html). Aucun framework, aucune dépendance
 * réseau : l'application doit fonctionner à l'ouverture directe du fichier
 * index.html (file://), sans serveur.
 */

(function () {
  "use strict";

  var data = LegalNotary.data;
  var store = LegalNotary.store;
  var taxEngine = LegalNotary.taxEngine;

  var etat = {
    vue: "dashboard",
    filtreAnnee: "toutes",
    filtreActe: "tous",
    filtreStatut: "tous",
    dossierOuvertId: null
  };

  function fmtFCFA(n) {
    n = n || 0;
    return n.toLocaleString("fr-FR").replace(/,/g, " ") + " FCFA";
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return d.toLocaleDateString("fr-CI", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function labelActe(acteId) {
    var a = data.getActe(acteId);
    return a ? a.label : acteId;
  }

  function labelEtape(n) {
    var e = data.ETAPES_KANBAN[n - 1];
    return e ? e.label : "—";
  }

  function roleActifObjet() {
    var id = store.getRoleActif();
    for (var i = 0; i < data.ORDRE_ROLES.length; i++) {
      var r = data.USER_ROLES[data.ORDRE_ROLES[i]];
      if (r.id === id) return r;
    }
    return data.USER_ROLES.NOTAIRE;
  }

  function peut(permission) {
    return data.aPermission(store.getRoleActif(), permission);
  }

  // -----------------------------------------------------------------
  // Alertes proactives
  // -----------------------------------------------------------------
  function calculerAlerte(dossier, parametres) {
    var etapeInfo = data.ETAPES_KANBAN[dossier.etapeActuelle - 1];
    var delaiStandard = parametres.delaisEtapesJours[etapeInfo.code];
    var delaiEffectif = delaiStandard + (dossier.reportJours || 0);
    var joursDansEtape = store.joursDansEtapeActuelle(dossier);
    var seuilAmbreJours = (parametres.seuilAlerteAmbreHeures || 48) / 24;

    var couleur = "vert";
    if (joursDansEtape > delaiEffectif) couleur = "rouge";
    else if (joursDansEtape >= delaiEffectif - seuilAmbreJours) couleur = "ambre";

    var derniereActivite = dossier.derniereActivite || dossier.dateOuverture;
    var stagnant = store.joursDepuis(derniereActivite) > parametres.seuilStagnationJours;

    var kycBloquant = (dossier.checklist || []).some(function (t) {
      return t.bloquante && t.statut !== "effectuee" && t.etape <= dossier.etapeActuelle;
    });

    return {
      couleur: couleur,
      joursDansEtape: joursDansEtape,
      delaiEffectif: delaiEffectif,
      stagnant: stagnant,
      kycBloquant: kycBloquant,
      ancienneteJours: store.ancienneteDossier(dossier)
    };
  }

  function pourcentageAvancement(dossier) {
    var checklist = dossier.checklist || [];
    if (!checklist.length) return 0;
    var total = 0;
    checklist.forEach(function (t) {
      var s = data.STATUTS_TACHE.filter(function (st) { return st.id === t.statut; })[0];
      total += s ? s.pourcentage : 0;
    });
    return Math.round(total / checklist.length);
  }

  // -----------------------------------------------------------------
  // Navigation entre vues
  // -----------------------------------------------------------------
  function irVers(vue) {
    etat.vue = vue;
    document.querySelectorAll(".vue").forEach(function (el) { el.classList.remove("vue--active"); });
    var cible = document.getElementById("vue-" + vue);
    if (cible) cible.classList.add("vue--active");
    document.querySelectorAll(".nav-bouton").forEach(function (b) {
      b.classList.toggle("nav-bouton--actif", b.dataset.vue === vue);
    });
    render();
  }

  function render() {
    appliquerRBACAffichage();
    if (etat.vue === "dashboard") renderDashboard();
    if (etat.vue === "kanban") renderKanban();
    if (etat.vue === "liste") renderListe();
    if (etat.vue === "archives") renderArchives();
    if (etat.vue === "parametres") renderParametres();
  }

  function appliquerRBACAffichage() {
    var role = roleActifObjet();
    document.getElementById("role-actif-badge").textContent = role.label;
    document.getElementById("role-actif-badge").style.background = role.couleur;
    document.querySelector('[data-vue="parametres"]').style.display = peut("gerer_parametres") ? "" : "none";
    document.querySelector('[data-vue="archives"]').style.display = peut("acceder_archives") ? "" : "none";
  }

  // -----------------------------------------------------------------
  // Dashboard
  // -----------------------------------------------------------------
  function renderDashboard() {
    var parametres = store.getParametres();
    var dossiers = store.getDossiersActifs().filter(function (d) { return d.statutGlobal === "actif"; });
    var alertes = dossiers.map(function (d) { return { dossier: d, alerte: calculerAlerte(d, parametres) }; });

    var rouges = alertes.filter(function (a) { return a.alerte.couleur === "rouge"; });
    var ambres = alertes.filter(function (a) { return a.alerte.couleur === "ambre"; });
    var stagnants = alertes.filter(function (a) { return a.alerte.stagnant; });
    var kyc = alertes.filter(function (a) { return a.alerte.kycBloquant; });
    var anneeCourante = new Date().getFullYear();
    var stockAnterieur = dossiers.filter(function (d) { return d.anneeOuverture < anneeCourante; });

    var tvaMois = 0;
    dossiers.concat(store.getDossiers().filter(function (d) { return d.statutGlobal === "cloture"; })).forEach(function (d) {
      if (d.ficheDeTaxe && d.ficheDeTaxe.tva) tvaMois += d.ficheDeTaxe.tva;
    });

    document.getElementById("kpi-dossiers-actifs").textContent = dossiers.length;
    document.getElementById("kpi-alertes-rouge").textContent = rouges.length;
    document.getElementById("kpi-alertes-ambre").textContent = ambres.length;
    document.getElementById("kpi-stock-anterieur").textContent = stockAnterieur.length;
    document.getElementById("kpi-tva-mois").textContent = fmtFCFA(tvaMois);

    var urgentes = rouges.concat(ambres).concat(stagnants).concat(kyc);
    var vues = {};
    var liste = [];
    urgentes.forEach(function (a) {
      if (vues[a.dossier.id]) return;
      vues[a.dossier.id] = true;
      liste.push(a);
    });

    var conteneur = document.getElementById("centre-alertes");
    conteneur.innerHTML = "";
    if (!liste.length) {
      conteneur.innerHTML = '<p class="texte-discret">Aucune alerte active. Tous les dossiers sont dans les temps.</p>';
    }
    liste.forEach(function (a) {
      var d = a.dossier;
      var al = a.alerte;
      var motifs = [];
      if (al.couleur === "rouge") motifs.push("Retard d'instruction (étape « " + labelEtape(d.etapeActuelle) + " », " + al.joursDansEtape + " j / " + al.delaiEffectif + " j)");
      else if (al.couleur === "ambre") motifs.push("Échéance sous 48h (étape « " + labelEtape(d.etapeActuelle) + " »)");
      if (al.stagnant) motifs.push("Dossier stagnant (aucun mouvement depuis plus de " + store.getParametres().seuilStagnationJours + " jours)");
      if (al.kycBloquant) motifs.push("Pièce bloquante manquante");

      var ligne = document.createElement("div");
      ligne.className = "alerte alerte--" + al.couleur;
      ligne.innerHTML =
        '<div class="alerte-corps">' +
        '<div class="alerte-titre">' + d.numeroDossier + ' — ' + labelActe(d.acteId) + '</div>' +
        '<div class="alerte-motifs">' + motifs.join(" · ") + '</div>' +
        '</div>' +
        '<div class="alerte-actions">' +
        '<button class="bouton bouton--petit" data-action="ouvrir-dossier" data-id="' + d.id + '">Ouvrir le dossier</button>' +
        '<button class="bouton bouton--petit bouton--secondaire" data-action="relancer-clerc" data-id="' + d.id + '">Relancer le clerc</button>' +
        '<button class="bouton bouton--petit bouton--secondaire" data-action="reporter-24h" data-id="' + d.id + '">Reporter 24h</button>' +
        '</div>';
      conteneur.appendChild(ligne);
    });
  }

  // -----------------------------------------------------------------
  // Kanban
  // -----------------------------------------------------------------
  function renderKanban() {
    var parametres = store.getParametres();
    var dossiers = store.getDossiersActifs().filter(function (d) { return d.statutGlobal === "actif"; });
    var conteneur = document.getElementById("kanban-colonnes");
    conteneur.innerHTML = "";
    data.ETAPES_KANBAN.forEach(function (etape) {
      var colonne = document.createElement("div");
      colonne.className = "kanban-colonne";
      var dossiersEtape = dossiers.filter(function (d) { return d.etapeActuelle === etape.id; });
      var cartes = dossiersEtape.map(function (d) {
        var al = calculerAlerte(d, parametres);
        return (
          '<div class="carte-dossier carte-dossier--' + al.couleur + '" data-id="' + d.id + '">' +
          '<div class="carte-dossier-numero">' + d.numeroDossier + '</div>' +
          '<div class="carte-dossier-acte">' + labelActe(d.acteId) + '</div>' +
          '<div class="carte-dossier-meta">' + al.joursDansEtape + ' j dans l\'étape · ' + pourcentageAvancement(d) + '%</div>' +
          '<div class="carte-dossier-actions">' +
          (etape.id > 1 ? '<button class="bouton-icone" data-action="etape-precedente" data-id="' + d.id + '" title="Étape précédente">◀</button>' : '<span></span>') +
          '<button class="bouton-icone" data-action="ouvrir-dossier" data-id="' + d.id + '" title="Ouvrir">🔍</button>' +
          (etape.id < 6 ? '<button class="bouton-icone" data-action="etape-suivante" data-id="' + d.id + '" title="Étape suivante">▶</button>' : '<span></span>') +
          '</div>' +
          '</div>'
        );
      }).join("");
      colonne.innerHTML =
        '<div class="kanban-entete"><h3>' + etape.label + '</h3><span class="kanban-compteur">' + dossiersEtape.length + '</span></div>' +
        '<div class="kanban-liste">' + (cartes || '<p class="texte-discret texte-discret--petit">Aucun dossier</p>') + '</div>';
      conteneur.appendChild(colonne);
    });
  }

  // -----------------------------------------------------------------
  // Liste / table des dossiers
  // -----------------------------------------------------------------
  function renderListe() {
    var selActe = document.getElementById("filtre-acte");
    if (!selActe.dataset.rempli) {
      var options = '<option value="tous">Tous les actes</option>';
      data.CATEGORIES_ACTES.forEach(function (cat) {
        options += '<optgroup label="' + cat.label + '">';
        data.CATALOGUE_ACTES.filter(function (a) { return a.categorie === cat.id; }).forEach(function (a) {
          options += '<option value="' + a.id + '">' + a.label + '</option>';
        });
        options += '</optgroup>';
      });
      selActe.innerHTML = options;
      selActe.dataset.rempli = "1";
    }

    var parametres = store.getParametres();
    var anneeCourante = new Date().getFullYear();
    var dossiers = store.getDossiersActifs();

    if (etat.filtreAnnee === "courante") dossiers = dossiers.filter(function (d) { return d.anneeOuverture === anneeCourante; });
    if (etat.filtreAnnee === "anterieur") dossiers = dossiers.filter(function (d) { return d.anneeOuverture < anneeCourante; });
    if (etat.filtreActe !== "tous") dossiers = dossiers.filter(function (d) { return d.acteId === etat.filtreActe; });

    var lignes = dossiers.map(function (d) {
      var al = d.statutGlobal === "actif" ? calculerAlerte(d, parametres) : { couleur: "cloture" };
      return { dossier: d, alerte: al };
    });
    if (etat.filtreStatut !== "tous") lignes = lignes.filter(function (l) { return l.alerte.couleur === etat.filtreStatut; });

    var corps = document.getElementById("corps-table-dossiers");
    corps.innerHTML = "";
    if (!lignes.length) {
      corps.innerHTML = '<tr><td colspan="8" class="texte-discret">Aucun dossier ne correspond aux filtres.</td></tr>';
      return;
    }
    lignes.forEach(function (l) {
      var d = l.dossier;
      var badgeCouleur = l.alerte.couleur === "cloture" ? "" : '<span class="badge badge--' + l.alerte.couleur + '"></span>';
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td>' + badgeCouleur + ' ' + d.numeroDossier + '</td>' +
        '<td>' + labelActe(d.acteId) + '</td>' +
        '<td>' + d.anneeOuverture + '</td>' +
        '<td>' + (d.statutGlobal === "actif" ? labelEtape(d.etapeActuelle) : "Clôturé") + '</td>' +
        '<td>' + store.ancienneteDossier(d) + ' j</td>' +
        '<td>' + pourcentageAvancement(d) + '%</td>' +
        '<td>' + fmtFCFA(d.montant) + '</td>' +
        '<td><button class="bouton bouton--petit" data-action="ouvrir-dossier" data-id="' + d.id + '">Ouvrir</button></td>';
      corps.appendChild(tr);
    });
  }

  // -----------------------------------------------------------------
  // Archives / Répertoire des minutes
  // -----------------------------------------------------------------
  function renderArchives() {
    var minutes = store.getRepertoireMinutes();
    var corps = document.getElementById("corps-table-repertoire");
    corps.innerHTML = "";
    if (!minutes.length) {
      corps.innerHTML = '<tr><td colspan="7" class="texte-discret">Aucune minute enregistrée.</td></tr>';
      return;
    }
    minutes.forEach(function (d) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td>' + d.minute.numero + '</td>' +
        '<td>' + fmtDate(d.minute.dateCloture) + '</td>' +
        '<td>' + labelActe(d.acteId) + '</td>' +
        '<td>' + (d.comparants || []).map(function (c) { return c.nom; }).join(", ") + '</td>' +
        '<td>' + fmtFCFA(d.montant) + '</td>' +
        '<td>' + [d.minute.carton, d.minute.rayonnage, d.minute.armoire].filter(Boolean).join(" · ") + '</td>' +
        '<td>' + (d.minute.scanUrl ? '<a href="' + d.minute.scanUrl + '" target="_blank" rel="noopener">Voir le scan</a>' : '<span class="texte-discret texte-discret--petit">Non numérisé</span>') + '</td>';
      corps.appendChild(tr);
    });
  }

  // -----------------------------------------------------------------
  // Paramètres de l'étude
  // -----------------------------------------------------------------
  function renderParametres() {
    var p = store.getParametres();
    var f = document.getElementById("form-parametres");
    f.nomEtude.value = p.nomEtude;
    f.titreNotaire.value = p.titreNotaire;
    f.adresse.value = p.adresse;
    f.telephone.value = p.telephone;
    f.email.value = p.email;
    f.numeroCC.value = p.numeroCC;
    f.centreImpots.value = p.centreImpots;
    f.compteSequestreCDCI.value = p.compteSequestreCDCI;
    f.tauxTVA.value = p.fiscal.tauxTVA * 100;
    f.minimumLegalMinute.value = p.fiscal.minimumLegalMinute;
    f.tarifRoleMinute.value = p.fiscal.tarifRoleMinute;
    f.seuilStagnationJours.value = p.seuilStagnationJours;
    f.seuilAlerteAmbreHeures.value = p.seuilAlerteAmbreHeures;

    var conteneurDelais = document.getElementById("parametres-delais-etapes");
    conteneurDelais.innerHTML = "";
    data.ETAPES_KANBAN.forEach(function (e) {
      var champ = document.createElement("label");
      champ.className = "champ";
      champ.innerHTML =
        '<span>' + e.label + ' (jours)</span>' +
        '<input type="number" min="1" name="delai_' + e.code + '" value="' + p.delaisEtapesJours[e.code] + '">';
      conteneurDelais.appendChild(champ);
    });

    var conteneurBaremes = document.getElementById("parametres-baremes-emoluments");
    conteneurBaremes.innerHTML = "";
    var familles = { vente: "Vente immobilière", societe: "Société", pret: "Prêt" };
    Object.keys(familles).forEach(function (fam) {
      var bloc = document.createElement("div");
      bloc.className = "bareme-famille";
      var lignes = p.baremeEmoluments[fam].map(function (tranche, idx) {
        return (
          '<div class="bareme-ligne">' +
          '<span>' + (tranche.jusqua === null ? "Au-delà" : "Jusqu'à " + fmtFCFA(tranche.jusqua)) + '</span>' +
          '<input type="number" step="0.01" min="0" data-famille="' + fam + '" data-index="' + idx + '" value="' + (tranche.taux * 100) + '"> %' +
          '</div>'
        );
      }).join("");
      bloc.innerHTML = '<h4>' + familles[fam] + '</h4>' + lignes;
      conteneurBaremes.appendChild(bloc);
    });
  }

  function enregistrerParametres(evt) {
    evt.preventDefault();
    var p = store.getParametres();
    var f = evt.target;
    p.nomEtude = f.nomEtude.value.trim();
    p.titreNotaire = f.titreNotaire.value.trim();
    p.adresse = f.adresse.value.trim();
    p.telephone = f.telephone.value.trim();
    p.email = f.email.value.trim();
    p.numeroCC = f.numeroCC.value.trim();
    p.centreImpots = f.centreImpots.value.trim();
    p.compteSequestreCDCI = f.compteSequestreCDCI.value.trim();
    p.fiscal.tauxTVA = parseFloat(f.tauxTVA.value) / 100;
    p.fiscal.minimumLegalMinute = parseInt(f.minimumLegalMinute.value, 10) || 0;
    p.fiscal.tarifRoleMinute = parseInt(f.tarifRoleMinute.value, 10) || 0;
    p.seuilStagnationJours = parseInt(f.seuilStagnationJours.value, 10) || 7;
    p.seuilAlerteAmbreHeures = parseInt(f.seuilAlerteAmbreHeures.value, 10) || 48;

    data.ETAPES_KANBAN.forEach(function (e) {
      var champ = f["delai_" + e.code];
      if (champ) p.delaisEtapesJours[e.code] = parseInt(champ.value, 10) || e.delaiStandardJoursDefaut;
    });

    document.querySelectorAll("#parametres-baremes-emoluments input[data-famille]").forEach(function (input) {
      var fam = input.dataset.famille;
      var idx = parseInt(input.dataset.index, 10);
      p.baremeEmoluments[fam][idx].taux = parseFloat(input.value) / 100;
    });

    store.saveParametres(p);
    notifier("Paramètres enregistrés.");
    render();
  }

  // -----------------------------------------------------------------
  // Modal : fiche dossier
  // -----------------------------------------------------------------
  function ouvrirDossier(id) {
    etat.dossierOuvertId = id;
    var dossier = store.getDossier(id);
    if (!dossier) return;
    var parametres = store.getParametres();
    var acte = data.getActe(dossier.acteId);

    document.getElementById("modal-dossier-titre").textContent = dossier.numeroDossier + " — " + (acte ? acte.label : dossier.acteId);

    var infos = document.getElementById("modal-dossier-infos");
    infos.innerHTML =
      '<div><strong>Comparants :</strong> ' + (dossier.comparants || []).map(function (c) { return c.nom + " (" + c.role + ")"; }).join(", ") + '</div>' +
      '<div><strong>Montant :</strong> ' + fmtFCFA(dossier.montant) + '</div>' +
      '<div><strong>Ouvert le :</strong> ' + fmtDate(dossier.dateOuverture) + ' — ancienneté ' + store.ancienneteDossier(dossier) + ' jours</div>' +
      '<div><strong>Clerc assigné :</strong> ' + (dossier.clercAssigne || "—") + '</div>' +
      '<div><strong>Statut :</strong> ' + (dossier.statutGlobal === "actif" ? "Actif — " + labelEtape(dossier.etapeActuelle) : "Clôturé (minute " + (dossier.minute ? dossier.minute.numero : "") + ")") + '</div>';

    var checklistConteneur = document.getElementById("modal-dossier-checklist");
    checklistConteneur.innerHTML = "";
    data.ETAPES_KANBAN.forEach(function (etape) {
      var taches = (dossier.checklist || []).filter(function (t) { return t.etape === etape.id; });
      if (!taches.length) return;
      var bloc = document.createElement("div");
      bloc.className = "checklist-etape";
      var lignes = taches.map(function (t) {
        var options = data.STATUTS_TACHE.map(function (s) {
          return '<option value="' + s.id + '"' + (s.id === t.statut ? " selected" : "") + '>' + s.label + '</option>';
        }).join("");
        return (
          '<div class="checklist-ligne ' + (t.bloquante ? "checklist-ligne--bloquante" : "") + '">' +
          '<span>' + t.label + (t.bloquante ? ' <span class="etiquette-bloquante">bloquante</span>' : '') + '</span>' +
          '<select data-action="maj-tache" data-dossier="' + dossier.id + '" data-tache="' + t.id + '">' + options + '</select>' +
          '</div>'
        );
      }).join("");
      bloc.innerHTML = '<h4>' + etape.label + '</h4>' + lignes;
      checklistConteneur.appendChild(bloc);
    });

    var totalProvisions = (dossier.compteClient.provisions || []).reduce(function (s, p) { return s + p.montant; }, 0);
    var totalDecaissements = (dossier.compteClient.decaissements || []).reduce(function (s, d2) { return s + d2.montant; }, 0);
    var compte = document.getElementById("modal-dossier-compte");
    compte.innerHTML =
      '<div class="compte-solde"><span>Provisions reçues</span><strong>' + fmtFCFA(totalProvisions) + '</strong></div>' +
      '<div class="compte-solde"><span>Décaissements (droits, débours, émoluments)</span><strong>' + fmtFCFA(totalDecaissements) + '</strong></div>' +
      '<div class="compte-solde compte-solde--total"><span>Solde du compte client (reliquat)</span><strong>' + fmtFCFA(totalProvisions - totalDecaissements) + '</strong></div>';

    var actions = document.getElementById("modal-dossier-actions");
    actions.innerHTML = "";
    if (dossier.statutGlobal === "actif") {
      var optionsEtapes = data.ETAPES_KANBAN.map(function (e) {
        return '<option value="' + e.id + '"' + (e.id === dossier.etapeActuelle ? " selected" : "") + '>' + e.label + '</option>';
      }).join("");
      actions.innerHTML +=
        '<label class="champ champ--inline"><span>Étape</span><select id="select-etape-dossier">' + optionsEtapes + '</select></label>' +
        '<button class="bouton" data-action="appliquer-etape" data-id="' + dossier.id + '">Mettre à jour l\'étape</button>' +
        '<button class="bouton bouton--secondaire" data-action="ouvrir-fiche-taxe" data-id="' + dossier.id + '">Établir la fiche de taxe</button>';
      if (peut("cloturer_dossier")) {
        actions.innerHTML += '<button class="bouton bouton--or" data-action="ouvrir-cloture" data-id="' + dossier.id + '">Clôturer & attribuer une minute</button>';
      }
    } else {
      actions.innerHTML = '<button class="bouton bouton--secondaire" data-action="ouvrir-fiche-taxe" data-id="' + dossier.id + '">Revoir la fiche de taxe</button>';
    }

    basculerModal("modal-dossier", true);
  }

  // -----------------------------------------------------------------
  // Modal : fiche de taxe
  // -----------------------------------------------------------------
  function ouvrirFicheTaxe(id) {
    var dossier = store.getDossier(id);
    if (!dossier) return;
    var acte = data.getActe(dossier.acteId);
    var parametres = store.getParametres();
    var fiche = taxEngine.calculerFicheDeTaxe(acte, dossier.montant, parametres.fiscal, parametres.baremeEmoluments, {
      nombreFeuilles: 4,
      nombreRoles: 1,
      nombreExpeditions: 2,
      avecInscriptionFonciere: acte && acte.categorie === "immobilier",
      avecRadiation: acte && acte.id === "mainlevee_hypotheque"
    });

    var avertissement = "";
    if (acte && acte.droitEnregistrement && acte.droitEnregistrement.aConfirmer) {
      avertissement = '<p class="avertissement">Le taux de droit d\'enregistrement de cet acte n\'est pas confirmé par le cahier des charges — vérifier avant validation définitive (voir NOTES_HYPOTHESES.md).</p>';
    }

    document.getElementById("fiche-taxe-corps").innerHTML =
      '<div class="zone-impression">' +
      '<div class="fiche-entete">' +
      '<h2>Fiche de taxe / Note de frais</h2>' +
      '<p>' + dossier.numeroDossier + ' — ' + (acte ? acte.label : dossier.acteId) + '</p>' +
      '<p>Assiette : ' + fmtFCFA(fiche.montantAssiette) + '</p>' +
      '</div>' +
      avertissement +
      '<table class="table-fiche-taxe">' +
      '<tbody>' +
      '<tr class="ligne-section"><td colspan="2">Trésor / Conservation Foncière</td></tr>' +
      '<tr><td>Droits d\'enregistrement</td><td>' + fmtFCFA(fiche.droitsEnregistrement.montant) + '</td></tr>' +
      '<tr><td>Salaire du conservateur (1%)</td><td>' + fmtFCFA(fiche.conservationFonciere.salaireConservateur) + '</td></tr>' +
      '<tr><td>Inscription foncière</td><td>' + fmtFCFA(fiche.conservationFonciere.inscriptionFonciere) + '</td></tr>' +
      '<tr><td>Radiation</td><td>' + fmtFCFA(fiche.conservationFonciere.radiation) + '</td></tr>' +
      '<tr><td>Timbre fiscal</td><td>' + fmtFCFA(fiche.timbreFiscal) + '</td></tr>' +
      '<tr class="ligne-sous-total"><td>Sous-total Trésor</td><td>' + fmtFCFA(fiche.totaux.tresor) + '</td></tr>' +
      '<tr class="ligne-section"><td colspan="2">Émoluments de l\'étude</td></tr>' +
      '<tr><td>Émoluments HT' + (fiche.emoluments.minimumApplique ? " (minimum légal appliqué)" : "") + '</td><td>' + fmtFCFA(fiche.emoluments.montantHT) + '</td></tr>' +
      '<tr><td>TVA (' + (parametres.fiscal.tauxTVA * 100) + '%)</td><td>' + fmtFCFA(fiche.tva) + '</td></tr>' +
      '<tr><td>Rôles de minute</td><td>' + fmtFCFA(fiche.rolesMinute) + '</td></tr>' +
      '<tr class="ligne-sous-total"><td>Sous-total émoluments TTC</td><td>' + fmtFCFA(fiche.totaux.emolumentsTTC) + '</td></tr>' +
      '<tr class="ligne-section"><td colspan="2">Débours</td></tr>' +
      '<tr><td>Papeterie / affranchissement</td><td>' + fmtFCFA(fiche.debours.papeterie) + '</td></tr>' +
      '<tr><td>Expéditions / copies authentiques</td><td>' + fmtFCFA(fiche.debours.expeditions) + '</td></tr>' +
      '<tr><td>Extrait topo / cadastre</td><td>' + fmtFCFA(fiche.debours.extraitTopo) + '</td></tr>' +
      '<tr class="ligne-sous-total"><td>Sous-total débours</td><td>' + fmtFCFA(fiche.totaux.debours) + '</td></tr>' +
      '<tr class="ligne-total"><td>TOTAL GÉNÉRAL</td><td>' + fmtFCFA(fiche.totaux.general) + '</td></tr>' +
      '</tbody></table>' +
      '<p class="fiche-mentions">Numéro CC : ' + (parametres.numeroCC || "—") + ' · Centre des impôts : ' + (parametres.centreImpots || "—") + '</p>' +
      '</div>' +
      '<div class="modal-actions no-print">' +
      '<button class="bouton" data-action="enregistrer-fiche-taxe" data-id="' + dossier.id + '" data-fiche="' + encodeURIComponent(JSON.stringify(fiche)) + '">Enregistrer sur le dossier</button>' +
      '<button class="bouton bouton--secondaire" data-action="imprimer-fiche-taxe">Imprimer</button>' +
      '</div>';

    basculerModal("modal-fiche-taxe", true);
  }

  // -----------------------------------------------------------------
  // Modal : clôture / attribution de minute
  // -----------------------------------------------------------------
  function ouvrirCloture(id) {
    document.getElementById("form-cloture-dossier").dataset.id = id;
    document.getElementById("form-cloture-dossier").reset();
    basculerModal("modal-cloture", true);
  }

  function confirmerCloture(evt) {
    evt.preventDefault();
    var f = evt.target;
    var id = f.dataset.id;
    store.cloturerDossier(id, {
      carton: f.carton.value.trim(),
      rayonnage: f.rayonnage.value.trim(),
      armoire: f.armoire.value.trim(),
      scanUrl: f.scanUrl.value.trim()
    });
    basculerModal("modal-cloture", false);
    basculerModal("modal-dossier", false);
    notifier("Dossier clôturé et minute attribuée.");
    render();
  }

  // -----------------------------------------------------------------
  // Modal : nouveau dossier
  // -----------------------------------------------------------------
  function ouvrirNouveauDossier() {
    var selActe = document.getElementById("nouveau-dossier-acte");
    if (!selActe.dataset.rempli) {
      var options = "";
      data.CATEGORIES_ACTES.forEach(function (cat) {
        options += '<optgroup label="' + cat.label + '">';
        data.CATALOGUE_ACTES.filter(function (a) { return a.categorie === cat.id; }).forEach(function (a) {
          options += '<option value="' + a.id + '">' + a.label + '</option>';
        });
        options += '</optgroup>';
      });
      selActe.innerHTML = options;
      selActe.dataset.rempli = "1";
    }
    var selAnnee = document.getElementById("nouveau-dossier-annee");
    if (!selAnnee.dataset.rempli) {
      var anneeCourante = new Date().getFullYear();
      var opts = "";
      for (var a = anneeCourante; a >= anneeCourante - 6; a--) {
        opts += '<option value="' + a + '"' + (a === anneeCourante ? " selected" : "") + '>' + a + '</option>';
      }
      selAnnee.innerHTML = opts;
      selAnnee.dataset.rempli = "1";
    }
    document.getElementById("form-nouveau-dossier").reset();
    basculerModal("modal-nouveau-dossier", true);
  }

  function confirmerNouveauDossier(evt) {
    evt.preventDefault();
    var f = evt.target;
    var comparants = f.comparants.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean).map(function (nom) { return { nom: nom, role: "Comparant" }; });
    store.creerDossier({
      acteId: f.acteId.value,
      anneeOuverture: parseInt(f.anneeOuverture.value, 10),
      montant: parseInt(f.montant.value, 10) || 0,
      comparants: comparants,
      clercAssigne: f.clercAssigne.value.trim()
    });
    basculerModal("modal-nouveau-dossier", false);
    notifier("Dossier créé.");
    irVers("liste");
  }

  // -----------------------------------------------------------------
  // Utilitaires UI
  // -----------------------------------------------------------------
  function basculerModal(id, ouvrir) {
    var m = document.getElementById(id);
    if (!m) return;
    m.classList.toggle("modal--ouverte", ouvrir);
  }

  function notifier(message) {
    var zone = document.getElementById("zone-notification");
    zone.textContent = message;
    zone.classList.add("notification--visible");
    window.clearTimeout(notifier._t);
    notifier._t = window.setTimeout(function () { zone.classList.remove("notification--visible"); }, 3500);
  }

  // -----------------------------------------------------------------
  // Délégation d'évènements
  // -----------------------------------------------------------------
  function initEcouteurs() {
    document.querySelectorAll(".nav-bouton").forEach(function (b) {
      b.addEventListener("click", function () { irVers(b.dataset.vue); });
    });

    document.getElementById("selecteur-role").addEventListener("change", function (e) {
      store.setRoleActif(e.target.value);
      render();
    });

    document.getElementById("bouton-nouveau-dossier").addEventListener("click", ouvrirNouveauDossier);
    document.getElementById("form-nouveau-dossier").addEventListener("submit", confirmerNouveauDossier);
    document.getElementById("form-cloture-dossier").addEventListener("submit", confirmerCloture);
    document.getElementById("form-parametres").addEventListener("submit", enregistrerParametres);

    document.getElementById("filtre-annee").addEventListener("change", function (e) { etat.filtreAnnee = e.target.value; renderListe(); });
    document.getElementById("filtre-acte").addEventListener("change", function (e) { etat.filtreActe = e.target.value; renderListe(); });
    document.getElementById("filtre-statut").addEventListener("change", function (e) { etat.filtreStatut = e.target.value; renderListe(); });

    document.querySelectorAll("[data-fermer-modal]").forEach(function (b) {
      b.addEventListener("click", function () { basculerModal(b.dataset.fermerModal, false); });
    });

    document.addEventListener("change", function (e) {
      if (e.target.matches('[data-action="maj-tache"]')) {
        store.majStatutTache(e.target.dataset.dossier, e.target.dataset.tache, e.target.value);
        render();
      }
    });

    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action]");
      if (!btn) return;
      var action = btn.dataset.action;
      var id = btn.dataset.id;

      if (action === "ouvrir-dossier") ouvrirDossier(id);
      if (action === "etape-suivante") { var d1 = store.getDossier(id); store.changerEtape(id, Math.min(6, d1.etapeActuelle + 1)); render(); }
      if (action === "etape-precedente") { var d2 = store.getDossier(id); store.changerEtape(id, Math.max(1, d2.etapeActuelle - 1)); render(); }
      if (action === "appliquer-etape") {
        var nv = parseInt(document.getElementById("select-etape-dossier").value, 10);
        store.changerEtape(id, nv);
        ouvrirDossier(id);
        render();
      }
      if (action === "ouvrir-fiche-taxe") ouvrirFicheTaxe(id);
      if (action === "enregistrer-fiche-taxe") {
        var fiche = JSON.parse(decodeURIComponent(btn.dataset.fiche));
        store.enregistrerFicheDeTaxe(id, fiche);
        notifier("Fiche de taxe enregistrée sur le dossier.");
      }
      if (action === "imprimer-fiche-taxe") window.print();
      if (action === "ouvrir-cloture") ouvrirCloture(id);
      if (action === "relancer-clerc") {
        var d3 = store.getDossier(id);
        var updated = store.getDossier(id);
        updated.mouvements = updated.mouvements || [];
        updated.mouvements.push({ date: new Date().toISOString(), description: "Relance interne envoyée à " + (d3.clercAssigne || "clerc assigné") });
        store.majDossier(updated);
        notifier("Relance envoyée à " + (d3.clercAssigne || "clerc assigné") + ".");
        render();
      }
      if (action === "reporter-24h") {
        var d4 = store.getDossier(id);
        d4.reportJours = (d4.reportJours || 0) + 1;
        store.majDossier(d4);
        notifier("Échéance reportée de 24h.");
        render();
      }
    });
  }

  // -----------------------------------------------------------------
  // Initialisation
  // -----------------------------------------------------------------
  function init() {
    store.initStockageEtSeed();
    var f = document.getElementById("form-parametres");
    if (f) f.dataset.ready = "1";
    document.getElementById("selecteur-role").value = store.getRoleActif();
    initEcouteurs();
    irVers("dashboard");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
