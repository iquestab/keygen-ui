import { KeygenClient } from '../client';
import { License, LicenseFilters, Entitlement, Machine, User, PaginationOptions, KeygenResponse, KeygenListResponse } from '@/lib/types/keygen';

/**
 * Per-license overrides of the policy's limits. Sending `null` resets the
 * override so the license inherits the policy value again; omitting the key
 * leaves it untouched.
 */
export interface LicenseLimits {
  maxUses?: number | null;
  maxMachines?: number | null;
  maxProcesses?: number | null;
  maxUsers?: number | null;
  maxCores?: number | null;
  maxMemory?: number | null;
  maxDisk?: number | null;
}

const LICENSE_LIMIT_KEYS = [
  'maxUses',
  'maxMachines',
  'maxProcesses',
  'maxUsers',
  'maxCores',
  'maxMemory',
  'maxDisk',
] as const satisfies readonly (keyof LicenseLimits)[];

function buildLicenseLimits(source: LicenseLimits): Record<string, number | null> {
  const limits: Record<string, number | null> = {};
  for (const key of LICENSE_LIMIT_KEYS) {
    const value = source[key];
    // `null` is meaningful here (reset to the policy's value), so only skip undefined
    if (value !== undefined) {
      limits[key] = value;
    }
  }
  return limits;
}

/**
 * Writable license attributes. `null` clears a value (or resets a limit so it
 * inherits from the policy again); omitting a key leaves it untouched.
 */
export interface LicenseUpdateInput extends LicenseLimits {
  name?: string | null;
  metadata?: Record<string, unknown>;
  expiry?: string | null;
  protected?: boolean;
  suspended?: boolean;
  permissions?: string[];
}

/** Validation result codes returned in `meta.code` by the validate actions */
export type LicenseValidationCode =
  | 'VALID'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'OVERDUE'
  | 'NO_MACHINE'
  | 'NO_MACHINES'
  | 'TOO_MANY_MACHINES'
  | 'TOO_MANY_CORES'
  | 'TOO_MUCH_MEMORY'
  | 'TOO_MUCH_DISK'
  | 'TOO_MANY_PROCESSES'
  | 'TOO_MANY_USERS'
  | 'FINGERPRINT_SCOPE_REQUIRED'
  | 'FINGERPRINT_SCOPE_MISMATCH'
  | 'FINGERPRINT_SCOPE_EMPTY'
  | 'COMPONENTS_SCOPE_REQUIRED'
  | 'COMPONENTS_SCOPE_MISMATCH'
  | 'COMPONENTS_SCOPE_EMPTY'
  | 'HEARTBEAT_NOT_STARTED'
  | 'HEARTBEAT_DEAD'
  | 'PRODUCT_SCOPE_REQUIRED'
  | 'PRODUCT_SCOPE_MISMATCH'
  | 'POLICY_SCOPE_REQUIRED'
  | 'POLICY_SCOPE_MISMATCH'
  | 'MACHINE_SCOPE_REQUIRED'
  | 'MACHINE_SCOPE_MISMATCH'
  | 'ENTITLEMENTS_SCOPE_REQUIRED'
  | 'ENTITLEMENTS_SCOPE_MISMATCH'
  | 'USER_SCOPE_REQUIRED'
  | 'USER_SCOPE_MISMATCH'
  | 'CHECKSUM_SCOPE_REQUIRED'
  | 'CHECKSUM_SCOPE_MISMATCH'
  | 'VERSION_SCOPE_REQUIRED'
  | 'VERSION_SCOPE_MISMATCH'
  | 'TOO_MANY_USES'
  | 'BANNED'
  | 'NOT_FOUND';

/**
 * Scope to validate against. A policy may *require* certain scopes
 * (e.g. `requireFingerprintScope`), in which case validation fails without them.
 */
export interface LicenseValidationScope {
  product?: string;
  policy?: string;
  machine?: string;
  /** UUID or email */
  user?: string;
  fingerprint?: string;
  fingerprints?: string[];
  components?: string[];
  entitlements?: string[];
  version?: string;
  checksum?: string;
}

export interface LicenseValidationResult extends KeygenResponse<License> {
  meta?: {
    ts?: string;
    valid?: boolean;
    detail?: string;
    code?: LicenseValidationCode;
    /** Echoed back when a nonce was supplied */
    nonce?: number;
    [key: string]: unknown;
  };
}

/** Encryption + signing pair for a checked-out license file */
export type LicenseFileAlgorithm =
  | 'aes-256-gcm+ed25519'
  | 'aes-256-gcm+ecdsa-p256'
  | 'aes-256-gcm+rsa-pss-sha256'
  | 'aes-256-gcm+rsa-sha256'
  | 'base64+ed25519'
  | 'base64+ecdsa-p256'
  | 'base64+rsa-pss-sha256'
  | 'base64+rsa-sha256';

/**
 * Relationships that can be embedded in a checked-out license file. The bearer
 * must be able to read everything included — a license bearer cannot include
 * `environment`, `product`, `policy` or `owner`.
 */
export type LicenseFileInclude =
  | 'entitlements'
  | 'product'
  | 'policy'
  | 'owner'
  | 'users'
  | 'environment'
  | 'group';

export class LicenseResource {
  constructor(private client: KeygenClient) {}

  /**
   * List all licenses
   */
  async list(filters: LicenseFilters = {}): Promise<KeygenListResponse<License>> {
    const params = {
      ...this.client.buildPaginationParams(filters),
    };

    // Relationship filters
    if (filters.owner) params.owner = filters.owner;
    if (filters.user) params.user = filters.user;
    if (filters.policy) params.policy = filters.policy;
    if (filters.group) params.group = filters.group;
    if (filters.product) params.product = filters.product;
    if (filters.machine) params.machine = filters.machine;

    if (filters.status) params.status = filters.status;

    // Assignment / activation filters
    if (filters.unassigned !== undefined) params.unassigned = filters.unassigned;
    if (filters.assigned !== undefined) params.assigned = filters.assigned;
    if (filters.activated !== undefined) params.activated = filters.activated;

    // Object filters — the client serializes these to expires[in]=30d,
    // activations[gt]=3, etc.
    if (filters.expires) params.expires = filters.expires;
    if (filters.expired) params.expired = filters.expired;
    if (filters.activity) params.activity = filters.activity;
    if (filters.activations) params.activations = filters.activations;

    if (filters.metadata) {
      for (const [key, value] of Object.entries(filters.metadata)) {
        params[`metadata[${key}]`] = value;
      }
    }

    return this.client.request<License[]>('licenses', { params });
  }

  /**
   * Get a specific license by ID
   */
  async get(id: string): Promise<KeygenResponse<License>> {
    return this.client.request<License>(`licenses/${id}`);
  }

  /**
   * Create a new license
   */
  async create(licenseData: {
    policyId: string;
    /** The user that owns the license (the `owner` relationship) */
    ownerId?: string;
    groupId?: string;
    name?: string;
    metadata?: Record<string, unknown>;
    expiry?: string;
    key?: string;
    protected?: boolean;
    suspended?: boolean;
    permissions?: string[];
    // Per-license overrides of the policy's limits — omit to inherit
    maxUses?: number;
    maxMachines?: number;
    maxProcesses?: number;
    maxUsers?: number;
    maxCores?: number;
    /** Bytes */
    maxMemory?: number;
    /** Bytes */
    maxDisk?: number;
  }): Promise<KeygenResponse<License>> {
    const body = {
      data: {
        type: 'licenses',
        attributes: {
          name: licenseData.name,
          metadata: licenseData.metadata || {},
          expiry: licenseData.expiry,
          ...buildLicenseLimits(licenseData),
          ...(licenseData.key ? { key: licenseData.key } : {}),
          ...(licenseData.protected !== undefined ? { protected: licenseData.protected } : {}),
          ...(licenseData.suspended !== undefined ? { suspended: licenseData.suspended } : {}),
          ...(licenseData.permissions && licenseData.permissions.length > 0
            ? { permissions: licenseData.permissions }
            : {}),
        },
        relationships: {
          policy: {
            data: { type: 'policies', id: licenseData.policyId },
          },
          ...(licenseData.ownerId && {
            owner: {
              data: { type: 'users', id: licenseData.ownerId },
            },
          }),
          ...(licenseData.groupId && {
            group: {
              data: { type: 'groups', id: licenseData.groupId },
            },
          }),
        },
      },
    };

    return this.client.request<License>('licenses', {
      method: 'POST',
      body,
    });
  }

  /**
   * List the users attached to a license. This is the many-to-many `users`
   * relationship, which is separate from the license's single `owner`.
   */
  async getUsers(id: string, options: PaginationOptions = {}): Promise<KeygenListResponse<User>> {
    return this.client.request<User[]>(`licenses/${id}/users`, {
      params: this.client.buildPaginationParams(options),
    });
  }

  /**
   * Attach users to license (many-to-many users relationship)
   */
  async attachUsers(id: string, userIds: string[]): Promise<KeygenResponse<unknown>> {
    const body = {
      data: userIds.map(userId => ({
        type: 'users',
        id: userId,
      })),
    };

    return this.client.request(`licenses/${id}/users`, {
      method: 'POST',
      body,
    });
  }

  /**
   * Detach users from license
   */
  async detachUsers(id: string, userIds: string[]): Promise<void> {
    const body = {
      data: userIds.map(userId => ({
        type: 'users',
        id: userId,
      })),
    };

    await this.client.request(`licenses/${id}/users`, {
      method: 'DELETE',
      body,
    });
  }

  /**
   * Update a license
   */
  async update(id: string, updates: LicenseUpdateInput): Promise<KeygenResponse<License>> {
    const body = {
      data: {
        type: 'licenses',
        id,
        attributes: updates,
      },
    };

    return this.client.request<License>(`licenses/${id}`, {
      method: 'PATCH',
      body,
    });
  }

  /**
   * Delete a license
   */
  async delete(id: string): Promise<void> {
    await this.client.request(`licenses/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Suspend a license
   */
  async suspend(id: string): Promise<KeygenResponse<License>> {
    return this.client.request<License>(`licenses/${id}/actions/suspend`, {
      method: 'POST',
    });
  }

  /**
   * Reinstate a license
   */
  async reinstate(id: string): Promise<KeygenResponse<License>> {
    return this.client.request<License>(`licenses/${id}/actions/reinstate`, {
      method: 'POST',
    });
  }

  /**
   * Renew a license
   */
  async renew(id: string): Promise<KeygenResponse<License>> {
    return this.client.request<License>(`licenses/${id}/actions/renew`, {
      method: 'POST',
    });
  }

  /**
   * Validate a license by ID.
   *
   * Checks suspension, expiry, check-in overdue status and machine requirements.
   * The outcome is in `meta.valid` / `meta.code` — note that a *failed*
   * validation still returns HTTP 200, so callers must inspect `meta`, not
   * rely on the request throwing.
   */
  async validate(
    id: string,
    options: { scope?: LicenseValidationScope; nonce?: number } = {}
  ): Promise<LicenseValidationResult> {
    const meta: Record<string, unknown> = {};
    if (options.scope && Object.keys(options.scope).length > 0) {
      meta.scope = options.scope;
    }
    if (options.nonce !== undefined) {
      meta.nonce = options.nonce;
    }

    // The response carries the verdict in `meta`, which the generic
    // KeygenResponse types only as Record<string, unknown>.
    const response = await this.client.request<License>(`licenses/${id}/actions/validate`, {
      method: 'POST',
      ...(Object.keys(meta).length > 0 ? { body: { meta } } : {}),
    });

    return response as LicenseValidationResult;
  }

  /**
   * Validate a license by key, without needing its ID. Unlike the other
   * license endpoints this is not scoped to an ID, so it can be called with
   * nothing but the key a customer pasted in.
   *
   * As with `validate()`, an invalid license comes back as HTTP 200 with
   * `meta.valid === false`.
   */
  async validateKey(
    key: string,
    options: { scope?: LicenseValidationScope; nonce?: number } = {}
  ): Promise<LicenseValidationResult> {
    const meta: Record<string, unknown> = { key };
    if (options.scope && Object.keys(options.scope).length > 0) {
      meta.scope = options.scope;
    }
    if (options.nonce !== undefined) {
      meta.nonce = options.nonce;
    }

    const response = await this.client.request<License>('licenses/actions/validate-key', {
      method: 'POST',
      body: { meta },
    });

    return response as LicenseValidationResult;
  }

  /**
   * Revoke (delete) a license. Unlike `delete()`, this also immediately deletes
   * every machine associated with the license. Cannot be undone.
   *
   * Note this is a DELETE, not a POST like the other actions.
   */
  async revoke(id: string): Promise<void> {
    await this.client.request(`licenses/${id}/actions/revoke`, {
      method: 'DELETE',
    });
  }

  /**
   * Check in a license, setting `lastCheckIn` to now and `nextCheckIn`
   * according to the policy's check-in interval. Only meaningful for licenses
   * whose policy sets `requireCheckIn` — those fail validation once overdue.
   */
  async checkIn(id: string): Promise<KeygenResponse<License>> {
    return this.client.request<License>(`licenses/${id}/actions/check-in`, {
      method: 'POST',
    });
  }

  /**
   * Increment license usage
   */
  async incrementUsage(id: string, increment = 1): Promise<KeygenResponse<License>> {
    const body = {
      meta: { increment },
    };

    return this.client.request<License>(`licenses/${id}/actions/increment-usage`, {
      method: 'POST',
      body,
    });
  }

  /**
   * Decrement license usage
   */
  async decrementUsage(id: string, decrement = 1): Promise<KeygenResponse<License>> {
    const body = {
      meta: { decrement },
    };

    return this.client.request<License>(`licenses/${id}/actions/decrement-usage`, {
      method: 'POST',
      body,
    });
  }

  /**
   * Reset license usage
   */
  async resetUsage(id: string): Promise<KeygenResponse<License>> {
    return this.client.request<License>(`licenses/${id}/actions/reset-usage`, {
      method: 'POST',
    });
  }

  /**
   * Generate activation token for license
   */
  async generateActivationToken(id: string, ttl = 3600): Promise<KeygenResponse<unknown>> {
    const body = {
      data: {
        type: 'tokens',
        attributes: {
          expiry: new Date(Date.now() + ttl * 1000).toISOString(),
        },
      },
    };

    return this.client.request(`licenses/${id}/tokens`, {
      method: 'POST',
      body,
    });
  }

  /**
   * Get license entitlements
   */
  async getEntitlements(id: string): Promise<KeygenListResponse<Entitlement>> {
    return this.client.request<Entitlement[]>(`licenses/${id}/entitlements`);
  }

  /**
   * Attach entitlements to license
   */
  async attachEntitlements(id: string, entitlementIds: string[]): Promise<KeygenResponse<unknown>> {
    const body = {
      data: entitlementIds.map(entitlementId => ({
        type: 'entitlements',
        id: entitlementId,
      })),
    };

    return this.client.request(`licenses/${id}/entitlements`, {
      method: 'POST',
      body,
    });
  }

  /**
   * Detach entitlements from license
   */
  async detachEntitlements(id: string, entitlementIds: string[]): Promise<void> {
    const body = {
      data: entitlementIds.map(entitlementId => ({
        type: 'entitlements',
        id: entitlementId,
      })),
    };

    await this.client.request(`licenses/${id}/entitlements`, {
      method: 'DELETE',
      body,
    });
  }

  /**
   * Get the machines activated against this license
   */
  async getMachines(id: string, options: PaginationOptions = {}): Promise<KeygenListResponse<Machine>> {
    return this.client.request<Machine[]>(`licenses/${id}/machines`, {
      params: this.client.buildPaginationParams(options),
    });
  }

  /**
   * Change license policy
   */
  async changePolicy(id: string, policyId: string): Promise<KeygenResponse<License>> {
    const body = {
      data: { type: 'policies', id: policyId },
    };

    return this.client.request<License>(`licenses/${id}/policy`, {
      method: 'PUT',
      body,
    });
  }

  /**
   * Change the license's owner. Pass `null` to unassign the current owner.
   */
  async changeOwner(id: string, userId: string | null): Promise<KeygenResponse<License>> {
    const body = {
      data: userId === null ? null : { type: 'users', id: userId },
    };

    return this.client.request<License>(`licenses/${id}/owner`, {
      method: 'PUT',
      body,
    });
  }

  /**
   * Change license group
   */
  async changeGroup(id: string, groupId: string | null): Promise<KeygenResponse<License>> {
    const body = {
      data: groupId === null ? null : { type: 'groups', id: groupId },
    };

    return this.client.request<License>(`licenses/${id}/group`, {
      method: 'PUT',
      body,
    });
  }

  /**
   * Check out a signed (and optionally encrypted) offline license file.
   * Requires the license's policy to have a cryptographic scheme configured.
   *
   * `ttl` is optional and must be at least 1 hour (3600); Keygen defaults to
   * 2629746 (1 month). It may be set to `null` for a perpetual, irrevocable
   * file, which Keygen recommends against: with no expiry, later changes to
   * the license (expiry, suspension, metadata) are never guaranteed to reach
   * the offline install, since no re-checkout is ever required.
   *
   * `encrypt` and `algorithm` are mutually exclusive — `encrypt` uses
   * AES-256-GCM with a SHA256 digest of the license key as the secret, while
   * `algorithm` names the encryption/signing pair explicitly.
   */
  async checkOut(
    id: string,
    options: {
      ttl?: number | null;
      encrypt?: boolean;
      algorithm?: LicenseFileAlgorithm;
      include?: LicenseFileInclude[];
    } = {}
  ): Promise<KeygenResponse<License>> {
    if (options.encrypt && options.algorithm) {
      throw new Error('checkOut: `encrypt` and `algorithm` cannot be used together');
    }

    const params: Record<string, unknown> = {};
    if (options.ttl === null) {
      params.ttl = 'null';
    } else if (options.ttl) {
      params.ttl = options.ttl;
    }
    if (options.encrypt) params.encrypt = true;
    if (options.algorithm) params.algorithm = options.algorithm;
    if (options.include && options.include.length > 0) params.include = options.include.join(',');

    return this.client.request<License>(`licenses/${id}/actions/check-out`, {
      method: 'POST',
      params,
    });
  }
}
