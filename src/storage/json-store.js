const fs = require("node:fs/promises");
const path = require("node:path");
const { COLLECTIONS, DATA_DIR } = require("../config");
const { cloneJson } = require("../utils/time");

class JsonStore {
  constructor(options = {}) {
    this.dataDir = options.dataDir || DATA_DIR;
    this.definitions = options.definitions || COLLECTIONS;
    this.queue = Promise.resolve();
  }

  async initialize() {
    await fs.mkdir(this.dataDir, { recursive: true });
    const keys = Object.keys(this.definitions);
    await Promise.all(
      keys.map(async (key) => {
        const filePath = this.getFilePath(key);
        try {
          await fs.access(filePath);
        } catch {
          await this.write(key, cloneJson(this.definitions[key].defaultValue));
        }
      })
    );
  }

  getFilePath(key) {
    const definition = this.definitions[key];
    if (!definition) {
      throw new Error(`Unknown collection: ${key}`);
    }

    return path.join(this.dataDir, definition.file);
  }

  async read(key) {
    const filePath = this.getFilePath(key);
    const definition = this.definitions[key];
    const raw = await fs.readFile(filePath, "utf8");

    if (!raw.trim()) {
      return cloneJson(definition.defaultValue);
    }

    return JSON.parse(raw);
  }

  async readMany(keys) {
    const pairs = await Promise.all(
      keys.map(async (key) => [key, await this.read(key)])
    );

    return Object.fromEntries(pairs);
  }

  async write(key, value) {
    const filePath = this.getFilePath(key);
    await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  async transact(keys, handler) {
    const uniqueKeys = [...new Set(keys)];
    const operation = async () => {
      const draft = cloneJson(await this.readMany(uniqueKeys));
      const result = await handler(draft);
      await Promise.all(uniqueKeys.map((key) => this.write(key, draft[key])));
      return result;
    };

    const current = this.queue.then(operation, operation);
    this.queue = current.then(
      () => undefined,
      () => undefined
    );
    return current;
  }
}

module.exports = {
  JsonStore
};
