export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  try {
    const { imageData, prompt } = req.body;
    if (!imageData || !prompt) return res.status(400).json({ error: 'Missing imageData or prompt' });

    const models = ['gemini-2.5-flash-image', 'gemini-2.0-flash-exp-image-generation'];
    let data = null, lastError = null;

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [
                { inline_data: { mime_type: 'image/jpeg', data: imageData } },
                { text: prompt }
              ]}],
              generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
            }),
          }
        );
        if (response.ok) { data = await response.json(); break; }
        else {
          const errBody = await response.text();
          lastError = `${model}: ${response.status} - ${errBody.substring(0, 200)}`;
          console.log('Model failed:', lastError);
        }
      } catch (e) { lastError = `${model}: ${e.message}`; console.log('Model error:', lastError); }
    }

    if (!data) return res.status(502).json({ error: `All models failed. Last: ${lastError}` });

    let imgB64 = null, mimeType = 'image/png';
    if (data.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          imgB64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType || 'image/png';
          break;
        }
      }
    }

    if (!imgB64) return res.status(502).json({ error: 'No image in response' });
    return res.status(200).json({ image: imgB64, mimeType });

  } catch (e) {
    console.error('Generate error:', e);
    return res.status(500).json({ error: e.message });
  }
}
