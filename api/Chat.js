// api/chat.js — Chat IA produit (utilise Claude)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const CLAUDE_KEY = process.env.CLAUDE_KEY || '';
  if (!CLAUDE_KEY) return res.status(500).json({ error: 'CLAUDE_KEY manquante dans Vercel' });

  const { message, context, history } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Message manquant' });

  try {
    // Construire les messages avec l'historique
    const messages = [];

    // Ajouter l'historique de la conversation
    if (history && history.length > 0) {
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Ajouter le message actuel
    messages.push({ role: 'user', content: message });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: `Tu es un expert en e-commerce africain, neuromarketing et publicité Facebook. Tu aides les vendeurs africains à maximiser leurs ventes en ligne.

${context ? `CONTEXTE DU PRODUIT ANALYSÉ:\n${context}\n` : ''}

RÈGLES DE RÉPONSE:
- Réponds en français, ton direct et chaleureux
- Réponses courtes et actionnables (max 150 mots)
- Donne des conseils concrets adaptés au marché africain
- Utilise des exemples réels du quotidien africain
- Si on te demande quelque chose hors e-commerce, ramène poliment sur le sujet du produit
- Utilise des emojis avec modération pour structurer tes réponses`,
        messages
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Erreur Claude: ' + response.status });
    }

    const data = await response.json();
    const reply = data.content[0].text;

    return res.status(200).json({ success: true, reply });

  } catch (err) {
    console.error('Chat error:', err.message);
    return res.status(500).json({ error: 'Erreur: ' + err.message });
  }
};
