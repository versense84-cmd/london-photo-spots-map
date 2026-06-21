export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "服务器未配置 OPENAI_API_KEY" });

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
          { role: "user", content: text },
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
    return res.json(JSON.parse(outputText || '{"spots":[]}'));
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "AI 识别失败",
    });
  }
}
