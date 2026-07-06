/**
 * Simple Dependency Injection Container
 * Manual, no reflection decorators — explicit, debuggable, tree-shakeable.
 */

// deno-lint-ignore no-explicit-any
type Factory<T> = (c: Container) => T;

interface Registration<T> {
  factory: Factory<T>;
  singleton: boolean;
  instance?: T;
}

export class Container {
  // deno-lint-ignore no-explicit-any
  private registry = new Map<string, Registration<any>>();

  /** Register a transient (new instance every resolve) */
  register<T>(token: string, factory: Factory<T>): this {
    this.registry.set(token, { factory, singleton: false });
    return this;
  }

  /** Register a singleton (one instance, cached) */
  registerSingleton<T>(token: string, factory: Factory<T>): this {
    this.registry.set(token, { factory, singleton: true });
    return this;
  }

  /** Resolve by token — returns cached instance for singletons */
  resolve<T>(token: string): T {
    const reg = this.registry.get(token);
    if (!reg) throw new Error(`DI token not registered: ${token}`);
    if (reg.singleton) {
      if (!reg.instance) reg.instance = reg.factory(this);
      return reg.instance as T;
    }
    return reg.factory(this) as T;
  }
}

/** Global container instance — initialized at app startup */
export const container = new Container();

/** Helper: resolve from global container */
export function resolve<T>(token: string): T {
  return container.resolve<T>(token);
}
