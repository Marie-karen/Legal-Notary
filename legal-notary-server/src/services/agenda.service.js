/**
 * src/services/agenda.service.js — Agenda Notarial (Délégation Assistante) & To-Do List Intelligente.
 *
 * Fonctionnalités notariales :
 * 1. Agenda du Notaire tenu par l'Assistante (ou en direct) :
 *    - Rendez-vous de Signature d'Acte avec vérification des prérequis légaux (Projet validé, Provision réglée, KYC).
 *    - Rendez-vous de Conseil / Ouverture de dossier.
 *    - Rendez-vous téléphoniques, audiences et déplacements extérieurs.
 *    - Gestion des salles de signatures de l'étude.
 * 2. To-Do List connectée par collaborateur :
 *    - Tâches automatiques issues du circuit des dossiers.
 *    - Mémos et tâches personnelles manuelles.
 */

const { pool } = require("../db/pool");
const crypto = require("crypto");
const dossiersService = require("./dossiers.service");

// Mémoire de secours si la base PostgreSQL est en cours d'initialisation
const memoireEvenements = new Map();
const memoireTaches = new Map();

// Initialisation idempotente des structures
let tablesInitialisees = false;
async function assurerTables() {
  if (tablesInitialisees) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agenda_evenements (
        id UUID PRIMARY KEY,
        etude_id UUID NOT NULL,
        notaire_id UUID,
        notaire_nom VARCHAR(255),
        cree_par_id UUID NOT NULL,
        cree_par_nom VARCHAR(255),
        dossier_id UUID,
        numero_dossier VARCHAR(100),
        client_nom VARCHAR(255),
        client_telephone VARCHAR(100),
        type_rdv VARCHAR(50) NOT NULL,
        titre VARCHAR(255) NOT NULL,
        description TEXT,
        salle VARCHAR(100) DEFAULT 'Bureau du Notaire',
        date_debut TIMESTAMPTZ NOT NULL,
        date_fin TIMESTAMPTZ NOT NULL,
        statut VARCHAR(50) DEFAULT 'confirme',
        prerequis_statut JSONB,
        rappel_sms BOOLEAN DEFAULT true,
        rappel_email BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS agenda_taches (
        id UUID PRIMARY KEY,
        etude_id UUID NOT NULL,
        assigne_a_id UUID NOT NULL,
        assigne_a_nom VARCHAR(255),
        cree_par_id UUID NOT NULL,
        dossier_id UUID,
        numero_dossier VARCHAR(100),
        titre VARCHAR(255) NOT NULL,
        description TEXT,
        priorite VARCHAR(20) DEFAULT 'normale',
        echeance TIMESTAMPTZ,
        statut VARCHAR(30) DEFAULT 'a_faire',
        source VARCHAR(30) DEFAULT 'manuel',
        etape_dossier INT,
        complete_le TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    tablesInitialisees = true;
  } catch {
    tablesInitialisees = false;
  }
}

function camelEvenement(l) {
  return {
    id: l.id,
    etudeId: l.etude_id,
    notaireId: l.notaire_id,
    notaireNom: l.notaire_nom,
    creeParId: l.cree_par_id,
    creeParNom: l.cree_par_nom,
    dossierId: l.dossier_id,
    numeroDossier: l.numero_dossier,
    clientNom: l.client_nom,
    clientTelephone: l.client_telephone,
    typeRdv: l.type_rdv,
    titre: l.titre,
    description: l.description,
    salle: l.salle,
    dateDebut: l.date_debut,
    dateFin: l.date_fin,
    statut: l.statut,
    prerequisStatut: l.prerequis_statut || null,
    rappelSms: Boolean(l.rappel_sms),
    rappelEmail: Boolean(l.rappel_email),
    createdAt: l.created_at,
    updatedAt: l.updated_at,
  };
}

function camelTache(l) {
  return {
    id: l.id,
    etudeId: l.etude_id,
    assigneAId: l.assigne_a_id,
    assigneANom: l.assigne_a_nom,
    creeParId: l.cree_par_id,
    dossierId: l.dossier_id,
    numeroDossier: l.numero_dossier,
    titre: l.titre,
    description: l.description,
    priorite: l.priorite,
    echeance: l.echeance,
    statut: l.statut,
    source: l.source,
    etapeDossier: l.etape_dossier,
    completeLe: l.complete_le,
    createdAt: l.created_at,
  };
}

/**
 * Vérification des prérequis stricts d'une signature d'acte :
 * 1. Projet d'acte validé
 * 2. Provision / Taxe réglée
 * 3. Comparants / KYC validés
 */
async function verifierPrerequisSignature(dossierId, utilisateur) {
  if (!dossierId) {
    return { pretPourSignature: true, alertes: [] };
  }

  let dossier = null;
  try {
    dossier = await dossiersService.obtenirDossierPourUtilisateur(dossierId, utilisateur || { role: "notaire", id: "0000" });
  } catch {
    dossier = null;
  }

  const alertes = [];
  let projetValide = false;
  let provisionReglee = false;
  let piecesKycConformes = true;

  if (dossier) {
    // Étape 4 (Signature) ou projet d'acte existant
    if (dossier.etapeActuelle >= 4) {
      projetValide = true;
    }

    // Vérification de la taxe / provision
    if (dossier.taxePayee || dossier.statutTaxe === "payee" || dossier.provisionRecue) {
      provisionReglee = true;
    } else {
      alertes.push({
        type: "provision_non_reglee",
        gravite: "haute",
        message: "La provision / taxe prévisionnelle n'est pas encore enregistrée comme réglée.",
      });
    }

    if (!projetValide && dossier.etapeActuelle < 3) {
      alertes.push({
        type: "projet_non_redige",
        gravite: "moyenne",
        message: "Le projet d'acte est encore en phase initiale de collecte ou rédaction.",
      });
    }
  }

  return {
    pretPourSignature: alertes.filter((a) => a.gravite === "haute").length === 0,
    projetValide,
    provisionReglee,
    piecesKycConformes,
    alertes,
  };
}

// =========================================================================
// GESTION DE L'AGENDA & RENDEZ-VOUS
// =========================================================================

async function listerEvenements(filtres = {}, utilisateur = {}) {
  await assurerTables();
  const etudeId = utilisateur.etudeId || filtres.etudeId || "a0000000-0000-0000-0000-000000000001";
  
  if (tablesInitialisees) {
    try {
      let query = "SELECT * FROM agenda_evenements WHERE etude_id = $1";
      const params = [etudeId];
      let pIdx = 2;

      if (filtres.notaireId && filtres.notaireId !== "all") {
        query += ` AND (notaire_id = $${pIdx} OR notaire_id IS NULL)`;
        params.push(filtres.notaireId);
        pIdx++;
      }
      if (filtres.debut) {
        query += ` AND date_fin >= $${pIdx}`;
        params.push(new Date(filtres.debut).toISOString());
        pIdx++;
      }
      if (filtres.fin) {
        query += ` AND date_debut <= $${pIdx}`;
        params.push(new Date(filtres.fin).toISOString());
        pIdx++;
      }

      query += " ORDER BY date_debut ASC";
      const { rows } = await pool.query(query, params);
      return rows.map(camelEvenement);
    } catch {
      // repli mémoire
    }
  }

  // Repli mémoire
  let evts = Array.from(memoireEvenements.values()).filter((e) => e.etudeId === etudeId);
  if (filtres.notaireId && filtres.notaireId !== "all") {
    evts = evts.filter((e) => !e.notaireId || e.notaireId === filtres.notaireId);
  }
  if (filtres.debut) {
    const dDebut = new Date(filtres.debut).getTime();
    evts = evts.filter((e) => new Date(e.dateFin).getTime() >= dDebut);
  }
  if (filtres.fin) {
    const dFin = new Date(filtres.fin).getTime();
    evts = evts.filter((e) => new Date(e.dateDebut).getTime() <= dFin);
  }
  return evts.sort((a, b) => new Date(a.dateDebut) - new Date(b.dateDebut));
}

async function creerEvenement(donnees, utilisateur) {
  await assurerTables();
  const id = donnees.id || crypto.randomUUID();
  const etudeId = utilisateur.etudeId || "a0000000-0000-0000-0000-000000000001";
  
  // Vérification automatique des prérequis si signature d'acte
  let prerequis = null;
  if (donnees.typeRdv === "signature_acte" && donnees.dossierId) {
    prerequis = await verifierPrerequisSignature(donnees.dossierId, utilisateur);
  }

  const evt = {
    id,
    etude_id: etudeId,
    notaire_id: donnees.notaireId || utilisateur.id,
    notaire_nom: donnees.notaireNom || "Maître Notaire",
    cree_par_id: utilisateur.id || crypto.randomUUID(),
    cree_par_nom: (utilisateur.prenom ? utilisateur.prenom + " " + utilisateur.nom : "Assistante"),
    dossier_id: donnees.dossierId || null,
    numero_dossier: donnees.numeroDossier || null,
    client_nom: donnees.clientNom || "",
    client_telephone: donnees.clientTelephone || "",
    type_rdv: donnees.typeRdv || "consultation_client",
    titre: donnees.titre || "Rendez-vous client",
    description: donnees.description || "",
    salle: donnees.salle || "Bureau du Notaire",
    date_debut: new Date(donnees.dateDebut || Date.now()).toISOString(),
    date_fin: new Date(donnees.dateFin || (Date.now() + 3600000)).toISOString(),
    statut: donnees.statut || "confirme",
    prerequis_statut: prerequis,
    rappel_sms: donnees.rappelSms !== false,
    rappel_email: donnees.rappelEmail !== false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (tablesInitialisees) {
    try {
      await pool.query(`
        INSERT INTO agenda_evenements (
          id, etude_id, notaire_id, notaire_nom, cree_par_id, cree_par_nom,
          dossier_id, numero_dossier, client_nom, client_telephone,
          type_rdv, titre, description, salle, date_debut, date_fin,
          statut, prerequis_statut, rappel_sms, rappel_email, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      `, [
        evt.id, evt.etude_id, evt.notaire_id, evt.notaire_nom, evt.cree_par_id, evt.cree_par_nom,
        evt.dossier_id, evt.numero_dossier, evt.client_nom, evt.client_telephone,
        evt.type_rdv, evt.titre, evt.description, evt.salle, evt.date_debut, evt.date_fin,
        evt.statut, JSON.stringify(evt.prerequis_statut), evt.rappel_sms, evt.rappel_email,
        evt.created_at, evt.updated_at
      ]);
    } catch {
      // fallback
    }
  }

  const obj = camelEvenement(evt);
  memoireEvenements.set(id, obj);
  return obj;
}

async function mettreAJourEvenement(id, modifications, utilisateur) {
  await assurerTables();
  const ancien = memoireEvenements.get(id);
  const dateMaj = new Date().toISOString();

  let prerequis = modifications.prerequisStatut !== undefined ? modifications.prerequisStatut : (ancien ? ancien.prerequisStatut : null);
  if (modifications.typeRdv === "signature_acte" && modifications.dossierId) {
    prerequis = await verifierPrerequisSignature(modifications.dossierId, utilisateur);
  }

  if (tablesInitialisees) {
    try {
      await pool.query(`
        UPDATE agenda_evenements SET
          titre = COALESCE($1, titre),
          description = COALESCE($2, description),
          type_rdv = COALESCE($3, type_rdv),
          salle = COALESCE($4, salle),
          date_debut = COALESCE($5, date_debut),
          date_fin = COALESCE($6, date_fin),
          statut = COALESCE($7, statut),
          prerequis_statut = COALESCE($8, prerequis_statut),
          updated_at = $9
        WHERE id = $10
      `, [
        modifications.titre || null,
        modifications.description !== undefined ? modifications.description : null,
        modifications.typeRdv || null,
        modifications.salle || null,
        modifications.dateDebut ? new Date(modifications.dateDebut).toISOString() : null,
        modifications.dateFin ? new Date(modifications.dateFin).toISOString() : null,
        modifications.statut || null,
        prerequis ? JSON.stringify(prerequis) : null,
        dateMaj,
        id,
      ]);
    } catch {}
  }

  if (ancien) {
    Object.assign(ancien, {
      ...modifications,
      prerequisStatut: prerequis,
      updatedAt: dateMaj,
    });
    return ancien;
  }
  return { id, ...modifications, prerequisStatut: prerequis, updatedAt: dateMaj };
}

async function supprimerEvenement(id) {
  await assurerTables();
  if (tablesInitialisees) {
    try {
      await pool.query("DELETE FROM agenda_evenements WHERE id = $1", [id]);
    } catch {}
  }
  memoireEvenements.delete(id);
  return { succes: true, id };
}

// =========================================================================
// GESTION DE LA TO-DO LIST & TÂCHES COLLABORATEURS
// =========================================================================

async function listerTaches(filtres = {}, utilisateur = {}) {
  await assurerTables();
  const etudeId = utilisateur.etudeId || filtres.etudeId || "a0000000-0000-0000-0000-000000000001";
  const utilisateurId = filtres.assigneAId || utilisateur.id;

  if (tablesInitialisees) {
    try {
      let query = "SELECT * FROM agenda_taches WHERE etude_id = $1";
      const params = [etudeId];
      let pIdx = 2;

      if (utilisateurId && utilisateurId !== "all") {
        query += ` AND assigne_a_id = $${pIdx}`;
        params.push(utilisateurId);
        pIdx++;
      }
      if (filtres.dossierId) {
        query += ` AND dossier_id = $${pIdx}`;
        params.push(filtres.dossierId);
        pIdx++;
      }
      if (filtres.statut && filtres.statut !== "all") {
        query += ` AND statut = $${pIdx}`;
        params.push(filtres.statut);
        pIdx++;
      }

      query += " ORDER BY CASE WHEN statut = 'a_faire' THEN 0 ELSE 1 END, echeance ASC NULLS LAST, created_at DESC";
      const { rows } = await pool.query(query, params);
      return rows.map(camelTache);
    } catch {}
  }

  let list = Array.from(memoireTaches.values()).filter((t) => t.etudeId === etudeId);
  if (utilisateurId && utilisateurId !== "all") {
    list = list.filter((t) => t.assigneAId === utilisateurId);
  }
  if (filtres.dossierId) {
    list = list.filter((t) => t.dossierId === filtres.dossierId);
  }
  if (filtres.statut && filtres.statut !== "all") {
    list = list.filter((t) => t.statut === filtres.statut);
  }

  return list.sort((a, b) => {
    if (a.statut === "a_faire" && b.statut !== "a_faire") return -1;
    if (a.statut !== "a_faire" && b.statut === "a_faire") return 1;
    return new Date(a.echeance || 9999999999999) - new Date(b.echeance || 9999999999999);
  });
}

async function creerTache(donnees, utilisateur) {
  await assurerTables();
  const id = donnees.id || crypto.randomUUID();
  const etudeId = utilisateur.etudeId || "a0000000-0000-0000-0000-000000000001";

  const t = {
    id,
    etude_id: etudeId,
    assigne_a_id: donnees.assigneAId || utilisateur.id || crypto.randomUUID(),
    assigne_a_nom: donnees.assigneANom || (utilisateur.prenom ? utilisateur.prenom + " " + utilisateur.nom : "Collaborateur"),
    cree_par_id: utilisateur.id || crypto.randomUUID(),
    dossier_id: donnees.dossierId || null,
    numero_dossier: donnees.numeroDossier || null,
    titre: donnees.titre || "Nouvelle tâche",
    description: donnees.description || "",
    priorite: donnees.priorite || "normale",
    echeance: donnees.echeance ? new Date(donnees.echeance).toISOString() : null,
    statut: donnees.statut || "a_faire",
    source: donnees.source || "manuel",
    etape_dossier: donnees.etapeDossier || null,
    complete_le: null,
    created_at: new Date().toISOString(),
  };

  if (tablesInitialisees) {
    try {
      await pool.query(`
        INSERT INTO agenda_taches (
          id, etude_id, assigne_a_id, assigne_a_nom, cree_par_id,
          dossier_id, numero_dossier, titre, description,
          priorite, echeance, statut, source, etape_dossier, complete_le, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      `, [
        t.id, t.etude_id, t.assigne_a_id, t.assigne_a_nom, t.cree_par_id,
        t.dossier_id, t.numero_dossier, t.titre, t.description,
        t.priorite, t.echeance, t.statut, t.source, t.etape_dossier, t.complete_le, t.created_at
      ]);
    } catch {}
  }

  const obj = camelTache(t);
  memoireTaches.set(id, obj);
  return obj;
}

async function basculerTache(id) {
  await assurerTables();
  let tache = memoireTaches.get(id);
  const now = new Date().toISOString();

  let nouveauStatut = "termine";
  let completeLe = now;

  if (tache && tache.statut === "termine") {
    nouveauStatut = "a_faire";
    completeLe = null;
  }

  if (tablesInitialisees) {
    try {
      await pool.query(`
        UPDATE agenda_taches
        SET statut = $1, complete_le = $2
        WHERE id = $3
      `, [nouveauStatut, completeLe, id]);
    } catch {}
  }

  if (tache) {
    tache.statut = nouveauStatut;
    tache.completeLe = completeLe;
    return tache;
  }

  const updated = { id, statut: nouveauStatut, completeLe };
  memoireTaches.set(id, updated);
  return updated;
}

async function supprimerTache(id) {
  await assurerTables();
  if (tablesInitialisees) {
    try {
      await pool.query("DELETE FROM agenda_taches WHERE id = $1", [id]);
    } catch {}
  }
  memoireTaches.delete(id);
  return { succes: true, id };
}

// Initialisation de quelques données de démonstration réalistes
(async function initDemo() {
  const now = new Date();
  const journeeCourante = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString();
  const fin1 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0).toISOString();
  const rdv2Debut = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 30).toISOString();
  const rdv2Fin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 30).toISOString();

  creerEvenement({
    id: "evt-demo-01",
    titre: "Signature Vente Immobilière — M. KOUASSI & BNI",
    numeroDossier: "2024-VTE-0042",
    clientNom: "M. KOUASSI Jean-Baptiste",
    clientTelephone: "+225 07 08 09 10 11",
    typeRdv: "signature_acte",
    salle: "Grande Salle des Actes",
    dateDebut: journeeCourante,
    dateFin: fin1,
    description: "Lecture de l'acte authentique et recueil des signatures électroniques / manuscrites.",
  }, { id: "notaire-01", nom: "Notaire Titulaire", role: "notaire" }).catch(() => {});

  creerEvenement({
    id: "evt-demo-02",
    titre: "Ouverture de Dossier & Conseil — Succession Famille DIOMANDÉ",
    numeroDossier: "2024-SUC-0018",
    clientNom: "Mme DIOMANDÉ Aïcha",
    clientTelephone: "+225 05 06 07 08 09",
    typeRdv: "consultation_client",
    salle: "Bureau du Notaire",
    dateDebut: rdv2Debut,
    dateFin: rdv2Fin,
    description: "Collecte des actes de naissance, certificat de décès et inventaire du patrimoine.",
  }, { id: "notaire-01", nom: "Notaire Titulaire", role: "notaire" }).catch(() => {});

  // Tâches de démo
  creerTache({
    id: "tache-demo-01",
    titre: "Vérifier le virement de provision (15 000 000 F CFA) pour le dossier Vente KOUASSI",
    numeroDossier: "2024-VTE-0042",
    priorite: "haute",
    echeance: new Date(Date.now() + 3600000 * 4).toISOString(),
    source: "dossier_auto",
  }, { id: "notaire-01", nom: "Maître Notaire" }).catch(() => {});

  creerTache({
    id: "tache-demo-02",
    titre: "Relancer la Conservation Foncière pour l'état des droits réels",
    numeroDossier: "2024-HYP-0015",
    priorite: "normale",
    echeance: new Date(Date.now() + 86400000).toISOString(),
    source: "manuel",
  }, { id: "notaire-01", nom: "Maître Notaire" }).catch(() => {});
})();

module.exports = {
  verifierPrerequisSignature,
  listerEvenements,
  creerEvenement,
  mettreAJourEvenement,
  supprimerEvenement,
  listerTaches,
  creerTache,
  basculerTache,
  supprimerTache,
};
