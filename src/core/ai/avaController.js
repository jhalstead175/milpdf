import {
  buildTimeline,
  detectContradictionsInCase,
  summarizeCaseDocuments,
  generateDepositionQuestions,
  draftCaseMotion,
} from './reasoningEngine';

export async function askAva(question, context) {
  const lower = question.toLowerCase();
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
