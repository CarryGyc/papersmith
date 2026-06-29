# PaperSmith

PaperSmith is a local Codex plugin for academic writing. It connects Codex to a browser-based paper editor, supports Codex-to-editor text sync, local text formatting, selection comments, and Markdown feedback export for revision.

## Install From GitHub

Install the latest PaperSmith release from GitHub with one command:

```bash
npm exec --yes --package=github:CarryGyc/papersmith -- papersmith-install
```

The installer will:

- copy PaperSmith into `~/plugins/papersmith`;
- run `npm install --include=dev` in that plugin directory;
- add or update `~/.agents/plugins/marketplace.json`;
- enable `papersmith@personal` in `~/.codex/config.toml`.

Restart Codex after installation, then start a new thread and ask Codex to open PaperSmith. Existing
threads can keep the old skill registry in memory, so use a fresh thread when testing an update.

### Windows notes

PaperSmith's installer invokes npm through npm's JavaScript CLI when possible. This avoids a Windows issue seen with Node 25 where directly spawning `npm.cmd` can fail with `spawnSync npm.cmd EINVAL`.

If the command fails on Windows, first check:

```powershell
node -v
npm -v
```

Then rerun the install command and share the full error output.

### Clean install simulation

To test PaperSmith as if it were being installed on a fresh machine without touching your real Codex home, use a temporary install home:

```powershell
$installHome = 'E:\gyc_re\papersmith_install'
New-Item -ItemType Directory -Force -Path $installHome | Out-Null
Get-ChildItem -LiteralPath $installHome -Force | Remove-Item -Recurse -Force
$env:PAPERSMITH_INSTALL_HOME = $installHome
npm exec --yes --package=github:CarryGyc/papersmith -- papersmith-install
Remove-Item Env:PAPERSMITH_INSTALL_HOME
```

That writes the simulated plugin, marketplace, and Codex config under `E:\gyc_re\papersmith_install` instead of the real user profile.

## Update

Run the same command again:

```bash
npm exec --yes --package=github:CarryGyc/papersmith -- papersmith-install
```

The installer only replaces the target directory when it can verify that the existing target is already the `papersmith` plugin.

## Local Development

```bash
npm install
npm run dev
```

The editor runs at:

```text
http://127.0.0.1:43227/
```

Useful commands:

```bash
npm run test:run
npm run build
npm run test:e2e
npm run papersmith:mcp
```

## Plugin Contents

PaperSmith bundles:

- `.codex-plugin/plugin.json` for Codex plugin metadata;
- `.mcp.json` and `mcp/server.mjs` for local MCP tools;
- `skills/` with Chinese PaperSmith workflows;
- the Vite React editor and local API middleware.

PaperSmith currently implements its live writing behavior through skills and MCP tools. The local
plugin validator still rejects manifest-level `hooks`, so the plugin does not ship a `hooks` field.
When PaperSmith is open, `papersmith-live-draft-sync` instructs Codex to show the manuscript text
first in chat, sync only that manuscript text to PaperSmith, and place any extra explanation after it.
In PaperSmith writing mode, requests such as "给我正文", "发给我 introduction", or "输出上一版段落"
are treated as manuscript-body output and should sync unless the user explicitly asks for chat-only output.
`Copy feedback` copies a complete `papersmith-feedback.md` Markdown document to the clipboard, with
download as a fallback when clipboard access is blocked. The document includes the current draft's
full text, local comments mapped to their marked text, the overall comment, and an explicit
instruction for Codex to return the revised full draft rather than a comment-only reply.

Current MCP tools:

- `insert_papersmith_text`: sync Codex-generated text into the editor as a new draft version;
- `get_papersmith_selection`: read the current PaperSmith selection.

## Distribution Notes

The one-command GitHub installer is the practical path for personal or small-team distribution.

Codex also supports marketplace sources such as GitHub repositories via `codex plugin marketplace add owner/repo`, but that expects a marketplace catalog layout. Keep this installer path as the default until PaperSmith is repackaged into a dedicated marketplace repository or submitted through a formal plugin marketplace flow.


