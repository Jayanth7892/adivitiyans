import { PreSignUpTriggerEvent, Context, Callback } from 'aws-lambda';
import { db } from '../db';
import { REGISTRATION_NUMBER_REGEX, RGMCET_EMAIL_REGEX } from '../lib/validation';

export const handler = async (
  event: PreSignUpTriggerEvent,
  _context: Context,
  callback: Callback
): Promise<PreSignUpTriggerEvent> => {
  try {
    const userAttributes = event.request.userAttributes || {};
    const email = (userAttributes.email || '').trim().toLowerCase();
    const role = (userAttributes['custom:role'] || '').toLowerCase();

    // Domain Validation
    if (!email || !RGMCET_EMAIL_REGEX.test(email)) {
      throw new Error("Invalid email domain. Sign up requires a valid @rgmcet.edu.in email address.");
    }

    // Blocked email check for faculty/HOD (students use roll numbers, not blocked list)
    if (role === 'faculty' || role === 'hod') {
      try {
        await db.query(`CREATE TABLE IF NOT EXISTS blocked_emails (email TEXT PRIMARY KEY, blocked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, reason TEXT)`);
        const blocked = await db.query('SELECT 1 FROM blocked_emails WHERE email = $1', [email]);
        if (blocked.rows.length > 0) {
          throw new Error('This email has been deactivated by the administrator. Please contact the system administrator to restore access.');
        }
      } catch (dbErr: any) {
        if (dbErr.message.includes('deactivated')) throw dbErr;
        console.warn('[PreSignUp] Could not check blocked_emails:', dbErr.message);
      }
    }

    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = true;
    return event;
  } catch (error: any) {
    callback(error.message || 'Pre-signup validation failed.');
    throw error;
  }
};
