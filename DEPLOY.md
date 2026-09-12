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
   | `ANTHROPIC_API_KEY` | רק אם רוצים את מסך "שאלות על הנתונים". אפשר לדלג |

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
