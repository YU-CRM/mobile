#!/usr/bin/env bash
# macOS only. Export a manually signed App Store Connect IPA; never upload it.
set -Eeuo pipefail
umask 077
for key in IOS_CERTIFICATE_BASE64 IOS_CERTIFICATE_PASSWORD IOS_PROVISION_PROFILE_BASE64 IOS_TEAM_ID; do
    [[ -n "${!key:-}" ]] || { echo "Missing $key"; exit 1; }
done
[[ "$IOS_TEAM_ID" =~ ^[A-Z0-9]{10}$ ]] || { echo 'Invalid IOS_TEAM_ID'; exit 1; }
xcode_version="${IOS_XCODE_VERSION:-26.6}"
[[ "$xcode_version" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]] || exit 2
export DEVELOPER_DIR="/Applications/Xcode_$xcode_version.app/Contents/Developer"
[[ -d "$DEVELOPER_DIR" ]] || { echo "Xcode $xcode_version is not installed on this runner"; exit 1; }
xcodebuild -version
offset="${IOS_BUILD_NUMBER_OFFSET:-0}"
[[ "$offset" =~ ^[0-9]{1,9}$ ]] || exit 2
build_number=$((10#$offset + GITHUB_RUN_NUMBER))
version="$(node -p 'require("./package.json").version')"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'package.json version must be major.minor.patch for iOS'; exit 1; }
signing="$(mktemp -d "$RUNNER_TEMP/yucrm-ios.XXXXXXXX")"
keychain="$signing/build.keychain-db"
profile_uuid=''
finish() {
    security delete-keychain "$keychain" >/dev/null 2>&1 || true
    if [[ -n "$profile_uuid" ]]; then
        rm -f -- "$HOME/Library/MobileDevice/Provisioning Profiles/$profile_uuid.mobileprovision"
        rm -f -- "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles/$profile_uuid.mobileprovision"
    fi
    rm -rf -- "$signing"
}
trap finish EXIT
export SIGNING_DIR="$signing"
python3 - <<'PY'
import base64, os
from pathlib import Path
for secret, filename in [('IOS_CERTIFICATE_BASE64', 'certificate.p12'), ('IOS_PROVISION_PROFILE_BASE64', 'profile.mobileprovision')]:
    encoded = ''.join(os.environ[secret].split())
    Path(os.environ['SIGNING_DIR'], filename).write_bytes(base64.b64decode(encoded, validate=True))
PY
keychain_password="$(openssl rand -base64 32)"
echo "::add-mask::$keychain_password"
security create-keychain -p "$keychain_password" "$keychain"
security set-keychain-settings -lut 3600 "$keychain"
security unlock-keychain -p "$keychain_password" "$keychain"
security import "$signing/certificate.p12" -P "$IOS_CERTIFICATE_PASSWORD" -t cert -f pkcs12 \
    -k "$keychain" -T /usr/bin/codesign -T /usr/bin/security
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$keychain_password" "$keychain" >/dev/null
security list-keychains -d user -s "$keychain" "$HOME/Library/Keychains/login.keychain-db"
security cms -D -i "$signing/profile.mobileprovision" > "$signing/profile.plist"
# Reject development/ad-hoc/expired profiles, wrong teams and wrong bundle IDs.
profile_uuid="$(python3 - <<'PY'
import datetime, os, plistlib, re
from pathlib import Path
profile = plistlib.loads(Path(os.environ['SIGNING_DIR'], 'profile.plist').read_bytes())
team = os.environ['IOS_TEAM_ID']
entitlements = profile['Entitlements']
if team not in profile['TeamIdentifier'] or entitlements['application-identifier'] != team + '.uz.inha.youthunion':
    raise ValueError('Provisioning profile does not match the team and uz.inha.youthunion')
if entitlements.get('get-task-allow') or profile.get('ProvisionedDevices') or profile.get('ProvisionsAllDevices'):
    raise ValueError('Use an App Store distribution profile, not development/ad-hoc/enterprise')
if profile['ExpirationDate'].replace(tzinfo=datetime.timezone.utc) <= datetime.datetime.now(datetime.timezone.utc):
    raise ValueError('Provisioning profile has expired')
uuid = profile['UUID']
if not re.fullmatch(r'[A-Fa-f0-9-]{36}', uuid): raise ValueError('Invalid profile UUID')
print(uuid)
PY
)"
for folder in "$HOME/Library/MobileDevice/Provisioning Profiles" "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"; do
    mkdir -p "$folder"
    cp "$signing/profile.mobileprovision" "$folder/$profile_uuid.mobileprovision"
done
export PROFILE_UUID="$profile_uuid"
python3 - <<'PY'
import json, os, plistlib, re
from pathlib import Path
# Apply provisioning only to the App target, not to SwiftPM framework targets.
project = Path('ios/App/App.xcodeproj/project.pbxproj')
text = project.read_text()
pattern = r'(504EC3181FED79650016851F /\* Release \*/ = \{.*?buildSettings = \{)(.*?)(\n\t\t\t\};)'
settings = {'CODE_SIGN_STYLE': 'Manual', 'CODE_SIGN_IDENTITY': 'Apple Distribution',
            'DEVELOPMENT_TEAM': os.environ['IOS_TEAM_ID'], 'PROVISIONING_PROFILE_SPECIFIER': os.environ['PROFILE_UUID']}
def update(match):
    body = match[2]
    for key, value in settings.items():
        body = re.sub(r'\n\s*' + re.escape(key) + r' = [^;]+;', '', body)
        body += '\n\t\t\t\t' + key + ' = ' + json.dumps(value) + ';'
    return match[1] + body + match[3]
text, count = re.subn(pattern, update, text, flags=re.S)
if count != 1: raise ValueError('App Release target changed; update the CI signing target selector')
project.write_text(text)
options = {'method': 'app-store-connect', 'destination': 'export', 'signingStyle': 'manual',
           'teamID': os.environ['IOS_TEAM_ID'], 'signingCertificate': 'Apple Distribution',
           'provisioningProfiles': {'uz.inha.youthunion': os.environ['PROFILE_UUID']},
           'manageAppVersionAndBuildNumber': False, 'stripSwiftSymbols': True, 'uploadSymbols': False}
Path(os.environ['SIGNING_DIR'], 'ExportOptions.plist').write_bytes(plistlib.dumps(options))
PY
mkdir -p release/ios
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
    -destination 'generic/platform=iOS' -archivePath "$PWD/release/ios/App.xcarchive" \
    "CURRENT_PROJECT_VERSION=$build_number" "MARKETING_VERSION=$version" \
    "OTHER_CODE_SIGN_FLAGS=--keychain $keychain" archive
codesign --verify --deep --strict release/ios/App.xcarchive/Products/Applications/App.app
xcodebuild -exportArchive -archivePath "$PWD/release/ios/App.xcarchive" \
    -exportOptionsPlist "$signing/ExportOptions.plist" -exportPath "$PWD/release/ios/export"
[[ -f release/ios/export/App.ipa ]] || { echo 'Signed IPA export is missing'; exit 1; }
echo "Signed iOS $version ($build_number) is ready for App Store Connect"
