# WakeMeUp iOS

Native iOS scaffold for the next phase of `醒了吗?`.

## Goals

- Ship an iPhone-first version with SwiftUI.
- Keep the BAC / sobriety engine separate from UI so it can be tested.
- Prepare for multilingual UI using the phone's preferred language.
- Prepare for StoreKit 2 and local notification based patrol reminders.

## Structure

- `WakeMeUp/App`
  - App entry and root navigation.
- `WakeMeUp/Core`
  - Domain models, localization helper, sobriety engine.
- `WakeMeUp/Services`
  - App state, persistence, notifications, monetization.
- `WakeMeUp/Features`
  - Setup, dashboard, upgrade flows.
- `WakeMeUp/Resources`
  - Localizable strings and asset catalog.
- `WakeMeUpTests`
  - Engine tests.

## Localization

The scaffold already includes:

- `en.lproj/Localizable.strings`
- `zh-Hans.lproj/Localizable.strings`

iOS will automatically pick the correct language based on the user's device language list.

## Build

From this folder:

```bash
xcodegen generate
open WakeMeUpiOS.xcodeproj
```

To run the app directly on this Mac with Mac Catalyst:

```bash
xcodegen generate
xcodebuild -project WakeMeUpiOS.xcodeproj -scheme WakeMeUp -destination 'platform=macOS,variant=Mac Catalyst' CODE_SIGNING_ALLOWED=NO build
open ~/Library/Developer/Xcode/DerivedData/WakeMeUpiOS-*/Build/Products/Debug-maccatalyst/WakeMeUp.app
```

The iPhone simulator route still works once the matching iOS simulator runtime is installed in Xcode Components.

## Current Scope

This is not yet the full production iOS app. It already includes:

- Onboarding / profile setup
- Native dashboard shell
- Settings screen
- Session history screen
- Swift sobriety engine port
- Free / Pro structure
- Local notification scheduling placeholder
- StoreKit 2 service placeholder

## Current Test Surface

Inside the current iOS shell you can already test:

- onboarding and demo loading
- drink logging
- second-level sobriety countdown rendering
- likely sober time display
- local patrol permission flow
- Pro purchase shell
- profile/settings editing
- archived session history

## Note About Local Tooling

If Xcode asks for license acceptance, run:

```bash
sudo xcodebuild -license
```

Without this, `xcrun`, simulator builds, and some Swift validation commands will be blocked.

Next steps should focus on:

1. Freezing algorithm inputs and expected outputs.
2. Tightening patrol notification UX.
3. Connecting real products in App Store Connect.
4. Expanding history into full exports and review.
