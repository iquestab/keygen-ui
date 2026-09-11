// Keygen API Types

export interface KeygenResource {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, KeygenRelationship>;
  links?: Record<string, string>;
}

export interface KeygenRelationship {
  data?: KeygenResourceIdentifier | KeygenResourceIdentifier[];
  links?: Record<string, string>;
  /**
   * Collection relationships carry a count here, so e.g. a license's machine
   * count is available without a second request.
   */
  meta?: {
    count?: number;
    [key: string]: unknown;
  };
}

export interface KeygenResourceIdentifier {
  id: string;
  type: string;
}

export interface KeygenResponse<T = unknown> {
  data?: T;
  included?: KeygenResource[];
  meta?: Record<string, unknown>;
  links?: Record<string, string>;
  errors?: KeygenError[];
}

export interface KeygenError {
  id?: string;
  status?: string;
  code?: string;
  title: string;
  detail: string;
  source?: {
    pointer?: string;
    parameter?: string;
  };
  links?: Record<string, string>;
}

// API Error type for catch blocks
export interface ApiError {
  status?: number;
  message?: string;
  code?: string;
}

// Authentication
export interface AuthTokenResponse {
  data: {
    id: string;
    type: 'tokens';
    attributes: {
      kind: string;
      token: string;
      expiry: string | null;
      name?: string;
      created: string;
      updated: string;
    };
    relationships: {
      account: KeygenRelationship;
      bearer: KeygenRelationship;
    };
  };
}

// Token (API key)
export interface Token extends KeygenResource {
  type: 'tokens';
  attributes: {
    kind: string; // e.g. 'user-token', 'admin-token'
    token?: string; // raw secret — only ever present in the create/regenerate response
    name?: string;
    expiry: string | null;
    permissions?: string[];
    created: string;
    updated: string;
  };
}

// User
export interface User extends KeygenResource {
  type: 'users';
  attributes: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email: string;
    role: 'admin' | 'developer' | 'sales-agent' | 'support-agent' | 'read-only' | 'user';
    status: 'active' | 'inactive' | 'banned';
    banned?: boolean; // Legacy property for backward compatibility
    lastSignedInAt?: string;
    metadata?: Record<string, unknown>;
    created: string;
    updated: string;
  };
}

// License
// The API returns status in UPPERCASE. EXPIRING is a sub-status for licenses
// expiring within the next 3 days, and takes precedence over ACTIVE/INACTIVE.
export type LicenseStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'EXPIRING'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'BANNED';

export interface License extends KeygenResource {
  type: 'licenses';
  attributes: {
    name?: string;
    key: string;
    status: LicenseStatus;
    uses: number;
    protected: boolean;
    suspended: boolean;
    // Per-license overrides of the policy's limits. Inherited from the policy
    // when null, so a null here means "use the policy value", not "unlimited".
    maxMachines?: number | null;
    maxProcesses?: number | null;
    maxUsers?: number | null;
    maxCores?: number | null;
    /** Bytes */
    maxMemory?: number | null;
    /** Bytes */
    maxDisk?: number | null;
    maxUses?: number | null;
    permissions?: string[];
    expiry?: string | null;
    metadata?: Record<string, unknown>;
    created: string;
    updated: string;
    // Read-only, inherited from the policy
    floating: boolean;
    strict: boolean;
    scheme?: string | null;
    requireHeartbeat: boolean;
    requireCheckIn: boolean;
    /** Last validated release version, set via a version/checksum validation scope */
    version?: string | null;
    lastValidated?: string | null;
    lastCheckOut?: string | null;
    /** null when the policy does not require check-ins */
    lastCheckIn?: string | null;
    /** null when the policy does not require check-ins */
    nextCheckIn?: string | null;
    // Only present in the response of a license check-out (offline license file) action
    certificate?: string;
  };
}

// Machine
// Returned uppercase with underscores. RESURRECTED applies to machines revived
// under a policy with heartbeatResurrectionStrategy: ALWAYS_REVIVE.
export type MachineHeartbeatStatus = 'NOT_STARTED' | 'ALIVE' | 'DEAD' | 'RESURRECTED';

export interface Machine extends KeygenResource {
  type: 'machines';
  attributes: {
    fingerprint: string;
    name?: string | null;
    platform?: string | null;
    hostname?: string | null;
    ip?: string | null;
    cores?: number | null;
    /** Bytes */
    memory?: number | null;
    /** Bytes */
    disk?: number | null;
    metadata?: Record<string, unknown>;
    created: string;
    updated: string;
    // Read-only — inherited from the machine's policy
    maxProcesses?: number | null;
    requireHeartbeat: boolean;
    heartbeatStatus: MachineHeartbeatStatus;
    heartbeatDuration?: number | null;
    lastHeartbeat?: string | null;
    nextHeartbeat?: string | null;
    lastCheckOut?: string | null;
    // Only present in the response of a machine check-out action
    certificate?: string;
  };
}

// Product
export interface Product extends KeygenResource {
  type: 'products';
  attributes: {
    name: string;
    code?: string;
    url?: string;
    distributionStrategy: 'LICENSED' | 'OPEN' | 'CLOSED';
    platforms?: string[];
    permissions?: string[];
    metadata?: Record<string, unknown>;
    created: string;
    updated: string;
  };
}

// Policy
// Policy strategy values. Declared once and shared by both the Policy resource
// type and the create/update payloads in the policy resource, so the two can't
// drift apart (they previously disagreed on six different fields).
export type PolicyHeartbeatCullStrategy = 'DEACTIVATE_DEAD' | 'KEEP_DEAD';
/**
 * The revival window for a dead machine or process. The N_MINUTE_REVIVE values
 * allow a resurrection if a ping arrives within N minutes of death.
 * ALWAYS_REVIVE requires heartbeatCullStrategy KEEP_DEAD.
 */
export type PolicyHeartbeatResurrectionStrategy =
  | 'NO_REVIVE'
  | '1_MINUTE_REVIVE'
  | '2_MINUTE_REVIVE'
  | '5_MINUTE_REVIVE'
  | '10_MINUTE_REVIVE'
  | '15_MINUTE_REVIVE'
  | 'ALWAYS_REVIVE';
export type PolicyHeartbeatBasis = 'FROM_CREATION' | 'FROM_FIRST_PING';
export type PolicyMachineUniquenessStrategy =
  | 'UNIQUE_PER_ACCOUNT'
  | 'UNIQUE_PER_PRODUCT'
  | 'UNIQUE_PER_POLICY'
  | 'UNIQUE_PER_LICENSE';
export type PolicyMachineMatchingStrategy = 'MATCH_ANY' | 'MATCH_TWO' | 'MATCH_MOST' | 'MATCH_ALL';
export type PolicyComponentUniquenessStrategy =
  | 'UNIQUE_PER_ACCOUNT'
  | 'UNIQUE_PER_PRODUCT'
  | 'UNIQUE_PER_POLICY'
  | 'UNIQUE_PER_LICENSE'
  | 'UNIQUE_PER_MACHINE';
export type PolicyComponentMatchingStrategy = 'MATCH_ANY' | 'MATCH_TWO' | 'MATCH_MOST' | 'MATCH_ALL';
export type PolicyExpirationStrategy =
  | 'RESTRICT_ACCESS'
  | 'REVOKE_ACCESS'
  | 'MAINTAIN_ACCESS'
  | 'ALLOW_ACCESS';
export type PolicyExpirationBasis =
  | 'FROM_CREATION'
  | 'FROM_FIRST_VALIDATION'
  | 'FROM_FIRST_ACTIVATION'
  | 'FROM_FIRST_DOWNLOAD'
  | 'FROM_FIRST_USE';
export type PolicyRenewalBasis = 'FROM_EXPIRY' | 'FROM_NOW' | 'FROM_NOW_IF_EXPIRED';
export type PolicyTransferStrategy = 'RESET_EXPIRY' | 'KEEP_EXPIRY';
export type PolicyAuthenticationStrategy = 'TOKEN' | 'LICENSE' | 'MIXED' | 'NONE';
export type PolicyMachineLeasingStrategy = 'PER_LICENSE' | 'PER_USER';
export type PolicyProcessLeasingStrategy = 'PER_MACHINE' | 'PER_LICENSE' | 'PER_USER';
export type PolicyOverageStrategy =
  | 'ALWAYS_ALLOW_OVERAGE'
  | 'ALLOW_1_25X_OVERAGE'
  | 'ALLOW_1_5X_OVERAGE'
  | 'ALLOW_2X_OVERAGE'
  | 'NO_OVERAGE';
export type PolicyCheckInInterval = 'day' | 'week' | 'month' | 'year';
export type PolicyScheme =
  | 'ED25519_SIGN'
  | 'ECDSA_P256_SIGN'
  | 'RSA_2048_PKCS1_PSS_SIGN_V2'
  | 'RSA_2048_PKCS1_SIGN_V2'
  | 'RSA_2048_PKCS1_ENCRYPT'
  | 'RSA_2048_JWT_RS256'
  | 'RSA_2048_PKCS1_PSS_SIGN'
  | 'RSA_2048_PKCS1_SIGN';

/**
 * The resource limits a policy imposes on the licenses implementing it.
 * A license may override any of these on a per-license basis.
 */
export type PolicyLimits = {
  maxMachines?: number | null;
  maxProcesses?: number | null;
  maxUsers?: number | null;
  maxCores?: number | null;
  maxUses?: number | null;
  /** Bytes */
  maxMemory?: number | null;
  /** Bytes */
  maxDisk?: number | null;
}

/** The scope assertions a policy can require during license validation */
export type PolicyScopeRequirements = {
  requireProductScope?: boolean;
  requirePolicyScope?: boolean;
  requireMachineScope?: boolean;
  requireFingerprintScope?: boolean;
  requireComponentsScope?: boolean;
  requireUserScope?: boolean;
  requireChecksumScope?: boolean;
  requireVersionScope?: boolean;
}

export interface Policy extends KeygenResource {
  type: 'policies';
  attributes: PolicyLimits & Required<PolicyScopeRequirements> & {
    name: string;
    duration?: number | null;
    strict: boolean;
    floating: boolean;
    protected: boolean;
    /** Pull keys from a finite pool of pre-determined keys. Immutable after creation. */
    usePool: boolean;
    requireCheckIn: boolean;
    checkInInterval?: PolicyCheckInInterval | null;
    checkInIntervalCount?: number | null;
    requireHeartbeat: boolean;
    heartbeatDuration?: number | null;
    heartbeatCullStrategy: PolicyHeartbeatCullStrategy;
    heartbeatResurrectionStrategy: PolicyHeartbeatResurrectionStrategy;
    heartbeatBasis: PolicyHeartbeatBasis;
    machineUniquenessStrategy: PolicyMachineUniquenessStrategy;
    machineMatchingStrategy: PolicyMachineMatchingStrategy;
    componentUniquenessStrategy: PolicyComponentUniquenessStrategy;
    componentMatchingStrategy: PolicyComponentMatchingStrategy;
    expirationStrategy: PolicyExpirationStrategy;
    expirationBasis: PolicyExpirationBasis;
    renewalBasis: PolicyRenewalBasis;
    transferStrategy: PolicyTransferStrategy;
    authenticationStrategy: PolicyAuthenticationStrategy;
    machineLeasingStrategy: PolicyMachineLeasingStrategy;
    processLeasingStrategy: PolicyProcessLeasingStrategy;
    overageStrategy: PolicyOverageStrategy;
    /** Immutable after creation */
    scheme?: PolicyScheme | null;
    metadata: Record<string, unknown>;
    created: string;
    updated: string;
  };
}


// Group
export interface Group extends KeygenResource {
  type: 'groups';
  attributes: {
    name: string;
    maxLicenses?: number;
    maxMachines?: number;
    maxUsers?: number;
    created: string;
    updated: string;
  };
}

// Entitlement
export interface Entitlement extends KeygenResource {
  type: 'entitlements';
  attributes: {
    name: string;
    code: string;
    created: string;
    updated: string;
  };
}

// Process
// A process always heartbeats, so unlike a machine it has no NOT_STARTED state.
export type ProcessStatus = 'ALIVE' | 'DEAD' | 'RESURRECTED';

export interface Process extends KeygenResource {
  type: 'processes';
  attributes: {
    /** Arbitrary string, unique within the scope of its machine — not an OS pid */
    pid: string;
    metadata?: Record<string, unknown>;
    created: string;
    updated: string;
    // Read-only
    status: ProcessStatus;
    /** Heartbeat interval in seconds, inherited from the license's policy */
    interval?: number | null;
    lastHeartbeat?: string | null;
    nextHeartbeat?: string | null;
  };
}

export interface ProcessFilters extends PaginationOptions {
  machine?: string;
  license?: string;
  /** UUID of the owner to filter by */
  owner?: string;
  user?: string;
  product?: string;
}

// Component
export interface Component extends KeygenResource {
  type: 'components';
  attributes: {
    name: string;
    fingerprint: string;
    created: string;
    updated: string;
  };
}

// Event Log
export interface EventLog extends KeygenResource {
  type: 'event-logs';
  attributes: {
    event: string;
    metadata?: Record<string, unknown>;
    created: string;
    updated: string;
  };
}

// Request Log
export interface RequestLog extends KeygenResource {
  type: 'request-logs';
  attributes: {
    method: string;
    url: string;
    ip?: string;
    status: number;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    requestBody?: unknown;
    responseBody?: unknown;
    created: string;
  };
}

// Webhook
export interface Webhook extends KeygenResource {
  type: 'webhook-endpoints';
  attributes: {
    url: string;
    subscriptions: string[];
    signingKey?: string;
    enabled: boolean;
    created: string;
    updated: string;
  };
}

// Package
export interface Package extends KeygenResource {
  type: 'packages';
  attributes: {
    name?: string;
    key: string;
    engine?: 'pypi' | 'npm' | 'rubygems' | 'tauri' | 'oci' | 'raw' | null;
    metadata?: Record<string, unknown>;
    created: string;
    updated: string;
  };
}

// Release
export interface Release extends KeygenResource {
  type: 'releases';
  attributes: {
    name?: string;
    version: string;
    channel: 'stable' | 'rc' | 'beta' | 'alpha' | 'dev';
    status: 'DRAFT' | 'PUBLISHED' | 'YANKED';
    tag?: string;
    description?: string;
    semver?: {
      major: number;
      minor: number;
      patch: number;
      prerelease?: string[];
      build?: string[];
    };
    metadata?: Record<string, unknown>;
    backdated?: string | null;
    created: string;
    updated: string;
  };
}

// Constraint — links an entitlement to a release; a license/user must possess
// every entitlement constrained on a release to download or upgrade to it.
export interface Constraint extends KeygenResource {
  type: 'constraints';
  attributes: {
    created: string;
    updated: string;
  };
}

// Artifact
export interface Artifact extends KeygenResource {
  type: 'artifacts';
  attributes: {
    filename: string;
    filetype: string;
    filesize?: number;
    platform?: string;
    arch?: string;
    status: 'WAITING' | 'UPLOADED' | 'FAILED';
    signature?: string;
    checksum?: string;
    metadata?: Record<string, unknown>;
    created: string;
    updated: string;
  };
}

// Channel (read-only, derived from releases/artifacts)
export interface Channel extends KeygenResource {
  type: 'channels';
  attributes: {
    name: string;
    key: string;
    created: string;
    updated: string;
  };
}

// API Request options
export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, unknown>;
}

// Pagination
export interface PaginationOptions {
  page?: {
    size?: number;
    number?: number;
  };
  limit?: number;
}

// List options interface
export interface ListOptions {
  limit?: number;
  page?: number;
}

// List response interface
export interface KeygenListResponse<T = unknown> extends KeygenResponse<T[]> {
  meta?: {
    count?: number;
    pages?: {
      first?: string;
      last?: string;
      next?: string;
      prev?: string;
    };
  };
}

// Filter options for different resources
/**
 * Relative-time filters accept either seconds (e.g. 2629746) or an ISO8601
 * duration (e.g. '30d'); `on`/`before`/`after` take an ISO8601 timestamp.
 */
export interface LicenseDateFilter {
  in?: string | number;
  on?: string;
  before?: string;
  after?: string;
}

export interface LicenseActivityFilter {
  inside?: string | number;
  outside?: string | number;
  before?: string;
  after?: string;
}

export interface LicenseCountFilter {
  eq?: number;
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
}

export interface LicenseFilters extends PaginationOptions {
  /** UUID or email of the owner */
  owner?: string;
  /** UUID or email of an associated user (owner or attached user) */
  user?: string;
  policy?: string;
  group?: string;
  product?: string;
  machine?: string;
  status?: LicenseStatus;
  /** Licenses expiring within/on/before/after. Excludes already-expired licenses. */
  expires?: LicenseDateFilter;
  /** Licenses that expired within/on/before/after. Excludes non-expired licenses. */
  expired?: LicenseDateFilter;
  activity?: LicenseActivityFilter;
  /** A license with no owner and no users */
  unassigned?: boolean;
  /** A license with an owner or at least one user */
  assigned?: boolean;
  /** A license with at least one machine */
  activated?: boolean;
  /** Filter by machine count, e.g. { gt: 3 } */
  activations?: LicenseCountFilter;
  metadata?: Record<string, string>;
}

export interface MachineFilters extends PaginationOptions {
  license?: string;
  /** The license key to filter by. Cannot be an encrypted key. */
  key?: string;
  /** UUID of the machine's owner */
  owner?: string;
  user?: string;
  group?: string;
  product?: string;
  policy?: string;
  fingerprint?: string;
  ip?: string;
  hostname?: string;
  metadata?: Record<string, string>;
}

export interface UserFilters extends PaginationOptions {
  email?: string;
  role?: User['attributes']['role'];
  roles?: User['attributes']['role'][];
  status?: User['attributes']['status'];
}

export interface EventLogFilters extends PaginationOptions {
  event?: string;
  date?: {
    start?: string;
    end?: string;
  };
}

export interface RequestLogFilters extends PaginationOptions {
  date?: {
    start?: string;
    end?: string;
  };
  requestor?: {
    type?: 'user' | 'environment' | 'product' | 'license';
    id?: string;
  };
  url?: string;
  ip?: string;
  method?: string;
  status?: string;
}

export interface WebhookFilters extends PaginationOptions {
  enabled?: boolean;
  url?: string;
  subscriptions?: string[];
}

export interface PackageFilters extends PaginationOptions {
  product?: string;
}

export interface ReleaseFilters extends PaginationOptions {
  product?: string;
  package?: string;
  status?: Release['attributes']['status'];
  channel?: Release['attributes']['channel'];
}

export interface ArtifactFilters extends PaginationOptions {
  release?: string;
  product?: string;
  channel?: string;
  filetype?: string;
  platform?: string;
  arch?: string;
  status?: Artifact['attributes']['status'];
}

export type ChannelFilters = PaginationOptions;