// api/ai.js — Vercel Serverless Function
// Utilise GROQ (groq.com) — clé commence par gsk_
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { prompt, mode } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Prompt manquant' });

  try {
    let rawText = '';

    if (mode === 'grok') {
      // GROQ API — endpoint correct
      const GROQ_KEY = process.env.GROK_KEY || '';
      if (!GROQ_KEY) return res.status(500).json({ error: 'GROK_KEY manquante dans Vercel Environment Variables' });

      // Modèles Groq disponibles gratuitement
      const models = [
        'llama-3.3-70b-versatile',
        'llama3-70b-8192',
        'mixtral-8x7b-32768',
        'llama3-8b-8192'
      ];

      let succeeded = false;

      for (const model of models) {
        try {
          console.log('Trying Groq model:', model);
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + GROQ_KEY
            },
            body: JSON.stringify({
              model: model,
              max_tokens: 4000,
              temperature: 0.7,
              messages: [
                {
                  role: 'system',
                  content: 'Tu es un expert en copywriting et marketing e-commerce africain. Tu génères du contenu marketing de haute qualité en français correct et naturel, adapté au marché africain francophone. Tu réponds UNIQUEMENT en JSON valide, sans texte avant ni après, sans backticks markdown.'
                },
                { role: 'user', content: prompt }
              ]
            })
          });

          if (response.ok) {
            const data = await response.json();
            rawText = data.choices[0].message.content;
            console.log('SUCCESS with Groq model:', model);
            succeeded = true;
            break;
          } else {
            const errText = await response.text();
            console.log('FAILED Groq model:', model, '| Status:', response.status, '|', errText.substring(0, 200));
          }
        } catch(e) {
          console.log('ERROR Groq model:', model, '|', e.message);
        }
      }

      if (!succeeded) {
        return res.status(500).json({
          error: 'Tous les modèles Groq ont échoué. Vérifie ta clé GROK_KEY dans Vercel (elle doit commencer par gsk_).'
        });
      }

    } else {
      // Claude
      const CLAUDE_KEY = process.env.CLAUDE_KEY || '';
      if (!CLAUDE_KEY) return res.status(500).json({ error: 'CLAUDE_KEY manquante dans Vercel Environment Variables' });

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
        return res.status(500).json({ error: 'Erreur Claude: ' + response.status });
      }
      const data = await response.json();
      rawText = data.content[0].text;
    }

    // Nettoyer le JSON
    const clean = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('JSON parse error. Début:', clean.substring(0, 300));
      return res.status(500).json({ error: 'Réponse IA invalide. Réessaie.' });
    }

    return res.status(200).json({ success: true, data: parsed });

  } catch (err) {
    console.error('Erreur:', err.message);
    return res.status(500).json({ error: 'Erreur: ' + err.message });
  }
};
