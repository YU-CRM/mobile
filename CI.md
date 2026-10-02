# Signed mobile builds

`release.yml` builds native files for the stores. Mobile has **no Docker container**, no GHCR package and no VPS credentials or infra writer token. Backend/frontend deployment belongs to `YU-CRM/infra`.

Every `main` push or manual **Build store-ready apps** run first performs CI checks, then:

- **Android, Ubuntu:** installs Node 24, JDK 21 and SDK 36; checks out the pinned private frontend; builds and syncs the Android web assets; signs APK/AAB with the upload key; verifies APK signing; uploads both as an Actions artifact.
- **iOS, macOS 26/Xcode 26.6:** builds and syncs the iOS web assets; imports an Apple Distribution certificate into a temporary keychain; validates an App Store provisioning profile for `uz.inha.youthunion`; archives the shared App scheme; verifies code signing; exports a signed App Store Connect IPA and uploads it with dSYM files as an Actions artifact. The certificate, private keychain and installed profiles are removed afterward.

Artifacts include the source commit, run ID and attempt in their names and are retained for 14 days. Only APK/AAB, IPA and debug symbols are uploaded, never signing keys. PR workflows have no production credentials. The frontend submodule remains pinned: update it in a mobile commit when you want website changes in a native release.

## GitHub environment

Create **prod**, restrict it to `main`, and configure:

| Type | Name | Value |
|---|---|---|
| Secret | `FRONTEND_READ_TOKEN` | Fine-grained PAT limited to `YU-CRM/frontend`, Contents: read |
| Secret | `ANDROID_KEYSTORE_BASE64` | Base64 of the Android upload `.jks` |
| Secret | `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| Secret | `ANDROID_KEY_ALIAS` | Upload-key alias |
| Secret | `ANDROID_KEY_PASSWORD` | Upload-key password |
| Secret | `IOS_CERTIFICATE_BASE64` | Base64 of Apple Distribution `.p12`, exported with its private key |
| Secret | `IOS_CERTIFICATE_PASSWORD` | Password protecting that `.p12` |
| Secret | `IOS_PROVISION_PROFILE_BASE64` | Base64 of an App Store distribution `.mobileprovision` for this app/team |
| Variable | `YU_API_ORIGIN` | Public backend/site origin, e.g. `https://yu.example.uz`; no path |
| Variable | `IOS_TEAM_ID` | Your 10-character Apple Developer team ID |
| Variable | `ANDROID_VERSION_CODE_OFFSET` | Optional, defaults to `0` |
| Variable | `IOS_BUILD_NUMBER_OFFSET` | Optional, defaults to `0` |
| Variable | `IOS_XCODE_VERSION` | Optional, defaults to `26.6`; must be installed on the macOS 26 runner |

Keep a safe backup of the Android upload key and Apple signing material. The native bundle/application ID is currently **uz.inha.youthunion**; register that same ID in Apple Developer/App Store Connect. If you change it, update Capacitor, Android, Xcode and the iOS profile validation/export mapping together.

`package.json` supplies the store version (`major.minor.patch`). Native build numbers are workflow run number + the relevant offset. Set an offset above existing store builds when adopting CI; keep versions/build numbers increasing. Rerunning a workflow keeps the same store build number, so rerun only builds not already uploaded, or start a new workflow run.

Before the first successful iOS run, create the app ID, App Store provisioning profile and Apple Distribution certificate through your Apple Developer account. A development, ad-hoc, enterprise or expired profile is rejected. Google Play must have its app listing and Play App Signing configured. Missing signing settings fail the relevant job clearly; neither job silently publishes an unsigned output.

## Get files and publish

Open the completed run in GitHub Actions and download the `android-...` and `ios-...` artifacts. Upload the AAB through Google Play Console. Upload the IPA through Apple's Transporter app/App Store Connect tooling. Configure listings, privacy/data-safety answers, screenshots and release review in each store. CI does not upload or release the app automatically.

`YU_API_ORIGIN` is compiled into the app. Changing it requires a new build and store release. Changing backend runtime secrets does not require a native rebuild, but backend API changes must remain compatible with older installed clients.

The macOS runner includes the selected Xcode version as verified in the [official runner software inventory](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md). The signing flow follows [GitHub's Apple certificate guidance](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications); IPA export uses [Xcode archive export](https://help.apple.com/xcode/mac/current/en.lproj/dev23ea8b877.html). Review the Xcode pin when GitHub changes its runner inventory or Apple changes store submission requirements.

Windows local validation can check workflow syntax, the shared scheme and signing-script structure. Actual signed Android and iOS compilation requires your signing material and the configured GitHub runners; it has not been performed against a store account by this setup task.
