'use client';

import dynamic from 'next/dynamic';
import { defineWidget, type WidgetProps } from '@clinic/domain/widgets';
import { registerWidget } from '../registry';
import { noteConfigSchema, type NoteConfig } from './note-config';

/**
 * The "text box" widget.
 *
 * This is the requirement about movable text boxes, implemented as a widget rather
 * than a separate mechanism — so it drags, resizes, persists and is added exactly
 * like every other widget on the dashboard.
 *
 * The editor itself is loaded on demand. Importing tiptap here would put
 * ProseMirror in the dashboard's bundle — and the dashboard is the home page, so
 * every practitioner downloaded a rich-text editor on sign-in whether or not
 * they had ever put a text box on the board. `ssr: false` because tiptap must
 * not render on the server anyway; the placeholder holds the widget's height so
 * the board does not jump while it arrives.
 */
const NoteEditor = dynamic(() => import('./note-editor'), {
  ssr: false,
  loading: () => <div className="h-full" />,
});

function NoteWidget(props: WidgetProps<NoteConfig>) {
  return <NoteEditor {...props} />;
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
