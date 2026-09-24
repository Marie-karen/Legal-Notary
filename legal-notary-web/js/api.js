/**
 * js/api.js — Client HTTP vers legal-notary-server avec Zéro Latence (< 1ms) & Offline-First SWR.
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
  var PREFIXE_CACHE_LS = "legalnotary_cache_";

  // Cache mémoire instantané (< 0.1ms)
  var _cacheMemoire = new Map();
  var _requetesEnVol = new Map();

  function getJeton() {
    try {
      return window.localStorage.getItem(CLE_JETON);
    } catch (_) {
      return null;
    }
  }

  function setSession(jeton, utilisateur) {
    try {
      window.localStorage.setItem(CLE_JETON, jeton);
      window.localStorage.setItem(CLE_UTILISATEUR, JSON.stringify(utilisateur));
    } catch (_) {}
  }

  function getUtilisateur() {
    try {
      var brut = window.localStorage.getItem(CLE_UTILISATEUR);
      return brut ? JSON.parse(brut) : null;
    } catch (_) {
      return null;
    }
  }

  function clearSession() {
    try {
      window.localStorage.removeItem(CLE_JETON);
      window.localStorage.removeItem(CLE_UTILISATEUR);
    } catch (_) {}
    _cacheMemoire.clear();
    _requetesEnVol.clear();
  }

  function getCachePersistant(cle) {
    try {
      var raw = window.localStorage.getItem(PREFIXE_CACHE_LS + cle);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function setCachePersistant(cle, data) {
    try {
      window.localStorage.setItem(PREFIXE_CACHE_LS + cle, JSON.stringify({ data: data, ts: Date.now() }));
    } catch (_) {}
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

  function requeteReseau(methode, chemin, corps, timeoutMs) {
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var signal = controller ? controller.signal : undefined;
    var timer = null;

    if (controller && timeoutMs) {
      timer = setTimeout(function () {
        try { controller.abort(); } catch (_) {}
      }, timeoutMs);
    }

    var options = {
      method: methode,
      headers: { "Content-Type": "application/json" },
      signal: signal,
    };
    var jeton = getJeton();
    if (jeton) options.headers.Authorization = "Bearer " + jeton;
    if (corps !== undefined) options.body = JSON.stringify(corps);

    return fetch(getBaseUrl() + chemin, options).then(function (reponse) {
      if (timer) clearTimeout(timer);
      if (reponse.status === 401) {
        clearSession();
        if (onNonAutorise) onNonAutorise();
        return Promise.reject(new Error("Session expirée."));
      }
      if (reponse.status === 204) return null;
      var contentType = reponse.headers.get("content-type") || "";
      if (contentType.indexOf("application/json") !== -1) {
        return reponse.json().then(function (corpsJson) {
          if (!reponse.ok) {
            var message = (corpsJson && corpsJson.erreur) || "Erreur (" + reponse.status + ")";
            return Promise.reject(new Error(message));
          }
          return corpsJson;
        });
      }
      return reponse.text().then(function (texte) {
        if (!reponse.ok) {
          return Promise.reject(new Error("Erreur (" + reponse.status + ")"));
        }
        try {
          return JSON.parse(texte);
        } catch (e) {
          return texte;
        }
      });
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  function requeteGetAvecCache(chemin, options) {
    options = options || {};
    var jeton = getJeton();
    var cleCache = (jeton ? "auth_" : "anon_") + chemin;

    // 1. Récupération instantanée mémoire (< 0.1ms)
    var cacheEntry = _cacheMemoire.get(cleCache);
    if (!cacheEntry) {
      // Fallback rapide sur le LocalStorage persistant
      var lsEntry = getCachePersistant(cleCache);
      if (lsEntry && lsEntry.data) {
        cacheEntry = lsEntry;
        _cacheMemoire.set(cleCache, cacheEntry);
      }
    }

    var now = Date.now();
    var ttl = chemin.indexOf("/referentiel") !== -1 || chemin.indexOf("/parametres") !== -1 ? 300000 : 30000;

    // 2. Déduplication de requêtes simultanées
    if (_requetesEnVol.has(cleCache) && !options.bypassCache) {
      if (cacheEntry && cacheEntry.data) return Promise.resolve(cacheEntry.data);
      return _requetesEnVol.get(cleCache);
    }

    var promesseReseau = requeteReseau("GET", chemin, undefined, 4000).then(function (donnees) {
      _requetesEnVol.delete(cleCache);
      if (donnees !== null && donnees !== undefined) {
        const ent = { data: donnees, ts: Date.now() };
        _cacheMemoire.set(cleCache, ent);
        setCachePersistant(cleCache, donnees);
      }
      return donnees;
    }).catch(function (err) {
      _requetesEnVol.delete(cleCache);
      if (cacheEntry && cacheEntry.data) {
        return cacheEntry.data;
      }
      throw err;
    });

    _requetesEnVol.set(cleCache, promesseReseau);

    // Stale-While-Revalidate : si on a déjà des données en cache, les retourner INSTANTANÉMENT (< 0.5ms)
    if (cacheEntry && cacheEntry.data && !options.bypassCache) {
      return Promise.resolve(cacheEntry.data);
    }

    return promesseReseau;
  }

  function requeteMutation(methode, chemin, corps) {
    if (chemin.indexOf("/fiscal") !== -1) invaliderCache("/fiscal");
    if (chemin.indexOf("/dossiers") !== -1) { invaliderCache("/dossiers"); invaliderCache("/tableau-bord"); }
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
    delete: function (chemin) { return requeteMutation("DELETE", chemin); },
    invaliderCache: invaliderCache,

    connecter: function (email, motDePasse) {
      _cacheMemoire.clear();
      return requeteReseau("POST", "/api/auth/connexion", { email: email, motDePasse: motDePasse }).then(function (r) {
        setSession(r.jeton, r.utilisateur);
        return r.utilisateur;
      });
    },
    setSession: setSession,
    getJeton: getJeton,
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
