import { describe, expect, it } from "vitest";
import config from "../../capacitor.config.json";

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
