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
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
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
  if (!motDePasse || typeof motDePasse !== "string" || !motDePasse.trim()) {
    return { succes: false, erreur: "Mot de passe obligatoire." };
  }

  const urlFinale =
    urlConnexion ||
    (domaine ? (domaine.startsWith("http") ? domaine : `https://${domaine}`) : "https://legalnotary.app");
  const { sujet, texte, html, roleAffiche } = genererTemplateEmail({
    nomComplet: nomComplet || emailNorm.split("@")[0],
    email: emailNorm,
    motDePasse: motDePasse.trim(),
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

function genererTemplateAssignation({
  nomClerc,
  nomInitiateur,
  roleInitiateur,
  numeroDossier,
  typeActe,
  comparantsNoms,
  urlConnexion,
  nomEtude,
}) {
  const etudeAffichee = nomEtude || "Office Notarial";
  const lienConnexion = urlConnexion || "https://legalnotary.app";
  const sujet = `⚖️ Assignation du dossier ${numeroDossier} — ${etudeAffichee}`;

  const texte = `Bonjour ${nomClerc},

Le dossier suivant vous a été assigné pour instruction :
• Numéro de dossier : ${numeroDossier}
• Nature de l'acte : ${typeActe}
• Client(s) / Comparant(s) : ${comparantsNoms || "À renseigner"}
• Assigné par : ${nomInitiateur || "Le Notaire"} (${roleInitiateur || "Direction"})
• Office : ${etudeAffichee}

Accéder directement au dossier : ${lienConnexion}

Legal Notary — Système de Gestion Intégrée d'Office Notarial`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${sujet}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#0f172a;color:#f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:30px 15px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
          <tr>
            <td style="padding:28px;background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%);border-bottom:1px solid #334155;text-align:center;">
              <div style="display:inline-block;padding:6px 14px;background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.3);border-radius:20px;color:#38bdf8;font-size:12px;font-weight:700;text-transform:uppercase;margin-bottom:8px;">
                ⚖️ Notification d'Assignation de Dossier
              </div>
              <h1 style="margin:0;font-size:20px;color:#ffffff;font-weight:700;">${etudeAffichee}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="font-size:15px;line-height:22px;color:#f8fafc;margin:0 0 16px 0;">
                Bonjour <strong style="color:#38bdf8;">${nomClerc}</strong>,
              </p>
              <p style="font-size:14px;line-height:22px;color:#94a3b8;margin:0 0 20px 0;">
                Un nouveau dossier vous a été assigné pour instruction juridique par <strong>${nomInitiateur || "le Notaire"}</strong> (${roleInitiateur || "Office"}).
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="10" style="background-color:#0f172a;border-radius:8px;border:1px solid #334155;margin-bottom:24px;font-size:13.5px;">
                <tr>
                  <td width="38%" style="color:#94a3b8;border-bottom:1px solid #1e293b;">N° Dossier :</td>
                  <td style="color:#f59e0b;font-weight:700;border-bottom:1px solid #1e293b;">${numeroDossier}</td>
                </tr>
                <tr>
                  <td style="color:#94a3b8;border-bottom:1px solid #1e293b;">Nature de l'acte :</td>
                  <td style="color:#ffffff;font-weight:600;border-bottom:1px solid #1e293b;">${typeActe}</td>
                </tr>
                <tr>
                  <td style="color:#94a3b8;border-bottom:1px solid #1e293b;">Comparant(s) :</td>
                  <td style="color:#ffffff;border-bottom:1px solid #1e293b;">${comparantsNoms || "Comparant principal"}</td>
                </tr>
                <tr>
                  <td style="color:#94a3b8;">Assigné par :</td>
                  <td style="color:#38bdf8;">${nomInitiateur || "Le Notaire"}</td>
                </tr>
              </table>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${lienConnexion}" target="_blank" style="display:inline-block;padding:12px 26px;background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:6px;">
                      📂 Ouvrir & Traiter le Dossier
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { sujet, texte, html };
}

function genererTemplateRecuClient({
  clientNom,
  numeroRecu,
  numeroDossier,
  typeActe,
  montantTotal,
  fraisOuverture,
  provision,
  modePaiement,
  datePaiement,
  nomNotaire,
  nomEtude,
  adresseEtude,
  telephoneEtude,
  emailEtude,
}) {
  const etudeAffichee = nomEtude || "Office Notarial";
  const notaireAffiche = nomNotaire || "Maître Notaire";
  const sujet = `Reçu de Paiement & Quittance N° ${numeroRecu} — ${etudeAffichee}`;
  const dateFormatee = new Date(datePaiement || Date.now()).toLocaleDateString("fr-CI", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const montantFmt = Number(montantTotal || 0).toLocaleString("fr-FR") + " FCFA";
  const fraisFmt = Number(fraisOuverture || 0).toLocaleString("fr-FR") + " FCFA";
  const provFmt = Number(provision || 0).toLocaleString("fr-FR") + " FCFA";

  const texte = `QUITTANCE & REÇU DE PAIEMENT N° ${numeroRecu}
${etudeAffichee} — ${notaireAffiche}
Adresse : ${adresseEtude || "Abidjan, Côte d'Ivoire"} | Tél : ${telephoneEtude || ""}

Reçu de : ${clientNom}
Dossier N° : ${numeroDossier} (${typeActe})
Date du règlement : ${dateFormatee}
Mode de paiement : ${modePaiement || "Espèces"}

DÉTAIL DU RÈGLEMENT :
• Frais d'ouverture de dossier : ${fraisFmt}
• Provision sur frais d'acte & débours : ${provFmt}
--------------------------------------------------
TOTAL REÇU : ${montantFmt}

Ce reçu officiel certifie le règlement des sommes ci-dessus indiquées pour l'instruction de votre dossier notarié.
${etudeAffichee}`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${sujet}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#0f172a;color:#f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:30px 15px;">
    <tr>
      <td align="center">
        <table width="620" border="0" cellspacing="0" cellpadding="0" style="background-color:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
          
          <!-- Entête Cabinet Notarial -->
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%);border-bottom:2px solid #d97706;text-align:center;">
              <div style="font-size:11px;font-weight:700;color:#f59e0b;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">
                RÉPUBLIQUE DE CÔTE D'IVOIRE · NOTARIAT
              </div>
              <h1 style="margin:0 0 4px 0;font-size:22px;color:#ffffff;font-weight:800;">${etudeAffichee}</h1>
              <div style="font-size:14px;color:#38bdf8;font-weight:600;margin-bottom:8px;">${notaireAffiche}</div>
              <div style="font-size:12px;color:#94a3b8;">${adresseEtude || "Plateau, Abidjan"} · Tél : ${telephoneEtude || "+225 27 20 00 00 00"}</div>
            </td>
          </tr>

          <!-- Corps du Reçu -->
          <tr>
            <td style="padding:28px 32px;">
              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;padding:6px 18px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:20px;color:#10b981;font-size:13px;font-weight:700;text-transform:uppercase;">
                  ✓ REÇU DE PAIEMENT & QUITTANCE OFFICIELLE
                </div>
                <div style="font-size:13px;color:#94a3b8;margin-top:6px;">N° ${numeroRecu} · Émis le ${dateFormatee}</div>
              </div>

              <!-- Bloc Client & Dossier -->
              <table width="100%" border="0" cellspacing="0" cellpadding="8" style="background-color:#0f172a;border-radius:8px;border:1px solid #334155;margin-bottom:20px;font-size:13.5px;">
                <tr>
                  <td width="35%" style="color:#94a3b8;border-bottom:1px solid #1e293b;">Client / Payeur :</td>
                  <td style="color:#ffffff;font-weight:700;border-bottom:1px solid #1e293b;">${clientNom}</td>
                </tr>
                <tr>
                  <td style="color:#94a3b8;border-bottom:1px solid #1e293b;">Dossier Notarial :</td>
                  <td style="color:#38bdf8;font-weight:600;border-bottom:1px solid #1e293b;">${numeroDossier}</td>
                </tr>
                <tr>
                  <td style="color:#94a3b8;border-bottom:1px solid #1e293b;">Nature de l'acte :</td>
                  <td style="color:#ffffff;border-bottom:1px solid #1e293b;">${typeActe}</td>
                </tr>
                <tr>
                  <td style="color:#94a3b8;">Mode de règlement :</td>
                  <td style="color:#10b981;font-weight:600;">${modePaiement || "Espèces"}</td>
                </tr>
              </table>

              <!-- Décomposition Financière -->
              <table width="100%" border="0" cellspacing="0" cellpadding="10" style="background-color:#0f172a;border-radius:8px;border:1px solid #334155;margin-bottom:24px;font-size:13.5px;">
                <thead>
                  <tr style="background:#1e293b;border-bottom:1px solid #334155;">
                    <th align="left" style="color:#94a3b8;font-size:12px;text-transform:uppercase;">Désignation des Sommes</th>
                    <th align="right" style="color:#94a3b8;font-size:12px;text-transform:uppercase;">Montant Versé</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="color:#f8fafc;border-bottom:1px solid #1e293b;">Frais d'ouverture de dossier</td>
                    <td align="right" style="color:#ffffff;font-weight:600;border-bottom:1px solid #1e293b;">${fraisFmt}</td>
                  </tr>
                  <tr>
                    <td style="color:#f8fafc;border-bottom:1px solid #1e293b;">Provision sur frais & débours de formalités</td>
                    <td align="right" style="color:#ffffff;font-weight:600;border-bottom:1px solid #1e293b;">${provFmt}</td>
                  </tr>
                  <tr style="background:rgba(217,119,6,0.12);">
                    <td style="color:#f59e0b;font-weight:700;font-size:14.5px;">TOTAL ENCAISSÉ</td>
                    <td align="right" style="color:#f59e0b;font-weight:800;font-size:16px;">${montantFmt}</td>
                  </tr>
                </tbody>
              </table>

              <div style="background:rgba(59,130,246,0.08);border-left:3px solid #38bdf8;padding:12px 16px;border-radius:4px;font-size:12px;color:#94a3b8;line-height:18px;margin-bottom:20px;">
                📜 <strong style="color:#f8fafc;">Validité Légale :</strong> Ce document atteste de la consignation régulière des fonds en la comptabilité de l'office notarial conformément au Règlement Déontologique Notarial.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background-color:#0f172a;border-top:1px solid #334155;text-align:center;font-size:11.5px;color:#64748b;">
              ${etudeAffichee} · Email : <a href="mailto:${emailEtude || "contact@notaires.ci"}" style="color:#38bdf8;text-decoration:none;">${emailEtude || "contact@notaires.ci"}</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { sujet, texte, html };
}

async function envoyerEmailAssignationClerc({
  destinataireEmail,
  nomClerc,
  nomInitiateur,
  roleInitiateur,
  numeroDossier,
  typeActe,
  comparantsNoms,
  urlConnexion,
  nomEtude,
}) {
  const emailNorm = (destinataireEmail || "").toLowerCase().trim();
  if (!emailNorm) return { succes: false, erreur: "Email clerc manquant" };

  const { sujet, texte, html } = genererTemplateAssignation({
    nomClerc: nomClerc || emailNorm.split("@")[0],
    nomInitiateur,
    roleInitiateur,
    numeroDossier,
    typeActe,
    comparantsNoms,
    urlConnexion,
    nomEtude,
  });

  let statutEnvoi = {
    succes: false,
    mode: "journalise",
    destinataire: emailNorm,
    nomComplet: nomClerc || emailNorm,
    type: "assignation_dossier",
    numeroDossier,
    sujet,
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
      console.log(`[EmailAssignation] ✅ Email d'assignation envoyé à : ${emailNorm} (${numeroDossier})`);
    } else {
      statutEnvoi.succes = true;
      statutEnvoi.mode = "journal_local_pret";
      console.log(`[EmailAssignation] ℹ️ Email d'assignation préparé pour ${emailNorm} (${numeroDossier})`);
    }
  } catch (errSmtp) {
    statutEnvoi.succes = false;
    statutEnvoi.erreur = errSmtp.message;
    console.warn(`[EmailAssignation] ⚠️ Erreur SMTP pour ${emailNorm} :`, errSmtp.message);
  }

  // Journalisation
  try {
    const journalActuel = lireFichierJson("emails_envoyes.json", []);
    const journalMaj = Array.isArray(journalActuel) ? journalActuel : [];
    journalMaj.unshift(statutEnvoi);
    if (journalMaj.length > 200) journalMaj.length = 200;
    ecrireFichierJson("emails_envoyes.json", journalMaj);
  } catch (_) {}

  return statutEnvoi;
}

async function envoyerEmailRecuPaiementClient({
  destinataireEmail,
  clientNom,
  numeroRecu,
  numeroDossier,
  typeActe,
  montantTotal,
  fraisOuverture,
  provision,
  modePaiement,
  datePaiement,
  nomNotaire,
  nomEtude,
  adresseEtude,
  telephoneEtude,
  emailEtude,
}) {
  const emailNorm = (destinataireEmail || "").toLowerCase().trim();
  if (!emailNorm) return { succes: false, erreur: "Email client manquant" };

  const { sujet, texte, html } = genererTemplateRecuClient({
    clientNom: clientNom || "Client",
    numeroRecu,
    numeroDossier,
    typeActe,
    montantTotal,
    fraisOuverture,
    provision,
    modePaiement,
    datePaiement,
    nomNotaire,
    nomEtude,
    adresseEtude,
    telephoneEtude,
    emailEtude,
  });

  let statutEnvoi = {
    succes: false,
    mode: "journalise",
    destinataire: emailNorm,
    nomComplet: clientNom || emailNorm,
    type: "recu_paiement_client",
    numeroRecu,
    numeroDossier,
    sujet,
    dateEnvoi: new Date().toISOString(),
    erreur: null,
  };

  try {
    const configSmtp = await obtenirTransporteurSMTP();
    if (configSmtp && configSmtp.transporteur) {
      await configSmtp.transporteur.sendMail({
        from: `"${nomEtude || configSmtp.fromNom}" <${emailEtude || configSmtp.fromEmail}>`,
        to: emailNorm,
        subject: sujet,
        text: texte,
        html: html,
      });
      statutEnvoi.succes = true;
      statutEnvoi.mode = "smtp_reel";
      console.log(`[EmailReçuClient] ✅ Reçu N° ${numeroRecu} envoyé par email au client : ${emailNorm}`);
    } else {
      statutEnvoi.succes = true;
      statutEnvoi.mode = "journal_local_pret";
      console.log(`[EmailReçuClient] ℹ️ Reçu N° ${numeroRecu} préparé pour le client : ${emailNorm}`);
    }
  } catch (errSmtp) {
    statutEnvoi.succes = false;
    statutEnvoi.erreur = errSmtp.message;
    console.warn(`[EmailReçuClient] ⚠️ Erreur SMTP pour ${emailNorm} :`, errSmtp.message);
  }

  // Journalisation
  try {
    const journalActuel = lireFichierJson("emails_envoyes.json", []);
    const journalMaj = Array.isArray(journalActuel) ? journalActuel : [];
    journalMaj.unshift(statutEnvoi);
    if (journalMaj.length > 200) journalMaj.length = 200;
    ecrireFichierJson("emails_envoyes.json", journalMaj);
  } catch (_) {}

  return statutEnvoi;
}

module.exports = {
  envoyerEmailBienvenueCollaborateur,
  envoyerEmailAssignationClerc,
  envoyerEmailRecuPaiementClient,
  genererTemplateEmail,
  genererTemplateAssignation,
  genererTemplateRecuClient,
  listerEmailsEnvoyes,
  ROLE_LABELS,
};
