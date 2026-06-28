# PaperSmith Installation

## One-Command Install

After the repository is public on GitHub, run:

```bash
npm exec --yes --package=github:YOUR_GITHUB_USER/papersmith -- papersmith-install
```

Then restart Codex and start a new thread.

## Requirements

- Node.js 18.17 or newer
- Codex installed on the same machine

## What The Command Does

The command installs PaperSmith into the local Codex plugin marketplace:

- plugin files: `~/plugins/papersmith`
- marketplace file: `~/.agents/plugins/marketplace.json`
- Codex config entry: `papersmith@personal`

## Manual Start

If the editor is not already running:

```bash
cd ~/plugins/papersmith
npm run dev
```

Open:

```text
http://127.0.0.1:43227/
```

## Update

Run the same install command again.
