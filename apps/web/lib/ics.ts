/**
 * The iCalendar writer moved to the domain package, where the portal and the
 * public confirmation page can share it; this keeps the app's old import
 * path and its tests intact.
 */
export { buildIcs, icsDate, icsEscape, icsFold, ICS_DOWNLOAD_HEADERS } from '@clinic/domain/ics';
export type { IcsEvent } from '@clinic/domain/ics';
