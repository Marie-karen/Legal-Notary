/**
 * js/api.js — Client HTTP vers legal-notary-server.
 *
 * Toute la logique métier (calculs fiscaux, permissions, filtrage des
 * dossiers par rôle) vit dans l'API, jamais ici — ce fichier ne fait que
 * parler HTTP et gérer le jeton de connexion. Voir
 * ../legal-notary-server/docs/ARCHITECTURE.md.
 *
 * URL de l'API configurable (le cabinet peut héberger son serveur
 * n'importe où) : voir window.LEGAL_NOTARY_API_URL, déclarée dans
 * index.html avant ce script. Par défaut, http://localhost:4000 pour le
 * développement local.
 */

window.LegalNotaryAPI = (function () {
  "use strict";

  function getBaseUrl() {
    if (window.LEGAL_NOTARY_API_URL && window.LEGAL_NOTARY_API_URL !== "null" && !window.LEGAL_NOTARY_API_URL.startsWith("file:")) {
      return window.LEGAL_NOTARY_API_URL;
    }
    if (typeof window !== "undefined" && window.location) {
      var port = window.location.port;
      var host = window.location.hostname;
      if (port === "4000" || (host !== "localhost" && host !== "127.0.0.1" && host !== "" && !window.location.protocol.startsWith("file:"))) {
        return window.location.origin;
      }
    }
    return "http://localhost:4000";
  }
  var CLE_JETON = "legalnotary_jeton";
  var CLE_UTILISATEUR = "legalnotary_utilisateur";

  function getJeton() {
    return window.localStorage.getItem(CLE_JETON);
  }

  function setSession(jeton, utilisateur) {
    window.localStorage.setItem(CLE_JETON, jeton);
    window.localStorage.setItem(CLE_UTILISATEUR, JSON.stringify(utilisateur));
  }

  function getUtilisateur() {
    var brut = window.localStorage.getItem(CLE_UTILISATEUR);
    return brut ? JSON.parse(brut) : null;
  }

  function clearSession() {
    window.localStorage.removeItem(CLE_JETON);
    window.localStorage.removeItem(CLE_UTILISATEUR);
  }

  /**
   * Requête générique. `onNonAutorise` est appelée (par app.js) si l'API
   * répond 401 — pour renvoyer l'utilisateur à l'écran de connexion sans
   * dupliquer cette logique dans chaque appel.
   */
  var onNonAutorise = null;
  function surNonAutorise(callback) { onNonAutorise = callback; }

  function requete(methode, chemin, corps) {
    var options = {
      method: methode,
      headers: { "Content-Type": "application/json" },
    };
    var jeton = getJeton();
    if (jeton) options.headers.Authorization = "Bearer " + jeton;
    if (corps !== undefined) options.body = JSON.stringify(corps);

    return fetch(getBaseUrl() + chemin, options).then(function (reponse) {
      if (reponse.status === 401) {
        clearSession();
        if (onNonAutorise) onNonAutorise();
        return Promise.reject(new Error("Session expirée."));
      }
      if (reponse.status === 204) return null;
      return reponse.json().then(function (corpsJson) {
        if (!reponse.ok) {
          var message = (corpsJson && corpsJson.erreur) || "Erreur (" + reponse.status + ")";
          return Promise.reject(new Error(message));
        }
        return corpsJson;
      });
    });
  }

  return {
    get: function (chemin) { return requete("GET", chemin); },
    post: function (chemin, corps) { return requete("POST", chemin, corps); },
    put: function (chemin, corps) { return requete("PUT", chemin, corps); },
    patch: function (chemin, corps) { return requete("PATCH", chemin, corps); },
    del: function (chemin) { return requete("DELETE", chemin); },

    connecter: function (email, motDePasse) {
      return requete("POST", "/api/auth/connexion", { email: email, motDePasse: motDePasse }).then(function (r) {
        setSession(r.jeton, r.utilisateur);
        return r.utilisateur;
      });
    },
    deconnecter: clearSession,
    getUtilisateur: getUtilisateur,
    estConnecte: function () { return !!getJeton(); },
    surNonAutorise: surNonAutorise,
  };
})();
var LegalNotaryAPI = window.LegalNotaryAPI;
