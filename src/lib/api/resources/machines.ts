import { KeygenClient } from '../client';
import {
  Machine,
  MachineFilters,
  Component,
  Process,
  KeygenResponse,
  KeygenListResponse,
  PaginationOptions,
} from '@/lib/types/keygen';

/** Encryption + signing pair for a checked-out machine file */
export type MachineFileAlgorithm =
  | 'aes-256-gcm+ed25519'
  | 'aes-256-gcm+ecdsa-p256'
  | 'aes-256-gcm+rsa-pss-sha256'
  | 'aes-256-gcm+rsa-sha256'
  | 'base64+ed25519'
  | 'base64+ecdsa-p256'
  | 'base64+rsa-pss-sha256'
  | 'base64+rsa-sha256';

/**
 * Relationships embeddable in a checked-out machine file. Unlike the license
 * equivalent these include dotted paths reaching through the machine's license.
 */
export type MachineFileInclude =
  | 'license.entitlements'
  | 'license.product'
  | 'license.policy'
  | 'license.owner'
  | 'license.users'
  | 'license'
  | 'owner'
  | 'components'
  | 'environment'
  | 'group';

export class MachineResource {
  constructor(private client: KeygenClient) {}

  /**
   * List all machines
   */
  async list(filters: MachineFilters = {}): Promise<KeygenListResponse<Machine>> {
    const params = {
      ...this.client.buildPaginationParams(filters),
    };

    // Add filter parameters
    if (filters.license) params.license = filters.license;
    if (filters.key) params.key = filters.key;
    if (filters.owner) params.owner = filters.owner;
    if (filters.user) params.user = filters.user;
    if (filters.group) params.group = filters.group;
    if (filters.product) params.product = filters.product;
    if (filters.policy) params.policy = filters.policy;
    if (filters.fingerprint) params.fingerprint = filters.fingerprint;
    if (filters.ip) params.ip = filters.ip;
    if (filters.hostname) params.hostname = filters.hostname;
    if (filters.metadata) {
      for (const [key, value] of Object.entries(filters.metadata)) {
        params[`metadata[${key}]`] = value;
      }
    }

    return this.client.request<Machine[]>('machines', { params });
  }

  /**
   * Get a specific machine by ID
   */
  async get(id: string): Promise<KeygenResponse<Machine>> {
    return this.client.request<Machine>(`machines/${id}`);
  }

  /**
   * Activate a machine (create)
   */
  async activate(machineData: {
    fingerprint: string;
    licenseId: string;
    /** The user that owns the machine */
    ownerId?: string;
    /** Admin/environment/product bearers only */
    groupId?: string;
    name?: string;
    platform?: string;
    hostname?: string;
    cores?: number;
    /** Bytes */
    memory?: number;
    /** Bytes */
    disk?: number;
    ip?: string;
    metadata?: Record<string, unknown>;
  }): Promise<KeygenResponse<Machine>> {
    const body = {
      data: {
        type: 'machines',
        attributes: {
          fingerprint: machineData.fingerprint,
          name: machineData.name,
          platform: machineData.platform,
          hostname: machineData.hostname,
          cores: machineData.cores,
          memory: machineData.memory,
          disk: machineData.disk,
          ip: machineData.ip,
          ...(machineData.metadata ? { metadata: machineData.metadata } : {}),
        },
        relationships: {
          license: {
            data: { type: 'licenses', id: machineData.licenseId },
          },
          ...(machineData.ownerId && {
            owner: {
              data: { type: 'users', id: machineData.ownerId },
            },
          }),
          ...(machineData.groupId && {
            group: {
              data: { type: 'groups', id: machineData.groupId },
            },
          }),
        },
      },
    };

    return this.client.request<Machine>('machines', {
      method: 'POST',
      body,
    });
  }

  /**
   * Update a machine.
   *
   * `requireHeartbeat`, `heartbeatDuration` and `maxProcesses` are deliberately
   * absent — Keygen documents them as read-only (they come from the policy), and
   * sending them is rejected as an unpermitted parameter.
   */
  async update(id: string, updates: {
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
  }): Promise<KeygenResponse<Machine>> {
    const body = {
      data: {
        type: 'machines',
        id,
        attributes: updates,
      },
    };

    return this.client.request<Machine>(`machines/${id}`, {
      method: 'PATCH',
      body,
    });
  }

  /**
   * Deactivate a machine (delete)
   */
  async deactivate(id: string): Promise<void> {
    await this.client.request(`machines/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Check out a signed (and optionally encrypted) offline machine file.
   *
   * `ttl` must be at least 1 hour (3600); Keygen defaults to 2629746 (1 month).
   * It may be `null` for a perpetual, irrevocable file, which Keygen advises
   * against — with no expiry, later changes to the machine or its license never
   * reliably reach the offline install.
   *
   * `encrypt` and `algorithm` are mutually exclusive.
   */
  async checkOut(
    id: string,
    options: {
      ttl?: number | null;
      encrypt?: boolean;
      algorithm?: MachineFileAlgorithm;
      include?: MachineFileInclude[];
    } = {}
  ): Promise<KeygenResponse<Machine>> {
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

    return this.client.request<Machine>(`machines/${id}/actions/check-out`, {
      method: 'POST',
      params,
    });
  }

  /**
   * Ping machine heartbeat
   */
  async ping(id: string): Promise<KeygenResponse<Machine>> {
    return this.client.request<Machine>(`machines/${id}/actions/ping`, {
      method: 'POST',
    });
  }

  /**
   * Reset machine heartbeat
   */
  async resetHeartbeat(id: string): Promise<KeygenResponse<Machine>> {
    return this.client.request<Machine>(`machines/${id}/actions/reset`, {
      method: 'POST',
    });
  }

  /**
   * Get machine processes
   */
  async getProcesses(id: string, options: PaginationOptions = {}): Promise<KeygenListResponse<Process>> {
    return this.client.request<Process[]>(`machines/${id}/processes`, {
      params: this.client.buildPaginationParams(options),
    });
  }

  /**
   * Get machine components
   */
  async getComponents(id: string, options: PaginationOptions = {}): Promise<KeygenListResponse<Component>> {
    return this.client.request<Component[]>(`machines/${id}/components`, {
      params: this.client.buildPaginationParams(options),
    });
  }

  /**
   * Change machine owner
   */
  async changeOwner(id: string, userId: string | null): Promise<KeygenResponse<Machine>> {
    const body = {
      data: userId === null ? null : { type: 'users', id: userId },
    };

    return this.client.request<Machine>(`machines/${id}/owner`, {
      method: 'PUT',
      body,
    });
  }

  /**
   * Change machine group
   */
  async changeGroup(id: string, groupId: string | null): Promise<KeygenResponse<Machine>> {
    const body = {
      data: groupId === null ? null : { type: 'groups', id: groupId },
    };

    return this.client.request<Machine>(`machines/${id}/group`, {
      method: 'PUT',
      body,
    });
  }
}