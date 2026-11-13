# Muse Reach reliability improvement

User authorization: improve the audited v47 implementation and upload the result. Preserve WinForms/WebView2 and the established visual design. Work in a separate branch; do not modify the user's live SSH, tasks, keys or firewall.

## Design and acceptance

1. Store relay endpoint, tunnel identity, task name and watched directories in validated local configuration. Unconfigured state must be explicit, not an invented outage.
2. Separate tunnel-only server identity from the cloud jump identity. Pin known hosts, explicitly bind reverse forwarding, exit on forward failure, remove agent forwarding and transmit commands as encoded PowerShell.
3. Supply an opt-in installed command executor. Journal a started record before executing, then an outcome using the same ID. Fail closed if the initial journal write fails, bound execution time, distinguish incomplete outcomes, and disclose that direct SSH can bypass this journal.
4. Make disconnect/reconnect stop the configured task and only its verified processes; reconnect performs a stop/start, then reports measured evidence.
5. Keep the UI identity. Preserve navigation, focus, expansion and unsaved configuration during polling; persist operation busy state independently of dialogs. Expose watcher errors, actual hotkey status and readable console text.
6. Repair obsolete test assumptions, add behavior regression tests and a single reproducible check entry point; build Windows artifacts in CI. Update documentation to match actual capabilities.

## Execution plan

- [x] Capture baseline failures and add failing regressions for configuration, heartbeat and source attribution.
- [x] Implement validated configuration, probing and controlled task restart.
- [x] Add and exercise command journaling and server script tests; rewrite deployment templates.
- [x] Add DOM regressions, then repair polling, busy-state and settings flows.
- [x] Run all maintained tests and Windows publish; inspect actual local test UI without external login or connection control.
- [ ] Review the full diff, upload branch, create PR, verify uploaded contents and report runtime limits.

## Review focus

Malformed/future heartbeat; command quotes/Unicode/nonzero exit/timeout; unavailable journal; DNS/IPv6/custom port; unknown tunnel process identity; concurrent UI snapshots; corrupt configuration; watcher overflow; duplicate cloud polling.

## Progress

Baseline UiTests currently fails at the obsolete assertion that the empty public backfill template appends six personal deliveries. This will be replaced by empty-template/idempotence behavior assertions, without inventing deliveries.

Local verification: 433 assertions passed; Release build has 0 warnings and 0 errors. Native UI and live SSH configuration remain unmodified and unverified. Final independent code review findings were addressed.
