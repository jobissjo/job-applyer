# ApplyPilot mobile

Native Expo SDK 58 / React Native app for the existing JobApply workspace. It uses the frontend's light teal palette, card layouts, copy, and application workflows, adapted to touch screens with bottom navigation and a More menu.

## Run

Use Node.js 22.13 or newer and npm.

```powershell
cd mobile-app
npm ci
npm start
```

Open the QR code in an SDK 58 compatible Expo Go client on Android or iOS. The phone and development computer must be able to reach one another. The hosted backend is already configured; no local backend is needed.

```powershell
npm run android
npm run ios
npm run web
```

The Android command requires a connected device or emulator. The iOS simulator command requires macOS; physical iPhones can open the project in Expo Go from a Windows development machine. The web command uses port 8080, which the deployed backend currently allows through CORS. If the existing Vite frontend occupies that port, stop it first. Opening the web preview on another port requires adding that origin to the backend's CORS configuration and redeploying the API. Native apps do not use browser CORS.

## Backend

Default host: `https://api.apply-pilot.jotech.in`.

Requests use `/api`, confirmed against the deployed `/openapi.json`. To override the host, copy `.env.example` to `.env.local` and set:

```dotenv
EXPO_PUBLIC_API_URL=https://api.apply-pilot.jotech.in
```

The host or the complete `/api` URL is accepted, including a trailing slash. Restart Expo after changing the value. For a local API on a physical phone, use the development computer's LAN IP instead of localhost. Do not place credentials or API keys in Expo public environment variables.

JWT sessions use Expo SecureStore on Android/iOS and sessionStorage for the web preview. Expired authenticated sessions return to login. Network errors preserve the stored session and show a reconnect action. Requests show backend validation errors and time out without automatically retrying sends.

## Workflows

- Sign in or register with the same backend account as the website.
- See dashboard statistics, setup progress, and recent applications.
- Search and paginate saved jobs by source; open the original listing, analyze fit, choose a resume, generate/edit a cover letter, add a recruiter contact, and prepare an application.
- Enter a role found elsewhere through Manual apply, or record an application already submitted through another channel.
- Review and save the latest message and attachment before approving an immediate or scheduled send. Cancel scheduled sends to edit them. Missing recruiter contacts remain blocked by the API.
- Use Auto apply to discover and prepare opportunities, review individual emails, select ready applications, and explicitly approve their send/schedule. Partial errors remain visible and do not stop the other selected records from being processed.
- Send or schedule edited follow-ups to the original recipient, optionally attach the resume, inspect history, and cancel pending follow-ups.
- Upload PDF/DOCX resumes from the device picker, rename/activate/map resumes to target roles, view extracted text, and download/share authenticated files.
- Track learning statuses, notes, and resource links; search skills/linked jobs, unlink jobs, and add AI skill-gap suggestions from opportunities/applications.
- Generate interview plans with optional resume/context; inspect study topics, practice tasks, questions, and answer guides; save section completion; explicitly replace an existing checklist.
- Manage profile, target roles, recruiter contacts, AI provider keys/models/priorities, and saved SMTP settings with connection tests. Blank replacement secrets preserve saved values.

Scheduled delivery runs on the backend's existing worker/Beat services. The phone does not need to remain open. Configure your profile, AI provider, and SMTP settings as needed for those features.

## Checks

```powershell
npm run typecheck
npm run lint
npm test
npx expo export --platform web
npx expo export --platform android --platform ios --output-dir dist-native
```

The automated tests exercise the real TypeScript HTTP client with mocked responses: production URL normalization, JWT headers, session expiry, validation errors, multipart uploads, binary downloads, offline behavior, and no automatic send retries. They also exercise every mobile API service call against the deployed OpenAPI snapshot in `tests/backend-openapi.json` (captured 17 October 2026), checking method, route, and required request fields. No live account is created and no emails are sent by these tests.

Type checking, lint, API tests, and Android/iOS/web JavaScript bundle exports were run during implementation. Signed native binaries and authenticated device interactions still require testing with your account; bundle export is not a device test.

## Installable builds

`eas.json` includes an Android APK preview profile and a production profile for Android/iOS. App identifiers are `in.jotech.applypilot`; adjust them before store publication if needed.

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform all --profile production
```

The first setup links the project to your Expo account. EAS handles signing prompts; iOS production builds require your Apple developer credentials. These commands upload the project and start cloud builds. No cloud build or store submission was started during implementation. See the official [EAS Build guide](https://docs.expo.dev/build/introduction/) and [APK guide](https://docs.expo.dev/build-reference/apk/).

## Source layout

- `src/app/`: Expo Router routes and authenticated layouts.
- `src/screens/`: feature screens and application workflows.
- `src/components/ui.tsx`: shared mobile controls, theme, page layout, and confirmations.
- `src/services/api.ts`: typed methods corresponding to the web frontend's services.
- `src/services/http.ts`: backend URL, JWT headers, timeouts, and errors.
- `src/services/files.ts`: document picking, multipart upload, and authenticated sharing/download.
- `src/providers/session.tsx`: secure session restore/login/logout.
- `tests/`: transport tests and deployed API contract snapshot.
