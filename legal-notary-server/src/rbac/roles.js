/**
 * src/rbac/roles.js — Rôles et permissions de l'étude (RBAC).
 *
 * IMPORTANT — pourquoi ceci vit dans le code et pas en base de données :
 * la liste des rôles et ce que chaque rôle a le droit de faire sont des
 * décisions STRUCTURELLES de l'outil (qui définissent le modèle de
 * sécurité lui-même), pas des réglages métier du cabinet — contrairement
 * aux taux, délais et seuils qui, eux, vivent dans `parametres_etude` et
 * sont modifiables sans toucher au code. Voir docs/RBAC.md pour le détail
 * de chaque rôle et la justification métier.
 *
 * RÈGLE DE SÉCURITÉ CENTRALE : chaque route de l'API doit vérifier une
 * permission avec `aPermission(role, "...")` — jamais une chaîne de rôle
 * en dur ailleurs dans le code (`if (role === "notaire")`). Cela garantit
 * un seul endroit à auditer pour savoir "qui peut faire quoi", et évite
 * qu'une vérification soit oubliée ou incohérente entre deux routes.
 *
 * Chaque rôle a aussi une portée de VISIBILITÉ des dossiers (pas seulement
 * une liste d'actions) — voir `porteeDossiers(role)` plus bas, utilisée
 * par dossiers.service.js pour filtrer les résultats selon qui interroge :
 * une assistante, un clerc, un notaire, un comptable et un formaliste ne
 * voient jamais exactement la même liste de dossiers ni les mêmes champs.
 */

const ROLES = {
  NOTAIRE: {
    id: "notaire",
    label: "Notaire Titulaire",
    permissions: [
      "dossiers:creer",
      "dossiers:voir_tous",
      "dossiers:modifier_tous",
      "dossiers:archiver",
      "dossiers:cloturer",
      "taches:modifier",
      "finances:voir_globales",
      "finances:voir_marges_emoluments",
      "finances:modifier_compte_client",
      "fiscal:calculer",
      "fiscal:enregistrer_fiche_taxe",
      "equipe:gerer",
      "equipe:voir_salaires",
      "parametres:gerer",
      "archives:acceder",
      "archives:archiver_physiquement",
      "referentiel:gerer",
      "referentiel:fixer_delais",
      "referentiel:creer_acte",
      "referentiel:creer_etape",
      "actes:rediger",
      "actes:valider",
    ],
  },
  PREMIER_CLERC: {
    id: "premier_clerc",
    label: "Premier Clerc",
    permissions: [
      "dossiers:creer",
      "dossiers:voir_tous",
      "dossiers:modifier_tous",
      "dossiers:cloturer",
      "taches:modifier",
      "equipe:gerer",
      "archives:acceder",
      "archives:archiver_physiquement",
      "referentiel:gerer",
      "referentiel:creer_acte",
      "referentiel:creer_etape",
      "actes:rediger",
    ],
  },
  CLERC_REDACTEUR: {
    id: "clerc_redacteur",
    label: "Clerc Rédacteur",
    permissions: [
      "dossiers:voir_assignes",
      "dossiers:modifier_assignes",
      "dossiers:creer",
      "taches:modifier",
      "actes:rediger",
      "archives:acceder",
      "archives:archiver_physiquement",
      "referentiel:creer_acte",
      "referentiel:creer_etape",
    ],
  },
  CLERC_FORMALISTE: {
    id: "clerc_formaliste",
    label: "Clerc aux Formalités",
    permissions: [
      "dossiers:voir_formalites", // dossiers en étape "Formalités DGI & Conservation Foncière" ou "Expéditions & clôture"
      "dossiers:modifier_formalites",
      "taches:modifier",
      "archives:acceder",
      "archives:archiver_physiquement",
      "referentiel:creer_etape",
    ],
  },
  COMPTABLE_TAXATEUR: {
    id: "comptable_taxateur",
    label: "Comptable Taxateur",
    permissions: [
      "dossiers:voir_tous",
      "finances:voir_globales",
      "finances:modifier_compte_client",
      "fiscal:calculer",
      "fiscal:enregistrer_fiche_taxe",
      "referentiel:gerer",
      "archives:acceder",
      "archives:archiver_physiquement",
    ],
  },
  ASSISTANTE: {
    id: "assistante",
    label: "Assistante / Accueil",
    permissions: [
      "dossiers:creer",
      "dossiers:voir_assignes",
      "kyc:modifier",
      "archives:acceder",
      "referentiel:creer_acte",
      "referentiel:creer_etape",
    ],
  },
  ARCHIVISTE: {
    id: "archiviste",
    label: "Archiviste / Minutier",
    permissions: [
      "dossiers:voir_tous",
      "archives:acceder",
      "archives:archiver_physiquement",
      "referentiel:creer_etape",
    ],
  },
  SUPERADMIN: {
    id: "superadmin",
    label: "Super Administrateur SaaS / Éditeur",
    permissions: [
      "dossiers:creer",
      "dossiers:voir_tous",
      "dossiers:modifier_tous",
      "dossiers:archiver",
      "dossiers:cloturer",
      "taches:modifier",
      "finances:voir_globales",
      "finances:voir_marges_emoluments",
      "finances:modifier_compte_client",
      "fiscal:calculer",
      "fiscal:enregistrer_fiche_taxe",
      "equipe:gerer",
      "equipe:voir_salaires",
      "parametres:gerer",
      "archives:acceder",
      "archives:archiver_physiquement",
      "referentiel:gerer",
      "referentiel:fixer_delais",
      "referentiel:creer_acte",
      "referentiel:creer_etape",
      "actes:rediger",
      "actes:valider",
      "superadmin:gerer_parc",
      "superadmin:gerer_licences",
      "superadmin:gerer_tenants",
    ],
  },
};

const LISTE_ROLES = Object.values(ROLES);

function aPermission(role, permission) {
  const definition = LISTE_ROLES.find((r) => r.id === role);
  if (!definition) return false; // rôle inconnu => refus (échec fermé)
  return definition.permissions.includes(permission);
}

/**
 * Portée de visibilité des dossiers par rôle, utilisée pour construire la
 * clause de filtrage SQL côté service (jamais côté frontend seul : un
 * filtrage uniquement visuel ne protège rien si l'API renvoie tout).
 *
 *   - "tous"      : voit tous les dossiers actifs du cabinet.
 *   - "assignes"  : voit seulement les dossiers où il est clerc_assigne.
 *   - "formalites": voit les dossiers arrivés aux étapes 5 (Formalités) et
 *                   6 (Expéditions & clôture), quel que soit l'assigné —
 *                   c'est la vue de travail du clerc aux formalités.
 */
function porteeDossiers(role) {
  switch (role) {
    case "notaire":
    case "superadmin":
    case "premier_clerc":
    case "comptable_taxateur":
    case "archiviste":
      return "tous";
    case "clerc_formaliste":
      return "formalites";
    case "clerc_redacteur":
    case "assistante":
      return "assignes";
    default:
      return "aucune"; // rôle inconnu => aucune donnée (échec fermé)
  }
}

module.exports = { ROLES, LISTE_ROLES, aPermission, porteeDossiers };
