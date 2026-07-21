<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# RepairSync

This contains the RepairSync web app plus Capacitor native wrappers.

View your app in AI Studio: https://ai.studio/apps/8872b89c-0114-4b4e-a60e-dc84d88b6556

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Copy `.env.example` to a local `.env` file and fill in required values.
3. Run the app: `npm run dev`

## iOS Wrapper

The iOS app uses Capacitor, Firebase Messaging, Firebase Auth, and Google Sign-In. The wrapper is configured for bundle ID `com.repairsyncios.sms` and the hosted app URL in `capacitor.config.ts`.

1. Keep `ios/App/App/GoogleService-Info.plist` present locally. It is intentionally ignored because this GitHub repo is public.
2. Sync native assets and Swift Package dependencies: `npm run cap:sync`
3. Open the iOS project: `npm run cap:open:ios`

Build check used locally:

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```
