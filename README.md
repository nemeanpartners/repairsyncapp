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

## Apple Login And IAP

Apple setup links:

- Apple Identifiers / Service ID: https://developer.apple.com/account/resources/identifiers/list
- Apple Sign in environment docs: https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple
- Apple App Store Connect subscriptions: https://appstoreconnect.apple.com/apps
- Apple app shared secret: https://appstoreconnect.apple.com/access/shared-secret
- Firebase Authentication providers: https://console.firebase.google.com/project/gen-lang-client-0477801246/authentication/providers

Suggested Apple identifiers for this app:

- iOS bundle ID / App ID: `com.repairsyncios.sms`
- Service ID: `com.repairsyncios.sms.service`
- Website domain for Sign in with Apple: `repairsync.ai.studio`
- Firebase OAuth return URL: `https://gen-lang-client-0477801246.firebaseapp.com/__/auth/handler`

Create these auto-renewable subscription product IDs in App Store Connect:

- `com.repairsyncios.sms.starter.monthly`
- `com.repairsyncios.sms.starter.yearly`
- `com.repairsyncios.sms.pro.monthly`
- `com.repairsyncios.sms.pro.yearly`

Set `APPLE_IAP_SHARED_SECRET` in the backend runtime before testing Apple purchases. The iOS wrapper exposes `window.RepairSyncIAP` only inside the native iPhone app, so web and desktop checkout continue to use Stripe.
