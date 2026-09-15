# הגדרות, צוות וחשבון — איך זה בנוי ומה נלמד בדרך הקשה

נטען אוטומטית כשנוגעים בקבצים בתיקייה הזאת. הכללים שחלים על כל הקוד נמצאים ב-`CLAUDE.md`
של השורש, והמפה של הריפו ב-`ARCHITECTURE.md`. כשמשנים משהו כאן, מעדכנים גם את הפסקה שלו.

- **צוות:** איש צוות שני מצטרף רק דרך הזמנה (`clinic_invitations`, migration 37): בעלים יוצר קישור
  ב-`/settings/team` ושולח אותו בעצמו (האפליקציה לא שולחת מייל); `/join/[token]` קורא את ההזמנה דרך
  `invitation_by_token` (anon) ומצטרף דרך `accept_invitation` (authenticated, בלי קליניקה קיימת).
  הרשמה/כניסה עם `?join=` נושאות את ה-token; אחרי אימות מייל הוא ב-`user_metadata.invitation_token`
  ו-`/welcome` מסיים את ההצטרפות. תפקיד ומצב של חבר משתנים רק ב-`set_membership_role/active`
  (לא על השורה של עצמך), וטריגר `memberships_keep_owner` לא מאפשר לקליניקה להישאר בלי בעלים.
  הרשאות לפי תפקיד עוד אינן: כל התפקידים רואים אותו דבר, ורק בעלים מנהלים צוות

- **אימות דו-שלבי (migration 39):** `profiles` לא יודע עליו; Supabase Auth מחזיק את הגורם (`auth.mfa_factors`)
  ומסמן סשן שנתן קוד ב-`aal = 'aal2'`. הנעילה במסד: `session_needs_second_factor()` אמת לחשבון עם גורם
  מאומת בסשן `aal1`, ושלושת העוזרים (`current_clinic_id`, `is_clinic_member`, `has_clinic_role`) וגם
  `current_membership_context` מחזירים כלום עד שהקוד ניתן — כל policy עוברת דרכם. באפליקציה:
  `lib/second-factor.ts` (`needsSecondFactor`), `/verify` אחרי הסיסמה, ההרשמה ב"איזור אישי ← אימות
  דו-שלבי" (`two-factor-settings.tsx`, `mfa.enroll/challengeAndVerify/unenroll`). אין קודי גיבוי: טלפון שאבד =
  מחיקת השורה ב-`auth.mfa_factors` מה-SQL editor (GO-LIVE.md). ה-smoke לא נרשם לגורם — חשבון הבדיקות
  היה ננעל בלי קוד; `test-results/probe-2fa.tmp.mjs` (מייצר TOTP בעצמו) הוא הבדיקה מקצה לקצה

- **מחיקת חשבון (migration 40):** `request_account_deletion(p_reason)` היא הדרך היחידה. מטופל בפורטל: משתמש ה-auth נמחק,
  השורה ב-`patient_portal_access` משוחררת ונסגרת, התיק הרפואי נשאר אצל הקליניקה. איש צוות: **tombstone** — sessions,
  identities, גורם האימות, האימייל והסיסמה נמחקים והחברות נמחקת, אבל שורת ה-`profiles` נשארת עם שם, תואר ומספר רישיון,
  כי `practitioner_id … on delete restrict` ורשומה רפואית חייבת לומר מי טיפל (טלפון ותמונה נמחקים). בעלים יחיד עם
  מטופלים → `needs_review` (`clinic_has_records`); עם צוות אחר ובלי בעלים נוסף → `clinic_needs_owner`; קליניקה ריקה →
  נמחקת (הטריגר `memberships_keep_owner` מכבד את `herbalist.deleting_account` שהפונקציה מציבה). הבקשות ב-
  `account_deletion_requests` (בלי FK ל-auth — השורה שורדת את המשתמש; אימייל נשמר רק לבקשה שממתינה), נקראות ונסגרות
  ב-`/platform` (`platform_deletion_requests`, `platform_resolve_deletion_request`). UI: `features/settings/delete-account.tsx`
  (איזור אישי, הכרטיס האחרון, אישור בהקלדת שם הקליניקה), בפורטל `/account` מהפוטר; הדף הציבורי `/delete-account`.
  בדיקה: `supabase/tests/account_deletion.sql` — להריץ אחרי כל שינוי במחיקה או ב-FK ל-`profiles`
