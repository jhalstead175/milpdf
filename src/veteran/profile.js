const PROFILE_VERSION = 1;

export const EMPTY_PROFILE = {
  _version: PROFILE_VERSION,
  member: {
    firstName: '',
    lastName: '',
    middleName: '',
    fullName: '',
    ssn: '',
    dob: '',
    dodId: '',
    rank: '',
    payGrade: '',
    branch: '',
    unit: '',
    mos: '',
    email: '',
    phone: '',
  },
  service: {
    entryDate: '',
    separationDate: '',
    characterOfService: '',
    separationCode: '',
    reentryCode: '',
    totalActiveService: '',
    awards: '',
    primaryMos: '',
    secondaryMos: '',
  },
  contact: {
    address: '',
    city: '',
    state: '',
    zip: '',
  },
};

const STORAGE_KEY = 'milpdf_profile';

export function normalizeProfile(profile) {
  const next = JSON.parse(JSON.stringify(profile || EMPTY_PROFILE));
  const member = next.member || {};
  const full = `${member.lastName || ''}, ${member.firstName || ''} ${member.middleName || ''}`.replace(/\s+/g, ' ').trim();
  next.member = {
    ...EMPTY_PROFILE.member,
    ...member,
    fullName: full === ',' ? '' : full,
  };
  next.service = { ...EMPTY_PROFILE.service, ...(next.service || {}) };
  next.contact = { ...EMPTY_PROFILE.contact, ...(next.contact || {}) };
  next._version = PROFILE_VERSION;
  return next;
}

export function loadProfile() {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.loadProfile) {
      const raw = window.electronAPI.loadProfile();
      if (!raw) return normalizeProfile(EMPTY_PROFILE);
      return normalizeProfile(JSON.parse(raw));
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeProfile(EMPTY_PROFILE);
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return normalizeProfile(EMPTY_PROFILE);
  }
}

export function saveProfile(profile) {
  const normalized = normalizeProfile(profile);
  const json = JSON.stringify(normalized);
  if (typeof window !== 'undefined' && window.electronAPI?.saveProfile) {
    window.electronAPI.saveProfile(json);
  } else {
    localStorage.setItem(STORAGE_KEY, json);
  }
  return normalized;
}
