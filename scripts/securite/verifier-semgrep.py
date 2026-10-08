#!/usr/bin/env python3
"""
scripts/securite/verifier-semgrep.py

Chaîne de contrôle automatique — Étape C0 (Section 15 bis C & D)
Compare le rapport JSON généré par Semgrep avec la baseline de référence (semgrep-baseline.json).
Bloque (code 1) en cas de NOUVELLE alerte de gravité élevée (ERROR / HIGH) non répertoriée dans la baseline.
"""

import sys
import json
import os

def normaliser_chemin(p):
    if not p:
        return ""
    return p.replace("\\", "/").lstrip("./")

def verifier(chemin_rapport, chemin_baseline):
    if not os.path.exists(chemin_rapport):
        print(f"❌ [verifier-semgrep] Rapport Semgrep introuvable : {chemin_rapport}")
        sys.exit(1)

    try:
        with open(chemin_rapport, "r", encoding="utf-8") as f:
            rapport = json.load(f)
    except Exception as e:
        print(f"❌ [verifier-semgrep] Erreur lors de la lecture du rapport Semgrep : {e}")
        sys.exit(1)

    resultats = rapport.get("results", [])
    print("--------------------------------------------------------------------------------")
    print(f"🔍 CONTRÔLE SEMGREP DIFFÉRENTIEL CONTRE BASELINE (C0)")
    print(f"ℹ️ {len(resultats)} alerte(s) totale(s) détectée(s) par Semgrep.")
    print("--------------------------------------------------------------------------------")

    baseline_data = {}
    if os.path.exists(chemin_baseline):
        try:
            with open(chemin_baseline, "r", encoding="utf-8") as f:
                baseline_data = json.load(f)
        except Exception as e:
            print(f"⚠️ [verifier-semgrep] Erreur lors de la lecture de la baseline : {e}")
            baseline_data = {}

    connus = set()
    for item in baseline_data.get("known_rules", []):
        cid = item.get("check_id")
        cpath = normaliser_chemin(item.get("path", ""))
        connus.add((cid, cpath))

    nouvelles_alertes_elevees = []
    nouvelles_alertes_autres = []
    alertes_baseline_detectees = 0

    for r in resultats:
        check_id = r.get("check_id")
        rpath = normaliser_chemin(r.get("path", ""))
        line = r.get("start", {}).get("line", "?")
        extra = r.get("extra", {})
        severity = str(extra.get("severity", "WARNING")).upper()
        message = extra.get("message", "").strip().split("\n")[0]

        cle = (check_id, rpath)
        if cle in connus:
            alertes_baseline_detectees += 1
        else:
            alerte = {
                "check_id": check_id,
                "path": rpath,
                "line": line,
                "severity": severity,
                "message": message
            }
            if severity in ("ERROR", "HIGH"):
                nouvelles_alertes_elevees.append(alerte)
            else:
                nouvelles_alertes_autres.append(alerte)

    print(f"• Alertes connues de référence (baseline) confirmées : {alertes_baseline_detectees}")

    if nouvelles_alertes_autres:
        print(f"• Nouvelles alertes de gravité moyenne/faible (non bloquantes) : {len(nouvelles_alertes_autres)}")
        for a in nouvelles_alertes_autres:
            print(f"    - [{a['severity']}] {a['path']}:{a['line']} ({a['check_id']})")

    if nouvelles_alertes_elevees:
        print("\n================================================================================")
        print("❌ ÉCHEC DU CONTRÔLE SEMGREP : NOUVELLE(S) ALERTE(S) DE GRAVITÉ ÉLEVÉE")
        print("================================================================================")
        for a in nouvelles_alertes_elevees:
            print(f"  - [{a['severity']}] {a['path']}:{a['line']} ({a['check_id']})")
            print(f"    Message: {a['message']}")
        print("================================================================================")
        print(f"Total : {len(nouvelles_alertes_elevees)} nouvelle(s) alerte(s) de gravité élevée.")
        print("Résolvez ces failles de sécurité avant toute fusion dans main.")
        print("================================================================================\n")
        sys.exit(1)

    print("✅ Contrôle Semgrep réussi : aucune nouvelle alerte de gravité élevée introduite.")
    sys.exit(0)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 verifier-semgrep.py <semgrep-rapport.json> <semgrep-baseline.json>")
        sys.exit(1)
    verifier(sys.argv[1], sys.argv[2])
