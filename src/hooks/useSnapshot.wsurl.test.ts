import { describe, expect, test } from "vitest";
import { buildWsUrl } from "./useSnapshot";

const servedOrigin = { protocol: "https:", host: "dash.example.com" } as Location;
const servedHttp = { protocol: "http:", host: "127.0.0.1:5555" } as Location;

describe("buildWsUrl", () => {
  test("with no configured server it matches the served origin, as a browser always has", () => {
    expect(buildWsUrl("", "", servedOrigin)).toBe("wss://dash.example.com/ws");
    expect(buildWsUrl("", "", servedHttp)).toBe("ws://127.0.0.1:5555/ws");
  });

  test("keeps the token in the query, encoded", () => {
    expect(buildWsUrl("", "a b", servedOrigin)).toBe("wss://dash.example.com/ws?token=a%20b");
  });

  test("a configured https server wins over the served origin and uses wss", () => {
    expect(buildWsUrl("https://dash.example.com", "", servedHttp)).toBe("wss://dash.example.com/ws");
  });

  test("a configured http server uses ws and keeps its port", () => {
    expect(buildWsUrl("http://192.168.1.20:5555", "", servedOrigin)).toBe("ws://192.168.1.20:5555/ws");
  });

  test("the token travels with a configured server too", () => {
    expect(buildWsUrl("https://other.example.com", "t", servedOrigin)).toBe("wss://other.example.com/ws?token=t");
  });
});
