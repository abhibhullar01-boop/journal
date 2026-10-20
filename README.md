# Voice Journal

A personal journal for your iPhone that you mostly talk to. Speak (or type) about your day and
the app pulls out **tasks** to check off, **skills** you're building and **long-term goals**, then
reminds you about them. The categorising happens on the phone, and it learns from your corrections.

Built with [Expo](https://expo.dev) (React Native + TypeScript), so it runs in **Expo Go** on your
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

- **Speak or write**: tap **Speak**, then the microphone on the iPhone keyboard, and talk.
  iOS turns it into text on the phone. Run-on dictation ("…and I need to… and someday I want
  to…") is split into separate items.
- **Categorising**: each sentence becomes a Task, Skill, Goal or plain reflection, with a short
  title ("Um, I really need to call mom tomorrow." → "Call mom tomorrow").
- **Tracker tab**: tasks to check off (soonest first), skills with how often you mention them,
  goals you're working towards or have reached.
- **Reminders**: tasks that mention a time ("tomorrow", "at 5 pm", "by Friday", "this weekend")
  get a notification. There's also a morning list of open tasks at 8:30 and a Sunday evening
  check-in on one of your skills or goals.
- **Learns from you**: tap an item's label to fix its category. The fix trains the model on
  your phone, and your fixes count three times as much as the built-in examples.
- **Brain tab**: try any sentence and see the scores, the accuracy on test sentences, and a reset
  button for your personal training.

## How the "brain" works

It lives in `mobile/src/brain` and is plain TypeScript, so it runs and is tested on any computer.

| Piece | What it does |
| --- | --- |
| `splitter.ts` | Splits text on punctuation and on spoken joins like "and I…", "but my…", "and someday…" |
| `naiveBayes.ts` | Small text model trained on word and word-pair counts. Retrains instantly, saves as JSON |
| `rules.ts` | Hand-written cue phrases ("need to", "get better at", "someday"…) for phrasing the data never covered |
| `analyzer.ts` | Blends the two (65% model, 35% cues) and produces titled items |
| `titles.ts` | Turns a sentence into a short title |
| `dueDate.ts` | Finds reminder times in tasks |

The starting model is trained on 682 example sentences made by `tools/generate_seed_data.py`, and
tested on 80 hand-written sentences it never trains on. It gets **95%** of those right.

```bash
cd mobile
npm test                                                     # classifier tests
npm run classify -- --eval                                   # accuracy report
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

- Recording with our own mic button and transcription (instead of the keyboard microphone).
- Home screen widget, Control Center button and Action Button shortcut.
- Siri phrases.

## Project layout

```
mobile/               the Expo app
  src/app/            screens (Expo Router: every file is a screen)
  src/brain/          the classifier, its seed data and tests
  src/store/          saved journal data and reminders
  src/components/     shared UI pieces
tools/                seed data generator
```
