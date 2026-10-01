# Youth Union — iOS and Android app

The phone app is the website's own front end, the same screens as the website's mobile layout,
running in a native shell ([Capacitor 8](https://capacitorjs.com)). It opens on the sign-in
screen and stays signed in, like any app, until the person signs out.

Written for whoever builds and releases the app. The server needs no extra configuration for
it: the same deployment serves the website and the app.

The app is one of three repositories:

| Repository | What it holds |
|---|---|
| **mobile** (this one) | The native shell: Capacitor config, the Android and iOS projects, the glue in `src/`. |
| [frontend](https://github.com/YU-CRM/frontend) | The screens, styles and translations. Checked out here at `frontend/` as a git submodule. Private. |
| [backend](https://github.com/YU-CRM/backend) | The server the app talks to. Private. |

Building the app needs read access to the frontend repository.

---

## How it fits together

| | Website | App |
|---|---|---|
| Front end | `frontend/dist/`, served by the server | a copy of `frontend/dist/` inside the app (`www/`) |
| Talks to | its own origin | the server address baked in at build time (`YU_API_ORIGIN`) |
| Signed in by | HttpOnly cookie | a session token in the Keychain (iOS) or the Keystore-backed store (Android), sent as `Authorization: Bearer` |

A WebView does not reliably keep cookies for a server on another origin (iOS treats them as
third-party), so the app holds its token itself. The server accepts a bearer token **only**
from the app's two fixed origins, `capacitor://localhost` (iOS) and `https://localhost`
(Android), and gives only those origins CORS access. The website's cookie and CSRF rules are
unchanged. See `server/src/http/native-app.ts` in the backend repository.

A new session reaches the app in the `X-YU-Session` response header. `src/native.js` stores it
and attaches it to every request (`YUNative.fetch`). The page's own script never sees the token,
so even injected script could not take the session off the device.

The web code reaches the app through `window.YUNative`, defined in `src/native.js`; on the
website it does not exist and every hook is a no-op. What `src/native.js` adds:

- **Session token** in secure storage; a reinstall starts signed out.
- **Report photos** are fetched with the token and shown as blobs, since an `<img>` cannot send it.
  Tapping a photo opens it full size.
- **Android Back** closes the open menu, modal or drawer, then steps back, and leaves the app from Home or sign-in.
- **External links** open in the in-app browser.
- **System bars**: the page draws edge to edge, and the CSS pads for the status bar and home indicator (`--safe-*` in `frontend/src/styles/tokens.css`).
- **Tab bar** hides while the keyboard is up.

Dropdowns open as a bottom sheet in the app's own design rather than the system list. That is
`frontend/src/js/picker.js`, shared with the website at phone width, so the app and the mobile website match.

---

## Setup

Needs **Node 24+**, plus:

- **Android:** JDK 21 and the Android SDK (platform 36), most easily through Android Studio.
- **iOS:** a Mac with Xcode. iOS 15 is the minimum. Dependencies come through Swift Package Manager; there is no CocoaPods step.

```bash
git clone --recurse-submodules https://github.com/YU-CRM/mobile.git
cd mobile
npm install
npm run frontend:install   # the front end's own dependencies (fonts, icons), in frontend/
```

If `frontend/` is empty, run `git submodule update --init`.

---

## Running it against a local server

Start the server as usual (`npm run dev` in the backend repository, port 3000), then:

```bash
npm run build:dev               # web build pointed at http://localhost:3000, synced into both native projects
npm run open:android            # Android Studio: run on an emulator or a USB device
adb reverse tcp:3000 tcp:3000   # lets the device reach port 3000 on this machine
```

Plain `http` is allowed only in **debug** Android builds, and only to `localhost`, `127.0.0.1` and
`10.0.2.2` (`android/app/src/debug/`). Release builds are https-only.

To use a different local server, set the address yourself (http is accepted for localhost only):

```bash
YU_API_ORIGIN=http://localhost:3001 node scripts/build-web.mjs && npx cap sync
```

Debug builds can be inspected in Chrome at `chrome://inspect` (Android) or Safari's Develop
menu (iOS).

---

## Building a release

**1. Build the web part against the production server.** Use the same address as the server's
`APP_ORIGIN`, which must be https:

```bash
YU_API_ORIGIN=https://yu.example.uz npm run build
# PowerShell: $env:YU_API_ORIGIN = "https://yu.example.uz"; npm run build
```

**2. Raise the version** before every store upload:

- Android: `versionCode` (+1 each upload) and `versionName` in `android/app/build.gradle`.
- iOS: Version and Build in Xcode, under the App target's General tab.

**3. Android: sign and build an App Bundle for Google Play.** Create the upload key once and keep
it, and its passwords, somewhere safe. Losing it means asking Google to reset the upload key.

```bash
keytool -genkeypair -v -keystore youth-union-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
npx cap build android --androidreleasetype AAB \
  --keystorepath /path/to/youth-union-upload.jks --keystorealias upload \
  --keystorepass '…' --keystorealiaspass '…'
```

Never commit the keystore. The output is `android/app/build/outputs/bundle/release/app-release-signed.aab`.

**4. iOS: archive in Xcode.** Run `npm run open:ios`, choose your Team under Signing &
Capabilities, select *Any iOS Device*, then *Product → Archive → Distribute App*.

### Before the first store upload

- **App ID** is `uz.inha.youthunion` (`capacitor.config.json`, `android/app/build.gradle`, and the
  Xcode bundle identifier). It cannot be changed once the app is published, so change it now if
  the union wants a different one.
- **App name** is "Youth Union" (`capacitor.config.json`, `android/app/src/main/res/values/strings.xml`,
  and `CFBundleDisplayName` in `ios/App/App/Info.plist`).
- **Store listings** need a privacy policy URL (the website's `#/privacy` page) and the data-safety
  / privacy-label answers. The app collects name, university email, phone, study group, and
  photos sent as mission reports. Accounts can be deleted from inside the app (Profile), which
  Apple requires.

---

## Day to day

- **The app carries its own copy of the front end**, pinned to one commit of the frontend
  repository. A front-end change reaches app users only with a new app release: move the
  submodule forward (`cd frontend && git pull origin main`, then commit `frontend` here), run
  `npm run build`, then steps 2 to 4. Older app versions stay installed for a
  while, so keep server API changes backward compatible.
- **After changing `capacitor.config.json` or adding a plugin**, run `npx cap sync`.
- **Icons and splash screens** are drawn by `scripts/icons.mjs` from the sparkle in
  `frontend/src/favicon.svg`. Run `npm run icons` after `npx cap add`, or when the mark changes.
- `www/`, `android/app/src/main/assets/public` and `ios/App/App/public` are build output and are not committed.
