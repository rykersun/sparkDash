# sparkDash on iPhone

The iOS app is a [Capacitor](https://capacitorjs.com) shell around the same web UI
the browser gets. It bundles the built assets instead of loading a remote page,
so the app opens instantly and then talks to your sparkDash server over the
network.

## Why the app asks for a server address

sparkDash binds to `127.0.0.1` and its API does not authenticate clients
directly, so a phone cannot reach it until you put an authenticated front door in
front of it — Tailscale Serve, or an HTTPS reverse proxy that requires identity.
See [REMOTE-ACCESS.md](REMOTE-ACCESS.md). The address you type in the app is that
front door, for example `https://sparkdash.<tailnet>.ts.net`.

The app verifies the address against `GET /api/health` before saving it, so a
typo fails on the connect screen instead of showing a dashboard that never
connects. The token field is optional and only needed when the server sets
`SPARKDASH_TOKEN`.

## Why requests go through the native stack

The bundled UI is served from the app's own origin, `capacitor://localhost`, so
every request to your server is cross-origin. sparkDash answers only its own
origin and never sends `Access-Control-Allow-Origin` — in a browser that is
exactly right, because the UI and the API share one origin behind the proxy. In
an app shell it means WebKit would block every `/api/*` response with a CORS
error, and the connect screen would fail on a correct address.

`capacitor.config.json` therefore enables **CapacitorHttp**, which routes
`fetch()` through `URLSession` instead of the WebView. Native requests are not
subject to CORS, and they carry no `Origin` header, so the server's
DNS-rebinding guard sees them the same way it sees `curl`. Nothing changes on the
server, and the browser build is unaffected — the plugin only exists on the
device. The WebSocket is not affected either: WebSockets were never bound by
CORS, and the token still travels as `?token=`.

The cost is that the app is not a browser: a redirect or a streaming response
would behave differently natively. sparkDash has neither today, and
`src/ios/capacitorConfig.test.ts` fails if this switch is ever dropped.

## Requirements

- A Mac with **Xcode 16 or newer** — the only step that cannot run on the
  dashboard host or in CI.
- An Apple ID. A free account signs the app for 7 days at a time; a paid Apple
  Developer team is needed for TestFlight.
- An iPhone that can reach the server's front door (Tailscale installed and
  signed in, or a publicly trusted HTTPS proxy).

## Build and run

```bash
npm ci
npm run ios:sync   # build the web assets, then copy them into ios/
npm run ios:open   # open ios/App/App.xcodeproj in Xcode
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities** → choose your Team.
2. Change **Bundle Identifier** from `com.rykersun.sparkdash` to something you
   own (for example `com.yourname.sparkdash`).
3. Pick your iPhone as the run destination and press **Run**.

The first open resolves Capacitor through Swift Package Manager, which needs
network access. There is no CocoaPods step: Capacitor 8 ships the iOS runtime as
a Swift package.

After changing web code, run `npm run ios:sync` again — `npm run build` alone
does not update what the app loads.

## First launch

Enter the server address, and the token if your server uses one, then **Connect**.
The address and token are stored on the device; the app reloads into the
dashboard.

To point the app at a different server later, open **Settings → Server address →
Change server**. That clears the stored address and returns to the connect screen.

## Distribution

| Route | What it needs | Notes |
| --- | --- | --- |
| Run from Xcode | free Apple ID | Expires after 7 days; re-run to reinstall |
| TestFlight (internal) | paid Apple Developer team | Product → Archive → Distribute App |
| App Store | paid team + review | A shell that only loads one private server is likely to be rejected under guideline 4.2 (minimum functionality) |

For personal use, Xcode or TestFlight internal testing is the practical route.

## Limits worth knowing

- The UI is bundled, but the dashboard still needs the server to be reachable —
  there is no offline mode beyond the app shell.
- The app is iPhone-only by design; the iPad layout is whatever the web UI does
  at that width.
- Plain HTTP is allowed only for local-network testing
  (`NSAllowsLocalNetworking`); a public server must be HTTPS.

## Without Xcode: the PWA

The dashboard is already a Progressive Web App. In Safari, open the server's
address, tap **Share → Add to Home Screen**. That gives a full-screen icon with
the same UI and no build step — the iOS app mainly adds a bundled shell and a
stable identity for the stored server address.
