# Voice Journal

A personal iPhone journal you mostly talk to. Speak (or type) about your day and the app
pulls out **tasks** to check off, **skills** you're building and **long-term goals**, then
reminds you about them. Everything runs on the phone: speech recognition, categorising and
learning from your corrections.

This is the proof of concept.

## What it does today

- **Capture in one tap**: big Speak / Write buttons, a home screen and lock screen widget,
  a Control Center control (which you can also put on the iPhone 17 Pro's Action Button),
  and Siri ("Start a journal entry in Voice Journal").
- **On-device transcription** with Apple's Speech framework, with punctuation.
- **Categorising**: each sentence becomes a Task, Skill, Goal or plain reflection.
  Run-on dictation ("…and I need to… and my goal is…") is split into separate sentences.
- **Tracker tab**: tasks to check off (soonest due first), skills with how often you
  mention them, goals you're working towards or have reached.
- **Reminders**: tasks that mention a time ("tomorrow", "at 5 pm", "by Friday",
  "this weekend") get a notification with *Mark done* and *Remind me in an hour* buttons.
  There's also a morning digest of open tasks and a Sunday check-in on a skill or goal.
- **Learns from you**: tap an item's category to fix it. The fix trains the model on your
  phone, and your fixes count three times as much as the built-in examples.
- **Brain tab**: try any sentence and see the scores, accuracy on test sentences, and a
  reset button for personalisation.

## How the "brain" works

`JournalKit` is a plain Swift package (no iPhone needed, it runs on Linux too):

| Piece | What it does |
| --- | --- |
| `SentenceSplitter` | Splits text on punctuation and on spoken joins like "and I…", "but my…" |
| `NaiveBayesModel` | Small text model trained on word and word-pair counts. Retrains instantly, saves as JSON |
| `RuleClassifier` | Hand-written cue phrases ("need to", "get better at", "someday"…) for phrasing the data never covered |
| `JournalAnalyzer` | Blends the two (65% model, 35% cues) and produces titled items |
| `TitleCleaner` | "Um, I really need to call mom tomorrow." → "Call mom tomorrow" |
| `DueDateParser` | Finds reminder times in tasks |

The baseline is trained on 682 seed sentences from `tools/generate_seed_data.py`, and tested on
80 hand-written sentences it never sees. A prototype of the same algorithm scored 95% on them;
CI prints the real number on every run.

Try it in a terminal (needs Swift):

```bash
swift run --package-path JournalKit journal-classify "I need to call mom tomorrow and someday I want to run a marathon"
swift run --package-path JournalKit journal-classify --eval
swift test --package-path JournalKit
```

## Try it in your browser (Windows, any computer)

Apple's iOS Simulator only runs on Macs, so every CI build is also packaged as a simulator
app and streamed to the browser through [Appetize](https://appetize.io), on an iPhone 17 Pro.

One-time setup:

1. Sign up at [appetize.io](https://appetize.io) (the free plan is enough to start) and create
   an API token under *Account → API token*.
2. On GitHub, open this repo's *Settings → Secrets and variables → Actions → New repository
   secret*, name it `APPETIZE_API_TOKEN` and paste the token.

After that, every push builds the app and updates the same browser link. The link is on the
CI run's summary page and in `.github/appetize-public-key`.

Limits: the browser simulator has no microphone, so use *Write* there. Widgets, Control
Center and notifications are best tried on a real iPhone.

Without Appetize you can still download `VoiceJournal-simulator` from any CI run's
*Artifacts* and drag it onto [appetize.io/upload](https://appetize.io/upload).

## Run it on the iPhone 17 Pro simulator (Mac)

You need a Mac with Xcode 26 or later (which includes the iPhone 17 Pro simulator) and Homebrew.

```bash
git clone https://github.com/abhibhullar01-boop/journal.git
cd journal
git checkout claude/project-thread-h5e2ci   # until the PR is merged
scripts/run-simulator.sh                    # builds, opens the Simulator, launches the app
```

To **watch development live**, run this instead and leave it open. It checks GitHub every
30 seconds and relaunches the app whenever new commits land on the branch:

```bash
scripts/live-simulator.sh claude/project-thread-h5e2ci
```

To work in Xcode itself: `brew install xcodegen && cd App && xcodegen && open VoiceJournal.xcodeproj`,
pick *iPhone 17 Pro* at the top and press Run. SwiftUI previews work in every screen.
The simulator uses your Mac's microphone for speech.

To put it on your own iPhone: in Xcode select the VoiceJournal target, *Signing & Capabilities*,
choose your Apple ID team (do the same for the VoiceJournalWidgets target), plug in the phone
and press Run.

## How we work in GitHub

- `main` is the version you trust.
- Each piece of work happens on its own **branch**, and arrives as a **pull request (PR)**: a
  page showing exactly what changed, with a description.
- Every PR runs **CI** automatically: the classifier tests on Linux and an iOS build on a Mac.
  A green check means it builds and the tests pass.
- You review the PR, leave comments if you want changes, and press **Merge** when you're
  happy. Then it's in `main`.

## Project layout

```
App/            iPhone app (SwiftUI, SwiftData) and widgets; project.yml generates the Xcode project
JournalKit/     the classifier package, its seed data and tests
tools/          seed data generator
scripts/        simulator helpers
```

## Next ideas

- Personal vocabulary: learn names of people and places you mention.
- Group skill and goal mentions over time (e.g. "practiced guitar" counts towards the guitar skill).
- Optional Apple Intelligence (Foundation Models) pass for richer extraction on supported iPhones.
- iCloud sync and export.
