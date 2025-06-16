import React, { useEffect, useState } from 'react';
import './App.css';

/**
 * Fetch the language list from the backend.
 * @returns {Promise<Array<{code: string, name: string}>>}
 *
 * Returns an array of supported language objects.
 */
async function fetchLanguages() {
  const resp = await fetch('/languages');
  if (!resp.ok) {
    throw new Error('Failed to fetch languages');
  }
  return await resp.json();
}

/**
 * Request translation via backend API.
 * @param {Object} params - text, source_lang, target_lang
 * @returns {Promise<Object>} - Translation response from API.
 */
async function translateText({ text, source_lang, target_lang }) {
  const resp = await fetch('/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source_lang, target_lang }),
  });
  if (!resp.ok) {
    let msg;
    try {
      msg = (await resp.json()).error || 'Network error';
    } catch {
      msg = 'Network error';
    }
    throw new Error(msg);
  }
  return await resp.json();
}

/**
 * Request language detection from backend.
 * @param {string} text
 * @returns {Promise<string>} detected language code (or "unknown").
 */
async function detectLanguage(text) {
  const resp = await fetch('/detect-language', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) {
    let errorMsg = "Detection failed";
    try {
      errorMsg = (await resp.json()).error;
    } catch {}
    throw new Error(errorMsg);
  }
  const data = await resp.json();
  if (data.language) return data.language;
  return "unknown";
}

/**
 * Main app for LingoFlow translation UI.
 */
function App() {
  // Application state
  const [languages, setLanguages] = useState([]);
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [langsLoading, setLangsLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [detectingLang, setDetectingLang] = useState(false);

  // Load supported languages from backend on mount
  useEffect(() => {
    let active = true;
    setLangsLoading(true);
    setErrorMsg('');
    fetchLanguages()
      .then(langs => {
        if (active) {
          setLanguages(langs);
          // Default target language to English if available, otherwise first
          if (!langs.find(l => l.code === targetLang)) {
            setTargetLang(langs[0]?.code || 'en');
          }
        }
      })
      .catch(err => {
        // Could not fetch language list
        setErrorMsg('Unable to load language list from backend.');
      })
      .finally(() => setLangsLoading(false));
    return () => { active = false; }
    // eslint-disable-next-line
  }, []);

  // Handle copying the translated text
  function handleCopyClick() {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 1600);
  }

  // Handler for the translate button/form
  async function handleTranslate(e) {
    e.preventDefault();
    setOutputText('');
    setDetectedLanguage(null);
    setErrorMsg('');
    if (!inputText.trim()) {
      setErrorMsg('Please enter text to translate.');
      return;
    }
    // Optionally auto-detect source language if requested
    setLoading(true);
    try {
      let langForDetection = sourceLang;
      let discoveredLang = null;
      if (sourceLang === 'auto') {
        setDetectingLang(true);
        // Request language detection before translating
        try {
          discoveredLang = await detectLanguage(inputText);
          langForDetection = discoveredLang;
        } catch (err) {
          setDetectingLang(false);
          setErrorMsg("Could not detect source language.");
          setLoading(false);
          return;
        }
        setDetectingLang(false);
      }
      // Make translation request
      const body = {
        text: inputText,
        source_lang: sourceLang === "auto" ? "auto" : sourceLang,
        target_lang: targetLang
      };
      const result = await translateText(body);
      if (result.error) {
        setOutputText('');
        setDetectedLanguage(result.detected_language || discoveredLang || null);
        setErrorMsg(result.error);
      } else {
        setOutputText(result.translated_text || '');
        // Display detected language if present (used for "auto"), or use the detected one
        setDetectedLanguage(result.detected_language || discoveredLang || (sourceLang === 'auto' ? null : null));
      }
    } catch (err) {
      setOutputText('');
      setErrorMsg('Translation failed. ' + (err && err.message ? err.message : "Please try again."));
    }
    setLoading(false);
  }

  return (
    <div className="app">
      {/* Minimalistic nav */}
      <nav className="navbar" aria-label="Main navigation">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="logo" aria-label="LingoFlow logo">
            <span className="logo-symbol" aria-hidden="true">🌐</span>
            <span style={{ fontWeight: 600 }}>LingoFlow</span>
          </span>
          <span style={{ color: 'var(--base-light)', fontWeight: 400, fontSize: '1.1rem', letterSpacing: '0.03em', marginLeft: 8 }}>translate smarter</span>
        </div>
      </nav>

      <main style={{ minHeight: '100vh', paddingTop: '96px', background: 'var(--base-dark)' }}>
        <div className="container">
          <form
            className="lingoflow-form"
            aria-label="Translation form"
            onSubmit={handleTranslate}
            style={{
              maxWidth: 520,
              margin: '0 auto',
              background: 'var(--secondary, #10192e)',
              borderRadius: 14,
              boxShadow: '0 1px 12px 0 rgba(0,0,0,0.05)',
              padding: '28px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
              marginTop: 20,
              marginBottom: 24
            }}
          >
            {/* Input */}
            <label htmlFor="source-text" style={{ fontWeight: 600, fontSize: '1.09rem', color: 'var(--base-light)', marginBottom: 6 }}>
              Enter text to translate
            </label>
            <textarea
              id="source-text"
              className="lingoflow-input"
              aria-label="Text to translate"
              value={inputText}
              autoFocus
              autoComplete="off"
              required
              spellCheck="true"
              rows={4}
              style={{
                resize: 'vertical',
                border: '1.5px solid var(--border-color)',
                borderRadius: 8,
                padding: '14px 12px',
                fontSize: '1.1rem',
                color: 'var(--text-color)',
                background: 'var(--base-dark, #181C2C)',
                fontFamily: 'inherit',
                marginBottom: 4,
              }}
              onChange={e => setInputText(e.target.value)}
              disabled={loading}
            />

            {/* Language pickers */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 110 }}>
                <label htmlFor="sourceLang" className="visually-hidden">Source language</label>
                <select
                  id="sourceLang"
                  title="Source language"
                  value={sourceLang}
                  aria-label="Source language"
                  onChange={e => setSourceLang(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    fontSize: '1rem',
                    color: 'var(--text-color)',
                    background: 'var(--base-dark)',
                  }}
                  disabled={langsLoading || loading}
                >
                  <option value="auto">Detect language</option>
                  {langsLoading
                    ? <option disabled>Loading...</option>
                    : languages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))
                  }
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 110 }}>
                <label htmlFor="targetLang" className="visually-hidden">Target language</label>
                <select
                  id="targetLang"
                  title="Target language"
                  value={targetLang}
                  aria-label="Target language"
                  onChange={e => setTargetLang(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    fontSize: '1rem',
                    color: 'var(--text-color)',
                    background: 'var(--base-dark)',
                  }}
                  disabled={langsLoading || loading}
                >
                  {langsLoading
                    ? <option disabled>Loading...</option>
                    : languages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))
                  }
                </select>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: 20,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginTop: 2,
              justifyContent: 'flex-end'
            }}>
              <button
                type="submit"
                className="btn btn-large"
                aria-label="Translate text"
                style={{
                  background: 'var(--base-light, #A8D5BA)',
                  color: '#1A1A1A',
                  borderRadius: 8,
                  fontWeight: 700,
                  minWidth: 120,
                  fontSize: '1.04rem',
                  padding: '10px 0',
                  transition: 'background 0.14s',
                  border: 'none',
                  outline: 0,
                }}
                disabled={loading}
              >
                {loading ? "Translating…" : "Translate"}
              </button>
            </div>

            {(errorMsg || langsLoading) &&
              <div aria-live="polite" style={{
                color: langsLoading ? 'var(--base-light)' : '#cf222e',
                marginTop: 4, textAlign: 'left', fontSize: '1.01rem'
              }}>
                {langsLoading ? 'Loading language list...' : errorMsg}
              </div>
            }
            {detectingLang &&
              <div aria-live="polite" style={{
                color: 'var(--base-light)', fontStyle: "italic", marginTop: 3, fontSize: "0.97rem"
              }}>
                Detecting source language...
              </div>
            }
          </form>

          {/* Output section */}
          <section
            style={{
              maxWidth: 520,
              margin: '0 auto',
              background: 'rgba(255,255,255,0.035)',
              borderRadius: 14,
              padding: '20px 18px 24px 18px',
              boxShadow: outputText ? '0 1px 12px 0 rgba(0,0,0,0.025)' : 'none',
              minHeight: 85,
              marginBottom: 40
            }}
            aria-label="Translation output"
          >
            <div style={{
              display: 'flex', alignItems: 'center', marginBottom: 10, gap: 10
            }}>
              <span style={{
                color: 'var(--base-light)', fontWeight: 600, fontSize: '1.11rem'
              }}>
                {outputText ? "Translated Text" : "Output will appear here"}
              </span>
              {detectedLanguage && detectedLanguage !== 'unknown' && (
                <span style={{
                  fontSize: '0.93rem', color: 'var(--text-secondary, #bbb)', marginLeft: 6, fontWeight: 400,
                  borderRadius: 5, background: 'rgba(0,255,255,0.05)', padding: '1px 8px'
                }}>
                  Detected: {languages.find(l => l.code === detectedLanguage)?.name || detectedLanguage}
                </span>
              )}
            </div>
            <div style={{
              minHeight: 38, fontSize: '1.06rem', lineHeight: 1.6, wordBreak: 'break-word',
              color: outputText ? 'var(--text-color)' : 'var(--text-secondary)'
            }}>
              {outputText || <span aria-disabled="true" style={{ color: 'var(--text-secondary)' }}>—</span>}
            </div>
            {outputText &&
              <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  aria-label="Copy text"
                  className="btn"
                  tabIndex={0}
                  style={{
                    background: copySuccess ? 'var(--base-light, #a8d5ba)' : 'var(--accent, #F4A261)',
                    color: '#000',
                    minWidth: 88,
                    fontWeight: 500,
                    borderRadius: 8,
                    fontSize: '1rem',
                  }}
                  onClick={handleCopyClick}
                  disabled={copySuccess}
                >
                  {copySuccess ? "Copied!" : "Copy"}
                </button>
              </div>
            }
          </section>
        </div>
        <footer
          className="container"
          style={{
            color: 'var(--text-secondary)',
            textAlign: 'center',
            fontSize: '0.97rem',
            opacity: 0.91,
            padding: '4px 0 24px 0'
          }}
        >
          <span>
            LingoFlow &copy; {new Date().getFullYear()} — Open AI translation demo.
          </span>
        </footer>
      </main>
    </div>
  );
}

export default App;