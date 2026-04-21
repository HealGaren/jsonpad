(() => {
  const BUTTON_ATTR = "data-jsonpad-button";
  const HOST_ATTR = "data-jsonpad-host";

  let enabled = true;
  let currentTarget = null;
  let currentButton = null;
  let modalHost = null;
  const dismissedFields = new WeakSet();

  chrome.storage.local.get("enabled").then((res) => {
    enabled = res.enabled !== false;
    if (!enabled) removeButton();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.enabled) return;
    enabled = changes.enabled.newValue !== false;
    if (!enabled) {
      if (modalHost) closeModal();
      removeButton();
    } else if (document.activeElement && isEditableTarget(document.activeElement)) {
      maybeShowButton(document.activeElement);
    }
  });

  const looksLikeJSON = (s) => {
    if (typeof s !== "string") return false;
    const t = s.trim();
    if (!t) return false;
    return (t.startsWith("{") && t.endsWith("}")) ||
           (t.startsWith("[") && t.endsWith("]"));
  };

  const isEditableTarget = (el) => {
    if (!el) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName === "INPUT") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      return ["text", "search", "url", "", "tel"].includes(type);
    }
    return false;
  };

  const getValue = (el) => el.value ?? "";

  const setValue = (el, value) => {
    const proto = el.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const toCompact = (text) => {
    return JSON.stringify(JSON.parse(text));
  };

  const toPretty = (text) => {
    return JSON.stringify(JSON.parse(text), null, 2);
  };

  const positionButton = (btn, target) => {
    const rect = target.getBoundingClientRect();
    const width = btn.offsetWidth || 50;
    btn.style.top = `${window.scrollY + rect.top + 4}px`;
    btn.style.left = `${window.scrollX + rect.right - width - 4}px`;
  };

  const removeButton = () => {
    if (currentButton) {
      currentButton.remove();
      currentButton = null;
    }
  };

  const showButton = (target) => {
    removeButton();
    const wrap = document.createElement("div");
    wrap.setAttribute(BUTTON_ATTR, "1");
    wrap.className = "jsonpad-trigger-wrap";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "jsonpad-trigger";
    openBtn.textContent = "{}";
    openBtn.title = "jsonpad: edit JSON (Alt+Shift+J)";

    const dismissBtn = document.createElement("button");
    dismissBtn.type = "button";
    dismissBtn.className = "jsonpad-trigger-dismiss";
    dismissBtn.textContent = "×";
    dismissBtn.title = "hide for this field";

    const preventBlur = (e) => e.preventDefault();
    openBtn.addEventListener("mousedown", preventBlur);
    dismissBtn.addEventListener("mousedown", preventBlur);

    openBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openModal(target);
    });
    dismissBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dismissedFields.add(target);
      removeButton();
    });

    wrap.appendChild(openBtn);
    wrap.appendChild(dismissBtn);
    document.body.appendChild(wrap);
    positionButton(wrap, target);
    currentButton = wrap;
  };

  const maybeShowButton = (target) => {
    if (!enabled) return;
    if (dismissedFields.has(target)) return;
    if (!looksLikeJSON(getValue(target))) return;
    showButton(target);
  };

  const onFocusIn = (e) => {
    const el = e.target;
    if (!isEditableTarget(el)) return;
    currentTarget = el;
    maybeShowButton(el);
  };

  const onKeyDown = (e) => {
    if (!enabled || modalHost) return;
    if (!e.altKey || !e.shiftKey) return;
    if (e.code !== "KeyJ") return;
    const el = document.activeElement;
    if (!isEditableTarget(el)) return;
    e.preventDefault();
    dismissedFields.delete(el);
    currentTarget = el;
    openModal(el);
  };
  document.addEventListener("keydown", onKeyDown, true);

  const onFocusOut = (e) => {
    // Delay so click on button registers
    setTimeout(() => {
      if (document.activeElement === currentTarget) return;
      if (modalHost) return; // modal open, keep button area alive
      removeButton();
    }, 150);
  };

  const onScrollOrResize = () => {
    if (currentButton && currentTarget) {
      positionButton(currentButton, currentTarget);
    }
  };

  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("focusout", onFocusOut, true);
  window.addEventListener("scroll", onScrollOrResize, true);
  window.addEventListener("resize", onScrollOrResize);

  // ---------- Modal ----------

  const openModal = (target) => {
    if (modalHost) closeModal();
    const initial = getValue(target);
    let prettyInitial = initial;
    try {
      if (initial.trim()) prettyInitial = toPretty(initial);
    } catch (_) {
      // leave as-is if unparseable
    }

    const host = document.createElement("div");
    host.setAttribute(HOST_ATTR, "1");
    host.className = "jsonpad-overlay";
    host.innerHTML = `
      <div class="jsonpad-modal" role="dialog" aria-label="jsonpad">
        <div class="jsonpad-header">
          <div class="jsonpad-title">jsonpad</div>
          <div class="jsonpad-tabs" role="tablist">
            <button class="jsonpad-tab" data-tab="raw" role="tab">raw</button>
            <button class="jsonpad-tab" data-tab="jsoncrack" role="tab" title="read-only graph viewer via jsoncrack.com iframe">jsoncrack</button>
          </div>
          <div class="jsonpad-presets">
            <select class="jsonpad-preset-select" aria-label="presets">
              <option value="">— preset —</option>
            </select>
            <button class="jsonpad-btn" data-act="save-preset" title="save current as preset">save</button>
          </div>
          <button class="jsonpad-close" data-act="close" aria-label="close">×</button>
        </div>
        <div class="jsonpad-body">
          <textarea class="jsonpad-editor" spellcheck="false" data-pane="raw"></textarea>
          <div class="jsonpad-viewer" data-pane="jsoncrack" hidden>
            <iframe class="jsonpad-jsoncrack" src="https://jsoncrack.com/widget" title="jsoncrack"></iframe>
          </div>
        </div>
        <div class="jsonpad-status" data-status="idle"></div>
        <div class="jsonpad-footer">
          <div class="jsonpad-left">
            <button class="jsonpad-btn" data-act="format">format</button>
            <button class="jsonpad-btn" data-act="validate">validate</button>
            <button class="jsonpad-btn" data-act="paste">paste from clipboard</button>
            <button class="jsonpad-btn" data-act="copy-prompt" title="copy a prompt template to ask AI for a schema/preset">copy AI prompt</button>
            <button class="jsonpad-btn" data-act="open-jsonhero" title="upload to jsonhero.io and open in a new tab (data leaves your machine)">open in JSON Hero</button>
          </div>
          <div class="jsonpad-right">
            <button class="jsonpad-btn jsonpad-secondary" data-act="cancel">cancel</button>
            <button class="jsonpad-btn jsonpad-primary" data-act="apply">apply</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(host);
    modalHost = host;

    const editor = host.querySelector(".jsonpad-editor");
    const status = host.querySelector(".jsonpad-status");
    const presetSelect = host.querySelector(".jsonpad-preset-select");
    const iframe = host.querySelector(".jsonpad-jsoncrack");
    const panes = host.querySelectorAll("[data-pane]");
    const tabs = host.querySelectorAll(".jsonpad-tab");
    editor.value = prettyInitial;

    let iframeReady = false;
    let lastPayload = null;
    let activeTab = "raw";

    const postPayload = () => {
      if (!lastPayload) return;
      try { iframe.contentWindow.postMessage(lastPayload, "*"); } catch {}
    };

    const sendToJsoncrack = (text) => {
      let payload;
      try {
        payload = JSON.stringify(JSON.parse(text));
      } catch {
        payload = text || "{}";
      }
      lastPayload = {
        json: payload,
        options: { theme: "dark", direction: "RIGHT" },
      };
      if (iframeReady) postPayload();
    };

    const onWindowMessage = (ev) => {
      if (ev.data !== "json-crack-embed") return;
      iframeReady = true;
      postPayload();
    };
    window.addEventListener("message", onWindowMessage);

    // Fallback: if we miss the ready ping, push payload on load and again shortly after.
    iframe.addEventListener("load", () => {
      postPayload();
      setTimeout(postPayload, 300);
      setTimeout(postPayload, 1000);
    });

    const setTab = (name) => {
      activeTab = name;
      for (const t of tabs) t.setAttribute("aria-selected", String(t.dataset.tab === name));
      for (const p of panes) p.hidden = p.dataset.pane !== name;
      if (name === "jsoncrack") sendToJsoncrack(editor.value);
    };

    const setStatus = (msg, kind) => {
      status.textContent = msg || "";
      status.setAttribute("data-status", kind || "idle");
    };

    const validate = () => {
      const t = editor.value.trim();
      if (!t) {
        setStatus("empty", "idle");
        return { ok: true, empty: true };
      }
      try {
        JSON.parse(t);
        setStatus("valid JSON", "ok");
        return { ok: true };
      } catch (err) {
        setStatus(`invalid: ${err.message}`, "err");
        return { ok: false, err };
      }
    };

    const format = () => {
      const t = editor.value.trim();
      if (!t) return;
      try {
        editor.value = toPretty(t);
        setStatus("formatted", "ok");
      } catch (err) {
        setStatus(`invalid: ${err.message}`, "err");
      }
    };

    const apply = () => {
      const t = editor.value.trim();
      if (!t) {
        setValue(target, "");
        closeModal();
        return;
      }
      try {
        const compact = toCompact(t);
        setValue(target, compact);
        closeModal();
      } catch (err) {
        setStatus(`invalid: ${err.message}`, "err");
      }
    };

    const pasteClipboard = async () => {
      try {
        const txt = await navigator.clipboard.readText();
        editor.value = txt;
        validate();
      } catch (err) {
        setStatus(`clipboard: ${err.message}`, "err");
      }
    };

    const copyPrompt = async () => {
      const sample = editor.value.trim() || "<paste current JSON here>";
      const prompt = [
        "I'm using the jsonpad browser extension. Please produce:",
        "1) A JSON Schema describing this data, and",
        "2) A reasonable preset value (valid JSON).",
        "",
        "Return two fenced code blocks labeled `schema` and `preset`.",
        "",
        "Current JSON:",
        "```json",
        sample,
        "```",
      ].join("\n");
      try {
        await navigator.clipboard.writeText(prompt);
        setStatus("prompt copied to clipboard", "ok");
      } catch (err) {
        setStatus(`clipboard: ${err.message}`, "err");
      }
    };

    const savePreset = async () => {
      const t = editor.value.trim();
      if (!t) {
        setStatus("nothing to save", "err");
        return;
      }
      try {
        JSON.parse(t);
      } catch (err) {
        setStatus(`invalid: ${err.message}`, "err");
        return;
      }
      const name = prompt_("preset name?");
      if (!name) return;
      const { presets = {} } = await chrome.storage.local.get("presets");
      presets[name] = t;
      await chrome.storage.local.set({ presets });
      await refreshPresets();
      presetSelect.value = name;
      setStatus(`saved preset "${name}"`, "ok");
    };

    const refreshPresets = async () => {
      const { presets = {} } = await chrome.storage.local.get("presets");
      presetSelect.innerHTML = '<option value="">— preset —</option>';
      for (const name of Object.keys(presets).sort()) {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        presetSelect.appendChild(opt);
      }
    };

    const applyPreset = async (name) => {
      if (!name) return;
      const { presets = {} } = await chrome.storage.local.get("presets");
      const v = presets[name];
      if (v == null) return;
      try {
        editor.value = toPretty(v);
      } catch {
        editor.value = v;
      }
      setStatus(`loaded preset "${name}"`, "ok");
    };

    // use window.prompt but rename to avoid shadowing
    const prompt_ = (msg) => window.prompt(msg);

    presetSelect.addEventListener("change", (e) => applyPreset(e.target.value));
    refreshPresets();

    const openInJsonHero = async () => {
      const t = editor.value.trim();
      if (!t) { setStatus("nothing to send", "err"); return; }
      let parsed;
      try { parsed = JSON.parse(t); }
      catch (err) { setStatus(`invalid: ${err.message}`, "err"); return; }
      setStatus("uploading to JSON Hero…", "idle");
      try {
        const res = await chrome.runtime.sendMessage({
          type: "jsonhero-create",
          title: "jsonpad",
          content: parsed,
          ttl: 3600,
        });
        if (!res || !res.ok) {
          setStatus(`JSON Hero: ${res && res.error || "failed"}`, "err");
          return;
        }
        window.open(res.data.location, "_blank", "noopener");
        setStatus("opened in JSON Hero (expires in 1h)", "ok");
      } catch (err) {
        setStatus(`JSON Hero: ${err.message}`, "err");
      }
    };

    host.addEventListener("click", (e) => {
      if (e.target === host) { closeModal(); return; }
      const tab = e.target.getAttribute && e.target.getAttribute("data-tab");
      if (tab) { setTab(tab); return; }
      const act = e.target.getAttribute && e.target.getAttribute("data-act");
      if (!act) return;
      switch (act) {
        case "close":
        case "cancel": closeModal(); break;
        case "format": format(); break;
        case "validate": validate(); break;
        case "apply": apply(); break;
        case "paste": pasteClipboard(); break;
        case "copy-prompt": copyPrompt(); break;
        case "save-preset": savePreset(); break;
        case "open-jsonhero": openInJsonHero(); break;
      }
    });

    // Shortcuts: Cmd/Ctrl+Enter apply, Esc cancel, Cmd/Ctrl+S format
    host.addEventListener("keydown", (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Escape") { e.preventDefault(); closeModal(); }
      else if (mod && e.key === "Enter") { e.preventDefault(); apply(); }
      else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); format(); }
    });

    (async () => {
      const { defaultView = "raw" } = await chrome.storage.local.get("defaultView");
      setTab(defaultView === "jsoncrack" ? "jsoncrack" : "raw");
      if (defaultView !== "jsoncrack") editor.focus();
    })();
    validate();

    // Stash for teardown
    host._jsonpadCleanup = () => window.removeEventListener("message", onWindowMessage);
  };

  const closeModal = () => {
    if (modalHost) {
      if (typeof modalHost._jsonpadCleanup === "function") modalHost._jsonpadCleanup();
      modalHost.remove();
      modalHost = null;
    }
    if (currentTarget && document.contains(currentTarget)) {
      try { currentTarget.focus(); } catch {}
    }
  };
})();
