// Comprehensive chat slang, abbreviations, and laughter normalizer across all 23 languages.
// Cloudflare Workers AI (Meta M2M-100) was trained on formal text, so expanding chat shorthand
// and normalizing internet laughter dramatically increases translation accuracy.

const SLANG_DICTS: Record<string, Record<string, string>> = {
  es: {
    'q': 'que', 'pq': 'porque', 'xq': 'porque', 'tmb': 'también', 'tamb': 'también',
    'd': 'de', 'toy': 'estoy', 'tas': 'estás', 'xfa': 'por favor', 'porfa': 'por favor',
    'ntp': 'no te preocupes', 'msg': 'mensaje', 'gcs': 'gracias', 'gx': 'gracias',
    'bn': 'bien', 'kn': 'quien', 'mñn': 'mañana'
  },
  pt: {
    'vc': 'você', 'vcs': 'vocês', 'pq': 'porque', 'tbm': 'também', 'blz': 'beleza',
    'vlw': 'valeu', 'flw': 'falou', 'msg': 'mensagem', 'ta': 'está', 'tá': 'está',
    'to': 'estou', 'tô': 'estou', 'mto': 'muito', 'obg': 'obrigado', 'nd': 'nada',
    'qnd': 'quando', 'qto': 'quanto', 'sdds': 'saudades', 'q': 'que'
  },
  fr: {
    'slt': 'salut', 'cv': 'ça va', 'bcp': 'beaucoup', 'stp': "s'il te plaît",
    'svp': "s'il vous plaît", 'mdr': 'mort de rire', 'ptdr': 'mort de rire',
    'pk': 'pourquoi', 'tjr': 'toujours', 'tjrs': 'toujours', 'jpp': "j'en peux plus",
    'cad': "c'est-à-dire", 'g': "j'ai", 'chui': 'je suis', 'chuis': 'je suis'
  },
  de: {
    'kp': 'kein Plan', 'vllt': 'vielleicht', 'hgw': 'herzlichen Glückwunsch',
    'ka': 'keine Ahnung', 'ne': 'nein', 'nee': 'nein', 'we': 'Wochenende', 'bd': 'bis dann'
  },
  it: {
    'cmq': 'comunque', 'nn': 'non', 'sn': 'sono', 'xk': 'perché', 'xchè': 'perché',
    'tvb': 'ti voglio bene', 'msg': 'messaggio', 'dv': 'dove', 'qnd': 'quando', 'tt': 'tutto',
    'raga': 'ragazzi'
  },
  nl: {
    'mss': 'misschien', 'idd': 'inderdaad', 'wsl': 'waarschijnlijk', 'zsm': 'zo snel mogelijk',
    'thx': 'dank je'
  },
  pl: {
    'dzk': 'dzięki', 'dz': 'dzięki', 'cb': 'ciebie', 'sb': 'siebie', 'nwm': 'nie wiem',
    'bd': 'będę', 'jj': 'już jestem', 'zw': 'zaraz wracam', 'kc': 'kocham cię', 'spk': 'spoko'
  },
  tr: {
    'slm': 'selam', 'mrb': 'merhaba', 'tşk': 'teşekkürler', 'tsk': 'teşekkürler',
    'nbr': 'ne haber', 'kib': 'kendine iyi bak', 'rc': 'rica ederim', 'eyw': 'eyvallah'
  },
  id: {
    'yg': 'yang', 'dgn': 'dengan', 'bgt': 'banget', 'sdh': 'sudah', 'udh': 'sudah',
    'blm': 'belum', 'gk': 'tidak', 'gak': 'tidak', 'ga': 'tidak', 'gmn': 'gimana',
    'tp': 'tapi', 'krn': 'karena', 'sy': 'saya', 'km': 'kamu', 'tks': 'terima kasih',
    'tq': 'terima kasih', 'jg': 'juga'
  },
  ms: {
    'yg': 'yang', 'dgn': 'dengan', 'tak': 'tidak', 'tk': 'tidak', 'dah': 'sudah',
    'blm': 'belum', 'camne': 'macam mana', 'sy': 'saya', 'awk': 'awak', 'tq': 'terima kasih'
  },
  vi: {
    'k': 'không', 'ko': 'không', 'kh': 'không', 'dc': 'được', 'đc': 'được',
    'ng': 'người', 'bt': 'biết', 'ntn': 'như thế nào', 'bh': 'bây giờ', 'ms': 'mới',
    'vs': 'với', 'mik': 'mình'
  },
  tl: {
    'd2': 'dito', 'aq': 'ako', 'bkit': 'bakit', 'lam': 'alam', 'kc': 'kasi',
    'prang': 'parang', 'sya': 'siya', 'kelan': 'kailan', 'tlga': 'talaga', 'slamat': 'salamat'
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
    'кст': 'кстати', 'ок': 'хорошо'
  },
  uk: {
    'дяк': 'дякую', 'пж': 'будь ласка', 'прив': 'привіт', 'норм': 'нормально', 'хз': 'не знаю'
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

const LAUGHTER: [RegExp, string][] = [
  [/\b(?:j[aeiou]){2,}j?\b/gi, 'haha'],
  [/\b(?:k{3,}|(?:hue){2,})\b/gi, 'haha'],
  [/[wW]{3,}/g, ' (haha) '],
  [/草+/g, ' (haha) '],
  [/[ㅋ]{2,}/g, ' haha '],
  [/[ㅎ]{2,}/g, ' haha '],
  [/\b5{3,}\b/g, 'haha'],
  [/\b(?:[ах]{4,}|ы{3,})\b/gi, 'хаха']
];

/**
 * Normalizes live chat slang, shorthand abbreviations, and cultural laughter patterns
 * across all 23 supported languages in a single fast token pass.
 */
export function normalizeSlang(text: string, sourceLang?: string): string {
  if (!text) return '';
  let out = text;

  // 1. Normalize laughter patterns
  for (const [re, rep] of LAUGHTER) {
    out = out.replace(re, rep);
  }

  // 2. Tokenize words vs delimiters for accurate O(N) word substitution
  const dict = sourceLang ? SLANG_DICTS[sourceLang] : null;
  const tokens = out.split(/([^\p{L}\p{N}']+)/u);
  const res = tokens.map(token => {
    const lower = token.toLowerCase();
    if (dict && dict[lower]) return dict[lower];
    if (!dict) {
      for (const d of Object.values(SLANG_DICTS)) {
        if (d[lower]) return d[lower];
      }
    }
    return token;
  });

  return res.join('').replace(/\s+/g, ' ').trim();
}
