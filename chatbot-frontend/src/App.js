import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


function App() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('https://chatbot-j9nx.onrender.com/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      });
      const data = await res.json();
      setResponse(data.response || 'No response');
    } catch (error) {
      setResponse('Error talking to server.');
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
          {/* <p style={{ fontSize: '1.2rem', marginTop: '0.5rem' }}></p> */}
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
          <div style={{ marginTop: '1rem', lineHeight: 1.6 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {response}
            </ReactMarkdown>
          </div>
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

       
      </div>
    </div>
  );
}

export default App;
