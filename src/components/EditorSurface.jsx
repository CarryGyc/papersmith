import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { useEffect } from 'react'
import { selectionToAnchorPayload } from '../lib/editorAnchors.js'

const inactiveToolbarState = {
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isHeading1: false,
  isHeading2: false
}

export default function EditorSurface({ documentPayload, onChange, onSelectionChange }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ underline: false }), Underline],
    content: documentPayload.document,
    editorProps: {
      attributes: {
        class: 'paper-editor',
        'aria-label': 'Paper document editor'
      }
    },
    onUpdate({ editor }) {
      onChange({
        ...documentPayload,
        document: editor.getJSON()
      })
    },
    onSelectionUpdate({ editor }) {
      onSelectionChange(selectionToAnchorPayload(editor, documentPayload.version))
    }
  })
  const toolbarState = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return inactiveToolbarState
      return {
        isBold: editor.isActive('bold'),
        isItalic: editor.isActive('italic'),
        isUnderline: editor.isActive('underline'),
        isHeading1: editor.isActive('heading', { level: 1 }),
        isHeading2: editor.isActive('heading', { level: 2 })
      }
    }
  }) ?? inactiveToolbarState

  useEffect(() => {
    if (!editor) return
    const current = editor.getJSON()
    if (JSON.stringify(current) !== JSON.stringify(documentPayload.document)) {
      editor.commands.setContent(documentPayload.document, { emitUpdate: false })
    }
  }, [documentPayload.document, editor])

  if (!editor) return <section className="editor-surface">Loading editor...</section>

  return (
    <section className="editor-surface" aria-label="Paper editor">
      <div className="format-bar" role="toolbar" aria-label="Formatting toolbar">
        <button aria-label="Bold" aria-pressed={toolbarState.isBold} type="button" onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </button>
        <button aria-label="Italic" aria-pressed={toolbarState.isItalic} type="button" onClick={() => editor.chain().focus().toggleItalic().run()}>
          I
        </button>
        <button aria-label="Underline" aria-pressed={toolbarState.isUnderline} type="button" onClick={() => editor.chain().focus().toggleUnderline().run()}>
          U
        </button>
        <button
          aria-label="Heading 1"
          aria-pressed={toolbarState.isHeading1}
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </button>
        <button
          aria-label="Heading 2"
          aria-pressed={toolbarState.isHeading2}
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>
      </div>
      <div className="paper-page">
        <EditorContent editor={editor} />
      </div>
    </section>
  )
}
