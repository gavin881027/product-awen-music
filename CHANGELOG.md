# Changelog

All notable changes to **Awen Music Matrix** (`hiawen.com/music/`).
Format follows [Keep a Changelog](https://keepachangelog.com/).

---

## [V2.3] — 2026-08-25 — Suno Recipe Bridge

### Added
- **Suno recipe bridge panel** ordered like Suno Advanced Create: Lyrics route → Style → Exclude Styles → Weirdness → Style Influence → Duration → Song Title → Workspace.
- **Mutually exclusive Lyrics routes**: experimental structure Prompt or stable Instrumental, with no contradictory “paste Lyrics + enable Instrumental” workflow.
- **Per-song and per-track recipe snapshots**, including album duration totals and shared album Workspace suggestions.
- **Schema v2 library records** with automatic migration of existing v1 favorites.
- **Local OpenAI-compatible provider proxy** bound to `127.0.0.1`, with configurable providers and OpenCode Go presets.
- **Local-first favorites** with optional GitHub repository synchronization.

### Changed
- Publishing assets are grouped into collapsible Cover / Video / Thumbnail / metadata sections so Suno inputs remain visually primary.
- Study With Me long-form constraints now favor restrained dynamics, sparse variation, no dramatic climax, gentle outros, and warm analog texture.
- Legacy style terms (`late climax`, `high fidelity`, `studio quality`) migrate to lower-distraction equivalents.
- Local static responses disable caching so provider and UI fixes appear immediately after reload.

### Verified
- Prompt and Instrumental routes were mapped against the live Suno Advanced Create form without clicking Create or spending credits.
- Existing four-song library recipes reload with Style, Exclude, 50/70/5:00 controls, title, and Workspace intact.
- Narrow layouts no longer produce page-level horizontal overflow.

---

## [V2.1] — 2026-06-20 — Robustness & UX polish

### 🔴 Bug fixes
- **localStorage in private mode** — wrapped 4 token-related calls in `safeLS` so Safari Private Mode and quota errors no longer crash the AI flow.
- **30 s fetch timeout** — the AI Worker call now aborts after 30 s with a friendly error toast (was: spinner-of-doom).
- **AI toggle no longer logs you out** — toggling AI off used to silently delete the access token; now it's purely a UI toggle.

### 🟠 UX
- **Custom token modal** — replaced the native `window.prompt()` with a themed modal: show/hide password, Enter to submit, Esc/backdrop to cancel.
- **Toast notifications** — AI failures now appear as a non-blocking top-right toast with a "Retry" button. Replaces `window.alert()`.

### 🟡 Performance
- **AlbumCard metadata memoized** — `metadataGen()` was recomputed on every parent re-render; now wrapped in `React.useMemo([data, base])`.
- **Debounced localStorage writes** — persistence was firing on every keystroke; now coalesced to one write per 400 ms.

### ♿ Accessibility & metadata
- Dynamic `<html lang>` — syncs to current UI language on toggle.
- Inline-SVG **favicon**, `<meta name="description">`, **Open Graph** + Twitter Card tags so links unfurl properly on Discord / X / Slack.
- `aria-pressed` on mode-tab buttons.
- `aria-label` on status-cycle badges.

### 📝 Process
- Added **FIX_LOG.md** to capture lessons + standing rules so the same class of bug doesn't return.

---

## [V2.0] — 2026-06-20 — Universe Engine

Major release: transformed the tool from a single-song prompt generator into a **world-building engine**.

### Added
- **4 new visual dimensions** (matrix now has 11): Character, Light Source, Color Palette, Narrative Motif.
- **Three-layer matrix**: Content / Production / Visual Identity, visually grouped.
- **Palette swatch chips** — palette options render as actual color gradients.
- **Cover Prompt V2** — formula-based: Character + Environment + Motif + Light + Palette + Camera + Mood.
- **Video Prompt V2** — 16:9 looping background, motif-in-motion + same light + palette + dust + drift.
- **Thumbnail Rules** — YouTube 1280×720 consistency rules (locked Awen channel look).
- **Awen Signature Elements** — Tier 1 (always) + Tier 2/3 (context) auto-injected into every cover.
- **Visual DNA panel** in AlbumCard — character / light / palette / motif at a glance.
- **Universe Builder** (inline in visual layer) — save and reuse named visual identities across albums.
- **Active universe strip** above the album feed, showing the current universe + linked series.
- **Album Series System** — albums are tagged with the active universe ID and grouped under it in the Universe Builder.
- **Track Role System** — 10 functional roles (Awakening → Closure) sampled proportionally to track count; role modifiers auto-injected into Suno prompts.
- **Motif Recurrence System** — auto-derived four-note core motif from the instrument; introduced in Track 1, varied at mid-album, returned in the final track. Tracks show "intro / variation / return" badges.
- **Album DNA panel** — Core Motif / Core Texture / Core Space / Core Emotion.
- **Metadata Generator** — auto-generated YouTube description (with hashtags), Spotify description, Tags/Keywords list. All included in the "copy full album" output.
- **Smart Decompose** — paste any Suno style string (or YouTube lo-fi description) and the tool auto-fills the matrix by best-matching every dimension.
- **File-naming generator** — consistent filename per song (`AWN-042_Library_Night_Calm_FeltPiano_60bpm.mp3`) and per album track (`ALB-007_T01_Awakening_NightLibrary.mp3`). Saves real time when bulk-downloading from Suno.
- **Episode title template** — auto-numbered YouTube title (`EP-042 · Library Night · Lo-fi Study Music · Felt Piano · Awen`) for both songs and albums.
- **Quick Remix button** on every song card — fills the matrix with that song's recipe and switches to Pick mode for fast variant generation.
- **Tab intro panels** — every tab (Pick / Shuffle / Decompose / Album) now opens with a "what / features / how to use" panel. Dismissible per-tab (state persisted to localStorage).
- **Tooltips** on mode buttons, generate/shuffle buttons, lock icons, AI toggle, status badges.
- **Enriched "Copy full album"** — now includes Album DNA, Visual Identity, Thumbnail Rules, YouTube + Spotify descriptions, and Tags in a single paste.

### Changed
- **Suno style box** now includes a production/texture layer (warm tape saturation, vinyl crackle, drum treatment, room reverb, low-pass) — the layer Suno actually responds to.
- Cover and video prompts split into **two separate fields** (was: one combined "COVER / VIDEO" prompt).
- Wordmark changed from "awen yang" to "awen music".

---

## Architecture & deployment notes

- **Live site:** `hiawen.com/music/` — served from `music/index.html` in the [awenstudio.github.io](https://github.com/awenstudio/awenstudio.github.io) repo.
- **Stack:** Single HTML file with inline `<script type="text/babel">` blocks transpiled by `@babel/standalone` in the browser. React 18.3.1.
- **AI backend:** Cloudflare Worker at `awen-music-api.ywhang1995.workers.dev`. Calls require an access token (stored in `localStorage.awen_music_token`).
- **Offline fallback:** If the AI call fails or the user turns AI off, deterministic template engines (`fallbackPrompt`, `fallbackAlbum`) in the data layer produce equivalent (slightly less varied) output. The app never breaks when AI is unavailable.
- **Storage keys:**
  - `awen_matrix_state_v1` — full app state (mode, sel, locks, songs, albums, etc.)
  - `awen_universes_v1` — saved universes
  - `awen_tab_intro_dismissed_v1` — which tab intros the user has hidden
  - `awen_music_token` — AI access token
  - `awen_guide_seen_v1` — first-run guide flag

---

## Known limitations / TODOs

- **In-browser Babel** — first load transpiles every script, ships ~1 MB of Babel runtime. For production scale, migrate to Vite (see `HANDOFF.md` in the `awen-music` repo).
- **No automated tests** — `parseStyleString()` and the album generators are pure functions that would be cheap to test. Add `vitest` or similar.
- **Mobile layout** — 11-column matrix is cramped under ~720 px. Should collapse the visual-identity layer into an accordion on narrow screens.
- **Universe Engine V3 (from PDF spec)** — Lore System, Scene Timeline Generator, Character Consistency for image gen, and a true Spotify packaging module are still future work.
