(() => {
  const RAGE_TIME_WINDOW_MS = 1000;
  const RAGE_RADIUS_PX = 30;
  const RAGE_MIN_CLICKS = 3;
  const DEAD_CLICK_TIMEOUT_MS = 500;

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

  const getTargetSelector = (el) => {
    if (!el || !el.tagName) return 'unknown';
    const tag = el.tagName.toLowerCase();
    const id = el.id ? '#' + el.id : '';
    let className = '';
    if (typeof el.className === 'string' && el.className.trim()) {
      className = '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    }
    return (tag + id + className).slice(0, 80);
  };

  const isInteractiveElement = (el) => {
    if (!el || typeof el.closest !== 'function') return false;
    const interactiveSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), label, summary, [role="button"], [data-interactive="true"]';
    const matched = el.closest(interactiveSelector);
    if (!matched) return false;
    if (matched.getAttribute('data-simulate-unresponsive') === 'true') {
      return false;
    }
    return true;
  };

  const script = document.currentScript;
  const apiUrl = (script && script.getAttribute('data-api-url')) || '/api/events';
  const sessionId = getSessionId();

  // Sliding window state for Rage Click detection
  const recentClicks = [];
  let lastRageClusterTimestamp = 0;

  // Mutation tracking state for Dead Click detection
  let lastDomMutationAt = 0;
  if (typeof MutationObserver !== 'undefined' && document.documentElement) {
    const observer = new MutationObserver(() => {
      lastDomMutationAt = Date.now();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  }

  const sendEvent = (eventType, additionalData = {}) => {
    const payload = {
      sessionId,
      eventType,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      ...additionalData,
    };

    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  };

  const computeCoordinates = (event) => {
    const docEl = document.documentElement;
    const body = document.body;

    const scrollLeft = window.scrollX || docEl.scrollLeft || 0;
    const scrollTop = window.scrollY || docEl.scrollTop || 0;

    const pageX = event.pageX !== undefined ? event.pageX : event.clientX + scrollLeft;
    const pageY = event.pageY !== undefined ? event.pageY : event.clientY + scrollTop;

    const viewportWidth = window.innerWidth || docEl.clientWidth || 1;
    const viewportHeight = window.innerHeight || docEl.clientHeight || 1;

    const docWidth = Math.max(
      body ? body.scrollWidth : 0,
      docEl ? docEl.scrollWidth : 0,
      viewportWidth,
      1
    );
    const docHeight = Math.max(
      body ? body.scrollHeight : 0,
      docEl ? docEl.scrollHeight : 0,
      viewportHeight,
      1
    );

    const xPct = Number(Math.min(100, Math.max(0, (pageX / docWidth) * 100)).toFixed(2));
    const yPct = Number(Math.min(100, Math.max(0, (pageY / docHeight) * 100)).toFixed(2));

    return {
      x: Math.round(pageX),
      y: Math.round(pageY),
      xPct,
      yPct,
      viewportWidth: Math.round(viewportWidth),
      viewportHeight: Math.round(viewportHeight),
    };
  };

  sendEvent('page_view');

  window.addEventListener('click', (event) => {
    const now = Date.now();
    const coords = computeCoordinates(event);
    const targetSelector = getTargetSelector(event.target);

    // 1. Always record the standard click interaction
    sendEvent('click', {
      ...coords,
      targetSelector,
    });

    // 2. Sliding-Window Rage Click Heuristic
    while (recentClicks.length > 0 && now - recentClicks[0].time > RAGE_TIME_WINDOW_MS) {
      recentClicks.shift();
    }

    recentClicks.push({ x: coords.x, y: coords.y, time: now });

    const clusterClicks = recentClicks.filter((c) => {
      const dx = c.x - coords.x;
      const dy = c.y - coords.y;
      return Math.hypot(dx, dy) <= RAGE_RADIUS_PX;
    });

    if (
      clusterClicks.length >= RAGE_MIN_CLICKS &&
      now - lastRageClusterTimestamp > RAGE_TIME_WINDOW_MS
    ) {
      lastRageClusterTimestamp = now;
      sendEvent('rage_click', {
        ...coords,
        targetSelector,
        clickCount: clusterClicks.length,
      });
      return;
    }

    // 3. Dead Click Heuristic (Non-interactive element with no DOM/URL response)
    if (!isInteractiveElement(event.target)) {
      const urlBeforeClick = window.location.href;
      const clickTime = now;

      setTimeout(() => {
        const urlChanged = window.location.href !== urlBeforeClick;
        const domMutated = lastDomMutationAt >= clickTime;
        const partOfRageBurst = lastRageClusterTimestamp >= clickTime;

        if (!urlChanged && !domMutated && !partOfRageBurst) {
          sendEvent('dead_click', {
            ...coords,
            targetSelector,
          });
        }
      }, DEAD_CLICK_TIMEOUT_MS);
    }
  });
})();
