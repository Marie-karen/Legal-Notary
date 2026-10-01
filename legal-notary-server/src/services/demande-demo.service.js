/**
 * src/services/demande-demo.service.js — Gestion des demandes de démonstration commerciale (Landing Page).
 */

const { pool } = require("../db/pool");
const crypto = require("crypto");
const { lireFichierJson, ecrireFichierJson } = require("./stockage-persistant.service");
const { envoyerEmailBienvenueCollaborateur } = require("./email-deploiement.service");

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
  const nomClean = (nomPrenom || "").trim();
  const etudeClean = (nomEtude || "").trim();
  const villeClean = (villePays || "").trim() || "Abidjan, Côte d'Ivoire";
  const fonctionClean = (fonction || "notaire").trim();
  const telClean = (telephoneWhatsapp || "").trim();
  const emailClean = (email || "").toLowerCase().trim();
  const messageClean = (message || "").trim();

  const nouvelleDemande = {
    id,
    nomPrenom: nomClean,
    nomEtude: etudeClean,
    villePays: villeClean,
    fonction: fonctionClean,
    telephoneWhatsapp: telClean,
    email: emailClean,
    message: messageClean,
    consentement: !!consentement,
    ipClient: ipClient || "127.0.0.1",
    statut: "nouveau",
    createdAt: dateIso,
  };

  // 1. Sauvegarde sur disque JSON permanent
  try {
    const actuelles = lireFichierJson("demandes_demo_persistantes.json", []);
    const maj = Array.isArray(actuelles) ? actuelles : [];
    maj.unshift(nouvelleDemande);
    ecrireFichierJson("demandes_demo_persistantes.json", maj);
  } catch (e) {
    console.warn("[DemandeDemo] Erreur sauvegarde fichier JSON :", e.message);
  }

  // 2. Insertion en base PostgreSQL si disponible
  try {
    await pool.query(
      `INSERT INTO demandes_demo 
       (id, nom_prenom, nom_etude, ville_pays, fonction, telephone_whatsapp, email, message, consentement, ip_client, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        nomClean,
        etudeClean,
        villeClean,
        fonctionClean,
        telClean,
        emailClean,
        messageClean,
        true,
        ipClient || "",
        dateIso,
      ]
    );
  } catch (dbErr) {
    console.warn("[DemandeDemo] DB insert fallback :", dbErr.message);
  }

  console.log(`[DemandeDemo] 🎯 NOUVELLE DEMANDE DE DÉMO REÇUE : ${nomClean} (${etudeClean}) — Tél/WA: ${telClean} — Email: ${emailClean}`);

  return {
    success: true,
    id,
    message: "Votre demande de démonstration (30 min) a été transmise avec succès. Notre équipe vous contactera très rapidement sur WhatsApp ou par email pour convenir d'un créneau adapté.",
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
