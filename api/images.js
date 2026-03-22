// api/images.js — Génération d'images via Fal.ai (FLUX)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const FAL_KEY = process.env.FAL_KEY || '';
  if (!FAL_KEY) return res.status(500).json({ error: 'FAL_KEY manquante dans Vercel Environment Variables' });

  const { type, imageBase64, productName, benefits, reviewText, reviewerName, modifyPrompt, imageUrl } = req.body || {};
  if (!type) return res.status(400).json({ error: 'Type de génération manquant' });

  try {
    let result = null;

    // ── ÉTAPE 1 : Upload l'image sur Fal.ai storage si base64 fourni
    let uploadedImageUrl = imageUrl || null;
    if (imageBase64 && imageBase64.startsWith('data:image')) {
      try {
        // Convertir base64 en blob pour upload
        const base64Data = imageBase64.split(',')[1];
        const mimeType = imageBase64.split(';')[0].split(':')[1] || 'image/jpeg';
        const buffer = Buffer.from(base64Data, 'base64');

        // Upload vers Fal storage
        const uploadRes = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate', {
          method: 'POST',
          headers: {
            'Authorization': 'Key ' + FAL_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content_type: mimeType, file_name: 'product.jpg' })
        });

        if (uploadRes.ok) {
          const { upload_url, file_url } = await uploadRes.json();
          await fetch(upload_url, {
            method: 'PUT',
            headers: { 'Content-Type': mimeType },
            body: buffer
          });
          uploadedImageUrl = file_url;
          console.log('Image uploaded to Fal:', uploadedImageUrl);
        }
      } catch(e) {
        console.log('Upload error, using base64 directly:', e.message);
        uploadedImageUrl = imageBase64; // fallback
      }
    }

    const falHeaders = {
      'Authorization': 'Key ' + FAL_KEY,
      'Content-Type': 'application/json'
    };

    // ── TYPE 1 : Fond propre (enlever fond + fond blanc/coloré)
    if (type === 'clean_background') {
      // Étape 1 : Enlever le fond avec BiRefNet
      const bgRes = await fetch('https://queue.fal.run/fal-ai/birefnet', {
        method: 'POST',
        headers: falHeaders,
        body: JSON.stringify({ image_url: uploadedImageUrl })
      });
      const bgJob = await bgRes.json();

      // Attendre le résultat
      let bgResult = await pollFalJob(FAL_KEY, bgJob.request_id || bgJob.id, 'fal-ai/birefnet');

      const transparentUrl = bgResult?.image?.url || bgResult?.images?.[0]?.url;

      if (transparentUrl) {
        // Étape 2 : FLUX image-to-image pour fond propre
        const fluxRes = await fetch('https://queue.fal.run/fal-ai/flux/dev/image-to-image', {
          method: 'POST',
          headers: falHeaders,
          body: JSON.stringify({
            image_url: transparentUrl,
            prompt: `Professional product photography of ${productName}, clean white studio background, soft shadows, high-end commercial photography, 8K resolution, photorealistic`,
            strength: 0.3,
            num_inference_steps: 28,
            guidance_scale: 3.5
          })
        });
        const fluxJob = await fluxRes.json();
        result = await pollFalJob(FAL_KEY, fluxJob.request_id || fluxJob.id, 'fal-ai/flux/dev/image-to-image');
      } else {
        // Fallback : génération directe sans fond
        const fluxRes = await fetch('https://queue.fal.run/fal-ai/flux/dev', {
          method: 'POST',
          headers: falHeaders,
          body: JSON.stringify({
            prompt: `Professional product photography of ${productName}, clean white studio background, soft shadows, centered, high-end commercial photography, photorealistic, 8K`,
            image_size: '1024x1024',
            num_inference_steps: 28
          })
        });
        const fluxJob = await fluxRes.json();
        result = await pollFalJob(FAL_KEY, fluxJob.request_id || fluxJob.id, 'fal-ai/flux/dev');
      }
    }

    // ── TYPE 2 : Image lifestyle (produit dans une scène)
    else if (type === 'lifestyle') {
      const fluxRes = await fetch('https://queue.fal.run/fal-ai/flux/dev/image-to-image', {
        method: 'POST',
        headers: falHeaders,
        body: JSON.stringify({
          image_url: uploadedImageUrl,
          prompt: `${productName} product in a luxury lifestyle setting, elegant African home, warm lighting, beautiful composition, high-end brand photography, photorealistic`,
          strength: 0.65,
          num_inference_steps: 28,
          guidance_scale: 3.5
        })
      });
      const fluxJob = await fluxRes.json();
      result = await pollFalJob(FAL_KEY, fluxJob.request_id || fluxJob.id, 'fal-ai/flux/dev/image-to-image');
    }

    // ── TYPE 3 : Image bénéfices (produit + textes bulles)
    else if (type === 'benefits') {
      const benefitText = (benefits || []).slice(0, 3).join(' | ');
      const fluxRes = await fetch('https://queue.fal.run/fal-ai/flux/dev/image-to-image', {
        method: 'POST',
        headers: falHeaders,
        body: JSON.stringify({
          image_url: uploadedImageUrl,
          prompt: `Professional marketing image of ${productName} with text overlay showing benefits: ${benefitText}. Clean design, dark background with colorful accent colors, modern African brand aesthetic, high quality`,
          strength: 0.55,
          num_inference_steps: 28,
          guidance_scale: 3.5
        })
      });
      const fluxJob = await fluxRes.json();
      result = await pollFalJob(FAL_KEY, fluxJob.request_id || fluxJob.id, 'fal-ai/flux/dev/image-to-image');
    }

    // ── TYPE 4 : Image avis client africain style Amazon
    else if (type === 'review') {
      const fluxRes = await fetch('https://queue.fal.run/fal-ai/flux/dev/image-to-image', {
        method: 'POST',
        headers: falHeaders,
        body: JSON.stringify({
          image_url: uploadedImageUrl,
          prompt: `${productName} product image with a customer review overlay card showing 5 stars rating, African customer name "${reviewerName || 'Kofi M.'}", review text "${reviewText || 'Excellent produit, je recommande!'}", modern e-commerce style, dark elegant background`,
          strength: 0.45,
          num_inference_steps: 28,
          guidance_scale: 3.5
        })
      });
      const fluxJob = await fluxRes.json();
      result = await pollFalJob(FAL_KEY, fluxJob.request_id || fluxJob.id, 'fal-ai/flux/dev/image-to-image');
    }

    // ── TYPE 5 : Modifier une image existante
    else if (type === 'modify' && (imageUrl || uploadedImageUrl)) {
      const fluxRes = await fetch('https://queue.fal.run/fal-ai/flux/dev/image-to-image', {
        method: 'POST',
        headers: falHeaders,
        body: JSON.stringify({
          image_url: imageUrl || uploadedImageUrl,
          prompt: modifyPrompt || `Improve this product image for ${productName}`,
          strength: 0.7,
          num_inference_steps: 28,
          guidance_scale: 3.5
        })
      });
      const fluxJob = await fluxRes.json();
      result = await pollFalJob(FAL_KEY, fluxJob.request_id || fluxJob.id, 'fal-ai/flux/dev/image-to-image');
    }

    else {
      return res.status(400).json({ error: 'Type non reconnu: ' + type });
    }

    // Extraire l'URL de l'image générée
    const imageResultUrl =
      result?.images?.[0]?.url ||
      result?.image?.url ||
      result?.output?.[0] ||
      null;

    if (!imageResultUrl) {
      console.error('No image URL in result:', JSON.stringify(result).substring(0, 200));
      return res.status(500).json({ error: 'Aucune image générée. Réessaie.' });
    }

    return res.status(200).json({ success: true, url: imageResultUrl });

  } catch (err) {
    console.error('Image generation error:', err.message);
    return res.status(500).json({ error: 'Erreur: ' + err.message });
  }
};

// ── Polling helper pour attendre le résultat Fal.ai
async function pollFalJob(falKey, jobId, modelId, maxAttempts = 30) {
  if (!jobId) return null;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000)); // attendre 2 secondes

    try {
      const statusRes = await fetch(
        `https://queue.fal.run/${modelId}/requests/${jobId}/status`,
        { headers: { 'Authorization': 'Key ' + falKey } }
      );

      if (!statusRes.ok) continue;
      const status = await statusRes.json();

      if (status.status === 'COMPLETED') {
        const resultRes = await fetch(
          `https://queue.fal.run/${modelId}/requests/${jobId}`,
          { headers: { 'Authorization': 'Key ' + falKey } }
        );
        if (resultRes.ok) return await resultRes.json();
        break;
      }

      if (status.status === 'FAILED') {
        console.error('Fal job failed:', jobId);
        break;
      }
    } catch(e) {
      console.log('Poll error:', e.message);
    }
  }
  return null;
}
