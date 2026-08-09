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

    // Domain Validation
    if (!email || !RGMCET_EMAIL_REGEX.test(email)) {
      throw new Error("Invalid email domain. Sign up requires a valid @rgmcet.edu.in email address.");
    }

    // Auto confirm user and verify email
    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = true;

    return event;
  } catch (error: any) {
    callback(error.message || 'Pre-signup validation failed.');
    throw error;
  }
};
