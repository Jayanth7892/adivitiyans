import { CognitoIdentityProviderClient, AdminDeleteUserCommand, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { db } from '../db';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

/**
 * Delete one or more users from the AWS Cognito User Pool and clean up active sessions.
 * Accepts an array of emails, roll numbers, or usernames.
 * Matches each user in Cognito by UUID / email / custom:reg_no before deleting.
 */
export async function deleteCognitoUsers(identifiers: (string | undefined | null)[]): Promise<void> {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const validIds = identifiers.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  if (validIds.length === 0) return;

  const targets = new Set<string>();
  for (const id of validIds) {
    const clean = id.trim().toLowerCase();
    targets.add(clean);
    if (!clean.includes('@')) {
      targets.add(`${clean}@rgmcet.edu.in`);
    } else {
      targets.add(clean.split('@')[0]);
    }
  }

  // 1. Scan / Match user UUIDs in Cognito User Pool
  if (userPoolId) {
    try {
      let paginationToken: string | undefined = undefined;
      const cognitoUsernamesToDelete = new Set<string>();

      do {
        const res: any = await cognitoClient.send(
          new ListUsersCommand({
            UserPoolId: userPoolId,
            PaginationToken: paginationToken,
            Limit: 60,
          })
        );

        for (const u of res.Users || []) {
          const email = (u.Attributes?.find((a: any) => a.Name === 'email')?.Value || '').toLowerCase();
          const regNo = (u.Attributes?.find((a: any) => a.Name === 'custom:reg_no')?.Value || '').toLowerCase();
          const username = u.Username;

          // Match by internal UUID, email, or registration number
          if (
            targets.has(username.toLowerCase()) ||
            (email && targets.has(email)) ||
            (regNo && targets.has(regNo))
          ) {
            cognitoUsernamesToDelete.add(username);
          }
        }

        paginationToken = res.PaginationToken;
      } while (paginationToken);

      console.log(`[Cognito] Found ${cognitoUsernamesToDelete.size} Cognito user(s) to delete:`, Array.from(cognitoUsernamesToDelete));

      for (const username of cognitoUsernamesToDelete) {
        try {
          await cognitoClient.send(
            new AdminDeleteUserCommand({
              UserPoolId: userPoolId,
              Username: username,
            })
          );
          console.log(`[Cognito] Successfully deleted user UUID ${username} from User Pool ${userPoolId}`);
        } catch (err: any) {
          if (err.name === 'UserNotFoundException' || err.__type === 'UserNotFoundException') {
            console.log(`[Cognito] User UUID "${username}" already removed from User Pool.`);
          } else {
            console.warn(`[Cognito] Failed to delete user UUID "${username}" from Cognito:`, err.message);
          }
        }
      }
    } catch (scanErr: any) {
      console.warn('[Cognito] Error searching users to delete:', scanErr.message);
    }
  }

  // 2. Invalidate active sessions in user_sessions table
  if (!db.isMock && targets.size > 0) {
    try {
      const emailList = Array.from(targets).filter(t => t.includes('@'));
      await db.query(
        'DELETE FROM user_sessions WHERE LOWER(email) = ANY($1)',
        [emailList]
      );
      console.log(`[DB] Cleaned up user_sessions for:`, emailList);
    } catch (err: any) {
      console.warn('[DB] user_sessions cleanup error:', err.message);
    }
  }
}

/**
 * Delete ALL student users from Cognito User Pool (used during full DB truncate / wipe)
 */
export async function deleteAllCognitoUsers(): Promise<void> {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  if (!userPoolId) return;

  try {
    let paginationToken: string | undefined = undefined;
    do {
      const response: any = await cognitoClient.send(
        new ListUsersCommand({
          UserPoolId: userPoolId,
          PaginationToken: paginationToken,
          Limit: 60,
        })
      );

      const users = response.Users || [];
      for (const u of users) {
        const username = u.Username;
        if (!username) continue;
        // Do not delete master admin or HOD accounts from Cognito if any exist
        const emailAttr = u.Attributes?.find((a: any) => a.Name === 'email')?.Value?.toLowerCase() || username.toLowerCase();
        if (emailAttr.includes('admin@rgmcet.edu.in') || emailAttr.includes('hodcseds@rgmcet.edu.in')) {
          continue;
        }

        try {
          await cognitoClient.send(
            new AdminDeleteUserCommand({
              UserPoolId: userPoolId,
              Username: username,
            })
          );
          console.log(`[Cognito] Deleted user "${username}" during bulk wipe.`);
        } catch (delErr: any) {
          console.warn(`[Cognito] Failed to delete user "${username}":`, delErr.message);
        }
      }

      paginationToken = response.PaginationToken;
    } while (paginationToken);
  } catch (err: any) {
    console.warn('[Cognito] deleteAllCognitoUsers error:', err.message);
  }
}
