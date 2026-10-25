const URL_GEMINI =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function chamar(prompt) {
  return fetch(URL_GEMINI, {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 8000,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET" && req.query && req.query.teste) {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).send("FALTA a variável GEMINI_API_KEY. Crie na Vercel e faça Redeploy.");
    }
    try {
      const r = await chamar('Responda só com este JSON: {"ok":true}');
      const t = await r.text();
      return res.status(200).send("Status do Gemini: " + r.status + "\n\n" + t.slice(0, 600));
    } catch (e) {
      return res.status(200).send("Falha de rede: " + String(e).slice(0, 300));
    }
  }

  if (req.method !== "POST") return res.status(405).send("Método não permitido");
  const prompt = String((req.body && req.body.prompt) || "");
  if (!prompt || prompt.length > 8000) return res.status(400).send("Pedido inválido");
  try {
    const r = await chamar(prompt);
    if (!r.ok) {
      const t = await r.text();
      console.error("Gemini", r.status, t.slice(0, 300));
      return res.status(r.status === 429 ? 429 : 502).send("Erro na IA");
    }
    const d = await r.json();
    const parts = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
    const text = parts.map((p) => p.text || "").join("");
    return res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    return res.status(500).send("Erro interno");
  }
};
