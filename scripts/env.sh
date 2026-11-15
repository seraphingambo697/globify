#!/usr/bin/env bash
# Charge les sorties de la stack dans des variables du terminal.
# Utilisation (avec "source", sinon les variables disparaissent) :
#   source scripts/env.sh              -> stack blogify-dev
#   source scripts/env.sh blogify-prod -> autre stack

STACK="${1:-blogify-dev}"

_output() {
  aws cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

export API="$(_output ApiUrl)"
export POOL_ID="$(_output UserPoolId)"
export CLIENT_ID="$(_output UserPoolClientId)"
export BUCKET="$(_output MediaBucketName)"
export TOPIC_ARN="$(_output NewPostTopicArn)"

echo "Stack     : $STACK"
echo "API       : $API"
echo "POOL_ID   : $POOL_ID"
echo "CLIENT_ID : $CLIENT_ID"
echo "BUCKET    : $BUCKET"