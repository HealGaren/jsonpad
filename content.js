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
          <div class="jsonpad-views" role="group" aria-label="view mode">
            <button class="jsonpad-view" data-view="split">split</button>
            <button class="jsonpad-view" data-view="raw">raw</button>
            <button class="jsonpad-view" data-view="jsoncrack">jsoncrack</button>
          </div>
          <button class="jsonpad-btn" data-act="sync" title="push raw content to jsoncrack (Ctrl/Cmd+Shift+Enter)">sync →</button>
          <div class="jsonpad-presets">
            <select class="jsonpad-preset-select" aria-label="presets">
              <option value="">— preset —</option>
            </select>
            <button class="jsonpad-btn" data-act="save-preset" title="save current as preset">save</button>
          </div>
          <button class="jsonpad-close" data-act="close" aria-label="close">×</button>
        </div>
        <div class="jsonpad-body" data-view="split">
          <div class="jsonpad-pane jsonpad-editor-wrap" data-pane="raw">
            <pre class="jsonpad-highlight" aria-hidden="true"><code></code></pre>
            <textarea class="jsonpad-editor" spellcheck="false" wrap="off" autocomplete="off" autocorrect="off" autocapitalize="off"></textarea>
          </div>
          <div class="jsonpad-resizer" role="separator" aria-orientation="vertical" title="drag to resize"></div>
          <div class="jsonpad-viewer jsonpad-pane" data-pane="jsoncrack">
            <iframe class="jsonpad-jsoncrack" src="https://jsoncrack.com/widget" title="jsoncrack"></iframe>
          </div>
        </div>
        <div class="jsonpad-status" data-status="idle"></div>
        <div class="jsonpad-footer">
          <div class="jsonpad-left">
            <button class="jsonpad-btn" data-act="format" title="pretty-print (Ctrl/Cmd+S)">format</button>
            <button class="jsonpad-btn" data-act="validate">validate</button>
            <button class="jsonpad-btn" data-act="paste">paste from clipboard</button>
            <button class="jsonpad-btn" data-act="copy-prompt" title="copy a prompt template to ask AI for a schema/preset">copy AI prompt</button>
            <button class="jsonpad-btn" data-act="open-jsoncrack-editor" title="copy JSON and open jsoncrack.com editor (paste with Ctrl/Cmd+V)">open in jsoncrack editor</button>
            <button class="jsonpad-btn" data-act="open-jsonhero" title="open in jsonhero.io with payload in URL (no server-side storage, URL stays in history)">open in JSON Hero</button>
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
    const highlightCode = host.querySelector(".jsonpad-highlight code");
    const highlightPre = host.querySelector(".jsonpad-highlight");
    const status = host.querySelector(".jsonpad-status");
    const presetSelect = host.querySelector(".jsonpad-preset-select");
    const iframe = host.querySelector(".jsonpad-jsoncrack");
    const body = host.querySelector(".jsonpad-body");
    const resizer = host.querySelector(".jsonpad-resizer");
    const viewButtons = host.querySelectorAll(".jsonpad-view");
    editor.value = prettyInitial;

    // ----- syntax highlighting -----
    const escapeHtml = (s) => s.replace(/[&<>]/g, (c) =>
      c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"
    );
    const JSON_TOKEN = /("(?:\\.|[^"\\])*"\s*(?=:))|("(?:\\.|[^"\\])*")|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],:])/g;
    const renderHighlight = (text) => {
      let out = "";
      let last = 0;
      text.replace(JSON_TOKEN, (m, key, str, bool, num, punct, idx) => {
        out += escapeHtml(text.slice(last, idx));
        const cls = key ? "jp-key" : str ? "jp-str" : bool ? "jp-bool" : num ? "jp-num" : "jp-punct";
        out += `<span class="${cls}">${escapeHtml(m)}</span>`;
        last = idx + m.length;
        return m;
      });
      out += escapeHtml(text.slice(last));
      return out + "\n";
    };
    const updateHighlight = () => {
      highlightCode.innerHTML = renderHighlight(editor.value);
    };
    const syncScroll = () => {
      highlightPre.scrollTop = editor.scrollTop;
      highlightPre.scrollLeft = editor.scrollLeft;
    };
    editor.addEventListener("input", updateHighlight);
    editor.addEventListener("scroll", syncScroll);

    // ----- indent helpers -----
    const INDENT = "  ";
    const setTextareaValue = (ta, nextValue, selStart, selEnd) => {
      ta.value = nextValue;
      ta.selectionStart = selStart;
      ta.selectionEnd = selEnd ?? selStart;
      updateHighlight();
    };
    const handleTab = (ta, shift) => {
      const { selectionStart: s, selectionEnd: e, value } = ta;
      if (s === e) {
        if (!shift) {
          const lineStart = value.lastIndexOf("\n", s - 1) + 1;
          const col = s - lineStart;
          const fill = INDENT.length - (col % INDENT.length);
          const insert = " ".repeat(fill || INDENT.length);
          setTextareaValue(ta, value.slice(0, s) + insert + value.slice(e), s + insert.length);
        } else {
          const lineStart = value.lastIndexOf("\n", s - 1) + 1;
          const remove = value.slice(lineStart).match(/^ {1,2}/);
          if (remove) {
            const n = remove[0].length;
            setTextareaValue(ta, value.slice(0, lineStart) + value.slice(lineStart + n), Math.max(lineStart, s - n));
          }
        }
        return;
      }
      const blockStart = value.lastIndexOf("\n", s - 1) + 1;
      let blockEnd = value.indexOf("\n", e > blockStart && value[e - 1] === "\n" ? e - 1 : e);
      if (blockEnd === -1) blockEnd = value.length;
      const block = value.slice(blockStart, blockEnd);
      const lines = block.split("\n");
      let delta0 = 0, deltaN = 0;
      let newLines;
      if (!shift) {
        newLines = lines.map((l) => INDENT + l);
        delta0 = INDENT.length;
        deltaN = INDENT.length * lines.length;
      } else {
        newLines = lines.map((l) => {
          const m = l.match(/^ {1,2}/);
          if (!m) return l;
          deltaN -= m[0].length;
          return l.slice(m[0].length);
        });
        const first = lines[0].match(/^ {1,2}/);
        delta0 = first ? -first[0].length : 0;
      }
      const newBlock = newLines.join("\n");
      setTextareaValue(
        ta,
        value.slice(0, blockStart) + newBlock + value.slice(blockEnd),
        s + delta0,
        e + deltaN
      );
    };
    const handleEnter = (ta) => {
      const { selectionStart: s, selectionEnd: e, value } = ta;
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      const indent = (value.slice(lineStart, s).match(/^\s*/) || [""])[0];
      const prev = value[s - 1];
      const next = value[e];
      let insert = "\n" + indent;
      let caret = insert.length;
      if (prev === "{" || prev === "[") {
        insert += INDENT;
        caret = insert.length;
        const closing = prev === "{" ? "}" : "]";
        if (next === closing) insert += "\n" + indent;
      }
      setTextareaValue(ta, value.slice(0, s) + insert + value.slice(e), s + caret);
    };
    editor.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        handleTab(editor, e.shiftKey);
      } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleEnter(editor);
      }
    });
    updateHighlight();

    // ----- split resizer -----
    const applyRatio = (pct) => {
      const clamped = Math.max(15, Math.min(85, pct));
      body.style.setProperty("--split-left", `${clamped}%`);
      body.style.setProperty("--split-right", `${100 - clamped}%`);
    };
    (async () => {
      const { splitRatio = 50 } = await chrome.storage.local.get("splitRatio");
      applyRatio(splitRatio);
    })();

    let dragging = false;
    const onPointerMove = (e) => {
      if (!dragging) return;
      const rect = body.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      applyRatio(pct);
    };
    const onPointerUp = async (e) => {
      if (!dragging) return;
      dragging = false;
      host.classList.remove("jsonpad-dragging");
      resizer.releasePointerCapture?.(e.pointerId);
      const left = parseFloat(body.style.getPropertyValue("--split-left")) || 50;
      await chrome.storage.local.set({ splitRatio: left });
    };
    resizer.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      dragging = true;
      host.classList.add("jsonpad-dragging");
      resizer.setPointerCapture?.(e.pointerId);
    });
    resizer.addEventListener("pointermove", onPointerMove);
    resizer.addEventListener("pointerup", onPointerUp);
    resizer.addEventListener("pointercancel", onPointerUp);

    let iframeReady = false;
    let lastPayload = null;
    let activeView = "split";

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

    const setView = (name) => {
      if (!["split", "raw", "jsoncrack"].includes(name)) name = "split";
      activeView = name;
      body.setAttribute("data-view", name);
      for (const b of viewButtons) {
        b.setAttribute("aria-pressed", String(b.dataset.view === name));
      }
      if (name !== "raw") sendToJsoncrack(editor.value);
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
        updateHighlight();
        setStatus("formatted", "ok");
        if (activeView !== "raw") sendToJsoncrack(editor.value);
      } catch (err) {
        setStatus(`invalid: ${err.message}`, "err");
      }
    };

    const syncJsoncrack = () => {
      sendToJsoncrack(editor.value);
      setStatus("synced to jsoncrack", "ok");
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
        updateHighlight();
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
      updateHighlight();
      setStatus(`loaded preset "${name}"`, "ok");
      if (activeView !== "raw") sendToJsoncrack(editor.value);
    };

    // use window.prompt but rename to avoid shadowing
    const prompt_ = (msg) => window.prompt(msg);

    presetSelect.addEventListener("change", (e) => applyPreset(e.target.value));
    refreshPresets();

    const openInJsoncrackEditor = async () => {
      const t = editor.value.trim();
      if (!t) { setStatus("nothing to send", "err"); return; }
      let pretty;
      try { pretty = toPretty(t); }
      catch (err) { setStatus(`invalid: ${err.message}`, "err"); return; }
      try {
        await navigator.clipboard.writeText(pretty);
      } catch (err) {
        setStatus(`clipboard: ${err.message}`, "err");
        return;
      }
      window.open("https://jsoncrack.com/editor", "_blank", "noopener");
      setStatus("copied — paste (Ctrl/Cmd+V) in the opened jsoncrack editor", "ok");
    };

    const openInJsonHero = () => {
      const t = editor.value.trim();
      if (!t) { setStatus("nothing to send", "err"); return; }
      let compact;
      try { compact = JSON.stringify(JSON.parse(t)); }
      catch (err) { setStatus(`invalid: ${err.message}`, "err"); return; }
      const bytes = new TextEncoder().encode(compact);
      let bin = "";
      for (const b of bytes) bin += String.fromCharCode(b);
      const b64 = btoa(bin);
      const url = `https://jsonhero.io/new?j=${encodeURIComponent(b64)}`;
      if (url.length > 20000) {
        setStatus("JSON too large for URL-based JSON Hero (> ~20k chars)", "err");
        return;
      }
      window.open(url, "_blank", "noopener");
      setStatus("opened in JSON Hero", "ok");
    };

    host.addEventListener("click", (e) => {
      if (e.target === host) { closeModal(); return; }
      const view = e.target.getAttribute && e.target.getAttribute("data-view");
      if (view) { setView(view); return; }
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
        case "open-jsoncrack-editor": openInJsoncrackEditor(); break;
        case "open-jsonhero": openInJsonHero(); break;
        case "sync": syncJsoncrack(); break;
      }
    });

    // Shortcuts: Cmd/Ctrl+Enter apply, Cmd/Ctrl+Shift+Enter sync, Esc cancel, Cmd/Ctrl+S format
    host.addEventListener("keydown", (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Escape") { e.preventDefault(); closeModal(); }
      else if (mod && e.shiftKey && e.key === "Enter") { e.preventDefault(); syncJsoncrack(); }
      else if (mod && e.key === "Enter") { e.preventDefault(); apply(); }
      else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); format(); }
    });

    (async () => {
      const { defaultView = "split" } = await chrome.storage.local.get("defaultView");
      setView(defaultView);
      if (activeView !== "jsoncrack") editor.focus();
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
