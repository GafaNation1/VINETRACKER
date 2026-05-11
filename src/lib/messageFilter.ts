// Filter phone numbers and external links from chat messages.
// Use fresh regexes per call (no `g` flag state) to avoid lastIndex bugs.

const PHONE_RE = () => /(\+?\d[\d\s\-().]{7,}\d)/;
const URL_RE = () => /(https?:\/\/\S+|www\.\S+|\b[\w-]+\.(?:com|net|org|io|co|app|dev|me|xyz|gg|tv|info|biz|us|uk)\b\S*)/i;

export function containsSpam(text: string): boolean {
  return PHONE_RE().test(text) || URL_RE().test(text);
}

export function getSpamReason(text: string): string | null {
  if (PHONE_RE().test(text)) return "Phone numbers are not allowed in messages";
  if (URL_RE().test(text)) return "External links are not allowed in messages";
  return null;
}
