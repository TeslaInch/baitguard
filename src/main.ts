import { Devvit, type Context, type TriggerContext } from '@devvit/public-api';
import {
  mergeCustomPatterns,
  scanContent,
  type ScanResult,
} from './patterns';
import {
  recordOffense,
  scoreAccount,
  type AccountScore,
} from './account-scorer';

const DEFAULT_WARNING =
  '⚠️ This post has been flagged by BaitGuard for potential engagement bait. ' +
  'If you believe this is a mistake, please contact the moderators.';

const DAILY_JOB_NAME = 'baitguard-daily-summary';
const DAILY_JOB_CRON = '0 12 * * *'; // daily at 12:00 UTC

// Higher sensitivity name = lower threshold = more aggressive flagging.
const SENSITIVITY_THRESHOLDS = { low: 70, medium: 45, high: 25 } as const;
type Sensitivity = keyof typeof SENSITIVITY_THRESHOLDS;
type ActionType = 'remove' | 'flag' | 'warn';

const COMMENT_THRESHOLD_MULTIPLIER = 1.5;

const REDIS_FLAG_COUNT_PREFIX = 'baitguard:flagged:'; // append YYYY-MM-DD
const REDIS_OFFENDER_ZSET = 'baitguard:offender_leaderboard';
const FLAG_COUNT_TTL_SECONDS = 60 * 60 * 24 * 35; // 35 days — outlives the daily job's lookback

Devvit.configure({
  redditAPI: true,
  redis: true,
});

// =========================================================================
// Settings — installation-level, mods configure these per subreddit
// =========================================================================

Devvit.addSettings([
  {
    type: 'select',
    name: 'sensitivity',
    label: 'Detection sensitivity',
    helpText:
      'How aggressively to flag content. Higher catches more bait but risks false positives.',
    options: [
      { label: 'Low — only obvious bait (score > 70)', value: 'low' },
      { label: 'Medium — balanced (score > 45)', value: 'medium' },
      { label: 'High — aggressive (score > 25)', value: 'high' },
    ],
    defaultValue: ['medium'],
    multiSelect: false,
  },
  {
    type: 'select',
    name: 'action',
    label: 'Action when bait is detected',
    options: [
      { label: 'Remove the post/comment', value: 'remove' },
      { label: 'Flag for review (mod queue)', value: 'flag' },
      { label: 'Add a sticky warning comment', value: 'warn' },
    ],
    defaultValue: ['flag'],
    multiSelect: false,
  },
  {
    type: 'boolean',
    name: 'enableAccountCheck',
    label: "Also score the poster's account",
    helpText:
      'Factor in account age, karma, and repeat-offender history. Disable for content-only scanning.',
    defaultValue: true,
  },
  {
    type: 'paragraph',
    name: 'customPatterns',
    label: 'Custom bait phrases',
    helpText:
      'One per line. Each phrase is matched case-insensitively. Lines starting with # are ignored.',
    defaultValue: '',
  },
  {
    type: 'paragraph',
    name: 'whitelistedUsers',
    label: 'Whitelisted usernames',
    helpText: 'One per line. These users will never be flagged.',
    defaultValue: '',
  },
  {
    type: 'string',
    name: 'warningMessage',
    label: 'Warning comment text',
    helpText: 'Used when the action is "Add a sticky warning comment".',
    defaultValue: DEFAULT_WARNING,
  },
]);

// =========================================================================
// Settings + helpers
// =========================================================================

type ResolvedSettings = {
  sensitivity: Sensitivity;
  action: ActionType;
  enableAccountCheck: boolean;
  customPatterns: string;
  whitelistedUsers: string;
  warningMessage: string;
};

function asSelect<T extends string>(value: unknown, fallback: T, allowed: readonly T[]): T {
  const raw = Array.isArray(value)
    ? typeof value[0] === 'string'
      ? value[0]
      : ''
    : typeof value === 'string'
    ? value
    : '';
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

async function resolveSettings(
  context: TriggerContext | Context,
): Promise<ResolvedSettings> {
  const all = (await context.settings.getAll()) as Record<string, unknown>;
  return {
    sensitivity: asSelect<Sensitivity>(all.sensitivity, 'medium', ['low', 'medium', 'high']),
    action: asSelect<ActionType>(all.action, 'flag', ['remove', 'flag', 'warn']),
    enableAccountCheck:
      typeof all.enableAccountCheck === 'boolean' ? all.enableAccountCheck : true,
    customPatterns: typeof all.customPatterns === 'string' ? all.customPatterns : '',
    whitelistedUsers:
      typeof all.whitelistedUsers === 'string' ? all.whitelistedUsers : '',
    warningMessage:
      typeof all.warningMessage === 'string' && all.warningMessage.trim().length > 0
        ? all.warningMessage
        : DEFAULT_WARNING,
  };
}

function parseWhitelist(text: string): Set<string> {
  return new Set(
    text
      .split(/\r?\n/)
      .map((l) => l.trim().toLowerCase().replace(/^\/?u\//, '').replace(/^@/, ''))
      .filter((l) => l.length > 0),
  );
}

function combinedScore(content: ScanResult, account: AccountScore | null): number {
  if (!account) return content.score;
  return Math.min(100, Math.round(content.score * 0.6 + account.score * 0.4));
}

function summarizeMatches(scan: ScanResult): string {
  if (scan.matchedPatterns.length === 0) return '_(no patterns matched)_';
  const byCat = new Map<string, string[]>();
  for (const m of scan.matchedPatterns) {
    const list = byCat.get(m.category) ?? [];
    list.push(m.match);
    byCat.set(m.category, list);
  }
  return [...byCat.entries()]
    .map(([cat, matches]) => `**${cat}**: ${matches.map((m) => `"${m}"`).join(', ')}`)
    .join('  \n');
}

function todayKey(): string {
  return REDIS_FLAG_COUNT_PREFIX + new Date().toISOString().slice(0, 10);
}

async function trackOffense(
  context: TriggerContext | Context,
  username: string,
): Promise<number> {
  const count = await recordOffense(context, username);

  // Best-effort leaderboard + daily counter — don't let failures here cascade.
  try {
    if (username) {
      await context.redis.zAdd(REDIS_OFFENDER_ZSET, {
        score: count,
        member: username.toLowerCase(),
      });
    }
  } catch (err) {
    console.error('[BaitGuard] zAdd failed', err);
  }
  try {
    const key = todayKey();
    await context.redis.incrBy(key, 1);
    await context.redis.expire(key, FLAG_COUNT_TTL_SECONDS);
  } catch (err) {
    console.error('[BaitGuard] daily counter failed', err);
  }

  return count;
}

async function sendModmail(
  context: TriggerContext | Context,
  subject: string,
  body: string,
): Promise<void> {
  try {
    const subreddit = await context.reddit.getCurrentSubreddit();
    await context.reddit.modMail.createConversation({
      subredditName: subreddit.name,
      subject: subject.slice(0, 100),
      body,
    });
  } catch (err) {
    console.error('[BaitGuard] modmail send failed', err);
  }
}

function authorScoreLine(account: AccountScore | null): string {
  if (!account) return '';
  return ` (account risk: ${account.riskLevel}, ${account.score}/100 — ${
    account.factors.join('; ') || 'no factors'
  })`;
}

// =========================================================================
// Core scan + act (post path)
// =========================================================================

type PostActionArgs = {
  context: TriggerContext;
  postId: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  settings: ResolvedSettings;
  threshold: number;
};

async function scanAndActOnPost(args: PostActionArgs): Promise<void> {
  const { context, postId, authorId, authorName, title, body, settings, threshold } = args;

  const text = `${title}\n\n${body}`.trim();
  const contentScan = scanContent(text);

  let accountScore: AccountScore | null = null;
  if (settings.enableAccountCheck && authorId) {
    accountScore = await scoreAccount(context, authorId);
  }

  const score = combinedScore(contentScan, accountScore);
  if (score < threshold) {
    console.log(
      `[BaitGuard] post ${postId} score=${score} (content=${contentScan.score}` +
        (accountScore ? `, account=${accountScore.score}` : '') +
        `) below threshold=${threshold} — skipping`,
    );
    return;
  }

  const offenseCount = await trackOffense(context, authorName);
  const matchedCats =
    contentScan.matchedPatterns.length > 0
      ? [...new Set(contentScan.matchedPatterns.map((m) => m.category))].join(', ')
      : 'none';
  const reportReason =
    `BaitGuard: score ${score}/100, matched ${matchedCats}`.slice(0, 100);

  console.log(
    `[BaitGuard] post ${postId} action=${settings.action} score=${score} threshold=${threshold} offenses=${offenseCount} matched=[${matchedCats}]`,
  );

  try {
    if (settings.action === 'remove') {
      const post = await context.reddit.getPostById(postId);
      await post.remove();
      await sendModmail(
        context,
        `BaitGuard removed a post by u/${authorName || 'unknown'}`,
        [
          `**Post:** https://reddit.com${post.permalink}`,
          `**Author:** u/${authorName || 'unknown'}${authorScoreLine(accountScore)}`,
          `**Combined score:** ${score} / 100`,
          `**Threshold:** ${threshold} (sensitivity: ${settings.sensitivity})`,
          `**Offense count:** ${offenseCount}`,
          '',
          `**Matched patterns:**`,
          summarizeMatches(contentScan),
        ].join('\n'),
      );
    } else if (settings.action === 'flag') {
      const post = await context.reddit.getPostById(postId);
      await context.reddit.report(post, { reason: reportReason });
    } else if (settings.action === 'warn') {
      const reply = await context.reddit.submitComment({
        id: postId,
        text: settings.warningMessage,
      });
      try {
        await reply.distinguish(true);
      } catch (err) {
        console.error('[BaitGuard] sticky distinguish failed', err);
      }
    }
  } catch (err) {
    console.error(`[BaitGuard] action ${settings.action} failed for post ${postId}`, err);
  }
}

// =========================================================================
// Triggers
// =========================================================================

Devvit.addTrigger({
  event: 'PostSubmit',
  onEvent: async (event, context) => {
    try {
      const post = event.post;
      if (!post?.id) return;

      const settings = await resolveSettings(context);
      const whitelist = parseWhitelist(settings.whitelistedUsers);
      const authorName = event.author?.name ?? '';
      if (authorName && whitelist.has(authorName.toLowerCase())) {
        console.log(`[BaitGuard] skipping whitelisted author u/${authorName}`);
        return;
      }

      mergeCustomPatterns(settings.customPatterns);

      const threshold =
        SENSITIVITY_THRESHOLDS[settings.sensitivity] ?? SENSITIVITY_THRESHOLDS.medium;

      await scanAndActOnPost({
        context,
        postId: post.id,
        authorId: post.authorId ?? event.author?.id ?? '',
        authorName,
        title: post.title ?? '',
        body: post.selftext ?? '',
        settings,
        threshold,
      });
    } catch (err) {
      console.error('[BaitGuard] PostSubmit handler error', err);
    }
  },
});

Devvit.addTrigger({
  event: 'CommentSubmit',
  onEvent: async (event, context) => {
    try {
      const comment = event.comment;
      if (!comment?.id || !comment.body) return;

      const settings = await resolveSettings(context);
      const whitelist = parseWhitelist(settings.whitelistedUsers);
      const authorName = event.author?.name ?? '';
      if (authorName && whitelist.has(authorName.toLowerCase())) return;

      mergeCustomPatterns(settings.customPatterns);

      const baseThreshold =
        SENSITIVITY_THRESHOLDS[settings.sensitivity] ?? SENSITIVITY_THRESHOLDS.medium;
      const threshold = Math.round(baseThreshold * COMMENT_THRESHOLD_MULTIPLIER);

      const contentScan = scanContent(comment.body);

      // CommentV2 in trigger payload has no authorId — pull it from event.author.
      const authorId = event.author?.id ?? '';
      let accountScore: AccountScore | null = null;
      if (settings.enableAccountCheck && authorId) {
        accountScore = await scoreAccount(context, authorId);
      }
      const score = combinedScore(contentScan, accountScore);

      if (score < threshold) return;

      const offenseCount = await trackOffense(context, authorName);
      const matchedCats =
        contentScan.matchedPatterns.length > 0
          ? [...new Set(contentScan.matchedPatterns.map((m) => m.category))].join(', ')
          : 'none';

      console.log(
        `[BaitGuard] comment ${comment.id} action=${settings.action} score=${score} threshold=${threshold} offenses=${offenseCount} matched=[${matchedCats}]`,
      );

      try {
        if (settings.action === 'remove') {
          const c = await context.reddit.getCommentById(comment.id);
          await c.remove();
        } else if (settings.action === 'flag') {
          const c = await context.reddit.getCommentById(comment.id);
          await context.reddit.report(c, {
            reason: `BaitGuard: score ${score}, ${matchedCats}`.slice(0, 100),
          });
        } else if (settings.action === 'warn') {
          // Can't sticky on a comment thread — just leave a distinguished reply.
          const reply = await context.reddit.submitComment({
            id: comment.id,
            text: settings.warningMessage,
          });
          try {
            await reply.distinguish();
          } catch (err) {
            console.error('[BaitGuard] reply distinguish failed', err);
          }
        }
      } catch (err) {
        console.error(`[BaitGuard] comment action failed for ${comment.id}`, err);
      }
    } catch (err) {
      console.error('[BaitGuard] CommentSubmit handler error', err);
    }
  },
});

// =========================================================================
// Menu items — manual mod tools
// =========================================================================

Devvit.addMenuItem({
  location: 'post',
  label: '🛡️ BaitGuard: Scan Post',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    try {
      const settings = await resolveSettings(context);
      mergeCustomPatterns(settings.customPatterns);

      const post = await context.reddit.getPostById(event.targetId);
      const text = `${post.title}\n\n${post.body ?? ''}`.trim();
      const contentScan = scanContent(text);

      let accountScore: AccountScore | null = null;
      if (settings.enableAccountCheck && post.authorId) {
        accountScore = await scoreAccount(context, post.authorId);
      }
      const score = combinedScore(contentScan, accountScore);
      const threshold =
        SENSITIVITY_THRESHOLDS[settings.sensitivity] ?? SENSITIVITY_THRESHOLDS.medium;
      const verdict = score >= threshold ? 'WOULD FLAG' : 'OK';

      const cats =
        contentScan.matchedPatterns.length > 0
          ? [...new Set(contentScan.matchedPatterns.map((m) => m.category))].join(', ')
          : 'none';

      context.ui.showToast({
        text: `${verdict} • ${score}/100 • ${contentScan.riskLevel} risk • matched: ${cats}`,
        appearance: score >= threshold ? 'neutral' : 'success',
      });
    } catch (err) {
      console.error('[BaitGuard] manual scan failed', err);
      context.ui.showToast({ text: 'BaitGuard: scan failed (see app logs)' });
    }
  },
});

Devvit.addMenuItem({
  location: 'comment',
  label: '🛡️ BaitGuard: Check User',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    try {
      const comment = await context.reddit.getCommentById(event.targetId);
      if (!comment.authorId) {
        context.ui.showToast({ text: 'BaitGuard: no author to check' });
        return;
      }
      const account = await scoreAccount(context, comment.authorId);
      const factors =
        account.factors.length > 0
          ? account.factors.slice(0, 3).join(' • ')
          : 'no risk signals';
      context.ui.showToast({
        text: `${account.riskLevel.toUpperCase()} • ${account.score}/100 • ${factors}`,
        appearance: account.riskLevel === 'high' ? 'neutral' : 'success',
      });
    } catch (err) {
      console.error('[BaitGuard] check user failed', err);
      context.ui.showToast({ text: 'BaitGuard: check failed (see app logs)' });
    }
  },
});

// =========================================================================
// Daily summary scheduler
// =========================================================================

Devvit.addSchedulerJob({
  name: DAILY_JOB_NAME,
  onRun: async (_event, context) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const flagCountRaw = await context.redis.get(REDIS_FLAG_COUNT_PREFIX + today);
      const flagCount = flagCountRaw ? parseInt(flagCountRaw, 10) || 0 : 0;

      let topOffenders: { member: string; score: number }[] = [];
      try {
        const range = await context.redis.zRange(REDIS_OFFENDER_ZSET, 0, 9, {
          reverse: true,
          by: 'rank',
        });
        topOffenders = (range as { member: string; score: number }[]).slice(0, 10);
      } catch (err) {
        console.error('[BaitGuard] zRange failed', err);
      }

      const offendersBlock =
        topOffenders.length > 0
          ? topOffenders.map((o, i) => `${i + 1}. u/${o.member} — ${o.score} flag(s)`).join('\n')
          : '_No repeat offenders on record._';

      const body = [
        `BaitGuard daily summary — ${today}`,
        '',
        `**Flagged today:** ${flagCount}`,
        '',
        `**Top repeat offenders (all-time):**`,
        offendersBlock,
        '',
        `_Adjust sensitivity, action, or whitelist via the BaitGuard app settings._`,
      ].join('\n');

      await sendModmail(context, `BaitGuard daily summary — ${today}`, body);
    } catch (err) {
      console.error('[BaitGuard] daily summary job failed', err);
    }
  },
});

async function ensureDailyJob(context: TriggerContext): Promise<void> {
  try {
    const jobs = await context.scheduler.listJobs();
    const exists = (jobs as Array<{ name?: string }>).some(
      (j) => j.name === DAILY_JOB_NAME,
    );
    if (!exists) {
      await context.scheduler.runJob({ name: DAILY_JOB_NAME, cron: DAILY_JOB_CRON });
      console.log(`[BaitGuard] scheduled ${DAILY_JOB_NAME} (${DAILY_JOB_CRON})`);
    }
  } catch (err) {
    console.error('[BaitGuard] ensureDailyJob failed', err);
  }
}

Devvit.addTrigger({
  event: 'AppInstall',
  onEvent: async (_event, context) => {
    await ensureDailyJob(context);
  },
});

Devvit.addTrigger({
  event: 'AppUpgrade',
  onEvent: async (_event, context) => {
    await ensureDailyJob(context);
  },
});

export default Devvit;
