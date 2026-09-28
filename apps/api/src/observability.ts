type StatusClass = "2xx" | "3xx" | "4xx" | "5xx";

function statusClass(statusCode: number): StatusClass {
  if (statusCode >= 500) return "5xx";
  if (statusCode >= 400) return "4xx";
  if (statusCode >= 300) return "3xx";
  return "2xx";
}

export class ApiMetrics {
  private readonly requests = new Map<string, number>();
  private readonly durationMs = new Map<string, number>();
  private errors = 0;

  record(method: string, statusCode: number, elapsedMs: number) {
    const klass = statusClass(statusCode);
    const key = `${method.toUpperCase()}:${klass}`;
    this.requests.set(key, (this.requests.get(key) ?? 0) + 1);
    this.durationMs.set(key, (this.durationMs.get(key) ?? 0) + Math.max(0, elapsedMs));
    if (statusCode >= 500) this.errors += 1;
  }

  render(databaseReady: boolean) {
    const lines = [
      "# HELP maktablink_process_uptime_seconds API process uptime in seconds.",
      "# TYPE maktablink_process_uptime_seconds gauge",
      `maktablink_process_uptime_seconds ${process.uptime().toFixed(3)}`,
      "# HELP maktablink_database_ready Whether the configured database answered the readiness query.",
      "# TYPE maktablink_database_ready gauge",
      `maktablink_database_ready ${databaseReady ? 1 : 0}`,
      "# HELP maktablink_http_errors_total HTTP responses with status 500 or above.",
      "# TYPE maktablink_http_errors_total counter",
      `maktablink_http_errors_total ${this.errors}`,
      "# HELP maktablink_http_requests_total HTTP responses grouped by method and status class.",
      "# TYPE maktablink_http_requests_total counter"
    ];

    for (const [key, count] of [...this.requests.entries()].sort()) {
      const [method, klass] = key.split(":");
      lines.push(
        `maktablink_http_requests_total{method="${method}",status_class="${klass}"} ${count}`
      );
    }

    lines.push(
      "# HELP maktablink_http_request_duration_ms_sum Cumulative HTTP response duration in milliseconds.",
      "# TYPE maktablink_http_request_duration_ms_sum counter"
    );
    for (const [key, total] of [...this.durationMs.entries()].sort()) {
      const [method, klass] = key.split(":");
      lines.push(
        `maktablink_http_request_duration_ms_sum{method="${method}",status_class="${klass}"} ${total.toFixed(3)}`
      );
    }

    return `${lines.join("\n")}\n`;
  }
}
