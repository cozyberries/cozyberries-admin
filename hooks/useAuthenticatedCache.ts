import { useCallback } from 'react';
import { useAuth } from '@/components/supabase-auth-provider';

/**
 * Hook for authenticated cache operations
 * Provides utilities for cache debugging and management
 */
export function useAuthenticatedCache() {
  const { user } = useAuth();

  /**
   * Get cache statistics for the current user
   */
  const getCacheStats = useCallback(async () => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch('/api/debug/user-cache?action=stats');
      if (!response.ok) {
        throw new Error('Failed to fetch cache stats');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching cache stats:', error);
      throw error;
    }
  }, [user]);

  /**
   * Get cache keys for the current user
   */
  const getCacheKeys = useCallback(async () => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch('/api/debug/user-cache?action=keys');
      if (!response.ok) {
        throw new Error('Failed to fetch cache keys');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching cache keys:', error);
      throw error;
    }
  }, [user]);

  /**
   * Clear all cache for the current user
   */
  const clearUserCache = useCallback(async () => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch('/api/debug/user-cache?confirm=true', {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to clear cache');
      }
      return await response.json();
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }, [user]);

  /**
   * Check if response came from cache
   */
  const isFromCache = useCallback((response: Response) => {
    const cacheStatus = response.headers.get('X-Cache-Status');
    return cacheStatus === 'HIT' || cacheStatus === 'STALE';
  }, []);

  /**
   * Get cache information from response headers
   */
  const getCacheInfo = useCallback((response: Response) => {
    return {
      status: response.headers.get('X-Cache-Status'),
      key: response.headers.get('X-Cache-Key'),
      source: response.headers.get('X-Data-Source'),
      ttl: response.headers.get('X-Cache-TTL'),
      isFromCache: isFromCache(response),
    };
  }, [isFromCache]);

  return {
    getCacheStats,
    getCacheKeys,
    clearUserCache,
    isFromCache,
    getCacheInfo,
    isAuthenticated: !!user,
  };
}

export default useAuthenticatedCache;
