/**
 * tests/importer-referentiel.test.js — Tests du classement des tâches
 * importées (étape du pipeline, caractère bloquant, détection taxe
 * foncière). Voir scripts/importer-referentiel.js pour le raisonnement.
 *
 * Le test le plus important n'est pas les cas unitaires (faciles à
 * satisfaire en trichant) mais la vérification de bout en bout sur les
 * VRAIES données du cabinet (seed/etude1_catalogue.json) : aucune tâche
 * réelle ne doit retomber sur le repli par défaut (étape 3) sauf si elle
 * contient vraiment "rédaction" — sinon c'est le signe qu'un libellé réel
 * n'est couvert par aucun mot-clé.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const { classifierEtape, detecteTaxeFonciere, estBloquante, normaliser } = require("../scripts/importer-referentiel");

test("classifierEtape — cas de référence sur les libellés réels du cabinet", () => {
  const cas = [
    ["Collecte d'informations", 1],
    ["Réquisition", 2],
    ["Retrait état foncier", 2],
    ["Vérification authenticité (pieces d'identité, extrait de naissance)", 2],
    ["Rédaction de l'acte", 3],
    ["Signature de l'acte", 4],
    ["Dépôt à la Conservation foncière", 5],
    ["Enregistrement et retrait de la minute enregistrée", 5],
    ["Mutation au livre foncier", 5],
    ["Délivrance de l'expédition et copie", 6],
    ["Délivrance de l'attestation domaniale", 5],
    ["Transmission de pièces aux clients", 6],
  ];
  for (const [libelle, attendu] of cas) {
    assert.equal(classifierEtape(libelle), attendu, `"${libelle}" devrait être étape ${attendu}`);
  }
});

test("detecteTaxeFonciere — vrai si une tâche mentionne une inscription/mutation foncière", () => {
  assert.equal(detecteTaxeFonciere([{ libelle: "Mutation au livre foncier" }]), true);
  assert.equal(detecteTaxeFonciere([{ libelle: "Collecte d'informations" }]), false);
});

test("estBloquante — collecte, rédaction et signature sont bloquantes ; le reste non par défaut", () => {
  assert.equal(estBloquante("Collecte d'informations"), true);
  assert.equal(estBloquante("Rédaction de l'acte"), true);
  assert.equal(estBloquante("Signature de l'acte"), true);
  assert.equal(estBloquante("Dépôt à la conservation foncière"), false);
});

test("classement — aucune tâche réelle du cabinet ne tombe sur le repli par défaut sans raison", () => {
  const cheminEtude1 = path.join(__dirname, "..", "seed", "etude1_catalogue.json");
  const actes = JSON.parse(fs.readFileSync(cheminEtude1, "utf-8"));
  const nonClassifiees = [];
  for (const acte of actes) {
    for (const tache of acte.taches) {
      const etape = classifierEtape(tache.libelle);
      const contientRedaction = normaliser(tache.libelle).includes("redaction");
      if (etape === 3 && !contientRedaction) {
        nonClassifiees.push(`${acte.libelle} / ${tache.libelle}`);
      }
    }
  }
  assert.deepEqual(nonClassifiees, [], "des tâches réelles retombent sur le repli par défaut (étape 3) sans contenir 'rédaction'");
});
