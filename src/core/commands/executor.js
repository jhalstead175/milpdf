export function executeCommandById(commands, id) {
  const cmd = commands.find(c => c.id === id);
  if (!cmd) return false;
  cmd.run();
  return true;
}

export function buildShortcutMap(commands) {
  const map = new Map();
  for (const cmd of commands) {
    if (!cmd.shortcut) continue;
    map.set(normalizeShortcut(cmd.shortcut), cmd.id);
  }
  return map;
}

export function normalizeShortcut(shortcut) {
  return shortcut
    .split('+')
    .map(part => part.trim().toLowerCase())
    .sort()
    .join('+');
}

export function eventToShortcut(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  const key = normalizeKey(e.key);
  if (!key) return null;
  parts.push(key);
  return parts.sort().join('+');
}

function normalizeKey(key) {
  if (!key) return null;
  const lower = key.toLowerCase();
  if (lower === ' ') return 'space';
  if (lower === 'esc') return 'escape';
  if (lower === 'arrowleft') return 'arrowleft';
  if (lower === 'arrowright') return 'arrowright';
  if (lower === 'arrowup') return 'arrowup';
  if (lower === 'arrowdown') return 'arrowdown';
  if (lower === '=') return '=';
  if (lower === '-') return '-';
  if (lower.length === 1) return lower;
  return lower;
}
