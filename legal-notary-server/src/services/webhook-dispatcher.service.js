/**
 * src/services/webhook-dispatcher.service.js
 *
 * Service d'expédition des événements et webhooks vers le SaaS de Contrôle Centralisé.
 * Permet au Master Admin d'être notifié en temps réel des actions clés (inscriptions, paiements, pannes).
 */

const crypto = require("crypto");

/**
 * Notifie le Master Super Admin Hub d'un événement clé.
 *
 * @param {string} event - Nom de l'événement (ex: 'user.created', 'payment.success', 'system.critical_error')
 * @param {object} payload - Données associées à l'événement
 * @returns {Promise<{ succes: boolean, statut?: number, erreur?: string }>}
 */
async function notifyControlHub(event, payload = {}) {
  const webhookUrl = process.env.CONTROL_HUB_WEBHOOK_URL;
  const secretKey = process.env.CONTROL_HUB_SECRET_KEY || "";

  if (!webhookUrl || !webhookUrl.trim() || webhookUrl.includes("votredomaine.com")) {
    // Webhook non configuré ou valeur d'exemple : on ne tente pas l'envoi
    return { succes: false, erreur: "CONTROL_HUB_WEBHOOK_URL non configuré" };
  }

  const timestamp = new Date().toISOString();
  const corps = JSON.stringify({
    event,
    timestamp,
    service: "legal-notary-server",
    env: process.env.NODE_ENV || "production",
    data: payload,
  });

  // Calcul de la signature HMAC-SHA256 pour prouver l'authenticité de l'origine
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(corps)
    .digest("hex");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 secondes max

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "LegalNotary-WebhookDispatcher/1.0",
        "x-control-hub-event": event,
        "x-control-hub-signature": signature,
        "x-control-hub-timestamp": timestamp,
      },
      body: corps,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[WebhookDispatcher] Le Master Hub a répondu avec le statut HTTP ${response.status} pour l'événement ${event}`);
      return { succes: false, statut: response.status };
    }

    return { succes: true, statut: response.status };
  } catch (err) {
    console.error(`[WebhookDispatcher] Échec d'envoi du webhook '${event}' vers ${webhookUrl} :`, err.message);
    return { succes: false, erreur: err.message };
  }
}

module.exports = { notifyControlHub };
