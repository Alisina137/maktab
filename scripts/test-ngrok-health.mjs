import assert from "node:assert/strict";
import test from "node:test";
import { probeTunnelHealth, waitForTunnelHealth } from "./ngrok-health.mjs";

function mockResponse({status=200, body={service:"maktablink-api",status:"ok"}, type="application/json"}={}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({"content-type":type}),
    json: async () => body
  };
}

test("public ngrok probe includes browser-warning bypass and validates API identity", async () => {
  let called = false;
  const result = await probeTunnelHealth("https://tunnel.example.test", {
    fetchImpl: async (url, options) => {
      called = true;
      assert.equal(url,"https://tunnel.example.test/health");
      assert.equal(options.headers["ngrok-skip-browser-warning"],"true");
      assert.equal(options.headers.Accept,"application/json");
      assert.equal(options.redirect,"error");
      return mockResponse();
    }
  });
  assert.ok(called);
  assert.equal(result.ok,true);
});

test("public probe rejects HTML warning, wrong API, and HTTP 502", async () => {
  const html = await probeTunnelHealth("https://tunnel.example.test", {
    fetchImpl: async () => ({...mockResponse({type:"text/html"}), json:async()=>{throw new SyntaxError();}})
  });
  assert.equal(html.ok,false);
  assert.match(html.reason,/non-JSON/);

  const other = await probeTunnelHealth("https://tunnel.example.test", {
    fetchImpl:async()=>mockResponse({body:{service:"some-other-service",status:"ok"}})
  });
  assert.equal(other.ok,false);
  assert.match(other.reason,/did not return MaktabLink/);

  const bad = await probeTunnelHealth("https://tunnel.example.test", {
    fetchImpl:async()=>mockResponse({status:502})
  });
  assert.equal(bad.ok,false);
  assert.match(bad.reason,/HTTP 502/);
});

test("public tunnel propagation transient failures are retried before publishing URL",async()=>{
  let attempt=0;
  let clock=0;
  const result=await waitForTunnelHealth("https://tunnel.example.test",{
    fetchImpl:async()=>{
      attempt++;
      if(attempt===1)throw new Error("not yet online");
      if(attempt===2)return mockResponse({status:502});
      return mockResponse();
    },
    now:()=>clock,
    sleep:async(ms)=>{clock+=ms;},
    intervalMs:2000,
    totalMs:10000
  });
  assert.equal(result.ok,true);
  assert.equal(result.attempts,3);
});

test("public tunnel permanently unreachable retains meaningful error instead of reporting healthy",async()=>{
  let clock=0;
  const result=await waitForTunnelHealth("https://tunnel.example.test",{
    fetchImpl:async()=>{throw new Error("offline");},
    now:()=>clock,
    sleep:async(ms)=>{clock+=ms;},
    intervalMs:1000,
    totalMs:2000
  });
  assert.equal(result.ok,false);
  assert.equal(result.attempts,2);
  assert.match(result.reason,/offline/);
});
