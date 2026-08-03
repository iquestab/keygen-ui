import { KeygenClient } from '../client';
import { Product, KeygenResponse, PaginationOptions, KeygenListResponse } from '../../types/keygen';

export interface ProductFilters extends PaginationOptions {
  name?: string;
}

export class ProductResource {
  constructor(private client: KeygenClient) {}

  /**
   * List all products
   */
  async list(filters: ProductFilters = {}): Promise<KeygenListResponse<Product>> {
    const params = {
      ...this.client.buildPaginationParams(filters),
    };

    if (filters.name) params.name = filters.name;

    return this.client.request<Product[]>('/products', { params });
  }

  /**
   * Get a specific product by ID
   */
  async get(productId: string): Promise<KeygenResponse<Product>> {
    return this.client.request<Product>(`/products/${productId}`);
  }

  /**
   * Create a new product
   */
  async create(data: {
    name: string;
    code?: string;
    url?: string;
    distributionStrategy?: 'LICENSED' | 'OPEN' | 'CLOSED';
    platforms?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<KeygenResponse<Product>> {
    return this.client.request<Product>('/products', {
      method: 'POST',
      body: {
        data: {
          type: 'products',
          attributes: data
        }
      }
    });
  }

  /**
   * Update a product
   */
  async update(productId: string, data: {
    name?: string;
    code?: string;
    url?: string;
    distributionStrategy?: 'LICENSED' | 'OPEN' | 'CLOSED';
    platforms?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<KeygenResponse<Product>> {
    return this.client.request<Product>(`/products/${productId}`, {
      method: 'PATCH',
      body: {
        data: {
          type: 'products',
          id: productId,
          attributes: data
        }
      }
    });
  }

  /**
   * Delete a product
   */
  async delete(productId: string): Promise<void> {
    await this.client.request<void>(`/products/${productId}`, {
      method: 'DELETE'
    });
  }
}