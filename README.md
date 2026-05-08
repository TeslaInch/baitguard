# 🛡️ BaitGuard

## Engagement Bait & Karma Farm Detection for Reddit Moderators

> A Devvit app that automatically detects and actions posts using engagement bait, fake giveaways, and karma farming tactics — without you lifting a finger.

---

## 🎯 What it does

Engagement bait is a tax on every active subreddit. Posts begging for "DM me",
"comment INTERESTED for the link", "upvote this if you agree", "tag 3 friends" —
they hijack the front page, train the algorithm to reward low-quality content,
and bury the discussions your community actually came for.

**BaitGuard** is a moderator tool that catches these posts the moment they're
submitted. It runs a 54-pattern detection engine across six well-known bait
categories, layers in account-level signals (age, karma ratio, repeat-offender
history), and takes the action you configure — remove, flag for review, or
post a sticky warning. It works silently in the background after a one-time
install: no daily mod intervention required.

It's also designed not to be annoying. Every pattern is anchored with word
boundaries and contextual requirements, the score combines content + account
into a single number you can tune with one slider, and there's a custom
allowlist for users you want it to ignore. Most importantly, it runs locally
in your subreddit's app sandbox — no data leaves Reddit.

---

## ✨ Features

- 🧠 **54+ built-in bait patterns** across six categories — DM bait, comment
  bait, upvote bait, scarcity/urgency, follow/share bait, and fake giveaways
- 👤 **Account profiling** — age, karma totals, post-vs-comment karma ratio,
  verified email, and repeat-offender tracking via Redis
- ⚖️ **Combined scoring** — `content × 0.6 + account × 0.4`, capped at 100
- 🎚️ **Three sensitivity presets** — Low (only obvious bait), Medium
  (balanced, default), High (aggressive)
- 🔧 **Three configurable actions** — remove the post, flag for mod-queue
  review, or post a sticky warning comment
- 📝 **Custom patterns** — paste your own bait phrases (one per line) into
  settings; comments with `#` are skipped
- ✅ **Whitelist** — never flag specific users; accepts `name`, `u/name`,
  `/u/name`, or `@name` formats
- 🛠️ **Manual menu items** — "Scan Post" (any post) and "Check User"
  (any commenter) for moderators
- 📊 **Daily summary modmail** — flagged-today counter plus a top-10 leaderboard
  of repeat offenders, delivered every day at 12:00 UTC
- 🧪 **Unicode-evasion handling** — strips zero-width spaces, soft hyphens,
  the BOM, and folds Cyrillic/Greek look-alikes (Сomment → Comment)
- 📄 **Markdown-aware** — Reddit formatting (`**bold**`, `[links](url)`,
  fenced code, blockquotes) is stripped before pattern matching

---

## 🔬 How it works

BaitGuard scores every new post and comment along two axes:

### 1. Content score (0–100)

Each pattern in the catalog has a weight from 5 to 10 reflecting how reliably
it indicates bait. When content is scanned, every pattern that matches
contributes its weight; the total is capped at 100.

| Risk band | Score |
|-----------|-------|
| None      | 0     |
| Low       | 1–20  |
| Medium    | 21–50 |
| High      | 51+   |

### 2. Account score (0–100)

A separate scorer looks at the author's profile and adds risk points:

| Signal                                | Points |
|---------------------------------------|--------|
| Account age < 7 days                  | +25    |
| Account age < 30 days                 | +15    |
| Account age < 90 days                 | +8     |
| Total karma < 10                      | +20    |
| Total karma < 50                      | +12    |
| Total karma < 200                     | +5     |
| Post karma > 10× comment karma        | +10    |
| No verified email                     | +5     |
| Previously flagged 1–2 times          | +15    |
| Previously flagged 3+ times           | +30    |

If `getUserById` fails (deleted/suspended account), the scorer returns a
neutral medium (30) with `["unable to verify account"]` rather than
crashing the trigger.

### 3. Combined decision

```
combined = min(100, round(content × 0.6 + account × 0.4))
```

The combined score is compared against the sensitivity threshold:

| Sensitivity | Post threshold | Comment threshold (1.5×) |
|-------------|---------------:|-------------------------:|
| Low         |             70 |                      105 |
| Medium      |             45 |                       68 |
| High        |             25 |                       38 |

Comments use a higher threshold because they're shorter and have less signal.

### 4. Action

If the score crosses the threshold, BaitGuard:

1. **Acts** — removes, reports to mod-queue, or posts a sticky warning comment
2. **Records the offense** — increments `baitguard:offender:{username}` in
   Redis and updates the all-time leaderboard
3. **Logs** — writes a structured log line for the developer console

If the score is under threshold, BaitGuard logs the score-vs-threshold ratio
(useful for tuning) and does nothing else.

---

## 🚀 Installation

### From the Reddit App Directory (recommended)

1. Visit the [Reddit Developer App Directory](https://developers.reddit.com/apps).
2. Search for **BaitGuard**.
3. Click **Install** and choose your subreddit.
4. Open the app's settings page from your subreddit's mod tools.
5. Configure sensitivity, action, and (optionally) custom patterns and
   whitelist (see [Configuration](#%EF%B8%8F-configuration)).
6. You're done. BaitGuard starts scanning new posts and comments immediately.

### As a moderator

You'll need:
- Moderator status on the target subreddit (any permissions level).
- A few minutes to configure sensitivity and pick an action.

After install, two new menu items appear for mods:
- 🛡️ **BaitGuard: Scan Post** — manually score any post, see what would happen
- 🛡️ **BaitGuard: Check User** — score the account behind any comment

---

## ⚙️ Configuration

All settings live under your subreddit's BaitGuard installation page.

| Setting | Type | Default | Recommended |
|---------|------|---------|-------------|
| **Detection sensitivity** | Select | Medium | Start at **Medium**, raise to High if bait is making it through, drop to Low if you're seeing false positives |
| **Action when bait is detected** | Select | Flag for review | Start with **Flag for review** to audit BaitGuard's behavior, then graduate to Remove once you trust it |
| **Also score the poster's account** | Boolean | On | Leave **on** unless you have a community where new accounts are expected (e.g. a help/welcome sub) |
| **Custom bait phrases** | Paragraph | _(empty)_ | Add subreddit-specific bait you've noticed; one per line. Comments starting with `#` are ignored |
| **Whitelisted usernames** | Paragraph | _(empty)_ | Power users, partner accounts, your own bot accounts. One per line; `u/`, `/u/`, and `@` prefixes are stripped |
| **Warning comment text** | String | (sensible default) | Customize if your community has its own tone |

### A note on sensitivity tuning

If you're not sure where to start, leave it on **Medium** and set the action
to **Flag for review** for the first week. Skim the mod queue daily; if you're
approving most of the flags, drop sensitivity to **Low** or switch the action
to **Add a sticky warning comment**. If you're wishing it caught more, raise
sensitivity to **High** before changing the action to **Remove**.

---

## 📚 Pattern categories

BaitGuard ships with patterns across six categories. Weights reflect how
reliably each phrase indicates bait — higher means more confidently bait.

### 1. DM Bait (weight 7–9)
Driving conversations off-platform where mods can't see them.
> "DM me", "message me", "send me a DM", "slide into my DMs", "inbox me",
> "PM me", "shoot me a message", "drop me a line", "hit me up",
> "reach out privately", "text me", "contact me directly"

### 2. Comment Bait (weight 6–8)
Forcing low-effort comments to inflate engagement signals.
> "comment INTERESTED", "comment YES", "comment below", "type ME",
> "type I WANT", "drop a 🔥", "say YES below", "leave a comment",
> "comment DONE", "comment INFO", "write SEND"

### 3. Upvote Bait (weight 8–10)
Direct manipulation of Reddit's voting algorithm.
> "upvote this", "upvote and ___", "upvote for ___", "like this post",
> "upvote if you", "give this an upvote", "smash that upvote"

### 4. Scarcity / Urgency (weight 5–7)
Pressuring users into acting before they think.
> "only X spots left", "limited slots", "first 50 people", "act now",
> "before it's gone", "ending soon", "last chance", "spots filling fast",
> "almost sold out"

### 5. Follow / Share Bait (weight 6–8)
Cross-platform funnel-building.
> "follow for more", "follow me for ___", "share this", "repost this",
> "tag 3 friends", "share to unlock", "link in bio", "check my profile"

### 6. Fake Giveaway (weight 7–9)
The lead-magnet pattern — "free" bait to harvest DMs or follows.
> "I'll send it free", "free resource/template/guide", "who wants this",
> "giving away", "want the link?", "I made this free",
> "get it for free just ___"

---

## 🛡️ False positive prevention

BaitGuard is built to be quiet about legitimate posts. Several design choices
keep the false-positive rate low:

- **Word boundaries everywhere.** Patterns use `\b...\b` so `DM` doesn't match
  inside `"admin"` and `"message"` doesn't match inside `"error message"`.
- **Contextual requirements for ambiguous words.** Bare `"interested"`,
  `"DM"`, `"free"`, and `"message"` never trigger on their own — each pattern
  requires specific surrounding bait phrasing (`comment INTERESTED`,
  `DM me`, `free template`, `message me`, etc.).
- **Negative lookaheads on common phrases.** `"type me"` won't match
  `"type me out"`, `"type me up"`, etc.
- **Allowed-noun lists for "free" patterns.** `"free resource"` matches but
  `"free time"`, `"free coffee"`, `"free advice"` do not.
- **Combined scoring requires multiple signals to act.** A single weak
  pattern hit (weight 5) on a clean account scores 3 combined — well below
  every threshold. To trigger the action, content needs multiple matches or
  the author needs to look risky.
- **Whitelist override.** Listed users are skipped before any scanning.
- **Test suite.** The repo ships with `src/test-patterns.ts` covering 18
  bait posts and 18 legitimate posts, plus dedicated regression tests for
  every false-positive concern called out above.

---

## 👩‍💻 For developers

### Local setup

```bash
git clone https://github.com/<your-org>/baitguard.git
cd baitguard
npm install
```

### Verify the build

```bash
npm run type-check    # tsc --noEmit
npm test              # runs the pattern test suite (50 cases)
```

### Project structure

```
baitguard/
├── devvit.yaml             # Devvit app manifest
├── package.json
├── tsconfig.json
├── src/
│   ├── main.ts             # Triggers, menu items, scheduler, settings
│   ├── patterns.ts         # 54 bait patterns + normalization + scanner
│   ├── account-scorer.ts   # User/karma/Redis offender scoring
│   └── test-patterns.ts    # Local-only test harness (not bundled)
└── README.md
```

### Adding a new pattern

1. Open `src/patterns.ts`.
2. Add an entry to the `BAIT_PATTERNS` array under the appropriate category.
3. Pick a weight (5–10) reflecting confidence — lower for ambiguous phrasing,
   higher for unmistakable bait.
4. Add at least one positive and one negative test case to
   `src/test-patterns.ts`.
5. Run `npm test` and `npm run type-check`.

### Deploying to Reddit

```bash
npx devvit login        # authenticate with your Reddit account
npx devvit upload       # upload the build to your dev account
npx devvit playtest <subreddit>   # iterate live in a test subreddit
```

### Contributing

Pull requests welcome. Please:
- Add tests for any new pattern or scoring change.
- Keep `npm test` and `npm run type-check` green.
- Open an issue first for larger architectural changes.

---

## 🏆 Built for

**Reddit Mod Tools Hackathon 2026**

BaitGuard was designed for the 2026 Reddit Mod Tools Hackathon as a
zero-maintenance, defense-in-depth bait detector that respects mod time.
The goal isn't to replace human judgment — it's to handle the obvious cases
silently so mods can focus on the hard ones.

---

## 📜 License

MIT — see [LICENSE](LICENSE).
