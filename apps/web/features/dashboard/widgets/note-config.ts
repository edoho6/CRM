import { z } from 'zod';

/**
 * The text box's stored shape, kept apart from the editor that edits it.
 *
 * The registry needs the schema to validate a saved widget; the editor needs
 * two hundred kilobytes of ProseMirror. Keeping them in separate modules is
 * what lets the dashboard register the widget without loading the editor.
 */
export const noteConfigSchema = z.object({
  html: z.string().default(''),
});

export type NoteConfig = z.infer<typeof noteConfigSchema>;
