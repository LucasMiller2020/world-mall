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

function hasExcessiveRepetition(text: string): boolean {
  // Check for repeated characters (more than 3 consecutive)
  if (/(.)\1{3,}/.test(text)) {
    return true;
  }

  // Check for repeated words
  const words = text.toLowerCase().split(/\s+/);
  const wordCounts = new Map<string, number>();
  
  for (const word of words) {
    if (word.length > 2) { // Only check words longer than 2 characters
      const count = wordCounts.get(word) || 0;
      wordCounts.set(word, count + 1);
      
      if (count >= 3) { // Same word appears 4+ times
        return true;
      }
    }
  }

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
