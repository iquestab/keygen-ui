import { KeygenClient } from '../client';
import { Channel, ChannelFilters, KeygenResponse, KeygenListResponse } from '../../types/keygen';

/**
 * Channels are read-only — they're automatically populated by current releases
 * and their artifacts, not created/updated/deleted directly.
 */
export class ChannelResource {
  constructor(private client: KeygenClient) {}

  /**
   * List all channels
   */
  async list(filters: ChannelFilters = {}): Promise<KeygenListResponse<Channel>> {
    const params = {
      ...this.client.buildPaginationParams(filters),
    };

    return this.client.request<Channel[]>('/channels', { params });
  }

  /**
   * Get a specific channel by key
   */
  async get(channelKey: string): Promise<KeygenResponse<Channel>> {
    return this.client.request<Channel>(`/channels/${channelKey}`);
  }
}
