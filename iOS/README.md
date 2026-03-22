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

Or from the terminal:

```bash
xcodegen generate
xcodebuild -project WakeMeUpiOS.xcodeproj -scheme WakeMeUp -destination 'generic/platform=iOS Simulator' build
```

## Current Scope

This is not yet the full production iOS app. It already includes:

- Onboarding / profile setup
- Native dashboard shell
- Swift sobriety engine port
- Free / Pro structure
- Local notification scheduling placeholder
- StoreKit 2 service placeholder

Next steps should focus on:

1. Freezing algorithm inputs and expected outputs.
2. Tightening patrol notification UX.
3. Connecting real products in App Store Connect.
4. Adding historical sessions and exports.

