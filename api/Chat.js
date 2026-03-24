// api/chat.js — Assistant IA Chat
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { messages, mode } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages manquants' });
  }

  const systemPrompt = `Tu es un expert en e-commerce africain et en neuromarketing. Tu aides les vendeurs africains à vendre mieux en ligne.

Tes domaines d'expertise :
- Stratégie produit et pricing pour le marché africain (Togo, Côte d'Ivoire, Sénégal, Cameroun, etc.)
- Publicité Facebook et Instagram pour l'Afrique francophone
- Copywriting et neuromarketing adapté à la culture africaine
- Page produit Shopify et descriptions qui convertissent
- Voix off et scripts vidéo pour les produits e-commerce
- Avatar client et ciblage publicitaire
- Analyse de concurrence et positionnement

Règles de style :
- Réponds en français, de manière directe et pratique
- Donne des exemples concrets adaptés à l'Afrique
- Sois bref et utile — pas de blabla
- Si tu as le contexte produit, utilise-le pour personnaliser tes réponses
- Tu peux aussi poser des questions de clarification si nécessaire`;

  try {
    let reply = '';

    if (mode === 'claude') {
      const CLAUDE_KEY = process.env.CLAUDE_KEY || '';
      if (!CLAUDE_KEY) return res.status(500).json({ error: 'CLAUDE_KEY manquante dans Vercel' });

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
          system: systemPrompt,
          messages: messages.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
          }))
        })
      });

      if (!response.ok) {
        const err = await response.text();
        return res.status(500).json({ error: 'Erreur Claude: ' + response.status });
      }
      const data = await response.json();
      reply = data.content[0].text;

    } else {
      // Groq fallback
      const GROQ_KEY = process.env.GROK_KEY || '';
      if (!GROQ_KEY) return res.status(500).json({ error: 'Clé API manquante dans Vercel' });

      const groqMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ];

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + GROQ_KEY
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1000,
          temperature: 0.7,
          messages: groqMessages
        })
      });

      if (!response.ok) {
        return res.status(500).json({ error: 'Erreur API: ' + response.status });
      }
      const data = await response.json();
      reply = data.choices[0].message.content;
    }

    return res.status(200).json({ success: true, reply });

  } catch (err) {
    console.error('Chat error:', err.message);
    return res.status(500).json({ error: 'Erreur: ' + err.message });
  }
};
