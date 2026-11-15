#!/usr/bin/env bash
# Test de bout en bout de l'API déployée.
# Crée 2 utilisateurs temporaires, teste toutes les fonctionnalités, puis nettoie.
# Prérequis : jq (sudo apt install -y jq)
# Utilisation : ./scripts/smoke-test.sh
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1
source scripts/env.sh "${STACK:-blogify-dev}" > /dev/null

PASS=0
FAIL=0
TMP_BODY="$(mktemp)"
TMP_PNG="$(mktemp --suffix=.png)"

check() { # description attendu obtenu
  if [ "$2" == "$3" ]; then
    echo "✅ $1"; PASS=$((PASS + 1))
  else
    echo "❌ $1 (attendu: $2, obtenu: $3)"; FAIL=$((FAIL + 1))
  fi
}

# req METHODE CHEMIN [TOKEN] [JSON]  -> remplit $STATUS et $BODY
req() {
  local method=$1 path=$2 token=${3:-} data=${4:-}
  local args=(-s -o "$TMP_BODY" -w '%{http_code}' -X "$method" "$API$path" -H 'Content-Type: application/json')
  [ -n "$token" ] && args+=(-H "Authorization: $token")
  [ -n "$data" ] && args+=(-d "$data")
  STATUS=$(curl "${args[@]}")
  BODY=$(cat "$TMP_BODY")
}

TS=$(date +%s)
EDITOR_EMAIL="editor.$TS@example.com"
GUEST_EMAIL="guest.$TS@example.com"
PASSWORD='Test1234'

cleanup() {
  aws cognito-idp admin-delete-user --user-pool-id "$POOL_ID" --username "$EDITOR_EMAIL" 2>/dev/null
  aws cognito-idp admin-delete-user --user-pool-id "$POOL_ID" --username "$GUEST_EMAIL" 2>/dev/null
  rm -f "$TMP_BODY" "$TMP_PNG"
}
trap cleanup EXIT

echo "== Préparation des utilisateurs de test =="
./scripts/create-user.sh "$EDITOR_EMAIL" "$PASSWORD" editor > /dev/null
./scripts/create-user.sh "$GUEST_EMAIL" "$PASSWORD" guest_author > /dev/null

echo "== Système =="
req GET /health;                               check "GET /health public" 200 "$STATUS"
req GET /me;                                   check "GET /me sans token refusé" 401 "$STATUS"

echo "== Authentification =="
req POST /auth/login "" "{\"email\":\"$EDITOR_EMAIL\",\"password\":\"$PASSWORD\"}"
check "Connexion éditeur" 200 "$STATUS"
EDITOR_TOKEN=$(echo "$BODY" | jq -r .idToken)
req POST /auth/login "" "{\"email\":\"$GUEST_EMAIL\",\"password\":\"$PASSWORD\"}"
check "Connexion auteur invité" 200 "$STATUS"
GUEST_TOKEN=$(echo "$BODY" | jq -r .idToken)
req POST /auth/login "" "{\"email\":\"$GUEST_EMAIL\",\"password\":\"Mauvais1\"}"
check "Mauvais mot de passe refusé" 401 "$STATUS"
req GET /me "$GUEST_TOKEN"
check "GET /me renvoie le rôle" true "$(echo "$BODY" | jq '.groups | index("guest_author") != null')"

echo "== Articles =="
req POST /posts "$GUEST_TOKEN" '{"title":"Introduction au serverless","content":"AWS Lambda exécute du code sans serveur.","tags":["aws","serverless"]}'
check "Auteur invité crée un brouillon" 201 "$STATUS"
POST_ID=$(echo "$BODY" | jq -r .id)
req POST /posts "$GUEST_TOKEN" '{"title":"x","content":"y","status":"published"}'
check "Auteur invité ne peut pas publier" 403 "$STATUS"
req POST /posts "$GUEST_TOKEN" '{"title":"sans contenu"}'
check "Validation : contenu manquant" 400 "$STATUS"
req GET "/posts/$POST_ID"
check "Brouillon invisible au public" 404 "$STATUS"
req GET /manage/posts "$GUEST_TOKEN"
check "Espace de gestion : l'auteur voit son brouillon" true "$(echo "$BODY" | jq --arg id "$POST_ID" '[.items[].id] | index($id) != null')"
req PUT "/posts/$POST_ID" "$GUEST_TOKEN" '{"content":"AWS Lambda exécute du code sans gérer de serveur."}'
check "Auteur invité modifie son brouillon" 200 "$STATUS"
req PUT "/posts/$POST_ID" "$EDITOR_TOKEN" '{"status":"published"}'
check "Éditeur publie l'article" 200 "$STATUS"
req PUT "/posts/$POST_ID" "$GUEST_TOKEN" '{"title":"modif interdite"}'
check "Auteur invité ne modifie plus un article publié" 403 "$STATUS"

sleep 2 # les index DynamoDB sont mis à jour en quelques millisecondes à secondes
req GET "/posts/$POST_ID"
check "Article publié visible" 200 "$STATUS"
req GET /posts
check "Article présent dans la liste" true "$(echo "$BODY" | jq --arg id "$POST_ID" '[.items[].id] | index($id) != null')"
req GET "/posts?tag=serverless"
check "Filtre par tag" true "$(echo "$BODY" | jq --arg id "$POST_ID" '[.items[].id] | index($id) != null')"

echo "== Recherche =="
req GET "/search?q=serverless"
check "Recherche par mot-clé" true "$(echo "$BODY" | jq --arg id "$POST_ID" '[.items[].id] | index($id) != null')"
req GET /search
check "Recherche sans paramètre refusée" 400 "$STATUS"

echo "== Commentaires et modération =="
req POST "/posts/$POST_ID/comments" "" '{"authorName":"Lecteur","content":"Très clair, merci !"}'
check "Lecteur commente (sans compte)" 201 "$STATUS"
COMMENT_ID=$(echo "$BODY" | jq -r .id)
req GET "/posts/$POST_ID/comments"
check "Commentaire non visible avant modération" 0 "$(echo "$BODY" | jq '.items | length')"
req GET /comments/pending "$GUEST_TOKEN"
check "Auteur invité ne peut pas modérer" 403 "$STATUS"
req GET /comments/pending "$EDITOR_TOKEN"
check "Éditeur voit la file de modération" 200 "$STATUS"
req PATCH "/posts/$POST_ID/comments/$COMMENT_ID" "$EDITOR_TOKEN" '{"status":"approved"}'
check "Éditeur approuve le commentaire" 200 "$STATUS"
req GET "/posts/$POST_ID/comments"
check "Commentaire visible après approbation" 1 "$(echo "$BODY" | jq '.items | length')"

echo "== Médias =="
req POST /media/upload-url "$GUEST_TOKEN" '{"contentType":"image/png"}'
check "Obtenir une URL d'envoi" 200 "$STATUS"
UPLOAD_URL=$(echo "$BODY" | jq -r .uploadUrl)
MEDIA_KEY=$(echo "$BODY" | jq -r .key)
echo 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' | base64 -d > "$TMP_PNG"
S3_STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X PUT -H 'Content-Type: image/png' --data-binary @"$TMP_PNG" "$UPLOAD_URL")
check "Envoi direct du fichier vers S3" 200 "$S3_STATUS"
req GET "/media/$MEDIA_KEY"
check "Lecture du média (redirection)" 302 "$STATUS"
req POST /media/upload-url "$GUEST_TOKEN" '{"contentType":"application/x-msdownload"}'
check "Type de fichier interdit refusé" 400 "$STATUS"

echo "== Abonnements =="
req POST /subscribe "" '{"email":"pas-un-email"}'
check "Email d'abonnement invalide refusé" 400 "$STATUS"

echo "== Suppression =="
req DELETE "/posts/$POST_ID" "$GUEST_TOKEN"
check "Auteur invité ne supprime pas un article publié" 403 "$STATUS"
req DELETE "/posts/$POST_ID" "$EDITOR_TOKEN"
check "Éditeur supprime l'article" 204 "$STATUS"
req GET "/posts/$POST_ID"
check "Article supprimé introuvable" 404 "$STATUS"
aws s3 rm "s3://$BUCKET/$MEDIA_KEY" > /dev/null

echo
echo "Résultat : $PASS réussis, $FAIL échoués"
[ "$FAIL" -eq 0 ]