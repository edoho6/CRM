/**
 * Widget barrel.
 *
 * Importing this module is what populates the registry: each file below calls
 * `registerWidget()` at module scope. Adding a widget means creating the file and
 * adding one import here — nothing else in the dashboard changes.
 */
import './treatment-kpis';
import './note-widget';
import './appointment-widgets';
import './inventory-widgets';
import './overview-widgets';
import './revenue-widget';
import './tasks-widget';

export { getWidgetDefinition, listWidgetDefinitions, isWidgetRegistered } from '../registry';
