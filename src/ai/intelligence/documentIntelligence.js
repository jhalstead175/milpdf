export function classifyDocument(text) {
  if (!text) return 'Unknown';
  if (text.includes('DD FORM 214')) return 'DD214';
  if (text.includes('VA FORM 21-526EZ')) return 'VA Claim Form';
  if (text.includes('Medical Record')) return 'Medical Record';
  return 'Unknown';
}
