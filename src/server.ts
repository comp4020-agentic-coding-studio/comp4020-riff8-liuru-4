import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { gzipSync } from "node:zlib";
import { marked } from "marked";
import { addTrace, allTraces, isKind, traceById, tracesAfter, type Trace } from "./db.ts";
import type { PublicTrace } from "./public/shared.js";
import { renderReadme, renderWall } from "./templates.ts";

const PORT = Number(process.env.PORT ?? 8080);
const VISITOR_COOKIE = "visitor";
const FIVE_YEARS = 60 * 60 * 24 * 365 * 5;
const MAX_TEXT = 240;
const KEEPALIVE_MS = 20_000;

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function visitorCookie(id: string): string {
  // Persistent identity, not a login: this is what lets a returning stranger
  // find their own trace again without an account.
  return `${VISITOR_COOKIE}=${id}; Max-Age=${FIVE_YEARS}; Path=/; HttpOnly; SameSite=Lax`;
}

// Ownership is worked out per viewer; the visitor id itself never leaves the
// server.
function toPublic(t: Trace, viewerId: string): PublicTrace {
  return { id: t.id, kind: t.kind, text: t.text, createdAt: t.createdAt, mine: t.visitorId === viewerId };
}

// Client assets, read once at startup and served with an ETag and gzip.
const STATIC_TYPES: Record<string, string> = {
  "app.js": "text/javascript; charset=utf-8",
  "shared.js": "text/javascript; charset=utf-8",
  "style.css": "text/css; charset=utf-8",
};
const staticFiles = new Map(
  Object.entries(STATIC_TYPES).map(([name, type]) => {
    const raw = readFileSync(new URL(`./public/${name}`, import.meta.url));
    const etag = `"${createHash("sha1").update(raw).digest("hex").slice(0, 16)}"`;
    return [name, { type, raw, gz: gzipSync(raw), etag }];
  }),
);

// Live subscribers. Each holds its own viewer id so a broadcast can mark
// "yours" correctly for every receiver.
interface Subscriber {
  res: ServerResponse;
  visitorId: string;
}
const subscribers = new Set<Subscriber>();

function sendTrace(sub: Subscriber, t: Trace, recovered: boolean): void {
  const payload = { ...toPublic(t, sub.visitorId), recovered };
  sub.res.write(`id: ${t.id}\nevent: trace\ndata: ${JSON.stringify(payload)}\n\n`);
}

// Called only after the insert has committed, so nothing unsaved is ever
// announced. Node runs this synchronously, so broadcasts leave in id order.
function broadcast(t: Trace): void {
  for (const sub of subscribers) sendTrace(sub, t, false);
}

setInterval(() => {
  for (const sub of subscribers) sub.res.write(`: keepalive\n\n`);
}, KEEPALIVE_MS).unref();

function openEvents(req: IncomingMessage, res: ServerResponse, url: URL, visitorId: string, setCookie?: string): void {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
    ...(setCookie ? { "set-cookie": setCookie } : {}),
  });
  res.write(`retry: 2000\n\n`);

  // Replay from durable storage, not an in-memory log, so a reconnect after a
  // server restart still fills the gap. Last-Event-ID (the browser's own
  // reconnect) wins over ?after= (the page's first subscribe).
  const header = req.headers["last-event-id"];
  const from = Number(typeof header === "string" ? header : (url.searchParams.get("after") ?? NaN));
  const sub: Subscriber = { res, visitorId };
  let lastId = Number.isFinite(from) && from >= 0 ? from : 0;
  if (Number.isFinite(from) && from >= 0) {
    for (const t of tracesAfter(from)) {
      sendTrace(sub, t, true);
      lastId = t.id;
    }
  }
  res.write(`event: ready\ndata: ${JSON.stringify({ lastId })}\n\n`);
  subscribers.add(sub);
  req.on("close", () => subscribers.delete(sub));
}

function wantsJson(req: IncomingMessage): boolean {
  return (req.headers.accept ?? "").includes("application/json");
}

function sendJson(res: ServerResponse, status: number, body: unknown, setCookie?: string): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...(setCookie ? { "set-cookie": setCookie } : {}),
  });
  res.end(JSON.stringify(body));
}

// The whole wall rides in each page (as markup and as JSON), so compress it.
function sendHtml(req: IncomingMessage, res: ServerResponse, status: number, html: string, setCookie?: string): void {
  const gzip = /\bgzip\b/.test(req.headers["accept-encoding"] ?? "");
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    vary: "accept-encoding",
    ...(gzip ? { "content-encoding": "gzip" } : {}),
    ...(setCookie ? { "set-cookie": setCookie } : {}),
  });
  res.end(gzip ? gzipSync(html) : html);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const cookies = parseCookies(req.headers.cookie);
  const existingVisitor = cookies[VISITOR_COOKIE];
  const visitorId = existingVisitor ?? randomUUID();
  const setCookie = existingVisitor ? undefined : visitorCookie(visitorId);
  const wall = () => allTraces().map((t) => toPublic(t, visitorId));

  try {
    if (url.pathname === "/" && req.method === "GET") {
      sendHtml(req, res, 200, renderWall(wall()), setCookie);
      return;
    }

    const traceLink = url.pathname.match(/^\/t\/([^/]*)\/?$/);
    if (traceLink && req.method === "GET") {
      const raw = decodeURIComponent(traceLink[1]);
      const found = /^[1-9]\d{0,15}$/.test(raw) ? traceById(Number(raw)) : undefined;
      if (found) {
        sendHtml(req, res, 200, renderWall(wall(), { focus: toPublic(found, visitorId) }), setCookie);
      } else {
        sendHtml(req, res, 404, renderWall(wall(), { missingId: raw }), setCookie);
      }
      return;
    }

    if (url.pathname === "/events" && req.method === "GET") {
      openEvents(req, res, url, visitorId, setCookie);
      return;
    }

    if (url.pathname === "/trace" && req.method === "POST") {
      const raw = await readBody(req);
      const params = new URLSearchParams(raw);
      const kind = params.get("kind") ?? "";
      const text = (params.get("text") ?? "").trim().slice(0, MAX_TEXT);
      const key = (params.get("submissionKey") ?? "").slice(0, 64) || null;
      const valid = isKind(kind) && text.length > 0;
      const result = valid ? addTrace(visitorId, kind, text, key) : undefined;
      if (result?.created) broadcast(result.trace);

      if (wantsJson(req)) {
        if (result) {
          sendJson(res, result.created ? 201 : 200, { trace: toPublic(result.trace, visitorId) }, setCookie);
        } else {
          const error = isKind(kind) ? "Write something first." : "Choose one of the six kinds.";
          sendJson(res, 400, { error }, setCookie);
        }
        return;
      }
      // The no-JavaScript path: a bad submission is silently ignored, as before.
      res.writeHead(303, {
        location: "/",
        ...(setCookie ? { "set-cookie": setCookie } : {}),
      });
      res.end();
      return;
    }

    const asset = url.pathname.match(/^\/static\/([\w.]+)$/);
    if (asset && req.method === "GET" && staticFiles.has(asset[1])) {
      const file = staticFiles.get(asset[1])!;
      if (req.headers["if-none-match"] === file.etag) {
        res.writeHead(304, { etag: file.etag });
        res.end();
        return;
      }
      const gzip = /\bgzip\b/.test(req.headers["accept-encoding"] ?? "");
      res.writeHead(200, {
        "content-type": file.type,
        "cache-control": "no-cache",
        etag: file.etag,
        vary: "accept-encoding",
        ...(gzip ? { "content-encoding": "gzip" } : {}),
      });
      res.end(gzip ? file.gz : file.raw);
      return;
    }

    if (url.pathname === "/readme/" && req.method === "GET") {
      const md = readFileSync("README.md", "utf8");
      sendHtml(req, res, 200, renderReadme(await marked.parse(md)));
      return;
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("internal error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`listening on ${PORT}`);
});
