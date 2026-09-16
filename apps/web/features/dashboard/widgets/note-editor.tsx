'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { WidgetProps } from '@clinic/domain/widgets';
import type { NoteConfig } from './note-config';

/**
 * The text box's editor, in its own module so that it can be loaded on demand.
 *
 * Tiptap and ProseMirror are about two hundred kilobytes, and the widget barrel
 * that registers every dashboard widget used to import them directly — which
 * meant the editor shipped with the *home page*, to every practitioner, whether
 * or not they had ever added a text box. `note-widget.tsx` now registers the
 * widget without this file, and pulls it in only when one is on the board.
 */
export default function NoteEditor({ config, onConfigChange }: WidgetProps<NoteConfig>) {
  const t = useTranslations('widgets.note');

  const editor = useEditor({
    extensions: [StarterKit],
    content: config?.html ?? '',
    // Tiptap must not render during SSR, or hydration mismatches on every load.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'tiptap-content min-h-full text-sm text-ink-800 outline-none',
      },
    },
    onUpdate: ({ editor: instance }) => {
      onConfigChange({ html: instance.getHTML() });
    },
  });

  // Keep the editor in step when the config changes from outside (for example a
  // layout reset), without clobbering what the user is currently typing.
  useEffect(() => {
    if (!editor) return;
    const incoming = config?.html ?? '';
    if (!editor.isFocused && incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [editor, config?.html]);

  if (!editor) {
    return <div className="h-full" />;
  }

  return (
    // The focus ring is on the wrapper, not the editable area. Tiptap's own
    // outline is suppressed (a caret inside a box that is itself outlined looks
    // like an error state), so without this the widget is the one place in the
    // app a keyboard user lands with nothing to see. `focus-within` puts the
    // ring back on the frame, where a text area's focus belongs.
    <div className="relative h-full rounded-md ring-offset-2 ring-offset-white focus-within:ring-2 focus-within:ring-focus-ring">
      {editor.isEmpty ? (
        <p className="pointer-events-none absolute inset-x-0 top-0 text-sm text-ink-500">
          {t('placeholder')}
        </p>
      ) : null}
      <EditorContent editor={editor} className="h-full" />
    </div>
  );
}
