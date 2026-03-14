import { summarizeDocument } from './documentAnalyzer';
import { detectContradictions } from './contradictionDetector';
import { draftMotion } from './legalWriter';

export function buildTimeline(context) {
  const entries = [];
  const entities = context.documentIndex?.entities || [];
  const markers = context.evidenceIndex?.markers || [];

  for (const entity of entities) {
    if (entity.type !== 'date') continue;
    entries.push({
      date: entity.text,
      page: entity.page,
      source: 'document',
    });
  }

  for (const marker of markers) {
    if (!marker.timestamp) continue;
    entries.push({
      date: marker.timestamp,
      page: marker.page,
      source: 'evidence',
      label: marker.label,
    });
  }

  const sorted = entries.sort((a, b) => new Date(a.date) - new Date(b.date));
  return {
    timeline: sorted,
    sources: sorted.map(item => ({ page: item.page, label: item.label || item.date })),
  };
}

export function detectContradictionsInCase(context) {
  const contradictions = detectContradictions(context);
  return {
    contradictions,
    sources: contradictions.flatMap(c => (c.details || []).map(d => ({ page: d.page, amounts: d.amounts }))),
  };
}

export function summarizeCaseDocuments(context) {
  const summary = summarizeDocument(context.documentIndex, 4);
  return {
    summary: summary.summary,
    sources: summary.sources,
  };
}

export function generateDepositionQuestions(context) {
  const questions = [];
  const markers = context.evidenceIndex?.markers || [];
  for (const marker of markers.slice(0, 10)) {
    questions.push(`Please explain the events referenced in "${marker.label}" on page ${marker.page}.`);
  }
  if (questions.length === 0) {
    questions.push('Describe the key events relevant to this case.');
  }
  return {
    questions,
    sources: markers.map(m => ({ page: m.page, label: m.label })),
  };
}

export function draftCaseMotion(context, motionType) {
  const text = draftMotion(context, motionType);
  return {
    motion: text,
    sources: (context.evidenceIndex?.markers || []).map(m => ({ page: m.page, label: m.label })),
  };
}
