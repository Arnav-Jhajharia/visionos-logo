import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const { path: imagePath } = req.query;
  
  try {
    const fullPath = path.join(process.cwd(), 'temp', ...imagePath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const buffer = fs.readFileSync(fullPath);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(buffer);
  } catch (err) {
    console.error('Temp file serve error:', err);
    res.status(500).json({ error: 'Failed to serve image' });
  }
}