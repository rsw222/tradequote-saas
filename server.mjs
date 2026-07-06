import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4173);
const llmApiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "";
const llmApiUrl = process.env.LLM_API_URL || "https://api.openai.com/v1/chat/completions";
const llmModel = process.env.LLM_MODEL || "gpt-4o-mini";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}");
}

async function callLlm(prompt) {
  if (!llmApiKey) {
    return {
      provider: "local-rag-only",
      text:
        "No LLM_API_KEY or OPENAI_API_KEY is configured on the server. The app is using local RAG recommendations and has prepared this prompt for the model.\n\n" +
        prompt,
    };
  }

  const response = await fetch(llmApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llmApiKey}`,
    },
    body: JSON.stringify({
      model: llmModel,
      messages: [
        {
          role: "system",
          content:
            "You help Australian tradespeople create accurate, cautious quotes. Use retrieved context, identify uncertainty, and never invent site facts.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM request failed with ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return {
    provider: llmApiUrl,
    model: llmModel,
    text: data.choices?.[0]?.message?.content || "The LLM returned no text.",
  };
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/ai-assist") {
      const body = await readJson(req);
      if (!body.prompt) {
        sendJson(res, 400, { error: "Missing prompt" });
        return;
      }

      sendJson(res, 200, await callLlm(body.prompt));
      return;
    }

    if (req.method === "GET") {
      await serveStatic(req, res);
      return;
    }

    res.writeHead(405);
    res.end("Method not allowed");
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`TradeQuote running at http://127.0.0.1:${port}`);
});
