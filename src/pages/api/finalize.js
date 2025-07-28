import JSZip from 'jszip';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

// Helper function to load image from file path or base64
function loadImageFromPath(imagePath) {
  if (imagePath.startsWith('/api/temp/')) {
    const pathParts = imagePath.split('/');
    const sessionId = pathParts[3];
    const filename = pathParts[4];
    const fullPath = path.join('/tmp', sessionId, filename);
    
    try {
      return fs.readFileSync(fullPath);
    } catch (err) {
      console.error('Failed to read temp file:', err);
      throw new Error('Temp file not found - please regenerate');
    }
  } else if (imagePath.startsWith('data:image/')) {
    // Handle base64 data URLs (fallback)
    return Buffer.from(imagePath.split(',')[1], 'base64');
  } else {
    throw new Error('Invalid image path format');
  }
}

// Helper function to apply transformations to a layer
async function transformLayer(imagePath, adjustments) {
  try {
    console.log('Loading image buffer...');
    const buffer = loadImageFromPath(imagePath);
    
    // Skip transformation if no adjustments needed
    if (!adjustments || (adjustments.scale === 100 && adjustments.x === 0 && adjustments.y === 0)) {
      return buffer;
    }
    
    console.log('Applying transformations...');
    const canvas = createCanvas(1024, 1024);
    const ctx = canvas.getContext('2d');
    
    // Load the image
    const img = await loadImage(buffer);
    
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, 1024, 1024);
    
    // Apply transformations
    const { scale = 100, x = 0, y = 0 } = adjustments;
    const scaleFactor = scale / 100;
    const scaledWidth = 1024 * scaleFactor;
    const scaledHeight = 1024 * scaleFactor;
    
    // Calculate position (center + offset)
    const drawX = (1024 - scaledWidth) / 2 + x;
    const drawY = (1024 - scaledHeight) / 2 + y;
    
    ctx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);
    
    return canvas.toBuffer('image/png');
  } catch (err) {
    console.error('Transform layer error:', err);
    // Fallback: return original buffer
    return loadImageFromPath(imagePath);
  }
}

// Helper function to resize image
async function resizeImage(buffer, targetSize) {
  try {
    const canvas = createCanvas(targetSize, targetSize);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    const img = await loadImage(buffer);
    ctx.drawImage(img, 0, 0, targetSize, targetSize);
    
    return canvas.toBuffer('image/png');
  } catch (err) {
    console.error(`Resize error for size ${targetSize}:`, err);
    return buffer;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Only POST allowed');
  
  const { images, adjustments } = req.body;
  
  if (!images || !adjustments) {
    return res.status(400).json({ error: 'Images and adjustments required' });
  }

  try {
    console.log('Starting finalization process...');
    const zip = new JSZip();
    
    // Create Assets.xcassets structure
    const assetsFolder = zip.folder('Assets.xcassets');
    const appIconFolder = assetsFolder.folder('AppIcon.appiconset');
    
    // Transform each layer (backgrounds don't get adjustments)
    console.log('Processing background...');
    const backgroundBuffer = await transformLayer(images.background, null);
    
    console.log('Processing layer1...');
    const layer1Buffer = await transformLayer(images.layer1, adjustments.layer1);
    
    let layer2Buffer = null;
    if (images.layer2) {
      console.log('Processing layer2...');
      layer2Buffer = await transformLayer(images.layer2, adjustments.layer2);
    }

    // visionOS icon sizes
    const sizes = [1024, 512, 256, 128, 64, 32];
    
    console.log('Generating all sizes...');
    for (const size of sizes) {
      console.log(`Generating size ${size}...`);
      
      // Resize and save background
      const resizedBg = await resizeImage(backgroundBuffer, size);
      appIconFolder.file(`AppIcon-${size}-Background.png`, resizedBg);
      
      // Resize and save layer1
      const resizedLayer1 = await resizeImage(layer1Buffer, size);
      appIconFolder.file(`AppIcon-${size}-Layer1.png`, resizedLayer1);
      
      // Resize and save layer2 if it exists
      if (layer2Buffer) {
        const resizedLayer2 = await resizeImage(layer2Buffer, size);
        appIconFolder.file(`AppIcon-${size}-Layer2.png`, resizedLayer2);
      }
    }

    console.log('Creating Contents.json...');
    // visionOS Contents.json structure
    const contentsJson = {
      images: sizes.flatMap(size => {
        const layers = [
          {
            filename: `AppIcon-${size}-Background.png`,
            idiom: 'universal',
            platform: 'ios',
            scale: '1x',
            size: `${size}x${size}`
          },
          {
            filename: `AppIcon-${size}-Layer1.png`,
            idiom: 'universal',
            platform: 'ios', 
            scale: '1x',
            size: `${size}x${size}`
          }
        ];
        
        if (layer2Buffer) {
          layers.push({
            filename: `AppIcon-${size}-Layer2.png`,
            idiom: 'universal',
            platform: 'ios',
            scale: '1x', 
            size: `${size}x${size}`
          });
        }
        
        return layers;
      }),
      info: {
        author: 'visionos-logo-generator',
        version: 1
      }
    };

    appIconFolder.file('Contents.json', JSON.stringify(contentsJson, null, 2));

    // Add README
    const readmeContent = `# visionOS App Icon Assets

## Layer Adjustments Applied
### Layer 1 (Main Icon)
- Scale: ${adjustments.layer1?.scale || 100}%
- X Position: ${adjustments.layer1?.x || 0}px
- Y Position: ${adjustments.layer1?.y || 0}px

${adjustments.layer2 ? `### Layer 2 (Secondary Element)
- Scale: ${adjustments.layer2.scale}%
- X Position: ${adjustments.layer2.x}px
- Y Position: ${adjustments.layer2.y}px` : ''}

## Usage
Drag the Assets.xcassets folder into your Xcode project.

Generated: ${new Date().toISOString()}
`;

    zip.file('README.md', readmeContent);

    console.log('Generating ZIP...');
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Cleanup temp files (if using /tmp)
    if (images.background.startsWith('/api/temp/')) {
      try {
        const sessionId = images.background.split('/')[3];
        const tempDir = path.join('/tmp', sessionId);
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true });
          console.log('Cleaned up temp files');
        }
      } catch (cleanupErr) {
        console.error('Cleanup error:', cleanupErr);
      }
    }

    console.log('Finalization complete!');
    res.setHeader('Content-Type', 'application/zip')
       .setHeader('Content-Disposition', 'attachment; filename="visionOS-AppIcon-Assets.zip"')
       .send(zipBuffer);

  } catch (err) {
    console.error('Finalize error:', err);
    res.status(500).json({ 
      error: 'Failed to create visionOS assets', 
      details: err.message
    });
  }
}