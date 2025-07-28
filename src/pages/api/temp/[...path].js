import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const { path: imagePath } = req.query;
  
  try {
    // Use /tmp directory for Vercel
    const fullPath = path.join('/tmp', ...imagePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`File not found: ${fullPath}`);
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const buffer = fs.readFileSync(fullPath);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(buffer);
  } catch (err) {
    console.error('Temp file serve error:', err);
    res.status(500).json({ error: 'Failed to serve image' });
  }
}