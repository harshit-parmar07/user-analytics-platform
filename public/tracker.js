(() => {
  const getSessionId = () => {
    let id = localStorage.getItem("tracking_session_id");
    if (!id) {
      if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
      ) {
        id = crypto.randomUUID();
      } else {
        id = Date.now().toString(36) + Math.random().toString(36).substring(2);
      }
      localStorage.setItem("tracking_session_id", id);
    }
    return id;
  };

  const script = document.currentScript;
  const apiUrl =
    (script && script.getAttribute("data-api-url")) || "/api/events";
  const sessionId = getSessionId();

  const sendEvent = (eventType, additionalData = {}) => {
    const payload = {
      sessionId,
      eventType,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      ...additionalData,
    };

    fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  };

  sendEvent("page_view");

  window.addEventListener("click", (event) => {
    const docEl = document.documentElement;
    const body = document.body;

    const scrollLeft = window.scrollX || docEl.scrollLeft || 0;
    const scrollTop = window.scrollY || docEl.scrollTop || 0;

    const pageX =
      event.pageX !== undefined ? event.pageX : event.clientX + scrollLeft;
    const pageY =
      event.pageY !== undefined ? event.pageY : event.clientY + scrollTop;

    const viewportWidth = window.innerWidth || docEl.clientWidth || 1;
    const viewportHeight = window.innerHeight || docEl.clientHeight || 1;

    const docWidth = Math.max(
      body ? body.scrollWidth : 0,
      docEl ? docEl.scrollWidth : 0,
      viewportWidth,
      1,
    );
    const docHeight = Math.max(
      body ? body.scrollHeight : 0,
      docEl ? docEl.scrollHeight : 0,
      viewportHeight,
      1,
    );

    const xPct = Number(
      Math.min(100, Math.max(0, (pageX / docWidth) * 100)).toFixed(2),
    );
    const yPct = Number(
      Math.min(100, Math.max(0, (pageY / docHeight) * 100)).toFixed(2),
    );

    sendEvent("click", {
      x: Math.round(pageX),
      y: Math.round(pageY),
      xPct,
      yPct,
      viewportWidth: Math.round(viewportWidth),
      viewportHeight: Math.round(viewportHeight),
    });
  });
})();
