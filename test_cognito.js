const { CognitoIdentityProviderClient, ListUsersCommand, AdminDeleteUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const client = new CognitoIdentityProviderClient({ region: 'ap-south-1' });
const userPoolId = 'ap-south-1_sYp8CvKjn';

async function findAndDeleteUser(emailOrRoll) {
  console.log(`Searching Cognito for "${emailOrRoll}"...`);
  
  // 1. List users and match by email or custom:reg_no
  let paginationToken = undefined;
  const matchedUsernames = [];

  do {
    const res = await client.send(new ListUsersCommand({
      UserPoolId: userPoolId,
      PaginationToken: paginationToken,
      Limit: 60,
    }));

    for (const u of res.Users || []) {
      const email = u.Attributes?.find(a => a.Name === 'email')?.Value?.toLowerCase() || '';
      const regNo = u.Attributes?.find(a => a.Name === 'custom:reg_no')?.Value?.toUpperCase() || '';
      const cleanTarget = emailOrRoll.trim().toLowerCase();
      const targetRoll = emailOrRoll.trim().toUpperCase();

      if (email === cleanTarget || regNo === targetRoll || (cleanTarget.startsWith(regNo.toLowerCase()) && regNo.length > 0)) {
        console.log(`MATCH FOUND: Username=${u.Username}, email=${email}, regNo=${regNo}`);
        matchedUsernames.push(u.Username);
      }
    }

    paginationToken = res.PaginationToken;
  } while (paginationToken);

  console.log(`Matched usernames to delete:`, matchedUsernames);
  for (const username of matchedUsernames) {
    await client.send(new AdminDeleteUserCommand({
      UserPoolId: userPoolId,
      Username: username,
    }));
    console.log(`Deleted Cognito user ${username}`);
  }
}

findAndDeleteUser('23091A32D6').catch(console.error);
