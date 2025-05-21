import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';

// Style objects
const buttonPrimary = {
  background: 'linear-gradient(90deg, #ff7a00, #ff3c00)',
  color: '#fff',
  border: 'none',
  padding: '0.9rem 1.6rem',
  fontSize: '1rem',
  borderRadius: '1rem',
  cursor: 'pointer',
  fontWeight: 600,
  boxShadow: '0 0 20px rgba(255, 122, 0, 0.5)',
  transition: 'all 0.3s ease',
  width: '100%'
};

const buttonSecondary = {
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.2)',
  padding: '0.7rem 1.2rem',
  borderRadius: '0.75rem',
  cursor: 'pointer',
  fontWeight: 500,
  backdropFilter: 'blur(10px)',
  width: '100%',
  transition: 'all 0.3s ease-in-out'
};

const buttonDanger = {
  ...buttonSecondary,
  background: 'rgba(255, 0, 0, 0.1)',
  borderColor: '#ff5c5c',
  color: '#ff5c5c'
};

// Markdown setup
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: false,
});

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function App() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [vttEnabled, setVttEnabled] = useState(true);
  const [language, setLanguage] = useState('en-US');
  const [tracking, setTracking] = useState(false);

  const startCoords = useRef(null);
  const destinationReached = useRef(false);
  const returnNotified = useRef(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').then(() =>
        console.log("✅ Service worker registered")
      );
    }
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log("✅ Service worker registered");
  
          // Subscribe to push notifications
          return registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array('BM4FjZk0AB2mO2x63aPEa2MNqkzhNY-E1HExxVUYfrCN9uuXTZ_UWXKkjBVjNjwV3Y-b6WkRqP2CWM6WqCa-vuU')
          });
        })
        .then(subscription => {
          // Send subscription to your server
          fetch('/subscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(subscription)
          });
        })
        .catch(err => console.error('Push subscription failed:', err));
    }
  }, []);

  useEffect(() => {
    if (tracking) {
      const interval = setInterval(() => {
        navigator.geolocation.getCurrentPosition(pos => {
          const { latitude, longitude } = pos.coords;

          if (!startCoords.current) {
            startCoords.current = { latitude, longitude };
            return;
          }

          const dist = (a, b) =>
            Math.sqrt(
              Math.pow(a.latitude - b.latitude, 2) +
              Math.pow(a.longitude - b.longitude, 2)
            );

          const distance = dist(startCoords.current, { latitude, longitude });

          if (!destinationReached.current && distance > 0.005) {
            destinationReached.current = true;
            new Notification("📍 You’ve reached your destination zone.");
          }

          if (destinationReached.current && !returnNotified.current && distance < 0.002) {
            returnNotified.current = true;
            new Notification("🏠 Welcome back to your starting point.");
            setTracking(false);
          }
        });
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [tracking]);

  const requestNotificationPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        setTracking(true);
        
        // Show initial notification
        const notification = new Notification("🛰️ Trip tracking started", {
          body: "Welcome to your parking area.",
          icon: "/icons/icon-192.png",
          requireInteraction: true
        });

        // Start tracking notifications via service worker
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'start-tracking' });
        }

        // Set up location tracking
        navigator.geolocation.getCurrentPosition(async position => {
          const { latitude, longitude } = position.coords;
          startCoords.current = { latitude, longitude };

          // Send initial location to server
          await fetch('https://chatbot-j9nx.onrender.com/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: "I want to start tracking my trip from this location",
              lat: latitude,
              lng: longitude,
              lang: language,
              intent: 'trip_start_simple'
            })
          });
        });
      } else {
        alert('Notification permission denied.');
      }
    } catch (err) {
      console.error('Error with notifications:', err);
      alert('Please add Spotsurfer AI to your homescreen to receive trip alerts.');
    }
  };

  // Handle stop tracking
  const stopTracking = () => {
    setTracking(false);
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'stop-tracking' });
    }
  };

  const speakResponse = (text) => {
    if (ttsEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = text;
      tempDiv.querySelectorAll('a').forEach(link => {
        const span = document.createElement('span');
        span.textContent = link.textContent;
        link.replaceWith(span);
      });

      const cleanText = tempDiv.textContent.replace(/\n/g, ' ').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = language;
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!vttEnabled || !SpeechRecognition) {
      alert("Speech recognition not supported.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.start();
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event);
    };
  };

  const handleSubmit = async () => {
    setLoading(true);
    setResponse("🤔 SpotSurfer is thinking...");
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
    } catch (geoError) {
      const allowFallback = window.confirm("Location not accessible. Continue anyway?");
      if (!allowFallback) {
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch('https://chatbot-j9nx.onrender.com/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, lat, lng, lang: language })
      });

      const data = await res.json();
      const reply = data.response || 'No response.';
      setResponse(reply);
      speakResponse(reply);
    } catch (err) {
      console.error("Server error:", err);
      setResponse('⚠️ Unable to contact the server.');
    }

    setLoading(false);
  };

  const cardStyle = {
    background: 'linear-gradient(135deg, rgba(40,40,40,0.8), rgba(60,60,60,0.6))',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '1.25rem',
    backdropFilter: 'blur(12px)',
    padding: '2rem',
    boxShadow: '0 12px 35px rgba(0,0,0,0.4)',
    maxWidth: '90vw',
    margin: '2rem auto'
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: 'linear-gradient(135deg, #0f0f0f, #121212)', color: '#fff', minHeight: '100vh', paddingBottom: '4rem' }}>
      <div style={{ textAlign: 'center', padding: '3rem 1rem 1rem' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 8vw, 3rem)', fontWeight: 800, background: 'linear-gradient(to right, #ff7a00, #ff3c00)', WebkitBackgroundClip: 'text', color: 'transparent' }}>Ask SpotSurfer AI</h1>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, fontSize: '1.25rem', fontWeight: 600 }}>Response:</h3>
        <div style={{ marginTop: '1rem', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: marked.parse(response) }} />
        {response && ttsEnabled && (
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button onClick={() => speakResponse(response)} style={buttonSecondary}>🔊 Read Aloud Again</button>
            <button onClick={stopSpeaking} style={buttonDanger}>✋ Stop Reading</button>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <label htmlFor="input" style={{ fontWeight: 600, fontSize: '1.05rem', display: 'block', marginBottom: '0.5rem' }}>Ask a question:</label>
        <textarea
          id="input"
          rows="4"
          placeholder="e.g. Where should I park for the GoPro Games?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{
            width: '100%',
            padding: '1rem',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '0.75rem',
            fontSize: '1rem',
            resize: 'vertical',
            marginBottom: '1.25rem'
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button onClick={handleSubmit} disabled={loading} style={{ ...buttonPrimary, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Loading...' : '🚀 Ask SpotSurfer'}
          </button>
          <button onClick={startListening} disabled={!vttEnabled} style={buttonSecondary}>
            🎤 Speak Your Question
          </button>
        </div>
      </div>

      <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <label><input type="checkbox" checked={ttsEnabled} onChange={(e) => setTtsEnabled(e.target.checked)} /> Enable TTS</label>
        <label><input type="checkbox" checked={vttEnabled} onChange={(e) => setVttEnabled(e.target.checked)} /> Enable VTT</label>
        <label>
          Language:
          <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ marginLeft: '0.5rem' }}>
            <option value="en-US">English</option>
            <option value="es-ES">Español</option>
          </select>
        </label>
        <button onClick={requestNotificationPermission} style={{ ...buttonPrimary, maxWidth: '300px', margin: '0 auto' }}>
          📍 Enable Trip Alerts
        </button>
        <button onClick={stopTracking} style={{ ...buttonDanger, maxWidth: '300px', margin: '0 auto' }}>
          🚫 Disable Trip Alerts
        </button>
      </div>

      <div style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #ff3c00, #ff7a00)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: 'white',
        fontSize: '1.5rem',
        boxShadow: '0 0 15px rgba(255, 122, 0, 0.6)',
        zIndex: 1000,
        cursor: 'pointer'
      }} onClick={startListening}>
        🎙️
      </div>
    </div>
  );
}

export default App;
