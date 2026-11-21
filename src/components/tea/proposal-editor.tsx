/**
 * Word-style rich text editor for tender proposals (TipTap).
 * The AI writes the first draft as HTML; the user edits it here and exports to Word.
 */
import { useEffect } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Columns3,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Rows3,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProposalEditorProps {
  /** Initial document. Later changes are ignored – remount (change `key`) to load a new one. */
  content: string;
  onChange: (html: string) => void;
  onReady?: (editor: Editor) => void;
}

export function ProposalEditor({ content, onChange, onReady }: ProposalEditorProps) {
  const editor = useEditor({
    immediatelyRender: false, // SSR: render on the client only
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight,
      Placeholder.configure({ placeholder: "Start writing the proposal…" }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    editorProps: { attributes: { class: "proposal-doc", spellcheck: "true" } },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  useEffect(() => {
    if (editor && onReady) onReady(editor);
  }, [editor, onReady]);

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {editor && <Toolbar editor={editor} />}
      <div className="max-h-[calc(100vh-15rem)] min-h-[60vh] overflow-y-auto bg-muted/60 px-2 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-[816px] rounded-sm bg-white px-6 py-10 text-neutral-900 shadow-md sm:px-16 sm:py-14">
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <p className="text-sm text-neutral-500">Loading editor…</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive("heading", { level: 1 })
        ? "h1"
        : e.isActive("heading", { level: 2 })
          ? "h2"
          : e.isActive("heading", { level: 3 })
            ? "h3"
            : "p",
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      highlight: e.isActive("highlight"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      left: e.isActive({ textAlign: "left" }),
      center: e.isActive({ textAlign: "center" }),
      right: e.isActive({ textAlign: "right" }),
      justify: e.isActive({ textAlign: "justify" }),
      inTable: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-card px-2 py-1.5"
    >
      <Btn label="Undo" onClick={() => chain().undo().run()} disabled={!s.canUndo}>
        <Undo2 />
      </Btn>
      <Btn label="Redo" onClick={() => chain().redo().run()} disabled={!s.canRedo}>
        <Redo2 />
      </Btn>
      <Sep />
      <select
        aria-label="Text style"
        value={s.block}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "p") chain().setParagraph().run();
          else chain().setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
        }}
        className="h-8 rounded-md border bg-background px-2 text-sm"
      >
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <Sep />
      <Btn label="Bold" active={s.bold} onClick={() => chain().toggleBold().run()}>
        <Bold />
      </Btn>
      <Btn label="Italic" active={s.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic />
      </Btn>
      <Btn label="Underline" active={s.underline} onClick={() => chain().toggleUnderline().run()}>
        <UnderlineIcon />
      </Btn>
      <Btn label="Strikethrough" active={s.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough />
      </Btn>
      <Btn label="Highlight" active={s.highlight} onClick={() => chain().toggleHighlight().run()}>
        <Highlighter />
      </Btn>
      <Sep />
      <Btn label="Align left" active={s.left} onClick={() => chain().setTextAlign("left").run()}>
        <AlignLeft />
      </Btn>
      <Btn label="Align center" active={s.center} onClick={() => chain().setTextAlign("center").run()}>
        <AlignCenter />
      </Btn>
      <Btn label="Align right" active={s.right} onClick={() => chain().setTextAlign("right").run()}>
        <AlignRight />
      </Btn>
      <Btn label="Justify" active={s.justify} onClick={() => chain().setTextAlign("justify").run()}>
        <AlignJustify />
      </Btn>
      <Sep />
      <Btn label="Bulleted list" active={s.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List />
      </Btn>
      <Btn label="Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered />
      </Btn>
      <Btn label="Quote" active={s.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote />
      </Btn>
      <Btn label="Horizontal line" onClick={() => chain().setHorizontalRule().run()}>
        <Minus />
      </Btn>
      <Sep />
      <Btn
        label="Insert table"
        onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <TableIcon />
      </Btn>
      {s.inTable && (
        <>
          <Btn label="Add row" onClick={() => chain().addRowAfter().run()}>
            <Rows3 />
          </Btn>
          <Btn label="Add column" onClick={() => chain().addColumnAfter().run()}>
            <Columns3 />
          </Btn>
          <Btn label="Delete row" onClick={() => chain().deleteRow().run()}>
            <Rows3 className="text-status-red" />
          </Btn>
          <Btn label="Delete column" onClick={() => chain().deleteColumn().run()}>
            <Columns3 className="text-status-red" />
          </Btn>
          <Btn label="Delete table" onClick={() => chain().deleteTable().run()}>
            <Trash2 className="text-status-red" />
          </Btn>
        </>
      )}
    </div>
  );
}

function Btn({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the text selection
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-muted disabled:opacity-40 [&_svg]:size-4",
        active && "bg-primary/10 text-primary",
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />;
}

/** Word-compatible document styles, shared by the editor page and the Word export. */
export const PROPOSAL_DOC_CSS = `
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111; }
  h1 { font-size: 20pt; margin: 0 0 12pt; }
  h2 { font-size: 14pt; margin: 18pt 0 6pt; }
  h3 { font-size: 12pt; margin: 12pt 0 4pt; }
  p { margin: 0 0 8pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0 12pt; }
  th, td { border: 1px solid #999; padding: 4pt 6pt; vertical-align: top; text-align: left; }
  th { background: #f0f0f0; font-weight: bold; }
  blockquote { border-left: 3px solid #bbb; margin: 8pt 0; padding-left: 10pt; color: #444; }
  mark { background: #fff59d; }
`;

/** Download the proposal as a Word document. */
export function downloadAsWord(html: string, fileName: string) {
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(fileName)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page { size: 21cm 29.7cm; margin: 2.5cm 2.2cm; } ${PROPOSAL_DOC_CSS}</style></head>
<body>${html}</body></html>`;
  const blob = new Blob(["﻿", doc], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copy the proposal as rich text, so pasting into Word keeps the formatting. */
export async function copyRichText(editor: Editor) {
  const html = editor.getHTML();
  const text = editor.getText({ blockSeparator: "\n\n" });
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
  } else {
    await navigator.clipboard.writeText(text);
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
