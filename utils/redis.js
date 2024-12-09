import { createClient } from 'redis';

class RedisClient {
  constructor() {
    // Initialize Redis client
    this.client = createClient();

    // Handle connection errors
    this.client.on('error', (error) => {
      console.error(`Redis client error: ${error}`);
    });
  }

  /**
   * Checks if the Redis client is connected
   * @returns {boolean} - True if the connection is alive, false otherwise
   */
  isAlive() {
    return this.client.connected;
  }

  /**
   * Retrieves a value from Redis by key
   * @param {string} key - The key to retrieve
   * @returns {Promise<string|null>} - The value associated with the key, or null if not found
   */
  async get(key) {
    return new Promise((resolve, reject) => {
      this.client.get(key, (err, value) => {
        if (err) {
          reject(err);
        } else {
          resolve(value);
        }
      });
    });
  }

  /**
   * Stores a key-value pair in Redis with an expiration time
   * @param {string} key - The key to store
   * @param {string|number} value - The value to store
   * @param {number} duration - Expiration time in seconds
   * @returns {Promise<void>}
   */
  async set(key, value, duration) {
    return new Promise((resolve, reject) => {
      this.client.set(key, value, 'EX', duration, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Deletes a key-value pair from Redis
   * @param {string} key - The key to delete
   * @returns {Promise<void>}
   */
  async del(key) {
    return new Promise((resolve, reject) => {
      this.client.del(key, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

// Export an instance of the RedisClient class
const redisClient = new RedisClient();
export default redisClient;
