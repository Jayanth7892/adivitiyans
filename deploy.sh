#!/usr/bin/env bash
set -e

echo "======================================================="
echo "  Advitiyans Student 360 - AWS One-Click Deploy Script "
echo "======================================================="

# 1. Build Backend Lambda TS
echo "ðŸš€ Step 1: Building Backend Lambda assets..."
cd backend
npm install
npm run build
cd ..

# 2. Deploy AWS CDK Stack
echo "â˜ï¸ Step 2: Deploying Infrastructure with AWS CDK..."
cd infra
npm install
npm run build
# Admin credential secrets are passed from GitHub Secrets â†’ CDK â†’ Lambda env vars
ADMIN_MASTER_EMAIL="${ADMIN_MASTER_EMAIL:-admin@rgmcet.edu.in}" \
ADMIN_MASTER_PASS="${ADMIN_MASTER_PASS:-}" \
HOD_MASTER_EMAIL="${HOD_MASTER_EMAIL:-hodcseds@rgmcet.edu.in}" \
HOD_MASTER_PASS="${HOD_MASTER_PASS:-}" \
ADMIN_SECRET="${ADMIN_SECRET:-}" \
FACULTY_SECRET_KEY="${FACULTY_SECRET_KEY:-}" \
npm run cdk -- deploy --require-approval never --outputs-file ../cdk-outputs.json
cd ..

# Extract CDK outputs
API_URL=$(node -e "const o = require('./cdk-outputs.json'); console.log(Object.values(o)[0].ApiGatewayUrl || '');")
USER_POOL_ID=$(node -e "const o = require('./cdk-outputs.json'); console.log(Object.values(o)[0].UserPoolId || '');")
CLIENT_ID=$(node -e "const o = require('./cdk-outputs.json'); console.log(Object.values(o)[0].UserPoolClientId || '');")
FRONTEND_BUCKET=$(node -e "const o = require('./cdk-outputs.json'); console.log(Object.values(o)[0].FrontendBucketName || '');")
CLOUDFRONT_URL=$(node -e "const o = require('./cdk-outputs.json'); console.log(Object.values(o)[0].CloudFrontUrl || '');")
DISTRIBUTION_ID=$(node -e "const o = require('./cdk-outputs.json'); console.log(Object.values(o)[0].CloudFrontDistributionId || '');")

echo "âœ… Infrastructure Deployed!"
echo "   API Base URL: $API_URL"
echo "   CloudFront HTTPS URL: $CLOUDFRONT_URL"
echo "   CloudFront Distribution ID: $DISTRIBUTION_ID"
echo "   User Pool ID: $USER_POOL_ID"
echo "   Client ID: $CLIENT_ID"

# 3. Initialize Database Schema & Seed Data
echo "ðŸ—„ï¸ Step 3: Initializing AWS RDS PostgreSQL Schema & Seed Data..."
cd backend
npm run db:init || echo "âš ï¸ Database schema initialization skipped or will run via Lambda/SSM."
cd ..

# 4. Build Frontend SPA
echo "ðŸ“¦ Step 4: Building Frontend web application..."
cd frontend
npm install
VITE_API_BASE_URL="$API_URL" \
VITE_COGNITO_USER_POOL_ID="$USER_POOL_ID" \
VITE_COGNITO_CLIENT_ID="$CLIENT_ID" \
npm run build
cd ..

# 5. Sync Frontend dist to S3 Bucket & Invalidate CloudFront CDN
if [ -n "$FRONTEND_BUCKET" ]; then
  echo "ðŸ“¤ Step 5: Syncing build assets to S3 bucket: $FRONTEND_BUCKET..."
  aws s3 sync frontend/dist/ "s3://$FRONTEND_BUCKET" --delete --cache-control "max-age=0,no-cache,no-store,must-revalidate"
fi

if [ -n "$DISTRIBUTION_ID" ]; then
  echo "ðŸ”„ Step 6: Invalidating CloudFront edge cache (Distribution: $DISTRIBUTION_ID)..."
  aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" || echo "âš ï¸ CloudFront invalidation skipped"
fi

echo "======================================================="
echo "  ðŸŽ‰ Advitiyans Deployment Complete! Live on AWS URL  "
echo "======================================================="
