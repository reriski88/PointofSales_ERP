"use client";

import type { RoleAccessAction, RoleAccessMenuKey } from "@/lib/role-access";

type ApiResponse<T> = { data: T };
type CacheEntry<T> = {
  expiresAt: number;
  data: T;
};

export type CachedProfile = {
  id?: string;
  name?: string;
  email?: string;
  role: string;
};

export type CachedOutlet = {
  id: string;
  name: string;
  code: string;
  isActive?: boolean;
};

export type CachedUnit = {
  id: string;
  name: string;
  code: string;
  kind: string;
  toBaseFactor: string;
};

export type CurrentAccess = {
  role: string;
  permissions: Record<RoleAccessMenuKey, RoleAccessAction[]>;
};

const ttlMs = 30_000;
const storagePrefix = "pos_admin_cache:";
const memoryCache = new Map<string, CacheEntry<unknown>>();
const pendingRequests = new Map<string, Promise<unknown>>();

export function getCurrentAccess(options?: { force?: boolean }) {
  return getCached<CurrentAccess>("role-access-me", "/api/role-access/me", options);
}

export function getProfile(options?: { force?: boolean }) {
  return getCached<CachedProfile>("profile", "/api/profile", options);
}

export function getOutlets(options?: { force?: boolean }) {
  return getCached<CachedOutlet[]>("outlets", "/api/outlets", options);
}

export function getUnits(options?: { force?: boolean }) {
  return getCached<CachedUnit[]>("units", "/api/units", options);
}

export function clearAdminDataCache(keys?: string[]) {
  const cacheKeys = keys ?? ["role-access-me", "profile", "outlets", "units"];
  for (const key of cacheKeys) {
    memoryCache.delete(key);
    pendingRequests.delete(key);
    window.sessionStorage.removeItem(`${storagePrefix}${key}`);
  }
}

async function getCached<T>(key: string, url: string, options?: { force?: boolean }) {
  if (!options?.force) {
    const memory = readMemory<T>(key);
    if (memory) return memory;

    const stored = readStorage<T>(key);
    if (stored) return stored;

    const pending = pendingRequests.get(key);
    if (pending) return pending as Promise<T>;
  }

  const request = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Request failed: ${url}`);
      }
      const json = (await response.json()) as ApiResponse<T>;
      writeCache(key, json.data);
      return json.data;
    })
    .finally(() => pendingRequests.delete(key));

  pendingRequests.set(key, request);
  return request;
}

function readMemory<T>(key: string) {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry || entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function readStorage<T>(key: string) {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(`${storagePrefix}${key}`) ?? "null") as CacheEntry<T> | null;
    if (!parsed || parsed.expiresAt < Date.now()) {
      window.sessionStorage.removeItem(`${storagePrefix}${key}`);
      return null;
    }
    memoryCache.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T) {
  const entry: CacheEntry<T> = {
    data,
    expiresAt: Date.now() + ttlMs,
  };
  memoryCache.set(key, entry);
  window.sessionStorage.setItem(`${storagePrefix}${key}`, JSON.stringify(entry));
}
