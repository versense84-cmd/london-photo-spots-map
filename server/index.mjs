import "dotenv/config";
import express from "express";

const app = express();
const port = Number(process.env.API_PORT || 8787);
const dailyBatchLimit = Number(process.env.DAILY_BATCH_LIMIT || 10);
const usage = new Map();

app.use(express.json({ limit: "1mb" }));

function getClientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "local")
    .split(",")[0]
    .trim();
}

function takeBatchQuota(req) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${day}|${getClientIp(req)}`;
  const count = usage.get(key) || 0;
  if (count >= dailyBatchLimit) return false;
  usage.set(key, count + 1);
  return true;
}

function normalizeGooglePlace(place) {
  const location = place.location || {};
  return {
    name: place.displayName?.text || place.formattedAddress || "Unnamed place",
    address: place.formattedAddress || "",
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    placeId: place.id,
  };
}

async function googleTextSearch(name, city) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("服务器未配置 GOOGLE_MAPS_API_KEY");
  }
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify({
      textQuery: [name, city].filter(Boolean).join(", "),
      pageSize: 5,
      languageCode: "zh-CN",
    }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message || "Google Places 查询失败");
  }
  return (body.places || [])
    .map(normalizeGooglePlace)
    .filter(
      (candidate) =>
        Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude),
    );
}

app.post("/api/geocode", async (req, res) => {
  const queries = Array.isArray(req.body?.queries) ? req.body.queries : [];
  const city = String(req.body?.city || "").trim();
  if (!queries.length || queries.length > 20) {
    return res.status(400).json({ error: "每次需要查询 1-20 个地点" });
  }
  if (!takeBatchQuota(req)) {
    return res.status(429).json({
      error: `今日批量查询次数已达上限（每个 IP ${dailyBatchLimit} 次）`,
    });
  }

  try {
    const results = [];
    for (const item of queries) {
      const name = String(item?.name || "").trim();
      if (!name) continue;
      const candidates = await googleTextSearch(name, city);
      results.push({ name, candidates });
    }
    res.json({ results });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "查询失败" });
  }
});

app.post("/api/ai-extract", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "服务器未配置 OPENAI_API_KEY" });
  }
  const text = String(req.body?.text || "").trim();
  if (!text || text.length > 30000) {
    return res.status(400).json({ error: "笔记内容不能为空，且不能超过 30000 字" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "Extract travel place names, descriptions, and coordinates explicitly present in the text. Never infer or invent coordinates. Return only valid JSON.",
          },
          {
            role: "user",
            content: text,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "travel_spots",
            strict: true,
            schema: {
              type: "object",
              properties: {
                spots: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                      latitude: { type: ["number", "null"] },
                      longitude: { type: ["number", "null"] },
                    },
                    required: ["name", "description", "latitude", "longitude"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["spots"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || "AI 识别失败");
    const outputText = body.output
      ?.flatMap((item) => item.content || [])
      .find((item) => item.type === "output_text")?.text;
    const parsed = JSON.parse(outputText || '{"spots":[]}');
    res.json(parsed);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "AI 识别失败" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    googleConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`API server running at http://127.0.0.1:${port}`);
});
