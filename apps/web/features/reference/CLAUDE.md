# מאגר המידע — איך זה בנוי ומה נלמד בדרך הקשה

נטען אוטומטית כשנוגעים בקבצים בתיקייה הזאת. הכללים שחלים על כל הקוד נמצאים ב-`CLAUDE.md`
של השורש, והמפה של הריפו ב-`ARCHITECTURE.md`. כשמשנים משהו כאן, מעדכנים גם את הפסקה שלו.

- **כרטיס מידע:** כל צמח, פורמולה ונקודת דיקור בדף הטיפול הם `ReferenceChip`
  (`features/reference/reference-sheet.tsx`) שפותח את המונוגרף בחלון מעל הדף — לא ניווט. ספק אחד
  (`ReferenceSheetProvider` ב-layout של `(app)`), פעולה אחת (`loadReferenceCard`: לפי id, ואם אין —
  לפי פינין/קוד/שם). גוף המונוגרף של צמח הוא `HerbMonographBody`, משותף עם הגלריה

- **ניווט המאגר:** ברשימות — שורה אחת עם החיפוש; בדפי רשומה (מונוגרף, עריכה, חדש, השוואה) —
  `<ReferenceNav compact />` בחריץ `actions` של `PageHeader`, לא שורה משלו מתחת לכותרת

- **הקטלוג המשותף (migration 56):** `catalogue_herbs` / `catalogue_formulas` (הרכב כ-jsonb `[{h,d,n}]`) /
  `catalogue_points` הן טבלאות **בלי `clinic_id`** כמו `med_*`: חברים קוראים, אין policies לכתיבה, והמילוי רק
  בקובצי ה-seed (`supabase/seed/{herbs,formulas,points}` → `catalogue_upsert_herb/formula/point`,
  `catalogue_set_point_clinical`; `node scripts/bundle-seeds.mjs` אורז אותם ל-`2_…`/`3_…_to_run.sql`).
  **קליניקה מקבלת את הקטלוג ב-`clinic_load_catalogue()`** — set-based (900 שורות דרך המייבאים הישנים
  לקחו שניות ו-PostgREST נותן 8): מכניס מה שחסר, ממלא רק שדות ריקים, לעולם לא דורס תיקון; מטופל ב-
  `create_clinic_for_current_user` (בבלוק exception — קליניקה לא תיכשל בגלל קטלוג) ובכרטיס "מאגר המידע"
  ב-`/settings` (`reference-catalogue-card.tsx`, `loadReferenceCatalogue`). הטריגרים שמנקים `needs_review`
  בעריכה קלינית שותקים כשההגדרה `herbalist.catalogue_loading` דלוקה — מילוי מהקטלוג אינו אישור.
  הפונקציות הישנות `upsert_herb`/`upsert_formula`/`upsert_acupuncture_point`/`set_point_clinical` נשארו
  (הקליניקה הוותיקה ביותר כברירת מחדל) אבל שום קובץ לא קורא להן יותר

- **אישור של אדם:** `needs_review` יורד גם ב-`ApproveButton` (`approveReference(kind, id)`, `review-actions.ts`)
  שכותב `reviewed_at/by/by_name` (השם נלכד בזמן האישור); `ReviewedLine` מציג "אושר על ידי X ב-…" במקום
  האזהרה. לנקודות יש מסנן `?review=1` (תור סקירה) וטופס עריכה (`point-form.tsx`, `updateAcupuncturePoint`) —
  לפני כן לא הייתה דרך למלא את הטקסט הקליני שהדף הבטיח

- **פורמולות מותאמות:** פורמולה שנבנתה בטיפול למטופל (`category = 'modified'`; הסימולציה יוצרת עשרות כאלה) היא
  רשומה של הטיפול, לא ערך בקטלוג: ברשימה יש מסנן סוג (`kind=` ב-`formula-filter-params.ts`) ותג על כל שורה
  שאינה קלאסית, ובדף הצמח "מופיע בפורמולות" מציג את הקלאסיות והאישיות בטבלה ומקפל את המותאמות ל-`<details>`
