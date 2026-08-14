import { CognitoIdentityProviderClient, AdminDeleteUserCommand, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { db } from '../db';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

/**
 * Delete one or more users from the AWS Cognito User Pool and clean up active sessions.
 * Accepts an array of emails, roll numbers, or usernames.
 */
export async function deleteCognitoUsers(identifiers: (string | undefined | null)[]): Promise<void> {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const validIds = identifiers.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  if (validIds.length === 0) return;

  const emailsToDelete = new Set<string>();

  for (const id of validIds) {
    const cleanId = id.trim().toLowerCase();
    if (cleanId.includes('@')) {
      emailsToDelete.add(cleanId);
    } else {
      emailsToDelete.add(`${cleanId}@rgmcet.edu.in`);
      emailsToDelete.add(cleanId); // Some users might be stored by roll number
    }
  }

  // 1. Delete from Cognito User Pool
  if (userPoolId) {
    for (const username of emailsToDelete) {
      try {
        await cognitoClient.send(
          new AdminDeleteUserCommand({
            UserPoolId: userPoolId,
            Username: username,
          })
        );
        console.log(`[Cognito] Successfully deleted user "${username}" from User Pool ${userPoolId}`);
      } catch (err: any) {
        if (err.name === 'UserNotFoundException' || err.__type === 'UserNotFoundException') {
          // Normal: user was not in Cognito or was already removed
          console.log(`[Cognito] User "${username}" not found in Cognito User Pool.`);
        } else {
          console.warn(`[Cognito] Failed to delete user "${username}" from Cognito:`, err.message);
        }
      }
    }
  }

  // 2. Invalidate active sessions in user_sessions table
  if (!db.isMock && emailsToDelete.size > 0) {
    try {
      const emailList = Array.from(emailsToDelete);
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
