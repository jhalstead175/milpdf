export function draftMotion(context, motionType = 'summary_judgment') {
  const title = motionType === 'summary_judgment'
    ? 'Motion for Summary Judgment'
    : 'Motion';

  const evidence = (context.evidenceIndex?.markers || []).slice(0, 5);
  const exhibits = evidence.map(m => `${m.exhibitId || 'Exhibit'}: ${m.label}`).join('\n');

  return [
    `${title}`,
    '',
    'I. Introduction',
    'This motion is supported by the evidence summarized below.',
    '',
    'II. Statement of Facts',
    exhibits || 'Evidence markers were not yet added to the case.',
    '',
    'III. Argument',
    'Based on the evidence, the moving party respectfully requests relief.',
    '',
    'IV. Conclusion',
    'For the foregoing reasons, the Court should grant this motion.',
  ].join('\n');
}
