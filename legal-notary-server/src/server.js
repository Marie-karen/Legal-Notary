/**
 * src/server.js — Point d'entrée de l'API Legal Notary.
 *
 * Architecture : une seule application Express, montée derrière un
 * middleware d'authentification (JWT) pour toutes les routes sauf
 * /api/auth/connexion. Chaque groupe de routes (src/api/*.routes.js) reste
 * fin — la logique métier vit dans src/services/*.js, jamais dans les
 * routes elles-mêmes (voir docs/ARCHITECTURE.md).
 *
 * Lancement : `npm start` (ou `npm run dev` pour un rechargement auto en
 * développement). Prérequis : PostgreSQL accessible via DATABASE_URL
 * (.env) et migrations appliquées (`npm run migrate`) — voir README.md et
 * docs/DEPLOIEMENT.md pour l'installation complète sur le serveur du
 * cabinet (physique ou cloud).
 */

require("dotenv").config();
const path = require("path");
const express = require("express");

const { authentifier } = require("./middleware/authentifier");
const authRoutes = require("./api/auth.routes");
const dossiersRoutes = require("./api/dossiers.routes");
const clientsRoutes = require("./api/clients.routes");
const fiscalRoutes = require("./api/fiscal.routes");
const referentielRoutes = require("./api/referentiel.routes");
const archivesRoutes = require("./api/archives.routes");
const parametresRoutes = require("./api/parametres.routes");
const alertesRoutes = require("./api/alertes.routes");
const equipeRoutes = require("./api/equipe.routes");
const notificationsRoutes = require("./api/notifications.routes");
const projetsActeRoutes = require("./api/projets-acte.routes");
const parametresNotificationsRoutes = require("./api/parametres-notifications.routes");
const manuelProcedureRoutes = require("./api/manuel-procedure.routes");
const tableauBordRoutes = require("./api/tableau-bord.routes");
const infraRoutes = require("./api/infra.routes");
const supportRoutes = require("./api/support.routes");
const superadminRoutes = require("./api/superadmin.routes");
const telemetrieRoutes = require("./api/telemetrie.routes");
const rapportsRoutes = require("./api/rapports.routes");
const agendaRoutes = require("./api/agenda.routes");
const telemetrieService = require("./services/telemetrie.service");
const { appliquerEnTetesSecurite } = require("./middleware/securite.middleware");

const app = express();
app.use(appliquerEnTetesSecurite);
app.use(express.json());

// CORS minimal, écrit à la main plutôt que d'ajouter une dépendance : le
// frontend (Claude Design) et l'API ne sont pas forcément servis depuis la
// même origine. À restreindre à l'origine réelle du frontend en production
// (remplacer "*" par l'URL exacte) une fois celle-ci connue — voir
// docs/DEPLOIEMENT.md.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.ORIGINE_FRONTEND || "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/sante", (req, res) => res.json({ etat: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/telemetrie", telemetrieRoutes);

// Tout ce qui suit exige d'être connecté.
app.use("/api", authentifier);
app.use("/api/dossiers", dossiersRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/fiscal", fiscalRoutes);
app.use("/api/referentiel", referentielRoutes);
app.use("/api/archives", archivesRoutes);
app.use("/api/parametres", parametresRoutes);
app.use("/api/alertes", alertesRoutes);
app.use("/api/equipe", equipeRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/projets-acte", projetsActeRoutes);
app.use("/api/parametres-notifications", parametresNotificationsRoutes);
app.use("/api/manuel-procedure", manuelProcedureRoutes);
app.use("/api/tableau-bord", tableauBordRoutes);
app.use("/api/infra", infraRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/superadmin", superadminRoutes);
app.use("/api/rapports", rapportsRoutes);
app.use("/api/agenda", agendaRoutes);

/**
 * Sert aussi le frontend statique (legal-notary-web/) depuis ce même
 * processus : un seul programme à lancer et un seul port à ouvrir chez le
 * cabinet, plutôt que deux serveurs séparés à faire tourner (celui-ci et
 * un serveur de fichiers statiques) — plus simple à installer et à
 * maintenir pour quelqu'un qui n'est pas développeur. Le frontend appelle
 * l'API sur `window.location.origin` (voir index.html), donc ceci
 * fonctionne sans configuration CORS particulière une fois en production.
 * Le chemin est configurable (FRONTEND_DIR) pour les cabinets qui
 * préfèrent une autre disposition de dossiers.
 */
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, "..", "..", "legal-notary-web");
app.use(express.static(FRONTEND_DIR));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// Gestionnaire d'erreur générique avec capture télémétrique automatique
app.use((erreur, req, res, next) => {
  console.error("[UnhandledError]", erreur);
  telemetrieService.enregistrerErreur({
    source: "express-api-global",
    typeErreur: erreur.name || "InternalServerError",
    message: erreur.message,
    stackTrace: erreur.stack,
    niveau: (erreur.status && erreur.status < 500) ? "warning" : "error",
    meta: { url: req.originalUrl, methode: req.method, ip: req.ip },
  }).catch(() => {});
  res.status(erreur.status || 500).json({ erreur: erreur.message || "Erreur interne du serveur." });
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`[legal-notary-server] à l'écoute sur le port ${PORT}`));
}

module.exports = app;
