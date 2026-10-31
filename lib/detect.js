// ---------- Chat translator: other languages -> English ----------
//
// Someone writes in Spanish (or another language) while you're live -> the bot posts
//   🌐 pedro: hello everyone, I love the stream
// The language is worked out here (no network, nothing sent for English). Only foreign
// messages go to Cloudflare Workers AI (m2m100, free daily allowance) to be translated.
// Nothing is stored or logged. If Cloudflare fails or the allowance runs out, the bot stays quiet.
//
// Skipped: commands, links-only/emote-only/short messages (under 3 words), anything that
// looks English, the bot itself, while offline. One translation per person per `cooldown`
// seconds, and at most PER_MINUTE translations a minute overall.
//
// Settings in bot_settings "translate": { on, cooldown }. Off by default.
// Needs CF_ACCOUNT_ID and CF_AI_TOKEN in the environment.

import { SCRIPTS, MODELS } from './langdata.js';

const MIN_WORDS = 3;
const MAX_CHAT = 500;

// franc language code -> m2m100 code
const CODES = {
  spa: 'es', por: 'pt', fra: 'fr', deu: 'de', ita: 'it', nld: 'nl', pol: 'pl', tur: 'tr', ind: 'id', zlm: 'ms',
  vie: 'vi', tgl: 'tl', swe: 'sv', ron: 'ro', rus: 'ru', ukr: 'uk', arb: 'ar', hin: 'hi',
  cmn: 'zh', jpn: 'ja', kor: 'ko', tha: 'th'
};

// Flag shown instead of a globe (a language isn't a country: Portuguese shows Brazil, Arabic Saudi Arabia, etc.).
const FLAG_COUNTRY = {
  en: 'US', es: 'ES', pt: 'BR', fr: 'FR', de: 'DE', it: 'IT', nl: 'NL', pl: 'PL', tr: 'TR', id: 'ID', ms: 'MY', vi: 'VN',
  tl: 'PH', sv: 'SE', ro: 'RO', ru: 'RU', uk: 'UA', ar: 'SA', hi: 'IN', zh: 'CN', ja: 'JP', ko: 'KR', th: 'TH'
};
export const flagFor = code => {
  const cc = FLAG_COUNTRY[code];
  return cc ? String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : '🌐';
};

// Common English and chat words. A message where many words are these is treated as English.
const ENGLISH = new Set(('the an and or but is are was were be been am i im i\'m you u your ur he she it its it\'s we they them ' +
  'this that these those what whats what\'s who where when why how which do does did dont don\'t cant can\'t can could ' +
  'would should will wont won\'t have has had not yes yeah yep nah of to on at for with from by up down out ' +
  'about just so very really too my mine our his her their there here then than now like love good bad nice ' +
  'cool lol lmao lmfao omg wtf bro bruh dude man guys guy yo hey hi hello thanks thank pls please lets let\'s let go ' +
  'gonna wanna gotta get got see look know think fr ngl tbh idk im ok okay damn wow haha hahaha xd one all some ' +
  'more much stream chat pablo ' +
  'also fine well great happy sorry sure maybe already still again always never today tonight tomorrow yesterday night day ' +
  'morning game games play played playing win won lose lost said say says make made take took come came going went want need ' +
  'thought feel felt hope wish tell told give gave work working watch watching watched streamer live back home time thing things ' +
  'people everyone everybody anyone nobody something nothing many lot lots little big new old first last next long only even ' +
  'because though while after before into over off too end sad mad best better worst sleep eat food wait sec minute hour right ' +
  'true real wrong guess kinda sorta nope gg ez clip ban sup nvm thx ty np brb afk also').split(' '));

const SPANISH = new Set('que qué muy eres estás está estoy hermano hermanos gracias donde dónde cómo como hola wey güey jaja jajaja jeje lindo linda amigo amiga pero porque también tambien nosotros ustedes usted bueno buena buenas buenos hoy mañana ahora aquí allí bien mucho mucha muchas muchos tengo tienes quiero puedo hay soy eso esto esta este el los las del al para por con sin te amo'.split(' '));
const PORTUGUESE = new Set('você vocês voce voces não nao tudo obrigado obrigada muito muita kkk kkkk kkkkk mano irmão está estou isso isto aqui agora bom boa bem também eu gosto quero posso tem sou da do das dos no na nos nas pra pro com sem te amo'.split(' '));

// Telltale words per language: the trigram guess is a coin flip on short chat, these settle it.
const W = x => new Set(x.split(' '));
const TELL = {
  es: new Set([...SPANISH, ...'no me nada gusta puede ser vamos noches todos quiero mucho ahora casa jajaja saludos desde mexico argentina chile colombia peru españa espana capo crack loco dale'.split(' ')]),
  pt: new Set([...PORTUGUESE, ...'salve tmj galera fala certo saudades vlw valeu blz'.split(' ')]),
  pl: W('siema wszystkim dobry dobra stary cześć czesc dzięki dzieki jak się sie jest nie tak super świetny swietny dzisiaj wszyscy pozdrawiam pozdro witam dobranoc kocham fajny fajnie ale już juz bardzo dla jestem mamy macie wam'),
  fr: W('je tu il elle nous vous ils est sont suis très tres trop bien pas pour avec mais oui bonsoir bonjour merci tout tous monde mec va fort soirée soiree bonne c\'est cest ça ca aussi super génial content soir les des une du au aux dans sur'),
  it: W('ciao grazie mille per lo che bello bella questo questa gioco tutti tutto sei il migliore mi piace tantissimo come stai state oggi amico ragazzi buonasera buongiorno serata sono anche molto bravo forza andiamo ma siete'),
  de: W('ich bin ist das der die und nicht auch sehr heute müde mude du bist wir sind ein eine mit für fur aber schon gut danke bitte hallo guten abend morgen zusammen lustig liebe wie geht ja nein mal noch nur wenn dann jetzt spiel'),
  nl: W('groetjes uit nederland nederlands groeten ik je jij is het een de niet ook zo dit dat wat maar heel erg goed goedenavond allemaal hoi hallo dank bedankt grappig leuk lekker kijk kijken nu wel nog jullie gaan mooi vandaag vanavond hoe gaat mijn jouw naar voor met'),
  sv: W('jag du är ar det och inte också hej hur mår mar ni vi allihopa alla bra tack kul roligt idag ikväll god kväll natt mycket bara på pa med för från vad en ett den älskar tjena'),
  tl: W('pa idol idols ang ng mga sa na po opo ako ikaw ka mo ko siya kami tayo kayo namin natin salamat kumusta kamusta magandang gabi umaga hapon galing talaga sobra ganda maganda astig lahat pare naman lang din rin ba ay yung ito hindi oo wala may mahal gusto nakakatawa grabe sana'),
  id: W('aku saya kamu anda kau dia kami kita kalian ini itu yang dan di ke dari untuk dengan tidak nggak gak ga enggak bukan sudah udah belum lagi banget sekali bagus seru keren halo hai apa kabar semua terima kasih makasih selamat malam pagi siang sore bang kak gimana bisa mau juga aja saja deh dong sih nih kok suka'),
  ms: W('saya awak kamu kita kami ini itu yang dan di ke dari untuk dengan tidak tak bukan sudah dah belum lagi sangat sekali bagus hebat suka siaran halo hai apa khabar semua terima kasih selamat malam pagi tengah hari boleh nak mahu juga je lah pun kan macam best tahniah')
};
const GROUP = { es: 1, pt: 1, fr: 1, it: 1, de: 2, nl: 2, sv: 2, id: 3, ms: 3, tl: 3, pl: 4 };
function tellHits(words) {
  const hits = {};
  for (const [lang, set] of Object.entries(TELL)) hits[lang] = words.filter(w => set.has(w)).length;
  const [top, n] = Object.entries(hits).sort((a, b) => b[1] - a[1])[0];
  return { hits, top, n };
}

const MAX_DIFF = 300;
const MODEL_RANKS = {};
for (const [script, langs] of Object.entries(MODELS)) {
  MODEL_RANKS[script] = {};
  for (const [lang, model] of Object.entries(langs)) {
    const ranks = {};
    model.split('|').forEach((tri, i) => { ranks[tri] = i; });
    MODEL_RANKS[script][lang] = ranks;
  }
}
const SINGLE = { cmn: 'cmn', jpn: 'jpn', kor: 'kor', tha: 'tha' };

function trigramTuples(text) {
  const clean = ' ' + String(text).replace(/[!-@]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase() + ' ';
  const counts = {};
  for (let i = 0; i + 3 <= clean.length; i++) { const t = clean.slice(i, i + 3); counts[t] = (counts[t] || 0) + 1; }
  return Object.entries(counts).sort((a, b) => a[1] - b[1]);
}

// Strip what isn't words: Kick emotes, links, @mentions.
export function cleanForDetect(text) {
  return String(text || '')
    .replace(/[\u2018\u2019\u02BC`´]/g, "'") // phone keyboards type he’s, not he's
    .replace(/\[emote:\d+:[^\]]*\]/g, ' ')
    .replace(/https?:\/\/\S+|\bwww\.\S+/gi, ' ')
    .replace(/@\w+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Returns an m2m100 language code, or null when it's English / unsure / too short.
export function detectLanguage(raw) {
  const text = cleanForDetect(raw);
  if (text.length < 4) return null;

  // Which writing system is used most.
  let top = null, topCount = 0;
  for (const [script, re] of Object.entries(SCRIPTS)) {
    const n = (text.match(re) || []).length;
    if (n > topCount) { topCount = n; top = script; }
  }
  if (!top || !topCount) return null;
  if (SINGLE[top]) return text.replace(/\s/g, '').length >= 4 ? CODES[SINGLE[top]] : null;
  if (text.length < 10) return null;

  let words = [];
  if (top === 'Latin') {
    words = text.toLowerCase().match(/[\p{L}']+/gu) || [];
    if (words.length < MIN_WORDS) return null;
    const english = words.filter(w => ENGLISH.has(w)).length;
    const t = tellHits(words);
    if (english / words.length >= (words.length <= 4 ? 0.34 : 0.4) && !(t.n >= 3 && t.n > english)) return null;
    // Plenty of telltale words for one language (ich bin heute sehr müde): no guessing needed.
    if (t.n >= 3 && t.n > english) return t.top;
  }

  const langs = MODEL_RANKS[top];
  if (!langs) return null;
  const tuples = trigramTuples(text.slice(0, 2048));
  const scores = Object.entries(langs).map(([lang, ranks]) => {
    let d = 0;
    for (const [tri, count] of tuples) d += tri in ranks ? Math.abs(count - ranks[tri] - 1) : MAX_DIFF;
    return [lang, d];
  }).sort((a, b) => a[1] - b[1]);
  const [best] = scores;
  // Short chat: the trigram guess often lands on a close cousin (Spanish/Portuguese, Indonesian/Malay, Swedish/Italian). Telltale words win.
  if (top === 'Latin' && best && words.length) {
    const t = tellHits(words);
    const eng = words.filter(w => ENGLISH.has(w)).length;
    const guess = CODES[best[0]];
    const own = guess ? t.hits[guess] || 0 : 0;
    if (t.top === guess && t.n >= 2 && t.n > eng) return guess; // the words back up the guess: no need to second-guess it
    if (t.top !== guess && t.n > own && t.n >= eng && (t.n >= 2 || (guess && GROUP[guess] === GROUP[t.top]))) return t.top;
  }
  if (!best || best[0] === 'eng') return null;
  // English close behind = too unsure, skip.
  const min = best[1], max = text.length * MAX_DIFF - min;
  const eng = scores.find(s => s[0] === 'eng');
  if (eng && max > 0 && 1 - (eng[1] - min) / max >= 0.85) return null;
  // Turkish letters (ş ğ ı İ) don't exist in Malay, Indonesian or the other Latin guesses: settle it.
  if (top === 'Latin' && /[şğıİ]/.test(text) && !/[ñ¿¡ãõ]/.test(text)) return 'tr';
  return CODES[best[0]] || null;
}

// True when the message is clearly English (used when the streamer's language is not English).
export function looksEnglish(raw) {
  const text = cleanForDetect(raw);
  if (text.length < 10) return false;
  const words = text.toLowerCase().match(/[\p{L}']+/gu) || [];
  if (words.length < MIN_WORDS) return false;
  return words.filter(w => ENGLISH.has(w)).length / words.length >= 0.4;
}
