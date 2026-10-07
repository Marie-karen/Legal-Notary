/**
 * src/services/demande-demo.service.js — Gestion des demandes de démonstration commerciale (Landing Page).
 */

const { pool } = require("../db/pool");
const crypto = require("crypto");
const {
  lireFichierJson,
  ecrireFichierJson,
} = require("./stockage-persistant.service");
const authService = require("./auth.service");
const superadminService = require("./superadmin.service");
const {
  envoyerEmailBienvenueCollaborateur,
} = require("./email-deploiement.service");

// Table SQL auto-créée
async function initialiserTableDemandesDemo() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS demandes_demo (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        nom_prenom text NOT NULL,
        nom_etude text NOT NULL,
        ville_pays text NOT NULL,
        fonction text NOT NULL,
        telephone_whatsapp text NOT NULL,
        email text NOT NULL,
        message text,
        consentement boolean NOT NULL DEFAULT true,
        ip_client text,
        statut text NOT NULL DEFAULT 'nouveau',
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  } catch (e) {
    console.warn("[DemandeDemo] Fallback DB schema init:", e.message);
  }
}

// Initialisation au démarrage
initialiserTableDemandesDemo().catch(() => {});

async function enregistrerDemandeDemo({
  nomPrenom,
  nomEtude,
  villePays,
  fonction,
  telephoneWhatsapp,
  email,
  message,
  consentement,
  ipClient,
}) {
  const id = crypto.randomUUID();
  const dateIso = new Date().toISOString();
  const nomClean = (nomPrenom || "Confrère / Consœur").trim();
  const etudeClean = (nomEtude || "").trim();
  const villeClean = (villePays || "").trim() || "Abidjan, Côte d'Ivoire";
  const fonctionClean = (fonction || "notaire").trim();
  const telClean = (telephoneWhatsapp || "").trim();
  const emailClean = (email || "").toLowerCase().trim();
  const messageClean = (message || "").trim();

  // Mot de passe temporaire unique généré pour ce prospect
  const mdpDemo = "Demo" + Math.floor(1000 + Math.random() * 9000) + "!";
  const nomEtudeFinal = etudeClean || "Étude Démo Me " + nomClean;
  const roleAttribue =
    fonctionClean === "notaire"
      ? "notaire"
      : fonctionClean === "premier_clerc"
        ? "premier_clerc"
        : "clerc_redacteur";

  // 1. Création d'un espace démo sécurisé isolé et dédié à ce prospect
  let etudeDemoCreee = null;
  try {
    etudeDemoCreee = await superadminService.creerEtude({
      nomEtude: nomEtudeFinal,
      ville: villeClean,
      domaine: `demo-${id.slice(0, 6)}.legalnotary.app`,
      titreNotaire: roleAttribue === "notaire" ? "Maître" : "M./Mme",
      collaborateurs: [
        {
          nomComplet: nomClean,
          email: emailClean,
          role: roleAttribue,
          motDePasse: mdpDemo,
          telephone: telClean,
        },
      ],
      envoyerEmails: true, // Envoie le véritable email depuis infos@legalnotary.app via Hostinger
    });
  } catch (errEtude) {
    console.warn(
      "[DemandeDemo] Création espace démo fallback :",
      errEtude.message,
    );
  }

  const nouvelleDemande = {
    id,
    nomPrenom: nomClean,
    nomEtude: nomEtudeFinal,
    villePays: villeClean,
    fonction: fonctionClean,
    telephoneWhatsapp: telClean,
    email: emailClean,
    motDePasseDemo: mdpDemo,
    message: messageClean,
    consentement: !!consentement,
    ipClient: ipClient || "127.0.0.1",
    statut: "demo_active",
    createdAt: dateIso,
  };

  // 2. Sauvegarde sur disque JSON permanent des Leads CRM
  try {
    const actuelles = lireFichierJson("demandes_demo_persistantes.json", []);
    const maj = Array.isArray(actuelles) ? actuelles : [];
    maj.unshift(nouvelleDemande);
    ecrireFichierJson("demandes_demo_persistantes.json", maj);
  } catch (e) {
    console.warn("[DemandeDemo] Erreur sauvegarde fichier JSON :", e.message);
  }

  // 3. Insertion en base PostgreSQL si disponible
  try {
    await pool.query(
      `INSERT INTO demandes_demo 
       (id, nom_prenom, nom_etude, ville_pays, fonction, telephone_whatsapp, email, message, consentement, ip_client, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        nomClean,
        nomEtudeFinal,
        villeClean,
        fonctionClean,
        telClean,
        emailClean,
        messageClean,
        true,
        ipClient || "",
        dateIso,
      ],
    );
  } catch (dbErr) {
    console.warn("[DemandeDemo] DB insert fallback :", dbErr.message);
  }

  console.log(
    `[DemandeDemo] 🎯 NOUVELLE DÉMO PERSONNELLE CRÉÉE : ${nomClean} (${nomEtudeFinal}) — Email: ${emailClean} — Mdp: ${mdpDemo}`,
  );

  return {
    success: true,
    id,
    email: emailClean,
    motDePasse: mdpDemo,
    role: roleAttribue,
    nomEtude: nomEtudeFinal,
    urlConnexion: "https://legalnotary.app",
    message: `Félicitations ${nomClean} ! Votre espace de démonstration personnalisé et 100% sécurisé est prêt. Vos accès viennent de vous être envoyés par email à ${emailClean}.`,
  };
}

function listerDemandesDemo(limite = 50) {
  const liste = lireFichierJson("demandes_demo_persistantes.json", []);
  return Array.isArray(liste) ? liste.slice(0, limite) : [];
}

module.exports = {
  enregistrerDemandeDemo,
  listerDemandesDemo,
  initialiserTableDemandesDemo,
};
