import { useCallback, useState } from 'react';

// Small localStorage-backed boolean so rail collapse state survives reloads.
function usePersistentBoolean(key, fallback) {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return fallback;
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? fallback : stored === 'true';
    } catch {
      return fallback;
    }
  });

  const update = useCallback((next) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      try {
        window.localStorage.setItem(key, String(resolved));
      } catch {
        /* ignore persistence failures (private mode, etc.) */
      }
      return resolved;
    });
  }, [key]);

  return [value, update];
}

export function useWorkspaceStore(initialWorkspace = 'review') {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [reviewPanelTab, setReviewPanelTab] = useState('selection');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = usePersistentBoolean('milpdf.navCollapsed', false);
  const [inspectorCollapsed, setInspectorCollapsed] = usePersistentBoolean('milpdf.inspectorCollapsed', false);

  const toggleAssistant = useCallback(() => {
    setAssistantOpen((prev) => !prev);
  }, []);

  const toggleNavCollapsed = useCallback(() => {
    setNavCollapsed((prev) => !prev);
  }, [setNavCollapsed]);

  const toggleInspectorCollapsed = useCallback(() => {
    setInspectorCollapsed((prev) => !prev);
  }, [setInspectorCollapsed]);

  return {
    workspace,
    setWorkspace,
    assistantOpen,
    setAssistantOpen,
    toggleAssistant,
    reviewPanelTab,
    setReviewPanelTab,
    commandPaletteOpen,
    setCommandPaletteOpen,
    navCollapsed,
    toggleNavCollapsed,
    inspectorCollapsed,
    toggleInspectorCollapsed,
    setInspectorCollapsed,
  };
}
