(() => {
  if (typeof window === "undefined") return;
  if (window.__USER_ANALYTICS_TRACKER_INITIALIZED__) return;
  window.__USER_ANALYTICS_TRACKER_INITIALIZED__ = true;

  const SESSION_STORAGE_KEY = "tracking_session_id";
  const RAGE_WINDOW_MS = 1000;
  const RAGE_RADIUS_PX = 30;
  const RAGE_MIN_CLICKS = 3;
  const RAGE_COOLDOWN_MS = 1500;
  const DEAD_CLICK_TIMEOUT_MS = 350;

  const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const PHONE_CARD_REGEX =
    /\b(?:\+?\d[\d -]{7,14}\d|\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4})\b/g;

  const getSessionId = () => {
    let id = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!id) {
      if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
      ) {
        id = crypto.randomUUID();
      } else {
        id = Date.now().toString(36) + Math.random().toString(36).substring(2);
      }
      localStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    return id;
  };

  const script = document.currentScript;
  const apiUrl =
    (script && script.getAttribute("data-api-url")) || "/api/events";
  const sessionId = getSessionId();

  const clickHistory = [];
  let lastRageTimestamp = 0;
  let pendingDeadClick = null;

  const scrubPII = (rawText) => {
    if (!rawText || typeof rawText !== "string") return "";
    return rawText
      .replace(EMAIL_REGEX, "[EMAIL_REDACTED]")
      .replace(PHONE_CARD_REGEX, "[PII_REDACTED]")
      .trim()
      .slice(0, 80);
  };

  const isSensitiveInput = (el) => {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") {
      return true;
    }
    if (el.isContentEditable) return true;
    if (
      el.closest &&
      el.closest('[data-privacy-mask="true"], [data-sensitive="true"]')
    ) {
      return true;
    }
    return false;
  };

  const extractSafeText = (el) => {
    if (!el || !el.tagName) return "";
    const tag = el.tagName.toLowerCase();

    if (isSensitiveInput(el)) {
      const inputType = (el.getAttribute("type") || tag).toLowerCase();
      if (inputType === "password") return "[REDACTED PASSWORD]";
      return "[REDACTED INPUT (" + inputType + ")]";
    }

    const rawLabel =
      el.getAttribute("aria-label") ||
      el.innerText ||
      el.textContent ||
      el.getAttribute("value") ||
      "";

    const singleLine = rawLabel.replace(/\s+/g, " ").trim();
    return scrubPII(singleLine);
  };

  const buildDomSelector = (el) => {
    if (!el || !el.tagName) return "unknown";

    const segments = [];
    let current = el;
    let depth = 0;

    while (
      current &&
      current.nodeType === 1 &&
      current.tagName.toLowerCase() !== "body" &&
      current.tagName.toLowerCase() !== "html" &&
      depth < 3
    ) {
      const tag = current.tagName.toLowerCase();
      let segment = tag;

      if (current.id) {
        segment += "#" + current.id.trim().replace(/\s+/g, "-");
        segments.unshift(segment);
        break;
      }

      if (typeof current.className === "string" && current.className.trim()) {
        const classes = current.className
          .trim()
          .split(/\s+/)
          .filter(
            (cls) => !cls.startsWith("hover:") && !cls.startsWith("focus:"),
          )
          .slice(0, 2);
        if (classes.length > 0) {
          segment += "." + classes.join(".");
        }
      }

      segments.unshift(segment);
      current = current.parentElement;
      depth++;
    }

    return segments.join(" > ") || el.tagName.toLowerCase();
  };

  /**
   * Strictly identifies whether the clicked element is an intended actionable UI control.
   * Returns the actionable element or null if the user clicked a layout container,
   * blank background, paragraph, heading, or form text input.
   */
  const getActionableElement = (target) => {
    if (!target || target.nodeType !== 1) return null;

    let curr = target;
    let depth = 0;

    while (
      curr &&
      curr !== document.body &&
      curr !== document.documentElement &&
      depth < 3
    ) {
      const tag = curr.tagName.toLowerCase();

      // Form data entry fields are never dead-click targets
      if (tag === "input") {
        const type = (curr.getAttribute("type") || "text").toLowerCase();
        if (type === "button" || type === "submit" || type === "reset") {
          return curr;
        }
        return null;
      }
      if (
        tag === "textarea" ||
        tag === "select" ||
        tag === "label" ||
        tag === "form"
      ) {
        return null;
      }

      // Native interactive controls
      if (tag === "button" || tag === "a" || tag === "summary") {
        return curr;
      }

      // Explicit interactive roles or dead-click test badges
      const role = (curr.getAttribute("role") || "").toLowerCase();
      if (
        role === "button" ||
        role === "link" ||
        role === "tab" ||
        role === "menuitem"
      ) {
        return curr;
      }

      if (
        curr.hasAttribute("data-dead-click") ||
        (typeof curr.className === "string" &&
          (curr.className.includes("dead-badge") ||
            curr.className.includes("dead-click") ||
            curr.className.includes("btn")))
      ) {
        return curr;
      }

      curr = curr.parentElement;
      depth++;
    }

    return null;
  };

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

  const flushPendingDeadClickAsNormalClick = () => {
    if (!pendingDeadClick) return;
    const pending = pendingDeadClick;
    pendingDeadClick = null;
    clearTimeout(pending.timerId);
    pending.observer.disconnect();
    sendEvent("click", pending.payload);
  };

  sendEvent("page_view");

  window.addEventListener("click", (event) => {
    // If a previous click is still waiting in its 350ms observation window,
    // flush it immediately as a standard 'click' so timers never stack up.
    if (pendingDeadClick) {
      flushPendingDeadClickAsNormalClick();
    }

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

    const rawTarget =
      event.target && event.target.nodeType === 1 ? event.target : null;
    const actionableTarget = getActionableElement(rawTarget);
    const inspectedElement = actionableTarget || rawTarget;

    const targetTag = inspectedElement
      ? inspectedElement.tagName.toLowerCase()
      : "unknown";
    const selector = buildDomSelector(inspectedElement);
    const targetText = extractSafeText(inspectedElement);

    const basePayload = {
      x: Math.round(pageX),
      y: Math.round(pageY),
      xPct,
      yPct,
      viewportWidth: Math.round(viewportWidth),
      viewportHeight: Math.round(viewportHeight),
      targetTag,
      selector,
      targetSelector: selector,
      targetText,
    };

    // 1. Evaluate Sliding-Window Rage Click Heuristic
    const now = Date.now();
    while (
      clickHistory.length > 0 &&
      now - clickHistory[0].timestamp > RAGE_WINDOW_MS
    ) {
      clickHistory.shift();
    }

    clickHistory.push({ x: pageX, y: pageY, timestamp: now });

    const clusterClicks = clickHistory.filter((pt) => {
      const dx = pt.x - pageX;
      const dy = pt.y - pageY;
      return Math.sqrt(dx * dx + dy * dy) <= RAGE_RADIUS_PX;
    });

    if (
      clusterClicks.length >= RAGE_MIN_CLICKS &&
      now - lastRageTimestamp > RAGE_COOLDOWN_MS
    ) {
      lastRageTimestamp = now;
      // Emit strictly 1 request ('rage_click') for this click
      sendEvent("rage_click", {
        ...basePayload,
        clickCount: clusterClicks.length,
        rageClickCount: clusterClicks.length,
      });
      return;
    }

    // 2. Non-actionable targets (blank background, headings, text inputs)
    // immediately emit 1 standard 'click' request with zero timer overhead.
    if (!actionableTarget) {
      sendEvent("click", basePayload);
      return;
    }

    // 3. Actionable target: observe for 350ms to classify as either 'click' or 'dead_click'
    const initialUrl = window.location.href;
    let resolved = false;

    const observer = new MutationObserver(() => {
      if (resolved) return;
      resolved = true;
      if (pendingDeadClick) {
        clearTimeout(pendingDeadClick.timerId);
        pendingDeadClick = null;
      }
      observer.disconnect();
      // DOM mutated -> working interactive control -> emit 1 'click' request immediately
      sendEvent("click", basePayload);
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    }

    const timerId = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      pendingDeadClick = null;
      observer.disconnect();

      const urlChanged = window.location.href !== initialUrl;
      if (urlChanged) {
        sendEvent("click", basePayload);
      } else {
        // Zero DOM mutations & zero URL change after 350ms -> emit 1 'dead_click' request
        sendEvent("dead_click", basePayload);
      }
    }, DEAD_CLICK_TIMEOUT_MS);

    pendingDeadClick = {
      timerId,
      observer,
      payload: basePayload,
    };
  });
})();
