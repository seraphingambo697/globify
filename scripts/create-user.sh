#!/usr/bin/env bash
# Crée un utilisateur déjà confirmé, avec un rôle (sans email de vérification).
# Utilisation : ./scripts/create-user.sh <email> <mot_de_passe> <admin|editor|guest_author>
# Exemple     : ./scripts/create-user.sh admin@example.com 'Admin1234' admin
set -euo pipefail

EMAIL="${1:?email manquant}"
PASSWORD="${2:?mot de passe manquant}"
ROLE="${3:?rôle manquant (admin, editor ou guest_author)}"

cd "$(dirname "$0")/.."
source scripts/env.sh "${STACK:-blogify-dev}" > /dev/null

aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" \
  --username "$EMAIL" \
  --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
  --message-action SUPPRESS > /dev/null

aws cognito-idp admin-set-user-password \
  --user-pool-id "$POOL_ID" \
  --username "$EMAIL" \
  --password "$PASSWORD" \
  --permanent

aws cognito-idp admin-add-user-to-group \
  --user-pool-id "$POOL_ID" \
  --username "$EMAIL" \
  --group-name "$ROLE"

echo "Utilisateur $EMAIL créé avec le rôle $ROLE"