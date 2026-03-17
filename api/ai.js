// api/ai.js — Vercel Serverless Function
// Format CommonJS — compatible Vercel Hobby plan

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { prompt, mode } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt manquant dans la requête' });
  }

  const GROK_KEY = process.env.GROK_KEY || '';
  const CLAUDE_KEY = process.env.CLAUDE_KEY || '';

  try {
    let rawText = '';

    if (mode === 'grok') {
      if (!GROK_KEY) {
        return res.status(500).json({ error: 'GROK_KEY non configurée dans Vercel Environment Variables' });
      }

      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + GROK_KEY
        },
        body: JSON.stringify({
          model: 'grok-2-latest',
          max_tokens: 4000,
          temperature: 0.7,
          messages: [
            {
              role: 'system',
              content: 'Tu es un expert en copywriting et e-commerce africain. Tu génères du contenu marketing de haute qualité en français correct et naturel. Tu réponds UNIQUEMENT en JSON valide, sans texte avant ni après, sans backticks.'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Grok API error:', response.status, errText);
        return res.status(500).json({ error: 'Erreur API Grok: ' + response.status + ' — ' + errText });
      }

      const data = await response.json();
      rawText = data.choices[0].message.content;

    } else {
      // Claude
      if (!CLAUDE_KEY) {
        return res.status(500).json({ error: 'CLAUDE_KEY non configurée dans Vercel Environment Variables' });
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Claude API error:', response.status, errText);
        return res.status(500).json({ error: 'Erreur API Claude: ' + response.status });
      }

      const data = await response.json();
      rawText = data.content[0].text;
    }

    // Nettoyer et parser le JSON
    const clean = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr.message);
      console.error('Raw text received:', clean.substring(0, 500));
      return res.status(500).json({ error: 'Réponse IA invalide (JSON mal formé). Réessaie.' });
    }

    return res.status(200).json({ success: true, data: parsed });

  } catch (err) {
    console.error('Erreur serveur inattendue:', err);
    return res.status(500).json({ error: 'Erreur serveur: ' + err.message });
  }
};
