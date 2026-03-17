// api/ai.js — Vercel Serverless Function
// Ce fichier tourne sur le SERVEUR Vercel.
// Les clés API ne sont JAMAIS visibles par l'utilisateur.

export default async function handler(req, res) {
  // Autoriser les requêtes depuis ton site
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Répondre aux requêtes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { prompt, mode } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt manquant' });
    }

    let result;

    if (mode === 'grok') {
      // Clé Grok — stockée dans Vercel, jamais visible
      const GROK_KEY = process.env.GROK_KEY;
      if (!GROK_KEY) {
        return res.status(500).json({ error: 'Clé Grok non configurée dans Vercel' });
      }

      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROK_KEY}`
        },
        body: JSON.stringify({
          model: 'grok-2-latest',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        const err = await response.text();
        return res.status(response.status).json({ error: 'Erreur Grok: ' + err });
      }

      const data = await response.json();
      result = data.choices[0].message.content;

    } else {
      // Claude — clé stockée dans Vercel, jamais visible
      const CLAUDE_KEY = process.env.CLAUDE_KEY;
      if (!CLAUDE_KEY) {
        return res.status(500).json({ error: 'Clé Claude non configurée dans Vercel' });
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
        const err = await response.text();
        return res.status(response.status).json({ error: 'Erreur Claude: ' + err });
      }

      const data = await response.json();
      result = data.content[0].text;
    }

    // Nettoyer et parser le JSON
    const clean = result.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json({ success: true, data: parsed });

  } catch (error) {
    console.error('Erreur serveur:', error);
    return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
  }
}
