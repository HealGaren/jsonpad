chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "jsonhero-create") {
    (async () => {
      try {
        const res = await fetch("https://jsonhero.io/api/create.json", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: msg.title || "jsonpad",
            content: msg.content,
            readOnly: false,
            ttl: msg.ttl ?? 3600,
          }),
        });
        if (!res.ok) {
          sendResponse({ ok: false, error: `HTTP ${res.status}` });
          return;
        }
        const data = await res.json();
        sendResponse({ ok: true, data });
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message || err) });
      }
    })();
    return true; // async response
  }
});
