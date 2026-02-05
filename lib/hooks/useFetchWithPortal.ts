"use client";

/**
 * Fetch with X-Portal: true so company APIs resolve company from client session.
 */
export function fetchWithPortal(url: string, options?: RequestInit): Promise<Response> {
  const headers = new Headers(options?.headers);
  headers.set("X-Portal", "true");
  return fetch(url, { ...options, headers });
}
