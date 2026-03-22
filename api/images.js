// api/images.js — Génération d'images via Together AI (FLUX Schnell - Gratuit 3 mois)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const TOGETHER_KEY = process.env.TOGETHER_API_KEY || '';
  if (!TOGETHER_KEY) return res.status(500).json({ error: 'TOGETHER_API_KEY manquante dans Vercel Environment Variables' });

  const { type, productName, benefits, reviewText, reviewerName, modifyPrompt, imageUrl } = req.body || {};
  if (!type) return res.status(400).json({ error: 'Type de génération manquant' });

  try {
    let prompt = '';

    // ── Construire le prompt selon le type demandé
    if (type === 'clean_background') {
      prompt = `Professional product photography of ${productName}, clean pure white studio background, soft drop shadows, centered product, high-end commercial photography, 8K resolution, photorealistic, no text`;

    } else if (type === 'lifestyle') {
      prompt = `${productName} product in a luxury lifestyle setting, elegant modern African home interior, warm golden lighting, beautiful artistic composition, high-end brand photography, photorealistic, aspirational`;

    } else if (type === 'benefits') {
      const benefitText = (benefits || []).slice(0, 3).join(', ');
      prompt = `Professional marketing image of ${productName}, clean dark background with colorful accent colors, product prominently displayed, modern African brand aesthetic, bold visual design highlighting benefits: ${benefitText}, high quality commercial photo`;

    } else if (type === 'review') {
      prompt = `${productName} product displayed elegantly, customer review card overlay with 5 gold stars, African customer testimonial, name "${reviewerName || 'Kofi M.'}", quote "${reviewText || 'Excellent produit, je recommande!'}", modern e-commerce style, dark elegant background, professional marketing image`;

    } else if (type === 'modify') {
      prompt = modifyPrompt || `Improve this product image for ${productName}, professional quality, clean background, high-end commercial photography`;

    } else {
      return res.status(400).json({ error: 'Type non reconnu: ' + type });
    }

    // ── Appel Together AI — FLUX.1 Schnell (gratuit 3 mois)
    const response = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + TOGETHER_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-schnell-Free',
        prompt: prompt,
        width: 1024,
        height: 1024,
        steps: 4,
        n: 1,
        response_format: 'url'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Together AI error:', JSON.stringify(data));
      // Fallback sur le modèle payant si le gratuit ne fonctionne pas
      return await generateWithPaidModel(TOGETHER_KEY, prompt, res);
    }

    const imageResultUrl = data?.data?.[0]?.url || null;

    if (!imageResultUrl) {
      console.error('No image URL in result:', JSON.stringify(data).substring(0, 200));
      return res.status(500).json({ error: 'Aucune image générée. Réessaie.' });
    }

    return res.status(200).json({ success: true, url: imageResultUrl });

  } catch (err) {
    console.error('Image generation error:', err.message);
    return res.status(500).json({ error: 'Erreur: ' + err.message });
  }
};

// ── Fallback : modèle payant si gratuit indisponible
async function generateWithPaidModel(apiKey, prompt, res) {
  try {
    const response = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-schnell',
        prompt: prompt,
        width: 1024,
        height: 1024,
        steps: 4,
        n: 1,
        response_format: 'url'
      })
    });

    const data = await response.json();
    const imageResultUrl = data?.data?.[0]?.url || null;

    if (!imageResultUrl) {
      return res.status(500).json({ error: 'Aucune image générée. Vérifie ta clé Together AI.' });
    }

    return res.status(200).json({ success: true, url: imageResultUrl });

  } catch (err) {
    return res.status(500).json({ error: 'Erreur fallback: ' + err.message });
  }
}
