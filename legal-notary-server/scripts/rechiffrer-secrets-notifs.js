#!/usr/bin/env node
/**
 * scripts/rechiffrer-secrets-notifs.js — Migration et rechiffrement des identifiants sensibles lors d'une rotation de clé.
 *
 * Utilisation :
 *   ANCIENNE_CLE_CHIFFREMENT_NOTIFS=... NOUVELLE_CLE_CHIFFREMENT_NOTIFS=... node scripts/rechiffrer-secrets-notifs.js
 * ou :
 *   node scripts/rechiffrer-secrets-notifs.js --ancienne-cle=... --nouvelle-cle=...
 */

const { pool } = require("../src/db/pool");
const { rechiffrer, rechiffrerObjet } = require("../src/utils/crypto");
const { FORMAT_CLE_HEX } = require("../src/config");

/**
 * Exécute le rechiffrement de la table parametres_notifications dans une transaction SQL
 */
async function rechiffrerParametresNotifications({ ancienneCle, nouvelleCle, clientDb = pool } = {}) {
  if (!ancienneCle || !FORMAT_CLE_HEX.test(ancienneCle)) {
    throw new Error("L'ancienne clé de chiffrement doit comporter exactement 64 caractères hexadécimaux.");
  }
  if (!nouvelleCle || !FORMAT_CLE_HEX.test(nouvelleCle)) {
    throw new Error("La nouvelle clé de chiffrement doit comporter exactement 64 caractères hexadécimaux.");
  }
  if (ancienneCle === nouvelleCle) {
    throw new Error("L'ancienne clé et la nouvelle clé doivent être distinctes.");
  }

  const client = await clientDb.connect();
  let compteurRechiffres = 0;

  try {
    await client.query("BEGIN");

    const { rows } = await client.query("SELECT * FROM parametres_notifications FOR UPDATE");

    for (const ligne of rows) {
      const updates = [];
      const params = [];
      let paramIdx = 1;

      // 1. Mot de passe SMTP
      if (ligne.smtp_mot_de_passe && typeof ligne.smtp_mot_de_passe === "string") {
        const nouveauMdp = rechiffrer(ligne.smtp_mot_de_passe, ancienneCle, nouvelleCle);
        updates.push(`smtp_mot_de_passe = $${paramIdx++}`);
        params.push(nouveauMdp);
      }

      // 2. Clé privée Push
      if (ligne.push_cle_privee && typeof ligne.push_cle_privee === "string") {
        const nouvelleClePush = rechiffrer(ligne.push_cle_privee, ancienneCle, nouvelleCle);
        updates.push(`push_cle_privee = $${paramIdx++}`);
        params.push(nouvelleClePush);
      }

      // 3. Identifiants SMS (jsonb)
      if (ligne.sms_identifiants) {
        const nouveauSms = rechiffrerObjet(ligne.sms_identifiants, ancienneCle, nouvelleCle);
        updates.push(`sms_identifiants = $${paramIdx++}`);
        params.push(nouveauSms);
      }

      // 4. Identifiants WhatsApp (jsonb)
      if (ligne.whatsapp_identifiants) {
        const nouveauWa = rechiffrerObjet(ligne.whatsapp_identifiants, ancienneCle, nouvelleCle);
        updates.push(`whatsapp_identifiants = $${paramIdx++}`);
        params.push(nouveauWa);
      }

      if (updates.length > 0) {
        params.push(ligne.id);
        const query = `UPDATE parametres_notifications SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${paramIdx}`;
        await client.query(query, params);
        compteurRechiffres++;
      }
    }

    await client.query("COMMIT");
    return { succes: true, compteurRechiffres };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function executerLigneCommande() {
  const args = process.argv.slice(2);
  let ancienneCle = process.env.ANCIENNE_CLE_CHIFFREMENT_NOTIFS;
  let nouvelleCle = process.env.NOUVELLE_CLE_CHIFFREMENT_NOTIFS || process.env.CLE_CHIFFREMENT_NOTIFS;

  for (const arg of args) {
    if (arg.startsWith("--ancienne-cle=")) {
      ancienneCle = arg.split("=")[1];
    } else if (arg.startsWith("--nouvelle-cle=")) {
      nouvelleCle = arg.split("=")[1];
    }
  }

  try {
    const res = await rechiffrerParametresNotifications({ ancienneCle, nouvelleCle });
    console.log(
      `\n[RechiffrementNotifs] Succès : ${res.compteurRechiffres} enregistrements rechiffrés avec la nouvelle clé.`
    );
    console.log("Les données ont été migrées et scellées avec succès.\n");
    process.exit(0);
  } catch (err) {
    console.error(`\n[RechiffrementNotifs] ERREUR : ${err.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  executerLigneCommande();
}

module.exports = {
  rechiffrerParametresNotifications,
};
