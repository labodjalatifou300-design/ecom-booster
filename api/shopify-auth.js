// api/shopify-auth.js — OAuth Shopify multi-utilisateurs
// Gère l'initiation OAuth et le callback pour chaque utilisateur

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';
const APP_URL = process.env.APP_URL || '';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // ── ACTION 1 : Initier la connexion OAuth
  // L'utilisateur entre son nom de boutique → on le redirige vers Shopify
  if (action === 'connect') {
    const { shop } = req.query;
    if (!shop) {
      return res.status(400).json({ error: 'Nom de boutique manquant' });
    }

    // Nettoyer le nom de la boutique
    let shopDomain = shop.trim().toLowerCase()
      .replace('https://', '')
      .replace('http://', '')
      .replace(/\/$/, '');

    // Ajouter .myshopify.com si nécessaire
    if (!shopDomain.includes('.myshopify.com')) {
      shopDomain = shopDomain.replace('.myshopify.com', '') + '.myshopify.com';
    }

    // Scopes nécessaires
    const scopes = 'write_products,read_products';
    const redirectUri = `${APP_URL}/api/shopify-auth?action=callback`;
    const state = Buffer.from(JSON.stringify({ shop: shopDomain, ts: Date.now() })).toString('base64');

    const authUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    return res.status(200).json({ success: true, authUrl, shop: shopDomain });
  }

  // ── ACTION 2 : Callback OAuth — Shopify nous envoie le code
  if (action === 'callback') {
    const { code, shop, state, hmac } = req.query;

    if (!code || !shop) {
      return res.status(400).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:2rem;background:#07080F;color:#EDEAE2">
          <h2>❌ Erreur de connexion</h2>
          <p>Paramètres manquants. Réessaie depuis l'application.</p>
          <script>setTimeout(()=>window.close(),3000)</script>
        </body></html>
      `);
    }

    try {
      // Échanger le code contre un access token
      const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: SHOPIFY_API_KEY,
          client_secret: SHOPIFY_API_SECRET,
          code
        })
      });

      if (!tokenRes.ok) {
        throw new Error('Échange de token échoué: ' + tokenRes.status);
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      if (!accessToken) {
        throw new Error('Token vide reçu de Shopify');
      }

      // Succès — envoyer le token et la boutique à la page parente via postMessage
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Connexion Shopify réussie</title></head>
        <body style="font-family:'Outfit',sans-serif;text-align:center;padding:3rem;background:#07080F;color:#EDEAE2">
          <div style="font-size:3rem;margin-bottom:1rem">✅</div>
          <h2 style="color:#22C55E;margin-bottom:.5rem">Boutique connectée !</h2>
          <p style="color:#7A7E96;font-size:.9rem">${shop}</p>
          <p style="color:#7A7E96;font-size:.8rem;margin-top:1rem">Cette fenêtre va se fermer automatiquement...</p>
          <script>
            // Envoyer le token et la boutique à la fenêtre parente
            if(window.opener) {
              window.opener.postMessage({
                type: 'SHOPIFY_AUTH_SUCCESS',
                shop: '${shop}',
                token: '${accessToken}'
              }, '*');
            }
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
        </html>
      `);

    } catch (err) {
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <body style="font-family:sans-serif;text-align:center;padding:2rem;background:#07080F;color:#EDEAE2">
          <div style="font-size:2rem;margin-bottom:.5rem">❌</div>
          <h3>Erreur de connexion</h3>
          <p style="color:#F87171;font-size:.85rem">${err.message}</p>
          <p style="color:#7A7E96;font-size:.8rem">Ferme cette fenêtre et réessaie.</p>
          <script>setTimeout(()=>window.close(),4000)</script>
        </body>
        </html>
      `);
    }
  }

  return res.status(400).json({ error: 'Action non reconnue' });
};
