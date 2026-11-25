import type { SparkSnapshot } from "../../api/types";
import { isWorkerSpark } from "../../api/sparkRole";
import { getServerBase } from "../../api/baseUrl";
import { measuredGenerationTps } from "../../shared/llmRate";

/** Live decode tok/s of the first reachable LLM on a Spark, or null. */
export function primaryDecodeTps(spark: SparkSnapshot): number | null {
  const llm = Array.isArray(spark.metrics.llm) ? spark.metrics.llm.find((l) => l.available) : null;
  return measuredGenerationTps(llm);
}

export interface RailStatusLabels {
  offline: string;
  worker: string;
}

/** Short label for the rail: tok/s when an LLM is live, otherwise a status word. */
export function railSubLabel(spark: SparkSnapshot, labels: RailStatusLabels = { offline: "off", worker: "worker" }): string {
  if (!spark.online) return labels.offline;
  const tps = primaryDecodeTps(spark);
  if (tps != null) return tps >= 100 ? tps.toFixed(0) : tps.toFixed(1);
  return isWorkerSpark(spark) ? labels.worker : "—";
}

export function isThrottling(spark: SparkSnapshot): boolean {
  return Boolean(spark.online && spark.metrics.gpu?.throttle?.thermal);
}

/** First Spark that can host a showcase (has a reachable LLM and is not a worker). */
export function showcaseTarget(sparks: SparkSnapshot[]): SparkSnapshot | null {
  return (
    sparks.find((s) => s.online && !isWorkerSpark(s) && Array.isArray(s.metrics.llm) && s.metrics.llm.some((l) => l.available)) ??
    null
  );
}

export function showcaseUrl(spark: SparkSnapshot): string {
  const idx = Array.isArray(spark.metrics.llm) ? spark.metrics.llm.findIndex((l) => l.available) : -1;
  const llm = idx >= 0 ? spark.metrics.llm[idx] : null;
  const port = spark.llmPorts?.[idx] ?? spark.llmPort;
  const params = new URLSearchParams();
  if (port) params.set("port", String(port));
  if (llm?.modelId) params.set("model", llm.modelId);
  const q = params.toString() ? `?${params.toString()}` : "";
  return `/showcase/${encodeURIComponent(spark.id)}${q}`;
}

/**
 * A showcase path made absolute when the app stores a server URL.
 *
 * A relative path only works while it stays inside the WebView. Anything that
 * leaves it — `window.open`, or an anchor with `target="_blank"`, which
 * Capacitor hands straight to `UIApplication.open` — resolves the path against
 * `capacitor://localhost/...`, a scheme no app on the phone can open, so the
 * control silently does nothing. In the app the absolute server URL is the only
 * address Safari on the phone can load. In a browser the stored base is empty
 * and this returns the relative path unchanged.
 */
export function absoluteShowcasePath(path: string): string {
  const base = getServerBase();
  return base ? `${base}${path}` : path;
}

/** A showcase link for an anchor or a `_blank` open (see absoluteShowcasePath). */
export function showcaseHref(spark: SparkSnapshot): string {
  return absoluteShowcasePath(showcaseUrl(spark));
}

/** Open a showcase outside the WebView (see absoluteShowcasePath). */
export function openShowcasePath(path: string) {
  window.open(absoluteShowcasePath(path), "_blank", "noopener,noreferrer");
}

/** One Spark's showcase page, opened outside the WebView (see openShowcasePath). */
export function openShowcase(spark: SparkSnapshot) {
  openShowcasePath(showcaseUrl(spark));
}
