class LocalStorageMock {
  private store: Record<string, string> = {};

  get length() {
    return Object.keys(this.store).length;
  }

  key(index: number) {
    const keys = Object.keys(this.store);
    return index >= 0 && index < keys.length ? keys[index] : null;
  }

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return Object.prototype.hasOwnProperty.call(this.store, key)
      ? this.store[key]
      : null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

if (!globalThis.localStorage) {
  globalThis.localStorage = new LocalStorageMock() as Storage;
}

if (!globalThis.atob) {
  globalThis.atob = (input: string) =>
    Buffer.from(input, "base64").toString("binary");
}

if (!globalThis.window) {
  globalThis.window = { location: { href: "" } } as unknown as
    Window & typeof globalThis;
}
