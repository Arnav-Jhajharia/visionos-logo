import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const blob = await res.blob();
      
      // Create download link without file-saver
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'LogoAssets.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-2xl font-light text-white mb-3">VisionOS Logo Generator</h1>
          <p className="text-zinc-400 text-sm">Create professional logo assets</p>
        </div>

        {/* Form */}
        <div className="bg-zinc-800 rounded-lg p-8 border border-zinc-700">
          <div className="space-y-6">
            {/* Input */}
            <div>
              <label htmlFor="prompt" className="block text-sm text-zinc-300 mb-3">
                Describe your logo
              </label>
              <input
                id="prompt"
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Modern tech company with geometric shapes"
                className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-colors"
                required
              />
            </div>

            {/* Button */}
            <button
              onClick={handleSubmit}
              disabled={loading || !prompt.trim()}
              className="w-full bg-white text-zinc-900 font-medium py-3 px-4 rounded-md hover:bg-zinc-100 disabled:bg-zinc-600 disabled:text-zinc-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Generating...' : 'Generate Logo Assets'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-zinc-500 text-xs">Multiple formats • Ready for deployment</p>
        </div>
      </div>
    </div>
  );
}