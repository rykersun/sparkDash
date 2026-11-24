import { describe, expect, test, beforeEach } from "vitest";
import {
  SERVER_URL_STORAGE_KEY,
  clearServerBase,
  getServerBase,
  isNativeShell,
  needsServerSetup,
  normalizeServerUrl,
  onServerBaseChange,
  setServerBase,
} from "./baseUrl";

beforeEach(() => {
  localStorage.clear();
});

describe("normalizeServerUrl", () => {
  test("adds https to a bare host", () => {
    expect(normalizeServerUrl("sparkdash.tail1234.ts.net")).toBe("https://sparkdash.tail1234.ts.net");
  });

  test("keeps an explicit http origin (LAN or tailnet testing)", () => {
    expect(normalizeServerUrl("http://192.168.1.20:5555")).toBe("http://192.168.1.20:5555");
  });

  test("trims whitespace from a pasted address", () => {
    expect(normalizeServerUrl("  https://dash.example.com  ")).toBe("https://dash.example.com");
  });

  test("drops a trailing slash so paths never double up", () => {
    expect(normalizeServerUrl("https://dash.example.com/")).toBe("https://dash.example.com");
    expect(normalizeServerUrl("https://dash.example.com///")).toBe("https://dash.example.com");
  });

  test("drops a path, because the API always lives at the origin root", () => {
    expect(normalizeServerUrl("https://dash.example.com/app?x=1#top")).toBe("https://dash.example.com");
  });

  test("keeps a non-default port", () => {
    expect(normalizeServerUrl("https://dash.example.com:8443")).toBe("https://dash.example.com:8443");
  });

  test("rejects empty input", () => {
    expect(normalizeServerUrl("   ")).toBeNull();
  });

  test("rejects a scheme other than http(s)", () => {
    expect(normalizeServerUrl("javascript://alert(1)")).toBeNull();
    expect(normalizeServerUrl("ftp://dash.example.com")).toBeNull();
  });

  test("rejects junk that is not a URL", () => {
    expect(normalizeServerUrl("not a url")).toBeNull();
  });
});

describe("stored server base", () => {
  test("is empty until one is set", () => {
    expect(getServerBase()).toBe("");
  });

  test("round-trips a normalized origin", () => {
    setServerBase("dash.example.com/");
    expect(getServerBase()).toBe("https://dash.example.com");
    expect(localStorage.getItem(SERVER_URL_STORAGE_KEY)).toBe("https://dash.example.com");
  });

  test("ignores an invalid value instead of storing it", () => {
    setServerBase("https://good.example.com");
    setServerBase("javascript://nope");
    expect(getServerBase()).toBe("https://good.example.com");
  });

  test("clears back to the served origin", () => {
    setServerBase("https://dash.example.com");
    clearServerBase();
    expect(getServerBase()).toBe("");
  });

  test("notifies listeners with the new origin, and stops after unsubscribe", () => {
    const seen: string[] = [];
    const unsubscribe = onServerBaseChange((base) => seen.push(base));
    setServerBase("https://one.example.com");
    unsubscribe();
    setServerBase("https://two.example.com");
    expect(seen).toEqual(["https://one.example.com"]);
  });

  test("a stale or malformed stored value is treated as unset", () => {
    localStorage.setItem(SERVER_URL_STORAGE_KEY, "javascript://nope");
    expect(getServerBase()).toBe("");
  });
});

describe("native shell detection", () => {
  test("is false in a plain browser", () => {
    expect(isNativeShell()).toBe(false);
    expect(needsServerSetup()).toBe(false);
  });

  test("is true when the Capacitor bridge reports a native platform", () => {
    (window as unknown as { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor = {
      isNativePlatform: () => true,
    };
    try {
      expect(isNativeShell()).toBe(true);
      expect(needsServerSetup()).toBe(true);
      setServerBase("https://dash.example.com");
      expect(needsServerSetup()).toBe(false);
    } finally {
      delete (window as unknown as { Capacitor?: unknown }).Capacitor;
    }
  });
});
