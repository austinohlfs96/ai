import React, { useState } from 'react';
import { marked } from 'marked';

// Optional: configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: false,
});

function App() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    let lat = null;
    let lng = null;

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      lat = position.coords.latitude;
      lng = position.coords.longitude;
      console.log('Location:', lat, lng);

    } catch (geoError) {
      console.warn("Geolocation failed:", geoError);

      const allowFallback = window.confirm(
        "We couldn’t access your location. To get the best recommendations, please enable location access in your device settings.\n\nYou can also continue without location and manually enter your location in the chat (e.g., 'Where should I park in Vail?').\n\nWould you like to continue without location?"
      );

      if (!allowFallback) {
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch('https://chatbot-j9nx.onrender.com/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          lat: lat,
          lng: lng,
        })
      });

      const data = await res.json();
      setResponse(data.response || 'No response');

    } catch (serverError) {
      console.error("Server error:", serverError);
      setResponse('⚠️ Unable to contact the server.');
    }

    setLoading(false);
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#f9f9f9', minHeight: '100vh', margin: 0 }}>
      {/* Hero Section */}
      <div style={{
        background: 'url("/vail-bg.jpg") center/cover no-repeat',
        height: '300px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        color: 'white'
      }}>
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          padding: '2rem',
          borderRadius: '1rem',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '2.5rem', margin: 0 }}>Ask SpotSurfer Ai!</h1>
        </div>
      </div>

      {/* Response Section */}
      <div style={{
        textAlign: 'left',
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        padding: '1rem 1.5rem',
        boxShadow: '0 0 8px rgba(0,0,0,0.08)'
      }}>
        <h3 style={{ marginTop: 0 }}>Response:</h3>
        <div
          style={{ marginTop: '1rem', lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: marked.parse(response) }}
        />
      </div>

      {/* Chat Interface */}
      <div style={{ maxWidth: '700px', margin: '2rem auto', padding: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          <label htmlFor="input" style={{ fontWeight: 600, textAlign: 'left' }}>Ask a question:</label>
          <textarea
            id="input"
            rows="4"
            placeholder="e.g. Where should I park for the GoPro Games?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{
              resize: 'vertical',
              padding: '1rem',
              border: '1px solid #ddd',
              borderRadius: '0.75rem',
              fontSize: '1rem'
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              backgroundColor: '#ff7a00',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'background-color 0.3s ease',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Loading...' : 'Ask SpotSurfer'}
          </button>
        </div>
        <p style={{ fontSize: '0.9em', color: '#666' }}>
          Having trouble? <a href="https://support.google.com/chrome/answer/142065?hl=en" target="_blank" rel="noopener noreferrer">Enable location services</a>.
        </p>
      </div>
    </div>
  );
}

export default App;
