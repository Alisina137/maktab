/**
 * Public ngrok URLs can take a few seconds to become routable. Also, free
 * ngrok endpoints can return a browser warning page unless clients include
 * ngrok-skip-browser-warning. Mobile API requests already send this header.
 */
export async function probeTunnelHealth(url, {
  fetchImpl = fetch,
  requestTimeoutMs = 6000
} = {}) {
  let response;
  try {
    response = await fetchImpl(url + "/health", {
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        "ngrok-skip-browser-warning": "true"
      },
      signal: AbortSignal.timeout(requestTimeoutMs),
      redirect: "error"
    });
  } catch (error) {
    const reason = error?.cause?.code || error?.code || error?.message || "connection error";
    return { ok: false, reason: "Connection failed: " + String(reason).slice(0, 160) };
  }

  if (!response.ok) return {
    ok: false,
    reason: "HTTP " + response.status + " from public tunnel (ngrok/forwarding may not be ready)"
  };

  const mediaType = response.headers?.get("content-type")?.toLowerCase() || "";
  let value;
  try {
    value = await response.json();
  } catch {
    return {
      ok: false,
      reason: "Public URL returned non-JSON content (" + (mediaType || "unknown type") + ")"
    };
  }

  if (value?.service !== "maktablink-api" || value?.status !== "ok") {
    return { ok: false, reason: "Public URL did not return MaktabLink API health" };
  }
  return { ok: true, reason: "" };
}

export async function waitForTunnelHealth(url, {
  fetchImpl = fetch,
  totalMs = 30000,
  requestTimeoutMs = 6000,
  intervalMs = 1500,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now
} = {}) {
  const deadline = now() + totalMs;
  let attempt = 0;
  let result = { ok: false, reason: "No response" };

  do {
    attempt += 1;
    result = await probeTunnelHealth(url, { fetchImpl, requestTimeoutMs });
    if (result.ok) return { ...result, attempts: attempt };
    if (now() >= deadline) break;
    await sleep(Math.min(intervalMs, Math.max(0, deadline - now())));
  } while (now() < deadline);

  return { ...result, attempts: attempt };
}
