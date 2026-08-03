#!/usr/bin/env bash
set -e

echo "======================================================="
echo "  Advitiyans Student 360 - AWS One-Click Deploy Script "
echo "======================================================="

# 1. Build Backend Lambda TS
echo "🚀 Step 1: Building Backend Lambda assets..."
cd backend
npm install
npm run build
cd ..

# 2. Deploy AWS CDK Stack
echo "☁️ Step 2: Deploying Infrastructure with AWS CDK..."
cd infra
npm install
npm run build
npx cdk deploy --require-approval never --outputs-file ../cdk-outputs.json
cd ..

# Extract CDK outputs
API_URL=$(node -e "const o = require('./cdk-outputs.json'); console.log(Object.values(o)[0].ApiGatewayUrl || '');")
USER_POOL_ID=$(node -e "const o = require('./cdk-outputs.json'); console.log(Object.values(o)[0].UserPoolId || '');")
CLIENT_ID=$(node -e "const o = require('./cdk-outputs.json'); console.log(Object.values(o)[0].UserPoolClientId || '');")
FRONTEND_BUCKET=$(node -e "const o = require('./cdk-outputs.json'); console.log(Object.values(o)[0].FrontendBucketName || '');")

echo "✅ Infrastructure Deployed!"
echo "   API Base URL: $API_URL"
echo "   User Pool ID: $USER_POOL_ID"
echo "   Client ID: $CLIENT_ID"

# 3. Build Frontend SPA
echo "📦 Step 3: Building Frontend web application..."
cd frontend
npm install
VITE_API_BASE_URL="$API_URL" \
VITE_COGNITO_USER_POOL_ID="$USER_POOL_ID" \
VITE_COGNITO_CLIENT_ID="$CLIENT_ID" \
npm run build
cd ..

# 4. Sync Frontend dist to S3 Bucket
if [ -n "$FRONTEND_BUCKET" ]; then
  echo "📤 Step 4: Syncing build assets to S3 bucket: $FRONTEND_BUCKET..."
  aws s3 sync frontend/dist/ "s3://$FRONTEND_BUCKET" --delete
fi

echo "======================================================="
echo "  🎉 Advitiyans Deployment Complete! Live on AWS URL  "
echo "======================================================="
