# Mobile builds in GitHub Actions

`release.yml` builds the native apps. Mobile has **no Docker container**, no GHCR package and no VPS credentials or infra writer token. Backend/frontend deployment belongs to `YU-CRM/infra`.

The app is built from the committed web bundle `www/`: the website's own build (the private `YU-CRM/frontend` repository, pinned as the `frontend` submodule) plus the native bridge, with the server address baked in. Whoever moves the `frontend` pin refreshes the bundle in the same commit:

```
npm --prefix frontend ci
YU_API_ORIGIN=https://yucrm.uz node scripts/build-web.mjs
git add frontend www
```

So CI needs no access to the frontend repository and no token. `www/` holds exactly what every browser downloads from the site and what the published APK contains, nothing more.

Every `main` push or manual **Build store-ready apps** run first performs the CI checks, then:

- **Android, Ubuntu:** installs Node 24, JDK 21 and SDK 36; checks that the bundle points at an https server; syncs the web assets into the Android project; with the four `ANDROID_*` signing secrets it builds and verifies the signed release APK and AAB (artifact `android-release-…`); without them it builds a **testing** APK signed with the runner's throwaway debug key (artifact `android-testing-…`, with a warning on the run). A testing build installs on a fresh phone but never over a build signed with another key, so it is not for publishing.
- **iOS, macOS 26/Xcode 26.6, manual runs only** until Apple signing material exists: syncs the iOS web assets; imports an Apple Distribution certificate into a temporary keychain; validates an App Store provisioning profile for `uz.inha.youthunion`; archives the shared App scheme; verifies code signing; exports a signed App Store Connect IPA and uploads it with dSYM files as an Actions artifact. The certificate, private keychain and installed profiles are removed afterward.

Artifacts include the source commit, run ID and attempt in their names and are retained for 14 days. Only APK/AAB, IPA and debug symbols are uploaded, never signing keys. PR workflows have no production credentials.

## GitHub environment

Create **prod**, restrict it to `main`, and configure:

| Type | Name | Value |
|---|---|---|
| Secret | `ANDROID_KEYSTORE_BASE64` | Base64 of the Android signing `.jks`. Phones only update to a build signed with the key the installed app has, so pick the key once and keep it |
| Secret | `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| Secret | `ANDROID_KEY_ALIAS` | Signing-key alias |
| Secret | `ANDROID_KEY_PASSWORD` | Signing-key password |
| Secret | `IOS_CERTIFICATE_BASE64` | Base64 of Apple Distribution `.p12`, exported with its private key |
| Secret | `IOS_CERTIFICATE_PASSWORD` | Password protecting that `.p12` |
| Secret | `IOS_PROVISION_PROFILE_BASE64` | Base64 of an App Store distribution `.mobileprovision` for this app/team |
| Variable | `IOS_TEAM_ID` | Your 10-character Apple Developer team ID |
| Variable | `ANDROID_VERSION_CODE_OFFSET` | Optional, defaults to `0` |
| Variable | `IOS_BUILD_NUMBER_OFFSET` | Optional, defaults to `0` |
| Variable | `IOS_XCODE_VERSION` | Optional, defaults to `26.6`; must be installed on the macOS 26 runner |

Without the Android secrets the Android job still succeeds with a testing build. The server address is not a CI setting: it is baked into `www/` by `build-web.mjs`.

Keep a safe backup of the Android signing key and Apple signing material. The native bundle/application ID is currently **uz.inha.youthunion**; register that same ID in Apple Developer/App Store Connect. If you change it, update Capacitor, Android, Xcode and the iOS profile validation/export mapping together.

`package.json` supplies the version name (`major.minor.patch`). Native build numbers are workflow run number + the relevant offset. Set an offset above existing builds when adopting CI; keep versions/build numbers increasing. Rerunning a workflow keeps the same build number, so rerun only builds not already uploaded, or start a new workflow run.

Before the first successful iOS run, create the app ID, App Store provisioning profile and Apple Distribution certificate through your Apple Developer account. A development, ad-hoc, enterprise or expired profile is rejected. Google Play must have its app listing and Play App Signing configured.

## Get files and publish

Open the completed run in GitHub Actions and download the `android-…` and `ios-…` artifacts. For the union's own distribution, publish the APK on the site (Admin → Mobile app); installed apps then offer the update. For the stores, upload the AAB through Google Play Console and the IPA through Apple's Transporter app/App Store Connect tooling. CI does not upload or release the app automatically.

The server address is compiled into the app. Changing it requires a new bundle and a new build. Changing backend runtime secrets does not require a native rebuild, but backend API changes must remain compatible with older installed clients.

The macOS runner includes the selected Xcode version as verified in the [official runner software inventory](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md). The signing flow follows [GitHub's Apple certificate guidance](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications); IPA export uses [Xcode archive export](https://help.apple.com/xcode/mac/current/en.lproj/dev23ea8b877.html). Review the Xcode pin when GitHub changes its runner inventory or Apple changes store submission requirements.
