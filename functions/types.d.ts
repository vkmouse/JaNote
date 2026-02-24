/// <reference types="../worker-configuration" />

// Re-export Cloudflare Pages types for functions
declare global {
  type PagesFunction<
    Env = unknown,
    Params extends string = any,
    Data extends Record<string, unknown> = Record<string, unknown>
  > = (
    context: EventContext<Env, Params, Data>
  ) => Response | Promise<Response>;

  interface EventContext<Env = unknown, Params extends string = any, Data extends Record<string, unknown> = Record<string, unknown>> {
    request: Request;
    functionPath: string;
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
    next(input?: Request | string, init?: RequestInit): Promise<Response>;
    env: Env;
    params: Params extends `${any}:${infer ParamName}` ? { [K in ParamName]: string } : {};
    data: Data;
  }

  interface D1Result<T = unknown> {
    results?: T[];
    success: boolean;
    error?: string;
    meta: {
      duration?: number;
      size_after?: number;
      rows_read?: number;
      rows_written?: number;
    };
  }

  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(colName?: string): Promise<T | null>;
    run(): Promise<D1Result>;
    all<T = unknown>(): Promise<D1Result<T>>;
    raw<T = unknown>(): Promise<T[]>;
  }

  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    dump(): Promise<ArrayBuffer>;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
    exec(query: string): Promise<D1Result>;
  }
}

export {};
