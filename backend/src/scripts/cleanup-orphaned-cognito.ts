import { CognitoIdentityProviderClient, ListUsersCommand, AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const API_BASE_URL = 'https://caam6j4dbh.execute-api.ap-south-1.amazonaws.com/prod';
const userPoolId = 'ap-south-1_sYp8CvKjn';

async function syncOrphanedCognitoUsers() {
  const cognito = new CognitoIdentityProviderClient({ region: 'ap-south-1' });

  // 1. Fetch all active students from API
  console.log('Fetching all active students from API database...');
  const res = await fetch(`${API_BASE_URL}/students`);
  const students: any = (await res.json()) || [];

  const validRolls = new Set<string>(students.map((s: any) => s.roll_number?.toUpperCase()).filter(Boolean));
  const validEmails = new Set<string>(students.map((s: any) => s.email?.toLowerCase()).filter(Boolean));
  console.log(`[DB] Found ${students.length} active students in database.`);

  // 2. Fetch all Cognito users
  let paginationToken: string | undefined = undefined;
  const cognitoUsers: { Username: string; email: string; regNo: string; role: string }[] = [];

  do {
    const listRes: any = await cognito.send(new ListUsersCommand({
      UserPoolId: userPoolId,
      PaginationToken: paginationToken,
      Limit: 60,
    }));

    for (const u of listRes.Users || []) {
      const email = (u.Attributes?.find((a: any) => a.Name === 'email')?.Value || '').toLowerCase();
      const regNo = (u.Attributes?.find((a: any) => a.Name === 'custom:reg_no')?.Value || '').toUpperCase();
      const role = (u.Attributes?.find((a: any) => a.Name === 'custom:role')?.Value || 'student').toLowerCase();
      cognitoUsers.push({ Username: u.Username, email, regNo, role });
    }
    paginationToken = listRes.PaginationToken;
  } while (paginationToken);

  console.log(`[Cognito] Found ${cognitoUsers.length} total users in User Pool.`);

  // 3. Filter orphaned student users
  const orphaned: { Username: string; email: string; regNo: string; role: string }[] = [];
  for (const u of cognitoUsers) {
    // Preserve admins, HODs, faculty
    if (u.role === 'admin' || u.role === 'hod' || u.role === 'faculty' || u.regNo.startsWith('FAC_')) {
      continue;
    }
    if (u.email.includes('admin@rgmcet.edu.in') || u.email.includes('hodcseds@rgmcet.edu.in')) {
      continue;
    }

    const existsByRoll = u.regNo && validRolls.has(u.regNo);
    const existsByEmail = u.email && validEmails.has(u.email);

    if (!existsByRoll && !existsByEmail) {
      orphaned.push(u);
    }
  }

  console.log(`\nFound ${orphaned.length} orphaned Cognito student account(s) to purge:`);
  for (const o of orphaned) {
    console.log(`  🗑️ Purging: ${o.regNo || '(No RegNo)'} - ${o.email} (UUID: ${o.Username})`);
    try {
      await cognito.send(new AdminDeleteUserCommand({
        UserPoolId: userPoolId,
        Username: o.Username,
      }));
    } catch (err: any) {
      console.warn(`  ⚠️ Failed to delete ${o.Username}:`, err.message);
    }
  }

  console.log(`\n✅ Finished cleanup: ${orphaned.length} orphaned accounts purged from AWS Cognito.`);
}

syncOrphanedCognitoUsers().catch(console.error);
