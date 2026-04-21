# jsonpad

A Chrome extension for editing JSON stuck inside `<input>` and `<textarea>` fields. Pops a real editor when you need it, writes back compact JSON so the form never changes shape.

Status: **proof of concept**.

> Language: **English** · [한국어](README.ko.md)

## Why

Admin tools often ship a form field whose "value" is a compact JSON blob. Editing in place means squinting at one long line, losing track of brackets, and hoping your change still parses. jsonpad gives you a real editor on demand without changing what the form submits.

## Features

- `{}` trigger appears when you focus a field whose value looks like JSON
- `×` on the trigger hides it for that field (session only)
- Force open on any field with `Alt` + `Shift` + `J`
- Toolbar popup: enable / disable, pick default view (`raw` / `jsoncrack`)
- Modal editor with formatting and validation
- **jsoncrack** tab embeds [jsoncrack.com](https://jsoncrack.com) as a read-only graph viewer (iframe `postMessage`, data stays in the browser)
- **Open in JSON Hero** uploads the current JSON to [jsonhero.io](https://jsonhero.io) with a 1-hour TTL and opens the result in a new tab (data leaves your machine — don't use for sensitive payloads)
- Applies changes as **compact JSON** and dispatches `input` / `change` so framework state (React, Vue, etc.) updates correctly
- Presets saved per-browser via `chrome.storage.local`
- AI workflow without a bridge or daemon
  - **Copy AI prompt** — puts a ready-to-send prompt on your clipboard
  - **Paste from clipboard** — drops AI output straight into the editor
- Modal shortcuts: `Esc` cancel · `Ctrl`/`Cmd` + `Enter` apply · `Ctrl`/`Cmd` + `S` format

## Install (developer mode)

1. Clone this repo
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the repo folder

A packaged Web Store build will come with v1.

## Usage

Focus any `<input>` or `<textarea>`. A small `{}` button appears at the top-right of the field. Click it, edit, apply. The original field gets compact JSON back.

## Roadmap

**v1**

- Tree / structured view (jsonhero-style)
- Schema save + schema-driven form view
- Per-field schema suggestions from DOM patterns (XPath etc.)
- Diff view against the original value
- Session undo history, path breadcrumb, in-JSON search
- Subtree copy (value or JSONPath)
- Lenient parser: trailing commas, single quotes, unquoted keys
- Revisit tooling: an extension boilerplate (CRXJS, wxt) may land with the rewrite

**Ideas (not committed)**

- Optional local HTTP bridge for AI integration
  - AI pushes schemas and presets via `curl POST`
  - Extension surfaces suggested prompts back to the AI side

## Project layout

```
manifest.json   MV3 manifest
content.js      detection, modal, storage
modal.css       overlay and modal styles
popup.html/js   toolbar popup (enable / default view)
background.js   service worker (JSON Hero upload relay)
```

No dependencies, no bundler. Edit files and hit **Reload** in `chrome://extensions`.

## License

TBD
