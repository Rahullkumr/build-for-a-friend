// The prompt and JSON schema that turn a document photo into a plain-language explanation.
// Tuned over four test rounds on real letters; see the README for what each rule fixed.

export const LANGUAGES = {
  hi: 'simple Hindi written in Devanagari script (हिंदी लिपि), never in Roman letters',
  en: 'simple English',
};

export const schema = {
  type: 'object',
  properties: {
    document_type: { type: 'string' },
    summary: { type: 'string' },
    key_details: { type: 'array', items: { type: 'string' } },
    action_needed: { type: 'string' },
    deadline: { type: ['string', 'null'] },
    urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['document_type', 'summary', 'key_details', 'action_needed', 'deadline', 'urgency'],
};

export function buildPrompt(lang) {
  const language = LANGUAGES[lang];
  const hindiReminder = lang === 'hi' ? '\nसभी जवाब आसान हिंदी में, देवनागरी लिपि में लिखें।' : '';
  return `You help an elderly person in India understand a document they received.
Write EVERY field in ${language}, even if the document is in another language. Keep names, numbers, dates, phone numbers, emails and websites exactly as printed.
The photo may be any kind of document: bank notice, hospital or lab report, government letter, bill, insurance, pension, legal notice, announcement, etc.
Use short sentences and everyday words a person with little formal education understands.${hindiReminder}

Return JSON with these keys:
- document_type: what kind of document this is and who sent it.
- summary: 2-3 sentences on what it says and what happens if the person does nothing. If it is a general announcement, press note or advertisement not addressed to the person, say so.
- key_details: at most 6 of the most important facts, most important first (prefer what the person needs to act, like amounts, phone numbers and help offered, over codes like IFSC), copied exactly from the document: amounts, dates, reference numbers, phone numbers, help the sender offers (helpline, home visit). For medical reports, give each value exactly as printed and explain it in simple words.
- action_needed: what the person must do, step by step, writing out every step and every document to bring (never refer to "the items below" or other keys). If the document only applies to some people (for example by joining date, age or place), first say who it applies to. If nothing is needed, say so clearly.
- deadline: the last date to act, exactly as printed, or null if none. The date the document was written, printed or tested is not a deadline.
- urgency: high if money, a benefit, an account, health or legal trouble is at stake within about two weeks; medium if action is needed but not soon; low if it is only information.

Rules:
- Only use what is visible in the document. Never invent names, places, numbers, threats or penalties.
- If a word or number is unclear, say it is unclear instead of guessing. Do not join separate numbers together. Keep units such as lakh, crore, mg and mmHg exactly as printed.
- Put each piece of information only in its own key; never repeat the key names inside the text.
- For medical documents, do not diagnose and do not suggest changing medicines; tell the person to follow their doctor's advice.
Remember: write every field in ${language}.`;
}
