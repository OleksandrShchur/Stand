# UX update: shift booking flow

- Added a home landing screen with "Мої найближчі зміни", empty state, cancel affordance, and a primary "Записатись на зміну" entry point.
- Added shared booking state tokens and reusable `StateBadge`, `DayCell`, and `SlotCard` components for available, selected, unavailable, full, mine, and today states.
- Redesigned the calendar with distinct available/selected/unavailable states, today marker, capacity micro-labels, legend, larger touch targets, and day aria labels.
- Redesigned location cards to show availability, keep full locations visible but disabled, sort by availability, and show a last-used hint from typed mock data.
- Redesigned time slots as light cards with selected/full/almost-full states, participant avatar chips, privacy note, and a sticky summary action bar.
- Redesigned confirmation around the selected date/time, location, participant list including "Ви", post-confirm capacity, cancellation note, and disabled loading CTA.
- Made completed stepper steps tappable with check icons and `aria-current="step"` for the active step.
- Added success-screen actions for `.ics` calendar download, "Мої зміни", and "Записатись ще".
- Added loading skeletons, inline conflict handling, retryable errors, and empty-state copy for dates without shifts.

## Backend/API needed

- `GET /api/my-shifts?upcoming=true`: return upcoming current-user shifts with `id`, `date`, `startTime`, `endTime`, `locationName`, `locationAddress`, and optional `cancelToken`.
- `DELETE /api/bookings/:id`: cancel a current-user booking from the home/my-shifts view.
- Calendar availability fields per day: `date`, `remaining`, `capacity`.
- Location availability for a selected date: `locationId`, `remaining`, `capacity`, optional `isLastUsed`.
- Slot participant visibility flag if privacy needs to be configured server-side.

This file explains how Visual Studio created the project.

The following tools were used to generate this project:
- create-vite

The following steps were used to generate this project:
- Create react project with create-vite: `npm init --yes vite@latest "stand.client" -- --template=react-ts  --no-rolldown --no-immediate --eslint`.
- Update `vite.config.ts` to set up proxying and certs.
- Add `@type/node` for `vite.config.js` typing.
- Update `App` component to fetch and display weather information.
- Create project file (`stand.client.esproj`).
- Create `launch.json` to enable debugging.
- Add project to solution.
- Update proxy endpoint to be the backend server endpoint.
- Add project to the startup projects list.
- Write this file.
