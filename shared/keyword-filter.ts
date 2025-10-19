/**
 * Keyword Filtering System
 * 
 * This module detects and blocks harmful content including:
 * - Racial slurs
 * - Homophobic/transphobic slurs  
 * - Explicit sexual content
 * - Hate speech
 * 
 * Features:
 * - Case-insensitive matching
 * - Word boundary detection (blocks "ass" but not "class")
 * - Evasion detection (l33t speak, character substitution, spacing)
 */

export interface KeywordFilterResult {
  blocked: boolean;
  reason?: string;
  matchedWord?: string;
  category?: 'racial_slur' | 'homophobic_slur' | 'sexual_content' | 'hate_speech' | 'profanity';
}

/**
 * Filtered keywords organized by category
 * Using ROT13 encoding to avoid having explicit offensive terms in source code
 * while still being effective and auditable
 */
const FILTERED_KEYWORDS = {
  // Racial slurs (most egregious terms)
  racial_slurs: [
    'avttre', // n-word (primary)
    'avttn', // variant
    'puvax', // c-word (racial)
    'fcvp', // s-word (racial)
    'xvxr', // k-word (antisemitic)
    'wbba', // c-word variant
    'tbbx', // g-word (Asian slur)
  ],
  
  // Homophobic/transphobic slurs
  homophobic_slurs: [
    'snttbg', // f-word (homophobic)
    'qvxr', // d-word (homophobic)
    'genaal', // t-word (transphobic)
    'fubzb', // variant
  ],
  
  // Sexual/explicit content
  sexual_content: [
    'phag', // c-word (sexual)
    'jurer', // w-word
    'fyhg', // s-word
    'qvpx', // d-word (explicit)
    'pbpx', // c-word (explicit)
    'chffl', // p-word (explicit)
    'fuvg', // s-word (profanity)
    'ovgpu', // b-word (profanity)
    'onfgneq', // b-word (profanity)
    'qnza', // d-word (profanity)
  ],
  
  // Sexual propositions - context-based blocking
  sexual_propositions: [
    'jnaan shpx', // wanna f***
    'yrgf shpx', // let's f***
    'shpx zr', // f*** me
    'shpx lbh', // f*** you (in sexual context)
    'gb shpx', // to f***
    'shpx ure', // f*** her
    'shpx uvz', // f*** him
  ],
  
  // Hate speech terms
  hate_speech: [
    'xvyy lbhefrys', // suicide encouragement
    'xvf', // abbreviated version
    'ergneq', // r-word (ableist)
    'encr', // r-word (sexual violence)
  ]
};

/**
 * ROT13 decode function
 */
function rot13(str: string): string {
  return str.replace(/[a-zA-Z]/g, (char) => {
    const code = char.charCodeAt(0);
    const base = code >= 97 ? 97 : 65;
    return String.fromCharCode(((code - base + 13) % 26) + base);
  });
}

/**
 * Normalize text to detect common evasion techniques:
 * - Character substitutions (@ -> a, 3 -> e, 1 -> i, 0 -> o, $ -> s)
 * - Remove spaces between letters (f u c k -> fuck)
 * - Remove repeated characters (fuuuuck -> fuck)
 * - Remove special characters
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    // Character substitutions (l33t speak)
    .replace(/@/g, 'a')
    .replace(/4/g, 'a')
    .replace(/3/g, 'e')
    .replace(/1/g, 'i')
    .replace(/!/g, 'i')
    .replace(/0/g, 'o')
    .replace(/\$/g, 's')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    // Remove spaces between single letters (f u c k -> fuck)
    .replace(/\b(\w)\s+(\w)\s+(\w)\s+(\w)\b/g, '$1$2$3$4')
    .replace(/\b(\w)\s+(\w)\s+(\w)\b/g, '$1$2$3')
    .replace(/\b(\w)\s+(\w)\b/g, '$1$2')
    // Remove special characters and extra spaces
    .replace(/[^a-z0-9\s]/g, '')
    // Collapse repeated characters (fuuuuck -> fuck, but keep double letters like "cool")
    .replace(/(.)\1{2,}/g, '$1');
}

/**
 * Build a regex pattern for a keyword that:
 * - Matches whole words only (word boundaries)
 * - Allows for optional repeated characters
 * - Case insensitive
 */
function buildPattern(keyword: string): RegExp {
  // Escape special regex characters
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Allow optional repeated characters: each letter can be repeated 1-3 times
  const withRepetition = escaped.split('').map(char => {
    if (/[a-z]/i.test(char)) {
      return `${char}+`;
    }
    return char;
  }).join('');
  
  // Word boundary pattern - match as whole word
  return new RegExp(`\\b${withRepetition}\\b`, 'i');
}

/**
 * Check if text contains filtered keywords
 */
export function containsFilteredKeyword(text: string): KeywordFilterResult {
  if (!text || text.trim().length === 0) {
    return { blocked: false };
  }

  const normalizedText = normalizeText(text);
  const lowerText = text.toLowerCase();
  
  // Check each category
  for (const [categoryKey, encodedWords] of Object.entries(FILTERED_KEYWORDS)) {
    for (const encodedWord of encodedWords) {
      const keyword = rot13(encodedWord);
      
      // For sexual propositions, check as phrase patterns (no word boundaries)
      if (categoryKey === 'sexual_propositions') {
        // Create a simpler pattern for multi-word phrases
        const phrasePattern = new RegExp(keyword.split(' ').join('\\s+'), 'i');
        
        if (phrasePattern.test(normalizedText) || phrasePattern.test(lowerText)) {
          return {
            blocked: true,
            reason: 'Message contains prohibited content',
            matchedWord: keyword.substring(0, 3) + '***', // Partially censored for logging
            category: 'sexual_content'
          };
        }
      } else {
        // For single words, use word boundary pattern
        const pattern = buildPattern(keyword);
        
        // Check both normalized and original text
        if (pattern.test(normalizedText) || pattern.test(lowerText)) {
          const category = categoryKey.replace('_slurs', '_slur').replace('_content', '_content').replace('_speech', '_speech') as KeywordFilterResult['category'];
          
          return {
            blocked: true,
            reason: 'Message contains prohibited content',
            matchedWord: keyword.substring(0, 2) + '***', // Partially censored for logging
            category
          };
        }
      }
    }
  }

  return { blocked: false };
}

/**
 * Get a user-friendly error message based on the filter result
 */
export function getFilteredContentMessage(result: KeywordFilterResult): string {
  if (!result.blocked) {
    return '';
  }

  switch (result.category) {
    case 'racial_slur':
      return 'Message contains racial slurs. Please be respectful to all community members.';
    case 'homophobic_slur':
      return 'Message contains homophobic or transphobic language. Please be respectful to all community members.';
    case 'sexual_content':
      return 'Message contains explicit sexual content. Please keep conversations appropriate.';
    case 'hate_speech':
      return 'Message contains hate speech. Please be kind and respectful.';
    case 'profanity':
      return 'Message contains prohibited language. Please keep it clean.';
    default:
      return 'Message contains prohibited content. Please review community guidelines.';
  }
}
