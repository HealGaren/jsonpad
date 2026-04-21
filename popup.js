(async () => {
  const checkbox = document.getElementById("enabled");
  const wordWrapBox = document.getElementById("word-wrap");
  const viewRadios = document.querySelectorAll('input[name="view"]');

  const {
    enabled = true,
    defaultView = "split",
    wordWrap = false,
  } = await chrome.storage.local.get(["enabled", "defaultView", "wordWrap"]);

  checkbox.checked = enabled;
  wordWrapBox.checked = wordWrap;
  for (const r of viewRadios) r.checked = r.value === defaultView;

  checkbox.addEventListener("change", () =>
    chrome.storage.local.set({ enabled: checkbox.checked })
  );
  wordWrapBox.addEventListener("change", () =>
    chrome.storage.local.set({ wordWrap: wordWrapBox.checked })
  );
  for (const r of viewRadios) {
    r.addEventListener("change", () => {
      if (r.checked) chrome.storage.local.set({ defaultView: r.value });
    });
  }
})();
