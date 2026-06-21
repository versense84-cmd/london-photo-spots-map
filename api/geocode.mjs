const dailyBatchLimit = Number(process.env.DAILY_BATCH_LIMIT || 10);
const usage = new Map();

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function takeQuota(req) {
  const key = `${new Date().toISOString().slice(0, 10)}|${clientIp(req)}`;
  const count = usage.get(key) || 0;
  if (count >= dailyBatchLimit) return false;
  usage.set(key, count + 1);
  return true;
}

async function searchPlace(name, city) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("服务器未配置 GOOGLE_MAPS_API_KEY");

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
  if (!response.ok) throw new Error(body.error?.message || "Google Places 查询失败");

  return (body.places || []).map((place) => ({
    name: place.displayName?.text || place.formattedAddress || "Unnamed place",
    address: place.formattedAddress || "",
    latitude: Number(place.location?.latitude),
    longitude: Number(place.location?.longitude),
    placeId: place.id,
  })).filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const queries = Array.isArray(req.body?.queries) ? req.body.queries : [];
  const city = String(req.body?.city || "").trim();
  if (!queries.length || queries.length > 20) {
    return res.status(400).json({ error: "每次需要查询 1-20 个地点" });
  }
  if (!takeQuota(req)) {
    return res.status(429).json({
      error: `今日批量查询次数已达上限（每个 IP ${dailyBatchLimit} 次）`,
    });
  }

  try {
    const results = [];
    for (const item of queries) {
      const name = String(item?.name || "").trim();
      if (name) results.push({ name, candidates: await searchPlace(name, city) });
    }
    return res.json({ results });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "查询失败",
    });
  }
}
