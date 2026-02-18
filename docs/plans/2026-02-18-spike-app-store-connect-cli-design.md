# SPIKE Design: App Store Connect CLI
**Date:** 2026-02-18
**Linear:** AMA-TBD
**Tool:** https://github.com/rudrankriyam/App-Store-Connect-CLI

## Goal

Investigate the `asc` CLI to understand how it can replace the current manual Xcode Organizer
release flow for AmakaFlow iOS. Output is a findings doc for David to read — no implementation yet.

## Background

Currently, releasing AmakaFlow iOS requires manually archiving in Xcode and uploading via Xcode
Organizer. The `asc` CLI (1,350 ⭐, pre-1.0, actively developed) provides scriptable access to
the App Store Connect API with JSON-first output designed for CI/CD automation.

## Questions This SPIKE Must Answer

1. **Release flow mapping** — which `asc` commands replace each manual step (upload, TestFlight
   distribution, App Store submission)?
2. **Credentials required** — what App Store Connect API key is needed, what GitHub Actions secrets
   need to be added?
3. **Build upload mechanics** — does it replace `xcodebuild -exportArchive` + Transporter, or does
   it complement them?
4. **TestFlight automation** — auto-add testers, beta groups, build notes support?
5. **App Store submission** — can it manage metadata/screenshots in code, or just trigger review?
6. **Maturity & gaps** — what's missing pre-1.0 that we'd need for a full pipeline?
7. **CI/CD fit** — how it slots into the existing `ios-tests.yml` GitHub Actions setup in
   `supergeri/amakaflow-ios-app`

## Out of Scope

- No implementation, scripts, or code changes
- No CI/CD pipeline design
- No metadata/screenshot management design

## Output

Findings written as a comment on the Linear SPIKE ticket. Readable in 5 minutes, actionable for
planning a future implementation sprint.
