import OpenAI from 'openai';
import JSZip from 'jszip';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

async function removeBackground(buffer, clipdropApiKey) {
  const form = new FormData();
  form.append('image_file', buffer, { 
    filename: 'input.png',
    contentType: 'image/png'
  });

  const res = await fetch('https://clipdrop-api.co/remove-background/v1', {
    method: 'POST',
    headers: { 
      'x-api-key': clipdropApiKey 
    },
    body: form,
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('Clipdrop error:', res.status, errorText);
    throw new Error(`Background removal failed: ${res.status} - ${errorText}`);
  }
  
  return Buffer.from(await res.arrayBuffer());
}

async function generateLayer(text, removeBg = false, openaiApiKey, clipdropApiKey) {
  const openai = new OpenAI({ apiKey: openaiApiKey });
  
  const resp = await openai.images.generate({
    model: 'dall-e-3',
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
    console.log('Removing background with Clipdrop...');
    imgBuf = await removeBackground(imgBuf, clipdropApiKey);
  }

  return imgBuf;
}

async function generateCSSBackground(cssValue) {
  const canvas = createCanvas(1024, 1024);
  const ctx = canvas.getContext('2d');
  
  try {
    if (cssValue.includes('gradient')) {
      const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
      const colorMatches = cssValue.match(/#[0-9a-f]{6}|#[0-9a-f]{3}|rgb\([^)]+\)|rgba\([^)]+\)/gi);
      if (colorMatches && colorMatches.length >= 2) {
        gradient.addColorStop(0, colorMatches[0]);
        gradient.addColorStop(1, colorMatches[colorMatches.length - 1]);
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = '#1e40af';
      }
    } else {
      ctx.fillStyle = cssValue;
    }
    
    ctx.fillRect(0, 0, 1024, 1024);
    return canvas.toBuffer('image/png');
  } catch (err) {
    console.error('CSS background generation failed:', err);
    const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
    gradient.addColorStop(0, '#1e40af');
    gradient.addColorStop(1, '#000000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 1024);
    return canvas.toBuffer('image/png');
  }
}

function generateSimplePrompts(userPrompt) {
  const lowercasePrompt = userPrompt.toLowerCase();
  
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
  
  const body = req.body;
  const isPreview = body.preview === true;
  const isAdvanced = body.mode === 'advanced';
  
  // Get API keys from headers
  const openaiApiKey = req.headers['x-openai-key'];
  const clipdropApiKey = req.headers['x-clipdrop-key'];
  
  if (!openaiApiKey || !clipdropApiKey) {
    return res.status(400).json({ error: 'OpenAI and Clipdrop API keys required' });
  }
  
  if (!isAdvanced) {
    // Simple mode
    const { prompt } = body;
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });

    const prompts = generateSimplePrompts(prompt);
    
    try {
      console.log('Generating background...');
      const backgroundBuffer = await generateLayer(prompts.background, false, openaiApiKey, clipdropApiKey);
      console.log('Generating foreground...');
      const foregroundBuffer = await generateLayer(prompts.foreground, true, openaiApiKey, clipdropApiKey);

      if (isPreview) {
        // Save to temp files instead of returning base64
        const sessionId = uuidv4();
        const tempDir = path.join(process.cwd(), 'temp', sessionId);
        
        // Create temp directory
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Save files
        fs.writeFileSync(path.join(tempDir, 'background.png'), backgroundBuffer);
        fs.writeFileSync(path.join(tempDir, 'layer1.png'), foregroundBuffer);
        
        console.log(`Generated images saved to session: ${sessionId}`);
        
        return res.json({
          sessionId,
          background: `/api/temp/${sessionId}/background.png`,
          layer1: `/api/temp/${sessionId}/layer1.png`
        });
      } else {
        // Return ZIP (legacy mode)
        const zip = new JSZip();
        const folder = zip.folder('Logo.imageset');
        folder.file('Background.png', backgroundBuffer);
        folder.file('Logo.png', foregroundBuffer);
        folder.file('Contents.json', JSON.stringify({
          images: [
            { idiom: 'universal', filename: 'Background.png', scale: '1x' },
            { idiom: 'universal', filename: 'Logo.png', scale: '1x' }
          ],
          info: { version: 1, author: 'xcode' }
        }, null, 2));

        const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });
        res.setHeader('Content-Type', 'application/zip')
           .setHeader('Content-Disposition', 'attachment; filename="LogoAssets.zip"')
           .send(zipBuf);
      }
    } catch (err) {
      console.error('Generation error:', err);
      res.status(500).json({ error: 'Generation failed', details: err.message });
    }
  } else {
    // Advanced mode
    const { layerCount, background, layers } = body;
    
    if (!background || !layers || layers.length < 1) {
      return res.status(400).json({ error: 'Background and at least 1 layer required' });
    }

    try {
      // Generate background
      let backgroundBuffer;
      if (background.type === 'css') {
        console.log('Generating CSS background...');
        backgroundBuffer = await generateCSSBackground(background.value);
      } else {
        console.log('Generating AI background...');
        const backgroundPrompt = `1024x1024 ${background.value}, smooth background, no objects, no text, clean gradient or solid color`;
        backgroundBuffer = await generateLayer(backgroundPrompt, false, openaiApiKey, clipdropApiKey);
      }

      // Generate layers
      const layerBuffers = [];
      for (let i = 0; i < Math.min(layers.length, layerCount); i++) {
        const layerPrompt = `1024x1024 sharp vector icon of ${layers[i]}, bold white silhouette, high contrast, thick lines, simple geometric design, centered on transparent background, crisp edges, no gradients, flat design style, easily recognizable symbol`;
        console.log(`Generating Layer${i + 1} with prompt: ${layerPrompt}`);
        const layerBuffer = await generateLayer(layerPrompt, true, openaiApiKey, clipdropApiKey);
        layerBuffers.push(layerBuffer);
      }

      if (isPreview) {
        // Save to temp files
        const sessionId = uuidv4();
        const tempDir = path.join(process.cwd(), 'temp', sessionId);
        
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Save files
        fs.writeFileSync(path.join(tempDir, 'background.png'), backgroundBuffer);
        fs.writeFileSync(path.join(tempDir, 'layer1.png'), layerBuffers[0]);
        
        const result = {
          sessionId,
          background: `/api/temp/${sessionId}/background.png`,
          layer1: `/api/temp/${sessionId}/layer1.png`
        };
        
        if (layerBuffers[1]) {
          fs.writeFileSync(path.join(tempDir, 'layer2.png'), layerBuffers[1]);
          result.layer2 = `/api/temp/${sessionId}/layer2.png`;
        }
        
        console.log(`Advanced images saved to session: ${sessionId}`);
        
        return res.json(result);
      } else {
        // Return ZIP (legacy mode)
        const zip = new JSZip();
        const folder = zip.folder('Logo.imageset');
        const fileList = [];

        folder.file('Background.png', backgroundBuffer);
        fileList.push('Background.png');

        for (let i = 0; i < layerBuffers.length; i++) {
          const filename = `Layer${i + 1}.png`;
          folder.file(filename, layerBuffers[i]);
          fileList.push(filename);
        }

        folder.file('Contents.json', JSON.stringify({
          images: fileList.map((fn) => ({ idiom: 'universal', filename: fn, scale: '1x' })),
          info: { version: 1, author: 'xcode' }
        }, null, 2));

        const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });
        res.setHeader('Content-Type', 'application/zip')
           .setHeader('Content-Disposition', 'attachment; filename="LogoAssets.zip"')
           .send(zipBuf);
      }
    } catch (err) {
      console.error('Advanced generation error:', err);
      res.status(500).json({ error: 'Advanced generation failed', details: err.message });
    }
  }
}