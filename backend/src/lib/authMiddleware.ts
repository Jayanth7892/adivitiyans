import { Request, Response, NextFunction } from 'express';
import { db } from '../db';

// ─────────────────────────────────────────────────────────────────────────────
// Auth Middleware for Advitiyans API
//
// Three layers:
//   1. extractAuth   — decodes JWT or validates session. NEVER blocks. Sets req.auth.
//   2. requireAuth   — blocks if req.auth is null (no valid identity).
//   3. requireRole   — blocks if req.auth.role not in allowed list.
//   4. requireOwnerOrRole — blocks if user is a student and doesn't own the resource.
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthPayload {
  email: string;
  role: string;   // 'student' | 'faculty' | 'hod' | 'admin'
  regNo: string;  // roll_number or faculty_id
}

// Extend Express Request to carry auth info
declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload | null;
    }
  }
}

/**
 * Decode a JWT payload (base64url) without cryptographic verification.
 * Returns null if the token is malformed or clearly fake.
 */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    // Reject obviously fake tokens (demo tokens from AuthContext fallback)
    if (token.startsWith('demo_token_')) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * extractAuth — Non-blocking middleware. Runs on every request.
 *
 * Attempts to identify the caller via:
 *   1. JWT in Authorization header (Cognito tokens for student/faculty)
 *   2. Session-based fallback (for admin/HOD who use demo_token + valid session)
 *
 * Sets req.auth = { email, role, regNo } or req.auth = null.
 * NEVER returns 401 — downstream guards decide access.
 */
export async function extractAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  req.auth = null;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.slice(7);

    // ── Attempt 1: Decode as a real Cognito JWT ──
    const payload = decodeJwtPayload(token);
    if (payload && payload.email) {
      const email = (payload.email || '').toLowerCase();
      const derivedRegNo = (payload['custom:reg_no'] || (email.includes('@') ? email.split('@')[0] : '')).toUpperCase();
      req.auth = {
        email,
        role: (payload['custom:role'] || 'student').toLowerCase(),
        regNo: derivedRegNo,
      };
      return next();
    }

    // ── Attempt 2: demo_token fallback — validate via user_sessions table ──
    // Admin/HOD master login doesn't go through Cognito, so the frontend
    // stores a demo_token_<role>_<timestamp>. We validate by checking
    // if there's an active session for this user in sessionStorage.
    // The session token is sent separately; here we look for the email
    // in the session validation query param or in the request body.
    if (token.startsWith('demo_token_')) {
      // Extract role from demo token format: demo_token_<role>_<timestamp>
      const parts = token.split('_');
      const demoRole = parts.length >= 3 ? parts[2] : '';

      // For demo tokens, we try to find the email from:
      // 1. Query params (for GET requests)
      // 2. Request body (for POST/PUT requests)
      // 3. URL path params (for student-scoped routes)
      let email = '';
      if (req.query.email) email = String(req.query.email).toLowerCase();
      if (req.query.caller_email) email = String(req.query.caller_email).toLowerCase();
      if (req.body?.email) email = String(req.body.email).toLowerCase();
      if (req.body?.caller_email) email = String(req.body.caller_email).toLowerCase();

      // If we found an email and the role is admin/hod, validate against user_sessions
      if (email && (demoRole === 'admin' || demoRole === 'hod')) {
        if (!db.isMock) {
          try {
            const sessionRes = await db.query(
              `SELECT role FROM user_sessions WHERE email = $1 AND expires_at > NOW()`,
              [email]
            );
            if (sessionRes.rows.length > 0) {
              const sessionRole = sessionRes.rows[0].role;
              if (sessionRole === 'admin' || sessionRole === 'hod') {
                req.auth = {
                  email,
                  role: sessionRole,
                  regNo: sessionRole === 'admin' ? 'ADMIN_MASTER' : 'HOD_CSEDS',
                };
                return next();
              }
            }
          } catch {
            // DB error — fall through, auth stays null
          }
        } else {
          // Mock mode: trust the demo token role
          req.auth = {
            email,
            role: demoRole,
            regNo: demoRole === 'admin' ? 'ADMIN_MASTER' : 'HOD_CSEDS',
          };
          return next();
        }
      }
    }
  } catch {
    // Any error during auth extraction — proceed unauthenticated
  }

  next();
}

/**
 * requireAuth — Blocks requests with no authenticated identity.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }
  next();
}

/**
 * requireRole — Blocks requests unless the user has one of the specified roles.
 * Must be used AFTER extractAuth.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.auth.role)) {
      res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.auth.role}.`,
      });
      return;
    }
    next();
  };
}

/**
 * requireOwnerOrRole — For student-scoped routes like /students/:id/academics.
 *
 * - If user is student: checks that req.params[paramName] matches req.auth.regNo
 * - If user has an elevated role (faculty, hod, admin): always allows (GAP-05 fix)
 */
export function requireOwnerOrRole(paramName: string, ...elevatedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    // Elevated roles always have access (faculty viewing mentee, admin managing students)
    if (elevatedRoles.includes(req.auth.role)) {
      return next();
    }

    // Students must own the resource
    const resourceId = req.params[paramName]?.toUpperCase();
    const emailPrefix = req.auth.email?.includes('@') ? req.auth.email.split('@')[0].toUpperCase() : '';
    if (req.auth.role === 'student' && (resourceId === req.auth.regNo || resourceId === emailPrefix)) {
      return next();
    }

    res.status(403).json({
      error: 'Access denied. You can only modify your own data.',
    });
  };
}
