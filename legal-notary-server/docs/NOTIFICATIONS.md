# Notifications multi-canal

Demande du 2026-08-25 : les notifications doivent arriver par email, SMS,
WhatsApp, en notification "à l'écran" comme une app native (Web Push), et
dans un fil consultable en direct dans l'application.

## Principe

Un **événement métier** (ex. `projet_acte_soumis`) peut déclencher jusqu'à
5 **canaux**, chacun indépendant :

| Canal | Mécanisme | Compte tiers requis ? |
|---|---|---|
| `in_app` | Ligne stockée dans `notifications`, lue via `GET /api/notifications` | Non |
| `email` | SMTP du cabinet (`parametres_notifications`), via `nodemailer` | Non — le cabinet utilise son propre serveur mail |
| `push` | Web Push standard (`web-push`, clés VAPID) — même mécanisme que les notifications système de la plupart des apps web (Claude compris) | Non — protocole ouvert, gratuit |
| `sms` | Requête HTTP POST générique vers le fournisseur choisi par le cabinet | Oui — au choix du cabinet |
| `whatsapp` | Idem, vers l'API WhatsApp Business ou un fournisseur tiers | Oui — au choix du cabinet |

Chaque combinaison (événement, canal) a son propre **modèle de message**
(table `modeles_message`, éditable sans toucher au code — voir migration
002) : le SMS d'un événement est court, l'email est détaillé, avec un
destinataire résolu dynamiquement (`notaire`, `clerc_assigne`, `premier_clerc`...).

Un canal non configuré par le cabinet échoue proprement (ligne
`notifications.statut_envoi = 'echec'` avec un message clair) — il ne
bloque jamais les autres canaux ni l'action métier elle-même (le clerc
peut soumettre un projet d'acte même si le SMTP du cabinet n'est pas
encore configuré, il n'y aura simplement pas d'email envoyé, l'in-app
suffit toujours).

## Configuration par le cabinet

Tout se règle depuis `PUT /api/parametres-notifications` (notaire
uniquement, voir RBAC.md) :
- SMTP : hôte, port, utilisateur, mot de passe, expéditeur.
- SMS/WhatsApp : URL du webhook du fournisseur choisi + identifiants
  (objet libre, propre au fournisseur — voir ci-dessous).
- Push : clés VAPID (voir génération ci-dessous).

### SMS / WhatsApp — adaptateur générique

Le logiciel n'impose aucun fournisseur. `envoyerViaWebhookGenerique()`
(voir `src/services/notifications.service.js`) envoie une requête HTTP
POST simple :

```
POST <sms_url_webhook ou whatsapp_url_webhook>
Content-Type: application/json

{ ...sms_identifiants (ou whatsapp_identifiants), "to": "<téléphone>", "message": "<texte>" }
```

La plupart des passerelles SMS/WhatsApp africaines et internationales
acceptent ce format ou un format très proche — si le fournisseur du
cabinet a une API différente, un développeur ajoute un adaptateur
spécifique dans `notifications.service.js` en suivant le même modèle
(`{ succes, erreur }` en retour), sans toucher au reste du système.

### Web Push — génération des clés VAPID

Une seule fois par installation (le protocole l'exige) :

```bash
npx web-push generate-vapid-keys
```

Renseigner la clé publique et la clé privée obtenues dans
`push_cle_publique` / `push_cle_privee` (via l'écran Paramètres), et un
email de contact dans `push_contact_email`. Le frontend (Claude Design)
utilise la clé publique pour demander l'autorisation au navigateur, puis
envoie l'abonnement obtenu à `POST /api/notifications/push/abonnement`.

## Sécurité — à savoir avant mise en production

Les identifiants SMTP/SMS/WhatsApp sont stockés **en clair** dans
`parametres_notifications` dans cette version (voir le commentaire de
sécurité dans la migration 002). Seule la permission `parametres:gerer`
(notaire) permet de les lire ou modifier via l'API. Un chiffrement au
repos de ces colonnes (ex. via une clé applicative séparée de la base) est
une amélioration recommandée avant un déploiement à grande échelle — non
faite dans cette version, voir NOTES_HYPOTHESES.md.

## Événements actuellement câblés

- `projet_acte_soumis` — le clerc soumet un projet d'acte (voir
  `src/services/projets-acte.service.js`).
- `projet_acte_a_corriger` — le notaire renvoie pour correction.
- `projet_acte_valide` — le notaire valide.

D'autres événements (alertes d'échéance, de stagnation) ont des modèles
`in_app` de départ dans la migration 002 mais ne sont pas encore
déclenchés automatiquement par `alertes.service.js` — à faire si le
cabinet veut ces alertes poussées en notification plutôt que consultées
seulement sur le tableau de bord.
