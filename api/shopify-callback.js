// api/shopify-callback.js — Callback OAuth Shopify
// URL propre sans paramètre réservé : https://ecom-booster.vercel.app/api/shopify-callback

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';

module.exports = async function handler(req, res) {
  const { code, shop, state, hmac } = req.query;

  if (!code || !shop) {
    return res.status(400).send(`
      <!DOCTYPE html><html>
      <body style="font-family:sans-serif;text-align:center;padding:2rem;background:#07080F;color:#EDEAE2">
        <div style="font-size:2rem;margin-bottom:.5rem">❌</div>
        <h3>Paramètres manquants</h3>
        <p style="color:#7A7E96">Ferme cette fenêtre et réessaie.</p>
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

    if (!accessToken) throw new Error('Token vide reçu de Shopify');

    // Succès — envoyer token et boutique à la fenêtre parente via postMessage
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><title>Connexion Shopify</title></head>
      <body style="font-family:'Outfit',sans-serif;text-align:center;padding:3rem;background:#07080F;color:#EDEAE2">
        <div style="font-size:3rem;margin-bottom:1rem">✅</div>
        <h2 style="color:#22C55E;margin-bottom:.5rem">Boutique connectée !</h2>
        <p style="color:#7A7E96;font-size:.9rem">${shop}</p>
        <p style="color:#7A7E96;font-size:.8rem;margin-top:1rem">Cette fenêtre se ferme automatiquement...</p>
        <script>
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
      <!DOCTYPE html><html>
      <body style="font-family:sans-serif;text-align:center;padding:2rem;background:#07080F;color:#EDEAE2">
        <div style="font-size:2rem;margin-bottom:.5rem">❌</div>
        <h3>Erreur de connexion</h3>
        <p style="color:#F87171;font-size:.85rem">${err.message}</p>
        <p style="color:#7A7E96;font-size:.8rem">Ferme cette fenêtre et réessaie.</p>
        <script>setTimeout(()=>window.close(),4000)</script>
      </body></html>
    `);
  }
};
