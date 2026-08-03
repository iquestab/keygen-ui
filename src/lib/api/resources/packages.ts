import { KeygenClient } from '../client';
import { Package, PackageFilters, KeygenResponse, KeygenListResponse } from '../../types/keygen';

export class PackageResource {
  constructor(private client: KeygenClient) {}

  /**
   * List all packages
   */
  async list(filters: PackageFilters = {}): Promise<KeygenListResponse<Package>> {
    const params = {
      ...this.client.buildPaginationParams(filters),
    };

    if (filters.product) params.product = filters.product;

    return this.client.request<Package[]>('/packages', { params });
  }

  /**
   * Get a specific package by ID
   */
  async get(packageId: string): Promise<KeygenResponse<Package>> {
    return this.client.request<Package>(`/packages/${packageId}`);
  }

  /**
   * Create a new package
   */
  async create(data: {
    key: string;
    name?: string;
    engine?: 'pypi' | 'npm' | 'rubygems' | 'tauri' | 'oci' | 'raw' | null;
    productId: string;
    metadata?: Record<string, unknown>;
  }): Promise<KeygenResponse<Package>> {
    const { productId, ...attributes } = data;

    return this.client.request<Package>('/packages', {
      method: 'POST',
      body: {
        data: {
          type: 'packages',
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
   * Update a package
   */
  async update(packageId: string, data: {
    key?: string;
    name?: string;
    engine?: 'pypi' | 'npm' | 'rubygems' | 'tauri' | 'oci' | 'raw' | null;
    metadata?: Record<string, unknown>;
  }): Promise<KeygenResponse<Package>> {
    return this.client.request<Package>(`/packages/${packageId}`, {
      method: 'PATCH',
      body: {
        data: {
          type: 'packages',
          id: packageId,
          attributes: data
        }
      }
    });
  }

  /**
   * Delete a package
   */
  async delete(packageId: string): Promise<void> {
    await this.client.request<void>(`/packages/${packageId}`, {
      method: 'DELETE'
    });
  }
}
