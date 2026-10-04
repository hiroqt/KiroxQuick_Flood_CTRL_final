import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';

export interface UsePanelDragOptions {
  /** CSS variable name to update directly during drag (default: '--baharoute-trip-drag'). */
  cssVarName?: string;
  /** Fraction of height dragged down to trigger closed state (default: 0.75). */
  collapseThreshold?: number;
}

export function usePanelDrag({
  cssVarName = '--baharoute-trip-drag',
  collapseThreshold = 0.75,
}: UsePanelDragOptions = {}) {
  const panelRef = useRef<HTMLElement>(null);
  const dragStartRef = useRef<number | null>(null);
  const initialOffsetRef = useRef(0);
  const dragOffsetRef = useRef(0);
  const panelHeightRef = useRef(300);
  const [dragOffset, setDragOffset] = useState(0);
  const [isClosed, setIsClosed] = useState(false);
  const [isReopening, setIsReopening] = useState(false);

  const startPanelDrag = (event: PointerEvent<HTMLElement>) => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 768px)').matches) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragStartRef.current = event.clientY;
    initialOffsetRef.current = dragOffset;
    dragOffsetRef.current = dragOffset;
    panelHeightRef.current = panelRef.current?.getBoundingClientRect().height ?? 300;
    panelRef.current?.classList.add('is-dragging');
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some mobile browsers do not support pointer capture on a section.
    }
  };

  const movePanelDrag = (event: PointerEvent<HTMLElement>) => {
    if (dragStartRef.current !== null) {
      const delta = event.clientY - dragStartRef.current;
      const height = panelHeightRef.current;
      const newOffset = Math.min(height, Math.max(0, initialOffsetRef.current + delta));
      dragOffsetRef.current = newOffset;
      // Direct DOM update: 0 React re-renders while dragging
      panelRef.current?.style.setProperty(cssVarName, `${newOffset}px`);
    }
  };

  const finishPanelDrag = (event: PointerEvent<HTMLElement>) => {
    if (dragStartRef.current === null) return;
    const height = panelHeightRef.current || 1;
    const offset = dragOffsetRef.current;
    dragStartRef.current = null;
    panelRef.current?.classList.remove('is-dragging');

    // Completely dragged down (>= threshold of panel height) -> collapse to reopen button
    if (offset / height >= collapseThreshold) {
      setIsClosed(true);
      setDragOffset(0);
    } else {
      // Commit final position to React state on release
      setDragOffset(offset);
    }

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const reopen = () => {
    setIsReopening(true);
    setIsClosed(false);
    setDragOffset(0);
  };

  const onAnimationEnd = () => {
    setIsReopening(false);
  };

  const panelStyle = { [cssVarName]: `${dragOffset}px` } as CSSProperties;

  return {
    panelRef,
    dragOffset,
    isClosed,
    isReopening,
    startPanelDrag,
    movePanelDrag,
    finishPanelDrag,
    reopen,
    onAnimationEnd,
    panelStyle,
  };
}
