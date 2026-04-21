(async () => {
  const checkbox = document.getElementById("enabled");
  const { enabled = true } = await chrome.storage.local.get("enabled");
  checkbox.checked = enabled;
  checkbox.addEventListener("change", async () => {
    await chrome.storage.local.set({ enabled: checkbox.checked });
  });
})();
