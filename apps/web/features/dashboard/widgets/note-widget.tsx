'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { z } from 'zod';
import { defineWidget, type WidgetProps } from '@clinic/domain/widgets';
import { registerWidget } from '../registry';

/**
 * The "text box" widget.
 *
 * This is the requirement about movable text boxes, implemented as a widget rather
 * than a separate mechanism — so it drags, resizes, persists and is added exactly
 * like every other widget on the dashboard.
 */

const noteConfigSchema = z.object({
  html: z.string().default(''),
});

type NoteConfig = z.infer<typeof noteConfigSchema>;

function NoteWidget({ config, onConfigChange }: WidgetProps<NoteConfig>) {
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
    <div className="relative h-full rounded-md ring-offset-2 ring-offset-white focus-within:ring-2 focus-within:ring-jade-600">
      {editor.isEmpty ? (
        <p className="pointer-events-none absolute inset-x-0 top-0 text-sm text-ink-500">
          {t('placeholder')}
        </p>
      ) : null}
      <EditorContent editor={editor} className="h-full" />
    </div>
  );
}

registerWidget(
  defineWidget<NoteConfig>({
    type: 'note',
    icon: 'StickyNote',
    defaultSize: 'md',
    defaultConfig: { html: '' },
    configSchema: noteConfigSchema,
    component: NoteWidget,
  }),
);
