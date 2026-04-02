import { useCallback, useState } from 'react';

export function useWorkspaceStore(initialWorkspace = 'review') {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [reviewPanelTab, setReviewPanelTab] = useState('selection');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const toggleAssistant = useCallback(() => {
    setAssistantOpen((prev) => !prev);
  }, []);

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
  };
}
