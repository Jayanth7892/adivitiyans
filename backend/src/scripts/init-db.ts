import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Secrets Manager support for AWS deployments
// ---------------------------------------------------------------------------
async function getDbPassword(): Promise<string> {
  if (process.env.DB_PASSWORD) return process.env.DB_PASSWORD;

  const secretArn = process.env.DB_SECRET_ARN;
  if (secretArn) {
    try {
      const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
      const client = new SecretsManagerClient({});
      const resp = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
      if (resp.SecretString) {
        const secret = JSON.parse(resp.SecretString);
        return secret.password;
      }
    } catch (err: any) {
      console.error('⚠️ Could not fetch secret from Secrets Manager:', err.message);
    }
  }

  return 'postgres';
}

// ---------------------------------------------------------------------------
// Database initialization with retry logic
// ---------------------------------------------------------------------------
async function connectWithRetry(pool: Pool, maxRetries = 5): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      console.log(`⚡ Connected to PostgreSQL Database (attempt ${attempt}).`);
      return client;
    } catch (err: any) {
      console.warn(`⏳ Connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt === maxRetries) throw err;
      // Wait 3 seconds before retrying (RDS may still be starting up)
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

async function initializeDatabase() {
  console.log('=======================================================');
  console.log('  Advitiyans — Database Schema & Seed Initialization   ');
  console.log('=======================================================');

  const password = await getDbPassword();
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5432');
  const dbName = process.env.DB_NAME || 'advitiyans';

  console.log(`🔌 Connecting to PostgreSQL at ${host}:${port}/${dbName}...`);

  const pool = new Pool({
    host,
    port,
    user: process.env.DB_USER || 'postgres',
    password,
    database: dbName,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });

  try {
    // Resolve schema.sql path
    const schemaPath = path.resolve(__dirname, '../../../schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`schema.sql not found at ${schemaPath}`);
    }

    const sqlContent = fs.readFileSync(schemaPath, 'utf8');
    console.log(`📄 Loaded DDL script from ${schemaPath} (${sqlContent.length} bytes)`);

    // Connect with retry
    const client = await connectWithRetry(pool);

    // Check if --seed-only flag passed
    const seedOnly = process.argv.includes('--seed-only');
    const schemaOnly = process.argv.includes('--schema-only');

    if (seedOnly) {
      console.log('🌱 Running seed data only (--seed-only)...');
      // Extract only INSERT statements
      const seedStatements = sqlContent
        .split(';')
        .filter((stmt) => stmt.trim().toUpperCase().startsWith('INSERT'))
        .join(';\n');
      await client.query(seedStatements);
    } else if (schemaOnly) {
      console.log('📐 Running schema DDL only (--schema-only)...');
      // Extract everything except INSERT statements
      const ddlStatements = sqlContent
        .split(';')
        .filter((stmt) => !stmt.trim().toUpperCase().startsWith('INSERT'))
        .join(';\n');
      await client.query(ddlStatements);
    } else {
      console.log('⏳ Executing full schema.sql (DDL + seed data)...');
      await client.query(sqlContent);
    }

    // Print summary
    const tablesRes = await client.query(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
    );
    const studentsRes = await client.query('SELECT COUNT(*) FROM students');
    const facultyRes = await client.query('SELECT COUNT(*) FROM faculty');

    console.log('');
    console.log('✅ Database initialization complete!');
    console.log(`   📊 Tables: ${tablesRes.rows[0].count}`);
    console.log(`   👨‍🎓 Students: ${studentsRes.rows[0].count}`);
    console.log(`   👨‍🏫 Faculty: ${facultyRes.rows[0].count}`);
    console.log('');

    client.release();
    await pool.end();
  } catch (err: any) {
    console.error('');
    console.error('❌ Failed to initialize database schema:', err.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error(`  1. Verify PostgreSQL is running at ${host}:${port}`);
    console.error(`  2. Verify database "${dbName}" exists: CREATE DATABASE ${dbName};`);
    console.error('  3. Verify credentials in .env file');
    console.error('  4. For AWS RDS, ensure security group allows inbound on port 5432');
    console.error('');
    process.exit(1);
  }
}

initializeDatabase();
