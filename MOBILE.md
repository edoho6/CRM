# האפליקציות לחנויות — App Store ו-Google Play, צעד אחר צעד

המערכת והפורטל הם אתרים. כדי שיהיו גם **אפליקציות בחנויות**, בקוד יש שתי "מעטפות":
אפליקציה ילידית קטנה שכל מה שהיא עושה הוא לפתוח את האתר החי בתוך חלון משלה, ולהוסיף
מה שדפדפן לא נותן — סרגל מצב, כפתור חזרה, ובהמשך התראות בטלפון.

| | תיקייה | מזהה בחנויות | שם על המסך |
|---|---|---|---|
| המערכת (הצוות) | `apps/mobile-clinic` | `il.co.herbalist.clinic` | הרבליסט |
| הפורטל (המטופלים) | `apps/mobile-portal` | `il.co.herbalist.portal` | הרבליסט מטופלים |

**מה זה אומר בפועל:** כל שינוי באתר מגיע לאפליקציה מיד, בלי עדכון בחנות. עדכון בחנות
נדרש רק כשהמעטפת עצמה משתנה (אייקון, התראות, הרשאות) — כמה פעמים בשנה.

**מה אין צורך:** מק. הבנייה של iOS רצה על מחשב מק של GitHub (Actions), והחתימה,
האריזה וההעלאה ל-TestFlight נעשות שם. מווינדוס פותחים חשבונות, יוצרים מפתחות
ולוחצים "Run workflow".

זמן משוער: הקמת החשבונות — כמה שעות מפוזרות על שבוע (אפל מאשרת חשבון תוך 24–48
שעות, גוגל מאמתת זהות תוך כמה ימים). אחרי זה, בנייה והעלאה — לחיצה אחת ו-20 דקות.

---

## סדר העבודה

1. דומיין וכתובות (חובה לפני הכול)
2. חשבון Apple Developer, App IDs, מפתחות
3. שתי הרשומות ב-App Store Connect
4. ריפו לתעודות ו-secrets ב-GitHub
5. הרצה ראשונה של iOS → TestFlight בטלפון
6. חשבון Google Play, מפתחות חתימה, הרצה ראשונה של אנדרואיד
7. בדיקה סגורה (14 יום, 12 בודקים) — רק בגוגל
8. עמודי המדיניות מהעו"ד, ואז הגשה לביקורת

כל ערך סודי (מפתח, סיסמה, קובץ) נכנס ל-GitHub כ-**secret** ולא לקוד ולא לצ'אט.
איך: הריפו ב-GitHub ← **Settings** ← **Secrets and variables** ← **Actions** ←
**New repository secret**. השם בדיוק כפי שכתוב כאן, הערך — מה שמצוין.

---

## 1 · דומיין וכתובות

המעטפת חייבת לדעת לאן לפנות, ולכן קודם `DEPLOY.md` (העלאה ל-Vercel) ורצוי דומיין
משלך (סעיף "דומיין משלך" שם). שני הדומיינים — למשל `app.הדומיין` למערכת ו-`portal.הדומיין`
לפורטל — נכנסים ל-GitHub כ-**Variables** (לא secrets — אלה כתובות ציבוריות):
Settings ← Secrets and variables ← Actions ← לשונית **Variables** ← New repository variable:

| שם | ערך |
|---|---|
| `HERBALIST_APP_URL` | `https://app.הדומיין` (בלי לוכסן בסוף) |
| `HERBALIST_PORTAL_URL` | `https://portal.הדומיין` |

בלי שני אלה שום בנייה לא תתחיל — היא נעצרת עם הודעה שאומרת מה חסר.

---

## 2 · Apple Developer

1. באייפון: להתקין את האפליקציה **Apple Developer** מה-App Store, להיכנס עם ה-Apple ID
   ולהירשם ל-**Apple Developer Program** כ**יחיד** (Individual). 99$ לשנה. אימות זהות
   מהטלפון. האישור מגיע במייל תוך 24–48 שעות.
2. אחרי האישור, ב-[developer.apple.com/account](https://developer.apple.com/account):
   - **Membership details** ← לרשום את ה-**Team ID** (10 תווים) → secret `APPLE_TEAM_ID`.
   - **Certificates, Identifiers & Profiles** ← **Identifiers** ← **+** ← App IDs ← App:
     Description "Herbalist", Bundle ID **Explicit** `il.co.herbalist.clinic`,
     ב-Capabilities לסמן **Push Notifications**. Register. ואז שוב, עם
     `il.co.herbalist.portal`.
   - **Keys** ← **+** ← שם "Herbalist push", לסמן **Apple Push Notifications service
     (APNs)**, Continue, Register, **Download**. הקובץ `.p8` יורד **פעם אחת בלבד** —
     לשמור בתיקייה מגובה (לא בפרויקט). נצטרך אותו בשלב ההתראות (Firebase).
3. ב-[appstoreconnect.apple.com](https://appstoreconnect.apple.com) ← **Users and Access** ←
   לשונית **Integrations** ← **App Store Connect API** ← **Team Keys** ← **+**:
   שם "GitHub builds", Access **Admin**. Generate. לרשום את **Issuer ID** (למעלה) ואת
   **Key ID** של המפתח, ולהוריד את ה-`.p8` (גם הוא פעם אחת).
   - `ASC_KEY_ID` = ה-Key ID
   - `ASC_ISSUER_ID` = ה-Issuer ID
   - `ASC_KEY_P8_B64` = תוכן הקובץ ב-base64. ב-PowerShell, בתיקייה שבה הקובץ:
     ```powershell
     [Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXXXX.p8")) | Set-Clipboard
     ```
     ואז להדביק (Ctrl+V) בשדה הערך של ה-secret.

---

## 3 · App Store Connect — שתי הרשומות

**My Apps** ← **+** ← **New App**:

| שדה | המערכת | הפורטל |
|---|---|---|
| Platforms | iOS | iOS |
| Name | הרבליסט | הרבליסט — אזור המטופל |
| Primary Language | Hebrew | Hebrew |
| Bundle ID | il.co.herbalist.clinic | il.co.herbalist.portal |
| SKU | herbalist-clinic | herbalist-portal |
| User Access | Full Access | Full Access |

אם השם "הרבליסט" תפוס — לנסות "הרבליסט לקליניקה". השם בחנות לא חייב להיות זהה לשם
שמתחת לאייקון.

---

## 4 · ריפו לתעודות ו-secrets ל-iOS

הכלי שחותם (fastlane `match`) שומר את תעודות החתימה של אפל בריפו git פרטי, מוצפנות
בסיסמה. הוא יוצר אותן לבד בהרצה הראשונה — לא צריך Keychain ולא מק.

1. ב-GitHub: **New repository** ← שם `herbalist-certificates`, **Private**, בלי README.
   Create.
2. **Personal Access Token**: תמונת הפרופיל ← Settings ← Developer settings ←
   Personal access tokens ← **Tokens (classic)** ← Generate new token (classic):
   Note "match", Expiration — שנה, לסמן **repo**. Generate. להעתיק את ה-token (מתחיל
   ב-`ghp_`) — מוצג פעם אחת.
3. ה-secrets:
   - `MATCH_GIT_URL` = `https://github.com/<שם-המשתמש>/herbalist-certificates.git`
   - `MATCH_GIT_BASIC_AUTHORIZATION` = base64 של `שם-המשתמש:ה-token`. ב-PowerShell:
     ```powershell
     [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("edoho6:ghp_XXXX")) | Set-Clipboard
     ```
   - `MATCH_PASSWORD` = סיסמה חדשה וארוכה שממציאים עכשיו. **לשמור במנהל הסיסמאות** — בלעדיה
     התעודות בריפו הן בלוק מוצפן שאי אפשר לפתוח, והדרך היחידה היא למחוק וליצור חדשות.

---

## 5 · iOS — הרצה ראשונה

ב-GitHub: **Actions** ← **Store apps · iOS** ← **Run workflow** ← Which shell: `clinic`,
ולסמן **First run only — let match create the certificates**. Run.

- ההרצה הראשונה לוקחת ~15 דקות (יוצרת תעודה ופרופיל, בונה, מעלה). ירוק = הבנייה
  ב-TestFlight. אדום = ללחוץ על ההרצה, על השלב האדום, ולשלוח לי את השורות האחרונות.
- מעכשיו מריצים **בלי** הסימון (התעודות רק נקראות). לפורטל אותו דבר.
- **TestFlight בטלפון:** ב-App Store Connect ← האפליקציה ← לשונית **TestFlight** ← הבנייה
  מופיעה אחרי כמה דקות ("Processing"). **Internal Testing** ← **+** ← קבוצה "צוות" ← להוסיף
  את עצמך (לפי ה-Apple ID). באייפון: להתקין את **TestFlight** מהחנות — ההזמנה מגיעה במייל,
  ומשם מתקינים. בודקים פנימיים לא עוברים ביקורת; זה הטלפון שלך תוך שעה.

---

## 6 · Google Play

1. [play.google.com/console](https://play.google.com/console) ← **Create developer account**
   ← **Yourself** (אישי). 25$ חד-פעמי. אימות זהות (תעודה + לפעמים קוד בדואר) — כמה ימים.
   חשבון אישי חדש חייב **בדיקה סגורה של 14 יום עם 12 בודקים** לפני שאפשר לפרסם
   (סעיף 7).
2. **Create app** פעמיים:

   | שדה | המערכת | הפורטל |
   |---|---|---|
   | App name | הרבליסט | הרבליסט — אזור המטופל |
   | Default language | Hebrew | Hebrew |
   | App or game | App | App |
   | Free or paid | Free | Free |

3. **מפתחות חתימה** (במחשב, פעם אחת). צריך JDK: להתקין [Temurin 21](https://adoptium.net)
   (הבחירה השנייה "Set JAVA_HOME" מסומנת). ואז ב-PowerShell, בתיקייה מגובה **מחוץ לפרויקט**:
   ```powershell
   keytool -genkeypair -v -keystore herbalist-clinic.keystore -alias clinic -keyalg RSA -keysize 2048 -validity 10000
   keytool -genkeypair -v -keystore herbalist-portal.keystore -alias portal -keyalg RSA -keysize 2048 -validity 10000
   ```
   כל פקודה שואלת סיסמה למאגר (לבחור, לשמור במנהל הסיסמאות) ופרטים (שם, ארגון — אפשר
   רק שם ומדינה `IL`). כשנשאלים על סיסמה למפתח — Enter (אותה סיסמה).
   - `ANDROID_KEYSTORE_CLINIC_B64` = base64 של `herbalist-clinic.keystore` (אותה פקודת
     PowerShell כמו ב-2, עם שם הקובץ)
   - `ANDROID_KEYSTORE_CLINIC_PASSWORD` = הסיסמה
   - `ANDROID_KEY_CLINIC_ALIAS` = `clinic`
   - `ANDROID_KEY_CLINIC_PASSWORD` = הסיסמה
   - וארבעת המקבילים עם `PORTAL` (alias `portal`).
   שני הקבצים לעולם לא נכנסים לפרויקט (ה-`.gitignore` חוסם `*.keystore`), ואם הם אובדים
   אי אפשר לעדכן את האפליקציה — Play App Signing מחזיק את המפתח הסופי, אבל מפתח ההעלאה
   הוא שלך.
4. **הרצה ראשונה:** Actions ← **Store apps · Android** ← Run workflow ← `clinic`, ולבטל את
   הסימון **Upload to Google Play** (האפליקציה עוד לא מכירה את המפתח). ירוק = בתחתית דף
   ההרצה יש **Artifacts** ← `clinic-android-…` ← להוריד, בתוכו `app-release.aab`.
5. **העלאה ראשונה ידנית:** Play Console ← האפליקציה ← **Testing** ← **Internal testing** ←
   **Create new release** ← לגרור את ה-`.aab`. גוגל תציע **Play App Signing** — לאשר.
   Release notes: "גרסה ראשונה". Save ← Review ← Start rollout. ב-**Testers** להוסיף רשימה
   עם המייל שלך; קישור ההצטרפות מופיע שם — לפתוח בטלפון.
6. **העלאות אוטומטיות מעכשיו:** Play Console ← **Setup** ← **API access** ← לקשר לפרויקט
   Google Cloud (ליצור חדש) ← **Service accounts** ← Create new service account ← עוקבים
   לקונסולת Google Cloud: שם "github-play", Create, בלי תפקיד, Done ← בשורת החשבון ←
   **Keys** ← Add key ← JSON ← הקובץ יורד. חזרה ב-Play Console ← Refresh ← לחשבון החדש
   **Manage Play Console permissions** ← לשתי האפליקציות: **Release to production, exclude
   devices, and use Play App Signing** + **Manage testing tracks**. Save.
   - `PLAY_SERVICE_ACCOUNT_JSON` = תוכן קובץ ה-JSON כפי שהוא (לפתוח בפנקס, להעתיק הכול).
   מעכשיו הרצה עם **Upload** מסומן מעלה ישר ל-Internal testing.

---

## 6.5 · Firebase — חובה לפני הבנייה הראשונה

האפליקציות מקבלות התראות (תזכורת לתור למטופל, תזכורת למשימה למטפל) דרך Firebase של גוגל,
בשתי הפלטפורמות. בלי הקבצים של Firebase הבנייה נעצרת — אז זה בא לפני ההרצה הראשונה.

1. [console.firebase.google.com](https://console.firebase.google.com) ← **Create a project** ← שם "Herbalist",
   בלי Google Analytics. חינם.
2. **Project settings** (גלגל השיניים) ← **Your apps** ← **Add app** ארבע פעמים:
   - Android, package `il.co.herbalist.clinic` ← Register ← **Download google-services.json**.
   - Android, package `il.co.herbalist.portal` ← אותו דבר.
   - iOS, bundle `il.co.herbalist.clinic` ← Register ← **Download GoogleService-Info.plist**.
   - iOS, bundle `il.co.herbalist.portal` ← אותו דבר.
   את שלבי "Add Firebase SDK" בכל אשף מדלגים (Next) — הקוד כבר מכיל אותם.
3. **Cloud Messaging** (באותו Project settings) ← **Apple app configuration** ← **APNs Authentication Key** ←
   Upload: קובץ ה-`.p8` מסעיף 2 (מפתח ה-APNs), ה-Key ID שלו וה-Team ID. לשתי אפליקציות ה-iOS.
4. ה-secrets ב-GitHub — **תוכן הקובץ כפי שהוא** (לפתוח בפנקס, להעתיק הכול):
   - `FIREBASE_ANDROID_CLINIC_JSON`, `FIREBASE_ANDROID_PORTAL_JSON` — שני קובצי ה-`google-services.json`.
   - `FIREBASE_IOS_CLINIC_PLIST`, `FIREBASE_IOS_PORTAL_PLIST` — שני קובצי ה-`GoogleService-Info.plist`.
5. **Service accounts** (באותו Project settings) ← **Generate new private key** ← הקובץ שיורד הוא ה-secret
   `FCM_SERVICE_ACCOUNT_JSON` **ב-Supabase** (Edge Functions ← Secrets), לא ב-GitHub — זה מה שמאפשר לשרת
   לשלוח (`DEPLOY.md`, "התראות בטלפון").

הקבצים האלה מזהים את הפרויקט ולא נכנסים ל-git (ה-`.gitignore` חוסם אותם).

---

## 7 · הבדיקה הסגורה (גוגל בלבד)

Play Console ← Testing ← **Closed testing** ← Create track "בטא" ← Testers ← רשימת מיילים
של **12 אנשים לפחות** (משפחה, חברים, קולגות — כל אחד עם חשבון Google) ← Create release
(אותו `.aab`, או להעלות מהאקשן). כולם חייבים **להצטרף דרך הקישור ולהשאיר את האפליקציה
מותקנת 14 יום רצוף**. אחרי 14 יום: **Publishing overview** ← **Apply for production access**,
עונים על כמה שאלות (מה בדקו, מה תיקנו). האישור לוקח כמה ימים.

הבודקים רואים את **קליניקת הבדיקות** (הבאנר "סביבת פיתוח") ומקבלים את פרטי הכניסה של
ה-smoke — לא חשבון אמיתי. איסור נתוני מטופלים אמיתיים חל גם כאן.

---

## 8 · הרישום בחנויות — הטקסטים, הצילומים וההצהרות

**הטקסטים** (שם, כותרת משנה, תיאור, מילות מפתח, הערות גרסה) כתובים בשתי השפות ב-
`apps/mobile-<app>/fastlane/metadata/` — `he/` ו-`en-US/` ל-App Store, `android/iw-IL/` ו-`android/en-US/`
ל-Google Play. לפני ההגשה מחליפים `https://app.YOUR-DOMAIN` בכתובת האמיתית (`privacy_url.txt`,
`support_url.txt`, `marketing_url.txt`) וממלאים את `review_information/` (השם, האימייל, הטלפון וחשבון
הבודקים) ואת `copyright.txt`. את הכול אפשר גם להדביק ביד בקונסולות.

**הצילומים**: `SMOKE_BASE_URL=http://localhost:3002 node scripts/render-store-shots.mjs` (מול build שרץ,
כמו ה-smoke) מצלם את מסכי הצוות מקליניקת הבדיקות בשתי השפות, בגדלים שהחנויות דורשות
(`fastlane/screenshots/` ל-App Store, `fastlane/metadata/android/…/images/` ל-Play, יחד עם
ה-feature graphic והאייקון 512). לצילומי הפורטל צריך מטופל בקליניקת הבדיקות עם סיסמה
(סעיף 8, "חשבון לבודקים") ב-`SMOKE_PORTAL_EMAIL` / `SMOKE_PORTAL_PASSWORD` ב-`apps/web/.env.test.local`.
העלאה ל-App Store Connect: Actions ← Store apps · iOS ← lane `metadata`. ל-Play — גרירה בקונסולה.

**ההצהרות** — מה עונים:
- **Apple → App Privacy:** Data collected: Contact Info (name, email, phone), Health & Fitness (health),
  Identifiers (user ID, device ID), User Content (photos — צוות בלבד). לכל אחד: Linked to the user — Yes;
  Used for tracking — No; Purpose — App Functionality. "Data not collected" לכל השאר.
- **Google Play → Data safety:** Collects: Personal info (name, email, phone, address), Health info,
  App activity? לא; Device IDs — כן (התראות). Encrypted in transit — Yes; users can request deletion —
  Yes (`/delete-account`); shared with third parties — No (ספקי משנה אינם "שיתוף").
  **Health apps declaration** — כן, אפליקציית בריאות (ניהול רשומות). **Government IDs** — כן
  (תעודות זהות של מטופלים, צוות בלבד). Ads — No.
- **Content rating** (Play) — שאלון "Utility/Productivity" ← הכול לא. **Target audience** — 18+.
- **קטגוריות:** צוות — Medical (משני Business); פורטל — Medical.
- **App Store → Age rating:** 4+ / "None" בכל השאלות; **Uses Health data** — לא (אין HealthKit).

---

## 9 · לפני ההגשה לביקורת

- **מדיניות פרטיות ותנאי שימוש** — הדפים `/privacy` ו-`/terms` באתר קיימים עם טיוטה
  שכתבתי מהמערכת עצמה (מה נאסף, מי הספקים). **העו"ד חייב לעבור עליהם** (GO-LIVE.md §2)
  לפני שהכתובות נכנסות לחנויות. הכתובות: `https://app.הדומיין/he/privacy`,
  `https://app.הדומיין/he/terms`.
- **מחיקת חשבון** — אפל דורשת מחיקה מתוך האפליקציה, גוגל דורשת כתובת: `/he/delete-account`
  מסביר, ובאפליקציה "איזור אישי ← מחיקת החשבון" (צוות) ו"החשבון שלי" (פורטל).
- **חשבון לבודקים** — בשתי החנויות יש שדה "Sign-in credentials" / "App access". הצוות:
  המייל והסיסמה של חשבון הבדיקות (הסנדבוקס). הפורטל: מטופל מקליניקת הבדיקות. דף הכניסה
  של הפורטל מקבל גם **קוד** מאותו מייל, וגם **סיסמה** — אבל רק לחשבון של קליניקת בדיקות;
  לכל מטופל אמיתי הסיסמה נדחית. שני צעדים בצד שלך:
  1. Supabase ← **Authentication ← Email Templates ← Magic Link**: להוסיף לגוף ההודעה שורה עם
     `{{ .Token }}` (למשל: "או להקליד את הקוד: {{ .Token }}"). בלי זה אין קוד במייל.
  2. לבודקים של הפורטל: Supabase ← **Authentication ← Users** ← המשתמש של המטופל מקליניקת
     הבדיקות (המייל שהוזמן משם) ← **Reset password** / לקבוע סיסמה. את המייל והסיסמה כותבים
     בשדה הבודקים בחנות. אם המטופל עוד לא נכנס אף פעם, קודם פותחים לו כניסה עם הקוד.
- **iOS "4.2"** — אפל דוחה אפליקציות שהן "אתר בקופסה". התשובה שלנו: התראות בטלפון
  (שלב 2), סרגל מצב וכפתור חזרה ילידיים, ובהמשך נעילה ביומטרית. **את הפורטל לא מגישים
  לפני שלב 2.**

---

## מה עוד לא כאן

- **התראות בטלפון** — מוכן משני הצדדים (סעיף 6.5 להקמה). באפליקציה: איזור אישי ← "התראות בטלפון"
  (צוות) ו"החשבון שלי" ← "תזכורות בטלפון" (מטופלים) — כפתור אחד שמבקש את ההרשאה. אחרי `33_push_devices_to_run.sql`
  ב-SQL editor.
- הורדת מסמכים, קובץ יומן והדפסה מתוך האפליקציה — בינתיים הכפתורים האלה מוסתרים
  באפליקציה ואומרים "זמין באתר".
- קישורים עמוקים (קישור מהודעה שנפתח ישר באפליקציה), נעילה ביומטרית, iPad.

---

## למי שרוצה להבין את הקוד

- `capacitor.config.ts` בכל מעטפת: הכתובת (`server.url`), הסיומת ל-User-Agent שהאתר מזהה
  (`HerbalistShell/<גרסה> (clinic|portal; ios|android)`), מסך הפתיחה, סרגל המצב.
- `packages/domain/src/shell.ts` — הזיהוי. `packages/native` — מה שהמעטפת מוסיפה לדף.
- `www/` — דף "אין חיבור" מקומי. `scripts/mobile-prepare.mjs` כותב לשם את הכתובת בזמן sync.
- אייקונים: `node scripts/render-mobile-assets.mjs` ואז `pnpm --filter @clinic/mobile-clinic assets`
  (ולפורטל) — מייצר את כל הגדלים מ-`app/icon.svg`.
- גרסה בחנות = `version` ב-`package.json` של המעטפת; מספר הבנייה עולה לבד עם כל הרצה.
- בדיקה במחשב: `pnpm smoke -- --shell` פותח את המסכים כפי שהאפליקציה פותחת אותם.
  אנדרואיד בפועל: Android Studio ← Open ← `apps/mobile-clinic/android` (אחרי
  `pnpm --filter @clinic/mobile-clinic sync:android` עם שני משתני הסביבה) ← Run על אמולטור.
- `.github/workflows/mobile-android.yml`, `mobile-ios.yml` — הבנייה; `scripts/fastlane/Fastfile`
  — החתימה וההעלאה ל-TestFlight. תג `mobile-v1.2.0` על commit בונה את שתי הפלטפורמות.
