# PageSage

A strict, read-only page summarizer for the Firefox sidebar, powered by Google Gemini.

PageSage reads the page you are on and writes a summary that keeps what matters: commands, file paths, flags, version numbers and warnings are carried over exactly, steps stay in order, and every point can point back to the section it came from. It is built for documentation, tutorials and long articles where a loose summary is not good enough.

## Features

- **TL;DR first.** A short takeaway up top, then the full summary. For sensitive or safety-critical content it skips the TL;DR rather than oversimplify.
- **Nothing important dropped.** Commands, paths, flags, versions and every warning or caution are kept verbatim in meaning.
- **Checklists for guides.** Step-by-step pages become an ordered checklist with real checkboxes whose state is remembered.
- **Section references.** Points cite the page's own heading IDs (for example `#Verify_signature`) so you can jump back to the source.
- **Smart model routing.** Heavy, technical pages go to stronger models; everything else goes to fast, cheap ones. If a model hits its quota or is overloaded, PageSage falls back to the next one automatically.
- **Remembers your summaries.** Close and reopen the sidebar and the summary is still there. Open it on a page you have not summarized and it starts on its own.
- **Live status.** A running timer and the name of the model that is answering.
- **Safe rendering.** Output is built from DOM nodes, never injected as HTML.

## Requirements

- Firefox 115 or newer, or a Firefox-based browser such as Zen
- A Google Gemini API key ([Google AI Studio](https://aistudio.google.com/))

## Install

**From a release (recommended).** Download the signed `.xpi` from the [Releases](../../releases) page. In Firefox open `about:addons`, click the gear, choose **Install Add-on From File…** and select the file.

**For development.** Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and select `src/manifest.json`. Temporary add-ons are removed when the browser closes.

## Setup

1. Open the sidebar with **Ctrl+Shift+D** (change it under `about:addons` → gear → **Manage Extension Shortcuts**).
2. Click the gear, paste your Gemini API key and save.
3. Open any web page and press **Summarize page**, or just open the sidebar on a new page.

## Model routing

| Mode | Behaviour |
| --- | --- |
| Automatic (default) | Heavy pages try `gemini-3.8-flash`, then `gemini-3.6-flash`, then the light models. Other pages use the light models. |
| Light models only | `gemini-3.5-flash-lite`, then `gemini-3.1-flash-lite`. |
| Strong models first | Strong models first, light models as the last resort. |
| Choose a model | Use exactly one model you pick. |

A page counts as heavy when it has several code blocks, warning boxes or a lot of text. The model lists live at the top of the routing section in `src/background/background.js` (`HEAVY_CHAIN`, `LIGHT_CHAIN`) if you want to change them. A model that returns a quota or overload error is skipped for a while so later requests do not waste time on it.

## Privacy and security

- **Your key stays yours.** This repository contains no secrets. The key is stored in the browser's extension storage (optionally in memory only) and sent to Google in a request header. It is never written into code and never exposed to web pages.
- **Page text leaves your machine.** The text of the page you summarize is sent to Google's Gemini API. Do not use PageSage on pages you would not want processed by a third party, and check Google's current terms for how your API tier handles data.
- **Restrict your key.** In Google Cloud Console, limit the key to the Gemini API and set a billing spend cap.
- **Summaries are not authoritative.** Check commands against the source before you run them, especially anything destructive.

## Limitations

- Does not run on restricted pages (`about:` pages, addons.mozilla.org, the built-in PDF viewer).
- Free-tier Gemini quotas are small. Routing and fallback help, but you can still run out for the day.
- Very long pages may be truncated by the model.

## Project structure

```
pagesage/
├── src/                     Everything that ships in the extension
│   ├── manifest.json
│   ├── background/
│   │   └── background.js    Gemini requests, model routing, streaming
│   └── sidebar/
│       ├── sidebar.html
│       ├── sidebar.css
│       └── sidebar.js       UI, page extraction, Markdown renderer, settings
├── scripts/
│   ├── package.ps1          Build the upload zip (Windows)
│   └── package.sh           Build the upload zip (macOS / Linux)
├── CHANGELOG.md
├── LICENSE
└── README.md
```

## How it works

1. The sidebar injects a small function into the active tab that walks the DOM and returns clean text, with headings, code blocks and warning boxes marked up.
2. The sidebar sends that text to the background script over a port.
3. The background script picks a model chain, calls the Gemini streaming API and forwards text chunks back.
4. The sidebar renders the Markdown as it arrives and saves the finished summary for that page.

## Development

```
git clone <your-repo-url>
cd pagesage
```

Load `src/manifest.json` as a temporary add-on (see Install). After editing a file, click **Reload** next to the add-on in `about:debugging`.

Optional checks with Mozilla's tool: `npx web-ext lint --source-dir src`

### Building a release

1. Bump `version` in `src/manifest.json` and add an entry to `CHANGELOG.md`.
2. Build the upload zip:
   - Windows: `powershell -File scripts/package.ps1`
   - macOS / Linux: `./scripts/package.sh`
3. Go to the [Add-on Developer Hub](https://addons.mozilla.org/developers/), choose **New Version** on the add-on (or **Submit a New Add-on** the first time), pick **On your own** (unlisted) and upload `dist/pagesage-<version>.zip`. Answer **No** to the build-tools question: the source is shipped as written.
4. Download the signed `.xpi`, install it from `about:addons`, then tag the release and attach the `.xpi` on GitHub:
   ```
   git tag v<version>
   git push origin v<version>
   ```

Every upload needs a version higher than the last one. The add-on `id` in the manifest must never change, or Firefox will treat it as a different add-on and users lose their saved settings.

## License

[MIT](LICENSE)
