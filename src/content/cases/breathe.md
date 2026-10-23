---
title: Breathe
cat: Mobile · React Native
lede: A calm, offline-first breathing app whose timer stays exact through pauses, backgrounding and sleep.
tags: [Expo, React Native, TypeScript, Reanimated, Jest]
order: 8
img: /img/breathe.jpg
---

> A breathing guide that drifts out of time with itself is worse than no guide at all.

## The problem

A breathing app has one job: tell you exactly when to breathe in and out. The obvious implementation counts timer ticks, and it fails as soon as real life happens. The phone sleeps, the app goes to the background, a JavaScript frame runs late. After a few minutes the circle and the countdown disagree.

## Time comes from the clock, not from ticks

- **Timing is pure and timestamp-based.** The session stores timestamps, not tick counts, and the current phase is calculated from elapsed milliseconds. The React hook just re-reads the wall clock: every 200 ms while running, and at once when the app returns to the foreground.
- **Updates only when something visible changes**, about once a second, so the screen doesn't re-render for nothing.
- **The animation re-anchors every phase.** At each phase change the circle is set to the size the engine says it should be, then animated on the UI thread for the time left. It can't drift, and resuming mid-phase is seamless.
- **Backgrounding just works.** The session keeps running on the wall clock. If it finished while you were away, the completion screen is waiting when you return.

## Built for everyone

Full, reduced or no animation, following the operating system's "reduce motion" setting: with motion off, the circle stays still and only its halo brightens and dims. Every control has a screen-reader label, phase changes are announced, and text scales without overlapping.

## Private by construction

No accounts, analytics, ads or network calls. Sessions, streaks, settings and custom patterns stay on the device. Everything read back from storage passes through validators, so corrupted or old data falls back to defaults instead of crashing the app.

## Features

Equal, box, 4-7-8, longer-exhale and custom patterns. Sessions of 1 to 20 minutes with pause and resume, optional ambient sound and haptics, a daily goal with streaks and a 7-day chart, and local reminders that ask for notification permission only when you turn them on.

## Tested where it matters

Strict TypeScript (`noUncheckedIndexedAccess`) and **50 Jest tests in 5 suites**, focused on what's easy to get wrong: phase boundaries for every pattern, pause and resume repeated, a 10-minute background gap, streaks across month boundaries, and corrupted or tampered storage. A 13-step manual checklist covers what unit tests can't: haptics, sound, reminders, screen readers and rotation.

The app builds as an Android APK and AAB and an iOS build through EAS. Its code isn't public yet.
