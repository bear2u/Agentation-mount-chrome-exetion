import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { annotationsToMarkdown } from '../shared/element-context';
import { readPageAnnotations, writePageAnnotations } from '../shared/storage';
import type { Annotation, Priority } from '../shared/types';
import { CheckIcon, CopyIcon, CrosshairIcon, PauseIcon, PlayIcon, TrashIcon, XIcon } from '../shared/icons';

interface LensAppProps {
  extensionHost: HTMLElement;
  capture: (element: HTMLElement, comment: string, priority: Priority) => Annotation;
  registerOpen: (handler: () => void) => void;
}

interface Highlight {
  element: HTMLElement;
  rect: DOMRect;
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

function Dialog({ title, labelledBy, returnFocusRef, children, onClose }: {
  title: string;
  labelledBy: string;
  returnFocusRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = dialog.querySelector<HTMLElement>('textarea, select, button:not([disabled])');
    focusable?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>('textarea, select, button:not([disabled])'));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const root = dialog.getRootNode();
      const activeElement = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [onClose, returnFocusRef]);

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div className="dialog-heading">
          <div>
            <p className="dialog-eyebrow">선택한 요소</p>
            <h2 id={labelledBy}>{title}</h2>
          </div>
          <IconButton label="닫기" onClick={onClose}><XIcon /></IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LensApp({ extensionHost, capture, registerOpen }: LensAppProps) {
  const [visible, setVisible] = useState(false);
  const [inspecting, setInspecting] = useState(true);
  const [paused, setPaused] = useState(false);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [pendingElement, setPendingElement] = useState<HTMLElement | null>(null);
  const [comment, setComment] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [notice, setNotice] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [scrollTop, setScrollTop] = useState(window.scrollY);
  const [busyAction, setBusyAction] = useState<'add' | 'copy' | 'clear' | null>(null);
  const inspectButtonRef = useRef<HTMLButtonElement>(null);
  const clearButtonRef = useRef<HTMLButtonElement>(null);
  const pageKey = location.href.split('#')[0];

  const open = useCallback(() => {
    setVisible(true);
    setInspecting(true);
    setNotice('요소를 선택하세요');
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
    if (!visible || !inspecting || pendingElement) return;
    let frame = 0;
    const updateTarget = (event: PointerEvent) => {
      if (isLensEvent(event, extensionHost)) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setHighlight({ element: target, rect: target.getBoundingClientRect() }));
    };
    const selectTarget = (event: MouseEvent) => {
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
  }, [extensionHost, inspecting, pendingElement, visible]);

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
    if (!pendingElement || !comment.trim()) return;
    setBusyAction('add');
    try {
      const annotation = capture(pendingElement, comment, priority);
      await saveAnnotations([...annotations, annotation]);
      setPendingElement(null);
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
          aria-pressed={inspecting}
          onClick={() => { setInspecting((value) => !value); setNotice(inspecting ? '선택 모드가 꺼졌습니다' : '요소를 선택하세요'); }}
        >
          <CrosshairIcon /> {inspecting ? '선택 중' : '요소 선택'}
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
        <IconButton label="Component Lens 닫기" onClick={() => { setVisible(false); setInspecting(false); setHighlight(null); }}><XIcon /></IconButton>
        {notice && <span className="toolbar-notice" role="status">{notice}</span>}
      </section>

      {pendingElement && (
        <Dialog title={displayName(pendingElement)} labelledBy="component-lens-note-title" returnFocusRef={inspectButtonRef} onClose={closeAnnotation}>
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
