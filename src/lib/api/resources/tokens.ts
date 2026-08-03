import { KeygenClient } from '../client';
import { Token, KeygenResponse, KeygenListResponse, PaginationOptions } from '../../types/keygen';

export class TokenResource {
  constructor(private client: KeygenClient) {}

  /**
   * List tokens scoped to the authenticated bearer (i.e. the current user's own API keys)
   */
  async list(filters: PaginationOptions = {}): Promise<KeygenListResponse<Token>> {
    const params = {
      ...this.client.buildPaginationParams(filters),
    };

    return this.client.request<Token[]>('tokens', { params });
  }

  /**
   * Get a specific token by ID
   */
  async get(id: string): Promise<KeygenResponse<Token>> {
    return this.client.request<Token>(`tokens/${id}`);
  }

  /**
   * Generate a new token (API key) for the authenticated bearer.
   * The raw secret (attributes.token) is only ever returned in this response.
   */
  async create(data: {
    name?: string;
    expiry?: string;
    permissions?: string[];
  } = {}): Promise<KeygenResponse<Token>> {
    const body = {
      data: {
        type: 'tokens',
        attributes: {
          ...(data.name && { name: data.name }),
          ...(data.expiry && { expiry: data.expiry }),
          permissions: data.permissions && data.permissions.length > 0 ? data.permissions : ['*'],
        },
      },
    };

    return this.client.request<Token>('tokens', {
      method: 'POST',
      body,
    });
  }

  /**
   * Regenerate a token — rotates its secret (and extends its expiry).
   * The new raw secret is only ever returned in this response.
   */
  async regenerate(id: string): Promise<KeygenResponse<Token>> {
    return this.client.request<Token>(`tokens/${id}`, {
      method: 'PUT',
    });
  }

  /**
   * Revoke (delete) a token
   */
  async revoke(id: string): Promise<void> {
    await this.client.request(`tokens/${id}`, {
      method: 'DELETE',
    });
  }
}
