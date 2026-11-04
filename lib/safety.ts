// High-priority safety and slur filter.
// Prevents ChitChatBot from ever translating or echoing hate speech, racial slurs,
// homophobic slurs, or severe TOS violations into Kick / Twitch stream chat.

// Core high-severity terms, slurs, and evasion patterns across English and common languages
const BANNED_PATTERNS: RegExp[] = [
  // Racial and ethnic slurs (including common leetspeak / evasion variations)
  /\bn+[i1!|l]+[g9]+[e3a4@]+[rzk]?s?\b/i,
  /\bf+[a4@]+[g9]+[o0e3i1!|l]*[t7s]?s?\b/i,
  /\bk+[i1!|l]+k+[e3]+\b/i,
  /\bc+[h]+[i1!|l]+n+k+\b/i,
  /\bs+[p]+[i1!|l]+c+\b/i,
  /\bw+[e3]+t+b+[a4@]+c+k+\b/i,
  /\bg+[o0]+o+k+\b/i,
  // Severe sexual violence / self-harm incitement
  /\bk+y+s\b/i,
  /\bkill\s+your\s*self\b/i,
  // Spanish / Portuguese slurs
  /\bm+a+r+i+c+[oó]+n+\b/i,
  /\bv+i+a+d+[aãá]+o+\b/i,
  /\bn+e+g+r+[oó]+s?\s+d+e?\s+m+i+e+r+d+a+\b/i,
  // Russian slurs / hate terms. (?<!..) and (?!..) instead of \b, because \b does not work next to Cyrillic letters.
  /(?<![\p{L}\p{N}])[хx][уy][йj][яеёию]?\p{L}*/iu,
  /(?<![\p{L}\p{N}])[пp][иiеe][дd][оoаa][рr]\p{L}*/iu,
  /(?<![\p{L}\p{N}])[чc][уy][рr][кk][аaеeиi]?(?![\p{L}\p{N}])/iu,
  /(?<![\p{L}\p{N}])[хx][оo][хx][оo][лl]\p{L}*/iu
];

/**
 * Checks whether a message contains severe hate speech or banned slurs.
 * Returns true if safe, false if harmful/banned content was detected.
 */
export function isContentSafe(text: string): boolean {
  if (!text) return true;
  const clean = text.replace(/[\s._\-*/\\]+/g, ' ');

  for (const re of BANNED_PATTERNS) {
    if (re.test(clean) || re.test(text)) {
      return false;
    }
  }

  return true;
}
