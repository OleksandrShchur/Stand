Accessibility review — 18 October 2026
====================================

The public booking flow and active admin routes were reviewed against
[WCAG 2.2 A/AA](https://www.w3.org/TR/WCAG22/), using rendered axe-core audits,
Chrome accessibility trees, and browser keyboard events. Lighthouse/DevTools
MCP tools were unavailable, so axe-core supplied the automated coverage.

The initial 34 snapshots exposed ten kinds of failures: missing main landmarks
and primary headings, heading order, uncontained content, invalid sidebar lists,
unnamed switches and icon buttons, unnamed progress bars, low text contrast, and
an invalid button role on a time-slot label. Exercising the mobile drawer also
revealed its missing dialog name.

Changes include named landmarks and controls, logical heading levels, a visible
skip link, page/step titles and focus management, stronger focus indicators and
input borders, readable status colors, larger icon targets, calendar reflow at
320 CSS pixels, field-error focus and announcements, and reduced-motion support
for the booking transition. Date/time explanations and booking confirmation
messages remain available until dismissed.

Reproduce the browser checks
----------------------------

From the repository root, with Node.js 22+ and Chrome installed:

```powershell
npm --prefix stand.client run build
New-Item -ItemType Directory -Force artifacts | Out-Null
Invoke-WebRequest 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js' -OutFile artifacts/axe.min.js
$a11yProfile = Join-Path (Get-Location) 'artifacts/accessibility-browser'
Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' -WindowStyle Hidden -ArgumentList @('--headless=new', '--remote-debugging-port=9241', ('--user-data-dir="' + $a11yProfile + '"'), '--no-first-run', '--no-default-browser-check', 'about:blank')
node tests/accessibility.mjs
```

The runner serves the production build at `127.0.0.1:5198` with isolated fixture
responses. It never contacts the real backend or database; mutations are
rejected, apart from a read-only schedule preview. It checks all axe rules
tagged WCAG A/AA through 2.2 plus best practices, and fails on any violation or
horizontal page overflow. `AXE_PATH` and `A11Y_CHROME_URL` override the axe file
and Chrome debug endpoint. `A11Y_REPORT` sets the report basename.

Coverage includes desktop (1280px) and narrow (320px) pages, all booking steps,
both login screens, creation/validation forms, support and cancellation dialogs,
booking filters, the time generator, schedule copying and review, and the mobile
drawer. Keyboard checks exercise Enter, Space, radio arrow keys, Tab/Shift+Tab,
Escape, skip navigation, step focus, dialog focus restoration, and visibility
around sticky headers and fixed actions. Reflow is also checked at 640×450 CSS
pixels, equivalent to a 1280×900 viewport at 200% browser zoom.

Artifacts are written under `artifacts/accessibility/`: `audit.json`, rendered
accessibility trees, `interaction-checks.json`, and `forced-colors.png`.
Reduced motion is audited with the normal palette. Forced colors is checked
separately through keyboard outlines and a screenshot: axe's color-contrast
rule can mix author and system colors in this mode
([upstream issue](https://github.com/dequelabs/axe-core/issues/3978)). No axe
rules are disabled in the normal-palette audits.

Verification and limits
-----------------------

The final run passed all 46 axe audit states with zero violations, plus the
keyboard, focus visibility, reflow, reduced-motion and forced-colors checks.

The production build and all 36 existing frontend unit tests pass. The full
lint check has 16 existing errors, also present when linting the original Git
versions of the files, with no new diagnostics; the new shared main-content
component has no lint errors.

The browser fixtures verify UI semantics and interactions, not backend behavior
or real authentication. Accessibility trees do not substitute for listening to
NVDA/VoiceOver. A human screen-reader pass, actual OS high-contrast testing, and
broader device/browser coverage remain necessary before claiming conformance.
Automated checks do not establish WCAG compliance.
