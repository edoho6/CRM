/**
 * Widget barrel.
 *
 * Importing this module is what populates the registry: each file below calls
 * `registerWidget()` at module scope. Adding a widget means creating the file and
 * adding one import here — nothing else in the dashboard changes.
 */
import './note-widget';
import './appointment-widgets';
import './inventory-widgets';
import './overview-widgets';

export { getWidgetDefinition, listWidgetDefinitions, isWidgetRegistered } from '../registry';
