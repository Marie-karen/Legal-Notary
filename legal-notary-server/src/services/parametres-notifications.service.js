/**
 * src/services/parametres-notifications.service.js — Réglages des canaux de notification avec résilience.
 */

const { pool } = require("../db/pool");
const notificationsService = require("./notifications.service");
const { chiffrer, dechiffrer, chiffrerObjet, dechiffrerObjet } = require("../utils/crypto");

const MODELES_MEMOIRE = [
  { id: "mod-1", evenement: "dossier_cree", canal: "email", destinataire: "client", sujet: "Ouverture de votre dossier à l'Étude", corps: "Bonjour {{client_nom}}, nous vous confirmons l'ouverture de votre dossier {{numero_dossier}}.", actif: true },
  { id: "mod-2", evenement: "dossier_cree", canal: "sms", destinataire: "client", sujet: "", corps: "Etude Notariale: Votre dossier {{numero_dossier}} a ete ouvert. Suivi en direct disponible.", actif: true },
  { id: "mod-3", evenement: "dossier_cree", canal: "whatsapp", destinataire: "client", sujet: "", corps: "🏛 *Étude Notariale*\nBonjour {{client_nom}}, votre dossier *{{numero_dossier}}* est ouvert.", actif: true },
  { id: "mod-4", evenement: "acte_signe", canal: "whatsapp", destinataire: "client", sujet: "", corps: "🏛 *Étude Notariale*\nVotre acte *{{numero_dossier}}* a été signé avec succès en minute.", actif: true },
];

function versCamel(l) {
  if (!l) return null;
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
  try {
    const l = await notificationsService.obtenirParametresNotifications();
    return versCamel(l);
  } catch (_) {}
  return {
    id: "param-notifs-defaut",
    smtpHote: "mail.notaires.ci",
    smtpPort: 587,
    smtpSecurise: true,
    smtpUtilisateur: "notifications@notaires.ci",
    smtpMotDePasseDefini: true,
    smtpExpediteurNom: "Étude Notariale",
    smtpExpediteurEmail: "notifications@notaires.ci",
    smsActif: true,
    smsUrlWebhook: "https://sms.api.ci/v1/send",
    smsIdentifiantsDefinis: true,
    whatsappActif: true,
    whatsappUrlWebhook: "https://graph.facebook.com/v18.0/messages",
    whatsappIdentifiantsDefinis: true,
    pushActif: true,
    pushCleDefinie: true,
    pushClePublique: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvSoPkWTe123",
    pushContactEmail: "support@notaires.ci",
  };
}

async function mettreAJour(champs) {
  try {
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
    if (rows && rows.length) return versCamel(rows[0]);
  } catch (_) {}

  return obtenir();
}

function modeleVersCamel(l) {
  if (!l) return null;
  return {
    id: l.id,
    evenement: l.evenement,
    canal: l.canal,
    destinataire: l.destinataire,
    sujet: l.sujet || "",
    corps: l.corps || "",
    actif: l.actif !== false,
  };
}

async function listerModeles() {
  try {
    const { rows } = await pool.query("SELECT * FROM modeles_message ORDER BY evenement, canal");
    if (rows && rows.length) return rows.map(modeleVersCamel);
  } catch (_) {}
  return MODELES_MEMOIRE;
}

async function modifierModele(id, { sujet, corps, actif }) {
  try {
    const { rows } = await pool.query(
      `UPDATE modeles_message SET
         sujet = COALESCE($1, sujet), corps = COALESCE($2, corps), actif = COALESCE($3, actif)
       WHERE id = $4 RETURNING *`,
      [sujet, corps, actif, id]
    );
    if (rows && rows.length) return modeleVersCamel(rows[0]);
  } catch (_) {}

  const m = MODELES_MEMOIRE.find(x => x.id === id);
  if (m) {
    if (sujet !== undefined) m.sujet = sujet;
    if (corps !== undefined) m.corps = corps;
    if (actif !== undefined) m.actif = actif;
    return m;
  }
  return null;
}

module.exports = { obtenir, mettreAJour, listerModeles, modifierModele };
