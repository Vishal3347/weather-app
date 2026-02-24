// api/ai.js – Vercel Serverless Function
// Proxy to Google Gemini API (FREE tier — no credit card needed)
//
// Setup:
//   1. Get free API key at: https://aistudio.google.com/app/apikey
//      (Sign in with Google → "Get API Key" → Create → Copy)
//   2. Run: vercel env add GEMINI_API_KEY
//   3. Paste your key when prompted
//   4. Deploy: vercel --prod

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY not configured in Vercel env vars" });
    }

    try {
        const { messages, system } = req.body;

        // Convert chat history to Gemini format
        // Gemini uses {role: "user"/"model", parts: [{text}]}
        const geminiContents = messages.map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
        }));

        const body = {
            system_instruction: { parts: [{ text: system || "" }] },
            contents: geminiContents,
            generationConfig: {
                maxOutputTokens: 300,
                temperature: 0.7,
            },
        };

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return res.status(response.status).json({ error: err.error?.message || "Gemini API error" });
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        return res.status(200).json({ text });

    } catch (err) {
        console.error("Proxy error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
