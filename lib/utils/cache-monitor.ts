/**
 * Cache monitoring and validation utilities
 */

export interface CacheMetrics {
  operation: 'GET' | 'SET' | 'DELETE';
  key: string;
  hit: boolean;
  responseTime: number;
  dataSize?: number;
  source: 'CACHE' | 'DATABASE';
  timestamp: string;
}

export class CacheMonitor {
  private static metrics: CacheMetrics[] = [];
  private static maxMetrics = 1000; // Keep last 1000 operations

  /**
   * Record cache operation metrics
   */
  static recordMetric(metric: CacheMetrics) {
    this.metrics.push(metric);
    
    // Keep only the last maxMetrics entries
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Metrics are stored for analysis via the metrics API
  }

  /**
   * Get cache statistics
   */
  static getStats() {
    const now = Date.now();
    const last24h = this.metrics.filter(m => 
      now - new Date(m.timestamp).getTime() < 24 * 60 * 60 * 1000
    );
    const lastHour = this.metrics.filter(m => 
      now - new Date(m.timestamp).getTime() < 60 * 60 * 1000
    );

    const hitRate24h = last24h.length > 0 
      ? (last24h.filter(m => m.hit).length / last24h.length) * 100 
      : 0;
    
    const hitRateHour = lastHour.length > 0 
      ? (lastHour.filter(m => m.hit).length / lastHour.length) * 100 
      : 0;

    const avgResponseTime = this.metrics.length > 0
      ? this.metrics.reduce((sum, m) => sum + m.responseTime, 0) / this.metrics.length
      : 0;

    return {
      total_operations: this.metrics.length,
      last_24h_operations: last24h.length,
      last_hour_operations: lastHour.length,
      hit_rate_24h: Math.round(hitRate24h * 100) / 100,
      hit_rate_hour: Math.round(hitRateHour * 100) / 100,
      avg_response_time_ms: Math.round(avgResponseTime * 100) / 100,
      recent_operations: this.metrics.slice(-10) // Last 10 operations
    };
  }

  /**
   * Clear stored metrics
   */
  static clearMetrics() {
    this.metrics = [];
  }

  /**
   * Get metrics for a specific key pattern
   */
  static getKeyMetrics(keyPattern: string) {
    const filtered = this.metrics.filter(m => 
      m.key.includes(keyPattern)
    );
    
    const hitRate = filtered.length > 0 
      ? (filtered.filter(m => m.hit).length / filtered.length) * 100 
      : 0;

    return {
      key_pattern: keyPattern,
      operations: filtered.length,
      hit_rate: Math.round(hitRate * 100) / 100,
      operations_list: filtered.slice(-20) // Last 20 operations for this key
    };
  }
}

/**
 * Timing utility for measuring performance
 */
export class PerformanceTimer {
  private startTime: number;
  private label: string;

  constructor(label: string) {
    this.label = label;
    this.startTime = performance.now();
  }

  /**
   * End timing and return elapsed time
   */
  end(): number {
    const endTime = performance.now();
    const elapsed = endTime - this.startTime;
    return elapsed;
  }

  /**
   * Get elapsed time without ending the timer
   */
  peek(): number {
    const currentTime = performance.now();
    return currentTime - this.startTime;
  }
}

/**
 * Wrapper for cache operations with monitoring
 */
export class MonitoredCache {
  /**
   * Get from cache with monitoring
   */
  static async get(key: string, getCacheValue: () => Promise<any>): Promise<{ value: any; wasHit: boolean; responseTime: number }> {
    const timer = new PerformanceTimer(`Cache GET ${key}`);
    
    try {
      const value = await getCacheValue();
      const responseTime = timer.end();
      const wasHit = value !== null && value !== undefined;
      
      CacheMonitor.recordMetric({
        operation: 'GET',
        key,
        hit: wasHit,
        responseTime,
        source: wasHit ? 'CACHE' : 'DATABASE',
        timestamp: new Date().toISOString()
      });

      return { value, wasHit, responseTime };
    } catch (error) {
      const responseTime = timer.end();
      
      CacheMonitor.recordMetric({
        operation: 'GET',
        key,
        hit: false,
        responseTime,
        source: 'DATABASE',
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * Set cache with monitoring
   */
  static async set(key: string, value: any, setCacheValue: (value: any) => Promise<boolean>): Promise<boolean> {
    const timer = new PerformanceTimer(`Cache SET ${key}`);
    
    try {
      const result = await setCacheValue(value);
      const responseTime = timer.end();
      
      CacheMonitor.recordMetric({
        operation: 'SET',
        key,
        hit: true, // SET operations are always considered successful if no error
        responseTime,
        dataSize: JSON.stringify(value).length,
        source: 'CACHE',
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      const responseTime = timer.end();
      
      CacheMonitor.recordMetric({
        operation: 'SET',
        key,
        hit: false,
        responseTime,
        source: 'CACHE',
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }
}
