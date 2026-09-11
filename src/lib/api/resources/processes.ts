import { KeygenClient } from '../client';
import { Process, ProcessFilters, KeygenResponse, KeygenListResponse } from '@/lib/types/keygen';

export class ProcessResource {
  constructor(private client: KeygenClient) {}

  /**
   * List all processes.
   *
   * The list response's `meta.count` is the only way to get a process count —
   * unlike a license's `machines` relationship, a machine's `processes`
   * relationship carries links but no count.
   */
  async list(filters: ProcessFilters = {}): Promise<KeygenListResponse<Process>> {
    const params = {
      ...this.client.buildPaginationParams(filters),
    };

    if (filters.machine) params.machine = filters.machine;
    if (filters.license) params.license = filters.license;
    if (filters.owner) params.owner = filters.owner;
    if (filters.user) params.user = filters.user;
    if (filters.product) params.product = filters.product;

    return this.client.request<Process[]>('processes', { params });
  }

  /**
   * Get a specific process by ID
   */
  async get(id: string): Promise<KeygenResponse<Process>> {
    return this.client.request<Process>(`processes/${id}`);
  }

  /**
   * Spawn a process against a machine.
   *
   * Normally called by the running software rather than an operator — spawning
   * one by hand creates a phantom process that consumes a seat until it is
   * culled for missing heartbeats.
   */
  async spawn(data: {
    /** Arbitrary string, must be unique within the machine */
    pid: string;
    machineId: string;
    metadata?: Record<string, unknown>;
  }): Promise<KeygenResponse<Process>> {
    return this.client.request<Process>('processes', {
      method: 'POST',
      body: {
        data: {
          type: 'processes',
          attributes: {
            pid: data.pid,
            ...(data.metadata ? { metadata: data.metadata } : {}),
          },
          relationships: {
            machine: {
              data: { type: 'machines', id: data.machineId },
            },
          },
        },
      },
    });
  }

  /**
   * Update a process. Only `metadata` is writable, and it is a protected
   * attribute — admin, environment or product bearers only.
   */
  async update(id: string, updates: {
    metadata?: Record<string, unknown>;
  }): Promise<KeygenResponse<Process>> {
    return this.client.request<Process>(`processes/${id}`, {
      method: 'PATCH',
      body: {
        data: {
          type: 'processes',
          id,
          attributes: updates,
        },
      },
    });
  }

  /**
   * Kill (delete) a process, freeing its seat immediately.
   */
  async kill(id: string): Promise<void> {
    await this.client.request(`processes/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Ping a process's heartbeat. Sent by the running software to stay alive;
   * a ping to a dead process within its policy's resurrection window revives it.
   */
  async ping(id: string): Promise<KeygenResponse<Process>> {
    return this.client.request<Process>(`processes/${id}/actions/ping`, {
      method: 'POST',
    });
  }
}
