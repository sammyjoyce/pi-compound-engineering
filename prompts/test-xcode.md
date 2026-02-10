---
description: Build and test an Xcode project locally (simulator)
---
# test-xcode (pi)

## Input

$ARGUMENTS

Optional: scheme name.

## Workflow

1. Verify Xcode tools:

```bash
xcodebuild -version
xcrun simctl list devices | head
```

2. Discover schemes (if needed):

```bash
xcodebuild -list
```

3. Run tests (adjust workspace/project as needed):

```bash
# Example (workspace)
xcodebuild \
  -workspace YourApp.xcworkspace \
  -scheme "$ARGUMENTS" \
  -destination 'platform=iOS Simulator,name=iPhone 15' \
  test
```

4. If tests fail:
- summarize the failing tests
- capture the relevant logs
- propose next debugging steps

If this repo does not contain an Xcode project, say so and stop.
