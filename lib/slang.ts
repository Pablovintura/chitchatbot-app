// Comprehensive chat slang, abbreviations, and laughter normalizer across all 23 languages.
// Cloudflare Workers AI (Meta M2M-100 & Llama 3.1) was trained on formal text, so expanding chat shorthand,
// normalizing internet laughter, mapping gamer metaphors, and collapsing letter spam dramatically increases translation accuracy.

const SLANG_DICTS: Record<string, Record<string, string>> = {
  es: {
    'q': 'que', 'pq': 'porque', 'xq': 'porque', 'tmb': 'también', 'tamb': 'también',
    'd': 'de', 'toy': 'estoy', 'tas': 'estás', 'xfa': 'por favor', 'porfa': 'por favor',
    'ntp': 'no te preocupes', 'msg': 'mensaje', 'gcs': 'gracias', 'gx': 'gracias',
    'bn': 'bien', 'kn': 'quien', 'mñn': 'mañana',
    // Gamer chat
    'manco': 'noob', 'mancos': 'noobs', 'chetado': 'op', 'chetada': 'op',
    'campero': 'camper', 'rushear': 'rush', 'farmear': 'farm', 'carrear': 'carry',
    'tiro': 'shot', 'partidaza': 'great game'
  },
  pt: {
    'vc': 'você', 'vcs': 'vocês', 'pq': 'porque', 'tbm': 'também', 'blz': 'beleza',
    'vlw': 'valeu', 'flw': 'falou', 'msg': 'mensagem', 'ta': 'está', 'tá': 'está',
    'to': 'estou', 'tô': 'estou', 'mto': 'muito', 'obg': 'obrigado', 'nd': 'nada',
    'qnd': 'quando', 'qto': 'quanto', 'sdds': 'saudades', 'q': 'que',
    // Gamer chat
    'mitou': 'legend', 'tiltou': 'tilted', 'trollou': 'trolled', 'trolar': 'troll',
    'patão': 'noob', 'jogão': 'great match'
  },
  fr: {
    'slt': 'salut', 'cv': 'ça va', 'bcp': 'beaucoup', 'stp': "s'il te plaît",
    'svp': "s'il vous plaît", 'mdr': 'mort de rire', 'ptdr': 'mort de rire',
    'pk': 'pourquoi', 'tjr': 'toujours', 'tjrs': 'toujours', 'jpp': "j'en peux plus",
    'cad': "c'est-à-dire", 'g': "j'ai", 'chui': 'je suis', 'chuis': 'je suis',
    // Gamer chat
    'nul': 'noob', 'cheaté': 'op', 'cheater': 'cheater', 'bg': 'beau gosse', 'tryhard': 'tryhard'
  },
  de: {
    'kp': 'kein Plan', 'vllt': 'vielleicht', 'hgw': 'herzlichen Glückwunsch',
    'ka': 'keine Ahnung', 'ne': 'nein', 'nee': 'nein', 'we': 'Wochenende', 'bd': 'bis dann',
    // Gamer chat
    'lost': 'confused', 'hacker': 'cheater'
  },
  it: {
    'cmq': 'comunque', 'nn': 'non', 'sn': 'sono', 'xk': 'perché', 'xchè': 'perché',
    'tvb': 'ti voglio bene', 'msg': 'messaggio', 'dv': 'dove', 'qnd': 'quando', 'tt': 'tutto',
    'raga': 'ragazzi',
    // Gamer chat
    'scarso': 'noob', 'nabbo': 'noob', 'camperone': 'camper'
  },
  nl: {
    'mss': 'misschien', 'idd': 'inderdaad', 'wsl': 'waarschijnlijk', 'zsm': 'zo snel mogelijk',
    'thx': 'dank je',
    // Gamer chat
    'cheater': 'cheater', 'lekker': 'nice'
  },
  pl: {
    'dzk': 'dzięki', 'dz': 'dzięki', 'cb': 'ciebie', 'sb': 'siebie', 'nwm': 'nie wiem',
    'bd': 'będę', 'jj': 'już jestem', 'zw': 'zaraz wracam', 'kc': 'kocham cię', 'spk': 'spoko',
    // Gamer chat
    'lama': 'noob', 'czit': 'cheat', 'cziter': 'cheater', 'ogar': 'get good'
  },
  tr: {
    'slm': 'selam', 'mrb': 'merhaba', 'tşk': 'teşekkürler', 'tsk': 'teşekkürler',
    'nbr': 'ne haber', 'kib': 'kendine iyi bak', 'rc': 'rica ederim', 'eyw': 'eyvallah',
    // Gamer chat
    'kolsuz': 'noob', 'hile': 'cheater', 'hileci': 'cheater', 'bot': 'bot'
  },
  id: {
    'yg': 'yang', 'dgn': 'dengan', 'bgt': 'banget', 'sdh': 'sudah', 'udh': 'sudah',
    'blm': 'belum', 'gk': 'tidak', 'gak': 'tidak', 'ga': 'tidak', 'gmn': 'gimana',
    'tp': 'tapi', 'krn': 'karena', 'sy': 'saya', 'km': 'kamu', 'tks': 'terima kasih',
    'tq': 'terima kasih', 'jg': 'juga',
    // Gamer chat
    'bocil': 'kid', 'jago': 'pro', 'beban': 'feeder', 'sultan': 'rich player'
  },
  ms: {
    'yg': 'yang', 'dgn': 'dengan', 'tak': 'tidak', 'tk': 'tidak', 'dah': 'sudah',
    'blm': 'belum', 'camne': 'macam mana', 'sy': 'saya', 'awk': 'awak', 'tq': 'terima kasih',
    // Gamer chat
    'koyak': 'tilted', 'padu': 'solid', 'mantap': 'great', 'sembang': 'talk big'
  },
  vi: {
    'k': 'không', 'ko': 'không', 'kh': 'không', 'dc': 'được', 'đc': 'được',
    'ng': 'người', 'bt': 'biết', 'ntn': 'như thế nào', 'bh': 'bây giờ', 'ms': 'mới',
    'vs': 'với', 'mik': 'mình',
    // Gamer chat
    'gà': 'noob', 'hack': 'cheater'
  },
  tl: {
    'd2': 'dito', 'aq': 'ako', 'bkit': 'bakit', 'lam': 'alam', 'kc': 'kasi',
    'prang': 'parang', 'sya': 'siya', 'kelan': 'kailan', 'tlga': 'talaga', 'slamat': 'salamat',
    // Gamer chat
    'bano': 'noob', 'banoo': 'noob', 'lakas': 'strong', 'petmalu': 'legendary'
  },
  sv: {
    'ngn': 'någon', 'ngt': 'något', 'tkr': 'tycker', 'vrf': 'varför', 'kmr': 'kommer',
    'tackar': 'tack så mycket'
  },
  ro: {
    'ms': 'mulțumesc', 'cp': 'cu plăcere', 'dc': 'de ce', 'pt': 'pentru', 'np': 'nicio problemă'
  },
  ru: {
    'спс': 'спасибо', 'пж': 'пожалуйста', 'пжлст': 'пожалуйста', 'плз': 'пожалуйста',
    'прив': 'привет', 'норм': 'нормально', 'крч': 'короче', 'хз': 'не знаю',
    'кст': 'кстати', 'ок': 'хорошо',
    // Gamer chat
    'рак': 'нуб', 'имба': 'имба', 'ливнул': 'вышел', 'затащил': 'выиграл', 'слил': 'проиграл', 'лаги': 'лаги'
  },
  uk: {
    'дяк': 'дякую', 'пж': 'будь ласка', 'прив': 'привіт', 'норм': 'нормально', 'хз': 'не знаю',
    // Gamer chat
    'рак': 'нуб', 'імба': 'імба', 'затягнув': 'виграв'
  },
  ja: {
    'うぽつ': '配信お疲れ様', '乙': 'お疲れ様でした'
  },
  ko: {
    'ㄱㅅ': '감사합니다', 'ㅈㅅ': '죄송합니다', 'ㅇㅋ': '오케이', 'ㅊㅋ': '축하합니다',
    'ㄹㅇ': '진짜로'
  },
  th: {
    'คถ': 'คิดถึง', 'จิง': 'จริง'
  },
  ar: {
    'يسلمو': 'شكراً', 'مشكور': 'شكراً لك'
  }
};

// JavaScript's \b only understands A-Z, so Cyrillic uses explicit "not next to a letter" checks instead.
const VI_FOOD = new Set(['rán', 'nướng', 'luộc', 'kho', 'xào', 'chiên', 'quay', 'hầm', 'nấu', 'cơm', 'phở', 'bún', 'xé', 'tần']);
const LAUGHTER: [RegExp, string, string?][] = [
  [/\b(?:j[aeiou]){2,}j?\b/gi, 'haha', 'pl'], // third item: a language where this pattern is a real word (Polish "jaja" = eggs), so it is skipped
  [/\b(?:k{3,}|(?:hue){2,})\b/gi, 'haha'],
  [/(?<![A-Za-z0-9])[wW]{3,}(?![A-Za-z0-9])/g, ' (haha) '], // Japanese chat glues www to the sentence (面白いwww); English "awwww" has a letter before it, so it is left alone
  [/草+/g, ' (haha) '],
  [/[ㅋ]{2,}/g, ' haha '],
  [/[ㅎ]{2,}/g, ' haha '],
  [/\b5{3,}\b/g, 'haha'],
  [/(?<![\p{L}\p{N}])(?:[ах]{4,}|ы{3,})(?![\p{L}\p{N}])/giu, 'хаха']
];

/**
 * Normalizes live chat slang, shorthand abbreviations, repeated/elongated letters,
 * and cultural laughter patterns across all 23 supported languages in a single fast token pass.
 */
export function normalizeSlang(text: string, sourceLang?: string): string {
  if (!text) return '';
  let out = text;

  // 1. Normalize laughter patterns
  for (const [re, rep, skipLang] of LAUGHTER) {
    if (skipLang && sourceLang === skipLang) continue;
    out = out.replace(re, rep);
  }

  // 2. Tokenize words vs delimiters for accurate O(N) word substitution
  const dict = sourceLang && Object.hasOwn(SLANG_DICTS, sourceLang) ? SLANG_DICTS[sourceLang] : null;
  // Own keys only: a chatter typing "constructor" or "toString" must not pull in JavaScript's built-ins.
  const look = (d: Record<string, string>, k: string) => (Object.hasOwn(d, k) ? d[k] : undefined);
  const tokens = out.split(/([^\p{L}\p{N}']+)/u);

  const res = tokens.map((token, i) => {
    // If not a word token, keep as-is
    if (!token || !/[\p{L}\p{N}]/u.test(token)) return token;

    // Fold 3+ consecutive identical letters down to 2: siiiii -> sii, porfaaaaa -> porfaa
    const folded2 = token.replace(/(\p{L})\1{2,}/gu, '$1$1');
    const lower2 = folded2.toLowerCase();

    // Fold down to 1: porfaa -> porfa, sii -> si
    const folded1 = token.replace(/(\p{L})\1+/gu, '$1');
    const lower1 = folded1.toLowerCase();

    // Check dictionary in order:
    // Vietnamese "gà" is noob slang, but also just chicken: leave it alone next to a cooking word ("gà rán").
    if (sourceLang === 'vi' && lower2 === 'gà') {
      const next = (tokens[i + 2] || '').toLowerCase();
      if (VI_FOOD.has(next)) return folded2;
    }
    // a. Direct lookup on folded2
    if (dict) { const a = look(dict, lower2); if (a !== undefined) return a; }
    // b. Lookup on folded1
    if (dict) { const b = look(dict, lower1); if (b !== undefined) return b; }

    if (!dict) {
      for (const d of Object.values(SLANG_DICTS)) {
        const a = look(d, lower2); if (a !== undefined) return a;
        const b = look(d, lower1); if (b !== undefined) return b;
      }
    }

    // Return folded2 so machine translation models see a clean token instead of broken letter spam
    return folded2;
  });

  let joined = res.join('');
  // Japanese and Thai are written without spaces, so a whole sentence is one "word". Longer slang entries are found inside it instead.
  if (dict && (sourceLang === 'ja' || sourceLang === 'th')) {
    for (const [k, v] of Object.entries(dict)) if (k.length >= 3 && joined.includes(k)) joined = joined.split(k).join(v);
  }
  return joined.replace(/\s+/g, ' ').trim();
}

/**
 * Universal post-processing filter that polishes machine translation output:
 * 1. Strips unnecessary quotes, backticks, or leading hyphens/bullets
 * 2. Deduplicates model repetition loops (hallucinations)
 * 3. Cleans excessive punctuation (???? -> ?, !!!! -> !)
 * 4. Ensures clean sentence capitalization
 * 5. Preserves all-caps excitement if the chatter typed in ALL CAPS
 */
export function postProcessTranslation(text: string, original?: string): string {
  if (!text) return '';
  let out = text.trim();

  // Strip outer quotes, markdown backticks, or leading hyphens/bullets
  out = out.replace(/^["'`\-—\s]+|["'`\s]+$/g, '').trim();

  // Deduplicate repeated phrase loops (e.g. "good game good game good game" -> "good game")
  out = out.replace(/(\b[\p{L}\p{N}'\s]{2,20}\b)(?:\s+\1){2,}/giu, '$1');

  // Clean excessive punctuation (e.g. ?????? -> ?, !!!!!! -> !)
  out = out.replace(/\?{2,}/g, '?').replace(/!{2,}/g, '!').replace(/\.{3,}/g, '…');

  // Capitalize first character if lowercase
  if (out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }

  // If original was ALL CAPS (at least 4 letters) and not single letter, preserve excitement
  const letters = (original || '').replace(/[^\p{L}]+/gu, '');
  if (letters.length >= 4 && letters === letters.toUpperCase()) {
    out = out.toUpperCase();
  }

  return out;
}
