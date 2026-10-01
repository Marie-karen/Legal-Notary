/**
 * landing.js — Interactions, validation du formulaire et suivi de conversion de la landing page Legal Notary.
 * Textes centralisés pour faciliter une traduction ultérieure.
 */

// =========================================================================
// 1. DICTIONNAIRE DE TEXTES CENTRALISÉ (FR)
// =========================================================================
const TEXTES_FR = {
  hero: {
    titre: "Pilotez votre étude notariale, dossier par dossier.",
    sousTitre: "Sachez qui traite chaque dossier, à quelle étape, et soyez alerté avant qu'un délai ne glisse. Conçu pour les notaires de Côte d'Ivoire et d'Afrique francophone.",
    ctaDemo: "Demander une démo (30 min)",
    ctaWhatsapp: "Écrire sur WhatsApp",
  },
  form: {
    succes: "Merci ! Votre demande de démonstration (30 min) a bien été reçue. Un spécialiste de notre équipe vous contactera très rapidement pour convenir d'un rendez-vous.",
    erreurGenerique: "Une erreur est survenue lors de l'envoi de votre demande. Veuillez vérifier votre connexion ou nous contacter directement sur WhatsApp.",
    chargement: "Transmission en cours...",
    boutonSoumettre: "Confirmer ma demande de démo (30 min)",
  }
};

// =========================================================================
// 2. INITIALISATION & ÉVÉNEMENTS
// =========================================================================
document.addEventListener("DOMContentLoaded", function () {
  
  // 1. Gestion de l'Accordéon FAQ
  const faqQuestions = document.querySelectorAll(".faq-question");
  faqQuestions.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const item = btn.closest(".faq-item");
      const isActive = item.classList.contains("active");
      
      // Fermer les autres questions
      document.querySelectorAll(".faq-item").forEach(function (other) {
        other.classList.remove("active");
      });

      // Basculer l'élément cliqué
      if (!isActive) {
        item.classList.add("active");
      }
    });
  });

  // 2. Gestion du formulaire de demande de démonstration
  const formDemo = document.getElementById("form-demande-demo");
  const alertSucces = document.getElementById("form-alert-succes");
  const alertErreur = document.getElementById("form-alert-erreur");
  const btnSoumettre = document.getElementById("btn-soumettre-demo");

  if (formDemo) {
    formDemo.addEventListener("submit", async function (e) {
      e.preventDefault();

      if (alertSucces) alertSucces.style.display = "none";
      if (alertErreur) alertErreur.style.display = "none";

      const formData = new FormData(formDemo);
      const payload = {
        nomPrenom: formData.get("nomPrenom"),
        nomEtude: formData.get("nomEtude"),
        villePays: formData.get("villePays"),
        fonction: formData.get("fonction"),
        telephoneWhatsapp: formData.get("telephoneWhatsapp"),
        email: formData.get("email"),
        message: formData.get("message"),
        consentement: formData.get("consentement") === "on",
        website: formData.get("website"), // Champ honeypot masqué
      };

      // Si honeypot rempli, silencieux
      if (payload.website) {
        if (alertSucces) {
          alertSucces.textContent = TEXTES_FR.form.succes;
          alertSucces.style.display = "block";
        }
        formDemo.reset();
        return;
      }

      // État de chargement
      if (btnSoumettre) {
        btnSoumettre.disabled = true;
        btnSoumettre.textContent = TEXTES_FR.form.chargement;
      }

      try {
        const urlApi = (window.LEGAL_NOTARY_API_URL || "") + "/api/public/demande-demo";
        const res = await fetch(urlApi, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.erreur || TEXTES_FR.form.erreurGenerique);
        }

        // Succès : affichage de la carte d'accès VIP personnalisée
        if (alertSucces) {
          if (data.motDePasse) {
            alertSucces.innerHTML = `
              <div style="background:rgba(16,185,129,0.12);border:1px solid #10b981;border-radius:12px;padding:22px;margin-top:12px;text-align:left;color:var(--color-text)">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                  <span style="font-size:24px">🎉</span>
                  <strong style="color:#10b981;font-size:17px">Votre Espace Démo Personnel est prêt !</strong>
                </div>
                <p style="font-size:14px;color:var(--color-text-dim);margin:0 0 14px 0;line-height:1.5">
                  Un email avec vos accès officiels vient de vous être envoyé à <strong>${data.email}</strong>.
                </p>
                <div style="background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.08);padding:14px 16px;border-radius:8px;font-family:monospace;font-size:13.5px;margin-bottom:16px;line-height:1.8">
                  <div>🏛️ Office Démo : <strong>${data.nomEtude || 'Espace Notarial'}</strong></div>
                  <div>👤 Identifiant : <strong>${data.email}</strong></div>
                  <div>🔑 Mot de passe : <strong>${data.motDePasse}</strong></div>
                </div>
                <a href="/app.html?demoEmail=${encodeURIComponent(data.email)}&demoMdp=${encodeURIComponent(data.motDePasse)}" class="btn btn-primary" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px">
                  🚀 Lancer ma Démo Immédiatement
                </a>
              </div>
            `;
          } else {
            alertSucces.textContent = data.message || TEXTES_FR.form.succes;
          }
          alertSucces.style.display = "block";
        }
        formDemo.reset();

        // Événement d'analytique respectueux de la vie privée (sans cookies intrusifs)
        if (window.dataLayer && Array.isArray(window.dataLayer)) {
          window.dataLayer.push({ event: "demande_demo_envoyee" });
        }
        if (typeof window.plausible === "function") {
          window.plausible("demande_demo_envoyee");
        }

      } catch (err) {
        console.error("[Landing] Erreur soumission démo :", err);
        if (alertErreur) {
          alertErreur.textContent = err.message || TEXTES_FR.form.erreurGenerique;
          alertErreur.style.display = "block";
        }
      } finally {
        if (btnSoumettre) {
          btnSoumettre.disabled = false;
          btnSoumettre.textContent = TEXTES_FR.form.boutonSoumettre;
        }
      }
    });
  }

  // 4. Sélecteur de Fréquence Tarifaire Neuromarketing (4 Fréquences)
  const TARIFAIRE_CONFIG = {
    mensuel: {
      titre: "Formule Mensuelle Sans Engagement",
      desc: "Liberté totale de gestion, paiement mois par mois.",
      montantMois: "300 000",
      barre: "",
      badgeSaving: "0% ENGAGEMENT LIBRE",
      badgeSavingClass: "",
      detail: "Facturation mensuelle de <strong>300 000 FCFA HT</strong> prélevée chaque mois",
      pill: "Résiliation libre à tout moment",
    },
    trimestriel: {
      titre: "Formule Trimestrielle Équilibre",
      desc: "Engagement 3 mois avec première réduction de trésorerie.",
      montantMois: "275 000",
      barre: "300 000 F",
      badgeSaving: "ÉCONOMIE : 75 000 FCFA",
      badgeSavingClass: "",
      detail: "Facturation trimestrielle de <strong>825 000 FCFA HT</strong> tous les 3 mois",
      pill: "Économie de 25 000 F / mois",
    },
    semestriel: {
      titre: "Formule Semestrielle Privilège",
      desc: "Le choix optimal pour sécuriser la trésorerie de votre étude.",
      montantMois: "240 000",
      barre: "300 000 F",
      badgeSaving: "ÉCONOMIE : 360 000 FCFA",
      badgeSavingClass: "gold",
      detail: "Facturation semestrielle de <strong>1 440 000 FCFA HT</strong> tous les 6 mois",
      pill: "⭐ 1 Session Perfectionnement Clercs OFFERTE",
    },
    annuel: {
      titre: "Formule Annuelle Maître (Sérénité Totale)",
      desc: "L'investissement haute rentabilité des études notariales de référence.",
      montantMois: "200 000",
      barre: "300 000 F",
      badgeSaving: "👑 ÉCONOMIE GÉANTE : 1 200 000 FCFA",
      badgeSavingClass: "green",
      detail: "Facturation annuelle de <strong>2 400 000 FCFA HT</strong> par an",
      pill: "🎁 Setup & Nom de Domaine .CI OFFERTS (Valeur 1 850 000 F)",
    },
  };

  const tabBtns = document.querySelectorAll(".pricing-tab-btn");
  const planTitle = document.getElementById("pricing-plan-title");
  const planDesc = document.getElementById("pricing-plan-desc");
  const strikethrough = document.getElementById("pricing-strikethrough");
  const mainAmount = document.getElementById("pricing-main-amount");
  const savingBadge = document.getElementById("pricing-saving-badge");
  const billingDetail = document.getElementById("pricing-billing-detail");
  const pillText = document.getElementById("pricing-pill-text");

  tabBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const freq = btn.getAttribute("data-freq");
      const cfg = TARIFAIRE_CONFIG[freq];
      if (!cfg) return;

      tabBtns.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");

      if (planTitle) planTitle.textContent = cfg.titre;
      if (planDesc) planDesc.textContent = cfg.desc;
      if (mainAmount) mainAmount.textContent = cfg.montantMois;
      if (strikethrough) {
        strikethrough.textContent = cfg.barre;
        strikethrough.style.display = cfg.barre ? "inline" : "none";
      }
      if (savingBadge) {
        savingBadge.textContent = cfg.badgeSaving;
        savingBadge.className = "tab-badge-saving " + (cfg.badgeSavingClass || "");
      }
      if (billingDetail) billingDetail.innerHTML = cfg.detail;
      if (pillText) pillText.textContent = cfg.pill;
    });
  });

});
