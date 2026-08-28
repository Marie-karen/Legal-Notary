# RBAC — Rôles et permissions

Règle demandée explicitement par l'utilisatrice : « la vue d'une
assistante, d'un clerc, d'un notaire, d'un comptable ne peut pas être
pareille, même du formaliste ». Ce document explique comment c'est
implémenté et pourquoi, pour que le frontend (Claude Design) et un futur
développeur sachent exactement quoi construire pour chaque rôle.

Deux mécanismes distincts, tous les deux nécessaires :

1. **Permissions d'action** (`src/rbac/roles.js`, vérifiées par
   `src/middleware/exigerPermission.js`) : est-ce que ce rôle a le droit
   de faire CETTE action (créer un dossier, clôturer, gérer les
   paramètres...) ?
2. **Portée de visibilité des dossiers** (`porteeDossiers()` dans
   `src/rbac/roles.js`, appliquée dans `dossiers.service.js`) : parmi TOUS
   les dossiers du cabinet, lesquels ce rôle a-t-il le droit de voir ?

Le filtrage de portée est fait **côté serveur, dans la requête SQL**, pas
seulement dans l'affichage du frontend — un filtrage uniquement visuel ne
protège rien puisqu'un appel API direct contournerait l'interface.

## Tableau des rôles

| Rôle | Portée des dossiers | Ce qu'il peut faire en plus |
|---|---|---|
| **Notaire Titulaire** | Tous | Tout : gérer l'équipe (dont les salaires), les paramètres (dont notifications), le référentiel, clôturer, voir les finances globales et les marges d'émoluments, archiver physiquement, rédiger ET valider/renvoyer un projet d'acte |
| **Premier Clerc** | Tous | Modifier tous les dossiers, clôturer, gérer l'équipe et le référentiel, archiver physiquement, rédiger un projet d'acte — mais PAS les paramètres fiscaux/notifications, PAS les salaires, PAS valider un acte (réservé au notaire, voir plus bas) |
| **Clerc Rédacteur** | Seulement les dossiers qui lui sont assignés | Créer un dossier, modifier ses tâches, rédiger/soumettre un projet d'acte |
| **Clerc aux Formalités** | Seulement les dossiers arrivés aux étapes 5 (Formalités DGI & Conservation Foncière) et 6 (Expéditions & clôture), quel que soit le clerc assigné | Modifier les tâches, accéder aux archives, archiver physiquement |
| **Comptable Taxateur** | Tous | Voir les finances globales, calculer et enregistrer les fiches de taxe, modifier le compte client — mais ne modifie pas les dossiers eux-mêmes (étapes, checklist) |
| **Assistante / Accueil** | Seulement les dossiers qui lui sont assignés | Créer un dossier, modifier les pièces KYC |

## Permissions à portée volontairement étroite

- **`equipe:voir_salaires`** — notaire uniquement, même pas le premier
  clerc. Le salaire net (`utilisateurs.salaire_net`) n'est jamais renvoyé
  par l'API à un rôle sans cette permission (voir
  `auth.service.js#utilisateurVersCamel`) : ce n'est pas juste caché à
  l'écran, l'API elle-même ne l'inclut pas dans la réponse JSON.
- **`actes:valider`** — notaire uniquement, y compris exclu du premier
  clerc qui a pourtant `dossiers:modifier_tous`. Ça reflète une contrainte
  légale réelle, pas un choix arbitraire : seul le notaire titulaire peut
  authentifier un acte. `actes:rediger` (rédiger/soumettre un brouillon),
  en revanche, est ouvert au premier clerc et aux clercs rédacteurs.

## Pourquoi ces portées précisément

- **Le clerc aux formalités** ne travaille que sur des dossiers arrivés à
  un certain stade (dépôt DGI, Conservation Foncière, Greffe) — lui
  montrer les dossiers encore en collecte de pièces ou en rédaction n'a
  pas de sens pour son poste, d'où une portée par ÉTAPE plutôt que par
  assignation.
- **Le clerc rédacteur et l'assistante** ne voient que ce qui leur est
  assigné : ce sont les deux rôles qui gèrent le plus grand nombre de
  dossiers en parallèle au quotidien, et la sécurité de base (ne pas
  laisser un clerc consulter le dossier d'un autre clerc, potentiellement
  confidentiel) prime.
- **Le notaire, le premier clerc et le comptable** ont une vue globale :
  ce sont les trois rôles de supervision/contrôle du cabinet.

## Conséquence pour le frontend (Claude Design)

L'API renvoie déjà les bonnes données selon le rôle connecté — le
frontend n'a pas besoin de refaire ce filtrage, seulement d'adapter
l'AFFICHAGE :

- Un tableau de bord de **notaire** peut afficher les marges
  d'émoluments ; celui d'un **clerc rédacteur** ne doit pas les montrer du
  tout (l'API ne les lui enverra pas s'il n'a pas la permission
  `finances:voir_globales`, mais l'écran doit être pensé pour ce rôle dès
  le départ, pas juste masquer un chiffre).
- Un **formaliste** devrait voir un tableau de bord centré sur les délais
  DGI/Conservation Foncière/Greffe, pas un kanban à 6 colonnes complet.
- Une **assistante** a probablement besoin d'un écran d'accueil/ouverture
  de dossier en priorité, pas d'un tableau de bord financier.
- Un **comptable** a besoin d'un écran centré sur les fiches de taxe et le
  compte client, pas sur la checklist de tâches juridiques.

C'est précisément ce que le prompt de démarrage du frontend
(`docs/PROMPT_CLAUDE_DESIGN.md`) demande de concevoir : un tableau de bord
différent par rôle, pas un même écran avec des boutons cachés selon les
droits.

## Ajouter une permission

1. L'ajouter à la liste `permissions` du ou des rôles concernés dans
   `src/rbac/roles.js`.
2. L'utiliser dans une route avec `exigerPermission("categorie:action")`.
3. Ne JAMAIS écrire `if (utilisateur.role === "notaire")` ailleurs dans le
   code — toujours passer par `aPermission()` ou `porteeDossiers()`, pour
   garder un seul endroit à auditer.
