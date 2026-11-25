import { describe, expect, it } from "vitest";
import config from "../../capacitor.config.json";
// Vite's `?raw` import keeps this file free of Node APIs (no `node:fs`, no
// `process`), the same way `src/components/SparkPage/benchShareCard.test.ts`
// imports an `.svg` — it type-checks under the project's browser-only
// `tsconfig.json`, which has no `@types/node` in scope.
import plist from "../../ios/App/App/Info.plist?raw";

/**
 * The iOS shell loads the bundled UI from `capacitor://localhost`, so every call
 * to the sparkDash server is cross-origin and the server sends no
 * `Access-Control-Allow-Origin` (it is built to be same-origin behind a proxy).
 * CapacitorHttp makes those requests through the native stack instead of
 * WebKit's fetch, which is what keeps the app working on a real device. Remove
 * it and the app still builds, loads, and then fails every `/api/*` call — so
 * the config is pinned here rather than left to be rediscovered on a phone.
 */
const raw = config as { server?: { url?: string } };

describe("capacitor.config.json", () => {
  it("sends API requests natively, so WebKit's CORS rules do not block them", () => {
    expect(config.plugins?.CapacitorHttp?.enabled).toBe(true);
  });

  it("bundles the built assets instead of loading a remote page", () => {
    expect(config.webDir).toBe("dist");
    expect(raw.server?.url).toBeUndefined();
  });

  it("keeps the app id the iOS project was generated with", () => {
    expect(config.appId).toBe("com.rykersun.sparkdash");
  });
});

/**
 * iOS 14+ gates requests to local-network addresses behind a permission prompt
 * and refuses them without `NSLocalNetworkUsageDescription` — silently, so the
 * connect screen only ever says "unreachable". The address a user enters is
 * exactly a local-network address (RFC 1918 on a LAN, 100.64/10 through
 * Tailscale), so the reason string is part of the feature, not decoration.
 * `NSAllowsArbitraryLoads` stays off: the supported path is HTTPS behind
 * Tailscale Serve or an authenticating reverse proxy.
 */
describe("ios/App/App/Info.plist", () => {
  it("explains why the app asks for local network access", () => {
    expect(plist).toContain("<key>NSLocalNetworkUsageDescription</key>");
  });

  it("keeps ATS strict: local networking only, no arbitrary loads", () => {
    expect(plist).toContain("<key>NSAllowsLocalNetworking</key>");
    expect(plist).not.toContain("NSAllowsArbitraryLoads");
  });
});
