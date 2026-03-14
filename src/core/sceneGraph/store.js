import { useCallback, useMemo, useState } from 'react';
import useHistory from '../../hooks/useHistory';
import { createInteractionState } from '../interaction/state';

export function useEditorStore(initialObjects = []) {
  const history = useHistory(initialObjects);
  const [selection, setSelection] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [activeTool, setActiveTool] = useState('select');
  const [pageMeta, setPageMeta] = useState([]);
  const [interactionState, setInteractionState] = useState(() => createInteractionState());

  const addObject = useCallback((obj) => {
    history.set(prev => [...prev, obj]);
  }, [history]);

  const addObjects = useCallback((newObjects) => {
    if (!newObjects || newObjects.length === 0) return;
    history.set(prev => [...prev, ...newObjects]);
  }, [history]);

  const updateObject = useCallback((id, updates) => {
    history.set(prev =>
      prev.map(obj => obj.id === id ? { ...obj, ...updates } : obj)
    );
  }, [history]);

  const deleteObject = useCallback((id) => {
    history.set(prev => prev.filter(obj => obj.id !== id));
  }, [history]);

  const batchUpdateObjects = useCallback((patches) => {
    if (!patches || patches.length === 0) return;
    const patchMap = new Map(patches.map(p => [p.id, p]));
    history.set(prev =>
      prev.map(obj => patchMap.has(obj.id) ? { ...obj, ...patchMap.get(obj.id) } : obj)
    );
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
    commitHistory: history.set,
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
