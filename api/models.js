// api/models.js — Endpoint de diagnostic
// Appelle ceci depuis ton navigateur : https://ecom-booster.vercel.app/api/models
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const GROK_KEY = process.env.GROK_KEY || '';
  if (!GROK_KEY) {
    return res.status(500).json({ error: 'GROK_KEY manquante dans Vercel' });
  }

  try {
    // 1. Liste les modèles disponibles
    const modelsRes = await fetch('https://api.x.ai/v1/models', {
      headers: { 'Authorization': 'Bearer ' + GROK_KEY }
    });
    const modelsData = await modelsRes.json();

    // 2. Test rapide avec chaque modèle
    const testModels = ['grok-3-beta', 'grok-2-1212', 'grok-3', 'grok-beta'];
    const results = {};

    for (const model of testModels) {
      try {
        const r = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + GROK_KEY
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Dis juste: OK' }]
          })
        });
        const d = await r.json();
        results[model] = r.ok ? '✅ MARCHE' : '❌ ' + (d.error?.message || r.status);
      } catch(e) {
        results[model] = '❌ ' + e.message;
      }
    }

    return res.status(200).json({
      models_disponibles: modelsData,
      tests: results
    });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
