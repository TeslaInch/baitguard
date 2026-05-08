export type BaitPattern = {
  pattern: RegExp;
  category: string;
  weight: number;
  description: string;
};

export type MatchedPattern = {
  category: string;
  description: string;
  weight: number;
  match: string;
};

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

export type ScanResult = {
  score: number;
  matchedPatterns: MatchedPattern[];
  riskLevel: RiskLevel;
};

const CUSTOM_CATEGORY = 'Custom';

// Whitespace tolerant of a single emoji or punctuation cluster between words:
// matches "DM me" and "DM 🔥 me" but not "DMing me".
const WS = '\\s+(?:[^\\w\\s]+\\s+)?';

// "DM" with optional separator between letters: "DM", "D.M", "D-M", "D M".
const DM = 'd[.\\-_\\s]*m';
const PM = 'p[.\\-_\\s]*m';

const dm = (rest: string) => new RegExp(`\\b${DM}${rest}`, 'i');

export const BAIT_PATTERNS: BaitPattern[] = [
  // === DM Bait (weight 7-9) ===
  {
    pattern: dm(`${WS}m[e3]\\b`),
    category: 'DM Bait',
    weight: 9,
    description: '"DM me" — direct DM solicitation',
  },
  {
    pattern: /\bmessage\s+m[e3]\b/i,
    category: 'DM Bait',
    weight: 8,
    description: '"message me"',
  },
  {
    pattern: new RegExp(`\\bsend\\s+m[e3]\\s+a\\s+${DM}\\b`, 'i'),
    category: 'DM Bait',
    weight: 9,
    description: '"send me a DM"',
  },
  {
    pattern: new RegExp(`\\bslide\\s+(?:into\\s+)?(?:my\\s+|the\\s+)?${DM}'?s?\\b`, 'i'),
    category: 'DM Bait',
    weight: 9,
    description: '"slide into DMs"',
  },
  {
    pattern: /\b[i1]nbox\s+m[e3]\b/i,
    category: 'DM Bait',
    weight: 9,
    description: '"inbox me"',
  },
  {
    pattern: new RegExp(`\\b${PM}\\s+m[e3]\\b`, 'i'),
    category: 'DM Bait',
    weight: 8,
    description: '"PM me"',
  },
  {
    pattern: new RegExp(`\\bshoot\\s+m[e3]\\s+a\\s+(?:message|${DM}|line|note)\\b`, 'i'),
    category: 'DM Bait',
    weight: 8,
    description: '"shoot me a message/DM/line"',
  },
  {
    pattern: new RegExp(`\\bdrop\\s+m[e3]\\s+a\\s+(?:message|${DM}|line|note)\\b`, 'i'),
    category: 'DM Bait',
    weight: 8,
    description: '"drop me a message/DM/line"',
  },
  {
    pattern: /\bhit\s+m[e3]\s+up\b/i,
    category: 'DM Bait',
    weight: 7,
    description: '"hit me up"',
  },
  {
    pattern: /\breach\s+out\s+(?:to\s+m[e3]\s+)?(?:privately|directly|in\s+private)\b/i,
    category: 'DM Bait',
    weight: 7,
    description: '"reach out privately/directly"',
  },
  {
    pattern: /\btext\s+m[e3]\b/i,
    category: 'DM Bait',
    weight: 7,
    description: '"text me"',
  },
  {
    pattern: /\bcontact\s+m[e3]\s+(?:directly|privately|in\s+private)\b/i,
    category: 'DM Bait',
    weight: 7,
    description: '"contact me directly"',
  },

  // === Comment Bait (weight 6-8) ===
  {
    pattern: /\bcomment\s+["']?interested\b/i,
    category: 'Comment Bait',
    weight: 8,
    description: '"comment INTERESTED"',
  },
  {
    pattern: /\bcomment\s+["']?yes\b/i,
    category: 'Comment Bait',
    weight: 8,
    description: '"comment YES"',
  },
  {
    pattern: /\bcomment\s+below\b/i,
    category: 'Comment Bait',
    weight: 6,
    description: '"comment below"',
  },
  {
    pattern: /\btype\s+["']?me["']?\b(?!\s+(?:out|of|up|down|in))/i,
    category: 'Comment Bait',
    weight: 7,
    description: '"type ME"',
  },
  {
    pattern: /\btype\s+["']?(?:i\s+want|gimme|send|yes|info)\b/i,
    category: 'Comment Bait',
    weight: 8,
    description: '"type I WANT / SEND / YES"',
  },
  {
    pattern: /\bdrop\s+a\s+(?:🔥|🚀|💯|👇|❤️|👍|(?:fire|comment|heart|like)\b)/i,
    category: 'Comment Bait',
    weight: 7,
    description: '"drop a 🔥 / drop a comment"',
  },
  {
    pattern: /\bsay\s+["']?yes["']?\s+(?:below|in\s+the\s+comments?)\b/i,
    category: 'Comment Bait',
    weight: 8,
    description: '"say YES below"',
  },
  {
    pattern: /\bleave\s+a\s+comment\s+(?:below|with|saying|if|and)\b/i,
    category: 'Comment Bait',
    weight: 6,
    description: '"leave a comment ___"',
  },
  {
    pattern: /\bcomment\s+["']?done\b/i,
    category: 'Comment Bait',
    weight: 8,
    description: '"comment DONE"',
  },
  {
    pattern: /\bcomment\s+["']?info\b/i,
    category: 'Comment Bait',
    weight: 8,
    description: '"comment INFO"',
  },
  {
    pattern: /\bwrite\s+["']?send\b/i,
    category: 'Comment Bait',
    weight: 8,
    description: '"write SEND"',
  },

  // === Upvote Bait (weight 8-10) ===
  {
    pattern: /\bupvote\s+this\b/i,
    category: 'Upvote Bait',
    weight: 10,
    description: '"upvote this"',
  },
  {
    pattern: /\bupvote\s+and\s+(?:comment|share|follow|i'?ll|you'?ll)\b/i,
    category: 'Upvote Bait',
    weight: 9,
    description: '"upvote and ___"',
  },
  {
    pattern: /\bupvote\s+for\s+(?:more|the|access|visibility|reach|part)\b/i,
    category: 'Upvote Bait',
    weight: 9,
    description: '"upvote for ___"',
  },
  {
    pattern: /\blike\s+this\s+post\b/i,
    category: 'Upvote Bait',
    weight: 8,
    description: '"like this post"',
  },
  {
    pattern: /\bupvote\s+if\s+you\b/i,
    category: 'Upvote Bait',
    weight: 9,
    description: '"upvote if you"',
  },
  {
    pattern: /\bgive\s+this\s+(?:post\s+)?an?\s+upvote\b/i,
    category: 'Upvote Bait',
    weight: 10,
    description: '"give this an upvote"',
  },
  {
    pattern: /\bsmash\s+(?:that|the)\s+(?:upvote|like)\s+button?\b/i,
    category: 'Upvote Bait',
    weight: 10,
    description: '"smash that upvote"',
  },

  // === Scarcity / Urgency (weight 5-7) ===
  {
    pattern: /\bonly\s+\d+\s+(?:spots?|seats?|slots?|spaces?|copies)\s+(?:left|remaining|available)\b/i,
    category: 'Scarcity',
    weight: 6,
    description: '"only X spots left"',
  },
  {
    pattern: /\blimited\s+(?:slots?|spots?|seats?|spaces?|time|offer|copies)\b/i,
    category: 'Scarcity',
    weight: 5,
    description: '"limited slots"',
  },
  {
    pattern: /\bfirst\s+\d+\s+(?:people|users|comments?|sub(?:scribers)?|to\s+(?:comment|reply|dm))\b/i,
    category: 'Scarcity',
    weight: 7,
    description: '"first 50 people"',
  },
  {
    pattern: /\bact\s+now\b/i,
    category: 'Scarcity',
    weight: 6,
    description: '"act now"',
  },
  {
    pattern: /\bbefore\s+(?:it'?s?|it\s+is)\s+(?:gone|too\s+late)\b/i,
    category: 'Scarcity',
    weight: 6,
    description: "\"before it's gone\"",
  },
  {
    pattern: /\bending\s+soon\b/i,
    category: 'Scarcity',
    weight: 5,
    description: '"ending soon"',
  },
  {
    pattern: /\blast\s+chance\b/i,
    category: 'Scarcity',
    weight: 6,
    description: '"last chance"',
  },
  {
    pattern: /\bspots?\s+(?:are\s+)?filling\s+(?:up\s+)?fast\b/i,
    category: 'Scarcity',
    weight: 7,
    description: '"spots filling fast"',
  },
  {
    pattern: /\balmost\s+sold\s+out\b|\balmost\s+gone\b/i,
    category: 'Scarcity',
    weight: 6,
    description: '"almost sold out"',
  },

  // === Follow / Share Bait (weight 6-8) ===
  {
    pattern: /\bfollow\s+(?:me\s+)?for\s+more\b/i,
    category: 'Follow/Share Bait',
    weight: 8,
    description: '"follow for more"',
  },
  {
    pattern: /\bfollow\s+m[e3]\s+for\s+\w+/i,
    category: 'Follow/Share Bait',
    weight: 7,
    description: '"follow me for ___"',
  },
  {
    pattern: /\bshare\s+this\s+(?:post|with|if|to|so)\b/i,
    category: 'Follow/Share Bait',
    weight: 6,
    description: '"share this ___"',
  },
  {
    pattern: /\brepost\s+this\b/i,
    category: 'Follow/Share Bait',
    weight: 7,
    description: '"repost this"',
  },
  {
    pattern: /\btag\s+\d+\s+(?:friends?|people|of\s+your)\b/i,
    category: 'Follow/Share Bait',
    weight: 8,
    description: '"tag 3 friends"',
  },
  {
    pattern: /\bshare\s+to\s+(?:unlock|access|get|see|reveal)\b/i,
    category: 'Follow/Share Bait',
    weight: 8,
    description: '"share to unlock"',
  },
  {
    pattern: /\blink\s+in\s+(?:my\s+)?(?:bio|profile|comments?)\b/i,
    category: 'Follow/Share Bait',
    weight: 7,
    description: '"link in bio"',
  },
  {
    pattern: /\bcheck\s+(?:out\s+)?my\s+(?:profile|page|posts?|bio)\b/i,
    category: 'Follow/Share Bait',
    weight: 6,
    description: '"check my profile"',
  },

  // === Fake Giveaway (weight 7-9) ===
  {
    pattern: /\b[i1](?:'?ll|\s+will)\s+send\s+(?:it|them|you|the\s+\w+)\s+(?:for\s+)?free\b/i,
    category: 'Fake Giveaway',
    weight: 9,
    description: '"I\'ll send it free"',
  },
  {
    pattern: /\bfree\s+(?:\w+\s+)?(?:resource|template|guide|ebook|e-?book|pdf|course|copy|access|tool|spreadsheet|notion)\b/i,
    category: 'Fake Giveaway',
    weight: 7,
    description: '"free resource/template/guide" (optional adjective)',
  },
  {
    pattern: /\bwho\s+wants\s+(?:this|it|one|a\s+\w+|the\s+\w+)\??/i,
    category: 'Fake Giveaway',
    weight: 8,
    description: '"who wants this"',
  },
  {
    pattern: /\bgiving\s+(?:(?:it|them|this|these)\s+)?away\b/i,
    category: 'Fake Giveaway',
    weight: 8,
    description: '"giving (it) away"',
  },
  {
    pattern: /\bwant\s+the\s+(?:link|template|file|pdf|guide|access|spreadsheet|notion|copy|tool|prompt)\??/i,
    category: 'Fake Giveaway',
    weight: 9,
    description: '"want the link/template?"',
  },
  {
    pattern: /\b[i1]\s+made\s+(?:this|it)\s+(?:for\s+)?free\b/i,
    category: 'Fake Giveaway',
    weight: 8,
    description: '"I made this free"',
  },
  {
    pattern: /\bget\s+(?:it|this|the\s+\w+)\s+for\s+free\s+(?:just|by|if|simply|when)\b/i,
    category: 'Fake Giveaway',
    weight: 9,
    description: '"get it for free just ___"',
  },
];

// Cyrillic/Greek look-alikes used to disguise Latin characters. Only the
// most common offenders — full Unicode confusable-folding would be overkill.
const LOOKALIKES: Record<string, string> = {
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x',
  'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O',
  'Р': 'P', 'С': 'C', 'Т': 'T', 'У': 'Y', 'Х': 'X',
  'ι': 'i', 'ο': 'o', 'ρ': 'p', 'υ': 'u', 'ν': 'v', 'Α': 'A', 'Β': 'B',
  'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N',
  'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X',
};

// Invisible chars used to break word patterns: U+00AD soft hyphen,
// U+200B-200D zero-width space/joiner/non-joiner, U+2060 word joiner, U+FEFF BOM.
const ZERO_WIDTH = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;
// Cyrillic (U+0400-04FF) + Greek (U+0370-03FF) ranges where confusables live.
const LOOKALIKE_RE = /[\u0370-\u03FF\u0400-\u04FF]/g;

/**
 * Normalize text before pattern matching. Strips Reddit markdown, removes
 * zero-width / soft-hyphen evasion, folds common look-alike characters,
 * applies NFKC, and collapses whitespace. Exposed for testing.
 */
export function normalizeText(text: string): string {
  if (typeof text !== 'string' || text.length === 0) return '';

  let t = text;

  // Strip invisible characters that get inserted to break word patterns
  // (zero-width space/joiner/non-joiner, BOM, soft hyphen, word joiner).
  t = t.replace(ZERO_WIDTH, '');

  // NFKC folds full-width chars (Ｄ → D), ligatures, etc.
  try { t = t.normalize('NFKC'); } catch { /* old runtime — skip */ }

  // Map common Cyrillic/Greek look-alikes to their ASCII counterparts.
  t = t.replace(LOOKALIKE_RE, (ch) => LOOKALIKES[ch] ?? ch);

  // Strip Reddit markdown so syntax characters don't break word boundaries.
  // Order matters: handle nested syntax outermost-first.
  t = t.replace(/```[\s\S]*?```/g, ' ');           // fenced code blocks
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');  // images
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');   // links
  t = t.replace(/`([^`]+)`/g, '$1');               // inline code
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1');         // bold
  t = t.replace(/__([^_]+)__/g, '$1');             // bold (alt)
  t = t.replace(/\*([^*\s][^*]*?)\*/g, '$1');      // italic
  t = t.replace(/(?<!\w)_([^_\s][^_]*?)_(?!\w)/g, '$1'); // italic (alt) — avoid snake_case
  t = t.replace(/~~([^~]+)~~/g, '$1');             // strikethrough
  t = t.replace(/^\s{0,3}>\s?/gm, '');             // blockquote prefix
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '');        // headings
  t = t.replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1');// escaped markdown chars

  // Collapse all whitespace runs to single spaces.
  t = t.replace(/\s+/g, ' ').trim();

  return t;
}

export function scanContent(text: string): ScanResult {
  const matchedPatterns: MatchedPattern[] = [];
  let score = 0;

  const normalized = normalizeText(text);
  if (normalized.length === 0) {
    return { score: 0, matchedPatterns, riskLevel: 'none' };
  }

  for (const p of BAIT_PATTERNS) {
    const m = normalized.match(p.pattern);
    if (m) {
      matchedPatterns.push({
        category: p.category,
        description: p.description,
        weight: p.weight,
        match: m[0],
      });
      score += p.weight;
    }
  }

  score = Math.min(score, 100);

  let riskLevel: RiskLevel = 'none';
  if (score >= 51) riskLevel = 'high';
  else if (score >= 21) riskLevel = 'medium';
  else if (score >= 1) riskLevel = 'low';

  return { score, matchedPatterns, riskLevel };
}

export function mergeCustomPatterns(customPatternsText: string): void {
  // Replace previous custom patterns rather than accumulating across calls.
  for (let i = BAIT_PATTERNS.length - 1; i >= 0; i--) {
    if (BAIT_PATTERNS[i].category === CUSTOM_CATEGORY) {
      BAIT_PATTERNS.splice(i, 1);
    }
  }

  if (typeof customPatternsText !== 'string' || customPatternsText.trim().length === 0) {
    return;
  }

  const lines = customPatternsText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  for (const line of lines) {
    const escaped = line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    BAIT_PATTERNS.push({
      pattern: new RegExp(`\\b${escaped}\\b`, 'i'),
      category: CUSTOM_CATEGORY,
      weight: 7,
      description: `Custom pattern: ${line}`,
    });
  }
}
