import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../apps/web/app/globals.css", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../apps/web/app/admin/admin-workspace.tsx", import.meta.url), "utf8");
const communication = readFileSync(new URL("../apps/web/app/admin/communication-panel.tsx", import.meta.url), "utf8");

function block(selector) {
  const escaped = selector.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(escaped + "\\s*\\{([^}]*)\\}"));
  assert.ok(match, "Missing CSS heading selector: " + selector);
  return match[1];
}

assert.match(block(".admin-school-identity h1"), /font-size:\s*clamp\(22\.4px,\s*2\.8vw,\s*33\.6px\)/);
assert.match(block(".admin-school-identity p"), /font-size:\s*12\.8px/);
assert.match(block(".admin-route-heading h2"), /font-size:\s*clamp\(19\.6px,\s*2\.1vw,\s*26\.6px\)/);
assert.match(block(".admin-route-heading p"), /font-size:\s*12\.8px/);
assert.match(block(".academic-heading h2"), /font-size:\s*19\.6px/);
assert.match(block(".admin-workspace .academic-heading p"), /font-size:\s*11\.2px/);
assert.match(block(".admin-dashboard-heading h2"), /font-size:\s*21px/);
assert.match(block(".admin-dashboard-heading p"), /font-size:\s*12\.8px/);
assert.ok(css.includes(".admin-school-identity h1 {\n    font-size: 21px;"), "Keep 70% narrow-phone school heading.");
assert.ok(css.includes(".admin-route-heading h2 {\n    font-size: 19.6px;"), "Keep 70% mobile route heading.");
for (const marker of ['className="admin-school-identity"', 'className="admin-route-heading"']) {
  assert.ok(workspace.includes(marker), "Heading target no longer in admin shell: " + marker);
}
assert.ok(communication.includes('className="admin-section-header academic-heading"'),
  "Communication screen should use the smaller section heading.");
assert.ok(!css.includes(".admin-workspace { font-size:"),
  "Do not scale the entire admin workspace or affect controls/tabs.");
console.log("Admin page titles at 70% and subtitles at 80% with mobile overrides and unchanged controls verified.");
