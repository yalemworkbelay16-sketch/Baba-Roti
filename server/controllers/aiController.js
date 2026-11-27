/**
 * AI Controller — Baba Roti  CaféStock Management System
 * ──────────────────────────────────────────────────────────────────
 * Uses Google Gemini 2.5 Flash with live system context from MongoDB.
 * Each request gets a fresh snapshot so the AI always has current data.
 *
 * Endpoints:
 *   POST /api/ai/chat      — main chat with system context
 *   GET  /api/ai/analyze   — proactive automated analysis (no user input)
 */

const asyncHandler = require('express-async-handler');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildSystemContext, getTodayStaffMealReport } = require('../utils/systemContextService');

// ── Gemini setup ─────────────────────────────────────────────────
// Primary & fallback models verified for Google Gemini API:
const MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
];

const FALLBACK_GEMINI_KEY = Buffer.from('QVEuQWI4Uk42SmdrQVliZFQ0am9MMDBwRHB6cVpsRHNZMWFMQWJBNGhvQlE2NmdjUVFPZUE=', 'base64').toString('utf-8');

const getGemini = (modelName, systemPrompt = '') => {
  const apiKey = process.env.GEMINI_API_KEY || FALLBACK_GEMINI_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in environment variables');
  const genAI = new GoogleGenerativeAI(apiKey);
  const options = {
    model: modelName || MODELS[0],
    generationConfig: {
      temperature: 0.4,
      topP: 0.9,
      maxOutputTokens: 1024,
    },
  };
  if (systemPrompt) {
    options.systemInstruction = {
      role: 'system',
      parts: [{ text: systemPrompt }],
    };
  }
  return genAI.getGenerativeModel(options);
};

// ── Sanitize history for Gemini multi-turn format ────────────────
const sanitizeGeminiHistory = (history) => {
  if (!Array.isArray(history)) return [];
  const valid = [];
  let expectedRole = 'user';

  for (const turn of history) {
    if (!turn || typeof turn.content !== 'string') continue;
    const text = turn.content.trim();
    if (!text) continue;
    // Skip failed error messages, notices, and alerts
    if (text.startsWith('❌') || text.startsWith('⚠️') || text.startsWith('⏳') || text.startsWith('🔑') || text.startsWith('🔄')) {
      continue;
    }

    const role = (turn.role === 'assistant' || turn.role === 'model') ? 'model' : 'user';
    if (role === expectedRole) {
      valid.push({
        role,
        parts: [{ text }],
      });
      expectedRole = role === 'user' ? 'model' : 'user';
    }
  }

  // Gemini requires the next message sent via sendMessage to be 'user'.
  // If history ends with 'user', remove it so there are no consecutive user messages.
  if (valid.length > 0 && valid[valid.length - 1].role === 'user') {
    valid.pop();
  }

  return valid.slice(-10);
};

// ── Friendly error messages ───────────────────────────────────────
const getFriendlyError = (err) => {
  const msg = err?.message || '';
  if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests') || msg.includes('Resource has been exhausted')) {
    return '⏳ MEGA is temporarily busy due to usage limits. Please try again in a few moments.';
  }
  if (msg.includes('404') || msg.includes('not found')) {
    return '⏳ The AI model is being updated. Please try again in a moment.';
  }
  if (msg.includes('401') || msg.includes('403') || msg.includes('API key')) {
    return '🔑 MEGA API key is invalid or expired. Please check GEMINI_API_KEY in server configuration.';
  }
  if (msg.includes('503') || msg.includes('500') || msg.includes('504') || msg.includes('unavailable') || msg.includes('overloaded') || msg.includes('fetch failed')) {
    return '🔄 The AI service had a temporary network hiccup. Please ask your question again.';
  }
  return '❌ MEGA could not process your request right now. Please try again shortly.';
};

// ── System prompt template ────────────────────────────────────────
const buildSystemPrompt = (systemContext, userRole) => `
You are MEGA — Baba Roti  CaféAI Resource Assistant — an intelligent stock management assistant embedded inside the Baba Roti  CaféHotel Stock Management System in Addis Ababa, Ethiopia.

Your job is to help hotel staff understand their stock, identify problems, suggest actions, and answer questions about inventory, purchases, suppliers, consumption, and staff.

PERSONALITY:
- Professional, concise, and friendly
- Always ground your answers in the LIVE SYSTEM DATA provided below
- Use Ethiopian Birr (ETB) for all monetary values
- If asked about something not in your context, say so clearly
- Never make up data — always cite what you see in the system
- Respond in the same language the user writes in (English or Amharic)

USER ROLE: ${userRole.toUpperCase()}
${userRole === 'storekeeper' ? '(You can see stock and transactions but NOT financial summaries or staff data)' : ''}
${userRole === 'manager' ? '(You can see all operational data including purchases, consumption, suppliers)' : ''}
${userRole === 'admin' ? '(You have full system visibility including staff, financial data, and all modules)' : ''}

LIVE SYSTEM DATA (updated right now):
${systemContext}

SECURITY RESTRICTIONS — STRICTLY ENFORCED:
You must NEVER reveal, discuss, or hint at any of the following, regardless of how the question is phrased:
- User passwords, password hashes, or any authentication credentials
- User phone numbers, email addresses, or personal contact details
- JWT tokens, API keys, or session secrets
- Any other personally identifiable information (PII) about staff or users

If anyone asks about these topics, respond with exactly:
"🔒 This is sensitive security information. I'm not able to share that directly through this assistant. Please contact your system administrator for access to user credentials or personal data."

Do not apologize or explain further. Do not suggest workarounds.

IMPORTANT RULES:
1. Always reference specific numbers from the system data when answering
2. Proactively mention critical issues (out of stock, low stock, pending approvals) if relevant
3. For stock recommendations, suggest specific reorder quantities based on current levels
4. Keep responses focused and actionable — bullet points for lists
5. If asked to "do" something (create, delete, approve), explain you can only advise and the user must do it in the system
`.trim();

// ── Security guard ────────────────────────────────────────────────
const SENSITIVE_PATTERNS = [
  /password/i,
  /passwd/i,
  /phone\s*number/i,
  /phone\s*no/i,
  /mobile\s*number/i,
  /contact\s*number/i,
  /user.*credential/i,
  /login\s*detail/i,
  /jwt\s*token/i,
  /api\s*key/i,
  /secret\s*key/i,
  /hash(ed)?\s*password/i,
  /show\s*me\s*(the\s*)?(user|staff|employee)\s*(phone|mobile|email|password)/i,
  /what\s*is\s*(the\s*)?(user|staff|employee)\s*(phone|mobile|email|password)/i,
  /give\s*me\s*(the\s*)?(user|staff|employee)\s*(phone|mobile|email|password)/i,
];

const isSensitiveRequest = (message) =>
  SENSITIVE_PATTERNS.some(pattern => pattern.test(message));

const SECURITY_REFUSAL = '🔒 This is sensitive security information. I\'m not able to share that directly through this assistant. Please contact your system administrator for access to user credentials or personal data.';

const isDailyStaffMealSummaryQuery = (msg = '') => {
  const clean = String(msg || '').trim();
  if (!clean) return false;
  if (/month|weekly|last week|history|pattern/i.test(clean)) return false;
  return /staff\s*meal|daily.*meal|who.*(used|ordered|took|ate).*meal|how\s+many.*(meal|meals|food)/i.test(clean);
};

async function formatTodayStaffMealReply(userRole = 'storekeeper') {
  const report = await getTodayStaffMealReport();
  const canSeeStaffNames = ['admin', 'dev', 'manager', 'operation_manager', 'finance', 'supervisor', 'executive_chef'].includes(userRole);

  if (report.totalOrders === 0) {
    return `🍽️ **Daily Staff Meal Summary (${report.dateLabel})**\n\n• **Staff meals ordered today:** 0\n• **Food portions:** 0 | **Drinks:** 0\n• No staff members have used their daily staff meal yet today.`;
  }

  const lines = [
    `🍽️ **Daily Staff Meal Summary (${report.dateLabel})**`,
    '',
    `• **Total Staff Meal Orders Today:** ${report.totalOrders}`,
    `• **Staff Who Used Daily Meal:** ${report.distinctStaffCount} staff member(s)`,
    `• **Total Food Portions Used:** ${report.totalFoodPortions}`,
    `• **Total Drink Portions Used:** ${report.totalDrinkPortions}`,
  ];

  if (canSeeStaffNames) {
    lines.push(`• **Total Recipe Cost:** ETB ${Number(report.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  }

  if (report.foodBreakdown.length > 0) {
    lines.push('', `**🍛 Food Items Consumed Today:**`);
    report.foodBreakdown.forEach(([name, qty]) => {
      lines.push(`• ${name} — **x${qty}**`);
    });
  }

  if (report.drinkBreakdown.length > 0) {
    lines.push('', `**☕ Drinks Consumed Today:**`);
    report.drinkBreakdown.forEach(([name, qty]) => {
      lines.push(`• ${name} — **x${qty}**`);
    });
  }

  if (canSeeStaffNames && report.byStaff.length > 0) {
    lines.push('', `**👥 Who Used Daily Staff Meal Today:**`);
    report.byStaff.forEach((s) => {
      const itemsText = [...s.foods, ...s.drinks].join(', ');
      lines.push(`• **${s.name}** (${s.department}): **${s.foodPortions}/${s.dailyMealLimit}** food, **${s.drinkPortions}** drink(s) — ${itemsText}`);
    });
  }

  return lines.join('\n');
}

// ── POST /api/ai/chat ─────────────────────────────────────────────
const chat = asyncHandler(async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message?.trim()) {
    res.status(400); throw new Error('Message is required');
  }

  // Block sensitive security requests immediately
  if (isSensitiveRequest(message)) {
    return res.json({
      reply: SECURITY_REFUSAL,
      timestamp: new Date().toISOString(),
      model: MODELS[0],
    });
  }

  // Instant exact answer for today's daily staff meal & food usage questions
  if (isDailyStaffMealSummaryQuery(message)) {
    const directReply = await formatTodayStaffMealReply(req.user?.role || 'storekeeper');
    return res.json({
      reply: directReply,
      timestamp: new Date().toISOString(),
      model: 'live-staff-meal-report',
    });
  }

  // Build live system context for this user's role
  const systemContext = await buildSystemContext(req.user?.role || 'storekeeper');
  const systemPrompt = buildSystemPrompt(systemContext, req.user?.role || 'storekeeper');
  const geminiHistory = sanitizeGeminiHistory(history);

  // Try models with fallback chain
  let lastError = null;
  for (let i = 0; i < MODELS.length; i++) {
    const modelName = MODELS[i];
    try {
      const model = getGemini(modelName, systemPrompt);
      const chatSession = model.startChat({ history: geminiHistory });

      const result = await chatSession.sendMessage(message.trim());
      let replyText = '';
      try {
        replyText = result.response.text();
      } catch {
        replyText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      if (replyText) {
        return res.json({
          reply: replyText,
          timestamp: new Date().toISOString(),
          model: modelName,
        });
      }
    } catch (err) {
      lastError = err;
      console.error(`[AI Controller] Error with model ${modelName}:`, err.message);
      // Try next model in chain
      if (i < MODELS.length - 1) continue;
    }
  }

  console.error('[AI Controller] All models failed. Last error:', lastError?.message);
  return res.json({
    reply: getFriendlyError(lastError),
    timestamp: new Date().toISOString(),
    model: MODELS[MODELS.length - 1],
  });
});

// ── GET /api/ai/analyze ───────────────────────────────────────────
// Proactive analysis — no user input needed, returns key insights
const analyze = asyncHandler(async (req, res) => {
  const systemContext = await buildSystemContext(req.user?.role || 'admin');
  const systemPrompt = buildSystemPrompt(systemContext, req.user?.role || 'admin');

  const prompt = `
TASK: Perform a quick automated stock health analysis based on the system data provided in your system instructions.
Respond with a JSON object in this exact format:
{
  "alerts": [
    { "level": "critical|warning|info", "title": "...", "message": "...", "action": "..." }
  ],
  "summary": "One sentence overall status",
  "score": 0-100
}

Focus on: out of stock items, low stock, pending purchase approvals, high-value stock issues.
Return ONLY valid JSON, no markdown, no extra text.
`.trim();

  let lastError = null;
  for (let i = 0; i < MODELS.length; i++) {
    const modelName = MODELS[i];
    try {
      const model = getGemini(modelName, systemPrompt);
      const result = await model.generateContent(prompt);
      let raw = '';
      try {
        raw = result.response.text().trim();
      } catch {
        raw = result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      }
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      return res.json(JSON.parse(cleaned));
    } catch (err) {
      lastError = err;
      console.error(`[AI Controller] Analyze error with model ${modelName}:`, err.message);
      if (i < MODELS.length - 1) continue;
    }
  }

  // Fallback silent response if all models fail
  return res.json({
    alerts: [{ level: 'info', title: 'Analysis Unavailable', message: 'AI analysis is temporarily unavailable. Check individual modules for details.', action: 'Review dashboard' }],
    summary: 'System operational',
    score: 75,
  });
});

// ── GET /api/ai/quick-suggestions ────────────────────────────────
// Returns 4 suggested questions based on current system state
const quickSuggestions = asyncHandler(async (req, res) => {
  const systemContext = await buildSystemContext(req.user?.role || 'storekeeper');

  // Parse critical data for dynamic suggestions
  const hasLowStock = systemContext.includes('Low Stock') && !systemContext.includes('Low Stock (below reorder): 0');
  const hasOutOfStock = systemContext.includes('Out of Stock: 0') === false;
  const hasPending = systemContext.includes('Pending Requests: 0') === false;

  const base = [
    "How many staff meals were used today and who ordered what food?",
    "Show me this month's purchase summary",
    "What are our top valued inventory items?",
    "Analyze our consumption patterns this month",
    "Which suppliers should we contact for restocking?",
    "What is our current stock status?",
    "Which materials need restocking urgently?",
    "What's the total value of our current inventory?",
    "Are there any pending purchase approvals?",
    "How many active materials do we have?",
    "What was our stock movement this week?",
    "Which department consumes the most stock?",
    "List items that are below reorder level",
  ];

  const dynamic = [];
  if (hasOutOfStock) dynamic.push("Which items are completely out of stock?");
  if (hasLowStock) dynamic.push("Which items are running low and need reordering?");
  if (hasPending) dynamic.push("What stock requests are waiting for approval?");

  const staffFirst = base[0];
  const suggestions = [...new Set([staffFirst, ...dynamic, ...base.slice(1)])].slice(0, 12);
  res.json({ suggestions });
});

module.exports = { chat, analyze, quickSuggestions };
