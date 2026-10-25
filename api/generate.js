// Modelos testados em ordem. Se um falhar, demorar ou sair do ar, tenta o próximo.
const MODELOS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3-flash-preview"];
const TEMPO_POR_MODELO_MS = 18000;

async function chamar(prompt) {
  let ultima = null;
  for (const modelo of MODELOS) {
    try {
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + modelo + ":generateContent",
        {
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
            },
          }),
          signal: AbortSignal.timeout(TEMPO_POR_MODELO_MS),
        }
      );
      ultima = { r, modelo };
      if (![404, 500, 503].includes(r.status)) return ultima;
    } catch (e) {
      ultima = { erro: String(e).slice(0, 200), modelo };
    }
  }
  return ultima;
}

function lerPrompt(req) {
  let b = req.body;
  if (typeof b === "string") {
    try {
      b = JSON.parse(b);
    } catch (e) {
      b = {};
    }
  }
  return String((b && b.prompt) || "");
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  // Página de teste: abra /api/generate?teste=1
  if (req.method === "GET" && req.query && req.query.teste) {
    if (!process.env.GEMINI_API_KEY) return res.status(200).send("FALTA a variável GEMINI_API_KEY.");
    const inicio = Date.now();
    const x = await chamar('Responda só com este JSON: {"ok":true}');
    const seg = ((Date.now() - inicio) / 1000).toFixed(1) + "s";
    if (x.erro) return res.status(200).send("Modelo: " + x.modelo + "\nFalhou ou demorou: " + x.erro + "\nTempo: " + seg);
    const t = await x.r.text();
    return res.status(200).send("Modelo: " + x.modelo + "\nStatus do Gemini: " + x.r.status + "\nTempo: " + seg + "\n\n" + t.slice(0, 600));
  }

  if (req.method !== "POST") return res.status(405).send("Método não permitido");
  if (!process.env.GEMINI_API_KEY) return res.status(500).send("Servidor sem chave");

  const prompt = lerPrompt(req);
  if (!prompt || prompt.length > 20000) return res.status(400).send("Pedido inválido");

  try {
    const x = await chamar(prompt);
    if (x.erro) {
      console.error("Gemini falhou", x.modelo, x.erro);
      return res.status(504).send("A IA demorou demais");
    }
    if (!x.r.ok) {
      const t = await x.r.text();
      console.error("Gemini", x.modelo, x.r.status, t.slice(0, 300));
      return res.status(x.r.status === 429 ? 429 : 502).send("Erro na IA");
    }
    const d = await x.r.json();
    const parts =
      (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
    const text = parts.filter((p) => !p.thought).map((p) => p.text || "").join("");
    return res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    return res.status(500).send("Erro interno");
  }
