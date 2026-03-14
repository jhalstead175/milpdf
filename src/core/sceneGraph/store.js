import { useCallback, useMemo, useState } from 'react';
import useCommandHistory from '../../hooks/useCommandHistory';
import { createInteractionState } from '../interaction/state';

export function useEditorStore(initialObjects = []) {
  const history = useCommandHistory(initialObjects);
  const [selection, setSelection] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [activeTool, setActiveTool] = useState('select');
  const [pageMeta, setPageMeta] = useState([]);
  const [interactionState, setInteractionState] = useState(() => createInteractionState());

  const addObject = useCallback((obj) => {
    history.execute({
      apply: prev => [...prev, obj],
      undo: prev => prev.filter(item => item.id !== obj.id),
    });
  }, [history]);

  const addObjects = useCallback((newObjects) => {
    if (!newObjects || newObjects.length === 0) return;
    const ids = new Set(newObjects.map(item => item.id));
    history.execute({
      apply: prev => [...prev, ...newObjects],
      undo: prev => prev.filter(item => !ids.has(item.id)),
    });
  }, [history]);

  const updateObject = useCallback((id, updates) => {
    let previous = null;
    history.execute({
      apply: prev => prev.map(obj => {
        if (obj.id !== id) return obj;
        previous = obj;
        return { ...obj, ...updates };
      }),
      undo: prev => prev.map(obj => (obj.id === id && previous ? previous : obj)),
    });
  }, [history]);

  const deleteObject = useCallback((id) => {
    let removed = null;
    let removedIndex = -1;
    history.execute({
      apply: prev => {
        removedIndex = prev.findIndex(obj => obj.id === id);
        removed = removedIndex >= 0 ? prev[removedIndex] : null;
        return prev.filter(obj => obj.id !== id);
      },
      undo: prev => {
        if (!removed) return prev;
        const next = [...prev];
        next.splice(removedIndex, 0, removed);
        return next;
      },
    });
  }, [history]);

  const batchUpdateObjects = useCallback((patches) => {
    if (!patches || patches.length === 0) return;
    const patchMap = new Map(patches.map(p => [p.id, p]));
    const previous = new Map();
    history.execute({
      apply: prev => prev.map(obj => {
        if (!patchMap.has(obj.id)) return obj;
        previous.set(obj.id, obj);
        return { ...obj, ...patchMap.get(obj.id) };
      }),
      undo: prev => prev.map(obj => (previous.has(obj.id) ? previous.get(obj.id) : obj)),
    });
  }, [history]);

  const selectObjects = useCallback((ids) => {
    setSelection(ids);
  }, []);

  const resetObjects = useCallback((objects) => {
    history.clear(objects);
  }, [history]);

  const pages = useMemo(() => (
    pageMeta.map(meta => ({
      ...meta,
      objects: history.state.filter(obj => obj.page === meta.number),
    }))
  ), [pageMeta, history.state]);

  const api = useMemo(() => ({
    pages,
    setPageMeta,
    objects: history.state,
    selection,
    setSelection,
    selectObjects,
    zoom,
    setZoom,
    activeTool,
    setActiveTool,
    interactionState,
    setInteractionState,
    addObject,
    addObjects,
    updateObject,
    deleteObject,
    batchUpdateObjects,
    resetObjects,
    pageMeta,
    commitHistory: (next) => {
      let previous = null;
      history.execute({
        apply: prev => {
          previous = prev;
          return typeof next === 'function' ? next(prev) : next;
        },
        undo: () => previous,
      });
    },
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    history,
  }), [
    pages,
    history,
    selection,
    zoom,
    activeTool,
    interactionState,
    addObject,
    addObjects,
    updateObject,
    deleteObject,
    batchUpdateObjects,
    resetObjects,
    pageMeta,
    selectObjects,
  ]);

  return api;
}
