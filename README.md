# Advitiyans — Student 360° & Placement Readiness Platform (AWS)

**Advitiyans** is a full-stack, serverless web application built for higher education institutions (RGMCET). It enables students to track academics, technical skills, coding profiles (GitHub, LeetCode, HackerRank, Kaggle), certifications, soft skills, achievements, and real-time employability scoring.

---

## 🏗️ Architecture Overview

```
React (Vite + TypeScript + Tailwind CSS)
        │
        ▼
   S3 Bucket ── served via ── CloudFront CDN (HTTPS)
        │
        ▼ API Calls (Cognito JWT)
  Amazon API Gateway (REST API)
        │
        ▼
  AWS Lambda (Node.js 20.x, Express Router)
        │
        ▼
  Amazon RDS PostgreSQL (db.t4g.micro, Single-AZ)
  + Amazon Cognito User Pool (with Pre Sign-Up Validation Trigger)
  + Amazon S3 Bucket (Pre-signed file upload URLs)
```

---

## 📁 Repository Monorepo Structure

- `/frontend` — React 18 + Vite + TypeScript + Tailwind CSS SPA with Sidebar shell, `/login` (Student self-signup & exact regex rules, Faculty/Admin stubs), `/dashboard` (60/40 layout, completion ring, radar skill chart, recent achievements, announcements, prompt nudge cards), `/profile` (8 read/write tabs).
- `/backend` — Node.js 20.x Lambda API, Zod validation, PostgreSQL client, Cognito Pre Sign-Up validation trigger (`cognito-pre-signup.ts`), and weighted employability score calculator engine.
- `/infra` — AWS CDK v2 TypeScript project provisioning VPC, RDS PostgreSQL, Cognito, API Gateway, S3, CloudFront, Secrets Manager, and IAM roles.
- `schema.sql` — PostgreSQL DDL with unique constraints, regex format checks (`^\d{5}[A-Za-z]32\d{2}$`), indexes, and realistic seed data for 5 sample students.
- `deploy.sh` — Automated build & deployment script for AWS.

---

## ⚡ Local Development Setup

### 1. Run Backend API Locally
```bash
cd backend
npm install
npm start
```
The API server starts on `http://localhost:4000`. Health check: `http://localhost:4000/health`.

### 2. Run Frontend SPA Locally
```bash
cd frontend
npm install
npm run dev
```
The Vite web server starts on `http://localhost:3000`.

---

## 📋 Business Rules & Validation (Section 4.0)

- **Registration Number**: Exactly 10 characters matching `^\d{5}[A-Za-z]32\d{2}$` (e.g. `23091A3251`). Positions 7–8 MUST be `32`. Transformed & stored in UPPERCASE.
- **Email**: Must match `@rgmcet.edu.in`. Transformed & stored in LOWERCASE.
- **Uniqueness**: Enforced across 2 backend layers (Cognito Pre Sign-Up Lambda trigger + PostgreSQL `UNIQUE` constraints) and checked live inline during sign-up via `GET /auth/check-availability`.

---

## 🚀 Deployment to AWS (Section 11 Checklist)

### 1. Prerequisites
- AWS CLI v2 configured (`aws configure`)
- Node.js 20.x LTS & npm
- AWS CDK CLI installed globally (`npm install -g aws-cdk`)

### 2. Deploy Infrastructure Stack
```bash
cd infra
npm install
npm run build
cdk bootstrap aws://<ACCOUNT_ID>/<REGION>
cdk deploy
```

### 3. Initialize RDS Database Schema
Execute `schema.sql` against the newly provisioned RDS PostgreSQL instance via AWS SSM Session Manager port forwarding or a migration Lambda:
```bash
psql -h <RDS_ENDPOINT> -U postgres -d advitiyans -f schema.sql
```

### 4. Build & Deploy Frontend to S3 & CloudFront
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 📊 Employability Score Algorithm

The system automatically calculates a student's employability score (0–100) using a weighted formula:
- **Academics (25%)**: Average GPA scaled out of 10.
- **Coding Profiles (20%)**: Linked platforms, LeetCode ratings, GitHub commit activity.
- **Tech Skills (20%)**: Self & faculty verified tool ratings.
- **Certifications (15%)**: Verified industry certificates (AWS, NPTEL, Coursera).
- **Soft Skills (10%)**: Core interpersonal skill ratings.
- **Achievements (10%)**: Hackathon wins, capstone projects, and conferences.
