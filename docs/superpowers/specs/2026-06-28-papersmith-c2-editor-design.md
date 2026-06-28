# PaperSmith C2 Editor Design

Date: 2026-06-28
Status: Draft for user review
Visual target: `E:/gyc_re/papersmith/.superpowers/brainstorm/codex-47596-1782616841/content/papersmith-concept-c2-premium.png`

## Product Intent

PaperSmith is a Cowart-like Codex companion, but the browser surface is a rich text editor instead of an infinite canvas. Codex writes or revises academic text, the result appears in the right-side browser viewport, and the user can directly edit the document, adjust formatting, and annotate selected text.

The selected direction is C2: a premium dark tool shell around an ivory academic paper surface. It should feel closer to a refined writing/design tool than a generic dashboard.

## Locked Visual Direction

Keep these C2 elements:

- Dark graphite application shell with subtle hairline dividers.
- Ivory paper editor surface with editorial typography.
- Narrow left tool rail with icon-first controls.
- Compact top command strip with Codex sync state and version/status.
- Gold or parchment text selection highlight with anchored annotation lines.
- Floating annotation composer near the selected text.
- Right inspector panel for annotation details, text metadata, citations, and anchor information.
- Artistic `PaperSmith` wordmark in the top-left, implemented as a real brand component rather than using the generated mockup image.

Avoid:

- Word-like ribbon clutter.
- A dashboard full of cards.
- Decorative blobs, neon, bokeh, or marketing hero treatment.
- Treating the generated image as the app UI.
- Oversized panels that reduce the usable writing area.

## First Build Scope

The first implemented screen should be one working editor workspace:

- Open a local PaperSmith editor for the active Codex project.
- Load or create a project-local document state.
- Let Codex append or replace editor content through a local API or MCP tool.
- Let the user edit text directly in the browser.
- Let the user change basic formatting: paragraph, heading, bold, italic, underline, font size.
- Let the user select text and create annotations tied to that range.
- Persist document, selection, annotations, and lightweight view state project-locally.

Out of scope for the first build:

- Multi-document library.
- Real citation database integration.
- Track changes/review mode.
- Export to DOCX/PDF.
- Multi-user collaboration.
- Full manuscript template system.

## Screen Anatomy

### Left Rail

The left rail is narrow and persistent. It should use icon buttons with tooltips:

- New or insert block.
- Annotate.
- Format.
- Cite.
- Outline.
- Figures or assets placeholder.
- Export placeholder.
- Settings/profile at the bottom.

Only implemented controls should perform actions. Placeholder controls can appear disabled if they clarify future structure.

### Top Command Strip

The top strip is compact and calm:

- Artistic `PaperSmith` wordmark at the far left.
- Command/search field for future command palette behavior.
- Codex sync pill showing idle/syncing/synced/error.
- Version/save status.

The first build can make the command field non-functional, but sync state must reflect real editor persistence/API activity.

### Editor Surface

The central surface is the primary product:

- Ivory page on a dark shell.
- Academic article content with title, author line, section headings, paragraphs, inline citations, and selected text.
- Comfortable line length, roughly 60-75 characters.
- Body text 15-17px depending on chosen serif.
- Stable page width and scroll behavior.

Implementation should use a real rich text editor model, not a textarea.

Recommended editor foundation: TipTap/ProseMirror, because Cowart already uses ProseMirror-related dependencies and the feature needs selection, marks, anchors, and structured document JSON.

### Annotation Composer

When the user selects text and activates annotate:

- Show a floating composer anchored near the selection.
- Pre-fill the anchor preview with the selected text.
- Let the user enter a comment and choose a simple annotation type.
- Save an annotation record with range anchor metadata.
- Render the selected range with gold highlight.

If the selected range cannot be restored exactly after edits, preserve the annotation and show it as needing re-anchor instead of silently dropping it.

### Right Inspector

The right panel shows the selected annotation or selected text state:

- Annotation type.
- Comment.
- Suggested edit placeholder.
- Citations placeholder.
- Anchor preview.
- Created time and author placeholder.

The panel should not dominate the editor. It is a contextual inspector, not a document library.

## Codex Sync Model

PaperSmith should follow the Cowart architectural pattern:

- A local Vite/React web service serves the editor UI.
- Project-local state is stored under a project folder such as `papersmith/` or `documents/papersmith/`.
- The browser saves user edits through local HTTP endpoints.
- Codex writes new content through MCP tools or local HTTP endpoints.
- The browser listens for remote document changes via SSE and refreshes without full reload.

Initial API shape:

- `GET /api/document` returns the current document JSON, annotations, and metadata.
- `PUT /api/document` saves the editor state and broadcasts a document-changed event.
- `GET /api/document-events` streams SSE updates.
- `GET /api/selection` returns the latest selected text/range metadata.
- `PUT /api/selection` saves the latest selected text/range metadata.
- `POST /api/annotations` creates an annotation for a selection.

Initial MCP tool shape:

- `open_papersmith_editor`: start/open the local editor for the current project.
- `insert_papersmith_text`: insert or append Codex output into the document.
- `get_papersmith_selection`: read the currently selected text and annotation context.
- `create_papersmith_annotation`: create an annotation from Codex or user-provided text.

The exact tool names can change during implementation, but the capability boundaries should stay stable.

## Persistence

Use project-local JSON so work survives browser refreshes and Codex restarts.

Suggested files:

- `papersmith/document.json`
- `papersmith/annotations.json`
- `papersmith/selection.json`
- `papersmith/view-state.json`

Writes must be atomic: write to a temp file and rename.

Do not store secrets, API keys, or unrelated Codex conversation logs in PaperSmith state.

## Brand Wordmark

The `PaperSmith` wordmark is a key part of the selected direction. Requirements:

- It must read exactly `PaperSmith`.
- It should feel calligraphic, artistic, and premium.
- It should remain legible at sidebar/header scale.
- It should be implemented as a code-native brand component using a bundled font, system font stack, or local asset created specifically for the wordmark.

Do not rely on the generated C2 bitmap for the wordmark in the working app.

## Error Handling

The editor should handle:

- Empty document state by creating a starter academic paper.
- Malformed document JSON by showing a recoverable load error.
- Save failures by showing sync error state and preserving local editor content.
- Remote updates while the user has unsaved edits by preserving local edits and marking remote content as pending merge.
- Lost annotation anchors by showing the annotation as detached/re-anchor needed.

## Testing And Verification

Required verification before calling the implementation done:

- Unit tests for document API validation and atomic persistence.
- Unit tests for annotation creation and selection metadata normalization.
- Browser test for opening the editor and loading starter content.
- Browser test for editing text and seeing persisted state after reload.
- Browser test for selecting text and creating an annotation.
- Browser test for Codex-style text insertion through the local API or MCP-adjacent helper.
- Visual verification against the C2 target at desktop width.

The first implementation should prioritize the complete main workflow over placeholder breadth: open editor, sync Codex text, edit text, annotate selection, persist and reload.

## Spec Self-Review

- No unresolved placeholder requirements remain.
- The design is scoped to a single first build, not the full future plugin.
- The selected C2 visual target is preserved without requiring generated bitmap UI.
- Data flow matches the Cowart local service pattern but substitutes document/annotation state for canvas state.
- Error handling and verification criteria are concrete enough to drive an implementation plan.
