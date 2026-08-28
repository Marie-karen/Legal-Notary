/**
 * src/services/notifications.service.js — Notifications multi-canal.
 *
 * Un "événement" métier (ex. `projet_acte_soumis`) peut déclencher jusqu'à
 * 5 canaux en parallèle, chacun optionnel et configuré séparément par le
 * cabinet : email (SMTP du cabinet), SMS, WhatsApp (webhook générique
 * configuré par le cabinet — voir docs/NOTIFICATIONS.md), push navigateur
 * (Web Push standard, comme les notifications système de la plupart des
 * apps web — pas de compte tiers requis), et un fil "in_app" (liste
 * consultable dans l'application).
 *
 * Principe : `declencherEvenement()` lit les modèles de message actifs
 * pour l'événement (table `modeles_message`), résout le ou les
 * destinataires réels (un rôle comme "notaire" → tous les utilisateurs
 * ayant ce rôle), génère le texte à partir du modèle, enregistre une
 * ligne dans `notifications` (traçabilité + fil in-app), puis tente
 * l'envoi effectif pour les canaux externes (email/sms/whatsapp/push).
 * Un canal non configuré par le cabinet est marqué en échec avec un
 * message clair, jamais une exception qui bloquerait les autres canaux.
 */

const nodemailer = require("nodemailer");
const webPush = require("web-push");
const { pool } = require("../db/pool");
const { dechiffrer, dechiffrerObjet } = require("../utils/crypto");

// ---------------------------------------------------------------------
// Rendu de modèle : remplace {{placeholder}} par la valeur correspondante
// dans `donnees`. Pas de moteur de template externe — les modèles sont
// simples (voir seed dans la migration 002), un remplacement de chaîne
// suffit et reste entièrement lisible sans dépendance.
// ---------------------------------------------------------------------
function rendreModele(texte, donnees) {
  if (!texte) return texte;
  return texte.replace(/\{\{(\w+)\}\}/g, (correspondance, cle) => {
    return Object.prototype.hasOwnProperty.call(donnees, cle) ? String(donnees[cle]) : correspondance;
  });
}

// ---------------------------------------------------------------------
// Résolution du destinataire : un modèle vise un rôle ("notaire",
// "premier_clerc") ou le clerc assigné au dossier ("clerc_assigne").
// Renvoie la liste des utilisateurs (actifs) concernés.
// ---------------------------------------------------------------------
async function resoudreDestinataires(destinataire, dossier) {
  if (destinataire === "clerc_assigne") {
    if (!dossier || !dossier.clerc_assigne_id) return [];
    const { rows } = await pool.query(
      "SELECT * FROM utilisateurs WHERE id = $1 AND actif = true", [dossier.clerc_assigne_id]
    );
    return rows;
  }
  const { rows } = await pool.query(
    "SELECT * FROM utilisateurs WHERE role = $1 AND actif = true", [destinataire]
  );
  return rows;
}

function normaliserParametresLigne(ligne) {
  if (!ligne) return ligne;
  return {
    ...ligne,
    smtp_mot_de_passe: dechiffrer(ligne.smtp_mot_de_passe),
    push_cle_privee: dechiffrer(ligne.push_cle_privee),
    sms_identifiants: dechiffrerObjet(ligne.sms_identifiants),
    whatsapp_identifiants: dechiffrerObjet(ligne.whatsapp_identifiants),
  };
}

async function obtenirParametresNotifications() {
  const { rows } = await pool.query("SELECT * FROM parametres_notifications ORDER BY created_at ASC LIMIT 1");
  if (rows.length) return normaliserParametresLigne(rows[0]);
  const inseree = await pool.query("INSERT INTO parametres_notifications DEFAULT VALUES RETURNING *");
  return normaliserParametresLigne(inseree.rows[0]);
}

// ---------------------------------------------------------------------
// Envoi effectif par canal — chacune renvoie { succes: bool, erreur?: string }
// ---------------------------------------------------------------------
async function envoyerEmail(parametres, destinataireEmail, sujet, corps) {
  if (!parametres.smtp_hote || !destinataireEmail) {
    return { succes: false, erreur: "SMTP non configuré pour ce cabinet (voir Paramètres > Notifications)." };
  }
  try {
    const transporteur = nodemailer.createTransport({
      host: parametres.smtp_hote,
      port: parametres.smtp_port,
      secure: parametres.smtp_securise,
      auth: parametres.smtp_utilisateur ? { user: parametres.smtp_utilisateur, pass: parametres.smtp_mot_de_passe } : undefined,
    });
    await transporteur.sendMail({
      from: `"${parametres.smtp_expediteur_nom}" <${parametres.smtp_expediteur_email}>`,
      to: destinataireEmail,
      subject: sujet || "Legal Notary",
      text: corps,
    });
    return { succes: true };
  } catch (erreur) {
    return { succes: false, erreur: erreur.message };
  }
}

// Adaptateur générique : la plupart des passerelles SMS/WhatsApp
// acceptent une requête HTTP POST simple. Le cabinet configure l'URL et
// les identifiants de SON fournisseur (voir migration 002,
// parametres_notifications.sms_identifiants) — aucun fournisseur n'est
// imposé par le logiciel.
async function envoyerViaWebhookGenerique(urlWebhook, identifiants, destinataireTelephone, corps) {
  if (!urlWebhook || !destinataireTelephone) {
    return { succes: false, erreur: "Fournisseur non configuré pour ce cabinet (voir Paramètres > Notifications)." };
  }
  try {
    const reponse = await fetch(urlWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...identifiants, to: destinataireTelephone, message: corps }),
    });
    if (!reponse.ok) {
      return { succes: false, erreur: `Le fournisseur a répondu ${reponse.status}` };
    }
    return { succes: true };
  } catch (erreur) {
    return { succes: false, erreur: erreur.message };
  }
}

async function envoyerPush(parametres, utilisateurId, titre, corps) {
  if (!parametres.push_cle_publique || !parametres.push_cle_privee) {
    return { succes: false, erreur: "Notifications push non configurées pour ce cabinet." };
  }
  const { rows: abonnements } = await pool.query(
    "SELECT * FROM push_subscriptions WHERE utilisateur_id = $1", [utilisateurId]
  );
  if (!abonnements.length) {
    return { succes: false, erreur: "Aucun appareil abonné aux notifications pour cet utilisateur." };
  }
  webPush.setVapidDetails(
    `mailto:${parametres.push_contact_email || "contact@example.com"}`,
    parametres.push_cle_publique,
    parametres.push_cle_privee
  );
  const charge = JSON.stringify({ titre, corps });
  let auMoinsUnSucces = false;
  const erreurs = [];
  for (const abonnement of abonnements) {
    try {
      await webPush.sendNotification(
        { endpoint: abonnement.endpoint, keys: { p256dh: abonnement.cle_p256dh, auth: abonnement.cle_auth } },
        charge
      );
      auMoinsUnSucces = true;
    } catch (erreur) {
      erreurs.push(erreur.message);
      // Abonnement expiré/invalide (410 Gone) : on le retire pour ne pas réessayer indéfiniment.
      if (erreur.statusCode === 404 || erreur.statusCode === 410) {
        await pool.query("DELETE FROM push_subscriptions WHERE id = $1", [abonnement.id]);
      }
    }
  }
  return auMoinsUnSucces ? { succes: true } : { succes: false, erreur: erreurs.join("; ") };
}

/**
 * Déclenche un événement métier : notifie tous les destinataires
 * concernés, sur tous les canaux configurés et actifs pour cet
 * événement. Ne lève jamais d'exception pour un canal en échec — chaque
 * tentative est journalisée individuellement dans `notifications`.
 *
 * @param {string} evenement - ex. 'projet_acte_soumis'
 * @param {object} options
 * @param {string} [options.dossierId]
 * @param {object} [options.donnees] - valeurs pour les {{placeholders}} des modèles
 */
async function declencherEvenement(evenement, { dossierId, donnees = {} } = {}) {
  let dossier = null;
  if (dossierId) {
    const { rows } = await pool.query("SELECT * FROM dossiers WHERE id = $1", [dossierId]);
    dossier = rows[0] || null;
  }

  const { rows: modeles } = await pool.query(
    "SELECT * FROM modeles_message WHERE evenement = $1 AND actif = true", [evenement]
  );
  if (!modeles.length) return [];

  const parametresNotif = await obtenirParametresNotifications();
  const resultats = [];

  for (const modele of modeles) {
    const destinataires = await resoudreDestinataires(modele.destinataire, dossier);
    for (const utilisateur of destinataires) {
      const titre = rendreModele(modele.sujet, donnees);
      const corps = rendreModele(modele.corps, donnees);

      const { rows: notifRows } = await pool.query(
        `INSERT INTO notifications (utilisateur_id, dossier_id, evenement, canal, titre, corps, statut_envoi)
         VALUES ($1, $2, $3, $4, $5, $6, 'en_attente') RETURNING *`,
        [utilisateur.id, dossierId || null, evenement, modele.canal, titre, corps]
      );
      const notification = notifRows[0];

      let resultatEnvoi;
      switch (modele.canal) {
        case "in_app":
          resultatEnvoi = { succes: true }; // le fil in-app EST le stockage, rien de plus à envoyer
          break;
        case "email":
          resultatEnvoi = await envoyerEmail(parametresNotif, utilisateur.email, titre, corps);
          break;
        case "sms":
          resultatEnvoi = parametresNotif.sms_actif
            ? await envoyerViaWebhookGenerique(parametresNotif.sms_url_webhook, parametresNotif.sms_identifiants, utilisateur.telephone, corps)
            : { succes: false, erreur: "SMS désactivé pour ce cabinet." };
          break;
        case "whatsapp":
          resultatEnvoi = parametresNotif.whatsapp_actif
            ? await envoyerViaWebhookGenerique(parametresNotif.whatsapp_url_webhook, parametresNotif.whatsapp_identifiants, utilisateur.telephone, corps)
            : { succes: false, erreur: "WhatsApp désactivé pour ce cabinet." };
          break;
        case "push":
          resultatEnvoi = await envoyerPush(parametresNotif, utilisateur.id, titre, corps);
          break;
        default:
          resultatEnvoi = { succes: false, erreur: `Canal inconnu : ${modele.canal}` };
      }

      await pool.query(
        "UPDATE notifications SET statut_envoi = $1, erreur = $2, envoye_le = $3 WHERE id = $4",
        [resultatEnvoi.succes ? "envoye" : "echec", resultatEnvoi.erreur || null, resultatEnvoi.succes ? new Date() : null, notification.id]
      );
      resultats.push({ utilisateurId: utilisateur.id, canal: modele.canal, ...resultatEnvoi });
    }
  }

  return resultats;
}

async function listerNotificationsUtilisateur(utilisateurId, { nonLuesSeulement = false } = {}) {
  const conditions = ["utilisateur_id = $1", "canal = 'in_app'"];
  if (nonLuesSeulement) conditions.push("lu = false");
  const { rows } = await pool.query(
    `SELECT * FROM notifications WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT 100`,
    [utilisateurId]
  );
  return rows;
}

async function marquerLue(notificationId, utilisateurId) {
  await pool.query(
    "UPDATE notifications SET lu = true WHERE id = $1 AND utilisateur_id = $2",
    [notificationId, utilisateurId]
  );
}

async function enregistrerAbonnementPush(utilisateurId, abonnement) {
  await pool.query(
    `INSERT INTO push_subscriptions (utilisateur_id, endpoint, cle_p256dh, cle_auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET utilisateur_id = EXCLUDED.utilisateur_id`,
    [utilisateurId, abonnement.endpoint, abonnement.keys.p256dh, abonnement.keys.auth]
  );
}

module.exports = {
  rendreModele,
  resoudreDestinataires,
  obtenirParametresNotifications,
  declencherEvenement,
  listerNotificationsUtilisateur,
  marquerLue,
  enregistrerAbonnementPush,
};
