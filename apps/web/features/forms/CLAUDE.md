# שאלונים — איך זה בנוי ומה נלמד בדרך הקשה

נטען אוטומטית כשנוגעים בקבצים בתיקייה הזאת. הכללים שחלים על כל הקוד נמצאים ב-`CLAUDE.md`
של השורש, והמפה של הריפו ב-`ARCHITECTURE.md`. כשמשנים משהו כאן, מעדכנים גם את הפסקה שלו.

- **שאלונים מהספרייה:** `features/forms/library.ts` — תבניות מוכנות עם מזהי שדות קבועים.
  כל מילוי שאלון מקבל שורה ב-`patient_documents` עם `file_path = 'form-submission:<id>'`
  (trigger ב-migration 20260910170000); אין קובץ באחסון — `/api/documents/[id]` מרנדר את
  התשובות מה-`fields` הקפואים של ההגשה דרך `renderSubmissionHtml` (packages/domain)
