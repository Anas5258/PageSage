# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

## [1.3] - 2026-11-09

### Added
- Inline settings panel that slides down from the toolbar, replacing the options tab.
- Warning headings are highlighted in amber.

### Changed
- Redesigned interface: slimmer toolbar, restrained dark theme, serif reading text, clearer headings, code and lists.
- TL;DR is shown as a callout above the summary.

### Removed
- Separate options page.

## [1.2]

### Added
- Model routing with automatic fallback. Heavy pages use `gemini-3.8-flash` then `gemini-3.6-flash`; other pages use `gemini-3.5-flash-lite` then `gemini-3.1-flash-lite`.
- Cooldowns for models that hit a quota or overload error.
- The answering model is shown in the status line.
- Model routing setting and `gemini-3.1-flash-lite` in the model list.

### Changed
- The prompt now requires every warning and caution from the page to be kept, and leaves out ordinary tips and example tables.

## [1.1]

First signed release.

### Added
- Markdown rendering of summaries (headings, lists, code, tables, checkboxes).
- TL;DR section ahead of the full summary.
- Live timer while a summary is generated.
- Summaries are remembered per page and restored when the sidebar is reopened.
- Automatic summarization when the sidebar opens on a page that has none.
- Gemini "thinking" level is now sent to the API.

### Changed
- Streaming uses server-sent events instead of a hand-rolled JSON splitter.
- The API key is sent in a request header instead of the URL.
- Requests are retried on temporary overload and keep the background script alive during long waits.
- Auto-generated and generic heading IDs are no longer used as section references.

### Fixed
- "Returned data was completely empty" error caused by how the extraction script was injected.

## [1.0]

### Added
- Initial release: summarize the current page in the Firefox sidebar using Gemini.
