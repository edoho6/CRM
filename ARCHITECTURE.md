# ארכיטקטורה — איך הקוד בנוי

מסמך תיאור, לא מסמך דרישות. הדרישות שכל שינוי חייב לעמוד בהן נמצאות ב-`CLAUDE.md`;
ההתקנה מאפס ב-`README.md`; מה שמעניין עורך דין ב-`SECURITY.md`; העלייה לאוויר ב-`DEPLOY.md`
ו-`GO-LIVE.md`; אפליקציות החנויות ב-`MOBILE.md`.

---

## המונורפו

pnpm 9 עם Turborepo, Node 20.9 ומעלה. `pnpm-workspace.yaml` מכיל `apps/*` ו-`packages/*`;
`turbo.json` מגדיר את המשימות `dev`, `build`, `typecheck`, `test`, `lint`, `clean`.

| חבילה | מה היא |
|---|---|
| `apps/web` (`@clinic/web`) | אפליקציית הצוות. Next 16 App Router, פורט 3000. כמעט כל הקוד כאן |
| `apps/portal` (`@clinic/portal`) | פורטל המטופלים. אפליקציה נפרדת עם auth נפרד, פורט 3001, כדי שרכיב של הצוות פשוט לא יהיה ב-bundle של המטופל |
| `apps/mobile-clinic`, `apps/mobile-portal` | מעטפות Capacitor שטוענות את האתר החי; אין עותק ארוז של האתר |
| `packages/domain` | טהור, בלי React ובלי Supabase: enums, סכמות zod 4, `status-tones`, חישובים (תאריכים לפי אזור, הרכב פורמולה, כללי הספרייה, זיהוי תרופות בטקסט, נוסחי הודעות, ics) |
| `packages/db` | לקוחות Supabase (`/server`, `/browser`, `/middleware`), קריאת משתני הסביבה, הגבלת קצב, וטיפוסי השורות ב-`types.ts` — **נכתבים ביד**, לא מיוצרים |
| `packages/i18n` | ניתוב `he`/`en`, `navigation` (Link/redirect מודעי שפה), וקטלוגי ההודעות `messages/he.json`, `messages/en.json` המשותפים לשתי האפליקציות |
| `packages/ui` | רכיבי הממשק המשותפים (Radix + Tailwind) ו-`base.css` |
| `packages/native` | הגשר למעטפת (סרגל מצב, כפתור חזרה, push) — רץ רק בתוך המעטפת |
| `packages/config` | tsconfig משותף |

---

## זרימת בקשה באפליקציית הצוות

1. **`apps/web/proxy.ts`** (השם של middleware ב-Next 16): next-intl קובע את השפה בכתובת,
   `refreshSession` מרענן את עוגיות Supabase על אותה תשובה, ומי שלא מחובר ומגיע לדלת הראשית
   מופנה ל-`/about`.
2. **`app/[locale]/`** מחולק לקבוצות:
   - `(site)` — דפים ציבוריים שמותר לאנדקס: `about`, `accessibility`, `privacy`, `terms`, `delete-account`.
   - `(auth)` — `login`, `signup`, `verify` (קוד אימות דו-שלבי), `welcome` (מחובר בלי קליניקה), `join` (הזמנה לצוות).
   - `(app)` — האפליקציה עצמה. ה-layout שלה הוא **שלושה שערים**: יש הגדרות Supabase, יש מישהו מחובר,
     והוא חבר בקליניקה (אחרת `/setup`, `/login`, `/welcome` או `/verify`). הכול תחתיו `force-dynamic`.
   - `(public)` — דפים בלי סשן שמזוהים ב-token אקראי: `book` (זימון), `confirm` (אישור הגעה), `unsubscribe`.
   - `(print)` — תבניות הדפסה.
   - `setup` — מדריך ההתקנה כשחסרים משתני סביבה.
   - `app/api/*` — route handlers: מסמכים, פיד יומן, ics לאישור הגעה, webhook של Grow, `library/ask`, ייצוא תיק.
3. **`lib/session.ts`**: `getMembershipContext()` מביא בקריאה אחת (`current_membership_context`) את
   החברות, הקליניקה, הפרופיל והאם אדמין פלטפורמה, עטוף ב-`cache` של React; `getClinicScope()` מחזיר
   `{ supabase, context }`. כל דף ב-`(app)` מתחיל ב-`const scope = await getClinicScope(); if (!scope) return null;`
   וה-layout כבר טיפל בהפניה.

הפורטל בנוי באותו אופן אבל קטן: `apps/portal/app/[locale]/` עם `portal-shell.tsx` שעוטף כל מסך מחובר.

---

## שכבת הנתונים

- **Supabase Postgres** עם RLS על כל טבלה לפי `clinic_id`. העוזרים `current_clinic_id()`,
  `is_clinic_member()`, `has_clinic_role()` נקראים מכל policy, ומחזירים כלום כשסשן עם אימות
  דו-שלבי עדיין לא נתן קוד. policy שקוראת לפונקציה עוטפת אותה ב-`(select …)`.
- **טבלאות משותפות בלי `clinic_id`** — עובדה אחת לכל השירות: `shop_*` (מחירי חנויות), `med_*` (רפואה מערבית),
  `library_*` (הספרייה המקצועית). קריאה לחבר קליניקה, כתיבה רק מפונקציות של service role או אדמין פלטפורמה.
- **מה שהמסד אוכף ולא הלקוח:** חפיפת תורים (exclusion constraint), קיזוז מלאי (`dispense_formula`
  בטרנזקציה, `stock_movements` append-only), נעילת רשומה חתומה (trigger), הסכמות append-only, יומן ביקורת
  ב-trigger. צפייה ברשומה נרשמת מהאפליקציה דרך `log_record_access`.
- **דפים בלי סשן** ופעולות בין קליניקות עוברות דרך פונקציות `security definer` עם `revoke` מפורש
  והענקה למי שצריך בלבד. אין service-role key באפליקציות; יש רק ב-Edge Functions, מוזרק על ידי Supabase.

### מיגרציות ואיך הן מגיעות למסד

- `supabase/migrations/` הוא מקור האמת (קבצים עם חותמת זמן `2026…`). **המשתמש מריץ אותם בהדבקה בעורך
  ה-SQL של Supabase**, לא ב-CLI. לשם כך כל מיגרציה חדשה מקבלת גם עותק בשורש בשם `NN_<שם>_to_run.sql`
  עם המספר הרץ הבא — העותקים האלה gitignored, וכשמדברים על "SQL 54" מתכוונים למספר הזה.
- `supabase/tests/*.sql` — בדיקות שנדבקות לאותו עורך: בונות נתונים בטרנזקציה ומסיימות ב-`rollback`.
  `tenant_isolation.sql` רץ אחרי כל מיגרציה שמוסיפה טבלה או policy.
- `supabase/seed.sql` יוצר את הקליניקה הראשונה והופך את משתמש ה-auth הראשון לבעלים.
  `supabase/seed/{herbs,formulas,points,medicine}` הם קטלוגי הייחוס; פונקציות הטעינה שלהם בוחרות את
  הקליניקה **הוותיקה ביותר** כשלא מעבירים מזהה.
- `supabase/maintenance/*.sql` — כיבוי/הדלקה של אינדקס הספרייה, vacuum, אבחון.
- `packages/db/src/types.ts` מתעדכן ביד עם כל מיגרציה שמשנה עמודה (`pnpm db:types` קיים אבל הקובץ
  המיוצר לא בשימוש).

---

## איך feature בנוי

`apps/web/features/<תחום>/` מחזיק את כל מה ששייך לתחום: `actions.ts` עם `'use server'` (ולידציה ב-zod
מ-`@clinic/domain`, `getClinicScope`, כתיבה, `revalidatePath`), קומפוננטות client, ולפעמים `queries/`
(לוח הבקרה) או `*.test.ts` לחישוב טהור. הדף ב-`app/[locale]/(app)/<תחום>/page.tsx` טוען את הנתונים בשרת
ומרכיב את הקומפוננטות. `components/` הם חלקי המעטפת שחוזרים בכל הדפים (סרגלים, `PageHeader`, דפדוף,
מיון, קלט תאריך), ו-`lib/` הם עוזרי שרת (סשן, העדפות, ערכת נושא, כותרת לשונית, אימות דו-שלבי) ורוב
בדיקות היחידה.

התחומים היום: `patients`, `appointments`, `encounters` (כולל `body3d`), `inventory`, `reference`,
`medicine`, `library`, `assistant`, `billing`, `documents`, `forms`, `consent`, `tasks`, `messages`,
`whatsapp`, `prices`, `reports`, `dashboard`, `settings`, `quick-bar`, `workspace`.

---

## עבודות רקע ושליחה

- **תורים ב-SQL, שליחה ב-Edge.** פונקציות SQL על `pg_cron` ממלאות את `message_log`
  (תזכורות, התראות משימה, אוטומציות). `supabase/functions/dispatch-messages` שולח דרך הספק המחובר
  (אימייל, push, SMS/WhatsApp דרך 019, או webhook של Make). `whatsapp-inbound` מקבל הודעות נכנסות,
  `fetch-shop-prices` קורא קטלוגים של חנויות, `refresh-library` מרענן דפי אתר בספרייה.
- **`supabase/functions/_shared/`** הוא TypeScript נקי (בלי Deno/Node) שגם הסקריפטים מייבאים, ובדיקותיו
  רצות מ-`apps/web` דרך ה-aliases ב-`vitest.config.mts` (`@messaging/*`, `@shop/*`).
- ה-secrets של הפונקציות מוגדרים ב-Dashboard; `supabase/functions/README.md` מפרט אותם.

---

## בדיקות ושערי איכות

- **vitest רץ רק ב-`apps/web`** (`vitest.config.mts`: סביבת node, `**/*.test.ts` בלבד, `server-only` מוחלף
  ב-stub, JSX מקומפל על ידי oxc). גם הלוגיקה של `packages/domain` ושל `_shared` נבדקת משם. לפורטל אין בדיקות.
- `scripts/check-*.mjs` הם השערים ש-CI מריץ אחרי `typecheck`/`test`/`build`: ניגודיות (על ה-build),
  טוקנים של Tailwind בשתי האפליקציות, מפתחות i18n, axe על הדפים הציבוריים.
- `scripts/smoke.mjs` ו-`scripts/a11y-walk.mjs` פותחים דפדפן אמיתי (Edge דרך playwright-core) מול
  `SMOKE_BASE_URL` ומסרבים לרוץ בלי הבאנר של קליניקת הבדיקות. פרטי הכניסה ב-`apps/web/.env.test.local`.
- `.github/workflows/ci.yml` מריץ את כל אלה ועוד `pnpm audit --audit-level high`.

---

## סקריפטים ותוכן

- `scripts/seed-sandbox-month.mjs` ממלא קליניקת בדיקות (או את הקליניקה של המשתמש עם `--me`) דרך ה-API.
- `scripts/library/` — טעינת הספרייה המקצועית מדרייב ומאתרים (README שם).
- `scripts/medicine/` — צנרת מאגר הרפואה המערבית (README שם).
- `scripts/fetch-herb-*.mjs`, `scripts/fetch-shop-images.mjs` — תמונות ברישיון חופשי עם manifest.
- `scripts/render-*.mjs` — אייקונים, תמונת שיתוף, צילומי מסך לדף הבית ולחנויות.
- `scripts/pull/` — משיכת מידע מחשבונות של המשתמש בלי סיסמאות בצ'אט (README שם).

---

## סביבות

- `apps/web/.env.local`, `apps/portal/.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_SITE_URL` (דוגמאות ב-`.env.example`). האפליקציה עולה גם בלעדיהם ומציגה את `/setup`.
- אין סביבת staging נפרדת: קליניקת הבדיקות (`clinics.is_synthetic`) באותו פרויקט היא הסביבה
  שאליה מותר לכתוב נתונים מדומים, והבאנר הענברי הוא השומר של כל סקריפט.
