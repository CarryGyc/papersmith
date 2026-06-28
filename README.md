# PaperSmith

PaperSmith is a local Codex plugin for academic writing. It connects Codex to a browser-based paper editor, supports Codex-to-editor text sync, local text formatting, selection comments, and Markdown feedback export for revision.

## Install From GitHub

After this project is pushed to GitHub, other users can install it with one command:

```bash
npm exec --yes --package=github:YOUR_GITHUB_USER/papersmith -- papersmith-install
```

Replace `YOUR_GITHUB_USER/papersmith` with the real GitHub repository.

The installer will:

- copy PaperSmith into `~/plugins/papersmith`;
- run `npm install --include=dev` in that plugin directory;
- add or update `~/.agents/plugins/marketplace.json`;
- enable `papersmith@personal` in `~/.codex/config.toml`.

Restart Codex after installation, then start a new thread and ask Codex to open PaperSmith.

## Update

Run the same command again:

```bash
npm exec --yes --package=github:YOUR_GITHUB_USER/papersmith -- papersmith-install
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

Current MCP tools:

- `insert_papersmith_text`: append Codex-generated text to the editor;
- `get_papersmith_selection`: read the current PaperSmith selection.

## Distribution Notes

The one-command GitHub installer is the practical path for personal or small-team distribution.

Codex also supports marketplace sources such as GitHub repositories via `codex plugin marketplace add owner/repo`, but that expects a marketplace catalog layout. Keep this installer path as the default until PaperSmith is repackaged into a dedicated marketplace repository or submitted through a formal plugin marketplace flow.
