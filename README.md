# Fairy

An Obsidian plugin that automatically fills in placeholders in your notes using Gemini AI with Google Search grounding and your local vault as context.

<img width="1512" height="949" alt="image" src="https://github.com/user-attachments/assets/cf9372a1-c61b-453a-a3e3-fd6830317c02" />


## How it works

Write a placeholder anywhere in your note using natural language:

```
(insert alex hormozi's value equation here)
(add a summary of stoicism here)
(insert a short story about naruto here)
```

Fairy detects the placeholder, searches the web and your local vault, then shows an inline suggestion you can accept or reject — without leaving the editor.

## Features

- **Inline suggestions** — generated content appears right after the placeholder as ghost text
- **Approve or reject** — click ✓/✗ or press `Tab` / `Esc`
- **Source badges** — see where the content came from:
  - `📓 vault` — drawn from your personal notes via [qmd](https://github.com/tobi/qmd)
  - `🌐 web` — grounded in live web search via Gemini
  - `🧠 model` — generated from model knowledge only
- **Smart dedup** — rejected suggestions won't retrigger unless you edit the placeholder text
- **On/off toggle** — click the wand icon in the ribbon or use the command palette
- **Status bar** — live feedback (`waiting…`, `searching…`, `1 suggestion ready`, etc.)

## Requirements

- A [Google AI Studio](https://aistudio.google.com/) API key (free tier works)
- [qmd](https://github.com/tobi/qmd) CLI installed and a vault collection indexed (for local context)

## Setup

1. Install the plugin and enable it
2. Go to **Settings → Fairy → API Key** and paste your Gemini API key
3. Click **Test** to verify the connection
4. (Optional) Index your vault with qmd: `qmd collection add vault "**/*.md"` then `qmd update`

## Usage

### Auto mode (default)
Just write a placeholder and stop typing. After ~1.2 seconds Fairy searches and shows the suggestion inline.

### Manual mode
Open the command palette and run **Fairy: Fill all placeholders in current note**.

### Toggle on/off
Click the **wand icon** in the left ribbon, or run **Fairy: Toggle on/off** from the command palette.

### Accepting / rejecting
| Action | Keyboard | Mouse |
|--------|----------|-------|
| Accept | `Tab` | Click ✓ |
| Reject | `Esc` | Click ✗ |

Rejecting a suggestion permanently ignores that placeholder until you change its text.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| API Key | — | Google AI Studio API key |
| Model | `gemini-2.0-flash` | Gemini model to use |
| Trigger mode | Idle | Auto-trigger on idle or command only |
| Idle delay | 1200ms | How long to wait after typing stops |
| Max tokens | 800 | Maximum length of generated content |
| Support bracket syntax | Off | Also detect `[insert ... here]` |
| Include surrounding context | On | Send nearby text to Gemini for tone matching |
| Use vault context (qmd) | On | Search local notes and include relevant excerpts |

## Development

```bash
pnpm install
pnpm dev        # watch mode
pnpm build      # production build
pnpm test       # run tests (39 tests, no live API calls)
```
