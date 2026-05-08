export type AccountScore = {
  score: number;
  riskLevel: 'low' | 'medium' | 'high';
  factors: string[];
};

const OFFENDER_KEY_PREFIX = 'baitguard:offender:';
const DAY_MS = 24 * 60 * 60 * 1000;

function offenderKey(username: string): string {
  return `${OFFENDER_KEY_PREFIX}${username.toLowerCase()}`;
}

function classify(score: number): 'low' | 'medium' | 'high' {
  if (score >= 46) return 'high';
  if (score >= 21) return 'medium';
  return 'low';
}

export async function scoreAccount(
  context: any,
  authorId: string,
): Promise<AccountScore> {
  const factors: string[] = [];
  let score = 0;

  let user: any;
  try {
    user = await context.reddit.getUserById(authorId);
  } catch {
    return { score: 30, riskLevel: 'medium', factors: ['unable to verify account'] };
  }

  if (!user) {
    return { score: 30, riskLevel: 'medium', factors: ['unable to verify account'] };
  }

  // Account age
  try {
    const createdAt =
      user.createdAt instanceof Date ? user.createdAt : new Date(user.createdAt);
    if (!isNaN(createdAt.getTime())) {
      const ageDays = (Date.now() - createdAt.getTime()) / DAY_MS;
      if (ageDays < 7) {
        score += 25;
        factors.push(`Account ${Math.floor(ageDays)} days old (< 7d)`);
      } else if (ageDays < 30) {
        score += 15;
        factors.push(`Account ${Math.floor(ageDays)} days old (< 30d)`);
      } else if (ageDays < 90) {
        score += 8;
        factors.push(`Account ${Math.floor(ageDays)} days old (< 90d)`);
      }
    }
  } catch {
    // Missing or malformed createdAt — don't penalize on uncertainty.
  }

  // Karma totals
  const linkKarma = typeof user.linkKarma === 'number' ? user.linkKarma : 0;
  const commentKarma = typeof user.commentKarma === 'number' ? user.commentKarma : 0;
  const totalKarma = linkKarma + commentKarma;

  if (totalKarma < 10) {
    score += 20;
    factors.push(`Very low karma (${totalKarma})`);
  } else if (totalKarma < 50) {
    score += 12;
    factors.push(`Low karma (${totalKarma})`);
  } else if (totalKarma < 200) {
    score += 5;
    factors.push(`Modest karma (${totalKarma})`);
  }

  // Post-heavy karma ratio: signals a karma-farm account that posts but never engages.
  if (commentKarma > 0 && linkKarma > commentKarma * 10) {
    score += 10;
    factors.push(
      `Post-heavy: ${linkKarma} post karma vs ${commentKarma} comment karma`,
    );
  } else if (commentKarma === 0 && linkKarma >= 50) {
    score += 10;
    factors.push(`Posts only, never comments (${linkKarma} post karma)`);
  }

  // Verified email — only penalize when the API explicitly says false; treat
  // missing field as unknown (no penalty).
  if (user.hasVerifiedEmail === false) {
    score += 5;
    factors.push('No verified email');
  }

  // Repeat offender lookup
  try {
    const username = typeof user.username === 'string' ? user.username : '';
    if (username) {
      const raw = await context.redis.get(offenderKey(username));
      const count = raw ? parseInt(String(raw), 10) || 0 : 0;
      if (count >= 3) {
        score += 30;
        factors.push(`Repeat offender (flagged ${count} times)`);
      } else if (count >= 1) {
        score += 15;
        factors.push(`Previously flagged ${count} time${count === 1 ? '' : 's'}`);
      }
    }
  } catch {
    // Redis hiccup — skip the bonus rather than failing the whole scan.
  }

  score = Math.min(Math.max(score, 0), 100);

  return { score, riskLevel: classify(score), factors };
}

export async function recordOffense(
  context: any,
  username: string,
): Promise<number> {
  if (!username) return 0;
  const key = offenderKey(username);

  try {
    const result = await context.redis.incrBy(key, 1);
    const n = typeof result === 'number' ? result : Number(result);
    if (Number.isFinite(n) && n > 0) return n;
  } catch {
    // fall through to get+set fallback
  }

  try {
    const raw = await context.redis.get(key);
    const count = (raw ? parseInt(String(raw), 10) || 0 : 0) + 1;
    await context.redis.set(key, String(count));
    return count;
  } catch {
    return 0;
  }
}
