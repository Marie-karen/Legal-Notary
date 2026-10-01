/**
 * src/services/email-deploiement.service.js — Envoi et gestion des emails d'identifiants lors du déploiement d'une étude
 */

const nodemailer = require("nodemailer");
const { pool } = require("../db/pool");
const { dechiffrer } = require("../utils/crypto");
const { lireFichierJson, ecrireFichierJson } = require("./stockage-persistant.service");

const ROLE_LABELS = {
  notaire: "Notaire Titulaire",
  premier_clerc: "Premier Clerc",
  clerc_redacteur: "Clerc Rédacteur",
  clerc_formaliste: "Clerc aux Formalités",
  comptable_taxateur: "Comptable Taxateur",
  assistante: "Assistante d'Accueil",
  archiviste: "Archiviste / Minutier",
  superadmin: "Super Administrateur SaaS",
  dev: "Ingénieur DevOps / Développeur",
  commercial: "Commercial & Onboarding",
  support: "Support Client & Assistance",
};

async function obtenirTransporteurSMTP() {
  // 1. Vérifier les variables d'environnement globales (.env)
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    return {
      transporteur: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: port,
        secure: secure,
        auth: process.env.SMTP_USER ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        } : undefined,
      }),
      fromNom: process.env.SMTP_FROM_NAME || "Legal Notary SaaS",
      fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "notifications@legalnotary.app",
    };
  }

  // 2. Vérifier la configuration en base de données (table parametres_notifications)
  try {
    const { rows } = await pool.query(
      "SELECT * FROM parametres_notifications WHERE smtp_hote IS NOT NULL AND smtp_hote != '' ORDER BY created_at ASC LIMIT 1"
    );
    if (rows && rows.length > 0) {
      const p = rows[0];
      const mdp = dechiffrer(p.smtp_mot_de_passe) || p.smtp_mot_de_passe;
      return {
        transporteur: nodemailer.createTransport({
          host: p.smtp_hote,
          port: p.smtp_port || 587,
          secure: !!p.smtp_securise,
          auth: p.smtp_utilisateur ? { user: p.smtp_utilisateur, pass: mdp } : undefined,
        }),
        fromNom: p.smtp_expediteur_nom || "Legal Notary Notifications",
        fromEmail: p.smtp_expediteur_email || "notifications@notaires.ci",
      };
    }
  } catch (_) {}

  return null;
}

function genererTemplateEmail({ nomComplet, email, motDePasse, role, nomEtude, urlConnexion }) {
  const roleAffiche = ROLE_LABELS[role] || role || "Collaborateur";
  const etudeAffichee = nomEtude || "Office Notarial";
  const lienConnexion = urlConnexion || "https://legalnotary.app";

  const sujet = `Vos accès à l'espace notarial — ${etudeAffichee}`;

  const texte = `Bonjour ${nomComplet},

Un compte d'accès vous a été créé sur la plateforme notariale sécurisée pour l'office : ${etudeAffichee}.

Vos identifiants de connexion :
• Rôle / Fonction : ${roleAffiche}
• Identifiant (Email) : ${email}
• Mot de passe initial : ${motDePasse}
• Lien de connexion : ${lienConnexion}

Pour des raisons de confidentialité et de secret professionnel notarial, nous vous recommandons de modifier votre mot de passe dès votre première connexion.

Plateforme Notariale Conforme OHADA & Décret 2013-279
Support Technique : support@editeur-legal.ci`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sujet}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#0f172a;color:#f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:30px 15px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;box-shadow:0 10px 25px rgba(0,0,0,0.4);">
          
          <!-- En-tête avec logo / titre -->
          <tr>
            <td style="padding:32px 32px 24px 32px;background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%);border-bottom:1px solid #334155;text-align:center;">
              <div style="display:inline-block;padding:8px 16px;background:rgba(217,119,6,0.15);border:1px solid rgba(217,119,6,0.3);border-radius:20px;color:#f59e0b;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:12px;">
                ⚖️ Legal Notary — Espace Notarial Sécurisé
              </div>
              <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.5px;">
                ${etudeAffichee}
              </h1>
            </td>
          </tr>

          <!-- Corps du message -->
          <tr>
            <td style="padding:32px 32px 24px 32px;">
              <p style="font-size:16px;line-height:24px;color:#f8fafc;margin:0 0 16px 0;">
                Bonjour <strong style="color:#38bdf8;">${nomComplet}</strong>,
              </p>
              <p style="font-size:14px;line-height:22px;color:#94a3b8;margin:0 0 24px 0;">
                Un compte utilisateur vous a été attribué pour accéder à l'espace de gestion et de rédaction des actes de l'étude <strong>${etudeAffichee}</strong>.
              </p>

              <!-- Carte des identifiants -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0f172a;border-radius:8px;border:1px solid #334155;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px;">
                    <div style="font-size:12px;text-transform:uppercase;font-weight:700;color:#f59e0b;margin-bottom:12px;letter-spacing:0.5px;">
                      Vos Paramètres d'Accès Sécurisé
                    </div>

                    <table width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size:13.5px;">
                      <tr>
                        <td width="35%" style="color:#94a3b8;">Rôle & Accès :</td>
                        <td style="color:#ffffff;font-weight:600;"><span style="display:inline-block;padding:2px 8px;background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.3);border-radius:4px;color:#38bdf8;">${roleAffiche}</span></td>
                      </tr>
                      <tr>
                        <td style="color:#94a3b8;">Email de connexion :</td>
                        <td style="color:#ffffff;font-weight:600;word-break:break-all;">${email}</td>
                      </tr>
                      <tr>
                        <td style="color:#94a3b8;">Mot de passe temporaire :</td>
                        <td style="color:#10b981;font-weight:700;font-family:monospace;font-size:15px;letter-spacing:0.5px;">${motDePasse}</td>
                      </tr>
                      <tr>
                        <td style="color:#94a3b8;">Adresse web :</td>
                        <td><a href="${lienConnexion}" target="_blank" style="color:#38bdf8;text-decoration:none;">${lienConnexion}</a></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Bouton d'action -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${lienConnexion}" target="_blank" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg, #d97706 0%, #b45309 100%);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:6px;box-shadow:0 4px 12px rgba(217,119,6,0.3);">
                      🚀 Se Connecter à mon Espace Étude
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Avertissement de sécurité -->
              <div style="background:rgba(59,130,246,0.08);border-left:3px solid #38bdf8;padding:12px 16px;border-radius:4px;font-size:12.5px;color:#94a3b8;line-height:18px;">
                🔒 <strong style="color:#f8fafc;">Sécurité & Confidentialité :</strong> Conformément aux règles déontologiques et au secret professionnel notarial, nous vous conseillons de changer votre mot de passe dès votre première ouverture de session.
              </div>
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="padding:20px 32px;background-color:#0f172a;border-top:1px solid #334155;text-align:center;font-size:11.5px;color:#64748b;line-height:18px;">
              Système de Gestion Intégrée d'Office Notarial — Conforme OHADA & Décret 2013-279.<br>
              Besoin d'aide ? Contactez votre administrateur d'office ou l'assistance à <a href="mailto:support@editeur-legal.ci" style="color:#38bdf8;text-decoration:none;">support@editeur-legal.ci</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { sujet, texte, html, roleAffiche };
}

async function envoyerEmailBienvenueCollaborateur({
  destinataireEmail,
  nomComplet,
  role,
  motDePasse,
  nomEtude,
  domaine,
  urlConnexion,
}) {
  const emailNorm = (destinataireEmail || "").toLowerCase().trim();
  if (!emailNorm) return { succes: false, erreur: "Email destinataire manquant" };

  const urlFinale = urlConnexion || (domaine ? (domaine.startsWith("http") ? domaine : `https://${domaine}`) : "https://legalnotary.app");
  const { sujet, texte, html, roleAffiche } = genererTemplateEmail({
    nomComplet: nomComplet || emailNorm.split("@")[0],
    email: emailNorm,
    motDePasse: motDePasse || "notaire123",
    role: role || "clerc_redacteur",
    nomEtude: nomEtude || "Office Notarial",
    urlConnexion: urlFinale,
  });

  let statutEnvoi = {
    succes: false,
    mode: "journalise",
    destinataire: emailNorm,
    nomComplet: nomComplet || emailNorm,
    role: roleAffiche,
    sujet,
    motDePasse,
    urlConnexion: urlFinale,
    dateEnvoi: new Date().toISOString(),
    erreur: null,
  };

  try {
    const configSmtp = await obtenirTransporteurSMTP();
    if (configSmtp && configSmtp.transporteur) {
      await configSmtp.transporteur.sendMail({
        from: `"${configSmtp.fromNom}" <${configSmtp.fromEmail}>`,
        to: emailNorm,
        subject: sujet,
        text: texte,
        html: html,
      });
      statutEnvoi.succes = true;
      statutEnvoi.mode = "smtp_reel";
      console.log(`[EmailDéploiement] ✅ Email d'identifiants envoyé via SMTP à : ${emailNorm}`);
    } else {
      statutEnvoi.succes = true;
      statutEnvoi.mode = "journal_local_pret";
      statutEnvoi.erreur = "SMTP en attente de configuration — message consigné et prêt à l'envoi";
      console.log(`[EmailDéploiement] ℹ️ Message préparé pour ${emailNorm} (${roleAffiche}) — Lien: ${urlFinale}`);
    }
  } catch (errSmtp) {
    statutEnvoi.succes = false;
    statutEnvoi.erreur = errSmtp.message;
    console.warn(`[EmailDéploiement] ⚠️ Erreur SMTP pour ${emailNorm} :`, errSmtp.message);
  }

  // Journalisation sur disque JSON
  try {
    const journalActuel = lireFichierJson("emails_envoyes.json", []);
    const journalMaj = Array.isArray(journalActuel) ? journalActuel : [];
    journalMaj.unshift(statutEnvoi);
    if (journalMaj.length > 200) journalMaj.length = 200; // Garder les 200 derniers emails
    ecrireFichierJson("emails_envoyes.json", journalMaj);
  } catch (e) {
    console.warn("[EmailDéploiement] Erreur sauvegarde journal emails :", e.message);
  }

  return {
    ...statutEnvoi,
    apercuTexte: texte,
    apercuHtml: html,
  };
}

function listerEmailsEnvoyes(limite = 50) {
  const journal = lireFichierJson("emails_envoyes.json", []);
  return Array.isArray(journal) ? journal.slice(0, limite) : [];
}

module.exports = {
  envoyerEmailBienvenueCollaborateur,
  genererTemplateEmail,
  listerEmailsEnvoyes,
  ROLE_LABELS,
};
