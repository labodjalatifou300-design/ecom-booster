// api/ai.js — Vercel Serverless Function
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

      // Analyse image si fournie
      let imageDescription = '';
      if (image && image.startsWith('data:image')) {
        try {
          const visionRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_KEY },
            body: JSON.stringify({
              model: 'meta-llama/llama-4-scout-17b-16e-instruct',
              max_tokens: 300,
              messages: [{
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: image } },
                  { type: 'text', text: 'Décris ce produit en 2-3 phrases : qu\'est-ce que c\'est, comment s\'utilise-t-il (se boit, s\'applique, etc.), à quoi sert-il. Sois factuel et précis. Réponds en français.' }
                ]
              }]
            })
          });
          if (visionRes.ok) {
            const vd = await visionRes.json();
            imageDescription = vd.choices[0].message.content;
          }
        } catch(e) { console.log('Vision skip:', e.message); }
      }

      const finalPrompt = imageDescription
        ? `ANALYSE PHOTO DU PRODUIT:\n${imageDescription}\n\n${prompt}`
        : prompt;

      // Modèles texte Groq - du plus rapide au plus puissant
      const textModels = ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'mixtral-8x7b-32768'];
      let succeeded = false;

      for (const model of textModels) {
        try {
          console.log('Trying:', model);
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_KEY },
            body: JSON.stringify({
              model: model,
              max_tokens: 8000,  // Augmenté pour éviter la coupure JSON
              temperature: 0.7,
              messages: [
                {
                  role: 'system',
                  content: 'Tu es un expert en copywriting et marketing e-commerce africain. Tu génères du contenu marketing de haute qualité en français correct et naturel. RÈGLE ABSOLUE: Tu réponds UNIQUEMENT avec un objet JSON valide et complet. Commence directement par { et termine par }. Aucun texte avant ou après. Aucun backtick. Le JSON doit être 100% complet et valide.'
                },
                { role: 'user', content: finalPrompt }
              ]
            })
          });

          if (response.ok) {
            const data = await response.json();
            rawText = data.choices[0].message.content;
            const finishReason = data.choices[0].finish_reason;
            console.log('Model:', model, '| Finish:', finishReason, '| Length:', rawText.length);

            // Si coupé (finish_reason=length), essayer le modèle suivant
            if (finishReason === 'length') {
              console.log('Response truncated, trying next model...');
              continue;
            }
            succeeded = true;
            break;
          } else {
            const errText = await response.text();
            console.log('FAILED:', model, response.status, errText.substring(0, 150));
          }
        } catch(e) {
          console.log('ERROR:', model, e.message);
        }
      }

      if (!succeeded && rawText) {
        // On a une réponse mais peut-être coupée - essayer de la réparer
        console.log('Trying to repair truncated JSON...');
        succeeded = true; // On essaie quand même de parser
      }

      if (!succeeded) {
        return res.status(500).json({ error: 'Génération échouée. Réessaie.' });
      }

    } else {
      // Claude
      const CLAUDE_KEY = process.env.CLAUDE_KEY || '';
      if (!CLAUDE_KEY) return res.status(500).json({ error: 'CLAUDE_KEY manquante dans Vercel Environment Variables' });

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
          model: 'claude-sonnet-4-5',
          max_tokens: 8000,
          messages
        })
      });

      if (!response.ok) {
        const err = await response.text();
        return res.status(500).json({ error: 'Erreur Claude: ' + response.status + ' - ' + err.substring(0, 200) });
      }
      const data = await response.json();
      rawText = data.content[0].text;
    }

    // Nettoyer et réparer le JSON
    let clean = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    // Extraire le JSON si entouré d'autre texte
    const jsonStart = clean.indexOf('{');
    const jsonEnd = clean.lastIndexOf('}');
    if (jsonStart > 0 || jsonEnd < clean.length - 1) {
      clean = clean.substring(jsonStart, jsonEnd + 1);
    }

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('JSON parse error:', e.message);
      console.error('Raw length:', rawText.length, '| Début:', clean.substring(0, 200));

      // Tentative de réparation : compléter le JSON coupé
      try {
        // Compter les accolades ouvertes vs fermées
        let openBraces = (clean.match(/{/g) || []).length;
        let closeBraces = (clean.match(/}/g) || []).length;
        let missingBraces = openBraces - closeBraces;

        // Compter les crochets ouverts vs fermés
        let openBrackets = (clean.match(/\[/g) || []).length;
        let closeBrackets = (clean.match(/\]/g) || []).length;
        let missingBrackets = openBrackets - closeBrackets;

        let repaired = clean;
        // Fermer les éventuelles chaînes ouvertes
        if (repaired.match(/"[^"]*$/)) repaired += '"';
        // Fermer les tableaux manquants
        for (let i = 0; i < missingBrackets; i++) repaired += ']';
        // Fermer les objets manquants
        for (let i = 0; i < missingBraces; i++) repaired += '}';

        parsed = JSON.parse(repaired);
        console.log('JSON repaired successfully!');
      } catch(repairErr) {
        return res.status(500).json({
          error: 'Réponse IA invalide. Clique sur "Analyser" pour réessayer.',
          debug: clean.substring(0, 100)
        });
      }
    }

    return res.status(200).json({ success: true, data: parsed });

  } catch (err) {
    console.error('Erreur serveur:', err.message);
    return res.status(500).json({ error: 'Erreur: ' + err.message });
  }
};
