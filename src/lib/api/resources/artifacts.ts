import { KeygenClient } from '../client';
import { Artifact, ArtifactFilters, KeygenResponse, KeygenListResponse } from '../../types/keygen';

export interface ArtifactUploadTarget {
  /** The created artifact record, in WAITING status */
  artifact: Artifact | null;
  /** Pre-signed URL the file bytes must be uploaded to directly (not through our API) */
  uploadUrl: string;
}

export class ArtifactResource {
  constructor(private client: KeygenClient) {}

  /**
   * List all artifacts
   */
  async list(filters: ArtifactFilters = {}): Promise<KeygenListResponse<Artifact>> {
    const params = {
      ...this.client.buildPaginationParams(filters),
    };

    if (filters.release) params.release = filters.release;
    if (filters.product) params.product = filters.product;
    if (filters.channel) params.channel = filters.channel;
    if (filters.filetype) params.filetype = filters.filetype;
    if (filters.platform) params.platform = filters.platform;
    if (filters.arch) params.arch = filters.arch;
    if (filters.status) params.status = filters.status;

    return this.client.request<Artifact[]>('/artifacts', { params });
  }

  /**
   * Get a specific artifact by ID
   */
  async get(artifactId: string): Promise<KeygenResponse<Artifact>> {
    return this.client.request<Artifact>(`/artifacts/${artifactId}`);
  }

  /**
   * Create a new artifact record and get the pre-signed URL to upload its file to.
   *
   * Keygen responds to this with a 307 redirect to S3 rather than a normal JSON:API
   * body. The proxy (src/app/api/keygen/[...path]/route.ts) follows that redirect
   * server-side and translates it into a normal 200 response with `meta.uploadUrl`,
   * since browser `fetch` can't read a `Location` header off a cross-origin redirect
   * response. Use `uploadArtifactFile()` from `@/lib/api/upload` to perform the
   * actual upload against the returned `uploadUrl`.
   */
  async create(data: {
    filename: string;
    filetype: string;
    filesize?: number;
    platform?: string;
    arch?: string;
    signature?: string;
    checksum?: string;
    metadata?: Record<string, unknown>;
    releaseId: string;
  }): Promise<ArtifactUploadTarget> {
    const { releaseId, ...attributes } = data;

    const response = await this.client.request<Artifact | null>('/artifacts', {
      method: 'POST',
      body: {
        data: {
          type: 'artifacts',
          attributes,
          relationships: {
            release: {
              data: {
                type: 'releases',
                id: releaseId
              }
            }
          }
        }
      }
    });

    const uploadUrl = response.meta?.uploadUrl as string | undefined;
    if (!uploadUrl) {
      throw new Error('Keygen did not return an upload URL for this artifact');
    }

    return {
      artifact: response.data ?? null,
      uploadUrl,
    };
  }

  /**
   * Update an artifact
   */
  async update(artifactId: string, data: {
    filesize?: number;
    signature?: string;
    checksum?: string;
    metadata?: Record<string, unknown>;
  }): Promise<KeygenResponse<Artifact>> {
    return this.client.request<Artifact>(`/artifacts/${artifactId}`, {
      method: 'PATCH',
      body: {
        data: {
          type: 'artifacts',
          id: artifactId,
          attributes: data
        }
      }
    });
  }

  /**
   * Delete (yank) an artifact
   */
  async delete(artifactId: string): Promise<void> {
    await this.client.request<void>(`/artifacts/${artifactId}`, {
      method: 'DELETE'
    });
  }
}
