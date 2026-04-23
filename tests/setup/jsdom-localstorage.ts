/**
 * Node 25 ships a partial `localStorage` global that lacks getItem/setItem/removeItem/clear.
 * When vitest uses the jsdom environment, jsdom sets `globalThis === window`, but Node's
 * native localStorage stub shadows jsdom's Storage implementation.
 * This setup file replaces it with a proper in-memory Storage implementation.
 */
class InMemoryStorage implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new InMemoryStorage(),
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, 'sessionStorage', {
  value: new InMemoryStorage(),
  writable: true,
  configurable: true,
});
