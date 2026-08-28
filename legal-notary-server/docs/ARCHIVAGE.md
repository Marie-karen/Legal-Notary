# Archivage numérique & physique

Règle demandée explicitement par l'utilisatrice : « l'archivage doit
avoir la logique des meilleures pratiques d'archivage numérique et
physique, ça doit permettre d'archiver le plus vieux dossiers avec des
numéros qui correspondent au physique ».

## Les deux étapes

### 1. Clôture — trace numérique immédiate

Quand un dossier est terminé (`POST /api/dossiers/:id/cloturer`,
`archives.service.js#cloturerDossier`) :

- le dossier passe au statut `cloture` ;
- il reçoit immédiatement un **numéro de minute** officiel
  (`MIN-2026/014`), séquentiel par année ;
- une ligne est créée dans `minutes_archive` avec
  `statut_archivage = 'a_archiver'` — le dossier existe numériquement,
  mais n'a pas encore de place physique attribuée.

### 2. Archivage physique — toujours le plus ancien en premier

Le classement physique (mise en carton) est une action séparée
(`POST /api/archives/archiver-suivant` ou `/archiver-lot`,
`archives.service.js#archiverProchainDossier`) :

- elle prend systématiquement le dossier `a_archiver` avec la **date de
  clôture la plus ancienne** (`ORDER BY date_cloture ASC` — file FIFO) ;
- elle lui attribue une place dans le **carton actuellement ouvert**
  (`cartons_archive`, statut `ouvert`) ;
- si le carton atteint sa capacité (`capacite_carton_archive`,
  paramétrable, 50 par défaut), il passe `plein` et le carton suivant sera
  créé automatiquement au prochain archivage (numérotation strictement
  séquentielle : `CARTON-001`, `CARTON-002`, ...).

## Pourquoi FIFO (le plus ancien en premier)

C'est la pratique d'archivage physique recommandée pour un fonds
documentaire qui grandit en continu :

- elle évite qu'un dossier ancien reste indéfiniment "à classer" pendant
  que des dossiers plus récents passent devant lui — sans cette règle,
  rien n'empêche qu'un dossier de 2022 traîne encore en pile alors que des
  dossiers de 2026 sont déjà rangés ;
- elle garantit que **le numéro de carton suit l'ordre chronologique
  réel** : chercher un dossier ancien revient à chercher un petit numéro
  de carton (probablement dans les premières étagères), jamais à fouiller
  toute la pile physique en espérant tomber dessus.

## Correspondance numérique ↔ physique

Chaque minute archivée porte un `code_emplacement` composé et lisible,
par exemple :

```
Salle 1 · Armoire A · Rayon 3 · CARTON-014 · position 037
```

C'est cette chaîne exacte qui doit être recopiée sur l'étiquette physique
du carton (ou imprimée dessus) — elle garantit que retrouver le numéro
numérique (`MIN-2026/014`) suffit à retrouver l'emplacement physique exact,
sans avoir à chercher dans un registre séparé.

## Ce qui est configurable

- `capacite_carton_archive` (paramètre du cabinet, `parametres_etude`) :
  combien de dossiers tiennent dans un carton avant qu'il faille en ouvrir
  un nouveau.
- `salle` / `armoire` / `rayonnage` de chaque carton (`cartons_archive`) :
  modifiable via l'API si le cabinet réorganise physiquement sa salle
  d'archives — un carton déjà attribué à des dossiers garde ses données,
  seule la localisation affichée change.

## Ce qui n'est pas encore fait

- Pas d'écran de gestion des cartons (créer/renommer manuellement un
  carton, corriger une localisation) — seule la création automatique à
  l'archivage existe pour l'instant. À prévoir côté frontend si le besoin
  se présente.
- Le lien vers le scan PDF (`scan_url` sur `minutes_archive`) est un champ
  texte libre pour l'instant (chemin ou URL fourni par le cabinet) — pas
  d'upload de fichier intégré côté backend.
