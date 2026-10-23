---
title: Friends Talk
cat: Full-stack · Real-time
lede: Anonymous, voice-first random chat. One tap connects two strangers by voice, with no camera, profile or account.
tags: [WebRTC, Node.js, Socket.IO, MongoDB Atlas]
order: 7
img: /img/friendstalk.jpg
links:
  - href: https://friendstalk.fun/
    label: Live app
  - href: https://github.com/divyanshubhatiwal/friends-talk
    label: Source code
---

> The hard part of random chat isn't the call. It's never leaving someone alone with a spinner.

## The problem

Random voice chat has three ways to fail. Nobody gets matched, so the app looks broken. A call leaks something it shouldn't, such as audio passing through a server. Or the service stops the moment its database does. Friends Talk is built around avoiding all three.

## How a call works

```
browser A ──┐                                    ┌── browser B
            │  socket.io: matchmaking + signaling │
            └──────────►  Node server  ◄──────────┘
            audio does NOT flow through the server
browser A ◄══════ WebRTC peer connection ══════► browser B
```

The server only introduces the two browsers. Audio goes directly between them over WebRTC and never touches the server, so there is nothing to record. Random text messages are relayed in memory only.

## Matching that never strands anyone

Everyone waiting sits in one pool, and each newcomer is scored against every waiter. Shared interests count most, then matching mood, then how long someone has waited, so nobody starves. Two rules keep it fair:

- **Preferences relax over time.** On a small server a strict filter matches nobody. After 12 seconds the gender preference is dropped, after 25 the country filter, and the app tells the user it did. Blocks and mode never relax.
- **Forbidden is different from unlikely.** A blocked pair can never match; a recent partner only scores lower. An earlier version treated both the same, so two people online alone could never be rematched.

The [code tour](/tour/friends-talk-matching) walks through the matchmaker line by line.

## Privacy by default

- **Retention is enforced by the database.** Friendships, messages, call metadata and reports expire through MongoDB TTL indexes, so the periods on the privacy page hold even if application code never runs.
- **No conversation content is stored.** The `calls` collection keeps who was connected and for how long, nothing said.
- **Gender estimates stay on the device.** The premium gender filter estimates from voice pitch in the browser; nothing is sent for it.
- **Blocks survive.** They're stored server-side and merged with the device's list, so clearing local storage doesn't undo one.

## Staying up

If MongoDB is unreachable the server still starts and falls back to in-memory storage, so a dead cluster degrades the service instead of stopping it. Every socket event (find, chat, image, reaction and the rest) goes through a sliding-window rate limiter, and five reports against one user in 24 hours triggers an automatic 24-hour suspension.

## Also in the app

Text chat with a both-sides-agree upgrade to voice, in-call tic-tac-toe, image sharing that is screened before delivery, opt-in live captions with translation in 20 languages, spoken-word moderation using the same transcript, and an 18+ age gate.

## What's left

STUN alone fails for roughly 10–20% of users behind strict NATs, so a TURN server is the next piece of infrastructure. Text moderation is regex-based; production use would need a real classifier and a human review queue.
