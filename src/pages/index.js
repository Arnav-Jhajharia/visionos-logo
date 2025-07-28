import { useState, useEffect } from 'react';

export default function Home() {
  const [simplePrompt, setSimplePrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('simple');
  const [currentPage, setCurrentPage] = useState('generator'); // 'generator' or 'preview'
  const [showApiSettings, setShowApiSettings] = useState(false);

  // Advanced settings state
  const [layerCount, setLayerCount] = useState(1);
  const [backgroundType, setBackgroundType] = useState('prompt');
  const [backgroundPrompt, setBackgroundPrompt] = useState('');
  const [backgroundCSS, setBackgroundCSS] = useState('linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
  const [layer1Prompt, setLayer1Prompt] = useState('');
  const [layer2Prompt, setLayer2Prompt] = useState('');

  // API Keys state
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [clipdropApiKey, setClipdropApiKey] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Preview state
  const [generatedImages, setGeneratedImages] = useState(null);
  const [previewMode, setPreviewMode] = useState('all'); // 'all', 'layer1', 'layer2'
  const [layer1Scale, setLayer1Scale] = useState(100);
  const [layer1X, setLayer1X] = useState(0);
  const [layer1Y, setLayer1Y] = useState(0);
  const [layer2Scale, setLayer2Scale] = useState(100);
  const [layer2X, setLayer2X] = useState(0);
  const [layer2Y, setLayer2Y] = useState(0);
  const [downloadingFinal, setDownloadingFinal] = useState(false);

  // Load API keys from localStorage on component mount
  useEffect(() => {
    const savedOpenaiKey = localStorage.getItem('openai_api_key');
    const savedClipdropKey = localStorage.getItem('clipdrop_api_key');
    
    if (savedOpenaiKey) setOpenaiApiKey(savedOpenaiKey);
    if (savedClipdropKey) setClipdropApiKey(savedClipdropKey);
    
    // Show modal if either key is missing
    if (!savedOpenaiKey || !savedClipdropKey) {
      setShowApiKeyModal(true);
    }
  }, []);

  const saveApiKeys = () => {
    if (!openaiApiKey.trim() || !clipdropApiKey.trim()) {
      alert('Both API keys are required');
      return;
    }
    
    localStorage.setItem('openai_api_key', openaiApiKey.trim());
    localStorage.setItem('clipdrop_api_key', clipdropApiKey.trim());
    setShowApiKeyModal(false);
  };

  const clearApiKeys = () => {
    localStorage.removeItem('openai_api_key');
    localStorage.removeItem('clipdrop_api_key');
    setOpenaiApiKey('');
    setClipdropApiKey('');
    setShowApiKeyModal(true);
  };

  async function handleSimpleSubmit(e) {
    e.preventDefault();
    
    if (!openaiApiKey || !clipdropApiKey) {
      setShowApiKeyModal(true);
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-openai-key': openaiApiKey,
          'x-clipdrop-key': clipdropApiKey
        },
        body: JSON.stringify({ prompt: simplePrompt, preview: true }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      setGeneratedImages(data);
      setCurrentPage('preview');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdvancedSubmit(e) {
    e.preventDefault();
    
    if (!openaiApiKey || !clipdropApiKey) {
      setShowApiKeyModal(true);
      return;
    }
    
    setLoading(true);
    try {
      const advancedData = {
        mode: 'advanced',
        layerCount,
        background: {
          type: backgroundType,
          value: backgroundType === 'prompt' ? backgroundPrompt : backgroundCSS
        },
        layers: [
          layer1Prompt,
          ...(layerCount === 2 ? [layer2Prompt] : [])
        ].filter(Boolean),
        preview: true
      };

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-openai-key': openaiApiKey,
          'x-clipdrop-key': clipdropApiKey
        },
        body: JSON.stringify(advancedData),
      });
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      setGeneratedImages(data);
      setCurrentPage('preview');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFinalDownload() {
    setDownloadingFinal(true);
    try {
      const adjustments = {
        layer1: { scale: layer1Scale, x: layer1X, y: layer1Y },
        layer2: layerCount === 2 ? { scale: layer2Scale, x: layer2X, y: layer2Y } : null
      };

      const res = await fetch('/api/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: generatedImages,
          adjustments
        }),
      });
      if (!res.ok) throw new Error('Final generation failed');
      const blob = await res.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'visionOS-AppIcon-Assets.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setDownloadingFinal(false);
    }
  }

  function resetToGenerator() {
    setCurrentPage('generator');
    setGeneratedImages(null);
    setLayer1Scale(100);
    setLayer1X(0);
    setLayer1Y(0);
    setLayer2Scale(100);
    setLayer2X(0);
    setLayer2Y(0);
  }

  // API Key Modal Component
  const ApiKeyModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-800 rounded-lg p-6 w-full max-w-md border border-zinc-700">
        <h2 className="text-xl font-medium text-white mb-4">API Keys Required</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-300 mb-2">OpenAI API Key</label>
            <input
              type="password"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-colors text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-300 mb-2">Clipdrop API Key</label>
            <input
              type="password"
              value={clipdropApiKey}
              onChange={(e) => setClipdropApiKey(e.target.value)}
              placeholder="Your Clipdrop API key"
              className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-colors text-sm"
            />
          </div>
          <div className="text-xs text-zinc-400">
            <p>• Get OpenAI key from <a href="https://platform.openai.com/api-keys" target="_blank" className="text-blue-400 hover:underline">platform.openai.com</a></p>
            <p>• Get Clipdrop key from <a href="https://clipdrop.co/apis" target="_blank" className="text-blue-400 hover:underline">clipdrop.co/apis</a></p>
          </div>
          <button
            onClick={saveApiKeys}
            className="w-full bg-white text-zinc-900 font-medium py-2 px-4 rounded-md hover:bg-zinc-100 transition-colors"
          >
            Save Keys
          </button>
        </div>
      </div>
    </div>
  );

  if (currentPage === 'preview' && generatedImages) {
    return (
      <div className="min-h-screen bg-zinc-900 p-6">
        {showApiKeyModal && <ApiKeyModal />}
        
        {/* Settings Button */}
        <div className="absolute top-6 right-6">
          <button
            onClick={() => setShowApiSettings(!showApiSettings)}
            className="bg-zinc-800 text-zinc-300 p-2 rounded-lg hover:bg-zinc-700 transition-colors border border-zinc-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          
          {showApiSettings && (
            <div className="absolute top-12 right-0 bg-zinc-800 rounded-lg p-4 border border-zinc-700 min-w-48">
              <h3 className="text-sm font-medium text-white mb-3">API Settings</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setShowApiKeyModal(true)}
                  className="w-full text-left text-sm text-zinc-300 hover:text-white px-2 py-1 rounded hover:bg-zinc-700"
                >
                  Edit API Keys
                </button>
                <button
                  onClick={clearApiKeys}
                  className="w-full text-left text-sm text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-zinc-700"
                >
                  Clear Keys
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-light text-white mb-3">Preview & Adjust</h1>
            <p className="text-zinc-400 text-sm">Fine-tune your logo layers before downloading</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Preview Canvas */}
            <div className="bg-zinc-800 rounded-lg p-6 border border-zinc-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-white">Preview</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPreviewMode('all')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      previewMode === 'all' 
                        ? 'bg-zinc-600 text-white' 
                        : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setPreviewMode('layer1')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      previewMode === 'layer1' 
                        ? 'bg-zinc-600 text-white' 
                        : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                    }`}
                  >
                    Layer 1
                  </button>
                  {layerCount === 2 && (
                    <button
                      onClick={() => setPreviewMode('layer2')}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        previewMode === 'layer2' 
                          ? 'bg-zinc-600 text-white' 
                          : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                      }`}
                    >
                      Layer 2
                    </button>
                  )}
                </div>
              </div>
              
              <div className="relative w-full aspect-square bg-zinc-900 rounded-lg overflow-hidden">
                {/* Background */}
                <img 
                  src={generatedImages.background} 
                  alt="Background" 
                  className="absolute inset-0 w-full h-full object-cover"
                />
                
                {/* Layer 1 */}
                {(previewMode === 'all' || previewMode === 'layer1') && (
                  <img 
                    src={generatedImages.layer1} 
                    alt="Layer 1" 
                    className="absolute inset-0 w-full h-full object-contain"
                    style={{
                      transform: `translate(${layer1X}px, ${layer1Y}px) scale(${layer1Scale / 100})`,
                      transformOrigin: 'center'
                    }}
                  />
                )}
                
                {/* Layer 2 */}
                {layerCount === 2 && (previewMode === 'all' || previewMode === 'layer2') && generatedImages.layer2 && (
                  <img 
                    src={generatedImages.layer2} 
                    alt="Layer 2" 
                    className="absolute inset-0 w-full h-full object-contain"
                    style={{
                      transform: `translate(${layer2X}px, ${layer2Y}px) scale(${layer2Scale / 100})`,
                      transformOrigin: 'center'
                    }}
                  />
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="bg-zinc-800 rounded-lg p-6 border border-zinc-700">
              <h3 className="text-lg font-medium text-white mb-6">Adjust Layers</h3>
              
              <div className="space-y-8">
                {/* Layer 1 Controls */}
                <div>
                  <h4 className="text-sm font-medium text-zinc-300 mb-4">Layer 1 (Main Icon)</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-2">Scale: {layer1Scale}%</label>
                      <input
                        type="range"
                        min="20"
                        max="200"
                        value={layer1Scale}
                        onChange={(e) => setLayer1Scale(Number(e.target.value))}
                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-2">X Position: {layer1X}px</label>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={layer1X}
                          onChange={(e) => setLayer1X(Number(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-2">Y Position: {layer1Y}px</label>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={layer1Y}
                          onChange={(e) => setLayer1Y(Number(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Layer 2 Controls */}
                {layerCount === 2 && generatedImages.layer2 && (
                  <div>
                    <h4 className="text-sm font-medium text-zinc-300 mb-4">Layer 2 (Secondary Element)</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-2">Scale: {layer2Scale}%</label>
                        <input
                          type="range"
                          min="20"
                          max="200"
                          value={layer2Scale}
                          onChange={(e) => setLayer2Scale(Number(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-zinc-400 mb-2">X Position: {layer2X}px</label>
                          <input
                            type="range"
                            min="-100"
                            max="100"
                            value={layer2X}
                            onChange={(e) => setLayer2X(Number(e.target.value))}
                            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-400 mb-2">Y Position: {layer2Y}px</label>
                          <input
                            type="range"
                            min="-100"
                            max="100"
                            value={layer2Y}
                            onChange={(e) => setLayer2Y(Number(e.target.value))}
                            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3 pt-4 border-t border-zinc-700">
                  <button
                    onClick={handleFinalDownload}
                    disabled={downloadingFinal}
                    className="w-full bg-white text-zinc-900 font-medium py-3 px-4 rounded-md hover:bg-zinc-100 disabled:bg-zinc-600 disabled:text-zinc-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {downloadingFinal ? 'Generating Final...' : 'Download Logo Assets'}
                  </button>
                  <button
                    onClick={resetToGenerator}
                    className="w-full bg-zinc-700 text-zinc-300 font-medium py-3 px-4 rounded-md hover:bg-zinc-600 transition-colors"
                  >
                    Back to Generator
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 p-6">
      {showApiKeyModal && <ApiKeyModal />}
      
      {/* Settings Button */}
      <div className="absolute top-6 right-6">
        <button
          onClick={() => setShowApiSettings(!showApiSettings)}
          className="bg-zinc-800 text-zinc-300 p-2 rounded-lg hover:bg-zinc-700 transition-colors border border-zinc-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        
        {showApiSettings && (
          <div className="absolute top-12 right-0 bg-zinc-800 rounded-lg p-4 border border-zinc-700 min-w-48">
            <h3 className="text-sm font-medium text-white mb-3">API Settings</h3>
            <div className="space-y-2">
              <button
                onClick={() => setShowApiKeyModal(true)}
                className="w-full text-left text-sm text-zinc-300 hover:text-white px-2 py-1 rounded hover:bg-zinc-700"
              >
                Edit API Keys
              </button>
              <button
                onClick={clearApiKeys}
                className="w-full text-left text-sm text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-zinc-700"
              >
                Clear Keys
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-light text-white mb-3">VisionOS Logo Generator</h1>
          <p className="text-zinc-400 text-base">Create professional logo assets with AI precision</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-zinc-800 rounded-lg p-1 border border-zinc-700">
            <button
              onClick={() => setActiveTab('simple')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'simple'
                  ? 'bg-white text-zinc-900'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Simple Mode
            </button>
            <button
              onClick={() => setActiveTab('advanced')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'advanced'
                  ? 'bg-white text-zinc-900'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Advanced Settings
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Simple Mode */}
          <div className={`${activeTab === 'simple' ? 'block' : 'hidden lg:block'} ${activeTab !== 'simple' ? 'lg:opacity-50' : ''}`}>
            <div className="bg-zinc-800 rounded-lg p-8 border border-zinc-700">
              <h2 className="text-xl font-medium text-white mb-6">Simple Generation</h2>
              <div className="space-y-6">
                <div>
                  <label htmlFor="simple-prompt" className="block text-sm text-zinc-300 mb-3">
                    Describe your logo
                  </label>
                  <input
                    id="simple-prompt"
                    type="text"
                    value={simplePrompt}
                    onChange={(e) => setSimplePrompt(e.target.value)}
                    placeholder="Modern tech company with geometric shapes"
                    className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-colors"
                    required
                  />
                </div>

                <button
                  onClick={handleSimpleSubmit}
                  disabled={loading || !simplePrompt.trim()}
                  className="w-full bg-white text-zinc-900 font-medium py-3 px-4 rounded-md hover:bg-zinc-100 disabled:bg-zinc-600 disabled:text-zinc-400 disabled:cursor-not-allowed transition-colors"
                >
                  {loading && activeTab === 'simple' ? 'Generating...' : 'Generate & Preview'}
                </button>
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className={`${activeTab === 'advanced' ? 'block' : 'hidden lg:block'} ${activeTab !== 'advanced' ? 'lg:opacity-50' : ''}`}>
            <div className="bg-zinc-800 rounded-lg p-8 border border-zinc-700">
              <h2 className="text-xl font-medium text-white mb-6">Advanced Settings</h2>
              <div className="space-y-6">
                {/* Layer Count */}
                <div>
                  <label className="block text-sm text-zinc-300 mb-3">Additional layers (on top of background)</label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setLayerCount(1)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        layerCount === 1
                          ? 'bg-zinc-600 text-white'
                          : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                      }`}
                    >
                      1 Layer
                    </button>
                    <button
                      onClick={() => setLayerCount(2)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        layerCount === 2
                          ? 'bg-zinc-600 text-white'
                          : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                      }`}
                    >
                      2 Layers
                    </button>
                  </div>
                </div>

                {/* Background Settings */}
                <div>
                  <label className="block text-sm text-zinc-300 mb-3">Background</label>
                  <div className="flex space-x-2 mb-3">
                    <button
                      onClick={() => setBackgroundType('prompt')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        backgroundType === 'prompt'
                          ? 'bg-zinc-600 text-white'
                          : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                      }`}
                    >
                      AI Prompt
                    </button>
                    <button
                      onClick={() => setBackgroundType('css')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        backgroundType === 'css'
                          ? 'bg-zinc-600 text-white'
                          : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                      }`}
                    >
                      CSS Style
                    </button>
                  </div>
                  
                  {backgroundType === 'prompt' ? (
                    <input
                      type="text"
                      value={backgroundPrompt}
                      onChange={(e) => setBackgroundPrompt(e.target.value)}
                      placeholder="Gradient background with tech theme"
                      className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-colors"
                    />
                  ) : (
                    <input
                      type="text"
                      value={backgroundCSS}
                      onChange={(e) => setBackgroundCSS(e.target.value)}
                      placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                      className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-colors font-mono text-sm"
                    />
                  )}
                </div>

                {/* Layer Prompts */}
                <div>
                  <label className="block text-sm text-zinc-300 mb-3">Layer 1 (Main Icon)</label>
                  <input
                    type="text"
                    value={layer1Prompt}
                    onChange={(e) => setLayer1Prompt(e.target.value)}
                    placeholder="Main logo symbol or icon"
                    className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-colors"
                  />
                </div>

                {layerCount === 2 && (
                  <div>
                    <label className="block text-sm text-zinc-300 mb-3">Layer 2 (Secondary Element)</label>
                    <input
                      type="text"
                      value={layer2Prompt}
                      onChange={(e) => setLayer2Prompt(e.target.value)}
                      placeholder="Additional detail or accent"
                      className="w-full bg-zinc-900 border border-zinc-600 rounded-md px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-colors"
                    />
                  </div>
                )}

                <button
                  onClick={handleAdvancedSubmit}
                  disabled={loading || !layer1Prompt.trim() || (layerCount === 2 && !layer2Prompt.trim())}
                  className="w-full bg-white text-zinc-900 font-medium py-3 px-4 rounded-md hover:bg-zinc-100 disabled:bg-zinc-600 disabled:text-zinc-400 disabled:cursor-not-allowed transition-colors"
                >
                  {loading && activeTab === 'advanced' ? 'Generating...' : 'Generate & Preview'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-zinc-500 text-sm">Multiple formats • Ready for deployment • App Store compatible</p>
        </div>
      </div>
    </div>
  );
}