# Voice Journal

A personal journal for your iPhone that you mostly talk to. Speak (or type) about your day and
the app pulls out **tasks** to check off, things **to buy**, **skills** you're building and
**long-term goals**, then reminds you about them. The categorising happens on the phone, and it learns from your corrections.

Built with [Expo](https://expo.dev) SDK 58 (React Native + TypeScript), so it runs in **Expo Go** on your
iPhone with no Mac needed. This is the proof of concept.

## Run it on your iPhone (from a Windows laptop)

One-time setup:

1. On the laptop, install [Node.js LTS](https://nodejs.org) and [Git for Windows](https://git-scm.com/download/win).
2. On the iPhone, install **Expo Go** from the App Store.
3. In PowerShell:

   ```powershell
   git clone https://github.com/abhibhullar01-boop/journal.git
   cd journal
   git checkout claude/project-thread-h5e2ci   # until the PR is merged into main
   cd mobile
   npm install
   ```

Every time:

```powershell
cd journal\mobile
npm run live
```

A QR code appears. Scan it with the iPhone **Camera** app and it opens in Expo Go. Keep the
laptop and phone on the same Wi-Fi. If the QR code doesn't connect, use `npm run live -- --tunnel`.

`npm run live` also pulls new changes from GitHub every 30 seconds, and Expo Go reloads the app
on your phone by itself, so you can watch development happen live. (If a change adds a new
package, stop it with Ctrl+C, run `npm install`, and start it again.)

## What it does today

The app opens on a chat, like an AI companion. Three tabs:

- **Chat** (the main screen): one ongoing conversation that is also your journal. Drop in any time
  of day: type, or tap the mic and talk (OpenAI writes it down, much better than the keyboard mic
  with accents, names and Hindi/Punjabi words). Under each message you see what was saved from it
  (tasks, things to buy, skills, goals) and when you'll be reminded. The companion answers like a
  friend who has read your journal; it can search the web, and its links show as cards with pictures.
  Each day starts under a date divider, with a greeting, your lists at a glance and things to ask.
- **Today**: progress on what's due today, a tile per list, what to buy, a chart of your week, and
  today's notes.
- **Lists**: Tasks, Shopping, Skills and Goals, clearly separated. Tick things off; tap an item to
  move it to another list or remove it (the app learns from every fix).

Behind the scenes:

- Every message is sorted instantly on the phone, then Claude double-checks it when a key is set.
  The on-phone brain learns from Claude's answers too, so it keeps improving offline. Questions and
  requests to the companion ("find me running shoes", "what should I cook?") are answered, not saved.
- Notifications: a heads-up listing what was saved (can be turned off in Settings), reminders at the
  time you said ("tomorrow evening", "in 2 hours", "on the 1st"), a morning plan at 8:30, an evening
  check at 8:30 pm, and a Sunday check-in on a skill or goal.

**Keys** (Settings, the gear at the top of Chat or Today): an OpenAI key for speech and a Claude key for the companion.
Both are pasted once and kept in the iPhone keychain. Without them the app still works, using the
keyboard mic and the on-phone brain.

## How the "brain" works

It lives in `mobile/src/brain` and is plain TypeScript, so it runs and is tested on any computer.

| Piece | What it does |
| --- | --- |
| `splitter.ts` | Splits text on punctuation and on spoken joins like "and I…", "…, carry the documents", "at 3 then groceries" |
| `softmax.ts` | Small logistic-regression text model over words, word pairs and how the sentence opens |
| `shopping.ts` | Turns "we're out of milk and eggs" into separate items |
| `rules.ts` | Hand-written cue phrases ("need to", "get better at", "someday"…) for phrasing the data never covered |
| `analyzer.ts` | Blends the two (65% model, 35% cues) and produces titled items |
| `titles.ts` | Turns a sentence into a short title |
| `dueDate.ts` | Finds reminder times: "tomorrow evening", "in 2 hours", "on the 1st", "after work", "day after tomorrow"… |

The starting model is trained on 6,500 everyday sentences, including chat-style questions and requests, made by `tools/generate_seed_data.py`
(`npm run train` saves its weights into the app). It is scored two ways, never on its training data:

- 86 hand-written single sentences: **98%** right.
- 120 hand-written whole messages (`npm run bench`), checking every item it should find, the ones it
  shouldn't, and reminder times. Set B (journal entries, written after tuning) gets **90%** (F1);
  set D (chat messages, written after all tuning) gets **100%**; every reminder time is right.
- A sweep of about 40 time phrases at two times of day in `dueDate.test.ts`.

```bash
cd mobile
npm test                                                     # classifier tests
npm run classify -- --eval                                   # accuracy report
npm run bench                                                # whole-entry benchmark
npm run classify -- "I need to call mom tomorrow and someday I want to run a marathon"
```

## How we work in GitHub

- `main` is the version you trust.
- Each piece of work happens on its own **branch**, and arrives as a **pull request (PR)**: a page
  showing exactly what changed (the *Files changed* tab), with a description.
- Every PR runs **CI** automatically: typecheck, classifier tests, and an iOS bundle build.
  A green check means it builds and the tests pass.
- You review the PR, leave comments if you want changes, and press **Merge** when you're happy.
  Then it's in `main`.

## Limits of Expo Go, and what comes later

Expo Go can only use the features built into it. These need our own app build instead, which
Expo's cloud service (EAS) can make without a Mac, plus an Apple Developer account ($99/year)
to install it on your phone:

- Home screen widget, Control Center button and Action Button shortcut.
- Siri phrases.

## Project layout

```
mobile/               the Expo app
  src/app/            screens (Expo Router: every file is a screen)
  src/brain/          the on-phone classifier, its seed data, benchmark and tests
  src/ai/             transcription (OpenAI) and the companion and sorting (Claude)
  src/store/          saved journal data and reminders
  src/components/     shared UI pieces
tools/                seed data generator
```
