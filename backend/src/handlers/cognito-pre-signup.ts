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
    const regNo = (userAttributes['custom:reg_no'] || '').trim().toUpperCase();

    // 1. Domain Validation
    if (!email || !RGMCET_EMAIL_REGEX.test(email)) {
      throw new Error("Invalid email domain. Sign up requires a valid @rgmcet.edu.in email address.");
    }

    // 2. Registration Number Format Validation
    if (!regNo || !REGISTRATION_NUMBER_REGEX.test(regNo)) {
      throw new Error("Invalid registration number format. Must be 10 characters matching '^\d{5}[A-Za-z]32\d{2}$' (e.g. 23091A3251).");
    }

    // 3. Database Uniqueness Check - Email
    const emailCheck = await db.query(
      'SELECT 1 FROM students WHERE LOWER(email) = $1',
      [email]
    );
    if (emailCheck.rows && emailCheck.rows.length > 0) {
      throw new Error("This email is already registered.");
    }

    // 4. Database Uniqueness Check - Registration Number
    const regCheck = await db.query(
      'SELECT 1 FROM students WHERE UPPER(roll_number) = $1',
      [regNo]
    );
    if (regCheck.rows && regCheck.rows.length > 0) {
      throw new Error("This registration number is already registered.");
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
