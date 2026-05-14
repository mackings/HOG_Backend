const CONTACT_PATTERNS = [
  {
    type: "email",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    type: "phone",
    pattern: /(?:\+?\d[\d\s().-]{7,}\d)/g,
  },
  {
    type: "link",
    pattern: /\b(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|io|co|app|me|ng|uk)\b)[^\s]*/gi,
  },
  {
    type: "obfuscated_link",
    pattern: /\b[a-z0-9._%+-]+\s*(?:dot|\.)\s*(?:com|net|org|io|co|app|me|ng|uk)\b/gi,
  },
  {
    type: "social_handle",
    pattern: /(?:^|\s)(?:@[\w.]{3,}|(?:ig|instagram|telegram|whatsapp|snapchat|tiktok|x|twitter)\s*[:@]?\s*[\w.]{3,})/gi,
  },
  {
    type: "address",
    pattern: /\b(?:no\.?|number|house|flat|suite|apt\.?|apartment)?\s*\d{1,5}\s+[a-z0-9.'-]+(?:\s+[a-z0-9.'-]+){0,5}\s+(?:street|st\.?|road|rd\.?|avenue|ave\.?|close|crescent|lane|drive|estate|junction|bus stop)\b/gi,
  },
];

const RESTRICTED_PROMPT =
  "For your safety and protection, please keep all communication within House of GLAME.";

const maskValue = (value) => "*".repeat(Math.min(Math.max(String(value).trim().length, 3), 24));

export const detectRestrictedContact = (content = "") => {
  const text = String(content || "");
  const matches = [];

  for (const { type, pattern } of CONTACT_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      matches.push({
        type,
        value: match[0].trim(),
        index: match.index,
      });
    }
  }

  return matches.sort((a, b) => a.index - b.index);
};

export const maskRestrictedContact = (content = "") => {
  let sanitizedContent = String(content || "");
  const detected = [];

  for (const { type, pattern } of CONTACT_PATTERNS) {
    pattern.lastIndex = 0;
    sanitizedContent = sanitizedContent.replace(pattern, (value) => {
      detected.push({ type, value: String(value).trim() });
      return maskValue(value);
    });
  }

  return {
    sanitizedContent,
    detected,
    isFlagged: detected.length > 0,
    prompt: detected.length > 0 ? RESTRICTED_PROMPT : null,
  };
};

export const blockRestrictedContact = (content = "") => {
  const detected = detectRestrictedContact(content);

  return {
    allowed: detected.length === 0,
    detected,
    prompt: detected.length > 0 ? RESTRICTED_PROMPT : null,
  };
};

export const validateMessageAttachments = (attachments = []) => {
  const safeAttachments = Array.isArray(attachments) ? attachments : [];
  const invalid = safeAttachments.filter((attachment) => {
    const kind = String(attachment?.type || "").toLowerCase();
    const mimeType = String(attachment?.mimeType || "").toLowerCase();
    return kind === "video" || mimeType.startsWith("video/");
  });

  if (invalid.length > 0) {
    return {
      valid: false,
      message: "Video sharing is not supported in platform messaging.",
    };
  }

  return { valid: true, attachments: safeAttachments };
};
