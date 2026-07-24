/**
 * Platform-staff RBAC capability matrix (Phase 4.5).
 *
 * The source of truth for "what can this admin actually DO". Deliberately
 * separate from lib/rbac.ts (merchant Membership roles) — a platform admin is
 * NOT an organization member and must never inherit tenant-scoped permissions
 * (mirrors why lib/admin-auth.ts is separate from lib/rbac.ts).
 *
 * Named roles map to a FIXED set of capabilities here; request-level gating in
 * lib/admin-auth.ts (`requireAdminCapability`) reads this matrix. Adding a new
 * privileged admin action means adding a capability here first, then gating the
 * route on it — never an ad-hoc role string comparison inside a route.
 */

export type AdminRole = 'support' | 'kyc_reviewer' | 'finance' | 'ops' | 'superadmin';

export type AdminCapability =
  | 'admin:manage' // create/remove/disable admin accounts, manage invites
  | 'billing:write' // mark invoices paid, billing adjustments
  | 'kyc:review' // approve/reject KYC documents
  | 'org:golive' // approve an org for live mode (validates creds against Safaricom)
  | 'org:suspend' // suspend / reinstate a merchant organization
  | 'org:terminate' // terminate (one-way archival) a merchant organization
  | 'payment:resolve' // re-query / human-expire a stuck transaction (never auto-fail)
  | 'payout:reverse' // initiate a payout/refund reversal (money movement)
  | 'recon:resolve' // resolve/ignore a reconciliation mismatch
  | 'ops:view' // read the cross-tenant operations + audit consoles
  | 'impersonate' // read-only "view as merchant"
  | 'alerts:manage'; // acknowledge / manage internal ops alerts

export const ALL_ADMIN_ROLES: AdminRole[] = [
  'support',
  'kyc_reviewer',
  'finance',
  'ops',
  'superadmin',
];

export const ALL_ADMIN_CAPABILITIES: AdminCapability[] = [
  'admin:manage',
  'billing:write',
  'kyc:review',
  'org:golive',
  'org:suspend',
  'org:terminate',
  'payment:resolve',
  'payout:reverse',
  'recon:resolve',
  'ops:view',
  'impersonate',
  'alerts:manage',
];

/**
 * The capability matrix. `superadmin` intentionally holds every capability;
 * the other four are differentiated staff jobs. Overlap is allowed (e.g. both
 * `ops` and `finance` can reverse a payout) — capabilities are additive.
 */
export const ADMIN_CAPABILITY_MATRIX: Record<AdminRole, AdminCapability[]> = {
  superadmin: [...ALL_ADMIN_CAPABILITIES],
  ops: [
    'ops:view',
    'org:suspend',
    'payment:resolve',
    'payout:reverse',
    'recon:resolve',
    'impersonate',
    'alerts:manage',
  ],
  finance: ['ops:view', 'billing:write', 'recon:resolve', 'payout:reverse'],
  kyc_reviewer: ['kyc:review', 'ops:view'],
  support: ['ops:view', 'impersonate'],
};

export function isAdminRole(role: string): role is AdminRole {
  return (ALL_ADMIN_ROLES as string[]).includes(role);
}

/** Pure capability check — the one place role→capability is decided. */
export function roleHasCapability(role: string, capability: AdminCapability): boolean {
  const caps = ADMIN_CAPABILITY_MATRIX[role as AdminRole];
  return caps ? caps.includes(capability) : false;
}

/** All capabilities a role holds (for rendering per-capability admin nav). */
export function capabilitiesForRole(role: string): AdminCapability[] {
  return ADMIN_CAPABILITY_MATRIX[role as AdminRole] ?? [];
}
