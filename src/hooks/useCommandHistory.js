import { useCallback, useState } from 'react';

export default function useCommandHistory(initialState) {
  const [past, setPast] = useState([]);
  const [present, setPresent] = useState(initialState);
  const [future, setFuture] = useState([]);

  const execute = useCallback((command) => {
    if (!command?.apply || !command?.undo) return;
    setPresent(prev => {
      const next = command.apply(prev);
      setPast(p => [...p, command]);
      setFuture([]);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setPast(prev => {
      if (prev.length === 0) return prev;
      const newPast = [...prev];
      const command = newPast.pop();
      setPresent(current => {
        const next = command.undo(current);
        setFuture(f => [command, ...f]);
        return next;
      });
      return newPast;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture(prev => {
      if (prev.length === 0) return prev;
      const newFuture = [...prev];
      const command = newFuture.shift();
      setPresent(current => {
        const next = command.apply(current);
        setPast(p => [...p, command]);
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
    execute,
    undo,
    redo,
    clear,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
