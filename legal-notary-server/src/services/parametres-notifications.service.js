/**
 * src/services/parametres-notifications.service.js — Réglages des canaux
 * de notification (SMTP, SMS, WhatsApp, push) et modèles de message.
 *
 * Voir migration 002 pour le schéma et l'avertissement de sécurité sur le
 * stockage en clair des identifiants — accès à cette lecture/écriture
 * strictement réservé à `parametres:gerer` (notaire), voir les routes.
 */

const { pool } = require("../db/pool");
const notificationsService = require("./notifications.service");
const { chiffrer, dechiffrer, chiffrerObjet, dechiffrerObjet } = require("../utils/crypto");

function versCamel(l) {
  const smsObj = dechiffrerObjet(l.sms_identifiants);
  const waObj = dechiffrerObjet(l.whatsapp_identifiants);
  const motDePasseClair = dechiffrer(l.smtp_mot_de_passe);
  const pushPriveeClair = dechiffrer(l.push_cle_privee);

  return {
    id: l.id,
    smtpHote: l.smtp_hote,
    smtpPort: l.smtp_port,
    smtpSecurise: l.smtp_securise,
    smtpUtilisateur: l.smtp_utilisateur,
    // Le mot de passe n'est jamais renvoyé tel quel par l'API (voir routes) —
    // seulement un booléen `smtpMotDePasseDefini` pour que l'écran sache
    // s'il faut afficher "déjà configuré" sans jamais exposer la valeur.
    smtpMotDePasseDefini: !!motDePasseClair,
    smtpExpediteurNom: l.smtp_expediteur_nom,
    smtpExpediteurEmail: l.smtp_expediteur_email,
    smsActif: l.sms_actif,
    smsUrlWebhook: l.sms_url_webhook,
    smsIdentifiantsDefinis: Object.keys(smsObj || {}).length > 0,
    whatsappActif: l.whatsapp_actif,
    whatsappUrlWebhook: l.whatsapp_url_webhook,
    whatsappIdentifiantsDefinis: Object.keys(waObj || {}).length > 0,
    pushActif: l.push_actif,
    pushCleDefinie: !!(l.push_cle_publique && pushPriveeClair),
    pushClePublique: l.push_cle_publique || "",
    pushContactEmail: l.push_contact_email,
  };
}

async function obtenir() {
  const l = await notificationsService.obtenirParametresNotifications();
  return versCamel(l);
}

/**
 * Mise à jour partielle. Les champs sensibles (mots de passe,
 * identifiants) ne sont écrasés QUE si une nouvelle valeur non vide est
 * fournie — permet à l'écran de renvoyer le formulaire sans redemander le
 * mot de passe SMTP à chaque modification d'un autre champ.
 * Tous les identifiants sensibles sont chiffrés au repos en AES-256-GCM.
 */
async function mettreAJour(champs) {
  const actuelBrut = await notificationsService.obtenirParametresNotifications();

  const motDePasseAEnregistrer = champs.smtpMotDePasse
    ? chiffrer(champs.smtpMotDePasse)
    : actuelBrut.smtp_mot_de_passe;

  const pushPriveeAEnregistrer = champs.pushClePrivee
    ? chiffrer(champs.pushClePrivee)
    : actuelBrut.push_cle_privee;

  const smsIdentifiantsAEnregistrer = champs.smsIdentifiants
    ? chiffrerObjet(champs.smsIdentifiants)
    : actuelBrut.sms_identifiants;

  const whatsappIdentifiantsAEnregistrer = champs.whatsappIdentifiants
    ? chiffrerObjet(champs.whatsappIdentifiants)
    : actuelBrut.whatsapp_identifiants;

  const valeurs = {
    smtp_hote: champs.smtpHote ?? actuelBrut.smtp_hote,
    smtp_port: champs.smtpPort ?? actuelBrut.smtp_port,
    smtp_securise: champs.smtpSecurise ?? actuelBrut.smtp_securise,
    smtp_utilisateur: champs.smtpUtilisateur ?? actuelBrut.smtp_utilisateur,
    smtp_mot_de_passe: motDePasseAEnregistrer,
    smtp_expediteur_nom: champs.smtpExpediteurNom ?? actuelBrut.smtp_expediteur_nom,
    smtp_expediteur_email: champs.smtpExpediteurEmail ?? actuelBrut.smtp_expediteur_email,
    sms_actif: champs.smsActif ?? actuelBrut.sms_actif,
    sms_url_webhook: champs.smsUrlWebhook ?? actuelBrut.sms_url_webhook,
    sms_identifiants: smsIdentifiantsAEnregistrer,
    whatsapp_actif: champs.whatsappActif ?? actuelBrut.whatsapp_actif,
    whatsapp_url_webhook: champs.whatsappUrlWebhook ?? actuelBrut.whatsapp_url_webhook,
    whatsapp_identifiants: whatsappIdentifiantsAEnregistrer,
    push_actif: champs.pushActif ?? actuelBrut.push_actif,
    push_cle_publique: champs.pushClePublique ?? actuelBrut.push_cle_publique,
    push_cle_privee: pushPriveeAEnregistrer,
    push_contact_email: champs.pushContactEmail ?? actuelBrut.push_contact_email,
  };

  const { rows } = await pool.query(
    `UPDATE parametres_notifications SET
       smtp_hote = $1, smtp_port = $2, smtp_securise = $3, smtp_utilisateur = $4, smtp_mot_de_passe = $5,
       smtp_expediteur_nom = $6, smtp_expediteur_email = $7,
       sms_actif = $8, sms_url_webhook = $9, sms_identifiants = $10,
       whatsapp_actif = $11, whatsapp_url_webhook = $12, whatsapp_identifiants = $13,
       push_actif = $14, push_cle_publique = $15, push_cle_privee = $16, push_contact_email = $17,
       updated_at = now()
     WHERE id = $18 RETURNING *`,
    [
      valeurs.smtp_hote, valeurs.smtp_port, valeurs.smtp_securise, valeurs.smtp_utilisateur, valeurs.smtp_mot_de_passe,
      valeurs.smtp_expediteur_nom, valeurs.smtp_expediteur_email,
      valeurs.sms_actif, valeurs.sms_url_webhook, valeurs.sms_identifiants,
      valeurs.whatsapp_actif, valeurs.whatsapp_url_webhook, valeurs.whatsapp_identifiants,
      valeurs.push_actif, valeurs.push_cle_publique, valeurs.push_cle_privee, valeurs.push_contact_email,
      actuelBrut.id,
    ]
  );
  return versCamel(rows[0]);
}

function modeleVersCamel(l) {
  return {
    id: l.id,
    evenement: l.evenement,
    canal: l.canal,
    destinataire: l.destinataire,
    sujet: l.sujet,
    corps: l.corps,
    actif: l.actif,
  };
}

async function listerModeles() {
  const { rows } = await pool.query("SELECT * FROM modeles_message ORDER BY evenement, canal");
  return rows.map(modeleVersCamel);
}

async function modifierModele(id, { sujet, corps, actif }) {
  const { rows } = await pool.query(
    `UPDATE modeles_message SET
       sujet = COALESCE($1, sujet), corps = COALESCE($2, corps), actif = COALESCE($3, actif)
     WHERE id = $4 RETURNING *`,
    [sujet, corps, actif, id]
  );
  return rows.length ? modeleVersCamel(rows[0]) : null;
}

module.exports = { obtenir, mettreAJour, listerModeles, modifierModele };
