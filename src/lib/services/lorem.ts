/**
 * Lorem Ipsum placeholder text generator.
 *
 * Supports six flavors (latin / bacon / hipster / pirate / cyberpunk /
 * japanese), four output units (paragraphs / sentences / words / bytes),
 * adjustable sentence length, and six output wrappers (plain / html /
 * markdown / json / typescript / jsx).
 *
 * Word banks are small, hand-curated arrays. Picking happens through a
 * Mulberry32 PRNG seeded by `Date.now() + counter` so a Regenerate click
 * shifts the output deterministically within a single render.
 */

export type LoremFlavor = 'latin' | 'bacon' | 'hipster' | 'pirate' | 'cyberpunk' | 'japanese';
export type LoremUnit = 'paragraphs' | 'sentences' | 'words' | 'bytes';
export type SentenceLength = 'short' | 'medium' | 'long' | 'mixed';
export type OutputFormat = 'plain' | 'html' | 'markdown' | 'json' | 'typescript' | 'jsx';

export interface LoremOptions {
	readonly flavor: LoremFlavor;
	readonly unit: LoremUnit;
	readonly count: number;
	readonly sentenceLength: SentenceLength;
	readonly startWithClassic: boolean;
	readonly format: OutputFormat;
	readonly seed?: number;
}

export const FLAVORS: readonly LoremFlavor[] = [
	'latin',
	'bacon',
	'hipster',
	'pirate',
	'cyberpunk',
	'japanese',
];

export const UNITS: readonly LoremUnit[] = ['paragraphs', 'sentences', 'words', 'bytes'];

export const SENTENCE_LENGTHS: readonly SentenceLength[] = ['short', 'medium', 'long', 'mixed'];

export const OUTPUT_FORMATS: readonly OutputFormat[] = [
	'plain',
	'html',
	'markdown',
	'json',
	'typescript',
	'jsx',
];

export const FLAVOR_LABELS: Readonly<Record<LoremFlavor, string>> = {
	latin: 'Classic Lorem Ipsum',
	bacon: 'Bacon Ipsum',
	hipster: 'Hipster Ipsum',
	pirate: 'Pirate Ipsum',
	cyberpunk: 'Cyber-punk Ipsum',
	japanese: 'Japanese Lorem',
};

export const UNIT_LABELS: Readonly<Record<LoremUnit, string>> = {
	paragraphs: 'Paragraphs',
	sentences: 'Sentences',
	words: 'Words',
	bytes: 'Bytes',
};

export const SENTENCE_LENGTH_LABELS: Readonly<Record<SentenceLength, string>> = {
	short: 'Short',
	medium: 'Medium',
	long: 'Long',
	mixed: 'Mixed',
};

export const FORMAT_LABELS: Readonly<Record<OutputFormat, string>> = {
	plain: 'Plain text',
	html: 'HTML <p>',
	markdown: 'Markdown',
	json: 'JSON array',
	typescript: 'TypeScript const',
	jsx: 'JSX snippet',
};

export interface CountRange {
	readonly min: number;
	readonly max: number;
	readonly step: number;
	readonly defaultValue: number;
}

export const COUNT_RANGES: Readonly<Record<LoremUnit, CountRange>> = {
	paragraphs: { min: 1, max: 20, step: 1, defaultValue: 3 },
	sentences: { min: 1, max: 50, step: 1, defaultValue: 8 },
	words: { min: 1, max: 500, step: 1, defaultValue: 50 },
	bytes: { min: 50, max: 5000, step: 50, defaultValue: 500 },
};

export const DEFAULT_OPTIONS: LoremOptions = {
	flavor: 'latin',
	unit: 'paragraphs',
	count: COUNT_RANGES.paragraphs.defaultValue,
	sentenceLength: 'medium',
	startWithClassic: true,
	format: 'plain',
};

export const CLASSIC_OPENER = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';

export const isFlavor = (value: string): value is LoremFlavor =>
	FLAVORS.includes(value as LoremFlavor);
export const isUnit = (value: string): value is LoremUnit => UNITS.includes(value as LoremUnit);
export const isSentenceLength = (value: string): value is SentenceLength =>
	SENTENCE_LENGTHS.includes(value as SentenceLength);
export const isOutputFormat = (value: string): value is OutputFormat =>
	OUTPUT_FORMATS.includes(value as OutputFormat);

const LATIN_WORDS: readonly string[] = [
	'lorem',
	'ipsum',
	'dolor',
	'sit',
	'amet',
	'consectetur',
	'adipiscing',
	'elit',
	'sed',
	'do',
	'eiusmod',
	'tempor',
	'incididunt',
	'ut',
	'labore',
	'et',
	'dolore',
	'magna',
	'aliqua',
	'enim',
	'ad',
	'minim',
	'veniam',
	'quis',
	'nostrud',
	'exercitation',
	'ullamco',
	'laboris',
	'nisi',
	'aliquip',
	'ex',
	'ea',
	'commodo',
	'consequat',
	'duis',
	'aute',
	'irure',
	'in',
	'reprehenderit',
	'voluptate',
	'velit',
	'esse',
	'cillum',
	'eu',
	'fugiat',
	'nulla',
	'pariatur',
	'excepteur',
	'sint',
	'occaecat',
	'cupidatat',
	'non',
	'proident',
	'sunt',
	'culpa',
	'qui',
	'officia',
	'deserunt',
	'mollit',
	'anim',
	'id',
	'est',
	'laborum',
	'curabitur',
	'pretium',
	'tincidunt',
	'lacus',
	'nulla',
	'gravida',
	'orci',
	'a',
	'odio',
	'nullam',
	'varius',
	'turpis',
	'molestie',
	'auctor',
	'felis',
	'donec',
	'ornare',
	'phasellus',
	'iaculis',
	'sapien',
	'mauris',
	'fusce',
	'aliquet',
	'magna',
	'maecenas',
	'vehicula',
	'integer',
	'congue',
	'volutpat',
	'rhoncus',
	'dictum',
	'placerat',
	'augue',
	'pretium',
	'arcu',
	'cras',
	'libero',
	'morbi',
];

const BACON_WORDS: readonly string[] = [
	'bacon',
	'pork',
	'beef',
	'jerky',
	'sausage',
	'salami',
	'ham',
	'pancetta',
	'brisket',
	'ribeye',
	'flank',
	'sirloin',
	'chuck',
	'tenderloin',
	'short',
	'ribs',
	'kielbasa',
	'meatball',
	'meatloaf',
	'pastrami',
	'prosciutto',
	'capicola',
	'guanciale',
	'corned',
	'turducken',
	'venison',
	'turkey',
	'chicken',
	'duck',
	'rump',
	'shank',
	'shoulder',
	'belly',
	'loin',
	'cutlet',
	'fillet',
	'steak',
	'roast',
	'chop',
	'wing',
	'drumstick',
	'thigh',
	'breast',
	'leg',
	'hock',
	'tail',
	'tongue',
	'liver',
	'tripe',
	'biltong',
	'bresaola',
	'chorizo',
	'andouille',
	'mortadella',
	'pepperoni',
	'salsiccia',
	'frankfurter',
	'bologna',
	'liverwurst',
	'rasher',
	'spareribs',
	'kabob',
	'meatballs',
	'porchetta',
	'rump',
	'flintstone',
	'cow',
	'pig',
	'lamb',
	'goat',
	'fatback',
	'lardon',
	'cracklings',
	'rinds',
	'gammon',
	'savory',
	'smoked',
	'cured',
	'glazed',
	'grilled',
];

const HIPSTER_WORDS: readonly string[] = [
	'artisan',
	'craft',
	'organic',
	'small-batch',
	'farm-to-table',
	'reclaimed',
	'vinyl',
	'mason',
	'jar',
	'fixie',
	'bicycle',
	'beard',
	'flannel',
	'gluten-free',
	'pour-over',
	'cold-brew',
	'kombucha',
	'kale',
	'quinoa',
	'sriracha',
	'taxidermy',
	'mustache',
	'tattoo',
	'tofu',
	'tousled',
	'whatever',
	'wayfarers',
	'authentic',
	'banjo',
	'banh-mi',
	'before-they-sold-out',
	'biodiesel',
	'blog',
	'butcher',
	'cardigan',
	'chambray',
	'chia',
	'chicharrones',
	'chillwave',
	'church-key',
	'cliche',
	'cornhole',
	'cred',
	'deep-v',
	'denim',
	'direct-trade',
	'distillery',
	'diy',
	'drinking',
	'echo-park',
	'ennui',
	'ethical',
	'etsy',
	'fanny-pack',
	'fashion-axe',
	'flexitarian',
	'food-truck',
	'forage',
	'freegan',
	'gastropub',
	'gentrify',
	'hashtag',
	'heirloom',
	'helvetica',
	'humblebrag',
	'iphone',
	'irony',
	'jean-shorts',
	'keffiyeh',
	'keytar',
	'kickstarter',
	'kinfolk',
	'kitsch',
	'knausgaard',
	'leggings',
	'letterpress',
	'lo-fi',
	'locavore',
	'lomo',
	'lumbersexual',
	'master-cleanse',
	'meditation',
	'meggings',
	'meh',
	'messenger-bag',
	'microdosing',
	'mixtape',
	'mlkshk',
	'mumblecore',
];

const PIRATE_WORDS: readonly string[] = [
	'avast',
	'aye',
	'arrr',
	'matey',
	'doubloon',
	'plunder',
	'parley',
	'ahoy',
	'scallywag',
	'kraken',
	'gangplank',
	'galleon',
	'cutlass',
	'hornpipe',
	'jolly-roger',
	'landlubber',
	'maroon',
	'mizzen',
	'piracy',
	'poop-deck',
	'quartermaster',
	'rigging',
	'salty',
	'scurvy',
	'shanty',
	'shipmate',
	'spyglass',
	'swabbie',
	'tortuga',
	'treasure',
	'walk-the-plank',
	'wench',
	'yardarm',
	'yo-ho-ho',
	'bilge',
	'blackbeard',
	'bootstrap',
	'broadside',
	'brig',
	'buccaneer',
	'captain',
	'corsair',
	'crow-nest',
	'davy-jones',
	'flogging',
	'grog',
	'hearties',
	'helm',
	'keelhaul',
	'lass',
	'lateen',
	'lookout',
	'main-sail',
	'man-o-war',
	'marooner',
	'mast',
	'mutiny',
	'nautical',
	'old-salt',
	'parrot',
	'peg-leg',
	'pieces-of-eight',
	'port',
	'powder-monkey',
	'privateer',
	'rapscallion',
	'rope',
	'rum',
	'sailor',
	'sails',
	'sand-bar',
	'savvy',
	'sea-dog',
	'seafarer',
	'seven-seas',
	'shark-bait',
	'shiver-me-timbers',
	'shoal',
	'skull',
	'sloop',
	'splice',
	'starboard',
	'topsail',
	'voyage',
];

const CYBERPUNK_WORDS: readonly string[] = [
	'neon',
	'chrome',
	'wired',
	'jack',
	'data',
	'glitch',
	'matrix',
	'cyber',
	'augmented',
	'neural',
	'protocol',
	'corpo',
	'hacker',
	'samurai',
	'netrunner',
	'console',
	'cortex',
	'implant',
	'firewall',
	'darknet',
	'mainframe',
	'avatar',
	'biochip',
	'cloaked',
	'crypto',
	'decker',
	'encrypted',
	'enforcer',
	'exoskeleton',
	'firmware',
	'gridlock',
	'hologram',
	'icebreaker',
	'interface',
	'kernel',
	'megacorp',
	'mirrorshades',
	'nanotech',
	'override',
	'plug-in',
	'proxy',
	'quantum',
	'replicant',
	'reroute',
	'rogue',
	'satellite',
	'shadowrun',
	'signal',
	'simstim',
	'singularity',
	'skinjob',
	'spider',
	'spike',
	'streetwise',
	'subnet',
	'synth',
	'terminal',
	'transmit',
	'uplink',
	'virus',
	'voidwalker',
	'wetware',
	'zaibatsu',
	'arcade',
	'arcology',
	'backdoor',
	'badlands',
	'bionic',
	'blackmarket',
	'bleed',
	'borg',
	'breach',
	'broker',
	'burner',
	'cipher',
	'circuit',
	'corp-rat',
	'cracker',
	'cyberdeck',
	'cyberspace',
	'datastream',
	'deadnet',
];

const JAPANESE_WORDS: readonly string[] = [
	'春',
	'夏',
	'秋',
	'冬',
	'桜',
	'紅葉',
	'雪',
	'月',
	'星',
	'空',
	'海',
	'山',
	'川',
	'森',
	'猫',
	'犬',
	'鳥',
	'魚',
	'花',
	'木',
	'葉',
	'風',
	'雨',
	'雷',
	'太陽',
	'夜',
	'朝',
	'昼',
	'夕方',
	'時間',
	'夢',
	'光',
	'影',
	'音',
	'声',
	'歌',
	'物語',
	'本',
	'手紙',
	'言葉',
	'静か',
	'優しい',
	'美しい',
	'遠い',
	'近い',
	'高い',
	'深い',
	'広い',
	'小さい',
	'大きい',
	'白い',
	'青い',
	'赤い',
	'緑',
	'歩く',
	'走る',
	'眠る',
	'笑う',
	'泣く',
	'考える',
	'見る',
	'聞く',
	'触れる',
	'感じる',
	'流れる',
	'踊る',
	'光る',
	'消える',
	'生まれる',
	'道',
	'橋',
	'駅',
	'家',
	'庭',
	'公園',
	'街',
	'港',
	'灯台',
	'神社',
	'寺',
	'湖',
	'谷',
	'丘',
	'雲',
	'霧',
	'露',
	'霜',
	'氷',
	'波',
	'砂',
	'石',
	'岩',
	'土',
	'根',
	'枝',
	'種',
	'実',
	'香り',
	'味',
	'色',
];

const WORD_BANKS: Readonly<Record<LoremFlavor, readonly string[]>> = {
	latin: LATIN_WORDS,
	bacon: BACON_WORDS,
	hipster: HIPSTER_WORDS,
	pirate: PIRATE_WORDS,
	cyberpunk: CYBERPUNK_WORDS,
	japanese: JAPANESE_WORDS,
};

// Mulberry32 — a 32-bit pseudo-random generator with a simple, stable
// implementation. Used so a regenerate-counter seed produces a different
// but deterministic output across clicks.
const createRng = (seed: number): (() => number) => {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const SENTENCE_LENGTH_RANGES: Readonly<Record<Exclude<SentenceLength, 'mixed'>, [number, number]>> =
	{
		short: [4, 8],
		medium: [8, 15],
		long: [15, 30],
	};

const pickInt = (rng: () => number, min: number, max: number): number =>
	Math.floor(rng() * (max - min + 1)) + min;

const pickWord = (rng: () => number, bank: readonly string[]): string => {
	const first = bank[0] ?? '';
	return bank[Math.floor(rng() * bank.length)] ?? first;
};

const pickSentenceWordCount = (rng: () => number, sentenceLength: SentenceLength): number => {
	if (sentenceLength === 'mixed') {
		const variants: readonly Exclude<SentenceLength, 'mixed'>[] = ['short', 'medium', 'long'];
		const variant = variants[pickInt(rng, 0, variants.length - 1)] ?? 'medium';
		const [min, max] = SENTENCE_LENGTH_RANGES[variant];
		return pickInt(rng, min, max);
	}
	const [min, max] = SENTENCE_LENGTH_RANGES[sentenceLength];
	return pickInt(rng, min, max);
};

const capitalize = (word: string): string => {
	if (word.length === 0) return word;
	return word.charAt(0).toUpperCase() + word.slice(1);
};

const joinSentenceLatin = (words: readonly string[]): string => {
	if (words.length === 0) return '';
	const [first, ...rest] = words;
	return `${capitalize(first ?? '')}${rest.length > 0 ? ` ${rest.join(' ')}` : ''}.`;
};

const joinSentenceJapanese = (words: readonly string[]): string => `${words.join('')}。`;

const buildSentence = (
	rng: () => number,
	flavor: LoremFlavor,
	sentenceLength: SentenceLength
): string => {
	const bank = WORD_BANKS[flavor];
	const wordCount = pickSentenceWordCount(rng, sentenceLength);
	const words = Array.from({ length: wordCount }, () => pickWord(rng, bank));
	return flavor === 'japanese' ? joinSentenceJapanese(words) : joinSentenceLatin(words);
};

const buildParagraph = (
	rng: () => number,
	flavor: LoremFlavor,
	sentenceLength: SentenceLength,
	sentenceCount: number
): string => {
	const sentences = Array.from({ length: sentenceCount }, () =>
		buildSentence(rng, flavor, sentenceLength)
	);
	return flavor === 'japanese' ? sentences.join('') : sentences.join(' ');
};

const applyClassicOpener = (
	paragraphs: readonly string[],
	flavor: LoremFlavor,
	startWithClassic: boolean
): readonly string[] => {
	if (!startWithClassic || flavor !== 'latin') return paragraphs;
	if (paragraphs.length === 0) return [CLASSIC_OPENER];
	const [first, ...rest] = paragraphs;
	const merged = first?.startsWith(CLASSIC_OPENER)
		? (first ?? '')
		: `${CLASSIC_OPENER} ${first ?? ''}`.trim();
	return [merged, ...rest];
};

const utf8ByteLength = (text: string): number => new TextEncoder().encode(text).length;

const sentenceJoiner = (flavor: LoremFlavor): string => (flavor === 'japanese' ? '' : ' ');

const truncateToWords = (text: string, flavor: LoremFlavor, targetWords: number): string => {
	if (flavor === 'japanese') {
		// Treat each character as a "word" for byte-rich CJK.
		const chars = Array.from(text.replaceAll('。', ''));
		const sliced = chars.slice(0, targetWords).join('');
		return `${sliced}。`;
	}
	const tokens = text.split(/\s+/).filter((t) => t.length > 0);
	const sliced = tokens.slice(0, targetWords);
	const joined = sliced.join(' ').replace(/[.,]+$/u, '');
	return `${joined}.`;
};

const truncateToBytes = (text: string, flavor: LoremFlavor, targetBytes: number): string => {
	const bytes = new TextEncoder().encode(text);
	if (bytes.length <= targetBytes) return text;
	// Decode the prefix as UTF-8, then back off so we end on a complete
	// code-point boundary and (for Latin) on a word boundary.
	const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, targetBytes));
	if (flavor === 'japanese') {
		const trimmed = decoded.endsWith('。') ? decoded : `${decoded}。`;
		return trimmed;
	}
	const lastSpace = decoded.lastIndexOf(' ');
	const trimmed = lastSpace > 0 ? decoded.slice(0, lastSpace) : decoded;
	return `${trimmed.replace(/[.,]+$/u, '')}.`;
};

/**
 * Generate raw paragraph strings for the supplied options. The classic
 * opener prefix and unit-based truncation are applied here so callers can
 * compute stats off the same paragraphs that drive the formatted output.
 */
export const generateParagraphs = (opts: LoremOptions): readonly string[] => {
	const seed = opts.seed ?? Date.now();
	const rng = createRng(seed);
	const { flavor, unit, count, sentenceLength, startWithClassic } = opts;

	if (unit === 'paragraphs') {
		const paragraphs = Array.from({ length: Math.max(1, count) }, () => {
			const sentenceCount = pickInt(rng, 3, 6);
			return buildParagraph(rng, flavor, sentenceLength, sentenceCount);
		});
		return applyClassicOpener(paragraphs, flavor, startWithClassic);
	}

	if (unit === 'sentences') {
		const sentences = Array.from({ length: Math.max(1, count) }, () =>
			buildSentence(rng, flavor, sentenceLength)
		);
		const joined = sentences.join(sentenceJoiner(flavor));
		return applyClassicOpener([joined], flavor, startWithClassic);
	}

	if (unit === 'words') {
		// Over-produce sentences, then trim to the exact word/character
		// budget so we always finish on a punctuation mark.
		const sentences: string[] = [];
		while (sentences.join(sentenceJoiner(flavor)).split(/\s+/).filter(Boolean).length < count) {
			sentences.push(buildSentence(rng, flavor, sentenceLength));
			if (sentences.length > 500) break;
		}
		const raw = sentences.join(sentenceJoiner(flavor));
		const truncated = truncateToWords(raw, flavor, count);
		return applyClassicOpener([truncated], flavor, startWithClassic);
	}

	// bytes
	const sentences: string[] = [];
	let bytes = 0;
	while (bytes < count) {
		const next = buildSentence(rng, flavor, sentenceLength);
		sentences.push(next);
		bytes = utf8ByteLength(sentences.join(sentenceJoiner(flavor)));
		if (sentences.length > 2000) break;
	}
	const raw = sentences.join(sentenceJoiner(flavor));
	const truncated = truncateToBytes(raw, flavor, count);
	return applyClassicOpener([truncated], flavor, startWithClassic);
};

const escapeHtml = (text: string): string =>
	text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');

const formatHtml = (paragraphs: readonly string[]): string =>
	paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n');

const formatMarkdown = (paragraphs: readonly string[]): string => paragraphs.join('\n\n');

const formatJson = (paragraphs: readonly string[]): string => JSON.stringify(paragraphs, null, 2);

const formatTypescript = (paragraphs: readonly string[]): string =>
	`const lorem = ${JSON.stringify(paragraphs.join('\n\n'))};`;

const formatJsx = (paragraphs: readonly string[]): string => {
	const body = paragraphs.map((p) => `\t<p>${escapeHtml(p)}</p>`).join('\n');
	return `<div>\n${body}\n</div>`;
};

const FORMATTERS: Readonly<Record<OutputFormat, (paragraphs: readonly string[]) => string>> = {
	plain: (paragraphs) => paragraphs.join('\n\n'),
	html: formatHtml,
	markdown: formatMarkdown,
	json: formatJson,
	typescript: formatTypescript,
	jsx: formatJsx,
};

/**
 * Generate placeholder text for the supplied options, fully formatted
 * according to `opts.format`. Sentence / paragraph structure is identical
 * across formats; only the wrapper differs.
 */
export const generateLorem = (opts: LoremOptions): string => {
	const paragraphs = generateParagraphs(opts);
	return FORMATTERS[opts.format](paragraphs);
};

export interface LoremStats {
	readonly chars: number;
	readonly bytes: number;
	readonly words: number;
	readonly sentences: number;
	readonly paragraphs: number;
}

const EMPTY_STATS: LoremStats = {
	chars: 0,
	bytes: 0,
	words: 0,
	sentences: 0,
	paragraphs: 0,
};

/**
 * Count characters / bytes / words / sentences / paragraphs in the given
 * text. Sentence detection accepts both Latin (`.!?`) and Japanese
 * (`。！？`) terminators; word counting splits on whitespace for Latin
 * scripts and counts non-whitespace code points for CJK.
 */
export const countStats = (text: string): LoremStats => {
	if (text.length === 0) return EMPTY_STATS;

	const chars = Array.from(text).length;
	const bytes = utf8ByteLength(text);
	const paragraphs = text.split(/\n{2,}/u).filter((p) => p.trim().length > 0).length;

	const sentenceMatches = text.match(/[^.!?。！？]+[.!?。！？]+/gu);
	const sentences = sentenceMatches?.length ?? (text.trim().length > 0 ? 1 : 0);

	const spaced = text.split(/\s+/u).filter((token) => token.length > 0);
	const hasCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);
	const words = hasCjk
		? Array.from(text).filter((c) => /\S/u.test(c) && !/[、。！？「」『』]/u.test(c)).length
		: spaced.length;

	return { chars, bytes, words, sentences, paragraphs: Math.max(paragraphs, 1) };
};
