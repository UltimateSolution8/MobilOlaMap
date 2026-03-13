# Split APK Plan: Citizen + Superherooo

## Goal
Create two production-grade Android APKs from the same codebase and backend:
- Citizen app (buyer only)
- Superherooo app (helper only)

Both apps must:
- Use the same backend/realtime stack
- Keep Google Maps enabled
- Keep Zego live KYC capability where relevant (helper)
- Keep dev OTP visible (`EXPO_PUBLIC_DEV_SHOW_OTP=true`)

## Architecture Approach
Use one React Native codebase with build-time role locking via `EXPO_PUBLIC_APP_VARIANT`:
- `buyer` => citizen-only APK
- `helper` => superherooo-only APK
- `unified` => legacy combined app

Build-time role locking controls:
- App identity (`name`, `slug`, package/bundle id)
- Allowed auth role
- Navigation exposure (no cross-role signup screens)
- Login role selector visibility

## Implementation Plan (Production Sequence)
1. Introduce app variant config and role lock in runtime config.
2. Add variant-aware app metadata in `app.config.js`:
   - buyer: `com.helpinminutes.citizen`
   - helper: `com.helpinminutes.partner`
3. Lock auth/navigation by variant:
   - hide role segmentation when locked
   - block wrong-role sign in/signup at auth layer
   - avoid cross-role auth routes in stack
4. Keep shared backend URLs and socket URL configurable by env.
5. Build and validate two release APKs from Docker.
6. Run smoke + E2E checks for both app roles.
7. Hand off APK artifacts + reproducible build commands.

## User Stories
1. As a citizen, I can install only the citizen app and log in/create tasks without seeing helper workflows.
2. As a superherooo, I can install only the partner app and receive/accept/complete tasks without seeing citizen booking flows.
3. As an operator, I can deploy both APKs independently while keeping one backend and one realtime infrastructure.
4. As QA, I can verify role mismatch is blocked with clear error messages in each app.
5. As product, I can keep feature parity for maps, notifications, OTP, task states, and helper KYC.

## Test Cases (Production QA)

### A. Build and Install
1. Install citizen APK and helper APK together on same Android device (package IDs must not conflict).
2. Verify app names/icons are distinguishable in launcher.
3. Verify both apps open without crash on cold start.

### B. Auth and Role Isolation
1. Citizen app:
   - Role selector hidden.
   - Citizen OTP login works.
   - Helper OTP login is blocked with role error.
   - Citizen signup shown; helper signup not reachable.
2. Helper app:
   - Role selector hidden.
   - Helper OTP login works.
   - Citizen OTP login is blocked with role error.
   - Helper signup shown; citizen signup not reachable.
3. Dev OTP label visible in OTP screen for both apps.

### C. Citizen Functional Flow
1. Citizen creates immediate task successfully.
2. Citizen creates scheduled task successfully.
3. Citizen sees assigned helper updates and OTP values.
4. Citizen can complete rating flow after completion.
5. Citizen receives only citizen-relevant notifications.

### D. Superherooo Functional Flow
1. Go online successfully.
2. Receive nearby searching tasks in realtime.
3. Accept task.
4. Arrival selfie upload works.
5. Start with arrival OTP works.
6. Completion selfie upload works.
7. Complete with completion OTP works.
8. Post-completion rating flow works.

### E. Zego + KYC
1. Helper app can join live KYC session from mobile helper flow.
2. Admin can start live KYC session.
3. Admin can capture selfie/doc-front/doc-back snapshots.
4. Snapshots persist and are visible via admin KYC list API.

### F. Maps and Network
1. Google Maps renders task markers/routes in both apps where applicable.
2. Realtime socket reconnect behavior works after network switch.
3. Airplane mode upload retry behavior works for selfie queue.

### G. Session and Stability
1. Session timeout leads to sign-out and return to login.
2. No keyboard flicker crash on OTP inputs.
3. No helper task screen flicker during OTP entry.
4. No app crash during camera/selfie flow.

## Release Checklist
1. Verify `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` injected.
2. Verify `EXPO_PUBLIC_DEV_SHOW_OTP=true`.
3. Verify `EXPO_PUBLIC_SOCKET_URL` points to active realtime deployment.
4. Run E2E API dry-run for task + selfie flow.
5. Attach APK SHA256 checksums for release traceability.

