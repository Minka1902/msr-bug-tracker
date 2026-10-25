import { TaskItem, TaskList } from '@tiptap/extension-list';
import Image from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  SquareCode,
  Strikethrough,
} from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';

export interface UploadedFile {
  url: string;
  name: string;
  mime: string;
}

interface RichTextEditorProps {
  value: string;
  onChange?: (markdown: string) => void;
  onSave?: (markdown: string) => void;
  onUpload?: (files: File[]) => Promise<UploadedFile[]>;
  onSubmit?: () => void;
  placeholder?: string;
  editable?: boolean;
  autoFocus?: boolean;
  minHeight?: number;
  toolbar?: boolean;
  className?: string;
  'aria-label'?: string;
}

const TOOLS: {
  label: string;
  icon: ReactNode;
  run: (editor: Editor) => void;
  active?: (editor: Editor) => boolean;
}[] = [
  {
    label: 'Bold',
    icon: <Bold />,
    run: (editor) => editor.chain().focus().toggleBold().run(),
    active: (editor) => editor.isActive('bold'),
  },
  {
    label: 'Italic',
    icon: <Italic />,
    run: (editor) => editor.chain().focus().toggleItalic().run(),
    active: (editor) => editor.isActive('italic'),
  },
  {
    label: 'Strikethrough',
    icon: <Strikethrough />,
    run: (editor) => editor.chain().focus().toggleStrike().run(),
    active: (editor) => editor.isActive('strike'),
  },
  {
    label: 'Inline code',
    icon: <Code />,
    run: (editor) => editor.chain().focus().toggleCode().run(),
    active: (editor) => editor.isActive('code'),
  },
  {
    label: 'Heading',
    icon: <Heading2 />,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    active: (editor) => editor.isActive('heading'),
  },
  {
    label: 'Bullet list',
    icon: <List />,
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
    active: (editor) => editor.isActive('bulletList'),
  },
  {
    label: 'Numbered list',
    icon: <ListOrdered />,
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
    active: (editor) => editor.isActive('orderedList'),
  },
  {
    label: 'Checklist',
    icon: <ListChecks />,
    run: (editor) => editor.chain().focus().toggleTaskList().run(),
    active: (editor) => editor.isActive('taskList'),
  },
  {
    label: 'Quote',
    icon: <Quote />,
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
    active: (editor) => editor.isActive('blockquote'),
  },
  {
    label: 'Code block',
    icon: <SquareCode />,
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    active: (editor) => editor.isActive('codeBlock'),
  },
  {
    label: 'Link',
    icon: <Link2 />,
    run: (editor) => {
      const previous = editor.getAttributes('link').href as string | undefined;
      const href = window.prompt('Link URL', previous ?? 'https://');
      if (href === null) return;
      if (!href) editor.chain().focus().unsetLink().run();
      else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    },
    active: (editor) => editor.isActive('link'),
  },
];

export function RichTextEditor({
  value,
  onChange,
  onSave,
  onUpload,
  onSubmit,
  placeholder = 'Write something…',
  editable = true,
  autoFocus,
  minHeight = 96,
  toolbar = true,
  className,
  ...aria
}: RichTextEditorProps) {
  const insertFiles = async (editor: Editor, files: File[], position?: number) => {
    if (!uploadRef.current || !files.length) return false;
    try {
      const uploaded = await uploadRef.current(files);
      const content = uploaded.map((file) =>
        file.mime.startsWith('image/')
          ? { type: 'image', attrs: { src: file.url, alt: file.name } }
          : {
              type: 'paragraph',
              content: [
                { type: 'text', text: file.name, marks: [{ type: 'link', attrs: { href: file.url } }] },
              ],
            },
      );
      if (position === undefined) editor.chain().focus().insertContent(content).run();
      else editor.chain().focus().insertContentAt(position, content).run();
    } catch (error) {
      toast.error(errorMessage(error));
    }
    return true;
  };

  const uploadRef = useRef(onUpload);
  const callbacks = useRef({ onChange, onSave, onSubmit });
  const lastSaved = useRef(value);
  const editor = useEditor({
    editable,
    autofocus: autoFocus ? 'end' : false,
    content: value,
    contentType: 'markdown',
    extensions: [
      StarterKit.configure({ link: { openOnClick: !editable, autolink: true, defaultProtocol: 'https' } }),
      Markdown,
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    editorProps: {
      attributes: {
        class: 'rich-text outline-none',
        'aria-label': aria['aria-label'] ?? 'Rich text editor',
        role: 'textbox',
        'aria-multiline': 'true',
      },
      handlePaste: (view, event) => {
        const files = [...(event.clipboardData?.files ?? [])];
        if (!files.length || !uploadRef.current) return false;
        void insertFiles(editorRef.current!, files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = [...((event as DragEvent).dataTransfer?.files ?? [])];
        if (!files.length || !uploadRef.current) return false;
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertFiles(editorRef.current!, files, position);
        return true;
      },
      handleKeyDown: (_view, event) => {
        if (callbacks.current.onSubmit && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          callbacks.current.onSubmit();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) =>
      callbacks.current.onChange?.(current.isEmpty ? '' : current.getMarkdown()),
    onBlur: ({ editor: current }) => {
      const markdown = current.isEmpty ? '' : current.getMarkdown();
      if (callbacks.current.onSave && markdown !== lastSaved.current) {
        lastSaved.current = markdown;
        callbacks.current.onSave(markdown);
      }
    },
  });
  const editorRef = useRef(editor);
  const activeTools = useEditorState({
    editor,
    selector: ({ editor: current }) => (current ? TOOLS.map((tool) => !!tool.active?.(current)) : []),
  });

  useEffect(() => {
    uploadRef.current = onUpload;
    editorRef.current = editor;
    callbacks.current = { onChange, onSave, onSubmit };
  }, [onUpload, editor, onChange, onSave, onSubmit]);

  useEffect(() => {
    if (!editor || editor.isFocused || value === lastSaved.current) return;
    lastSaved.current = value;
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  return (
    <div
      className={cn(
        'group/editor flex flex-col rounded-control',
        editable &&
          'border border-border bg-surface focus-within:border-accent focus-within:ring-3 focus-within:ring-ring/30',
        className,
      )}
    >
      {editable && toolbar && editor && (
        <div className="flex flex-wrap gap-0.5 border-b border-border px-1.5 py-1">
          {TOOLS.map((tool, index) => (
            <button
              key={tool.label}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              aria-pressed={activeTools?.[index] ?? false}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => tool.run(editor)}
              className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-muted hover:text-text aria-pressed:bg-accent-soft aria-pressed:text-accent-text [&_svg]:size-3.5"
            >
              {tool.icon}
            </button>
          ))}
        </div>
      )}
      <EditorContent
        editor={editor}
        style={{ minHeight: editable ? minHeight : undefined }}
        className={cn('text-sm', editable && 'px-3 py-2')}
      />
    </div>
  );
}
