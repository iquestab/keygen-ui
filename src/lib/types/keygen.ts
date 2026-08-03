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
export interface License extends KeygenResource {
  type: 'licenses';
  attributes: {
    name?: string;
    key: string;
    status: 'active' | 'inactive' | 'expired' | 'suspended' | 'banned';
    uses: number;
    maxUses?: number;
    protected: boolean;
    floating: boolean;
    strict: boolean;
    scheme: string;
    encrypted: boolean;
    expiry?: string;
    metadata?: Record<string, unknown>;
    created: string;
    updated: string;
    // Only present in the response of a license check-out (offline license file) action
    certificate?: string;
  };
}

// Machine
export interface Machine extends KeygenResource {
  type: 'machines';
  attributes: {
    name?: string;
    fingerprint: string;
    platform?: string;
    hostname?: string;
    cores?: number;
    ip?: string;
    requireHeartbeat: boolean;
    heartbeatStatus: 'alive' | 'dead' | 'not-started';
    heartbeatDuration?: number;
    lastHeartbeat?: string;
    created: string;
    updated: string;
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
export interface Policy extends KeygenResource {
  type: 'policies';
  attributes: {
    name: string;
    duration?: number;
    strict: boolean;
    floating: boolean;
    requireProductScope: boolean;
    requirePolicyScope: boolean;
    requireMachineScope: boolean;
    requireFingerprintScope: boolean;
    requireComponentsScope: boolean;
    requireUserScope: boolean;
    requireChecksumScope: boolean;
    requireVersionScope: boolean;
    requireCheckIn: boolean;
    checkInInterval: 'day' | 'week' | 'month' | 'year';
    checkInIntervalCount: number;
    usePool: boolean;
    maxMachines?: number;
    maxProcesses?: number;
    maxCores?: number;
    maxUses?: number;
    protected: boolean;
    requireHeartbeat: boolean;
    heartbeatDuration: number;
    heartbeatCullStrategy: 'DEACTIVATE_DEAD' | 'KEEP_DEAD';
    heartbeatResurrectionStrategy: 'NO_REVIVE' | 'REVIVE_DEAD';
    heartbeatBasis: 'FROM_CREATION' | 'FROM_FIRST_PING';
    machineUniquenessStrategy: 'UNIQUE_PER_ACCOUNT' | 'UNIQUE_PER_PRODUCT' | 'UNIQUE_PER_POLICY' | 'UNIQUE_PER_LICENSE';
    machineMatchingStrategy: 'MATCH_BY_FINGERPRINT' | 'MATCH_BY_IP';
    expirationStrategy: 'EXPIRE_IMMEDIATELY' | 'RESTRICT_ACCESS' | 'MAINTAIN_ACCESS' | 'ALLOW_ACCESS';
    expirationBasis: 'FROM_CREATION' | 'FROM_FIRST_VALIDATION' | 'FROM_FIRST_ACTIVATION' | 'FROM_FIRST_DOWNLOAD' | 'FROM_FIRST_USE';
    renewalBasis: 'FROM_EXPIRY' | 'FROM_NOW';
    transferStrategy: 'TRANSFER_TO_USER' | 'KEEP_WITH_USER' | 'REVOKE_ACCESS';
    authenticationStrategy: 'TOKEN' | 'LICENSE' | 'MIXED' | 'NONE';
    machineLeasingStrategy: 'PER_MACHINE' | 'PER_USER' | 'ALL_MACHINES';
    processLeasingStrategy: 'PER_MACHINE' | 'PER_LICENSE' | 'ALL_PROCESSES';
    overageStrategy: 'NO_OVERAGE' | 'ALLOW_1_25X_OVERAGE' | 'ALLOW_1_5X_OVERAGE' | 'ALLOW_2X_OVERAGE' | 'ALWAYS_ALLOW_OVERAGE';
    scheme: 'ED25519_SIGN' | 'RSA_2048_PKCS1_ENCRYPT' | 'RSA_2048_PKCS1_SIGN' | 'RSA_2048_PKCS1_PSS_SIGN' | 'RSA_2048_JWT_RS256' | null;
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
export interface Process extends KeygenResource {
  type: 'processes';
  attributes: {
    pid: number;
    name?: string;
    platform?: string;
    created: string;
    updated: string;
  };
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
export interface LicenseFilters extends PaginationOptions {
  user?: string;
  policy?: string;
  group?: string;
  product?: string;
  status?: License['attributes']['status'];
  key?: string;
  encrypted?: boolean;
  suspended?: boolean;
  metadata?: Record<string, string>;
}

export interface MachineFilters extends PaginationOptions {
  license?: string;
  user?: string;
  group?: string;
  product?: string;
  policy?: string;
  fingerprint?: string;
  ip?: string;
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