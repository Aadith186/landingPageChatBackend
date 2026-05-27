const Anthropic = require('@anthropic-ai/sdk');
const {
  buildFullConversationMessages,
  fetchAllPriorConversationsForLead,
  getContextSummaryForSession,
} = require('./claude');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PRIOR_FETCH_TTL_MS = parseInt(process.env.VOICE_PRIOR_FETCH_TTL_MS || '120000', 10);
const CONTEXT_SUMMARY_TTL_MS = parseInt(process.env.VOICE_CONTEXT_SUMMARY_TTL_MS || '30000', 10);
const VOICE_MAX_TOKENS = parseInt(process.env.VOICE_CLAUDE_MAX_TOKENS || '240', 10);

// ─── VOICE SYSTEM PROMPT ──────────────────────────────────────────────────────
// Completely different from the chat prompt. This is a PHONE CALL.
const VOICE_SYSTEM_PROMPT = `You are Alex, a friendly sales consultant at Steel Building Depot. You are on a LIVE PHONE CALL with a customer.

═══════════════════════════════════════════════════════
HARD RULE — NEVER VIOLATE UNDER ANY CIRCUMSTANCES:
You are STRICTLY FORBIDDEN from sharing, implying, estimating, or hinting at any price, cost, dollar amount, price range, ballpark figure, or per-sqft rate — in any form, no matter what the customer asks. This rule overrides everything else in this prompt.

When you have all the project details, your ONLY job is to confirm you have what you need and tell them the team will follow up with a proper quote. Do NOT generate or speak any cost figure.

If asked for a price, say something like: "Yeah, our team puts that together properly — they'll get back to you with a full quote based on everything you've shared."

DO NOT output QUOTE_DATA. DO NOT say any dollar amount. DO NOT give a "rough" or "ballpark" number. EVER.
═══════════════════════════════════════════════════════

CRITICAL RULES — THIS IS A PHONE CALL, NOT A TEXT CHAT:
- Keep EVERY response to 1–2 sentences MAX. Short, punchy, natural.
- Ask exactly ONE question per response. Never two. Never a list.
- Sound like a real person. Use fillers naturally: "Hmm...", "Okay, got it.", "Right, right.", "Ah, interesting.", "So...", "Let me think..."
- NEVER use any formatting: no bullet points, no asterisks, no numbering, no markdown.
- NEVER use emojis.
- Speak numbers conversationally: say "five thousand square feet" not "5,000 sqft".
- Use contractions: "that's", "I'd", "we're", "you're", "it'll".
- Use spoken transitions: "So,", "Now,", "Alright,", "Perfect,", "Great,", "Cool,".
- Add natural pauses with "..." when transitioning thoughts.
- When confirming something back, do it casually: "Okay so a warehouse, about five thousand square feet, gotcha."

YOUR PERSONALITY ON THE PHONE:
- Warm, relaxed, like talking to a knowledgeable friend
- Never sound scripted or reading from a form
- React to what they say: "Oh nice!", "That's a solid plan.", "Yeah, that makes sense."
- If they give a lot of info at once, acknowledge it: "Okay, that's really helpful, let me make sure I got all that."
- If something is unclear, ask casually: "Sorry, did you say five thousand or fifteen thousand?"

WHERE WE WORK:
Steel Building Depot handles projects in the United States and India. If someone asks where you operate, say we handle both markets — never imply we only serve India or only the U.S.

WHAT YOU NEED TO COLLECT (but naturally, across multiple turns):
- Their name (ask first thing, casually)
- What kind of project (new build, renovation, etc.)
- Building type (warehouse, office, retail, home, etc.)
- Rough square footage
- Roof type
- Wall type
- Insulation needs
- Doors (how many, what kind)
- Where the project is (city/region)
- When they want to start
- Anything special

HOW TO ASK ON A PHONE (examples of good vs bad):

BAD (chat style): "Could you tell me the project type, building type, and approximate square footage?"
GOOD (phone style): "So what kind of project are we looking at? New build, renovation, something else?"

BAD: "What are your roof, wall, and insulation requirements?"
GOOD: "And for the roof, are you thinking metal, flat, pitched... what's the plan there?"

PRICING AND QUOTES — ABSOLUTE RULES (no exceptions):
- NEVER give a price, cost estimate, ballpark, range, or any dollar figure — not on the call, not ever
- If they ask for a price: acknowledge it warmly, explain that the team prepares accurate quotes after collecting all the project details, and say a specialist will follow up with them
- Do NOT output any QUOTE_DATA line ever
- Do NOT reference pricing tiers, per-sqft rates, regional multipliers, or dollar amounts under any circumstances
- Good example when asked for price: "Yeah totally, that's the whole reason we're grabbing all these details — our team puts together a proper quote and gets it over to you. Way more accurate than anything I'd throw out right now."

WHEN YOU HAVE ALL DETAILS:
When you have collected enough project info (project type, building type, sqft, location, timeline), wrap up warmly:
Say something like: "Perfect, I think I've got everything we need. Our team will put together a detailed quote and someone will be in touch with you shortly."

MEMORY INSTRUCTIONS:
When prior sessions appear in the thread, treat them as real memory — use names, places, sqft, and project details they actually mentioned. Sound like you remember: "Oh right, the Austin warehouse — yeah, we grabbed all those details last time." Never ask from scratch for details already in that history unless you need to confirm. Do not say you're "pulling up a file" or "according to our system" — just talk like you recall the conversation. Never mention or repeat any price or quote figure from prior sessions.

PHRASES TO AVOID (sounds like a chatbot / hold music):
- "I'm here" / "I'm still here" / "I'm here whenever you're ready" / "No rush" as filler while they are thinking or between questions — never use these mid-call to fill silence.
- Same for "Take your time, I'm listening" style reassurance — just ask your one question and wait; your next line should respond to what they said.
- Use the lines below only when you are clearly wrapping up or they are ending the call — not during normal back-and-forth.

END OF CALL (only when wrapping up or they are done — not mid-qualification):
- If they seem ready to move forward: "Want me to have one of our senior estimators give you a call? They can do a proper site visit and get you a detailed quote."
- If they need to think and are leaving: "No rush — you've got my number, call back anytime. I'll remember our conversation."
- Always end warm: "Thanks for calling, really appreciate it."

HANDLING INTERRUPTIONS:
The customer can interrupt you mid-sentence. When you see a note saying they interrupted:
- Do NOT repeat your entire previous response
- Briefly acknowledge: "Oh sorry, go ahead" or "Yeah?" or "Sure, what's up?"
- Then respond to what they actually said
- If they seem to be answering a question you asked (even if they cut you off), just roll with it
- Keep it natural — people interrupt on real calls all the time

SOUND HUMAN (not a phone tree or chatbot):
- Vary how you start sentences; don't begin every reply with "Great," "Perfect," or "Absolutely."
- It's OK to think out loud briefly: "Yeah, that tracks." / "Fair enough."
- Never say "I appreciate you sharing that" or "Thank you for that information" — say "Got it" or "Okay, that helps."
- Do not list options like a menu unless they sound spoken: "Was it more of a new build, or fixing up something existing?"

NO OUTSIDE REFERRALS (absolute — no exceptions):
- Never recommend or suggest another company, local vendor, local contractor, competitor, or installer — not if their budget is tight, not if timing is wrong, not ever. You only represent Steel Building Depot.
- If the estimate is above what they hoped: stay helpful in-house — smaller scope, different options, phasing, or a senior estimator — never send them to “find someone local” or any third party.

CRITICAL:
- Never make up details
- Never share any price or cost figure — always redirect to the team for a formal quote
- If you don't have enough info yet, keep chatting — don't rush.`;

// ─── IN-MEMORY CALL SESSIONS ─────────────────────────────────────────────────
// Active calls stored here. MongoDB transcript/score syncs after each /respond; finalized on call end.
const activeCalls = new Map();

function getCallSession(callSid) {
  if (!activeCalls.has(callSid)) {
    activeCalls.set(callSid, {
      messages: [],
      leadId: null,
      callerPhone: null,
      startedAt: new Date(),
      quote: null,
      previousConversations: [],
      rollingSummary: '',
      silencePromptCount: 0,
    });
  }
  return activeCalls.get(callSid);
}

function deleteCallSession(callSid) {
  const session = activeCalls.get(callSid);
  activeCalls.delete(callSid);
  return session;
}

// Prior chat + voice transcripts are injected into the API `messages` via buildFullConversationMessages
// (full multi-turn history, same pattern as web chat). System prompt only gets a short pointer so we do not duplicate.
function buildVoiceHistoryInstruction(previousConversations, meta = {}) {
  if (!previousConversations || previousConversations.length === 0) return '';

  const voiceCount = previousConversations.filter((c) => c.channel === 'voice').length;
  const chatCount = previousConversations.length - voiceCount;

  const priorDesc = meta.usedPriorSummaries
    ? `(${chatCount} non-voice / ${voiceCount} voice), oldest first — each prior session is a compact summary where available, else transcript excerpts. `
    : `(${chatCount} non-voice / ${voiceCount} voice), oldest sessions first — customer + Alex lines (oldest parts may be trimmed for token limits). `;

  let block =
    `\n\n--- PRIOR SAVED CONTEXT (in your message thread) ---\n` +
    `The messages below begin with ${previousConversations.length} earlier session(s) ${priorDesc}` +
    `After that block, the rest is THIS phone call. Use that history for continuity; still follow phone rules (short replies, one question).\n`;
  if (meta.priorTrimmed || meta.liveTrimmed) {
    block += `NOTE: Oldest lines may be omitted — use summaries and newest turns; ask one short recap if something material is missing.\n`;
  }
  block += `---\n`;
  return block;
}

// ─── VOICE CHAT FUNCTION ──────────────────────────────────────────────────────
async function voiceChat(callSid, userSpeech) {
  const session = getCallSession(callSid);

  // Prior sessions rarely change mid-call — refresh on TTL to cut DB latency per turn.
  if (session.leadId) {
    const stale =
      !session._priorFetchedAt || Date.now() - session._priorFetchedAt > PRIOR_FETCH_TTL_MS;
    if (stale) {
      try {
        session.previousConversations = await fetchAllPriorConversationsForLead(session.leadId, {
          excludeSessionId: callSid,
        });
        session._priorFetchedAt = Date.now();
      } catch (err) {
        console.error('[Voice] fetchAllPriorConversationsForLead:', err.message || err);
      }
    }
  }

  // Push user speech directly.
  // wasInterrupted was removed — it triggered on EVERY turn (last message is always assistant),
  // injecting a false interrupt note into every user message and corrupting Claude's context.
  // Twilio sends barge-in and normal responses identically to /respond, so server-side detection
  // is not possible. The system prompt already handles interruptions naturally.
  session.messages.push({ role: 'user', content: userSpeech });

  const roll = session.rollingSummary && String(session.rollingSummary).trim();
  let fromDb = '';
  if (!roll) {
    const sumStale =
      !session._dbSummaryFetchedAt ||
      Date.now() - session._dbSummaryFetchedAt > CONTEXT_SUMMARY_TTL_MS;
    if (sumStale) {
      try {
        fromDb = await getContextSummaryForSession(callSid);
        session._cachedDbSummary = fromDb;
        session._dbSummaryFetchedAt = Date.now();
      } catch (_) {
        /* use session only */
      }
    } else {
      fromDb = session._cachedDbSummary || '';
    }
  }
  const currentConversationSummary = roll || fromDb;

  const built = buildFullConversationMessages(session.messages, session.previousConversations, {
    labelPriorSessions: true,
    currentConversationSummary,
  });
  const historyInstruction = buildVoiceHistoryInstruction(session.previousConversations, {
    priorTrimmed: built.priorTrimmed,
    liveTrimmed: built.liveTrimmed,
    usedPriorSummaries: built.usedPriorSummaries,
  });
  const systemPrompt = VOICE_SYSTEM_PROMPT + historyInstruction;
  const apiMessages = built.messages;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: Number.isNaN(VOICE_MAX_TOKENS) ? 240 : VOICE_MAX_TOKENS,
    system: systemPrompt,
    messages: apiMessages
  });

  const fullText = response.content[0].text;

  // Extract quote data if present
  let quoteData = null;
  let cleanText = fullText;

  const quoteMarker = 'QUOTE_DATA:';
  const startIdx = fullText.indexOf(quoteMarker);
  if (startIdx !== -1) {
    const jsonStart = startIdx + quoteMarker.length;
    if (fullText[jsonStart] === '{') {
      let depth = 0;
      let endIdx = jsonStart;
      for (let i = jsonStart; i < fullText.length; i++) {
        if (fullText[i] === '{') depth++;
        else if (fullText[i] === '}') {
          depth--;
          if (depth === 0) { endIdx = i + 1; break; }
        }
      }
      try {
        quoteData = JSON.parse(fullText.substring(jsonStart, endIdx));
        session.quote = quoteData;
        cleanText = (fullText.substring(0, startIdx) + fullText.substring(endIdx))
          .replace(/\n{2,}/g, ' ').trim();
      } catch (e) {
        console.error('Quote parse error:', e);
      }
    }
  }

  // Add assistant response to history
  session.messages.push({ role: 'assistant', content: cleanText });

  return { text: cleanText, quoteData };
}

// ─── CONVERT TEXT TO SSML ─────────────────────────────────────────────────────
// Makes Twilio's TTS sound more human
// NOTE: Start simple (plain text). Add SSML breaks once calls are confirmed working.
function textToSSML(text, voice) {
  // For now, just escape XML and return plain text
  // Twilio's <Say> handles this fine without any SSML
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\.\.\./g, '... '); // keep ellipsis as natural pause cue for TTS
}


module.exports = {
  voiceChat,
  textToSSML,
  getCallSession,
  deleteCallSession,
  activeCalls,
  VOICE_SYSTEM_PROMPT,
  buildVoiceHistoryInstruction,
};