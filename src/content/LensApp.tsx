import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { annotationsToMarkdown, captureRegion } from '../shared/element-context';
import { readPageAnnotations, writePageAnnotations } from '../shared/storage';
import type { Annotation, Box, Priority } from '../shared/types';
import { AreaSelectIcon, CheckIcon, CopyIcon, CrosshairIcon, PauseIcon, PlayIcon, TrashIcon, XIcon } from '../shared/icons';

interface LensAppProps {
  extensionHost: HTMLElement;
  capture: (element: HTMLElement, comment: string, priority: Priority) => Annotation;
  registerOpen: (handler: () => void) => void;
}

interface Highlight {
  element: HTMLElement;
  rect: DOMRect;
}

type SelectionMode = 'element' | 'region';

interface DragStart {
  x: number;
  y: number;
}

function isLensEvent(event: Event, host: HTMLElement): boolean {
  return event.composedPath().includes(host);
}

function displayName(element: HTMLElement): string {
  const id = element.id ? `#${element.id}` : '';
  const className = Array.from(element.classList).slice(0, 2).map((value) => `.${value}`).join('');
  return `${element.tagName.toLowerCase()}${id}${className}`;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.documentElement.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

function IconButton({ label, selected, disabled, onClick, children }: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      title={label}
    >
      {children}
    </button>
  );
}

export function Dialog({ title, eyebrow = '선택한 요소', labelledBy, returnFocusRef, children, onClose }: {
  title: string;
  eyebrow?: string;
  labelledBy: string;
  returnFocusRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // A page's native modal makes ordinary document content inert. Opening the
    // annotation UI as its own modal gives its controls a valid focus scope.
    if (!dialog.open) dialog.showModal();
    const focusable = dialog.querySelector<HTMLElement>('textarea, select, button:not([disabled])');
    focusable?.focus();
    const onCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      if (dialog.open) dialog.close();
      returnFocusRef.current?.focus();
    };
  }, [onClose, returnFocusRef]);

  return (
    <dialog ref={dialogRef} className="dialog" aria-labelledby={labelledBy}>
      <div className="dialog-heading">
        <div>
          <p className="dialog-eyebrow">{eyebrow}</p>
          <h2 id={labelledBy}>{title}</h2>
        </div>
        <IconButton label="닫기" onClick={onClose}><XIcon /></IconButton>
      </div>
      {children}
    </dialog>
  );
}

export function LensApp({ extensionHost, capture, registerOpen }: LensAppProps) {
  const [visible, setVisible] = useState(false);
  const [inspecting, setInspecting] = useState(true);
  const [paused, setPaused] = useState(false);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('element');
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [pendingElement, setPendingElement] = useState<HTMLElement | null>(null);
  const [pendingRegion, setPendingRegion] = useState<Box | null>(null);
  const [dragRegion, setDragRegion] = useState<Box | null>(null);
  const [comment, setComment] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [notice, setNotice] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [scrollTop, setScrollTop] = useState(window.scrollY);
  const [busyAction, setBusyAction] = useState<'add' | 'copy' | 'clear' | null>(null);
  const inspectButtonRef = useRef<HTMLButtonElement>(null);
  const regionButtonRef = useRef<HTMLButtonElement>(null);
  const clearButtonRef = useRef<HTMLButtonElement>(null);
  const dragStartRef = useRef<DragStart | null>(null);
  const suppressNextClickRef = useRef(false);
  const pageKey = location.href.split('#')[0];

  const open = useCallback(() => {
    setVisible(true);
    setSelectionMode('element');
    setInspecting(true);
    setNotice('요소를 선택하세요 · Shift+드래그로 영역 선택');
  }, []);

  useEffect(() => { registerOpen(open); }, [open, registerOpen]);
  useEffect(() => { void readPageAnnotations(pageKey).then(setAnnotations); }, [pageKey]);

  useEffect(() => {
    if (!visible) return;
    const updateScroll = () => setScrollTop(window.scrollY);
    window.addEventListener('scroll', updateScroll, true);
    return () => window.removeEventListener('scroll', updateScroll, true);
  }, [visible]);

  useEffect(() => {
    if (!visible || !inspecting || selectionMode !== 'element' || pendingElement || pendingRegion) return;
    let frame = 0;
    const updateTarget = (event: PointerEvent) => {
      if (dragStartRef.current) return;
      if (isLensEvent(event, extensionHost)) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setHighlight({ element: target, rect: target.getBoundingClientRect() }));
    };
    const selectTarget = (event: MouseEvent) => {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (isLensEvent(event, extensionHost)) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setHighlight({ element: target, rect: target.getBoundingClientRect() });
      setPendingElement(target);
      setInspecting(false);
      setNotice('');
    };
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setInspecting(false);
      setHighlight(null);
      setNotice('선택 모드가 꺼졌습니다');
    };
    document.addEventListener('pointermove', updateTarget, true);
    document.addEventListener('click', selectTarget, true);
    document.addEventListener('keydown', cancel, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', updateTarget, true);
      document.removeEventListener('click', selectTarget, true);
      document.removeEventListener('keydown', cancel, true);
    };
  }, [extensionHost, inspecting, pendingElement, pendingRegion, selectionMode, visible]);

  useEffect(() => {
    if (!visible || !inspecting || pendingElement || pendingRegion) return;
    const toPagePoint = (event: PointerEvent): DragStart => ({
      x: event.clientX + window.scrollX,
      y: event.clientY + window.scrollY,
    });
    const makeBox = (start: DragStart, end: DragStart): Box => ({
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    });
    const startDrag = (event: PointerEvent) => {
      if (event.button !== 0 || isLensEvent(event, extensionHost)) return;
      if (selectionMode !== 'region' && !event.shiftKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const start = toPagePoint(event);
      dragStartRef.current = start;
      setDragRegion({ ...start, width: 0, height: 0 });
    };
    const updateDrag = (event: PointerEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      event.preventDefault();
      setDragRegion(makeBox(start, toPagePoint(event)));
    };
    const finishDrag = (event: PointerEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const region = makeBox(start, toPagePoint(event));
      dragStartRef.current = null;
      suppressNextClickRef.current = true;
      requestAnimationFrame(() => { suppressNextClickRef.current = false; });
      setDragRegion(null);
      if (region.width < 8 || region.height < 8) {
        setNotice('영역 선택은 조금 더 넓게 드래그하세요');
        return;
      }
      setHighlight(null);
      setPendingRegion(region);
      setInspecting(false);
      setNotice('');
    };
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      dragStartRef.current = null;
      setDragRegion(null);
      setInspecting(false);
      setNotice('선택 모드가 꺼졌습니다');
    };
    const preventSelection = (event: Event) => {
      if (dragStartRef.current) event.preventDefault();
    };
    document.addEventListener('pointerdown', startDrag, true);
    document.addEventListener('pointermove', updateDrag, true);
    document.addEventListener('pointerup', finishDrag, true);
    document.addEventListener('keydown', cancel, true);
    document.addEventListener('selectstart', preventSelection, true);
    return () => {
      dragStartRef.current = null;
      document.removeEventListener('pointerdown', startDrag, true);
      document.removeEventListener('pointermove', updateDrag, true);
      document.removeEventListener('pointerup', finishDrag, true);
      document.removeEventListener('keydown', cancel, true);
      document.removeEventListener('selectstart', preventSelection, true);
    };
  }, [extensionHost, inspecting, pendingElement, pendingRegion, selectionMode, visible]);

  useEffect(() => {
    if (!highlight) return;
    const update = () => setHighlight((current) => current ? { ...current, rect: current.element.getBoundingClientRect() } : null);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [highlight?.element]);

  useEffect(() => {
    const styleId = 'component-lens-pause-styles';
    let style = document.getElementById(styleId);
    if (paused) {
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        style.textContent = '*,*::before,*::after{animation-play-state:paused!important;transition:none!important;scroll-behavior:auto!important}';
        document.documentElement.append(style);
      }
      document.querySelectorAll('video, audio').forEach((media) => (media as HTMLMediaElement).pause());
    } else {
      style?.remove();
    }
    return () => { if (!paused) document.getElementById(styleId)?.remove(); };
  }, [paused]);

  const saveAnnotations = useCallback(async (next: Annotation[]) => {
    setAnnotations(next);
    await writePageAnnotations(pageKey, next);
  }, [pageKey]);

  const addAnnotation = async () => {
    if ((!pendingElement && !pendingRegion) || !comment.trim()) return;
    setBusyAction('add');
    try {
      const annotation = pendingRegion
        ? captureRegion(pendingRegion, comment, priority)
        : capture(pendingElement!, comment, priority);
      await saveAnnotations([...annotations, annotation]);
      setPendingElement(null);
      setPendingRegion(null);
      setComment('');
      setPriority('normal');
      setHighlight(null);
      setNotice('주석을 추가했습니다');
      setInspecting(true);
    } finally {
      setBusyAction(null);
    }
  };

  const closeAnnotation = useCallback(() => {
    setPendingElement(null);
    setPendingRegion(null);
    setDragRegion(null);
    setComment('');
    setHighlight(null);
    setInspecting(true);
  }, []);

  const copyAll = async () => {
    if (!annotations.length) return;
    setBusyAction('copy');
    try {
      await copyText(annotationsToMarkdown(annotations));
      setNotice(`${annotations.length}개 주석을 복사했습니다`);
    } finally {
      setBusyAction(null);
    }
  };

  const clearAll = async () => {
    setBusyAction('clear');
    try {
      await saveAnnotations([]);
      setConfirmClear(false);
      setNotice('모든 주석을 삭제했습니다');
    } finally {
      setBusyAction(null);
    }
  };

  const markerPositions = useMemo(() => annotations.map((annotation, index) => ({
    id: annotation.id,
    index: index + 1,
    left: annotation.boundingBox.x,
    top: annotation.boundingBox.y - scrollTop,
  })), [annotations, scrollTop]);

  if (!visible) return null;

  const visibleRegion = dragRegion ?? pendingRegion;
  const returnFocusRef = selectionMode === 'region' ? regionButtonRef : inspectButtonRef;

  return (
    <div className="lens-layer" aria-live="polite">
      {highlight && (
        <div
          className="highlight-box"
          style={{ left: highlight.rect.left, top: highlight.rect.top, width: highlight.rect.width, height: highlight.rect.height }}
          aria-hidden="true"
        >
          <span>{displayName(highlight.element)}</span>
        </div>
      )}

      {visibleRegion && (
        <div
          className="region-selection-box"
          style={{
            left: visibleRegion.x - window.scrollX,
            top: visibleRegion.y - scrollTop,
            width: visibleRegion.width,
            height: visibleRegion.height,
          }}
          aria-hidden="true"
        >
          <span>선택 영역</span>
        </div>
      )}

      {markerPositions.map((marker) => (
        <span key={marker.id} className="annotation-marker" style={{ left: marker.left, top: marker.top }} aria-label={`주석 ${marker.index}`}>
          {marker.index}
        </span>
      ))}

      <section className="toolbar" aria-label="Component Lens 도구">
        <div className="toolbar-brand"><CrosshairIcon /><span>Component Lens</span></div>
        <div className="toolbar-divider" />
        <button
          ref={inspectButtonRef}
          type="button"
          className="action-button"
          aria-pressed={inspecting && selectionMode === 'element'}
          onClick={() => {
            const isActive = inspecting && selectionMode === 'element';
            setSelectionMode('element');
            setInspecting(!isActive);
            setHighlight(null);
            setDragRegion(null);
            setNotice(isActive ? '선택 모드가 꺼졌습니다' : '요소를 선택하세요 · Shift+드래그로 영역 선택');
          }}
        >
          <CrosshairIcon /> 요소 선택
        </button>
        <button
          ref={regionButtonRef}
          type="button"
          className="action-button"
          aria-pressed={inspecting && selectionMode === 'region'}
          onClick={() => {
            const isActive = inspecting && selectionMode === 'region';
            setSelectionMode('region');
            setInspecting(!isActive);
            setHighlight(null);
            setDragRegion(null);
            setNotice(isActive ? '선택 모드가 꺼졌습니다' : '드래그해서 영역을 선택하세요 · Shift+드래그도 가능');
          }}
        >
          <AreaSelectIcon /> 영역 선택
        </button>
        <IconButton label={paused ? '애니메이션 재생' : '애니메이션 일시정지'} selected={paused} onClick={() => setPaused((value) => !value)}>
          {paused ? <PlayIcon /> : <PauseIcon />}
        </IconButton>
        <button type="button" className="action-button" disabled={!annotations.length || busyAction === 'copy'} aria-busy={busyAction === 'copy'} onClick={() => void copyAll()}>
          <CopyIcon /> {busyAction === 'copy' ? '복사 중' : '전체 복사'} <span className="count-badge">{annotations.length}</span>
        </button>
        <button
          ref={clearButtonRef}
          type="button"
          className="icon-button destructive"
          disabled={!annotations.length}
          aria-label="모든 주석 삭제"
          title="모든 주석 삭제"
          onClick={() => setConfirmClear(true)}
        >
          <TrashIcon />
        </button>
        <IconButton label="Component Lens 닫기" onClick={() => { setVisible(false); setInspecting(false); setHighlight(null); setPendingRegion(null); setDragRegion(null); }}><XIcon /></IconButton>
        {notice && <span className="toolbar-notice" role="status">{notice}</span>}
      </section>

      {(pendingElement || pendingRegion) && (
        <Dialog
          title={pendingRegion ? '드래그 영역' : displayName(pendingElement!)}
          eyebrow={pendingRegion ? '선택한 영역' : '선택한 요소'}
          labelledBy="component-lens-note-title"
          returnFocusRef={returnFocusRef}
          onClose={closeAnnotation}
        >
          <label className="field-label" htmlFor="component-lens-comment">무엇을 바꾸고 싶나요?</label>
          <textarea
            id="component-lens-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="예: 버튼 문구를 더 명확하게 바꿔주세요."
            rows={4}
            required
          />
          <label className="field-label" htmlFor="component-lens-priority">우선순위</label>
          <select id="component-lens-priority" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
            <option value="low">낮음</option>
            <option value="normal">보통</option>
            <option value="high">높음</option>
          </select>
          <div className="dialog-actions">
            <button type="button" className="secondary-button" onClick={closeAnnotation}>취소</button>
            <button type="button" className="primary-button" disabled={!comment.trim() || busyAction === 'add'} aria-busy={busyAction === 'add'} onClick={() => void addAnnotation()}><CheckIcon /> {busyAction === 'add' ? '추가 중' : '주석 추가'}</button>
          </div>
        </Dialog>
      )}

      {confirmClear && (
        <Dialog title="모든 주석을 삭제할까요?" labelledBy="component-lens-clear-title" returnFocusRef={clearButtonRef} onClose={() => setConfirmClear(false)}>
          <p className="dialog-copy">현재 페이지에 저장된 주석 {annotations.length}개가 브라우저에서 삭제됩니다.</p>
          <div className="dialog-actions">
            <button type="button" className="secondary-button" onClick={() => setConfirmClear(false)}>취소</button>
            <button type="button" className="destructive-button" disabled={busyAction === 'clear'} aria-busy={busyAction === 'clear'} onClick={() => void clearAll()}><TrashIcon /> {busyAction === 'clear' ? '삭제 중' : '모든 주석 삭제'}</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
