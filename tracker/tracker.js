(() => {
  const getSessionId = () => {
    let id = localStorage.getItem('tracking_session_id');
    if (!id) {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        id = crypto.randomUUID();
      } else {
        id = Date.now().toString(36) + Math.random().toString(36).substring(2);
      }
      localStorage.setItem('tracking_session_id', id);
    }
    return id;
  };

  const script = document.currentScript;
  const apiUrl = (script && script.getAttribute('data-api-url')) || 'http://localhost:5000/api/events';
  const sessionId = getSessionId();

  const sendEvent = (eventType, additionalData = {}) => {
    const payload = {
      sessionId,
      eventType,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      ...additionalData
    };

    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }).catch(() => { });
  };

  sendEvent('page_view');

  window.addEventListener('click', (event) => {
    sendEvent('click', {
      x: event.clientX,
      y: event.clientY
    });
  });
})();