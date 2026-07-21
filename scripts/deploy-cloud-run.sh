#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-repairsync-sms}"
PROJECT_ID="${PROJECT_ID:-gen-lang-client-0477801246}"
REGION="${REGION:-asia-southeast1}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Missing PROJECT_ID. Example: PROJECT_ID=my-gcp-project"
  exit 1
fi

echo "Deploying to Cloud Run..."
echo "  Project: $PROJECT_ID"
echo "  Region:  $REGION"
echo "  Service: $SERVICE_NAME"

gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION"
