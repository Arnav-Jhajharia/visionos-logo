import OpenAI from 'openai';
import JSZip from 'jszip';
import fetch from 'node-fetch';
import FormData from 'form-data';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function removeBackground(buffer) {
  const form = new FormData();
  form.append('image_file', buffer, { filename: 'input.png' });
  form.append('size', 'auto');

  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.REMOVE_BG_API_KEY },
    body: form,
  });
  if (!res.ok) throw new Error('Background removal failed');
  return Buffer.from(await res.arrayBuffer());
}

async function generateLayer(text, removeBg = false) {
  const resp = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: text,
    n: 1,
    size: '1024x1024',
  });

  const data = resp.data[0];
  let imgBuf;
  if (data.b64_json) {
    imgBuf = Buffer.from(data.b64_json, 'base64');
  } else {
    const imgRes = await fetch(data.url);
    imgBuf = Buffer.from(await imgRes.arrayBuffer());
  }

  if (removeBg) {
    imgBuf = await removeBackground(imgBuf);
  }

  return imgBuf;
}

function generatePrompts(userPrompt) {
  // Extract key elements from user prompt
  const lowercasePrompt = userPrompt.toLowerCase();
  
  // Determine background style based on prompt context
  let backgroundStyle;
  if (lowercasePrompt.includes('tech') || lowercasePrompt.includes('modern') || lowercasePrompt.includes('digital')) {
    backgroundStyle = 'solid gradient background from #1e3a8a to #7c3aed, smooth, no objects, no text';
  } else if (lowercasePrompt.includes('nature') || lowercasePrompt.includes('organic') || lowercasePrompt.includes('eco')) {
    backgroundStyle = 'solid gradient background from #065f46 to #059669, smooth, no objects, no text';
  } else if (lowercasePrompt.includes('finance') || lowercasePrompt.includes('corporate') || lowercasePrompt.includes('business')) {
    backgroundStyle = 'solid gradient background from #1e293b to #374151, smooth, no objects, no text';
  } else if (lowercasePrompt.includes('creative') || lowercasePrompt.includes('art') || lowercasePrompt.includes('design')) {
    backgroundStyle = 'solid gradient background from #ea580c to #ec4899, smooth, no objects, no text';
  } else if (lowercasePrompt.includes('health') || lowercasePrompt.includes('medical') || lowercasePrompt.includes('wellness')) {
    backgroundStyle = 'solid gradient background from #0891b2 to #0d9488, smooth, no objects, no text';
  } else {
    backgroundStyle = 'solid gradient background from #1e40af to #000000, smooth, no objects, no text';
  }

  return {
    background: `1024x1024 ${backgroundStyle}`,
    foreground: `1024x1024 sharp vector icon of ${userPrompt}, bold white silhouette, high contrast, thick lines, simple geometric design, centered on transparent background, crisp edges, no gradients, flat design style, easily recognizable symbol`
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Only POST allowed');
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  const prompts = generatePrompts(prompt);
  
  const layers = {
    'Background.png': {
      prompt: prompts.background,
      removeBg: false,
    },
    'Logo.png': {
      prompt: prompts.foreground,
      removeBg: true,
    }
  };

  try {
    const zip = new JSZip();
    const folder = zip.folder('Logo.imageset');

    for (const [filename, { prompt: txt, removeBg }] of Object.entries(layers)) {
      console.log(`Generating ${filename} with prompt: ${txt}`);
      const buf = await generateLayer(txt, removeBg);
      folder.file(filename, buf);
    }

    folder.file(
      'Contents.json',
      JSON.stringify(
        {
          images: Object.keys(layers).map((fn) => ({ idiom: 'universal', filename: fn, scale: '1x' })),
          info: { version: 1, author: 'xcode' },
        },
        null,
        2
      )
    );

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });
    res
      .setHeader('Content-Type', 'application/zip')
      .setHeader('Content-Disposition', 'attachment; filename="LogoAssets.zip"')
      .send(zipBuf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Generation failed' });
  }
}