# Hypothèses à valider — Legal Notary

Ce fichier liste les valeurs fiscales que le cahier des charges initial ne
chiffrait pas précisément pour tous les types d'actes. Pour ne pas inventer
de règle de gestion, l'application applique un comportement **conservateur**
par défaut plutôt que de fabriquer un taux : le minimum légal de minute
(50 000 FCFA de départ, modifiable) s'applique et le droit d'enregistrement
est laissé à 0 (ou à une valeur symbolique) tant qu'il n'est pas confirmé.

Toutes les valeurs ci-dessous sont modifiables dans le code
(`js/data.js`, champ `droitEnregistrement` de chaque acte, et
`js/data.js` → `BAREME_EMOLUMENTS_DEFAUT` pour les barèmes d'émoluments) ou,
à terme, depuis l'écran **Paramètres** pour les taux globaux déjà exposés
(TVA, minimum légal de minute, tarif de rôle).

## 1. Barème d'émoluments dégressifs

Le cahier des charges ne donne des tranches chiffrées que pour 3 familles
d'actes : **Vente**, **Société**, **Prêt**. Tous les autres types d'actes du
catalogue (baux, successions, donations, procurations, cautionnements,
mainlevées, testaments, protocoles d'accord, certifications...) se voient
appliquer uniquement le **minimum légal de minute** (50 000 FCFA de départ)
faute de barème pourcentage précisé — jamais un taux inventé.

**À valider avec le notaire** : quelle famille de barème (ou quel taux
spécifique) s'applique réellement à chacun de ces actes en pratique.

## 2. Droits d'enregistrement DGI

Taux confirmés par le cahier des charges (implémentés tels quels) :
- Vente immobilière : 4%
- Bail (construction, professionnel/commercial, rural) : 2,5%
- Prêt notarié / reconnaissance de dette : 1,5%
- Déclaration de succession : 3%

**Non chiffrés par le cahier des charges — marqués `aConfirmer: true` dans
`js/data.js`, valeur de départ prudente (0 ou montant symbolique) :**
- Constitution de société (SARL/SAS/SA/SNC/SCI) — « droit fixe » mentionné
  sans montant ; valeur de départ 25 000 FCFA à confirmer.
- Cession de parts sociales, augmentation/réduction de capital, fusion,
  dissolution/liquidation, procès-verbal d'assemblée, nantissement de fonds
  de commerce.
- Partage d'actifs successoraux, donation, testament.
- Mainlevée d'hypothèque, cautionnement.
- Procuration, protocole d'accord transactionnel, déclaration de
  patrimoine, certification de signature/conforme.
- Convention de lotissement & contrat de réservation.

**À valider avec le notaire** avant toute utilisation en production : ces
montants doivent être confirmés puis saisis dans `js/data.js` (ou exposés
dans un futur écran Paramètres dédié aux droits d'enregistrement par type
d'acte, actuellement seuls les taux globaux — TVA, minimum de minute, tarif
de rôle, barèmes des 3 familles d'émoluments — sont éditables depuis
l'écran Paramètres).

## 3. Checklist de tâches standards

Le cahier des charges évoque « 298 Tâches Standards ». Le référentiel livré
compte 178 tâches réelles et distinctes (28 tâches communes à tout dossier +
150 tâches spécifiques aux 26 types d'actes du catalogue, réparties sur les
6 étapes du pipeline). Ce chiffre n'a pas été forcé à 298 par des tâches de
remplissage sans contenu réel — voir `js/test-suite.js` et `tests.html` pour la
vérification automatisée de ce référentiel. La structure est entièrement
paramétrable (`CATALOGUE_ACTES` dans `js/data.js`) : ajouter des tâches
réelles issues de la pratique de l'étude ne demande aucune reprise de
développement.
