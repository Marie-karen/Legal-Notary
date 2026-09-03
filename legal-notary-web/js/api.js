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

  // Cache en mémoire ultra-rapide (0ms) avec Stale-While-Revalidate (SWR)
  var _cacheMemoire = new Map();
  var _requetesEnVol = new Map();

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
    _cacheMemoire.clear();
    _requetesEnVol.clear();
  }

  function invaliderCache(prefixe) {
    if (!prefixe) {
      _cacheMemoire.clear();
      return;
    }
    for (var k of _cacheMemoire.keys()) {
      if (k.indexOf(prefixe) !== -1) {
        _cacheMemoire.delete(k);
      }
    }
  }

  var onNonAutorise = null;
  function surNonAutorise(callback) { onNonAutorise = callback; }

  function requeteReseau(methode, chemin, corps) {
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

  function requeteGetAvecCache(chemin, options) {
    options = options || {};
    var jeton = getJeton();
    var cleCache = (jeton ? "auth_" : "anon_") + chemin;

    // 1. Si cache en mémoire frais (< 30s pour listes, < 5min pour référentiel)
    var cacheEntry = _cacheMemoire.get(cleCache);
    var now = Date.now();
    var ttl = chemin.indexOf("/referentiel") !== -1 || chemin.indexOf("/parametres") !== -1 ? 300000 : 25000;

    if (cacheEntry && (now - cacheEntry.ts < ttl) && !options.bypassCache) {
      return Promise.resolve(cacheEntry.data);
    }

    // 2. Déduplication de requêtes en vol simultanées
    if (_requetesEnVol.has(cleCache) && !options.bypassCache) {
      return _requetesEnVol.get(cleCache);
    }

    var promesseReseau = requeteReseau("GET", chemin).then(function (donnees) {
      _requetesEnVol.delete(cleCache);
      if (donnees !== null && donnees !== undefined) {
        _cacheMemoire.set(cleCache, { data: donnees, ts: Date.now() });
      }
      return donnees;
    }).catch(function (err) {
      _requetesEnVol.delete(cleCache);
      // En cas d'échec réseau sur connexion faible/offline, retourner le cache périmé si disponible
      if (cacheEntry && cacheEntry.data) {
        console.warn("Connexion faible : données servies depuis le cache local pour", chemin);
        return cacheEntry.data;
      }
      throw err;
    });

    _requetesEnVol.set(cleCache, promesseReseau);

    // Si on a un cache périmé (stale-while-revalidate), le renvoyer immédiatement et rafraîchir en tâche de fond
    if (cacheEntry && cacheEntry.data && !options.bypassCache) {
      return Promise.resolve(cacheEntry.data);
    }

    return promesseReseau;
  }

  function requeteMutation(methode, chemin, corps) {
    // Invalidation préventive du cache sur toute écriture
    if (chemin.indexOf("/fiscal") !== -1) invaliderCache("/fiscal");
    if (chemin.indexOf("/dossiers") !== -1) { invaliderCache("/dossiers"); invaliderCache("/statistiques"); }
    if (chemin.indexOf("/clients") !== -1) invaliderCache("/clients");
    if (chemin.indexOf("/notifications") !== -1) invaliderCache("/notifications");
    if (chemin.indexOf("/parametres") !== -1) invaliderCache("/parametres");
    if (chemin.indexOf("/agenda") !== -1) invaliderCache("/agenda");

    return requeteReseau(methode, chemin, corps).then(function (res) {
      return res;
    });
  }

  return {
    get: function (chemin, options) { return requeteGetAvecCache(chemin, options); },
    post: function (chemin, corps) { return requeteMutation("POST", chemin, corps); },
    put: function (chemin, corps) { return requeteMutation("PUT", chemin, corps); },
    patch: function (chemin, corps) { return requeteMutation("PATCH", chemin, corps); },
    del: function (chemin) { return requeteMutation("DELETE", chemin); },
    invaliderCache: invaliderCache,

    connecter: function (email, motDePasse) {
      _cacheMemoire.clear();
      return requeteReseau("POST", "/api/auth/connexion", { email: email, motDePasse: motDePasse }).then(function (r) {
        setSession(r.jeton, r.utilisateur);
        return r.utilisateur;
      });
    },
    deconnecter: clearSession,
    getUtilisateur: getUtilisateur,
    estConnecte: function () { return !!getJeton(); },
    surNonAutorise: surNonAutorise,
    telechargerFichier: function (chemin, corps, nomFichierDefaut) {
      var options = {
        method: corps ? "POST" : "GET",
        headers: {},
      };
      var jeton = getJeton();
      if (jeton) options.headers.Authorization = "Bearer " + jeton;
      if (corps) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(corps);
      }

      return fetch(getBaseUrl() + chemin, options).then(function (reponse) {
        if (!reponse.ok) {
          return reponse.json().then(function (err) {
            throw new Error((err && err.erreur) || "Erreur de téléchargement");
          }).catch(function (e) {
            throw new Error(e.message || "Erreur de téléchargement");
          });
        }
        var disposition = reponse.headers.get("Content-Disposition");
        var nomFichier = nomFichierDefaut || "Export_Notaire.xlsx";
        if (disposition && disposition.indexOf("filename=") !== -1) {
          var match = disposition.match(/filename="?([^"]+)"?/);
          if (match && match[1]) nomFichier = match[1];
        }

        return reponse.blob().then(function (blob) {
          var url = window.URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          a.download = nomFichier;
          document.body.appendChild(a);
          a.click();
          setTimeout(function () {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          }, 200);
        });
      });
    },
  };
})();
var LegalNotaryAPI = window.LegalNotaryAPI;
