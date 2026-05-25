/**
 * Demo texts for the diff viewer route. Designed to cover equal lines,
 * deleted lines, added lines, modified lines, and multiple hunks so a
 * single click on "Sample" exercises every visual case.
 */

export const SAMPLE_LEFT_TEXT = `// User Management Module
// Version: 1.0.0

import { Logger } from './logger';
import { Database } from './database';

interface User {
  id: number;
  name: string;
  email: string;
}

class UserService {
  private db: Database;
  private logger: Logger;

  constructor(db: Database) {
    this.db = db;
    this.logger = new Logger();
  }

  async getUser(id: number): Promise<User | null> {
    this.logger.info("Fetching user: " + id);
    return this.db.findById(id);
  }

  async deleteUser(id: number): Promise<boolean> {
    this.logger.warn("Deleting user: " + id);
    return this.db.delete(id);
  }
}

export { UserService };`;

export const SAMPLE_RIGHT_TEXT = `// User Management Module
// Version: 2.0.0
// Author: Development Team

import { Logger } from './logger';
import { Database } from './database';
import { Cache } from './cache';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}

class UserService {
  private db: Database;
  private logger: Logger;
  private cache: Cache;

  constructor(db: Database, cache: Cache) {
    this.db = db;
    this.logger = new Logger('UserService');
    this.cache = cache;
  }

  async getUser(id: number): Promise<User | null> {
    const cached = await this.cache.get(\`user:\${id}\`);
    if (cached) return cached;

    this.logger.info(\`Fetching user: \${id}\`);
    const user = await this.db.findById(id);
    if (user) await this.cache.set(\`user:\${id}\`, user);
    return user;
  }

  async createUser(data: Omit<User, 'id'>): Promise<User> {
    this.logger.info('Creating new user');
    return this.db.create(data);
  }
}

export { UserService };
export type { User };`;
