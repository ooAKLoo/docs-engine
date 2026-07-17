'use client';

import {Maximize2, RotateCcw, X, ZoomIn, ZoomOut} from 'lucide-react';
import type {HTMLAttributes, MouseEvent as ReactMouseEvent} from 'react';
import {useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {joinClassNames} from '../classnames.js';

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

export type DiagramFrameProps = HTMLAttributes<HTMLElement> & {
  /** Disable the shared full-screen viewer for a diagram that owns its own interaction. */
  zoomable?: boolean;
  /** Accessible title shown in the full-screen viewer. Falls back to aria-label. */
  viewerTitle?: string;
};

export function DiagramFrame({
  className,
  children,
  zoomable = true,
  viewerTitle,
  onClick,
  ...props
}: DiagramFrameProps) {
  const dialogId = useId();
  const inlineFigureRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [placeholderHeight, setPlaceholderHeight] = useState(0);
  const accessibleTitle =
    viewerTitle ?? (typeof props['aria-label'] === 'string' ? props['aria-label'] : '图表预览');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeViewer();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const openViewer = () => {
    if (!zoomable) return;
    setPlaceholderHeight(inlineFigureRef.current?.getBoundingClientRect().height ?? 0);
    setZoom(1);
    setOpen(true);
  };

  const closeViewer = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleFigureClick = (event: ReactMouseEvent<HTMLElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !zoomable) return;

    const target = event.target;
    if (target instanceof Element && target.closest('a, button, input, select, textarea')) return;
    openViewer();
  };

  const inlineFigure = (
    <figure
      ref={inlineFigureRef}
      className={joinClassNames('de-diagram', className)}
      data-zoomable={zoomable ? 'true' : undefined}
      onClick={handleFigureClick}
      {...props}
    >
      {zoomable ? (
        <button
          ref={triggerRef}
          type="button"
          className="de-diagram-expand"
          aria-label={`放大查看：${accessibleTitle}`}
          title="放大查看图表"
          onClick={(event) => {
            event.stopPropagation();
            openViewer();
          }}
        >
          <Maximize2 aria-hidden="true" size={18} strokeWidth={1.9} />
        </button>
      ) : null}
      {children}
    </figure>
  );

  return (
    <>
      {open ? (
        <div
          className="de-diagram-placeholder"
          style={placeholderHeight > 0 ? {height: placeholderHeight} : undefined}
          aria-hidden="true"
        />
      ) : (
        inlineFigure
      )}

      {mounted && open
        ? createPortal(
            <div
              className="de-root de-prose de-diagram-viewer-overlay"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeViewer();
              }}
            >
              <section
                className="de-diagram-viewer-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${dialogId}-title`}
              >
                <header className="de-diagram-viewer-header">
                  <h2 id={`${dialogId}-title`} className="de-diagram-viewer-title">
                    {accessibleTitle}
                  </h2>
                  <div className="de-diagram-viewer-toolbar" aria-label="图表缩放控制">
                    <button
                      type="button"
                      aria-label="缩小图表"
                      title="缩小"
                      disabled={zoom <= MIN_ZOOM}
                      onClick={() => setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))}
                    >
                      <ZoomOut aria-hidden="true" size={18} strokeWidth={1.9} />
                    </button>
                    <output className="de-diagram-viewer-zoom" aria-live="polite">
                      {Math.round(zoom * 100)}%
                    </output>
                    <button
                      type="button"
                      aria-label="放大图表"
                      title="放大"
                      disabled={zoom >= MAX_ZOOM}
                      onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP))}
                    >
                      <ZoomIn aria-hidden="true" size={18} strokeWidth={1.9} />
                    </button>
                    <button
                      type="button"
                      aria-label="恢复图表原始比例"
                      title="恢复 100%"
                      disabled={zoom === 1}
                      onClick={() => setZoom(1)}
                    >
                      <RotateCcw aria-hidden="true" size={17} strokeWidth={1.9} />
                    </button>
                    <span className="de-diagram-viewer-divider" aria-hidden="true" />
                    <button
                      type="button"
                      className="de-diagram-viewer-close"
                      aria-label="关闭图表预览"
                      title="关闭（Esc）"
                      autoFocus
                      onClick={closeViewer}
                    >
                      <X aria-hidden="true" size={20} strokeWidth={1.9} />
                    </button>
                  </div>
                </header>

                <div className="de-diagram-viewer-canvas">
                  <div
                    className="de-diagram-viewer-stage"
                    style={{width: `${zoom * 100}%`}}
                  >
                    <figure
                      className={joinClassNames('de-diagram', 'de-diagram-viewer-figure', className)}
                      data-viewer="true"
                      {...props}
                    >
                      {children}
                    </figure>
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
