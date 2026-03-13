export const FORM_PROFILES = {
  DD214: {
    name: 'DD Form 214',
    fields: {
      'Last, First, Middle Name': { label: 'Name', autofillKey: 'member.fullName' },
      'SSN': { label: 'SSN', autofillKey: 'member.ssn', sensitive: true },
      'Branch': { label: 'Branch', autofillKey: 'member.branch' },
      'Pay Grade': { label: 'Pay Grade', autofillKey: 'member.payGrade' },
      'Date Entered AD YYYYMMDD': { label: 'Entry Date', autofillKey: 'service.entryDate' },
      'Separation Date YYYYMMDD': { label: 'Separation Date', autofillKey: 'service.separationDate' },
    },
  },
  DA31: {
    name: 'DA Form 31',
    fields: {
      'Soldier_Name': { label: 'Name', autofillKey: 'member.fullName' },
      'Unit_Address': { label: 'Unit', autofillKey: 'member.unit' },
      'Leave_Start_Date': { label: 'Leave Start', autofillKey: null },
      'Leave_End_Date': { label: 'Leave End', autofillKey: null },
    },
  },
};

export function detectFormProfile(fieldNames) {
  const names = fieldNames || [];
  for (const [key, profile] of Object.entries(FORM_PROFILES)) {
    const profileKeys = Object.keys(profile.fields);
    const matchCount = names.filter(f => profileKeys.includes(f)).length;
    const matchRate = matchCount / profileKeys.length;
    if (matchRate > 0.6) return key;
  }
  return null;
}

export function getNestedValue(obj, path) {
  if (!path) return null;
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : null), obj);
}

export function autofillScene(objects, profile, formProfile) {
  if (!formProfile) return objects;
  return objects.map(obj => {
    if (obj.type !== 'formField') return obj;
    const fieldDef = formProfile.fields[obj.fieldName];
    if (!fieldDef?.autofillKey) return obj;
    const value = getNestedValue(profile, fieldDef.autofillKey);
    return value ? { ...obj, fieldValue: String(value) } : obj;
  });
}
