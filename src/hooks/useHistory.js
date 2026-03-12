import { useState, useCallback } from 'react';

export default function useHistory(initialState) {
  const [past, setPast] = useState([]);
  const [present, setPresent] = useState(initialState);
  const [future, setFuture] = useState([]);

  const set = useCallback((newState) => {
    setPresent(prev => {
      setPast(p => [...p, prev]);
      setFuture([]);
      return typeof newState === 'function' ? newState(prev) : newState;
    });
  }, []);

  const undo = useCallback(() => {
    setPast(prev => {
      if (prev.length === 0) return prev;
      const newPast = [...prev];
      const previous = newPast.pop();
      setPresent(current => {
        setFuture(f => [current, ...f]);
        return previous;
      });
      return newPast;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture(prev => {
      if (prev.length === 0) return prev;
      const newFuture = [...prev];
      const next = newFuture.shift();
      setPresent(current => {
        setPast(p => [...p, current]);
        return next;
      });
      return newFuture;
    });
  }, []);

  const clear = useCallback((newState) => {
    setPast([]);
    setFuture([]);
    setPresent(newState !== undefined ? newState : initialState);
  }, [initialState]);

  return {
    state: present,
    set,
    undo,
    redo,
    clear,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
