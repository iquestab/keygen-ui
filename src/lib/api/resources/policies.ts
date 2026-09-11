import { KeygenClient } from '../client';
import {
  Policy,
  PolicyLimits,
  PolicyScopeRequirements,
  PolicyHeartbeatCullStrategy,
  PolicyHeartbeatResurrectionStrategy,
  PolicyHeartbeatBasis,
  PolicyMachineUniquenessStrategy,
  PolicyMachineMatchingStrategy,
  PolicyComponentUniquenessStrategy,
  PolicyComponentMatchingStrategy,
  PolicyExpirationStrategy,
  PolicyExpirationBasis,
  PolicyRenewalBasis,
  PolicyTransferStrategy,
  PolicyAuthenticationStrategy,
  PolicyMachineLeasingStrategy,
  PolicyProcessLeasingStrategy,
  PolicyOverageStrategy,
  PolicyCheckInInterval,
  PolicyScheme,
  Entitlement,
  KeygenResponse,
  PaginationOptions,
  KeygenListResponse,
} from '../../types/keygen';

export interface PolicyFilters extends PaginationOptions {
  /** The identifier (UUID) of the product to filter by */
  product?: string;
}

/**
 * Policy attributes that can be changed after creation. `usePool` and `scheme`
 * are deliberately absent — Keygen fixes both at creation time.
 */
export interface PolicyUpdateInput extends PolicyLimits, PolicyScopeRequirements {
  name?: string;
  duration?: number | null;
  strict?: boolean;
  floating?: boolean;
  protected?: boolean;
  requireCheckIn?: boolean;
  checkInInterval?: PolicyCheckInInterval;
  checkInIntervalCount?: number;
  requireHeartbeat?: boolean;
  heartbeatDuration?: number;
  heartbeatCullStrategy?: PolicyHeartbeatCullStrategy;
  heartbeatResurrectionStrategy?: PolicyHeartbeatResurrectionStrategy;
  heartbeatBasis?: PolicyHeartbeatBasis;
  machineUniquenessStrategy?: PolicyMachineUniquenessStrategy;
  machineMatchingStrategy?: PolicyMachineMatchingStrategy;
  componentUniquenessStrategy?: PolicyComponentUniquenessStrategy;
  componentMatchingStrategy?: PolicyComponentMatchingStrategy;
  expirationStrategy?: PolicyExpirationStrategy;
  expirationBasis?: PolicyExpirationBasis;
  renewalBasis?: PolicyRenewalBasis;
  transferStrategy?: PolicyTransferStrategy;
  authenticationStrategy?: PolicyAuthenticationStrategy;
  machineLeasingStrategy?: PolicyMachineLeasingStrategy;
  processLeasingStrategy?: PolicyProcessLeasingStrategy;
  overageStrategy?: PolicyOverageStrategy;
  metadata?: Record<string, unknown>;
}

export interface PolicyCreateInput extends PolicyUpdateInput {
  name: string;
  productId: string;
  /**
   * Pull license keys from a finite pool of pre-determined keys.
   * Cannot be changed later.
   */
  usePool?: boolean;
  /**
   * Cryptographic signing scheme used for offline license/machine files.
   * Cannot be changed later.
   */
  scheme?: PolicyScheme;
}

/** A key popped off a policy's pre-determined key pool */
export interface PolicyPoolKey {
  id: string;
  type: 'keys';
  attributes: {
    key: string;
    created: string;
    updated: string;
  };
}

export class PolicyResource {
  constructor(private client: KeygenClient) {}

  /**
   * List all policies
   */
  async list(filters: PolicyFilters = {}): Promise<KeygenListResponse<Policy>> {
    const params = {
      ...this.client.buildPaginationParams(filters),
    };

    if (filters.product) params.product = filters.product;

    return this.client.request<Policy[]>('/policies', { params });
  }

  /**
   * Get a specific policy by ID
   */
  async get(policyId: string): Promise<KeygenResponse<Policy>> {
    return this.client.request<Policy>(`/policies/${policyId}`);
  }

  /**
   * Create a new policy
   */
  async create(data: PolicyCreateInput): Promise<KeygenResponse<Policy>> {
    const { productId, ...attributes } = data;

    return this.client.request<Policy>('/policies', {
      method: 'POST',
      body: {
        data: {
          type: 'policies',
          attributes,
          relationships: {
            product: {
              data: {
                type: 'products',
                id: productId
              }
            }
          }
        }
      }
    });
  }

  /**
   * Update a policy
   */
  async update(policyId: string, data: PolicyUpdateInput): Promise<KeygenResponse<Policy>> {
    return this.client.request<Policy>(`/policies/${policyId}`, {
      method: 'PATCH',
      body: {
        data: {
          type: 'policies',
          id: policyId,
          attributes: data
        }
      }
    });
  }

  /**
   * Delete a policy
   */
  async delete(policyId: string): Promise<void> {
    await this.client.request<void>(`/policies/${policyId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Pop a key off the policy's pool of pre-determined keys, deleting it.
   * Only meaningful for policies created with `usePool: true`.
   *
   * Returns 200 with the popped key rather than 204, so the key is readable
   * once — it is gone from the pool afterwards.
   */
  async popPoolKey(policyId: string): Promise<KeygenResponse<PolicyPoolKey>> {
    return this.client.request<PolicyPoolKey>(`/policies/${policyId}/pool`, {
      method: 'DELETE'
    });
  }

  /**
   * List entitlements attached to a policy
   */
  async getEntitlements(policyId: string): Promise<KeygenListResponse<Entitlement>> {
    return this.client.request<Entitlement[]>(`/policies/${policyId}/entitlements`);
  }

  /**
   * Attach entitlements to a policy
   */
  async attachEntitlements(policyId: string, entitlementIds: string[]): Promise<KeygenResponse<unknown>> {
    const body = {
      data: entitlementIds.map(id => ({
        type: 'entitlements',
        id,
      })),
    };

    return this.client.request(`/policies/${policyId}/entitlements`, {
      method: 'POST',
      body,
    });
  }

  /**
   * Detach entitlements from a policy
   */
  async detachEntitlements(policyId: string, entitlementIds: string[]): Promise<void> {
    const body = {
      data: entitlementIds.map(id => ({
        type: 'entitlements',
        id,
      })),
    };

    await this.client.request(`/policies/${policyId}/entitlements`, {
      method: 'DELETE',
      body,
    });
  }
}