# העלאה לאינטרנט — Vercel, צעד אחר צעד

המערכת רצה היום רק על המחשב שלך. כדי שקישורי הזימון, אישורי ההגעה והיומן
בטלפון יגיעו למטופלים, היא צריכה כתובת באינטרנט. Vercel הוא השירות שבו
Next.js (הטכנולוגיה שהמערכת בנויה עליה) רץ בצורה הפשוטה ביותר, והתוכנית
החינמית מספיקה להתחלה.

יש **שתי אפליקציות** בפרויקט, וכל אחת נהיית "פרויקט" נפרד ב-Vercel:

| | תיקייה | מי משתמש |
|---|---|---|
| המערכת (הקליניקה) | `apps/web` | אתה והצוות |
| הפורטל | `apps/portal` | מטופלים |

זמן משוער: 20 דקות בפעם הראשונה. אחרי זה, כל `git push` מעלה גרסה חדשה לבד.

---

## לפני שמתחילים

1. הקוד צריך להיות ב-GitHub (הוא כבר שם — `git push` אחרי כל commit).
2. פותחים חשבון ב-[vercel.com](https://vercel.com) עם **Continue with GitHub** — אותו חשבון GitHub שהקוד יושב בו.
3. מוכנים ליד היד שני ערכים מ-Supabase: **Project Settings ← API**:
   - `Project URL` (מתחיל ב-`https://` ונגמר ב-`.supabase.co`)
   - `anon public` key (מחרוזת ארוכה). **לא** את ה-`service_role` — אותו לעולם לא מדביקים ב-Vercel.

---

## פרויקט 1 · המערכת

1. ב-Vercel: **Add New… ← Project**.
2. ברשימת ה-repositories, ליד `CRM Project` (או איך שקראת לו ב-GitHub) — **Import**.
3. במסך ההגדרות:
   - **Framework Preset**: Next.js (מזוהה לבד).
   - **Root Directory**: לוחצים **Edit** ובוחרים `apps/web`. זה החשוב ביותר — בלי זה הבנייה נכשלת.
   - Build Command / Install Command: להשאיר ריק (ברירת המחדל נכונה: Vercel מזהה pnpm ו-Turborepo).
4. פותחים **Environment Variables** ומוסיפים, אחד-אחד (Name ← Value ← Add):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | ה-Project URL מ-Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ה-anon key מ-Supabase |
   | `NEXT_PUBLIC_SITE_URL` | בינתיים `https://placeholder` — מעדכנים בשלב 6 |
   | `ANTHROPIC_API_KEY` | למסך "שאלות על הנתונים" ולספרייה המקצועית. אפשר לדלג בהתחלה |
   | `VOYAGE_API_KEY` | לספרייה המקצועית (החיפוש במקורות). ראה סעיף "ספרייה מקצועית" |

5. **Deploy**. שתיים-שלוש דקות. בסוף מופיע מסך "Congratulations" עם הכתובת — משהו כמו `https://crm-project-xxxx.vercel.app`. להעתיק אותה.
6. **Settings ← Environment Variables**: לערוך את `NEXT_PUBLIC_SITE_URL` ולשים בה את הכתובת האמיתית (בלי `/` בסוף). ואז **Deployments ← ⋯ על העליון ← Redeploy** כדי שהשינוי ייכנס.

## פרויקט 2 · הפורטל

אותם צעדים בדיוק, עם שני הבדלים:
- **Root Directory**: `apps/portal`
- `NEXT_PUBLIC_SITE_URL`: הכתובת של **הפורטל** (מתקבלת אחרי ה-Deploy הראשון שלו)

---

## Supabase צריך לדעת על הכתובות החדשות

בלי זה — קישורי ההתחברות במייל (אימות הרשמה, כניסה לפורטל) מובילים ל-localhost.

ב-Supabase: **Authentication ← URL Configuration**:
- **Site URL**: הכתובת של המערכת (`https://…vercel.app`).
- **Redirect URLs** ← Add URL, שלוש שורות:
  - `https://<כתובת-המערכת>/**`
  - `https://<כתובת-הפורטל>/**`
  - `http://localhost:3000/**` (כדי שהפיתוח על המחשב ימשיך לעבוד)

**Save**.

ובאותו מקום, **Email Templates ← Magic Link**: להוסיף לגוף ההודעה את הקוד, למשל שורה
"או להקליד את הקוד: `{{ .Token }}`". דף הכניסה של הפורטל יודע לקבל את הקוד במקום הקישור —
למי שקורא את המייל במכשיר אחר, ולבודקי החנויות (`MOBILE.md` §8).

---

## התור לתזכורות — לעדכן לכתובת האמיתית

ב-SQL Editor, פעם אחת:

```sql
select cron.unschedule('enqueue-reminders');
select cron.schedule(
  'enqueue-reminders', '5 * * * *',
  $job$ select public.enqueue_due_reminders('https://<כתובת-המערכת>') $job$
);
```

(אם עדיין לא הפעלת את התור — הפקודות המלאות בסוף `19_schedule_blocks_messaging_to_run.sql`.)

---

## התראות בטלפון — כשיש אפליקציה בחנויות

הפונקציה ששולחת (`dispatch-messages`) יודעת לשלוח גם התראות לאפליקציות בטלפון, דרך Firebase.
מה צריך: פרויקט Firebase (`MOBILE.md`, שלב ההתראות) ← **Project settings ← Service accounts ←
Generate new private key** ← הקובץ שיורד. ב-Supabase ← **Edge Functions ← Secrets** ← secret בשם
`FCM_SERVICE_ACCOUNT_JSON` שהערך שלו הוא **כל תוכן הקובץ** כפי שהוא. אחר כך לפרוס מחדש את הפונקציה
(`supabase functions deploy dispatch-messages --no-verify-jwt`). בלי ה-secret, שורות ההתראה נשארות בתור
והתזכורת יוצאת בערוץ הרגיל בשעה הבאה — שום דבר לא הולך לאיבוד.

## השוואת מחירים — הקורא של החנויות

המסך "השוואת מחירים" מציג מחירים שנקראים מדפי המוצר הציבוריים של החנויות, פעם ביום
בערך, על ידי פונקציה שרצה בתוך Supabase. הרצת ה-SQL יוצרת רק את הטבלאות — הן נשארות
ריקות עד שהפונקציה מותקנת ורצה. כדי שהמסך יתמלא:

1. ב-SQL editor: `27_shop_prices_to_run.sql`, אחריו `28_shop_prices_grants_to_run.sql`, ואז
   `supabase/tests/tenant_isolation.sql` (צריך להסתיים ב-ALL TENANT ISOLATION CHECKS PASSED).
2. להמציא סוד: מחרוזת אקראית ארוכה (למשל 40 אותיות וספרות). שומרים אותה במקום בטוח — היא
   תידרש שלוש פעמים למטה. לא לשלוח אותה בצ'אט.
3. ב-Supabase: Edge Functions ← Secrets ← Add new — שלושה סודות:
   `SHOP_PRICES_SECRET` (הסוד מסעיף 2), `SHOP_PRICES_CONTACT` (אימייל שחנות יכולה לפנות אליו),
   `SHOP_PRICES_SITE` (כתובת המערכת, למשל https://…vercel.app).
4. להעלות את הפונקציה. ב-VS Code: Terminal ← New Terminal, ואז שלוש פקודות, אחת אחרי השנייה
   (ה-Reference ID נמצא ב-Supabase תחת Project Settings ← General):

   ```
   npx supabase@latest login
   npx supabase@latest link --project-ref XXXXXXXX
   npx supabase@latest functions deploy fetch-shop-prices --no-verify-jwt
   ```

   הראשונה פותחת דפדפן לאישור; השנייה שואלת סיסמת מסד — פשוט Enter (לא נדרשת כאן); השלישית
   מסתיימת ב-"Deployed Functions". ב-Supabase ← Edge Functions הפונקציה `fetch-shop-prices`
   אמורה להופיע.
5. ב-SQL editor — ההוראה `cron.schedule` שבסוף `27_shop_prices_to_run.sql` (בהערה), אחרי
   שמחליפים בה את YOUR-PROJECT-REF ב-Reference ID ואת THE-SAME-SECRET בסוד. לפני כן, ב-Database ←
   Extensions, לוודא ש-`pg_cron` ו-`pg_net` דלוקות. מרגע זה כל עשר דקות נקראת חנות אחת; ארבע
   החנויות מלאות תוך כשעה, וכל אחת מתעדכנת פעם ביום.
6. ב-Vercel (Settings ← Environment Variables) וב-`.env.local` במחשב: `SHOP_PRICES_SECRET`
   — אותו ערך. זה מה שנותן לכפתור "קריאה עכשיו" במסך "החנויות" (`/prices/stores`) להפעיל את
   הקורא מיד במקום לחכות לסיבוב הבא. אחרי שינוי ב-`.env.local` מפעילים את השרת המקומי מחדש.

ארבע חנויות פעילות מהיום הראשון (יש להן קטלוג ציבורי מסודר). שלוש נוספות בנויות אבל
כבויות עד שהחנות מאשרת בכתב — נוסח הבקשה ב-`supabase/functions/fetch-shop-prices/permission-email.he.md`,
ואחרי אישור מפעילים אותן מ-`/prices/stores`. שייאו איי לא נתמכת כרגע.

## רפואה מערבית — טעינת המאגר

המאגר של המחלות, התסמינים והתרופות (מאגר מידע ← רפואה מערבית) לא נטען מהאפליקציה אלא
בפקודה אחת מהמחשב שלך, אחרי שהטבלאות קיימות:

1. ב-Supabase → SQL editor להריץ את `34_medicine_to_run.sql` (הטבלאות, ההרשאות והפונקציות),
   ואז את `supabase/tests/tenant_isolation.sql` — כל השורות צריכות להיות `ok`.
   אם 34 כבר הורץ פעם, להריץ במקומו את `35_medicine_israel_to_run.sql` (מוסיף את השכבה הישראלית
   ואת בדיקות המעבדה לטבלאות הקיימות); מי שמריץ את 34 בפעם הראשונה לא צריך את 35.
   ואחריהם, בכל מקרה, את `36_medicine_review_to_run.sql`: הכפתורים "אישור הערך" ו"סימון לתיקון" בדף
   הערך (למי שברשימת אדמיני הפלטפורמה) והכרטיס ב-`/platform`.
2. בטרמינל של VS Code (תפריט Terminal ← New Terminal), פקודה אחת:

   ```
   node scripts/medicine/import.mjs
   ```

   הפקודה שואלת את האימייל ואת הסיסמה של **החשבון שלך** (הוא אדמין הפלטפורמה; רק הוא רשאי).
   הסיסמה לא מוצגת בזמן ההקלדה, וגם לא נשמרת בשום מקום — לכן היא לא נכתבת בפקודה עצמה
   (PowerShell שומר כל פקודה בקובץ היסטוריה). אחר כך הפקודה קוראת את
   `supabase/seed/medicine/dataset.json.gz` שנמצא ב-git, מדפיסה את ההתקדמות (25 ערכים בכל שורה)
   ובסוף כמה ערכים וקישורים נטענו. זה לוקח כמה דקות. אם הטרמינל אומר ש-`node` לא מוכר, קודם:
   `$env:Path = "C:\Program Files\nodejs;$env:Path"` ואז שוב את הפקודה.
3. לפתוח `/reference/medicine` — הערכים מופיעים, כל אחד עם התווית שלו ("טרם הוצלב" / "הוצלב
   בין N מקורות") והמקורות באנגלית למטה.

עדכון המאגר (ערכים חדשים, ציטוטים מרועננים) הוא אותה פקודה על קובץ חדש; ערך שסומן "אומת"
לא חוזר לטיוטה. הפירוט ב-`scripts/medicine/README.md`.

## כתיבה בעט בדף הטיפול

דף הטיפול קיבל אייקון עט קטן בכותרת (לפני מתג הסידור) שפותח דף כתיבה: עט, מדגש, מחק, צבעים, עוביים,
נייר חלק/שורות/משבצות, ביטול וחזרה. הדף נשמר בתיק המטופל כתמונה (קטגוריה "כתב יד") ומופיע בפאנל
"כתב יד" של הטיפול ובלשונית המסמכים. כדי שהשמירה תעבוד צריך פעם אחת ב-Supabase → SQL editor → New query
→ להדביק את `38_sketches_to_run.sql` → Run (שורה אחת שמוסיפה את הקטגוריה). בלי זה השמירה נכשלת בהודעה
"לא ניתן היה לשמור את הדף".

בטאבלט: עט (Apple Pencil, S Pen, עט של Surface) כותב עם לחץ; ברגע שזוהה עט, אצבע וכף יד לא מציירות
(אפשר לכבות במתג "עט בלבד" בסרגל). בטלפון ובמחשב כותבים באצבע או בעכבר.

## ספרייה מקצועית — חיבור לדרייב ולשירותי המענה

הספרייה (בתפריט: "ספרייה מקצועית") עונה על שאלות מקצועיות רק מתוך קבצים בתיקייה בדרייב שלך. ארבעה
צעדים, פעם אחת:

1. **Supabase**: Database → Extensions → לחפש `vector` ולהפעיל. ואז SQL editor → New query → להדביק את
   `37_library_to_run.sql` → Run. ואז `supabase/tests/tenant_isolation.sql` — צריך להסתיים ב-
   `ALL TENANT ISOLATION CHECKS PASSED`.
2. **שני מפתחות**:
   - Voyage AI (החיפוש): נרשמים ב-[voyageai.com](https://www.voyageai.com), יוצרים API key. חינם עד 200 מיליון
     מילים-טוקנים, הרבה מעבר לספרייה של מאות קבצים.
   - Anthropic (המענה): [console.anthropic.com](https://console.anthropic.com) → API keys → Create key.

   את שניהם מוסיפים ל-`apps/web/.env.local` בשורות `VOYAGE_API_KEY=...` ו-`ANTHROPIC_API_KEY=...`, וגם
   ב-Vercel → הפרויקט של המערכת → Settings → Environment Variables (אותם שמות). לא בצ'אט ולא ב-git.
3. **חשבון שירות בגוגל** — זהות טכנית שרואה רק את התיקייה שתשתף איתה:
   1. [console.cloud.google.com](https://console.cloud.google.com) → למעלה "Select a project" → New Project →
      שם, למשל `herbalist-library` → Create.
   2. בתפריט ← APIs & Services → Library → לחפש "Google Drive API" → Enable.
   3. APIs & Services → Credentials → Create Credentials → Service account → שם `herbalist-library` → Create
      and continue → Done (בלי תפקידים).
   4. לוחצים על חשבון השירות שנוצר → לשונית Keys → Add key → Create new key → JSON → Create. קובץ JSON יורד
      למחשב. **שומרים אותו מחוץ לתיקיית הפרויקט**, למשל `C:\Users\User\Documents\herbalist-keys\drive.json`,
      ומוסיפים ל-`apps/web/.env.local`:
      `GOOGLE_SERVICE_ACCOUNT_FILE=C:\Users\User\Documents\herbalist-keys\drive.json`
   5. בדף של חשבון השירות מעתיקים את כתובת המייל שלו (נגמרת ב-`iam.gserviceaccount.com`).
   6. ב-Google Drive: קליק ימני על התיקייה של הספרייה → Share → מדביקים את כתובת המייל → Viewer → Send.
   7. פותחים את התיקייה בדפדפן; הכתובת נגמרת ב-`/folders/<מזהה ארוך>`. את המזהה מוסיפים ל-`.env.local`:
      `LIBRARY_DRIVE_FOLDER_ID=<המזהה>`.
4. **הטעינה**, בטרמינל של VS Code:

   ```
   node scripts/library/ingest.mjs
   ```

   הפקודה קוראת את הקבצים, מדפיסה כמה קטעים יצאו מכל קובץ, ושואלת אימייל וסיסמה של החשבון שלך
   (הסיסמה מוסתרת) לפני ההעלאה. מריצים אותה שוב אחרי שמוסיפים קבצים לתיקייה; קבצים שלא השתנו נדלגים.
   `--dry` רק קורא בלי להעלות, ו-`--limit=10` מנסה על עשרה קבצים.

מה כדאי לדעת: השאלות נשלחות ל-Voyage ול-Anthropic לצורך המענה (המסך אומר זאת), ואסור להזין בהן פרטי
מטופלים; ביומן (`/library/activity`) נרשם מי שאל ומתי, לא מה. הקבצים הם שלך; אתרים ייכנסו רק מרשימה שתמלא,
ובאחריותך שיש לך זכות להשתמש בהם.

## ריענון אוטומטי של אתרי הספרייה

דף מאתר שנטען לספרייה נקרא שוב אחרי שבוע, לבד, בתוך Supabase (Edge Function בשם `refresh-library`): בקשה
מותנית, כך שדף שלא השתנה עולה לאתר תשובת "לא השתנה" ותו לא; דף שכן השתנה נחתך, מוטמע ונכתב מחדש. דפים
חדשים באתר עדיין נאספים בפקודת `node scripts/library/crawl.mjs`. ארבעה צעדים, פעם אחת:

1. **SQL**: SQL editor → New query → להדביק את `39_library_refresh_to_run.sql` → Run, ואז שוב
   `supabase/tests/tenant_isolation.sql` (צריך להסתיים ב-`ALL TENANT ISOLATION CHECKS PASSED`).
2. **הפונקציה**, בטרמינל של VS Code (פעם ראשונה תבקש להתחבר ל-Supabase בדפדפן):

   ```
   npx supabase@latest functions deploy refresh-library --no-verify-jwt
   ```

3. **הסודות**: Supabase → Edge Functions → Secrets: `LIBRARY_REFRESH_SECRET` (מחרוזת אקראית ארוכה שממציאים
   עכשיו), `VOYAGE_API_KEY` (אותו מפתח כמו ב-`.env.local`), `LIBRARY_CONTACT` (כתובת אימייל שבעלי אתרים
   יוכלו לפנות אליה; מופיעה ב-User-Agent).
4. **התזמון**: Database → Extensions → לוודא ש-`pg_cron` ו-`pg_net` דלוקים, ואז SQL editor → להדביק את
   ההוראה `cron.schedule` שבסוף `39_library_refresh_to_run.sql` (בהערה), עם כתובת הפרויקט והסוד שנבחר → Run.
   הפונקציה רצה כל שעה, עד ארבעים דפים בריצה, ולכן ספרייה של כמה מאות דפים נבדקת כולה בכל שבוע.

## מה בודקים אחרי העלייה

1. `https://<כתובת-המערכת>/he/login` — כניסה עם המשתמש הרגיל שלך. אם יש שגיאה — 90% זה משתני סביבה: לבדוק שאין רווח בסוף הערך, ולעשות Redeploy.
2. הגדרות ← זימון אונליין ← "פתיחה" — הדף נפתח בכתובת האמיתית, ואפשר לשלוח את הקישור.
3. תור כלשהו ← "תזכורת ואישור הגעה" ← WhatsApp — הקישור שבהודעה מוביל לכתובת האמיתית.
4. אזור אישי ← שעות עבודה ← היומן בטלפון: הכתובת שם עכשיו ציבורית, ואפשר להירשם אליה מגוגל/אייפון.

## דומיין משלך (לא חובה)

**Settings ← Domains ← Add**, מקלידים למשל `app.הקליניקה-שלך.co.il`, ועוקבים אחרי ההוראות שמופיעות (שורה אחת אצל ספק הדומיין). אחרי החיבור מעדכנים את `NEXT_PUBLIC_SITE_URL` ואת ה-Redirect URLs ב-Supabase לדומיין החדש.

## מה קורה מעכשיו

- כל `git push` ל-`main` → Vercel בונה ומעלה לבד, בערך 3 דקות. אם הבנייה נכשלת, הגרסה הקודמת ממשיכה לרוץ — כלום לא נשבר למשתמשים.
- ה-`.env.local` שבמחשב שלך לא עולה לשום מקום (הוא ב-`.gitignore`). המפתחות חיים רק ב-Vercel וב-Supabase.

## אפליקציות בחנויות

אחרי שיש כתובת קבועה: `MOBILE.md` — האפליקציות ל-App Store ול-Google Play נבנות מהכתובת הזו, צעד אחר צעד.

## מה חשוב לדעת לפני שמכניסים מטופלים אמיתיים

הרשימה המלאה של מה שצריך לקדם מחוץ לפיתוח — ייעוץ, רישומים, מסמכים, ספקים — ב-`GO-LIVE.md`.

- **רישום מאגר מידע** ותנאי שימוש/מדיניות פרטיות למטפלים — עם עו"ד (ראה `SECURITY.md`).
- להפעיל **גיבויים** ב-Supabase: Database ← Backups (בתוכנית החינמית — יומי, 7 ימים; בתוכנית Pro — Point-in-time).
- ה-`service_role` key של Supabase: לא בקוד, לא ב-Vercel, לא בצ'אט. הוא נדרש רק ל-Edge Function של השליחה, ו-Supabase מזריק אותו לשם לבד.
