import { KeygenClient } from '../client';
import { Release, ReleaseFilters, Constraint, KeygenResponse, KeygenListResponse } from '../../types/keygen';

export class ReleaseResource {
  constructor(private client: KeygenClient) {}

  /**
   * List all releases
   */
  async list(filters: ReleaseFilters = {}): Promise<KeygenListResponse<Release>> {
    const params = {
      ...this.client.buildPaginationParams(filters),
    };

    if (filters.product) params.product = filters.product;
    if (filters.package) params.package = filters.package;
    if (filters.status) params.status = filters.status;
    if (filters.channel) params.channel = filters.channel;

    return this.client.request<Release[]>('/releases', { params });
  }

  /**
   * Get a specific release by ID
   */
  async get(releaseId: string): Promise<KeygenResponse<Release>> {
    return this.client.request<Release>(`/releases/${releaseId}`);
  }

  /**
   * Create a new release
   */
  async create(data: {
    version: string;
    channel: 'stable' | 'rc' | 'beta' | 'alpha' | 'dev';
    name?: string;
    tag?: string;
    description?: string;
    backdated?: string;
    metadata?: Record<string, unknown>;
    productId: string;
    packageId?: string;
  }): Promise<KeygenResponse<Release>> {
    const { productId, packageId, ...attributes } = data;

    return this.client.request<Release>('/releases', {
      method: 'POST',
      body: {
        data: {
          type: 'releases',
          attributes,
          relationships: {
            product: {
              data: {
                type: 'products',
                id: productId
              }
            },
            ...(packageId && {
              package: {
                data: {
                  type: 'packages',
                  id: packageId
                }
              }
            })
          }
        }
      }
    });
  }

  /**
   * Update a release
   */
  async update(releaseId: string, data: {
    name?: string;
    tag?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<KeygenResponse<Release>> {
    return this.client.request<Release>(`/releases/${releaseId}`, {
      method: 'PATCH',
      body: {
        data: {
          type: 'releases',
          id: releaseId,
          attributes: data
        }
      }
    });
  }

  /**
   * Delete a release
   */
  async delete(releaseId: string): Promise<void> {
    await this.client.request<void>(`/releases/${releaseId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Publish a draft release, making it available for distribution
   */
  async publish(releaseId: string): Promise<KeygenResponse<Release>> {
    return this.client.request<Release>(`/releases/${releaseId}/actions/publish`, {
      method: 'POST'
    });
  }

  /**
   * Yank a published release, delisting it without deleting it
   */
  async yank(releaseId: string): Promise<KeygenResponse<Release>> {
    return this.client.request<Release>(`/releases/${releaseId}/actions/yank`, {
      method: 'POST'
    });
  }

  /**
   * List entitlement constraints attached to a release
   */
  async getConstraints(releaseId: string): Promise<KeygenListResponse<Constraint>> {
    return this.client.request<Constraint[]>(`/releases/${releaseId}/constraints`);
  }

  /**
   * Attach entitlement constraints to a release — a license/user must possess every
   * constrained entitlement to download or upgrade to this release.
   */
  async attachConstraints(releaseId: string, entitlementIds: string[]): Promise<KeygenListResponse<Constraint>> {
    const body = {
      data: entitlementIds.map(entitlementId => ({
        type: 'constraints',
        relationships: {
          entitlement: {
            data: {
              type: 'entitlements',
              id: entitlementId,
            }
          }
        }
      })),
    };

    return this.client.request<Constraint[]>(`/releases/${releaseId}/constraints`, {
      method: 'POST',
      body,
    });
  }

  /**
   * Detach entitlement constraints from a release. Takes constraint IDs (from
   * getConstraints), not entitlement IDs — a constraint is its own resource.
   */
  async detachConstraints(releaseId: string, constraintIds: string[]): Promise<void> {
    const body = {
      data: constraintIds.map(constraintId => ({
        type: 'constraints',
        id: constraintId,
      })),
    };

    await this.client.request<void>(`/releases/${releaseId}/constraints`, {
      method: 'DELETE',
      body,
    });
  }
}
