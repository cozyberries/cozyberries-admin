/**
 * Custom Redis client using direct REST API calls
 * This bypasses the @upstash/redis library which seems to have issues
 */

class DirectRedisClient {
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  private async makeRequest(command: string[], body?: any) {
    try {
      // Upstash Redis REST API expects commands in the body, not in the URL
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(command)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Redis request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      return result.result;
    } catch (error) {
      console.error('Redis request failed:', error);
      throw error;
    }
  }

  async ping() {
    return await this.makeRequest(['ping']);
  }

  async get(key: string) {
    return await this.makeRequest(['get', key]);
  }

  async set(key: string, value: string) {
    return await this.makeRequest(['set', key, value]);
  }

  async setex(key: string, seconds: number, value: string) {
    return await this.makeRequest(['setex', key, seconds.toString(), value]);
  }

  async del(...keys: string[]) {
    return await this.makeRequest(['del', ...keys]);
  }

  async keys(pattern: string) {
    return await this.makeRequest(['keys', pattern]);
  }
}

// Create the direct Redis client
export const directRedis = new DirectRedisClient(
  process.env.UPSTASH_REDIS_REST_URL!,
  process.env.UPSTASH_REDIS_REST_TOKEN!
);
