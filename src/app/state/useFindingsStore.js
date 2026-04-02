import { useCallback, useState } from 'react';

export function useFindingsStore() {
  const [findings, setFindings] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedFindingId, setSelectedFindingId] = useState(null);

  const addFindings = useCallback((items) => {
    if (!items.length) return;
    setFindings((prev) => [...items, ...prev]);
    setSelectedFindingId((prev) => prev || items[0]?.id || null);
  }, []);

  const updateFinding = useCallback((findingId, patch) => {
    setFindings((prev) => prev.map((finding) => (
      finding.id === findingId ? { ...finding, ...patch } : finding
    )));
  }, []);

  const acceptFinding = useCallback((findingId) => {
    updateFinding(findingId, { status: 'accepted' });
  }, [updateFinding]);

  const rejectFinding = useCallback((findingId) => {
    updateFinding(findingId, { status: 'rejected' });
  }, [updateFinding]);

  return {
    findings,
    addFindings,
    updateFinding,
    activeFilter,
    setActiveFilter,
    selectedFindingId,
    setSelectedFindingId,
    acceptFinding,
    rejectFinding,
  };
}
