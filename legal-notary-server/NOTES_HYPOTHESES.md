# Hypothèses à valider — Legal Notary (backend)

Ce document liste tout ce que le moteur fiscal applique de façon
conservatrice (0, ou minimum légal) faute de confirmation, et un point
observé dans un document réel qui reste à confirmer précisément. Comme
pour la version précédente du projet, aucun taux n'est inventé : soit une
valeur est confirmée par le Décret 2013-279 (tel que donné dans le cahier
des charges) ou par un document réel du cabinet, soit elle reste à 0/au
minimum légal jusqu'à confirmation.

## Ce qui est confirmé et appliqué

| Élément | Valeur | Source |
|---|---|---|
| Droit d'enregistrement — Vente immobilière | 4 % | Décret 2013-279 (cahier des charges) |
| Droit d'enregistrement — Bail (construction/pro/rural) | 2,5 % | idem |
| Droit d'enregistrement — Prêt notarié | 1,5 % | idem |
| Droit d'enregistrement — Succession | 3 % | idem |
| Droit d'enregistrement — Mainlevée d'hypothèque | 18 000 FCFA fixe | Document réel du cabinet (TEST 1.xlsx) |
| Barème émoluments — Vente (4 tranches) | 4 % / 2,5 % / 1,5 % / 0,75 % | Décret 2013-279 |
| Barème émoluments — Société (4 tranches) | 3 % / 1,5 % / 0,75 % / 0,35 % | Décret 2013-279 |
| Barème émoluments — Prêt (4 tranches) | 2 % / 1 % / 0,5 % / 0,25 % | Décret 2013-279 |
| Taxe foncière — proportionnel | 1,2 % | Document réel (corrige une première hypothèse à 1 %) |
| Taxe foncière — fixe | 3 000 FCFA | Document réel |
| Timbres fiscaux / rôles de minute | 500 FCFA par page, par document | Document réel (corrige une première hypothèse de 2 000 FCFA/feuille forfaitaire) |
| Forfait divers (papeterie/affranchissement) | 20 000 FCFA | Document réel, confirmé exact |
| TVA | 18 % | Cahier des charges |

## Ce qui reste à confirmer avec le notaire

- **Droit d'enregistrement** pour tous les types d'actes non listés
  ci-dessus (constitution de société — le cahier des charges mentionne un
  « droit fixe » sans montant —, cession de parts, donation, testament,
  partage, procuration, protocole d'accord, convention de lotissement,
  déclaration de patrimoine, certifications, nantissement, cautionnement,
  promesse de vente, cession/abandon de droits immobiliers, régularisation
  de titre, mutation de biens immobiliers). Voir `droit_enregistrement_mode
  = 'a_confirmer'` dans `types_actes` — le moteur applique 0 FCFA tant que
  ce n'est pas corrigé (jamais un taux inventé).
- **Émoluments de la mainlevée d'hypothèque** : un document réel du
  cabinet montre un montant observé de 720 500 FCFA d'émoluments sur une
  base de 158 200 000 FCFA (soit environ 0,455 %), mais la formule exacte
  utilisée n'est pas reconstructible avec certitude à partir des données
  disponibles (le fichier Excel ne contenait que des valeurs calculées,
  pas les formules). Le barème « prêt » du Décret n'a volontairement PAS
  été appliqué à la mainlevée (le résultat ne correspondrait pas à ce
  chiffre observé) — la mainlevée reste au minimum légal de minute par
  défaut. **À confirmer avec le cabinet avant toute mise en production.**
- **Frais de formalités** (dépôt banque, dépôt enregistrement, inscription
  au livre foncier, réquisition d'état) : ces montants varient visiblement
  d'un dossier à l'autre dans les documents réels observés (ex.
  inscription au livre foncier à 75 000 FCFA dans un cas) — ils sont donc
  modélisés comme des saisies libres par dossier au moment de la fiche de
  taxe (`fraisFormalites` dans `fiscal.service.js`), pas comme un montant
  fixe universel par type d'acte.
- **Vacations** (frais de déplacement du notaire) : également une saisie
  libre par dossier (150 000 FCFA observé dans un cas réel), aucune règle
  de calcul automatique n'existe pour ce poste.

## Classement des tâches par étape du pipeline

Le classement automatique des ~246/~217 tâches réelles importées (voir
`scripts/importer-referentiel.js`) est fait par mots-clés sur le libellé
de chaque tâche, et vérifié par un test qui échoue si une tâche réelle ne
correspond à aucune règle (`tests/importer-referentiel.test.js`, 17/17 au
moment de la rédaction). C'est un classement raisonnable mais fait à la
main, pas une vérité absolue — un développeur ou le cabinet peut corriger
l'étape d'une tâche précise via
`PATCH /api/referentiel/taches-standard/:id` sans reprise de développement.

## Caractère « bloquant » des tâches

Par défaut, seules les tâches "Collecte d'informations", "Rédaction de
l'acte" et "Signature de l'acte" sont marquées bloquantes à l'import (ce
sont des préalables structurels : rien ne peut logiquement avancer avant
elles). C'est une inférence de bon sens sur le déroulement d'un acte
notarié, pas une règle juridique — le cabinet reste libre de marquer
d'autres tâches comme bloquantes selon sa propre pratique.

## Sécurité des identifiants de notification (ajouté 2026-08-25)

Les identifiants SMTP, SMS et WhatsApp du cabinet
(`parametres_notifications`) sont stockés **en clair** en base dans cette
version — pas de chiffrement au repos. L'accès en lecture/écriture est
strictement limité à la permission `parametres:gerer` (notaire), mais ce
n'est pas équivalent à un chiffrement. **À corriger avant un déploiement à
grande échelle** — voir `docs/NOTIFICATIONS.md`, section Sécurité, pour le
détail et une piste de correction.

## Circuit de rédaction des actes (ajouté 2026-08-25)

Décision explicite de l'utilisatrice : le contenu est rédigé **dans
l'application** par défaut (éditeur intégré, table `dossier_projets_acte`)
plutôt que dans Microsoft Word — mais c'est volontairement optionnel
(`piece_jointe_url` permet un mode de travail alternatif, un fichier
déposé de l'extérieur). Aucune intégration avec Microsoft Word/365 n'a
été construite. Si le besoin d'un export .docx imprimable apparaît plus
tard, c'est un ajout autonome (génération de fichier à partir du contenu
déjà stocké), pas une reprise du circuit de validation.
