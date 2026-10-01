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
  
  // 0. Gestion du Menu Mobile Drawer
  const btnMobileMenu = document.getElementById("btn-mobile-menu");
  const btnCloseDrawer = document.getElementById("btn-close-drawer");
  const mobileDrawer = document.getElementById("mobile-drawer");
  const mobileOverlay = document.getElementById("mobile-overlay");
  const drawerLinks = document.querySelectorAll(".drawer-link");

  function openMobileMenu() {
    if (mobileDrawer) mobileDrawer.classList.add("open");
    if (mobileOverlay) mobileOverlay.style.display = "block";
    document.body.style.overflow = "hidden";
  }

  function closeMobileMenu() {
    if (mobileDrawer) mobileDrawer.classList.remove("open");
    if (mobileOverlay) mobileOverlay.style.display = "none";
    document.body.style.overflow = "";
  }

  if (btnMobileMenu) btnMobileMenu.addEventListener("click", openMobileMenu);
  if (btnCloseDrawer) btnCloseDrawer.addEventListener("click", closeMobileMenu);
  if (mobileOverlay) mobileOverlay.addEventListener("click", closeMobileMenu);
  drawerLinks.forEach(function (link) {
    link.addEventListener("click", closeMobileMenu);
  });

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

        // Succès : affichage de la carte d'accès personnalisée
        if (alertSucces) {
          if (data.motDePasse) {
            alertSucces.innerHTML = `
              <div style="background:rgba(26,63,160,0.06);border:1px solid #1A3FA0;border-radius:12px;padding:22px;margin-top:12px;text-align:left;color:var(--text-main)">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                  <strong style="color:#1A3FA0;font-size:16px">Votre Espace Démo Personnel est prêt</strong>
                </div>
                <p style="font-size:14px;color:var(--text-muted);margin:0 0 14px 0;line-height:1.5">
                  Un email avec vos accès officiels vient de vous être envoyé à <strong>${data.email}</strong>.
                </p>
                <div style="background:#F8FAFC;border:1px solid #CBD5E1;padding:14px 16px;border-radius:8px;font-family:monospace;font-size:13.5px;margin-bottom:16px;line-height:1.8;color:#0F172A">
                  <div>Office Démo : <strong>${data.nomEtude || 'Étude Notariale'}</strong></div>
                  <div>Identifiant : <strong>${data.email}</strong></div>
                  <div>Mot de passe : <strong>${data.motDePasse}</strong></div>
                </div>
                <a href="/app.html?demoEmail=${encodeURIComponent(data.email)}&demoMdp=${encodeURIComponent(data.motDePasse)}" class="btn btn-primary" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px">
                  Accéder à mon Espace Notarial
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

  // 4. Sélecteur de Fréquence Tarifaire (4 Fréquences)
  const TARIFAIRE_CONFIG = {
    mensuel: {
      titre: "Formule Mensuelle Sans Engagement",
      desc: "Liberté totale de gestion, paiement mois par mois.",
      montantMois: "300 000",
      barre: "",
      badgeSaving: "ENGAGEMENT MENSUEL",
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
      pill: "1 Session Perfectionnement Clercs Inclus",
    },
    annuel: {
      titre: "Formule Annuelle Sérénité Totale",
      desc: "L'investissement haute rentabilité des études notariales de référence.",
      montantMois: "200 000",
      barre: "300 000 F",
      badgeSaving: "ÉCONOMIE : 1 200 000 FCFA",
      badgeSavingClass: "green",
      detail: "Facturation annuelle de <strong>2 400 000 FCFA HT</strong> par an",
      pill: "Déploiement complet & Accompagnement Inclus",
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

  // 5. Simulateur Dynamique de ROI Notarial (Impact Budgétaire & Trésorerie)
  const roiSlider = document.getElementById("roi-clerks-slider");
  const roiClerksDisplay = document.getElementById("roi-clerks-display");
  const roiTradCost = document.getElementById("roi-traditional-cost");
  const roiLnCost = document.getElementById("roi-ln-cost");
  const roiSavings = document.getElementById("roi-savings");
  const roiHoursSaved = document.getElementById("roi-hours-saved");

  function formatFCFA(montant) {
    return montant.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
  }

  function updateROICalculator() {
    if (!roiSlider) return;
    const n = parseInt(roiSlider.value, 10) || 6;
    if (roiClerksDisplay) roiClerksDisplay.textContent = n;

    // Coût traditionnel annuel estimé : 2.800.000 F (serveur physique lourd & maintenance) + (N * 350.000 F / poste)
    const coutTraditionnel = 2800000 + (n * 350000);
    // Coût Legal Notary annuel tout inclus (formule 200.000 F/mois)
    const coutLegalNotary = 2400000;
    const economie = coutTraditionnel - coutLegalNotary;
    const heuresEconomisees = n * 25;

    if (roiTradCost) roiTradCost.textContent = formatFCFA(coutTraditionnel);
    if (roiLnCost) roiLnCost.textContent = formatFCFA(coutLegalNotary);
    if (roiSavings) roiSavings.textContent = "+" + formatFCFA(economie) + " / an";
    if (roiHoursSaved) roiHoursSaved.textContent = "Soit ~" + heuresEconomisees + "h administratives libérées / mois";
  }

  if (roiSlider) {
    roiSlider.addEventListener("input", updateROICalculator);
    updateROICalculator();
  }

});

