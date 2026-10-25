module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).send("Método não permitido");
  const prompt = String((req.body && req.body.prompt) || "");
  if (!prompt || prompt.length > 8000) return res.status(400).send("Pedido inválido");
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5-5",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) return res.status(r.status === 429 ? 429 : 502).send("Erro na IA");
    const d = await r.json();
    const text = (d.content || []).map((c) => c.text || "").join("");
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).send("Erro interno");
  }
};
