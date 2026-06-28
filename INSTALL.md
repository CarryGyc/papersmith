# PaperSmith Installation

## One-Command Install

After the repository is public on GitHub, run:

```bash
npm exec --yes --package=github:CarryGyc/papersmith -- papersmith-install
```

Then restart Codex and start a new thread.

## Requirements

- Node.js 18.17 or newer
- Codex installed on the same machine

## Windows Note

The installer avoids a known Windows/Node 25 issue where directly spawning `npm.cmd` can fail with `spawnSync npm.cmd EINVAL`. It runs npm through npm's JavaScript CLI when possible.

If installation fails, check:

```powershell
node -v
npm -v
```

Then rerun the install command and capture the full error output.

## Clean First-Install Simulation

To simulate a first-time install without touching your real Codex profile:

```powershell
$installHome = 'E:\gyc_re\papersmith_install'
if (Test-Path -LiteralPath $installHome) { Remove-Item -LiteralPath $installHome -Recurse -Force }
$env:PAPERSMITH_INSTALL_HOME = $installHome
npm exec --yes --package=github:CarryGyc/papersmith -- papersmith-install
Remove-Item Env:PAPERSMITH_INSTALL_HOME
```

This creates:

- `E:\gyc_re\papersmith_install\plugins\papersmith`
- `E:\gyc_re\papersmith_install\.agents\plugins\marketplace.json`
- `E:\gyc_re\papersmith_install\.codex\config.toml`

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

