#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DE DÉPLOIEMENT AUTOMATISÉ POUR HOSTINGER VPS (UBUNTU 22.04 / 24.04 LTS)
# LEGAL NOTARY ERP — ARCHITECTURE MULTI-ÉTUDES & HAUTE DISPONIBILITÉ
# ==============================================================================

set -e

echo "🚀 [1/6] Mise à jour du système Ubuntu..."
sudo apt update -y && sudo apt upgrade -y
sudo apt install -y curl wget git ufw nginx certbot python3-certbot-nginx build-essential postgresql postgresql-contrib

echo "📦 [2/6] Installation de Node.js v20 LTS et PM2..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

echo "🐘 [3/6] Configuration de PostgreSQL..."
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Création de l'utilisateur et de la base de données de production si inexistants
sudo -u postgres psql -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'legalnotary_user') THEN CREATE USER legalnotary_user WITH PASSWORD 'LegalNotarySecurise2026!'; END IF; END \$\$;"
sudo -u postgres psql -c "SELECT 'CREATE DATABASE legalnotary_db OWNER legalnotary_user' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'legalnotary_db')\gexec"

echo "📂 [4/6] Création des répertoires de stockage cloisonnés par Étude..."
sudo mkdir -p /var/data/legalnotary/uploads
sudo mkdir -p /var/data/legalnotary/sauvegardes
sudo chown -R www-data:www-data /var/data/legalnotary
sudo chmod -R 775 /var/data/legalnotary

echo "🌐 [5/6] Configuration du Firewall UFW..."
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable

echo "⚙️ [6/6] Configuration de Nginx pour le Multi-Domaines..."
sudo cp deploiement/nginx-multi-etudes.conf /etc/nginx/sites-available/legalnotary
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/legalnotary /etc/nginx/sites-enabled/legalnotary
sudo nginx -t
sudo systemctl reload nginx

echo "✅ =================================================================="
echo "✅ INSTALLATION DU VPS TERMINÉE AVEC SUCCÈS !"
echo "✅ Pour lancer l'application en arrière-plan :"
echo "   cd /var/www/legal-notary/legal-notary-server && pm2 start src/server.js --name legal-notary"
echo "   pm2 save && pm2 startup"
echo "✅ =================================================================="
