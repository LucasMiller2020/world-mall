// Simple client-side content filtering
// Note: This is supplementary to server-side filtering and should not be relied upon for security

const BAD_WORDS = [
  // Spam/scam related
  'spam', 'scam', 'click here', 'buy now', 'free money', 'get rich quick',
  'limited time offer', 'act now', 'guaranteed profit', 'easy money',
  
  // Crypto/trading spam
  'pump', 'dump', 'moon', 'lambo', 'hodl', 'diamond hands', 'to the moon',
  'crypto signal', 'trading bot', 'investment opportunity', 'roi guaranteed',
  
  // NSFW indicators (basic)
  'nsfw', 'adult content', 'xxx', 'porn', 'onlyfans',
  
  // Common scam patterns
  'dm me', 'check my bio', 'link in bio', 'telegram group', 'discord server',
  'investment advice', 'financial advice', 'not financial advice',
  
  // Promotional spam
  'promo code', 'discount code', 'referral link', 'affiliate link',
  'check out my', 'follow me', 'subscribe to',
];

const SUSPICIOUS_PATTERNS = [
  /\b(bitcoin|btc|ethereum|eth|crypto)\s+(profit|investment|trading)\b/i,
  /\b(guaranteed|easy|quick)\s+(money|profit|returns)\b/i,
  /\b(dm|message)\s+me\s+(for|about)\b/i,
  /\b(join|check)\s+(my|our)\s+(telegram|discord|group)\b/i,
  /\b(click|visit)\s+(link|url)\s+(in|below)\b/i,
  /\$\d+\s*(profit|made|earned|return)/i,
  /\b\d+%\s*(return|profit|roi)\b/i,
];

const URL_WHITELIST = [
  'github.com',
  'gitlab.com', 
  'medium.com',
  'dev.to',
  'stackoverflow.com',
  'docs.worldcoin.org',
  'worldcoin.org',
  'ethereum.org',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'youtube.com',
  'youtu.be',
];

export interface ContentFilterResult {
  isValid: boolean;
  reason?: string;
  severity?: 'low' | 'medium' | 'high';
}

export function filterContent(text: string): ContentFilterResult {
  // Basic validation
  if (!text || text.trim().length === 0) {
    return {
      isValid: false,
      reason: 'Message cannot be empty',
      severity: 'low'
    };
  }

  if (text.length > 240) {
    return {
      isValid: false,
      reason: 'Message too long (240 character limit)',
      severity: 'medium'
    };
  }

  const lowerText = text.toLowerCase();

  // Check for banned words
  for (const word of BAD_WORDS) {
    if (lowerText.includes(word.toLowerCase())) {
      return {
        isValid: false,
        reason: 'Message contains restricted content',
        severity: 'high'
      };
    }
  }

  // Check for suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isValid: false,
        reason: 'Message matches a spam pattern',
        severity: 'high'
      };
    }
  }

  // URL validation
  const urlMatches = text.match(/https?:\/\/[^\s]+/gi);
  if (urlMatches) {
    for (const url of urlMatches) {
      if (!isUrlAllowed(url)) {
        return {
          isValid: false,
          reason: 'URL not allowed. Please use trusted domains only.',
          severity: 'medium'
        };
      }
    }
  }

  // Check for excessive repetition
  if (hasExcessiveRepetition(text)) {
    return {
      isValid: false,
      reason: 'Message contains excessive repetition',
      severity: 'medium'
    };
  }

  // Check for excessive caps
  if (hasExcessiveCaps(text)) {
    return {
      isValid: false,
      reason: 'Please avoid excessive use of capital letters',
      severity: 'low'
    };
  }

  return { isValid: true };
}

function isUrlAllowed(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    
    // Check if domain is in whitelist
    return URL_WHITELIST.some(allowed => {
      // Allow exact matches or subdomains
      return domain === allowed || domain.endsWith('.' + allowed);
    });
  } catch {
    return false;
  }
}

/**
 * Calculate Shannon entropy to detect low-diversity spam
 */
function calculateEntropy(text: string): number {
  if (!text || text.length === 0) return 0;
  
  const charCounts = new Map<string, number>();
  for (const char of text) {
    charCounts.set(char, (charCounts.get(char) || 0) + 1);
  }
  
  let entropy = 0;
  const textLength = text.length;
  
  for (const count of charCounts.values()) {
    const probability = count / textLength;
    entropy -= probability * Math.log2(probability);
  }
  
  return entropy;
}

/**
 * Check if text is an emoji or contains primarily emojis
 */
function isEmojiHeavy(text: string): boolean {
  // Regex to match emojis - covers most common emoji ranges
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{1F1E0}-\u{1F1FF}]/gu;
  const emojis = text.match(emojiRegex) || [];
  const emojiCount = emojis.length;
  
  // If more than 30% of the visible characters are emojis, consider it emoji-heavy
  const visibleChars = text.replace(/\s/g, '').length;
  return visibleChars > 0 && (emojiCount / visibleChars) > 0.3;
}

/**
 * Enhanced repetition check that reduces false positives
 */
function hasExcessiveRepetition(text: string): boolean {
  // Allow emoji runs - they're expressive, not spam
  if (isEmojiHeavy(text)) {
    console.log('[content-filter] Allowing emoji-heavy text');
    return false;
  }
  
  // Common natural expressions that should be allowed
  const naturalExpressions = /^(a+h+|h+m+|z+z+|y+e+s+|n+o+|w+o+w+|o+h+|u+h+|e+h+)/i;
  if (naturalExpressions.test(text.replace(/[^a-z]/gi, '').toLowerCase())) {
    console.log('[content-filter] Allowing natural expression');
    return false;
  }
  
  // Calculate text entropy
  const entropy = calculateEntropy(text.toLowerCase());
  
  // Check for single character repetition
  const singleCharRepeat = /(.)\1{5,}/.exec(text);
  if (singleCharRepeat) {
    // Found 6+ repeated characters
    const repeatedChar = singleCharRepeat[0];
    const charRatio = repeatedChar.length / text.length;
    
    // For short messages (< 12 chars), be more lenient
    if (text.length < 12) {
      // Only block if it's almost all the same character AND entropy is very low
      if (charRatio > 0.75 && entropy < 1.5) {
        console.log(`[content-filter] Blocked: low_entropy spam detected (entropy: ${entropy.toFixed(2)}, char_ratio: ${charRatio.toFixed(2)})`);
        return true;
      }
    } else {
      // For longer messages, use original thresholds
      if (charRatio > 0.5 && entropy < 2.0) {
        console.log(`[content-filter] Blocked: low_entropy spam detected (entropy: ${entropy.toFixed(2)}, char_ratio: ${charRatio.toFixed(2)})`);
        return true;
      }
    }
    
    // For very low entropy with long repetitions, always block
    if (entropy < 0.5 && singleCharRepeat[0].length > 10) {
      console.log(`[content-filter] Blocked: very_low_entropy spam (entropy: ${entropy.toFixed(2)})`);
      return true;
    }
  }
  
  // Allow natural elongations like "Howdyyyyy" or "Hellooooo"
  // These have reasonable entropy despite repetition
  if (entropy > 2.5) {
    // High entropy means diverse characters - likely natural language
    console.log(`[content-filter] Allowing text with good entropy: ${entropy.toFixed(2)}`);
    return false;
  }
  
  // Check for repeated words (less strict now)
  const words = text.toLowerCase().split(/\s+/);
  const wordCounts = new Map<string, number>();
  let totalWords = 0;
  
  for (const word of words) {
    if (word.length > 2) { // Only check words longer than 2 characters
      totalWords++;
      const count = wordCounts.get(word) || 0;
      wordCounts.set(word, count + 1);
      
      // Same word appears 5+ times and is majority of the message
      if (count >= 4 && (count + 1) / totalWords > 0.6) {
        console.log(`[content-filter] Blocked: excessive word repetition`);
        return true;
      }
    }
  }
  
  // Check for patterns like "ababababab"
  if (text.length >= 8) {
    const pattern2 = /(..)(..)?\1{3,}/; // Pattern repeats 4+ times
    const pattern3 = /(...)(...)?(...)??\1{2,}/; // Pattern repeats 3+ times
    
    if (pattern2.test(text) && entropy < 2.0) {
      console.log(`[content-filter] Blocked: repetitive pattern with low entropy`);
      return true;
    }
    
    if (pattern3.test(text) && entropy < 1.5) {
      console.log(`[content-filter] Blocked: repetitive pattern with very low entropy`);
      return true;
    }
  }
  
  console.log(`[content-filter] Allowing text (entropy: ${entropy.toFixed(2)})`);
  return false;
}

function hasExcessiveCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 5) return false; // Too short to judge
  
  const caps = text.replace(/[^A-Z]/g, '');
  const capsRatio = caps.length / letters.length;
  
  return capsRatio > 0.7; // More than 70% caps
}

// Utility function to sanitize text for display
export function sanitizeText(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .trim();
}

// Function to extract and validate URLs from text
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+/gi;
  const matches = text.match(urlRegex) || [];
  
  return matches.filter(url => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });
}

// Get user-friendly reason for content rejection
export function getFilterReason(text: string): string {
  const result = filterContent(text);
  
  if (result.isValid) {
    return '';
  }

  switch (result.severity) {
    case 'high':
      return 'This message was blocked for containing prohibited content. Please keep the conversation constructive and follow community guidelines.';
    case 'medium':
      return 'This message was filtered for safety reasons. Please revise and try again.';
    case 'low':
    default:
      return result.reason || 'Please revise your message and try again.';
  }
}
