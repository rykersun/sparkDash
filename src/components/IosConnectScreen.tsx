import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { setToken } from "../api/authToken";
import { probeServer, setServerBase } from "../api/baseUrl";

/**
 * First-run connect screen for the iOS app.
 *
 * The bundled app has no origin of its own, so it must be told which sparkDash
 * server to talk to before any request can succeed. The browser never sees this:
 * there the server that served the page is already the answer.
 *
 * The address is verified against /api/health before it is stored, so a typo
 * shows an error here instead of a dashboard that never connects.
 */
export function IosConnectScreen() {
  const { t } = useTranslation("settings");
  const [server, setServer] = useState("");
  const [token, setTokenValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (busy) return;
      setBusy(true);
      setError(null);
      setDetail(null);
      const { problem, detail: serverDetail } = await probeServer(server, token);
      if (problem) {
        // Static keys: the i18n checker rejects keys built at runtime, because a
        // missing catalog entry could otherwise hide behind a variable.
        setError(
          problem === "invalidUrl"
            ? t("ios.invalidUrl")
            : problem === "unreachable"
              ? t("ios.unreachable")
              : problem === "hostRefused"
                ? t("ios.hostRefused")
                : t("ios.notSparkDash")
        );
        // The server's own sentence names the host it refused and the variable
        // that fixes it; keep it verbatim next to the translated summary.
        setDetail(problem === "hostRefused" && serverDetail ? serverDetail : null);
        setBusy(false);
        return;
      }
      setServerBase(server);
      setToken(token);
      // A fresh load is the safest way to drop every in-flight request, socket
      // and cached snapshot from the previous configuration.
      window.location.reload();
    },
    [busy, server, t, token]
  );

  return (
    <div className="ios-setup">
      <form className="ios-setup-card" onSubmit={submit}>
        <h1>{t("ios.connectTitle")}</h1>
        <p className="ios-setup-help">{t("ios.connectHelp")}</p>

        <label className="ios-setup-field">
          <span>{t("ios.serverLabel")}</span>
          <input
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t("ios.serverPlaceholder")}
            value={server}
            onChange={(event) => setServer(event.target.value)}
            required
          />
        </label>

        <label className="ios-setup-field">
          <span>{t("ios.tokenLabel")}</span>
          <input
            type="password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t("ios.tokenPlaceholder")}
            value={token}
            onChange={(event) => setTokenValue(event.target.value)}
          />
        </label>

        {error && (
          <p className="ios-setup-error" role="alert">
            {error}
            {detail && <span className="ios-setup-detail">{detail}</span>}
          </p>
        )}

        <button type="submit" className="ios-setup-submit" disabled={busy}>
          {busy ? t("ios.connecting") : t("ios.connect")}
        </button>
      </form>
    </div>
  );
}
