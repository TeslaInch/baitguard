/**
 * Local test harness for the BaitGuard pattern engine.
 *
 * NOT shipped with the Devvit app — run via `npx tsx src/test-patterns.ts`.
 * Validates the detection regex set against realistic positive and negative
 * samples, plus regression cases for false-positive concerns called out in
 * the spec ("interested", "DM", "free", "message" alone).
 */

import {
  BAIT_PATTERNS,
  mergeCustomPatterns,
  normalizeText,
  scanContent,
} from './patterns';

type PositiveCase = {
  text: string;
  // The minimum combined score we expect this case to produce. Set
  // generously — false negatives are the failure mode here.
  minScore: number;
  // At least one matched category must contain this substring.
  expectCategory?: string;
};

type NegativeCase = {
  text: string;
  // Allow a small score floor so a single weak pattern (e.g. "limited time"
  // in a non-bait sentence) doesn't fail the whole suite. Negatives must
  // stay below the medium-sensitivity post threshold (45).
  maxScore?: number;
};

// =========================================================================
// SHOULD CATCH — 18 bait posts (15 from spec + 3 evasion regressions)
// =========================================================================

const POSITIVE_CASES: PositiveCase[] = [
  { text: 'DM me for the free trading guide!', minScore: 14, expectCategory: 'DM Bait' },
  { text: "Comment INTERESTED and I'll send you the link", minScore: 8, expectCategory: 'Comment Bait' },
  { text: 'Upvote this post and check my profile for the resource', minScore: 16, expectCategory: 'Upvote Bait' },
  { text: '🔥 Only 10 spots left! Message me now before they\'re gone', minScore: 14, expectCategory: 'Scarcity' },
  { text: 'Who wants the template? Drop a YES below', minScore: 8, expectCategory: 'Fake Giveaway' },
  { text: 'I made a free tool, shoot me a message to get access', minScore: 15, expectCategory: 'DM Bait' },
  { text: 'Slide into my DMs for crypto tips', minScore: 9, expectCategory: 'DM Bait' },
  { text: 'Like this post and follow for more content', minScore: 16, expectCategory: 'Upvote Bait' },
  { text: 'Tag 3 friends and share to unlock the guide', minScore: 16, expectCategory: 'Follow/Share Bait' },
  { text: 'First 50 people to comment get a free copy', minScore: 14, expectCategory: 'Scarcity' },
  { text: "Type ME and I'll PM you the spreadsheet", minScore: 7, expectCategory: 'Comment Bait' },
  { text: 'Smash that upvote button if you agree!', minScore: 10, expectCategory: 'Upvote Bait' },
  { text: 'Want the link? Just DM me with INTERESTED', minScore: 18, expectCategory: 'DM Bait' },
  { text: "Last chance! Limited slots, act now before it's gone", minScore: 23, expectCategory: 'Scarcity' },
  { text: "I'll send you the free template, just upvote and comment INFO", minScore: 24, expectCategory: 'Fake Giveaway' },

  // Evasion regressions — these must still hit after normalization.
  {
    text: 'D​M me for the link', // zero-width space inside DM
    minScore: 9,
    expectCategory: 'DM Bait',
  },
  {
    text: '**Comment YES** for *the link*', // Reddit markdown wrappers
    minScore: 8,
    expectCategory: 'Comment Bait',
  },
  {
    text: 'Сomment YES below', // Cyrillic 'С' look-alike for ASCII 'C'
    minScore: 8,
    expectCategory: 'Comment Bait',
  },
];

// =========================================================================
// SHOULD NOT CATCH — 18 legitimate posts (15 from spec + 3 false-positive
// regressions for the words the spec called out)
// =========================================================================

const NEGATIVE_CASES: NegativeCase[] = [
  { text: 'You can DM the mods if you have questions' },
  { text: "I'm interested in learning Python" },
  { text: 'Please upvote helpful answers in this thread' },
  { text: "I'll message the seller about availability" },
  { text: 'Comment your favorite programming language' },
  { text: 'Check the sidebar for community resources' },
  { text: 'I made a small program in my free time' },
  { text: 'The error message says undefined variable' },
  { text: 'Type the command in the terminal' },
  { text: 'Edit your post if you find typos' },
  { text: 'I have limited experience with Rust' },
  { text: 'Last week I learned about hash maps' },
  { text: 'Follow these steps to install the package' },
  { text: 'Share your screen during the call' },
  { text: 'Free time was scarce that summer' },

  // Single-word regressions for the false-positive concerns in the spec.
  { text: 'Anyone interested? I have free advice on a message format.' },
  { text: 'I sent the DM yesterday but no reply.' },
  { text: 'The free version is fine for a personal message archive.' },
];

// =========================================================================
// Runner
// =========================================================================

let pass = 0;
let fail = 0;

function fmtMatches(scan: ReturnType<typeof scanContent>): string {
  if (scan.matchedPatterns.length === 0) return '(none)';
  return scan.matchedPatterns
    .map((m) => `${m.category}:"${m.match}"`)
    .join(' | ');
}

console.log(`Loaded ${BAIT_PATTERNS.length} default patterns.\n`);

console.log('=== POSITIVE CASES (should catch) ===');
for (const tc of POSITIVE_CASES) {
  const r = scanContent(tc.text);
  const scoreOk = r.score >= tc.minScore;
  const catOk =
    !tc.expectCategory ||
    r.matchedPatterns.some((m) => m.category.includes(tc.expectCategory!));
  if (scoreOk && catOk) {
    pass++;
    console.log(`PASS [score=${r.score} ${r.riskLevel}] "${tc.text}"`);
  } else {
    fail++;
    console.log(
      `FAIL [score=${r.score}, expected >=${tc.minScore}${tc.expectCategory ? ' incl. ' + tc.expectCategory : ''}] "${tc.text}" matches=${fmtMatches(r)}`,
    );
  }
}

console.log('\n=== NEGATIVE CASES (should NOT catch) ===');
for (const tc of NEGATIVE_CASES) {
  const ceiling = tc.maxScore ?? 10; // negative cases must stay below medium-sensitivity threshold
  const r = scanContent(tc.text);
  if (r.score <= ceiling) {
    pass++;
    console.log(`PASS [score=${r.score}] "${tc.text}"`);
  } else {
    fail++;
    console.log(
      `FAIL [score=${r.score}, expected <=${ceiling}] "${tc.text}" matches=${fmtMatches(r)}`,
    );
  }
}

// =========================================================================
// Spec regression checks: bare words must NEVER trigger any pattern.
// =========================================================================

console.log('\n=== BARE-WORD REGRESSIONS (must produce zero matches) ===');
const BARE_WORDS = ['interested', 'DM', 'free', 'message'];
for (const w of BARE_WORDS) {
  const r = scanContent(w);
  if (r.score === 0 && r.matchedPatterns.length === 0) {
    pass++;
    console.log(`PASS bare "${w}" -> 0 matches`);
  } else {
    fail++;
    console.log(`FAIL bare "${w}" -> score=${r.score} ${fmtMatches(r)}`);
  }
}

// =========================================================================
// Normalization unit checks
// =========================================================================

console.log('\n=== NORMALIZATION ===');
const normCases: { input: string; mustContain: string }[] = [
  { input: 'D​M me', mustContain: 'DM me' },
  { input: '**bold DM me**', mustContain: 'bold DM me' },
  { input: '[link text](https://example.com) DM me', mustContain: 'link text DM me' },
  { input: '`inline DM me`', mustContain: 'inline DM me' },
  { input: 'Сomment', mustContain: 'Comment' }, // Cyrillic С -> Latin C
  { input: 'multiple   spaces\n\nhere', mustContain: 'multiple spaces here' },
  { input: '> quoted DM me', mustContain: 'quoted DM me' },
];
for (const c of normCases) {
  const out = normalizeText(c.input);
  if (out.includes(c.mustContain)) {
    pass++;
    console.log(`PASS normalize "${JSON.stringify(c.input)}" -> "${out}"`);
  } else {
    fail++;
    console.log(`FAIL normalize "${JSON.stringify(c.input)}" -> "${out}", expected substring "${c.mustContain}"`);
  }
}

// =========================================================================
// Custom pattern integration
// =========================================================================

console.log('\n=== CUSTOM PATTERNS ===');
const baselineLen = BAIT_PATTERNS.length;
mergeCustomPatterns('join my discord\nfree crypto airdrop\n# this is a comment\n');
const customAdded = BAIT_PATTERNS.length - baselineLen;
if (customAdded === 2) {
  pass++;
  console.log(`PASS mergeCustomPatterns added 2 patterns (skipped # comment)`);
} else {
  fail++;
  console.log(`FAIL mergeCustomPatterns added ${customAdded}, expected 2`);
}
const customScan = scanContent('Hey, free crypto airdrop today!');
if (customScan.matchedPatterns.some((m) => m.category === 'Custom')) {
  pass++;
  console.log(`PASS custom phrase matched: ${fmtMatches(customScan)}`);
} else {
  fail++;
  console.log(`FAIL custom phrase not matched: ${fmtMatches(customScan)}`);
}
mergeCustomPatterns(''); // clear
if (BAIT_PATTERNS.length === baselineLen) {
  pass++;
  console.log(`PASS empty merge clears prior custom patterns (back to ${baselineLen})`);
} else {
  fail++;
  console.log(`FAIL clear: ${BAIT_PATTERNS.length}, expected ${baselineLen}`);
}

console.log(`\n=== TOTAL: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
