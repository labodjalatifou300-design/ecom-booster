// api/ai.js — Vercel Serverless Function
// Supporte la VISION : analyse la photo du produit avant de générer
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { prompt, mode, image } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Prompt manquant' });

  try {
    let rawText = '';

    if (mode === 'grok') {
      const GROQ_KEY = process.env.GROK_KEY || '';
      if (!GROQ_KEY) return res.status(500).json({ error: 'GROK_KEY manquante dans Vercel Environment Variables' });

      // ÉTAPE 1 : Si une image est fournie, l'analyser d'abord avec un modèle vision
      let imageDescription = '';
      if (image && image.startsWith('data:image')) {
        try {
          console.log('Analyzing product image with vision...');
          const visionRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + GROQ_KEY
            },
            body: JSON.stringify({
              model: 'meta-llama/llama-4-scout-17b-16e-instruct',
              max_tokens: 500,
              messages: [{
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: { url: image }
                  },
                  {
                    type: 'text',
                    text: 'Décris ce produit en détail : qu\'est-ce que c\'est exactement, comment s\'utilise-t-il (se boit, s\'applique, se porte...), à quoi sert-il, quels problèmes résout-il ? Sois précis et factuel. Réponds en français.'
                  }
                ]
              }]
            })
          });

          if (visionRes.ok) {
            const visionData = await visionRes.json();
            imageDescription = visionData.choices[0].message.content;
            console.log('Image analyzed successfully:', imageDescription.substring(0, 100));
          } else {
            console.log('Vision model failed, continuing without image analysis');
          }
        } catch(e) {
          console.log('Vision error:', e.message);
        }
      }

      // ÉTAPE 2 : Construire le prompt final avec la description de l'image
      const finalPrompt = imageDescription
        ? `ANALYSE DE LA PHOTO DU PRODUIT:\n${imageDescription}\n\n${prompt}`
        : prompt;

      // ÉTAPE 3 : Générer le contenu marketing avec un modèle texte
      const textModels = [
        'llama-3.3-70b-versatile',
        'llama3-70b-8192',
        'mixtral-8x7b-32768'
      ];

      let succeeded = false;

      for (const model of textModels) {
        try {
          console.log('Generating content with:', model);
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
                { role: 'user', content: finalPrompt }
              ]
            })
          });

          if (response.ok) {
            const data = await response.json();
            rawText = data.choices[0].message.content;
            console.log('SUCCESS with model:', model);
            succeeded = true;
            break;
          } else {
            const errText = await response.text();
            console.log('FAILED model:', model, '| Status:', response.status, '|', errText.substring(0, 150));
          }
        } catch(e) {
          console.log('ERROR model:', model, '|', e.message);
        }
      }

      if (!succeeded) {
        return res.status(500).json({
          error: 'Génération échouée. Vérifie ta clé GROK_KEY dans Vercel (elle doit commencer par gsk_).'
        });
      }

    } else {
      // Claude
      const CLAUDE_KEY = process.env.CLAUDE_KEY || '';
      if (!CLAUDE_KEY) return res.status(500).json({ error: 'CLAUDE_KEY manquante dans Vercel Environment Variables' });

      // Claude supporte aussi la vision
      const messages = [];
      if (image && image.startsWith('data:image')) {
        const mediaType = image.split(';')[0].split(':')[1] || 'image/jpeg';
        const base64Data = image.split(',')[1];
        messages.push({
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
            { type: 'text', text: prompt }
          ]
        });
      } else {
        messages.push({ role: 'user', content: prompt });
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
          messages
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
