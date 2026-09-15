# אפליקציות החנויות והתראות בטלפון — איך זה בנוי ומה נלמד בדרך הקשה

נטען אוטומטית כשנוגעים בקבצים בתיקייה הזאת. הכללים שחלים על כל הקוד נמצאים ב-`CLAUDE.md`
של השורש, והמפה של הריפו ב-`ARCHITECTURE.md`. כשמשנים משהו כאן, מעדכנים גם את הפסקה שלו.

- **האפליקציות לחנויות:** `apps/mobile-clinic` ו-`apps/mobile-portal` (Capacitor 8) הן מעטפות דקות שטוענות את
  האתר החי (`server.url` מ-`HERBALIST_APP_URL`/`HERBALIST_PORTAL_URL`) — אין עותק ארוז של האתר. האתר מזהה
  מעטפת **רק** בסיומת ה-User-Agent `HerbalistShell/<גרסה> (clinic|portal; ios|android)`, דרך `parseShellUserAgent`
  ב-`packages/domain/src/shell.ts` (בדיקה שם קוראת את שני קובצי ה-config ומוודאת שהסיומת עדיין נפרסת): `proxy.ts`
  לא מפנה מעטפת מנותקת ל-`/about`; `shellInitScript` (מצורף ל-`themeInitScript`, ובפורטל לבדו) כותב
  `data-shell="ios|android"` על `<html>` לפני הציור; `base.css` ("The store apps") מוסיף את שולי סרגל המצב
  (`env(safe-area-inset-top)`) ל-`[data-top-bar]`, לסרגל הצד ול-`body` בלי סרגל, ומסתיר `[data-native-download]`
  (ייצוא, הורדת מסמך, .ics, הדפסה — **כל פקד כזה חדש מקבל את הסימון**), כשהערה `[data-native-note]` נגלית רק שם
  (`common.shell.*`). `InstallHint` חוזר ריק במעטפת. `packages/native` הוא `NativeShellBridge` בשני ה-layouts:
  מרנדר כלום, ורק במעטפת טוען דינמית את `bridge.ts` (סרגל מצב לפי `data-theme`, כפתור החזרה באנדרואיד —
  סוגר דיאלוג/חלונית פתוחים ב-Escape לפני `history.back` — `appUrlOpen`, הסתרת ה-splash). `pnpm smoke -- --shell`
  פותח ארבעה מסכים עם ה-UA של המעטפת ובודק את כל זה. אייקונים ומסכי פתיחה: `node scripts/render-mobile-assets.mjs`
  ואז `pnpm --filter @clinic/mobile-<app> assets` (מ-`app/icon.svg`; לא לגעת ב-`res/mipmap-*` וב-`Assets.xcassets`
  ביד). הבנייה וההעלאה ב-`.github/workflows/mobile-android.yml` ו-`mobile-ios.yml` (ידני או תג `mobile-v*`; iOS
  דרך `scripts/fastlane/Fastfile` על runner של מק — אין מק אצל המשתמש). שמות ה-secrets, הצעדים בחנויות והמגבלות
  (14 יום בדיקה סגורה בגוגל, 4.2 של אפל) ב-`MOBILE.md`, שהוא המדריך למשתמש. גרסה בחנות = `version` ב-`package.json`
  של המעטפת; `versionCode`/build number = מספר ההרצה. ה-Firebase files וה-keystores לעולם לא ב-git

- **התראות בטלפון — צד האפליקציה:** `packages/native/src/push.ts` עוטף את `@capacitor-firebase/messaging` (נטען דינמית,
  רק במעטפת). `PushRegistration` יושב בשני ה-frames המחוברים (`(app)/layout.tsx`, `portal-shell.tsx`) עם ה-server
  action של האפליקציה (`registerPushDevice` / `registerPortalPushDevice` → `register_push_device`): רושם את הטוקן
  כשההרשאה כבר ניתנה, מאזין לרוטציה של טוקן, ועוקב אחרי לחיצה על התראה רק לכתובת באותו origin. ההרשאה נשאלת
  **רק** מהכרטיס "התראות בטלפון" (`PushSettings`, ב-`/account` של שתי האפליקציות) — לא בהפעלה. הטוקן נשמר גם
  בעוגייה `herbalist-push-token`, וה-sign-out (`handleSignOut`, `portalSignOut`) קורא ממנה ומבטל את הרישום לפני
  היציאה. במעטפות: `App.entitlements` (`aps-environment`), `UIBackgroundModes`, שלושת ה-hooks ב-`AppDelegate`,
  `GoogleService-Info.plist` / `google-services.json` **לא ב-git** — ה-workflows כותבים אותם מ-secrets ונכשלים
  בלעדיהם; `experimental.ios.spm.packageOptions` ב-config בגלל התנגשות זהות ב-SPM; באנדרואיד האייקון הקטן הוא
  `ic_launcher_foreground` והערוץ `reminders`
