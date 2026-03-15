import {
  buildTimeline,
  detectContradictionsInCase,
  summarizeCaseDocuments,
  generateDepositionQuestions,
  draftCaseMotion,
} from './reasoningEngine';
import { avaSystemPrompt } from '../../ai/prompts/avaSystemPrompt';

function buildContextSummary(context) {
  const docPages = context?.documentIndex?.pages?.length || context?.documentIndex?.pageCount || 0;
  const entityCount = context?.documentIndex?.entities?.length || 0;
  const evidenceMarkers = context?.evidenceIndex?.markers?.length || 0;
  const exhibits = context?.evidenceIndex?.exhibits?.length || 0;
  const graphNodes = context?.caseGraph?.nodes?.length || 0;
  const graphEdges = context?.caseGraph?.edges?.length || 0;

  return [
    `Document pages: ${docPages}`,
    `Entities detected: ${entityCount}`,
    `Evidence markers: ${evidenceMarkers}`,
    `Exhibits: ${exhibits}`,
    `Case graph nodes: ${graphNodes}`,
    `Case graph edges: ${graphEdges}`,
  ].join('\n');
}

async function askAvaRemote(question, context) {
  const summary = buildContextSummary(context);
  const response = await fetch('/api/ava', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: avaSystemPrompt },
        { role: 'system', content: `Case context summary:\n${summary}` },
        { role: 'user', content: question },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Ava request failed');
  }

  const data = await response.json();
  return {
    answer: data.content || 'No response.',
    data: { summary },
  };
}

export async function askAva(question, context) {
  try {
    if (typeof fetch === 'function') {
      return await askAvaRemote(question, context);
    }
  } catch (err) {
    console.warn('Ava remote failed, falling back to local reasoning.', err);
  }

  const lower = question.toLowerCase();
  if (/^\s*(hi|hello|hey|howdy|greetings|good\s+(morning|afternoon|evening))\b/.test(lower)) {
    return {
      answer: "Hi! I'm Ava, your document assistant. I can help you:\n• Build a timeline of key dates\n• Detect potential contradictions\n• Generate deposition questions\n• Draft a motion\n\nJust ask me anything about your document.",
      data: {},
    };
  }
  if (lower.includes('timeline')) {
    const result = buildTimeline(context);
    return {
      answer: result.timeline.map(item => `${item.date} (p${item.page})`).join('\n') || 'No dates detected.',
      data: result,
    };
  }
  if (lower.includes('contradiction')) {
    const result = detectContradictionsInCase(context);
    const summary = result.contradictions.length
      ? `${result.contradictions.length} potential issues found.`
      : 'No contradictions detected.';
    return { answer: summary, data: result };
  }
  if (lower.includes('deposition') || lower.includes('question')) {
    const result = generateDepositionQuestions(context);
    return { answer: result.questions.join('\n'), data: result };
  }
  if (lower.includes('motion')) {
    const result = draftCaseMotion(context, 'summary_judgment');
    return { answer: result.motion, data: result };
  }
  const result = summarizeCaseDocuments(context);
  return { answer: result.summary.join('\n') || 'No document text available.', data: result };
}
