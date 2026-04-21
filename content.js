(() => {
  const BUTTON_ATTR = "data-jsonpad-button";
  const HOST_ATTR = "data-jsonpad-host";

  let currentTarget = null;
  let currentButton = null;
  let modalHost = null;

  const looksLikeJSON = (s) => {
    if (typeof s !== "string") return false;
    const t = s.trim();
    if (!t) return true; // empty is fine — user may want to start writing JSON
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
    btn.style.top = `${window.scrollY + rect.top + 4}px`;
    btn.style.left = `${window.scrollX + rect.right - 28}px`;
  };

  const removeButton = () => {
    if (currentButton) {
      currentButton.remove();
      currentButton = null;
    }
  };

  const showButton = (target) => {
    removeButton();
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute(BUTTON_ATTR, "1");
    btn.className = "jsonpad-trigger";
    btn.textContent = "{}";
    btn.title = "jsonpad: edit JSON";
    btn.addEventListener("mousedown", (e) => {
      // prevent focus loss on target
      e.preventDefault();
    });
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openModal(target);
    });
    document.body.appendChild(btn);
    positionButton(btn, target);
    currentButton = btn;
  };

  const onFocusIn = (e) => {
    const el = e.target;
    if (!isEditableTarget(el)) return;
    currentTarget = el;
    showButton(el);
  };

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
          <div class="jsonpad-presets">
            <select class="jsonpad-preset-select" aria-label="presets">
              <option value="">— preset —</option>
            </select>
            <button class="jsonpad-btn" data-act="save-preset" title="save current as preset">save</button>
          </div>
          <button class="jsonpad-close" data-act="close" aria-label="close">×</button>
        </div>
        <textarea class="jsonpad-editor" spellcheck="false"></textarea>
        <div class="jsonpad-status" data-status="idle"></div>
        <div class="jsonpad-footer">
          <div class="jsonpad-left">
            <button class="jsonpad-btn" data-act="format">format</button>
            <button class="jsonpad-btn" data-act="validate">validate</button>
            <button class="jsonpad-btn" data-act="paste">paste from clipboard</button>
            <button class="jsonpad-btn" data-act="copy-prompt" title="copy a prompt template to ask AI for a schema/preset">copy AI prompt</button>
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
    editor.value = prettyInitial;

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

    host.addEventListener("click", (e) => {
      if (e.target === host) { closeModal(); return; }
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
      }
    });

    // Shortcuts: Cmd/Ctrl+Enter apply, Esc cancel, Cmd/Ctrl+S format
    host.addEventListener("keydown", (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Escape") { e.preventDefault(); closeModal(); }
      else if (mod && e.key === "Enter") { e.preventDefault(); apply(); }
      else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); format(); }
    });

    setTimeout(() => editor.focus(), 0);
    validate();
  };

  const closeModal = () => {
    if (modalHost) {
      modalHost.remove();
      modalHost = null;
    }
    if (currentTarget && document.contains(currentTarget)) {
      try { currentTarget.focus(); } catch {}
    }
  };
})();
