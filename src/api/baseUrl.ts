/**
 * The sparkDash server a client talks to.
 *
 * In a browser the app is served by the server, so relative paths are right and
 * this stays empty. The iOS app is a bundled build with no origin of its own,
 * so it stores the server's base URL here and every request and socket is built
 * from it. The value is read at call time, never cached at module load, so a
 * change takes effect on the next request without a reload.
 *
 * Storage can throw (private mode, blocked site data); a failed read means
 * "not configured", and the native shell then shows the connect screen.
 */

export const SERVER_URL_STORAGE_KEY = "sparkdashServerUrl";

type Listener = (base: string) => void;
const listeners = new Set<Listener>();

function emit(base: string): void {
  for (const listener of listeners) listener(base);
}

/**
 * Accepts what a person types and returns a canonical origin, or null.
 *
 * Bare hosts get https:// (a tailnet or proxy front door is HTTPS), the path,
 * query and fragment are dropped because the API is always at the origin root,
 * and a trailing slash is removed so `${base}${path}` never doubles it.
 */
export function normalizeServerUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.hostname) return null;
  return url.origin;
}

/** The configured origin, or "" when the app should use its own origin. */
export function getServerBase(): string {
  try {
    const stored = localStorage.getItem(SERVER_URL_STORAGE_KEY);
    return stored ? normalizeServerUrl(stored) ?? "" : "";
  } catch {
    return "";
  }
}

export function setServerBase(raw: string): void {
  const base = normalizeServerUrl(raw);
  if (!base) return;
  try {
    localStorage.setItem(SERVER_URL_STORAGE_KEY, base);
  } catch {
    /* storage unavailable — the connection still works for this session */
  }
  emit(base);
}

export function clearServerBase(): void {
  try {
    localStorage.removeItem(SERVER_URL_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  emit("");
}

/** Notifies when the configured server changes; returns an unsubscribe function. */
export function onServerBaseChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * True inside the Capacitor iOS shell. Detected from the bridge the native
 * runtime injects rather than by importing Capacitor, so the browser bundle
 * keeps no dependency on it.
 */
export function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  const bridge = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return bridge?.isNativePlatform?.() === true;
}

/** Whether the app should ask for a server before showing the dashboard. */
export function needsServerSetup(): boolean {
  if (getServerBase()) return false;
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("setup") === "1") return true;
  }
  return isNativeShell();
}

/**
 * Why a candidate origin was rejected. `detail` carries the server's own
 * explanation, when it gave one, so the connect screen can show the real cause
 * instead of guessing.
 */
export interface ServerProbe {
  problem: "invalidUrl" | "unreachable" | "notSparkDash" | "hostRefused" | null;
  detail?: string;
}

/**
 * Checks that a candidate origin really is a sparkDash server.
 * Returns `{ problem: null }` on success, or the reason to show the user.
 */
export async function probeServer(base: string, token: string): Promise<ServerProbe> {
  const normalized = normalizeServerUrl(base);
  if (!normalized) return { problem: "invalidUrl" };
  try {
    const res = await fetch(`${normalized}/api/health`, {
      headers: token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {},
    });
    // A server bound to loopback refuses host names it does not answer to with
    // 403 and a one-line reason (see `refuse()` in server/auth.js). That is the
    // usual Tailscale Serve failure — a container has no `tailscale` binary, so
    // it never learns its own MagicDNS name — and it is fixable by setting
    // SPARKDASH_ALLOWED_HOSTS. Reporting it as "not a sparkDash server" sends
    // people off to retype the address and the token instead.
    if (res.status === 403) {
      const refused = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (refused && typeof refused.error === "string") {
        return { problem: "hostRefused", detail: refused.error };
      }
      // A 403 with no sparkDash explanation comes from something in front of
      // the server (an authenticating proxy), which is the old case.
      return { problem: "notSparkDash" };
    }
    if (res.status === 401) return { problem: "notSparkDash" };
    if (!res.ok) return { problem: "unreachable" };
    const body = (await res.json().catch(() => null)) as { version?: unknown } | null;
    // /api/health carries the running package version; anything else is a
    // different service that happens to answer at this address.
    if (!body || typeof body.version !== "string") return { problem: "notSparkDash" };
    return { problem: null };
  } catch {
    return { problem: "unreachable" };
  }
}
