# BaitGuard — Reddit Mod Tools Hackathon 2026

> Paste-ready content for the Devpost submission form.

---

## Tool Overview

Engagement bait is one of the most persistent low-grade problems in Reddit moderation. Posts that beg "DM me for the link," "comment INTERESTED and I'll send it free," "upvote this if you agree," and "tag 3 friends" don't break community rules in a single obvious way — they exploit the algorithm one keyword at a time, drown out real discussion, and funnel vulnerable users into off-platform scams. The damage is most acute in job, finance, and advice communities, where the people most likely to engage with bait are the ones with the least margin for being exploited.

AutoMod is great at matching a single keyword, but it can't tell you that a post hits five different bait patterns at once, that the author is a four-day-old account with zero comment karma, or that the same username has already been flagged twice this month under slightly different phrasing. That's the gap BaitGuard fills.

BaitGuard scans every new post and comment in real time, scoring it along two independent axes. The **content scanner** runs 54 hand-tuned regex patterns across six categories — DM Bait, Comment Bait, Upvote Bait, Scarcity/Urgency, Follow/Share Bait, and Fake Giveaways — each weighted 5–10 by how reliably it indicates manipulation. The **account scorer** profiles the author: account age, karma totals, post-vs-comment karma ratio, verified email, and any prior offenses recorded in Redis. The two scores combine via `content × 0.6 + account × 0.4` into a single 0–100 number, tuned by one slider (Low / Medium / High sensitivity).

When a post crosses the configured threshold, BaitGuard does exactly what the moderator chose: removes it with a detailed modmail receipt, reports it to the mod queue with the matched patterns attached, or posts a stickied warning comment. Every action increments the offender's count in Redis, and a daily scheduled job sends a modmail summary with the previous 24 hours' flag count and an all-time top-10 offender leaderboard. Mods also get two manual menu items — "🛡️ BaitGuard: Scan Post" and "🛡️ BaitGuard: Check User" — for spot checks.

The technical edge over AutoMod regexes is **judgment**. BaitGuard refuses to flag bare words ("interested", "DM", "free", "message") on their own — every match requires bait-specific context. It strips Reddit markdown and folds Cyrillic look-alikes before matching, so `**С**omment YES` (with a Cyrillic `С`) gets caught the same as plain ASCII. Zero-width spaces and soft hyphens used to break word patterns are normalized away. It runs zero-config from the moment of install — no YAML to write, no rule library to maintain. Custom patterns and a user whitelist are paragraph fields in the standard Devvit settings UI.

Built on Devvit 0.12 with TypeScript in strict mode. State persists in Redis via per-user counters and an all-time sorted-set leaderboard, so repeat-offender intelligence survives across the entire app lifetime. The pattern engine ships with a 50-case test suite covering positive bait detection, 18 false-positive controls, Unicode evasion regressions, and custom-pattern integration — every change is verified before upload.

---

## Project Impact

### r/forhire (1.5M+ members)

r/forhire's mods deal with a constant trickle of recruiters-who-aren't and "freelance guide" spammers. The bait is precisely tuned to vulnerable jobseekers: "DM me for opportunities," "Comment INTERESTED for my client list," "I'm hiring 5 people, message me to apply." Most posts never deliver a real job — they harvest contact info, funnel users into affiliate schemes, or steer them to off-platform scams that the mods can't reach. With 1.5M+ members and dozens of new posts per hour, manual review of every suspicious thread is a lost battle.

BaitGuard's combination of DM Bait patterns and account profiling catches the obvious cases automatically — a four-day-old account with zero comment karma posting "DM me for the contract details" scores in the 70s and gets actioned before a single jobseeker sees it. The mod team is freed to focus on the gray-area posts that genuinely need a human judgment call. Even at conservative bait rates, that's hours of mod-queue work eliminated every week, and — more importantly — fewer jobseekers being exploited at the moment they're most vulnerable.

### r/beermoney (1.2M+ members)

The "free method" post is the entire engagement-farming playbook in one phrase. A 12-day-old account writes *"Who wants my free method that pays $500/week? Comment below and I'll DM you"* — and walks away with hundreds of upvotes and a backlog of DM contacts before a single payout exists. Even when the OP eventually delivers a "method," it's usually referral spam, an MLM funnel, or a survey-site link the sub already has on its blacklist. The bait succeeds because the social-proof loop (upvotes → visibility → more comments → more upvotes) completes faster than mods can intervene.

BaitGuard's Fake Giveaway patterns ("who wants this," "I made this free," "want the link?") plus account profiling catch these at submission — *before* they accumulate the social proof that makes them spread. Repeat-offender tracking matters here especially: the same user pivoting from one "method" to another gets caught faster on each attempt, because their offender count in Redis already pushes the combined score over threshold even when the new wording is novel.

### r/cryptocurrency (7M+ members)

The stakes are highest here. "DM for trading signals," "I made $30k last month, message me to learn the strategy," fake giveaways requiring users to send a "verification fee" — these aren't just noise; they cost users real money. With 7M+ members, even a small percentage falling for these represents serious financial harm to people who came to the sub specifically because they didn't know what they were doing yet.

The bait in crypto evolves faster than any keyword list. Bait posters use creative phrasings, Cyrillic and Greek look-alike characters, zero-width spaces between letters, and Reddit-markdown tricks to slip past basic filters. BaitGuard's normalization layer — Unicode confusable folding, zero-width stripping, NFKC normalization, and full markdown stripping — handles all of these before matching, so `D​M m3` (zero-width-space-separated, with leetspeak `m3` instead of `me`) gets caught the same as `DM me`. The custom-pattern field lets the mod team add subreddit-specific scam terms ("trust wallet drainer," "metamask claim," fresh airdrop names) as new tactics emerge — and the daily summary surfaces who's repeatedly testing the boundary, which is exactly the signal mods want to escalate on.

---

## Why this matters

BaitGuard isn't trying to replace human moderation — it's trying to give mods back their time. The hard cases (legitimate but borderline posts, community-specific context, escalation decisions) still need human judgment. The obvious cases (new account + DM bait + scarcity language) shouldn't.

Built for the **Reddit Mod Tools Hackathon 2026**.
