# פורטל המטופלים — איך זה בנוי ומה נלמד בדרך הקשה

נטען אוטומטית כשנוגעים בקבצים בתיקייה הזאת. הכללים שחלים על כל הקוד נמצאים ב-`CLAUDE.md`
של השורש, והמפה של הריפו ב-`ARCHITECTURE.md`. כשמשנים משהו כאן, מעדכנים גם את הפסקה שלו.

- **הפורטל:** כל מסך מחובר עטוף ב-`portal-shell.tsx` (קישור דילוג, כותרת, `PortalNav`,
  `main#main-content`, פוטר עם שפה ויציאה) — לא `<main>` משלו. שאלון = מסך משלו
  (`forms/[id]`), בשלבים לפי הסעיפים שהקליניקה כתבה (`@clinic/domain/forms/steps`,
  נבדק): אימות לכל שלב, מלא בשליחה, וחזרה לשלב הבעייתי. הסכמה נפתחת לאישור רק אחרי
  גלילה לסוף המסמך. קובץ יומן (`.ics`) נכתב ב-`@clinic/domain/ics` ומוגש משלושה
  מקומות: פיד היומן, `/api/appointments/[id]/ics` בפורטל (RLS), ו-`/api/confirm/[token]/ics`
  הציבורי (אותו token ואותה הגבלת קצב כמו הדף)

- **דלת לבודקי החנויות בפורטל:** דף הכניסה מקבל גם את **הקוד** מאותו מייל (`signInWithCode` → `verifyOtp` type email;
  תבנית ה-Magic Link ב-Supabase חייבת להכיל `{{ .Token }}`), ובתחתית `<details>` "כניסה עם סיסמה": `signInWithPassword`
  ואז `portal_password_login_allowed()` — אמת רק כשהקליניקה `is_synthetic`, אחרת signOut והודעה. שני המסלולים מוגבלים
  בקצב דרך `@clinic/db/rate-limit` (הועבר מ-`apps/web/lib/rate-limit.ts`, שנשאר re-export)
