const test = require("node:test");
const assert = require("node:assert/strict");
const agendaService = require("../src/services/agenda.service");

test("agendaService — création et liste d'un rendez-vous", async () => {
  const utilisateur = { id: "notaire-test-01", nom: "Notaire Test", role: "notaire", etudeId: "etude-test-01" };
  const rdv = await agendaService.creerEvenement({
    titre: "Signature Vente Test",
    typeRdv: "signature_acte",
    salle: "Salle 1",
    clientNom: "M. KOUASSI",
    clientTelephone: "+22501020304",
    dateDebut: new Date(Date.now() + 3600000).toISOString(),
    dateFin: new Date(Date.now() + 7200000).toISOString(),
  }, utilisateur);

  assert.ok(rdv.id);
  assert.equal(rdv.titre, "Signature Vente Test");
  assert.equal(rdv.typeRdv, "signature_acte");

  const liste = await agendaService.listerEvenements({ etudeId: "etude-test-01" }, utilisateur);
  assert.ok(liste.length >= 1);
  const trouve = liste.find((e) => e.id === rdv.id);
  assert.ok(trouve);
  assert.equal(trouve.salle, "Salle 1");
});

test("agendaService — mise à jour et suppression d'un événement", async () => {
  const utilisateur = { id: "assistante-test-01", nom: "Assistante", role: "assistante", etudeId: "etude-test-01" };
  const rdv = await agendaService.creerEvenement({
    titre: "Conseil initial",
    typeRdv: "consultation_client",
    salle: "Bureau Assistante",
  }, utilisateur);

  const maj = await agendaService.mettreAJourEvenement(rdv.id, {
    titre: "Conseil initial (Reporté)",
    salle: "Bureau du Notaire",
  }, utilisateur);

  assert.equal(maj.titre, "Conseil initial (Reporté)");
  assert.equal(maj.salle, "Bureau du Notaire");

  const suppr = await agendaService.supprimerEvenement(rdv.id);
  assert.equal(suppr.succes, true);
});

test("agendaService — cycle de vie des tâches To-Do list", async () => {
  const utilisateur = { id: "clerc-test-01", nom: "Clerc Rédacteur", role: "clerc_redacteur", etudeId: "etude-test-01" };
  const tache = await agendaService.creerTache({
    titre: "Rédiger le projet d'hypothèque",
    numeroDossier: "2024-HYP-0099",
    priorite: "haute",
  }, utilisateur);

  assert.ok(tache.id);
  assert.equal(tache.statut, "a_faire");

  const basculee = await agendaService.basculerTache(tache.id);
  assert.equal(basculee.statut, "termine");
  assert.ok(basculee.completeLe);

  const rebasculee = await agendaService.basculerTache(tache.id);
  assert.equal(rebasculee.statut, "a_faire");
  assert.equal(rebasculee.completeLe, null);

  const suppr = await agendaService.supprimerTache(tache.id);
  assert.equal(suppr.succes, true);
});
