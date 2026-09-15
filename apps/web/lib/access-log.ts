/**
 * The access-log helper moved to the shared data package so the portal records
 * a patient reading their own file by the same rule. This path stays for the
 * places that import it here.
 */
export { logRecordAccess, type AuditableTable } from '@clinic/db/access-log';
