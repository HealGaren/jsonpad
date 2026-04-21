(async () => {
  const checkbox = document.getElementById("enabled");
  const viewRadios = document.querySelectorAll('input[name="view"]');

  const { enabled = true, defaultView = "raw" } = await chrome.storage.local.get(
    ["enabled", "defaultView"]
  );

  checkbox.checked = enabled;
  for (const r of viewRadios) r.checked = r.value === defaultView;

  checkbox.addEventListener("change", () =>
    chrome.storage.local.set({ enabled: checkbox.checked })
  );
  for (const r of viewRadios) {
    r.addEventListener("change", () => {
      if (r.checked) chrome.storage.local.set({ defaultView: r.value });
    });
  }
})();
