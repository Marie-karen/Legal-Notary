/**
 * js/data.js — Référentiel métier statique de Legal Notary
 *
 * Contient tout ce qui ne dépend pas d'un office particulier ni d'un dossier :
 * rôles RBAC, catalogue des actes, étapes du pipeline, checklist de tâches
 * standards, barèmes fiscaux par défaut (Décret N° 2013-279 du 24/04/2013).
 *
 * Chargé en <script> classique (pas de type="module") : l'application doit
 * s'ouvrir directement en file:// par double-clic, sans serveur local, pour
 * garantir le secret professionnel. Les navigateurs bloquent le chargement
 * de modules ES6 via CORS sur file://, d'où ce choix.
 *
 * Attention barèmes : certains montants du cahier des charges ne sont pas
 * chiffrés avec précision par le Décret 2013-279 pour tous les types d'actes
 * (ex. droit fixe de constitution de SARL, droits d'enregistrement des actes
 * hors vente/bail/prêt/succession). Conformément à la règle « ne jamais
 * inventer une règle de gestion », ces valeurs sont marquées `aConfirmer:
 * true` avec une valeur de départ prudente (jamais 0, jamais bloquante) et
 * listées dans NOTES_HYPOTHESES.md à la racine du projet — à faire valider
 * par le notaire avant toute utilisation en production.
 */

var LegalNotary = window.LegalNotary || {};

LegalNotary.data = (function () {
  "use strict";

  // ---------------------------------------------------------------------
  // 1. RBAC — Rôles & permissions de l'étude
  // ---------------------------------------------------------------------
  var USER_ROLES = {
    NOTAIRE: {
      id: "notaire",
      label: "Notaire Titulaire",
      sousTitre: "Vue 360° — accès absolu",
      couleur: "#D4AF37",
      permissions: [
        "voir_tous_dossiers", "modifier_tous_dossiers", "archiver_dossiers",
        "voir_finances_globales", "voir_marges_emoluments", "valider_signature_actes",
        "gerer_equipe", "gerer_parametres", "acceder_archives", "reprendre_stock_anterieur",
        "cloturer_dossier", "attribuer_minute"
      ]
    },
    PREMIER_CLERC: {
      id: "premier_clerc",
      label: "Premier Clerc",
      sousTitre: "Supervision de l'instruction",
      couleur: "#1E3E62",
      permissions: [
        "voir_tous_dossiers", "modifier_tous_dossiers", "controler_legalite",
        "gerer_equipe", "acceder_archives", "reprendre_stock_anterieur",
        "cloturer_dossier", "attribuer_minute"
      ]
    },
    CLERC_REDACTEUR: {
      id: "clerc_redacteur",
      label: "Clerc Rédacteur",
      sousTitre: "Dossiers assignés — rédaction",
      couleur: "#0F5132",
      permissions: [
        "voir_dossiers_assignes", "modifier_dossiers_assignes", "creer_dossier",
        "modifier_taches", "valider_pieces_kyc"
      ]
    },
    CLERC_FORMALISTE: {
      id: "clerc_formaliste",
      label: "Clerc aux Formalités",
      sousTitre: "Conservation Foncière, DGI, Greffe",
      couleur: "#C2410C",
      permissions: [
        "voir_dossiers_formalites", "modifier_statut_formalites", "modifier_taches"
      ]
    },
    COMPTABLE_TAXATEUR: {
      id: "comptable_taxateur",
      label: "Comptable Taxateur",
      sousTitre: "Taxe, encaissements, facturation",
      couleur: "#047857",
      permissions: [
        "voir_tous_dossiers", "voir_finances_globales", "modifier_fiche_taxe",
        "generer_facture", "encaisser_provision", "exporter_rapports_financiers"
      ]
    },
    ASSISTANTE: {
      id: "assistante",
      label: "Assistante / Accueil",
      sousTitre: "Accueil, ouverture de dossier, RDV",
      couleur: "#7C3AED",
      permissions: ["creer_dossier", "modifier_pieces_kyc", "planifier_rdv", "voir_dossiers_assignes"]
    }
  };

  var ORDRE_ROLES = ["NOTAIRE", "PREMIER_CLERC", "CLERC_REDACTEUR", "CLERC_FORMALISTE", "COMPTABLE_TAXATEUR", "ASSISTANTE"];

  function aPermission(roleId, permission) {
    var role = null;
    for (var i = 0; i < ORDRE_ROLES.length; i++) {
      if (USER_ROLES[ORDRE_ROLES[i]].id === roleId) { role = USER_ROLES[ORDRE_ROLES[i]]; break; }
    }
    if (!role) return false;
    return role.permissions.indexOf(permission) !== -1;
  }

  // ---------------------------------------------------------------------
  // 2. Pipeline Kanban — 6 étapes universelles
  // ---------------------------------------------------------------------
  // delaiStandardJoursDefaut : valeur de départ, seedée en paramètres d'étude
  // et modifiable depuis l'écran Paramètres (jamais câblée en dur ailleurs
  // que comme valeur de départ ici).
  var ETAPES_KANBAN = [
    { id: 1, code: "COLLECTE_KYC", label: "Collecte & KYC", description: "Vérification CNI/passeport, extrait < 3 mois, régime matrimonial.", delaiStandardJoursDefaut: 7 },
    { id: 2, code: "REQUISITIONS", label: "Réquisitions & états préalables", description: "Conservation Foncière, TCA, certificat d'urbanisme.", delaiStandardJoursDefaut: 15 },
    { id: 3, code: "REDACTION", label: "Rédaction du projet d'acte", description: "Contrôle notarial de légalité.", delaiStandardJoursDefaut: 10 },
    { id: 4, code: "SIGNATURE", label: "Rendez-vous de signature", description: "Lecture et signature des comparants et du notaire.", delaiStandardJoursDefaut: 5 },
    { id: 5, code: "FORMALITES", label: "Formalités DGI & Conservation Foncière", description: "Enregistrement fiscal, formalité fusionnée, inscription foncière.", delaiStandardJoursDefaut: 30 },
    { id: 6, code: "EXPEDITIONS", label: "Expéditions & clôture", description: "Remise de la grosse/expéditions, CMPF, RCCM, archivage.", delaiStandardJoursDefaut: 10 }
  ];

  // ---------------------------------------------------------------------
  // 3. Statuts de tâche
  // ---------------------------------------------------------------------
  var STATUTS_TACHE = [
    { id: "non_demarree", label: "Non démarrée", pourcentage: 0 },
    { id: "attente_client", label: "En attente client", pourcentage: 25 },
    { id: "en_cours", label: "En cours", pourcentage: 50 },
    { id: "depot_effectue", label: "Dépôt effectué", pourcentage: 75 },
    { id: "effectuee", label: "Effectuée", pourcentage: 100 }
  ];

  // ---------------------------------------------------------------------
  // 4. Tâches communes à tout dossier, par étape
  // ---------------------------------------------------------------------
  var TACHES_COMMUNES = [
    // Étape 1 — Collecte & KYC
    { etape: 1, label: "Vérifier la pièce d'identité (CNI/passeport) de chaque comparant", bloquante: true },
    { etape: 1, label: "Vérifier la validité de l'extrait de naissance (< 3 mois)", bloquante: true },
    { etape: 1, label: "Identifier le régime matrimonial des comparants mariés", bloquante: true },
    { etape: 1, label: "Recueillir un justificatif de domicile récent", bloquante: false },
    { etape: 1, label: "Ouvrir la fiche client dans le registre de l'étude", bloquante: false },
    { etape: 1, label: "Planifier le premier rendez-vous avec les parties", bloquante: false },
    { etape: 1, label: "Vérifier l'existence d'une procuration si comparant représenté", bloquante: false },
    // Étape 2 — Réquisitions & états préalables
    { etape: 2, label: "Déposer la réquisition d'état à la Conservation Foncière", bloquante: true },
    { etape: 2, label: "Obtenir le certificat de situation juridique du bien/de la société", bloquante: true },
    { etape: 2, label: "Vérifier l'absence d'opposition ou d'inscription contraire", bloquante: false },
    { etape: 2, label: "Demander le certificat d'urbanisme si nécessaire", bloquante: false },
    { etape: 2, label: "Contrôler la conformité fiscale (quitus/attestation de non redevance)", bloquante: false },
    // Étape 3 — Rédaction du projet d'acte
    { etape: 3, label: "Rédiger le projet d'acte", bloquante: true },
    { etape: 3, label: "Contrôle de légalité par le notaire ou le premier clerc", bloquante: true },
    { etape: 3, label: "Faire valider le projet par les parties avant signature", bloquante: false },
    { etape: 3, label: "Préparer le dossier de taxation (fiche de taxe)", bloquante: false },
    // Étape 4 — Rendez-vous de signature
    { etape: 4, label: "Convoquer les parties au rendez-vous de signature", bloquante: false },
    { etape: 4, label: "Procéder à la lecture intégrale de l'acte", bloquante: true },
    { etape: 4, label: "Recueillir les signatures des comparants et du notaire", bloquante: true },
    { etape: 4, label: "Encaisser la provision restante avant clôture de signature", bloquante: false },
    // Étape 5 — Formalités DGI & Conservation Foncière
    { etape: 5, label: "Présenter l'acte à l'enregistrement DGI dans le délai légal (1 mois)", bloquante: true },
    { etape: 5, label: "Payer les droits d'enregistrement et le timbre fiscal", bloquante: true },
    { etape: 5, label: "Déposer la formalité fusionnée / l'inscription au livre foncier", bloquante: false },
    { etape: 5, label: "Suivre le retour de la Conservation Foncière ou du Greffe (RCCM)", bloquante: false },
    // Étape 6 — Expéditions & clôture
    { etape: 6, label: "Établir l'arrêté de compte client définitif", bloquante: true },
    { etape: 6, label: "Remettre la grosse ou les expéditions aux parties", bloquante: true },
    { etape: 6, label: "Classer le dossier au répertoire chronologique des minutes", bloquante: true },
    { etape: 6, label: "Archiver le dossier physique et numérique", bloquante: false }
  ];

  // ---------------------------------------------------------------------
  // 5. Catalogue des actes notariaux (Décret N° 2013-279 & pratique CI)
  // ---------------------------------------------------------------------
  // bareme : famille d'émoluments dégressifs applicable (voir BAREME_EMOLUMENTS).
  //   "minimum_minute" = pas de barème pourcentage connu et chiffré dans le
  //   CDC pour ce type d'acte : seul le minimum légal de minute s'applique
  //   par défaut (comportement conservateur, jamais une invention de taux).
  // droitEnregistrement.aConfirmer : true si le taux n'est pas donné avec
  // certitude dans le cahier des charges pour ce type d'acte précis.
  var CATALOGUE_ACTES = [
    // --- Actes immobiliers & fonciers ---
    { id: "vente_immo_urbaine", categorie: "immobilier", label: "Vente immobilière / Cession de terrain urbain (ACD ou Titre Foncier)",
      bareme: "vente", droitEnregistrement: { taux: 0.04, aConfirmer: false },
      tachesSpecifiques: [
        { etape: 1, label: "Vérifier l'ACD ou le Titre Foncier du vendeur" },
        { etape: 1, label: "Vérifier la capacité juridique du vendeur (majorité, autorisation du conjoint si bien commun)" },
        { etape: 2, label: "Obtenir l'état foncier vierge de charges" },
        { etape: 2, label: "Vérifier la conformité du bornage" },
        { etape: 2, label: "Vérifier l'absence de saisie ou de préemption sur le bien" },
        { etape: 3, label: "Chiffrer le prix de vente et les conditions de paiement" },
        { etape: 4, label: "Encaisser le prix ou vérifier le virement bancaire avant signature" },
        { etape: 5, label: "Effectuer la mutation au livre foncier" },
        { etape: 5, label: "Payer le salaire du conservateur foncier" },
        { etape: 6, label: "Délivrer le nouveau titre au nom de l'acquéreur" },
        { etape: 6, label: "Notifier la mutation aux services fiscaux locaux" }
      ] },
    { id: "vente_parcelle_rurale", categorie: "immobilier", label: "Vente de parcelle foncière rurale",
      bareme: "vente", droitEnregistrement: { taux: 0.04, aConfirmer: false },
      tachesSpecifiques: [
        { etape: 1, label: "Identifier le chef de terre ou l'autorité coutumière compétente" },
        { etape: 2, label: "Diligenter l'enquête foncière villageoise" },
        { etape: 2, label: "Vérifier le certificat foncier auprès du service compétent" },
        { etape: 2, label: "Vérifier l'absence de litige coutumier sur la parcelle" },
        { etape: 2, label: "Vérifier le plan de bornage rural" },
        { etape: 3, label: "Recueillir l'attestation des témoins de la coutume villageoise" },
        { etape: 5, label: "Déposer le dossier de purge des droits coutumiers si nécessaire" },
        { etape: 5, label: "Suivre la délivrance du titre de propriété rural" },
        { etape: 6, label: "Notifier le sous-préfet de la mutation" }
      ] },
    { id: "promesse_vente", categorie: "immobilier", label: "Promesse de vente / Compromis avec séquestre",
      bareme: "vente", droitEnregistrement: { taux: 0.04, aConfirmer: false },
      tachesSpecifiques: [
        { etape: 1, label: "Définir les conditions suspensives de la promesse" },
        { etape: 1, label: "Fixer le délai de réitération par acte authentique" },
        { etape: 3, label: "Rédiger la clause pénale en cas de rétractation" },
        { etape: 4, label: "Encaisser le séquestre sur le compte CDC-CI de l'étude" },
        { etape: 5, label: "Suivre la levée des conditions suspensives" },
        { etape: 5, label: "Relancer les parties avant l'expiration du délai de réitération" },
        { etape: 6, label: "Restituer ou libérer le séquestre selon l'issue de la promesse" }
      ] },
    { id: "bail_construction", categorie: "immobilier", label: "Bail à construction (30 ans et plus)",
      bareme: "minimum_minute", droitEnregistrement: { taux: 0.025, aConfirmer: false },
      tachesSpecifiques: [
        { etape: 1, label: "Vérifier la qualité de propriétaire du bailleur" },
        { etape: 3, label: "Vérifier la durée du bail (30 ans minimum)" },
        { etape: 3, label: "Définir le sort des constructions en fin de bail" },
        { etape: 3, label: "Fixer les modalités de la redevance annuelle" },
        { etape: 5, label: "Inscrire le bail au livre foncier" },
        { etape: 6, label: "Notifier l'inscription au preneur" }
      ] },
    { id: "bail_pro_commercial", categorie: "immobilier", label: "Bail à usage professionnel ou commercial",
      bareme: "minimum_minute", droitEnregistrement: { taux: 0.025, aConfirmer: false },
      tachesSpecifiques: [
        { etape: 1, label: "Vérifier le RCCM du preneur si personne morale" },
        { etape: 2, label: "Vérifier la destination autorisée des locaux (usage commercial)" },
        { etape: 3, label: "Calculer le cumul des loyers sur la durée du bail" },
        { etape: 3, label: "Vérifier la clause de révision du loyer" },
        { etape: 3, label: "Vérifier le cautionnement bancaire du preneur" },
        { etape: 3, label: "Rédiger la clause de renouvellement / droit au bail" },
        { etape: 5, label: "Enregistrer le bail à la DGI" }
      ] },
    { id: "bail_rural", categorie: "immobilier", label: "Bail rural",
      bareme: "minimum_minute", droitEnregistrement: { taux: 0.025, aConfirmer: false },
      tachesSpecifiques: [
        { etape: 2, label: "Vérifier le statut foncier coutumier de la terre louée" },
        { etape: 3, label: "Fixer la nature et le montant du fermage" },
        { etape: 3, label: "Préciser les cultures autorisées et les obligations d'entretien" },
        { etape: 5, label: "Enregistrer le bail rural auprès du service compétent" }
      ] },
    { id: "lotissement_reservation", categorie: "immobilier", label: "Convention de lotissement & contrat de réservation",
      bareme: "minimum_minute", droitEnregistrement: { taux: 0, aConfirmer: true },
      tachesSpecifiques: [
        { etape: 2, label: "Vérifier le numéro de lot et d'îlot approuvé" },
        { etape: 2, label: "Vérifier l'approbation ministérielle du lotissement" },
        { etape: 3, label: "Vérifier le plan de masse du lotissement" },
        { etape: 3, label: "Fixer l'échéancier de paiement du prix de réservation" },
        { etape: 5, label: "Suivre la délivrance du titre définitif du lot" }
      ] },

    // --- Actes de sociétés & droit commercial (OHADA/CEPICI/TCA) ---
    { id: "constitution_societe", categorie: "societes", label: "Constitution de société (SARL, SAS, SA, SNC, SCI)",
      bareme: "societe", droitEnregistrement: { taux: 0, montantFixe: 25000, aConfirmer: true },
      tachesSpecifiques: [
        { etape: 1, label: "Vérifier l'identité et la capacité des associés fondateurs" },
        { etape: 1, label: "Recueillir le projet de statuts fourni par les associés" },
        { etape: 3, label: "Rédiger les statuts de la société" },
        { etape: 3, label: "Établir la Déclaration de Souscription et de Versement (DSV)" },
        { etape: 3, label: "Vérifier le blocage des fonds de capital social en banque" },
        { etape: 3, label: "Désigner le ou les premiers dirigeants dans les statuts" },
        { etape: 5, label: "Déposer le dossier au Guichet Unique du CEPICI" },
        { etape: 5, label: "Déposer le dossier au Greffe du Tribunal de Commerce d'Abidjan" },
        { etape: 5, label: "Obtenir l'immatriculation RCCM et l'IDU" },
        { etape: 6, label: "Publier l'annonce légale (Fraternité Matin / Journal Officiel)" },
        { etape: 6, label: "Remettre l'expédition des statuts et le RCCM aux dirigeants" }
      ] },
    { id: "cession_parts_sociales", categorie: "societes", label: "Cession de parts sociales & droits sociaux",
      bareme: "societe", droitEnregistrement: { taux: 0, aConfirmer: true },
      tachesSpecifiques: [
        { etape: 1, label: "Vérifier la répartition actuelle du capital au registre des associés" },
        { etape: 2, label: "Vérifier l'agrément préalable des associés si requis par les statuts" },
        { etape: 3, label: "Rédiger l'acte de cession et fixer le prix des parts" },
        { etape: 5, label: "Déposer la formalité modificative au greffe" },
        { etape: 5, label: "Enregistrer la cession au registre des associés" },
        { etape: 6, label: "Notifier la cession à la société et aux tiers concernés" }
      ] },
    { id: "augmentation_reduction_capital", categorie: "societes", label: "Augmentation / réduction de capital social",
      bareme: "societe", droitEnregistrement: { taux: 0, aConfirmer: true },
      tachesSpecifiques: [
        { etape: 2, label: "Vérifier le rapport du commissaire aux comptes si requis" },
        { etape: 3, label: "Rédiger le procès-verbal d'assemblée constatant la modification" },
        { etape: 3, label: "Mettre à jour les statuts en conséquence" },
        { etape: 5, label: "Déposer la modification statutaire au greffe" },
        { etape: 6, label: "Publier l'avis modificatif" }
      ] },
    { id: "fusion", categorie: "societes", label: "Fusion de sociétés",
      bareme: "societe", droitEnregistrement: { taux: 0, aConfirmer: true },
      tachesSpecifiques: [
        { etape: 2, label: "Vérifier le traité de fusion et le rapport du commissaire à la fusion" },
        { etape: 2, label: "Vérifier la situation des sociétés absorbée et absorbante au RCCM" },
        { etape: 3, label: "Rédiger l'acte constatant la fusion" },
        { etape: 5, label: "Déposer la déclaration de fusion au greffe" },
        { etape: 6, label: "Publier l'avis de fusion" },
        { etape: 6, label: "Suivre la radiation de la société absorbée" }
      ] },
    { id: "dissolution_liquidation", categorie: "societes", label: "Dissolution & liquidation",
      bareme: "societe", droitEnregistrement: { taux: 0, aConfirmer: true },
      tachesSpecifiques: [
        { etape: 2, label: "Vérifier la situation comptable de clôture" },
        { etape: 3, label: "Nommer le liquidateur" },
        { etape: 3, label: "Rédiger le procès-verbal de dissolution" },
        { etape: 5, label: "Déposer la dissolution au greffe" },
        { etape: 5, label: "Établir le compte définitif de liquidation" },
        { etape: 6, label: "Radier la société au RCCM à la clôture de liquidation" }
      ] },
    { id: "pv_assemblee", categorie: "societes", label: "Procès-verbal d'assemblée générale (ordinaire/extraordinaire)",
      bareme: "societe", droitEnregistrement: { taux: 0, aConfirmer: true },
      tachesSpecifiques: [
        { etape: 1, label: "Vérifier la convocation régulière des associés/actionnaires" },
        { etape: 3, label: "Vérifier le quorum et la majorité requise" },
        { etape: 3, label: "Rédiger les résolutions adoptées" },
        { etape: 5, label: "Déposer le procès-verbal au greffe si formalité requise" }
      ] },
    { id: "nantissement_fonds_commerce", categorie: "societes", label: "Nantissement de fonds de commerce & de matériel",
      bareme: "minimum_minute", droitEnregistrement: { taux: 0, aConfirmer: true },
      tachesSpecifiques: [
        { etape: 2, label: "Vérifier l'absence de nantissement antérieur sur le fonds" },
        { etape: 3, label: "Décrire précisément les éléments du fonds nantis" },
        { etape: 5, label: "Établir le bordereau de nantissement au greffe" },
        { etape: 6, label: "Remettre l'attestation d'inscription au créancier" }
      ] },

    // --- Actes de famille, successions & libéralités ---
    { id: "declaration_succession", categorie: "successions", label: "Déclaration de succession & liquidation de communauté",
      bareme: "minimum_minute", droitEnregistrement: { taux: 0.03, aConfirmer: false },
      tachesSpecifiques: [
        { etape: 1, label: "Établir l'arbre généalogique des héritiers" },
        { etape: 1, label: "Recueillir l'acte de décès du de cujus" },
        { etape: 1, label: "Dresser l'acte de notoriété" },
        { etape: 2, label: "Dresser l'inventaire des biens de la succession" },
        { etape: 2, label: "Obtenir le jugement d'hérédité et le certificat de non-appel" },
        { etape: 2, label: "Vérifier l'existence d'un testament antérieur" },
        { etape: 3, label: "Liquider le régime matrimonial préalablement au partage" },
        { etape: 5, label: "Déposer la déclaration de succession à la DGI" },
        { etape: 5, label: "Effectuer la mutation au livre foncier (CMPF)" },
        { etape: 6, label: "Remettre l'attestation notariée de propriété aux héritiers" }
      ] },
    { id: "partage_actifs", categorie: "successions", label: "Partage d'actifs successoraux",
      bareme: "minimum_minute", droitEnregistrement: { taux: 0, aConfirmer: true },
      tachesSpecifiques: [
        { etape: 2, label: "Évaluer les biens immeubles, le numéraire et les titres à partager" },
        { etape: 3, label: "Établir l'état liquidatif du partage (immeubles, numéraire, titres)" },
        { etape: 3, label: "Constituer les lots et vérifier leur équivalence" },
        { etape: 4, label: "Recueillir l'accord de tous les copartageants avant signature" },
        { etape: 5, label: "Publier le partage si biens immobiliers concernés" }
      ] },
    { id: "donation", categorie: "successions", label: "Donation entre vifs & donation-partage",
      bareme: "minimum_minute", droitEnregistrement: { taux: 0, aConfirmer: true },
      tachesSpecifiques: [
        { etape: 1, label: "Vérifier la capacité du donateur et l'acceptation du donataire" },
        { etape: 3, label: "Vérifier la réserve d'usufruit éventuelle du donateur" },
        { etape: 3, label: "Vérifier le respect de la réserve héréditaire" },
        { etape: 5, label: "Enregistrer la donation à la DGI" },
        { etape: 5, label: "Effectuer la mutation au livre foncier si bien immobilier" }
      ] },
    { id: "testament", categorie: "successions", label: "Testament authentique & dépôt de testament olographe",
      bareme: "minimum_minute", droitEnregistrement: { taux: 0, aConfirmer: true },
      tachesSpecifiques: [
        { etape: 1, label: "Vérifier la capacité et le libre consentement du testateur" },
        { etape: 3, label: "Recueillir les dernières volontés en présence des témoins requis" },
        { etape: 3, label: "Inscrire l'acte au répertoire des dispositions de dernières volontés" },
        { etape: 6, label: "Conserver l'acte sous scellé jusqu'à ouverture de la succession" }
      ] },

    // --- Actes de crédit, sûretés & garanties ---
    { id: "pret_notarie_hypotheque", categorie: "credit", label: "Prêt notarié & inscription hypothécaire",
      bareme: "pret", droitEnregistrement: { taux: 0.015, aConfirmer: false },
      tachesSpecifiques: [
        { etape: 1, label: "Vérifier l'offre de prêt et le tableau d'amortissement de la banque" },
        { etape: 2, label: "Obtenir l'état foncier vierge du bien hypothéqué" },
        { etape: 3, label: "Rédiger la convention de prêt et l'affectation hypothécaire" },
        { etape: 4, label: "Vérifier le déblocage des fonds par la banque prêteuse" },
        { etape: 5, label: "Obtenir le certificat d'inscription hypothécaire (CIH)" },
        { etape: 6, label: "Délivrer la grosse exécutoire" },
        { etape: 6, label: "Notifier l'inscription hypothécaire à la banque" }
      ] },
    { id: "mainlevee_hypotheque", categorie: "credit", label: "Mainlevée d'hypothèque & radiation foncière",
      bareme: "minimum_minute", droitEnregistrement: { taux: 0, aConfirmer: true },
      tachesSpecifiques: [
        { etape: 1, label: "Vérifier l'identité du débiteur et la référence de l'inscription à radier" },
        { etape: 2, label: "Obtenir l'attestation de solde de la banque" },
        { etape: 3, label: "Rédiger l'acte de mainlevée" },
        { etape: 5, label: "Radier l'hypothèque au livre foncier" },
        { etape: 6, label: "Obtenir l'état foncier sans charge" },
        { etape: 6, label: "Remettre l'état foncier apuré au débiteur" }
      ] },
    { id: "reconnaissance_dette", categorie: "credit", label: "Reconnaissance de dette notariée",
      bareme: "pret", droitEnregistrement: { taux: 0.015, aConfirmer: false },
      tachesSpecifiques: [
        { etape: 1, label: "Vérifier l'identité du débiteur et du créancier" },
        { etape: 3, label: "Fixer le montant, le taux d'intérêt et l'échéancier de remboursement" },
        { etape: 4, label: "Faire signer la reconnaissance de dette par le débiteur" },
        { etape: 6, label: "Remettre la grosse exécutoire au créancier" }
      ] },
    { id: "cautionnement", categorie: "credit", label: "Cautionnement solidaire et indivisible",
      bareme: "minimum_minute", droitEnregistrement: { taux: 0, aConfirmer: true },
      tachesSpecifiques: [
        { etape: 1, label: "Vérifier l'identité et la solvabilité apparente de la caution" },
        { etape: 3, label: "Vérifier l'étendue et la durée de l'engagement de caution" },
        { etape: 3, label: "Informer la caution des conséquences de la solidarité" },
        { etape: 4, label: "Faire signer la mention manuscrite légale de la caution" }
      ] },

    // --- Actes divers & actes en brevet ---
    { id: "procuration", categorie: "divers", label: "Procuration notariée (générale ou spéciale)",
      bareme: "minimum_minute", droitEnregistrement: { taux: 0, montantFixe: 0, aConfirmer: true },
      tachesSpecifiques: [
        { etape: 1, label: "Vérifier l'identité du mandant et du mandataire" },
        { etape: 3, label: "Définir précisément l'étendue des pouvoirs conférés" },
        { etape: 3, label: "Fixer la durée de validité de la procuration" },
        { etape: 6, label: "Remettre l'expédition de la procuration au mandataire" }
      ] },
    { id: "protocole_accord", categorie: "divers", label: "Protocole d'accord transactionnel & convention de règlement amiable",
      bareme: "minimum_minute", droitEnregistrement: { taux: 0, aConfirmer: true },
      tachesSpecifiques: [
        { etape: 1, label: "Recueillir l'objet du différend et les prétentions de chaque partie" },
        { etape: 3, label: "Rédiger les concessions réciproques des parties" },
        { etape: 4, label: "Faire signer le protocole par toutes les parties" },
        { etape: 6, label: "Notifier la clôture du différend aux parties" }
      ] },
    { id: "declaration_patrimoine", categorie: "divers", label: "Déclaration de patrimoine",
      bareme: "minimum_minute", droitEnregistrement: { taux: 0, aConfirmer: true },
      tachesSpecifiques: [
        { etape: 1, label: "Recueillir la liste exhaustive des biens du déclarant" },
        { etape: 2, label: "Vérifier les justificatifs de propriété fournis" },
        { etape: 3, label: "Établir l'acte de déclaration de patrimoine" }
      ] },
    { id: "certification", categorie: "divers", label: "Certification de signature & certification conforme",
      bareme: "minimum_minute", droitEnregistrement: { taux: 0, montantFixe: 0, aConfirmer: true },
      tachesSpecifiques: [
        { etape: 1, label: "Vérifier l'identité du signataire ou du détenteur du document" },
        { etape: 3, label: "Comparer le document présenté à l'original" },
        { etape: 4, label: "Apposer la certification et le sceau de l'étude" }
      ] }
  ];

  var CATEGORIES_ACTES = [
    { id: "immobilier", label: "Actes immobiliers & fonciers" },
    { id: "societes", label: "Actes de sociétés & droit commercial" },
    { id: "successions", label: "Actes de famille, successions & libéralités" },
    { id: "credit", label: "Actes de crédit, sûretés & garanties" },
    { id: "divers", label: "Actes divers & actes en brevet" }
  ];

  function getActe(acteId) {
    for (var i = 0; i < CATALOGUE_ACTES.length; i++) {
      if (CATALOGUE_ACTES[i].id === acteId) return CATALOGUE_ACTES[i];
    }
    return null;
  }

  // Construit la checklist complète d'un dossier (tâches communes + spécifiques à l'acte)
  function construireChecklist(acteId) {
    var acte = getActe(acteId);
    var taches = [];
    var ordre = 0;
    TACHES_COMMUNES.forEach(function (t) {
      ordre++;
      taches.push({ id: "c" + ordre, etape: t.etape, label: t.label, bloquante: !!t.bloquante, statut: "non_demarree", source: "commune" });
    });
    if (acte) {
      acte.tachesSpecifiques.forEach(function (t) {
        ordre++;
        taches.push({ id: "s" + ordre, etape: t.etape, label: t.label, bloquante: !!t.bloquante, statut: "non_demarree", source: "specifique" });
      });
    }
    return taches;
  }

  // Taille totale du référentiel de tâches standards (communes + toutes spécifiques du catalogue)
  function tailleReferentielTaches() {
    var total = TACHES_COMMUNES.length;
    CATALOGUE_ACTES.forEach(function (a) { total += a.tachesSpecifiques.length; });
    return total;
  }

  // ---------------------------------------------------------------------
  // 6. Barèmes fiscaux par défaut (Décret N° 2013-279 du 24/04/2013)
  // ---------------------------------------------------------------------
  // Toutes les valeurs ci-dessous sont des VALEURS DE DÉPART, modifiables
  // depuis l'écran Paramètres de l'étude et stockées en LocalStorage — elles
  // ne sont jamais recâblées en dur ailleurs dans le code applicatif.
  var BAREME_EMOLUMENTS_DEFAUT = {
    // tranches dégressives : { jusqua: montant|null, taux: décimal }
    vente: [
      { jusqua: 10000000, taux: 0.04 },
      { jusqua: 30000000, taux: 0.025 },
      { jusqua: 90000000, taux: 0.015 },
      { jusqua: null, taux: 0.0075 }
    ],
    societe: [
      { jusqua: 10000000, taux: 0.03 },
      { jusqua: 30000000, taux: 0.015 },
      { jusqua: 90000000, taux: 0.0075 },
      { jusqua: null, taux: 0.0035 }
    ],
    pret: [
      { jusqua: 10000000, taux: 0.02 },
      { jusqua: 30000000, taux: 0.01 },
      { jusqua: 90000000, taux: 0.005 },
      { jusqua: null, taux: 0.0025 }
    ]
  };

  var PARAMETRES_FISCAUX_DEFAUT = {
    tauxTVA: 0.18,
    minimumLegalMinute: 50000,
    tarifRoleMinute: 3000,
    conservationFonciere: {
      tauxSalaireConservateur: 0.01,
      inscriptionFonciereFixe: 15000,
      radiationFixe: 30000
    },
    timbreFiscalParFeuille: 2000,
    debours: {
      forfaitPapeterieAffranchissement: 20000,
      expeditionCopieAuthentiqueParUnite: 15000,
      extraitTopoCadastre: 25000
    },
    delaiEnregistrementJours: 30,
    penaliteRetardEnregistrement: { tauxFixe: 0.10, tauxMensuel: 0.01 },
    delaiDeclarationTVAJourDuMois: 15
  };

  // ---------------------------------------------------------------------
  // 7. Paramètres d'étude par défaut (identité, hors barèmes fiscaux)
  // ---------------------------------------------------------------------
  var PARAMETRES_ETUDE_DEFAUT = {
    nomEtude: "Office Notarial — À renseigner",
    titreNotaire: "Notaire Titulaire",
    adresse: "Abidjan, Côte d'Ivoire",
    telephone: "",
    email: "",
    numeroCC: "",
    centreImpots: "",
    compteSequestreCDCI: "",
    delaisEtapesJours: (function () {
      var d = {};
      ETAPES_KANBAN.forEach(function (e) { d[e.code] = e.delaiStandardJoursDefaut; });
      return d;
    })(),
    seuilStagnationJours: 7,
    seuilAlerteAmbreHeures: 48
  };

  return {
    USER_ROLES: USER_ROLES,
    ORDRE_ROLES: ORDRE_ROLES,
    aPermission: aPermission,
    ETAPES_KANBAN: ETAPES_KANBAN,
    STATUTS_TACHE: STATUTS_TACHE,
    TACHES_COMMUNES: TACHES_COMMUNES,
    CATALOGUE_ACTES: CATALOGUE_ACTES,
    CATEGORIES_ACTES: CATEGORIES_ACTES,
    getActe: getActe,
    construireChecklist: construireChecklist,
    tailleReferentielTaches: tailleReferentielTaches,
    BAREME_EMOLUMENTS_DEFAUT: BAREME_EMOLUMENTS_DEFAUT,
    PARAMETRES_FISCAUX_DEFAUT: PARAMETRES_FISCAUX_DEFAUT,
    PARAMETRES_ETUDE_DEFAUT: PARAMETRES_ETUDE_DEFAUT
  };
})();
