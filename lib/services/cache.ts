import { UpstashService } from "@/lib/upstash";

/**
 * Centralized cache service for user-specific data
 * Implements TTL-based caching with stale-while-revalidate pattern
 */
export class CacheService {
  // Cache TTL configurations (in seconds)
  private static readonly TTL_CONFIG = {
    WISHLIST: 1800, // 30 minutes
    ORDERS: 900, // 15 minutes
    PROFILE: 3600, // 1 hour
    ADDRESSES: 1800, // 30 minutes
    ORDER_DETAILS: 600, // 10 minutes
  };

  // Cache key prefixes
  private static readonly KEY_PREFIXES = {
    WISHLIST: 'user:wishlist',
    ORDERS: 'user:orders',
    PROFILE: 'user:profile',
    ADDRESSES: 'user:addresses',
    ORDER_DETAILS: 'user:order',
  };

  /**
   * Generate cache key for user-specific data
   */
  private static generateKey(prefix: string, userId: string, suffix?: string): string {
    return suffix ? `${prefix}:${userId}:${suffix}` : `${prefix}:${userId}`;
  }

  /**
   * Generic cache get with TTL information
   */
  private static async getWithTTL<T>(key: string): Promise<{
    data: T | null;
    ttl: number;
    isStale: boolean;
  }> {
    const result = await UpstashService.getWithTTL(key);
    return {
      data: result.data as T | null,
      ttl: result.ttl,
      isStale: result.isStale,
    };
  }

  /**
   * Generic cache set
   */
  private static async set<T>(key: string, data: T, ttl: number): Promise<boolean> {
    return await UpstashService.set(key, data, ttl);
  }

  /**
   * Generic cache delete
   */
  private static async delete(key: string): Promise<boolean> {
    return await UpstashService.delete(key);
  }

  // ============ WISHLIST CACHING ============

  /**
   * Get cached wishlist
   */
  static async getWishlist(userId: string): Promise<{
    data: any[] | null;
    ttl: number;
    isStale: boolean;
  }> {
    const key = this.generateKey(this.KEY_PREFIXES.WISHLIST, userId);
    return await this.getWithTTL<any[]>(key);
  }

  /**
   * Cache wishlist data
   */
  static async setWishlist(userId: string, wishlistData: any[]): Promise<boolean> {
    const key = this.generateKey(this.KEY_PREFIXES.WISHLIST, userId);
    return await this.set(key, wishlistData, this.TTL_CONFIG.WISHLIST);
  }

  /**
   * Clear wishlist cache
   */
  static async clearWishlist(userId: string): Promise<boolean> {
    const key = this.generateKey(this.KEY_PREFIXES.WISHLIST, userId);
    return await this.delete(key);
  }

  // ============ ORDERS CACHING ============

  /**
   * Get cached orders list
   */
  static async getOrders(userId: string, filters?: string): Promise<{
    data: any[] | null;
    ttl: number;
    isStale: boolean;
  }> {
    const suffix = filters ? `list:${filters}` : 'list:default';
    const key = this.generateKey(this.KEY_PREFIXES.ORDERS, userId, suffix);
    return await this.getWithTTL<any[]>(key);
  }

  /**
   * Cache orders list
   */
  static async setOrders(userId: string, ordersData: any[], filters?: string): Promise<boolean> {
    const suffix = filters ? `list:${filters}` : 'list:default';
    const key = this.generateKey(this.KEY_PREFIXES.ORDERS, userId, suffix);
    return await this.set(key, ordersData, this.TTL_CONFIG.ORDERS);
  }

  /**
   * Get cached order details
   */
  static async getOrderDetails(userId: string, orderId: string): Promise<{
    data: any | null;
    ttl: number;
    isStale: boolean;
  }> {
    const key = this.generateKey(this.KEY_PREFIXES.ORDER_DETAILS, userId, orderId);
    return await this.getWithTTL<any>(key);
  }

  /**
   * Cache order details
   */
  static async setOrderDetails(userId: string, orderId: string, orderData: any): Promise<boolean> {
    const key = this.generateKey(this.KEY_PREFIXES.ORDER_DETAILS, userId, orderId);
    return await this.set(key, orderData, this.TTL_CONFIG.ORDER_DETAILS);
  }

  /**
   * Clear all orders cache for a user
   */
  static async clearAllOrders(userId: string): Promise<boolean> {
    const pattern = `${this.KEY_PREFIXES.ORDERS}:${userId}:*`;
    return await UpstashService.deletePattern(pattern);
  }

  /**
   * Clear specific order details cache
   */
  static async clearOrderDetails(userId: string, orderId: string): Promise<boolean> {
    const key = this.generateKey(this.KEY_PREFIXES.ORDER_DETAILS, userId, orderId);
    return await this.delete(key);
  }

  // ============ PROFILE CACHING ============

  /**
   * Get cached profile
   */
  static async getProfile(userId: string): Promise<{
    data: any | null;
    ttl: number;
    isStale: boolean;
  }> {
    const key = this.generateKey(this.KEY_PREFIXES.PROFILE, userId);
    return await this.getWithTTL<any>(key);
  }

  /**
   * Cache profile data
   */
  static async setProfile(userId: string, profileData: any): Promise<boolean> {
    const key = this.generateKey(this.KEY_PREFIXES.PROFILE, userId);
    return await this.set(key, profileData, this.TTL_CONFIG.PROFILE);
  }

  /**
   * Clear profile cache
   */
  static async clearProfile(userId: string): Promise<boolean> {
    const key = this.generateKey(this.KEY_PREFIXES.PROFILE, userId);
    return await this.delete(key);
  }

  // ============ ADDRESSES CACHING ============

  /**
   * Get cached addresses
   */
  static async getAddresses(userId: string): Promise<{
    data: any[] | null;
    ttl: number;
    isStale: boolean;
  }> {
    const key = this.generateKey(this.KEY_PREFIXES.ADDRESSES, userId);
    return await this.getWithTTL<any[]>(key);
  }

  /**
   * Cache addresses data
   */
  static async setAddresses(userId: string, addressesData: any[]): Promise<boolean> {
    const key = this.generateKey(this.KEY_PREFIXES.ADDRESSES, userId);
    return await this.set(key, addressesData, this.TTL_CONFIG.ADDRESSES);
  }

  /**
   * Clear addresses cache
   */
  static async clearAddresses(userId: string): Promise<boolean> {
    const key = this.generateKey(this.KEY_PREFIXES.ADDRESSES, userId);
    return await this.delete(key);
  }

  // ============ UTILITY METHODS ============

  /**
   * Clear all cache for a specific user
   */
  static async clearAllUserCache(userId: string): Promise<boolean> {
    try {
      const patterns = [
        `${this.KEY_PREFIXES.WISHLIST}:${userId}`,
        `${this.KEY_PREFIXES.ORDERS}:${userId}:*`,
        `${this.KEY_PREFIXES.ORDER_DETAILS}:${userId}:*`,
        `${this.KEY_PREFIXES.PROFILE}:${userId}`,
        `${this.KEY_PREFIXES.ADDRESSES}:${userId}`,
      ];

      const results = await Promise.allSettled(
        patterns.map(pattern => UpstashService.deletePattern(pattern))
      );

      // Return true if at least one deletion was successful
      return results.some(result => result.status === 'fulfilled' && result.value);
    } catch (error) {
      console.error('Error clearing all user cache:', error);
      return false;
    }
  }

  /**
   * Get cache statistics for a user
   */
  static async getUserCacheStats(userId: string): Promise<{
    wishlist: { exists: boolean; ttl: number };
    orders: { exists: boolean; ttl: number };
    profile: { exists: boolean; ttl: number };
    addresses: { exists: boolean; ttl: number };
  }> {
    try {
      const [wishlist, orders, profile, addresses] = await Promise.allSettled([
        this.getWishlist(userId),
        this.getOrders(userId),
        this.getProfile(userId),
        this.getAddresses(userId),
      ]);

      return {
        wishlist: {
          exists: wishlist.status === 'fulfilled' && wishlist.value.data !== null,
          ttl: wishlist.status === 'fulfilled' ? wishlist.value.ttl : -1,
        },
        orders: {
          exists: orders.status === 'fulfilled' && orders.value.data !== null,
          ttl: orders.status === 'fulfilled' ? orders.value.ttl : -1,
        },
        profile: {
          exists: profile.status === 'fulfilled' && profile.value.data !== null,
          ttl: profile.status === 'fulfilled' ? profile.value.ttl : -1,
        },
        addresses: {
          exists: addresses.status === 'fulfilled' && addresses.value.data !== null,
          ttl: addresses.status === 'fulfilled' ? addresses.value.ttl : -1,
        },
      };
    } catch (error) {
      console.error('Error getting user cache stats:', error);
      return {
        wishlist: { exists: false, ttl: -1 },
        orders: { exists: false, ttl: -1 },
        profile: { exists: false, ttl: -1 },
        addresses: { exists: false, ttl: -1 },
      };
    }
  }

  /**
   * Generate cache key for debugging purposes
   */
  static getCacheKey(type: keyof typeof CacheService.KEY_PREFIXES, userId: string, suffix?: string): string {
    return this.generateKey(this.KEY_PREFIXES[type], userId, suffix);
  }
}

export default CacheService;
