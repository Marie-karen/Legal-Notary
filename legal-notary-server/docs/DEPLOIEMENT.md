# Déploiement sur le serveur du cabinet

Ce backend est prévu pour être installé **une fois par cabinet**, sur un
serveur que le cabinet contrôle (physique, dans ses locaux, ou une machine
cloud louée en son nom — jamais un service centralisé partagé entre
plusieurs cabinets). Aucune étape ci-dessous ne dépend d'un fournisseur
particulier.

Un seul processus Node.js sert à la fois l'API **et** l'interface web
(`legal-notary-web/`, voir `src/server.js`) : un seul programme à lancer,
un seul port à ouvrir, pas de configuration CORS à faire pour que
l'interface parle à l'API. Les modèles prêts à l'emploi cités plus bas
(service systemd, config nginx, script de sauvegarde) vivent dans
`deploiement/`.

## Prérequis sur le serveur

- Node.js ≥ 18
- PostgreSQL ≥ 13 (peut être sur la même machine ou une machine séparée)
- Un nom de domaine pointant vers ce serveur, si le cabinet veut un accès
  HTTPS depuis l'extérieur de son réseau local (recommandé — voir
  section HTTPS plus bas)

## Étapes d'installation

```bash
# 1. Copier legal-notary-server/ ET legal-notary-web/ sur le serveur,
#    comme deux dossiers voisins (même disposition qu'en développement) —
#    voir plus bas si le cabinet préfère une autre disposition.
cd legal-notary-server
npm install --omit=dev

# 2. Créer la base de données PostgreSQL (une fois)
createdb legalnotary

# 3. Configurer les secrets propres à cette installation
cp .env.example .env
# éditer .env :
#   - DATABASE_URL vers la base créée à l'étape 2
#   - JWT_SECRET : générer une valeur unique avec `openssl rand -hex 32`
#     (NE JAMAIS réutiliser la même valeur qu'un autre cabinet)

# 4. Appliquer le schéma et importer le référentiel de départ
npm run migrate
npm run seed

# 5. Créer le tout premier compte (rôle "notaire")
node scripts/creer-premier-utilisateur.js "Nom du notaire" email@etude.ci mot-de-passe-solide

# 6. Démarrer (vérifier ensuite sur http://<serveur>:4000)
npm start
```

Si `legal-notary-web/` est rangé ailleurs que juste à côté de
`legal-notary-server/`, définir `FRONTEND_DIR` dans `.env` (voir
`.env.example`) avec le chemin exact.

## Garder le serveur actif : systemd

Le processus Node.js doit rester actif en permanence et redémarrer tout
seul en cas de plantage ou de redémarrage de la machine. Un modèle prêt à
l'emploi est fourni dans `deploiement/legalnotary.service` :

```bash
# Adapter WorkingDirectory et User dans le fichier avant de l'installer.
sudo cp deploiement/legalnotary.service /etc/systemd/system/legalnotary.service
sudo systemctl daemon-reload
sudo systemctl enable --now legalnotary

# Vérifier :
sudo systemctl status legalnotary
sudo journalctl -u legalnotary -f
```

## HTTPS : nginx + Certbot (Let's Encrypt, gratuit)

Ne jamais exposer directement le port 4000 sur Internet sans HTTPS devant
— le jeton de connexion transiterait en clair. Un modèle de configuration
nginx est fourni dans `deploiement/nginx-legalnotary.conf`, avec les
étapes d'installation en commentaire en tête de fichier (installation de
nginx et Certbot, activation du site, puis `certbot --nginx` qui ajoute
le HTTPS et programme lui-même le renouvellement automatique du
certificat). nginx écoute sur les ports 80/443 et relaie vers le
processus Node en 127.0.0.1:4000, qui reste inaccessible directement de
l'extérieur.

## CORS

Puisque l'interface et l'API sont servies par le même processus (même
origine), aucune configuration CORS n'est nécessaire dans le cas standard
décrit ci-dessus. `ORIGINE_FRONTEND` (`.env`) ne sert que si un cabinet
choisit de servir l'interface séparément de l'API (hébergement statique à
part) — dans ce cas précis, la définir avec l'URL exacte du frontend pour
que l'API n'accepte pas de requêtes venant d'ailleurs.

## Sauvegardes

Un script prêt à l'emploi est fourni dans `deploiement/sauvegarder.sh` :
il fait un `pg_dump` compressé de la base, vers un dossier de sauvegardes
séparé (idéalement sur un disque ou un stockage différent du serveur
lui-même — une sauvegarde sur le même disque que la base ne protège pas
d'une panne de ce disque), et supprime automatiquement les sauvegardes de
plus de 30 jours. `deploiement/crontab.exemple` montre comment le
programmer pour qu'il tourne seul chaque nuit. Les dossiers ne sont
jamais supprimés physiquement dans l'application, mais cela ne protège
pas d'une panne matérielle du serveur — cette sauvegarde si.

**Non vérifié dans cet environnement de développement** (`pg_dump` n'y
est pas installé) : la logique du script (lecture de `DATABASE_URL`
depuis `.env`, nettoyage des sauvegardes anciennes) a été relue et
testée séparément, mais l'appel réel à `pg_dump` doit être vérifié une
fois sur le vrai serveur du cabinet avant de faire confiance à la tâche
planifiée.

## Migration vers un autre serveur

Comme le exige le cahier des charges initial du projet Legal Notary (portabilité,
pas de dépendance propriétaire) : changer d'hébergeur consiste à
`pg_dump`/`pg_restore` la base vers le nouveau serveur PostgreSQL, copier
le dossier `legal-notary-server/`, reconfigurer `.env`, relancer `npm start`.
Aucune réécriture de code n'est nécessaire.
