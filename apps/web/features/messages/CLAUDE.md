# הודעות, אוטומציות ו-WhatsApp — איך זה בנוי ומה נלמד בדרך הקשה

נטען אוטומטית כשנוגעים בקבצים בתיקייה הזאת. הכללים שחלים על כל הקוד נמצאים ב-`CLAUDE.md`
של השורש, והמפה של הריפו ב-`ARCHITECTURE.md`. כשמשנים משהו כאן, מעדכנים גם את הפסקה שלו.

- **שליחת הודעות:** האפליקציה לא שולחת ולא מחליטה מה לשלוח. התור נכנס
  ל-`message_log` על ידי `enqueue_due_reminders()` (SQL, לפי שעה), והשליחה
  היא של `supabase/functions/dispatch-messages` (Edge Function — המקום היחיד
  שמחזיק service role, מוזרק על ידי Supabase, לא בקוד) או של אדם ממסך
  "הודעות" (`mark_message_sent`). ספק חדש = adapter אחד ב-`index.ts`.
  מספר/כתובת של מטופל נשמרים אצלנו בלבד; לספק מגיע רק מה שנשלח, ובלוג
  נשמר קוד שגיאה קצר, לא תגובת הספק.
  **הודעות אוטומטיות (migration 54):** `enqueue_due_automations()` (SQL, לפי שעה) ממלא ארבעה סוגים לפי
  `clinic_automations` — מעקב אחרי טיפול, יום הולדת, חזרה למי שלא ביקר, בקשת חוות דעת — עם `params`
  (ערכי המשתנים לפי סדר, לתבנית WhatsApp), חלון של 48 שעות אחורה, שעות אזרחיות בלבד, ובלי retry. שלושת
  הסוגים השיווקיים נשלחים רק עם הסכמה שיווקית רשומה (`has_marketing_consent`) ומסתיימים בקישור הסרה
  (`patient_unsubscribe_tokens`, בלי policies; `unsubscribe_marketing` כותב נסיגה ב-`patient_consents` עם
  method `link`; הדף `/unsubscribe/[token]` מסיר רק בלחיצה, לא ב-GET). הנוסחים המובנים חיים גם ב-SQL
  (`render_automation`) וגם ב-`packages/domain/src/messaging-templates.ts` לתצוגה המקדימה — בדיקה מחזיקה אותם
  זהים. **השליחה:** המתאמים של 019 (SMS + WhatsApp) ב-`supabase/functions/_shared/messaging/` — TypeScript
  נקי שנבדק מ-`apps/web` דרך `@messaging/*`; מספר טלפון מנורמל שם, קודי השירות הופכים לקודים קצרים
  (`messages.errors.*`). WhatsApp ביוזמת העסק = תבנית מאושרת (`whatsapp_template_id` ב-`clinic_automations`,
  גם לתזכורת תחת kind `appointment_reminder`); בלי מזהה — טקסט חופשי, ואם נדחה `needs_template` למסלול
  הידני. קליניקה `is_synthetic` לא שולחת למטופלים (`skipped/synthetic_clinic`), חוץ מ-`test_message`
  מהכרטיס בהגדרות ← הודעות.
  **תיבת השיחות (migration 55):** `whatsapp_conversations` (אחת לקליניקה ולאיש קשר — `contact_key` הוא
  המספר כ-`972…` או המזהה האטום של Meta; `patient_id` כשקובץ אחד בלבד נושא את המספר) ו-`whatsapp_messages`
  (כל הודעה לשני הכיוונים, עם סימני ✓ של השירות: sent/delivered/read). **מה שנכנס נכתב רק על ידי הפונקציה
  `whatsapp-inbound`** (Edge, `?key=WHATSAPP_INBOUND_SECRET`) דרך `whatsapp_receive`/`whatsapp_ack`
  (service role בלבד; dedupe על `unique` של השירות; לחיצה על "אגיע"/"לא אגיע" — `whatsapp_reply_intent`,
  התאמה מדויקת בלבד — קוראת ל-`respond_to_appointment` על התור הבא ומתורה שורת אישור חזרה); הצוות כותב רק
  `direction = 'out'` (policy). שליחה מיידית: השולח נעור על ידי חבר קליניקה (JWT) או על ידי הפונקציה הנכנסת
  ושולח **רק** את התור של השיחות (`whatsapp_claim_outbound`, נעילה + `sending`/`claimed_at`), כדי לא לחפוף
  לתזמון על התזכורות. חלון 24 השעות של Meta נאכף במסך: טקסט חופשי עד יום מ-`last_inbound_at`, אחרת תבנית
  הפתיחה (kind `conversation_opener`). הודעה אוטומטית ב-WhatsApp נכתבת גם לשיחה (`whatsapp_note_outbound`).
  המסך: `features/whatsapp/*` — רשימה + שיחה (מגירה מתחת ל-`lg`), polling כל 10 שניות; `/messages/queue` הוא
  התור הישן; מהתיק — כפתור "WhatsApp" (`?patient=`). קובץ שמטופל שולח נשמר רק כקישור של השירות (שבוע), לא
  בתיק — שלב הבא. **ערוץ Make (המשתמש עובד עם Make + ManyChat, 15.9):** `MAKE_OUTBOUND_URL` מפנה את הערוצים
  שב-`MAKE_OUTBOUND_CHANNELS` (ברירת מחדל whatsapp) ל-webhook (`_shared/messaging/webhook.ts`, גוף JSON מתועד
  ב-DEPLOY.md, `provider_message_id` = ה-id שלנו אלא אם התרחיש ענה עם `id`), ו-`whatsapp-inbound` מקבל גם את
  הצורה הפשוטה `{event: message|status}` (`&to=` בכתובת כשהתרחיש לא יודע את הקו; הודעה בלי id מקבלת שם
  סינתטי לפי שולח+טקסט+דקה). 019 נשאר החלופה, ול-SMS

- **התראות בטלפון (migration 41):** `device_push_tokens` (טלפון = שורה של הבעלים; נכתבת רק ב-`register_push_device`,
  שקושר את השורה למי שקרא ולקליניקה שלו; `unregister_push_device` ביציאה). `message_log.channel` קיבל `'push'` —
  ה-`recipient` הוא user id (לא מספר) ו-`link_url` הוא היעד של הלחיצה; `clinic_tasks.remind_via` קיבל `'push'`;
  `clinics.reminder_push_enabled`. **ההחלטה ב-SQL:** `enqueue_due_reminders` שולח push כשלמטופל יש טלפון רשום
  (`patient_portal_access.user_id` → `device_push_tokens` עם `app = 'portal'`) והקליניקה מסכימה, אחרת בערוץ
  הקליניקה; הגוף הוא `render_push_reminder` — **בלי שם המטופל** (עובר דרך Google/Apple). `enqueue_due_task_alerts`
  שולח push לטלפון של יוצר המשימה (`app = 'clinic'`), ובלי טלפון — `skipped` עם `no_device`. השולח
  (`supabase/functions/dispatch-messages`, adapter `fcm`: FCM HTTP v1, JWT ב-WebCrypto, ה-secret
  `FCM_SERVICE_ACCOUNT_JSON`) מוחק טוקן שהשירות לא מכיר, וכך הריצה השעתית הבאה נופלת לערוץ הרגיל בלי מנגנון נוסף.
  `mark_message_sent` מקבל גם את ה-service role — בלי זה כל שליחה אוטומטית הייתה נשארת `queued` ויוצאת שוב.
  במסך ההודעות שורת push מוצגת עם פעמון ובלי נמען; בדיאלוג המשימה "התראה בטלפון" זמינה רק כשיש טלפון רשום
  (שאילתה מהדפדפן, RLS של הבעלים). `tenant_isolation.sql` בודק שטלפון של קליניקה אחרת לא נראה
