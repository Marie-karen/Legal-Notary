#!/usr/bin/env bash
# sauvegarder.sh — sauvegarde quotidienne de la base PostgreSQL du
# cabinet. Aucun dossier n'est jamais supprimé physiquement dans
# l'application (voir docs/ARCHITECTURE.md), mais cela ne protège pas
# d'une panne matérielle du serveur — cette sauvegarde si.
#
# Installation (une fois) :
#   1. Adapter DOSSIER_SAUVEGARDES ci-dessous — idéalement un disque ou
#      un stockage SÉPARÉ de ce serveur (clé USB montée, disque réseau,
#      espace de stockage cloud du cabinet...). Une sauvegarde sur le
#      même disque que la base ne protège pas d'une panne de ce disque.
#   2. chmod +x sauvegarder.sh
#   3. Programmer son exécution quotidienne — voir crontab.exemple dans
#      ce même dossier.
#
# Restauration en cas de besoin :
#   gunzip -c sauvegarde-2026-08-25.sql.gz | psql "$DATABASE_URL"

set -euo pipefail

DOSSIER_PROJET="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOSSIER_SAUVEGARDES="/chemin/vers/sauvegardes-legalnotary"
CONSERVER_JOURS=30

# Charge DATABASE_URL depuis .env sans exposer les autres variables.
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$DOSSIER_PROJET/.env" | cut -d '=' -f2-)"
if [ -z "$DATABASE_URL" ]; then
  echo "[sauvegarder.sh] DATABASE_URL introuvable dans $DOSSIER_PROJET/.env — abandon." >&2
  exit 1
fi

mkdir -p "$DOSSIER_SAUVEGARDES"
HORODATAGE="$(date +%F-%Hh%M)"
FICHIER="$DOSSIER_SAUVEGARDES/legalnotary-$HORODATAGE.sql.gz"

pg_dump "$DATABASE_URL" | gzip > "$FICHIER"
echo "[sauvegarder.sh] sauvegarde écrite : $FICHIER ($(du -h "$FICHIER" | cut -f1))"

# Supprime les sauvegardes plus vieilles que CONSERVER_JOURS, pour ne pas
# remplir le disque indéfiniment.
find "$DOSSIER_SAUVEGARDES" -name 'legalnotary-*.sql.gz' -mtime +"$CONSERVER_JOURS" -delete
