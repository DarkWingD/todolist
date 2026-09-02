# Kitchen Board

A local-first meal planner and shopping list for Android. Same screens as
ToDoList's Meals tab — they come from `@todolist/kitchen-ui` — but with **no
account, no server and no network**. Everything lives on the device, and
import/export is how data moves.

## Running it in a browser

```bash
pnpm --filter kitchen-board dev     # http://localhost:5174
```

Storage falls back to `localStorage`, sharing falls back to a download or the
clipboard, so the whole app is usable without a device attached.

## Building for Android

```bash
pnpm --filter kitchen-board build   # web assets into dist/
pnpm --filter kitchen-board exec cap sync android
cd android && ./gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/`.

### Toolchain notes

Three things bite on a fresh Windows machine, all already handled in the repo —
this records _why_, so nobody undoes them:

- **`JAVA_HOME` and `ANDROID_HOME` are usually unset** even after installing
  Android Studio. Point them at `…/Android Studio/jbr` and
  `%LOCALAPPDATA%\Android\Sdk`.
- **Android Studio bundles JDK 25, and Capacitor ships Gradle 8.14.3, which
  only supports up to Java 24** — the symptom is `Unsupported class file major
version 69`. The wrapper is pinned to **Gradle 9.1.0** here for that reason.
- **Capacitor's plugins pin a Java 21 toolchain**, which then isn't on the
  machine. Rather than require a second JDK be installed by hand,
  `settings.gradle` applies the **foojay resolver** so Gradle downloads its own
  JDK 21. That is what the error _"Toolchain download repositories have not
  been configured"_ is asking for.

Missing SDK platforms and build-tools install themselves on first build,
provided the SDK licences have been accepted (Android Studio does this).

## Installing on a phone

Enable Developer options → USB debugging, plug in, accept the prompt on the
device, then:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

`app-debug.apk` is self-signed by the debug keystore. The release key for Play
Store signing is a separate concern and must never be committed — see the
patterns in the root `.gitignore`.

## Layout

| Path                                  | What it is                                                       |
| ------------------------------------- | ---------------------------------------------------------------- |
| `src/store/memory.ts`                 | The document, and the adapters the shared screens talk to        |
| `src/store/persistence.ts`            | Storage port — `localStorage` in a browser                       |
| `src/store/nativeStorage.ts`          | Storage port — a real file via `@capacitor/filesystem`           |
| `src/share.ts` / `src/nativeShare.ts` | Share port: download/clipboard, or the OS share sheet            |
| `src/platform.ts`                     | The only place that asks whether this is a device                |
| `src/theme.ts`                        | Theme, appearance, density and text size, kept in `localStorage` |

Everything platform-specific sits behind a port, so no screen contains
`if (isNative)`. Note the asymmetry: **import needs nothing native** —
`<input type="file">` opens the real Android picker through Capacitor's bridge.
Only writing out is blocked in a WebView.
