import { expect, inject, it } from "vitest";

// Live delivery and recovery, against the running app: every open stream
// hears a committed trace once, marked "yours" only for the viewer who wrote
// it, and a stream that reconnects with Last-Event-ID is replayed what it
// missed from storage.
const baseUrl = inject("baseUrl");

interface LiveTrace {
  id: number;
  kind: string;
  text: string;
  createdAt: number;
  mine: boolean;
  recovered: boolean;
}

const unique = (): string => `live-spec-${Math.random().toString(36).slice(2)}`;

/** A visitor identity: the cookie the server issues on first visit. */
async function newVisitor(): Promise<string> {
  const res = await fetch(new URL("/", baseUrl));
  await res.text();
  const cookie = res.headers.get("set-cookie");
  expect(cookie).toMatch(/^visitor=/);
  return cookie!.split(";")[0];
}

async function post(cookie: string, fields: Record<string, string>): Promise<Response> {
  return fetch(new URL("/trace", baseUrl), {
    method: "POST",
    headers: { cookie, accept: "application/json" },
    body: new URLSearchParams(fields),
  });
}

/** Opens /events and collects trace events until `stop` is called. */
async function subscribe(cookie: string, headers: Record<string, string> = {}, query = "") {
  const controller = new AbortController();
  const res = await fetch(new URL(`/events${query}`, baseUrl), {
    headers: { cookie, ...headers },
    signal: controller.signal,
  });
  expect(res.headers.get("content-type")).toContain("text/event-stream");
  const traces: LiveTrace[] = [];
  let raw = "";
  let ready!: () => void;
  const isReady = new Promise<void>((resolve) => (ready = resolve));
  const decoder = new TextDecoder();
  void (async () => {
    try {
      for await (const chunk of res.body!) {
        raw += decoder.decode(chunk as Uint8Array, { stream: true });
        let split: number;
        while ((split = raw.indexOf("\n\n")) !== -1) {
          const block = raw.slice(0, split);
          raw = raw.slice(split + 2);
          const event = block.match(/^event: (.*)$/m)?.[1];
          const data = block.match(/^data: (.*)$/m)?.[1];
          if (event === "ready") ready();
          if (event === "trace" && data) traces.push(JSON.parse(data));
        }
      }
    } catch {
      // aborted by stop()
    }
  })();
  await isReady;
  return {
    traces,
    stop: () => controller.abort(),
    async waitFor(pred: (t: LiveTrace[]) => boolean, ms = 2000): Promise<void> {
      const until = Date.now() + ms;
      while (!pred(traces)) {
        if (Date.now() > until) throw new Error(`timed out; saw ${JSON.stringify(traces)}`);
        await new Promise((r) => setTimeout(r, 20));
      }
    },
  };
}

it("delivers a new trace to every open stream within a second, marked yours only for its author", async () => {
  const a = await newVisitor();
  const b = await newVisitor();
  const streamA = await subscribe(a);
  const streamB = await subscribe(b);
  const text = unique();

  const started = Date.now();
  const res = await post(a, { kind: "bubble", text });
  expect(res.status).toBe(201);
  const { trace } = await res.json();
  expect(trace).toMatchObject({ kind: "bubble", text, mine: true });

  await streamA.waitFor((ts) => ts.some((t) => t.text === text), 1000);
  await streamB.waitFor((ts) => ts.some((t) => t.text === text), 1000);
  expect(Date.now() - started).toBeLessThan(1000);

  const seenByA = streamA.traces.filter((t) => t.text === text);
  const seenByB = streamB.traces.filter((t) => t.text === text);
  expect(seenByA).toHaveLength(1);
  expect(seenByB).toHaveLength(1);
  expect(seenByA[0]).toMatchObject({ id: trace.id, mine: true, recovered: false });
  expect(seenByB[0]).toMatchObject({ id: trace.id, mine: false, recovered: false });
  // The author's identity never travels in an event.
  expect(JSON.stringify(seenByB[0])).not.toContain(a.split("=")[1]);
  streamA.stop();
  streamB.stop();
});

it("gives near-simultaneous posts distinct ids, in the same order on every stream", async () => {
  const a = await newVisitor();
  const b = await newVisitor();
  const streamA = await subscribe(a);
  const streamB = await subscribe(b);
  const texts = Array.from({ length: 6 }, unique);

  await Promise.all(texts.map((text, i) => post(i % 2 ? a : b, { kind: "dew", text })));
  const has = (ts: LiveTrace[]) => texts.every((x) => ts.some((t) => t.text === x));
  await streamA.waitFor(has);
  await streamB.waitFor(has);

  const order = (ts: LiveTrace[]) => ts.filter((t) => texts.includes(t.text)).map((t) => t.id);
  expect(new Set(order(streamA.traces)).size).toBe(texts.length);
  expect(order(streamA.traces)).toEqual(order(streamB.traces));
  expect(order(streamA.traces)).toEqual([...order(streamA.traces)].sort((x, y) => x - y));
  streamA.stop();
  streamB.stop();
});

it("replays traces missed while disconnected, from Last-Event-ID, marked as recovered", async () => {
  const a = await newVisitor();
  const b = await newVisitor();
  const first = await (await post(a, { kind: "shadow", text: unique() })).json();
  const missed = [unique(), unique(), unique()];
  for (const text of missed) await post(a, { kind: "shadow", text });

  const stream = await subscribe(b, { "last-event-id": String(first.trace.id) });
  const replayed = stream.traces.filter((t) => missed.includes(t.text));
  expect(replayed.map((t) => t.text)).toEqual(missed);
  expect(replayed.every((t) => t.recovered && !t.mine)).toBe(true);
  expect(stream.traces.some((t) => t.id <= first.trace.id)).toBe(false);
  stream.stop();
});

it("treats a resent submission key as the same trace, not a duplicate", async () => {
  const a = await newVisitor();
  const text = unique();
  const submissionKey = unique();
  const one = await post(a, { kind: "dream", text, submissionKey });
  const two = await post(a, { kind: "dream", text, submissionKey });
  expect(one.status).toBe(201);
  expect(two.status).toBe(200);
  expect((await one.json()).trace.id).toBe((await two.json()).trace.id);

  const page = await (await fetch(new URL("/", baseUrl))).text();
  expect(page.split(text).length - 1).toBe(2); // once in the list, once in the page's data
});

it("rejects invalid JSON submissions with a reason, storing nothing", async () => {
  const a = await newVisitor();
  const text = unique();
  const bad = await post(a, { kind: "seventh", text });
  expect(bad.status).toBe(400);
  expect((await bad.json()).error).toBeTruthy();
  const empty = await post(a, { kind: "dew", text: "  " });
  expect(empty.status).toBe(400);
  const page = await (await fetch(new URL("/", baseUrl))).text();
  expect(page).not.toContain(text);
});

it("escapes HTML in trace text, on the page and in direct links", async () => {
  const a = await newVisitor();
  const marker = unique();
  const text = `<img src=x onerror=alert(1)> ${marker} & "quotes"`;
  const { trace } = await (await post(a, { kind: "illusion", text })).json();
  for (const path of ["/", `/t/${trace.id}`]) {
    const page = await (await fetch(new URL(path, baseUrl))).text();
    expect(page).toContain(marker);
    expect(page).not.toContain("<img src=x");
  }
});

it("serves a direct link to any stored trace, and a not-found page for a bad one", async () => {
  const a = await newVisitor();
  const text = unique();
  const { trace } = await (await post(a, { kind: "lightning", text })).json();
  const found = await fetch(new URL(`/t/${trace.id}`, baseUrl));
  expect(found.status).toBe(200);
  expect(await found.text()).toContain(`data-focus-id="${trace.id}"`);

  for (const bad of ["999999999", "abc", "0"]) {
    const missing = await fetch(new URL(`/t/${bad}`, baseUrl));
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain("isn&rsquo;t here");
  }
});
