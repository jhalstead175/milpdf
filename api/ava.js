import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method === "GET") {
    res.status(200).json({ ok: true });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { messages = [], model = "gpt-4o-mini" } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "Missing messages" });
      return;
    }

    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.2,
    });

    res.status(200).json({
      content: response.choices?.[0]?.message?.content || "",
      usage: response.usage,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "OpenAI error" });
  }
}
