# The journal as a website

The same app as on the phone, built for the web: the chat, voice, the brain, lists, reminders
and link pictures all work in a browser. On a computer it has a sidebar and a centred page; on a
phone's browser it looks like the app.

It goes on its **own** Netlify project at **journal.eventlab.world**. The eventlab.world project
(For You and the Grievance Cell) is never touched: no new upload, no changed setting. The
journal's sidebar (on a phone: Settings) links to both, so you can switch between them.

## Publish it (about 10 minutes, all in the browser)

1. Go to [app.netlify.com](https://app.netlify.com) and choose **Add new project → Import an existing project → GitHub**.
   Allow Netlify to see the `abhibhullar01-boop/journal` repository when it asks.
2. Pick the **journal** repository, then fill in:
   - **Branch to deploy:** `main` (merge pull request #1 first), or `claude/project-thread-h5e2ci` to publish it as it is now
   - **Base directory:** `mobile`
   - Leave the build command and publish directory as Netlify fills them in (`npm run build:web` and `mobile/dist`, from `mobile/netlify.toml`).
3. Click **Deploy**. After 2 to 3 minutes you get an address like `something.netlify.app`. Open it and check it works.
4. In the new project: **Domain management → Add a domain → `journal.eventlab.world`**.
   - If eventlab.world's DNS is on Netlify, it sets itself up.
   - If not, add a `CNAME` record at your domain provider: name `journal`, value `something.netlify.app`.
   HTTPS turns on by itself within a few minutes.
5. Open journal.eventlab.world, go to **Settings**, paste your Claude key (and the OpenAI key for the
   best speech), and press **Turn on** next to Browser notifications.

From then on, every change pushed to that branch updates the website by itself, just like the phone app.

## Good to know

- **Keys stay in your browser.** They are saved on that computer only, never on Netlify.
- **Separate journals for now.** The website keeps its own journal in the browser. Your phone's
  entries don't show up there yet; syncing the two needs a small private store, which can be added next.
- **Talking without an OpenAI key** uses the browser's own speech recognition (Chrome, Edge,
  Safari). With the key, it uses the same, more accurate speech as the phone.
- **Reminders** pop up while the journal is open in a browser tab. The phone app still reminds you
  as before.
- **Two small server helpers** (`mobile/netlify/functions`) fetch link pictures and backup search
  results, because a browser isn't allowed to read other websites directly.
- **Undo:** delete the new Netlify project. eventlab.world stays exactly as it is either way.

## Run it on your laptop

```
cd mobile
npm run web
```

Then open the address it prints. `npm run build:web` makes the same files Netlify publishes, in `mobile/dist`.
