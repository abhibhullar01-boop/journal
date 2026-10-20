# Voice Journal

A personal journal for your iPhone that you mostly talk to. Speak (or type) about your day and
the app pulls out **tasks** to check off, things **to buy**, **skills** you're building and
**long-term goals**, then reminds you about them. The categorising happens on the phone, and it learns from your corrections.

Built with [Expo](https://expo.dev) SDK 57 (React Native + TypeScript), so it runs in **Expo Go** on your
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

Three tabs, kept simple:

- **Today**: one big mic button. Tap, talk, tap to stop. Your words are written down by OpenAI's
  transcription model (much better than the keyboard mic with accents, names and Hindi/Punjabi
  words), you check the text, and save. Below it: what's due today, what to buy, and your journal.
- **Lists**: Tasks, Shopping, Skills and Goals, clearly separated. Tick things off; long-press to
  move something to another list (the app learns from every fix).
- **Chat**: your companion. It has read your journal, remembers facts about you (who people are,
  where you live), suggests what to focus on or buy, and can add tasks and reminders for you.

Behind the scenes:

- Every entry is sorted instantly on the phone, then Claude double-checks it when a key is set.
  The on-phone brain learns from Claude's answers too, so it keeps improving offline.
- Reminders for tasks with a time ("tomorrow evening", "in 2 hours", "on the 1st"), a morning list
  at 8:30 (open tasks and things to buy) and a Sunday check-in on a skill or goal.

**Keys** (Settings, the gear on Today): an OpenAI key for speech and a Claude key for the companion.
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

The starting model is trained on 4,500 everyday sentences made by `tools/generate_seed_data.py`
(`npm run train` saves its weights into the app). It is scored two ways, never on its training data:

- 86 hand-written single sentences: **98%** right.
- 70 hand-written whole journal entries (`npm run bench`), checking every item it should find, the
  ones it shouldn't, and reminder times. Set B was written after tuning and gets **88%** (F1), with
  every reminder time right.

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
