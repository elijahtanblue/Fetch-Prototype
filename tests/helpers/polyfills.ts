/**
 * Web API polyfills for testing Next.js route handlers in jsdom.
 * Import this at the top of any test that imports route handlers.
 */

if (typeof globalThis.Response === "undefined" || !globalThis.Response.json) {
  class MockResponse {
    body: string;
    status: number;
    headers: Headers;

    constructor(body?: BodyInit | null, init?: ResponseInit) {
      this.body = body as string ?? "";
      this.status = init?.status ?? 200;
      this.headers = new Headers(init?.headers);
    }

    async json() {
      return JSON.parse(this.body);
    }

    static json(data: unknown, init?: ResponseInit) {
      return new MockResponse(JSON.stringify(data), {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers).entries()),
          "content-type": "application/json",
        },
      });
    }
  }

  globalThis.Response = MockResponse as unknown as typeof Response;
}

if (typeof globalThis.Request === "undefined") {
  class MockRequest {
    url: string;
    method: string;
    headers: Headers;
    private _body: string;

    constructor(url: string | URL, init?: RequestInit) {
      this.url = typeof url === "string" ? url : url.toString();
      this.method = init?.method ?? "GET";
      this.headers = new Headers(init?.headers);
      this._body = (init?.body as string) ?? "";
    }

    async json() {
      return this._body ? JSON.parse(this._body) : {};
    }
  }

  globalThis.Request = MockRequest as unknown as typeof Request;
}

if (typeof globalThis.Headers === "undefined") {
  class MockHeaders {
    private map = new Map<string, string>();

    constructor(init?: HeadersInit) {
      if (init && typeof init === "object" && !Array.isArray(init)) {
        for (const [k, v] of Object.entries(init)) {
          this.map.set(k.toLowerCase(), v);
        }
      }
    }

    get(key: string) { return this.map.get(key.toLowerCase()) ?? null; }
    set(key: string, value: string) { this.map.set(key.toLowerCase(), value); }
    entries() { return this.map.entries(); }
  }

  globalThis.Headers = MockHeaders as unknown as typeof Headers;
}

export {};
