'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ChevronDown, Eye, Hand, HelpCircle, Maximize2, Minus, MousePointer2, PenLine, Plus, Workflow, X, } from 'lucide-react';
import { AnimatePresence, domMax, LazyMotion, m, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { joinClassNames } from '../classnames.js';
import { BoardCanvas, } from './BoardCanvas.js';
import { applyBoardOperation } from './BoardModel.js';
import { importMermaid } from './MermaidImporter.js';
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
const ZOOM_FACTOR = 1.2;
const QUICK_SHAPES = [
    { label: '圆角矩形', shape: 'round' },
    { label: '矩形', shape: 'rect' },
    { label: '全圆角矩形', shape: 'stadium' },
    { label: '圆形', shape: 'circle' },
    { label: '菱形', shape: 'diamond' },
];
let boardElementSequence = 0;
export function Board({ className, children, document: controlledDocument, defaultDocument, importSource, editable, grid = false, initialMode, mediaTransform: mediaTransformValue, zoomable = true, viewerTitle, onClick, onDoubleClick, onKeyDown, onDocumentChange, onMediaChange, ...props }) {
    const hasBoardInput = Boolean(controlledDocument || defaultDocument || importSource);
    const canEdit = editable ?? hasBoardInput;
    const dialogId = useId();
    const inlineFigureRef = useRef(null);
    const inlineCanvasRef = useRef(null);
    const viewerFigureRef = useRef(null);
    const canvasRef = useRef(null);
    const stageRef = useRef(null);
    const dialogRef = useRef(null);
    const triggerRef = useRef(null);
    const editorInputRef = useRef(null);
    const mediaItemRef = useRef(null);
    const viewportRef = useRef({ x: 0, y: 0, scale: 1 });
    const inlineViewportRef = useRef({ x: 0, y: 0, scale: 1 });
    const panSessionRef = useRef(null);
    const marqueeSessionRef = useRef(null);
    const spacePressedRef = useRef(false);
    const boardToolRef = useRef(canEdit ? 'select' : 'hand');
    const hasFittedRef = useRef(false);
    const mediaDragRef = useRef(null);
    const mediaTransformRef = useRef(resolveMediaTransform(mediaTransformValue));
    const prefersReducedMotion = useReducedMotion();
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [spacePressed, setSpacePressed] = useState(false);
    const [placeholderHeight, setPlaceholderHeight] = useState(0);
    const [viewport, setViewport] = useState(viewportRef.current);
    const [inlineViewport, setInlineViewport] = useState(inlineViewportRef.current);
    const [boardMode, setBoardMode] = useState(canEdit && initialMode !== 'view' ? 'edit' : 'view');
    const [boardTool, setBoardToolState] = useState(canEdit ? 'select' : 'hand');
    const [internalDocument, setInternalDocument] = useState(defaultDocument);
    const [importError, setImportError] = useState('');
    const [selectedNodeIds, setSelectedNodeIds] = useState([]);
    const [selectedEdgeId, setSelectedEdgeId] = useState(null);
    const [marqueeRect, setMarqueeRect] = useState(null);
    const [mediaSelected, setMediaSelected] = useState(false);
    const [mediaTransform, setMediaTransform] = useState(mediaTransformRef.current);
    const [modeMenuOpen, setModeMenuOpen] = useState(false);
    const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [editor, setEditor] = useState(null);
    const [shapePicker, setShapePicker] = useState(null);
    const boardDocument = controlledDocument ?? internalDocument;
    const documentRef = useRef(boardDocument);
    const onDocumentChangeRef = useRef(onDocumentChange);
    const accessibleTitle = viewerTitle ?? (typeof props['aria-label'] === 'string' ? props['aria-label'] : '图表预览');
    useEffect(() => {
        onDocumentChangeRef.current = onDocumentChange;
    }, [onDocumentChange]);
    useEffect(() => {
        if (controlledDocument)
            documentRef.current = controlledDocument;
    }, [controlledDocument]);
    useEffect(() => {
        if (controlledDocument || !importSource)
            return;
        let cancelled = false;
        setImportError('');
        void importMermaid(importSource.source, { layout: importSource.layout })
            .then((nextDocument) => {
            if (cancelled)
                return;
            documentRef.current = nextDocument;
            setInternalDocument(nextDocument);
            onDocumentChangeRef.current?.({ document: nextDocument, reason: 'import' });
        })
            .catch((error) => {
            if (!cancelled) {
                setImportError(error instanceof Error ? error.message : '无法导入这张图表');
            }
        });
        return () => {
            cancelled = true;
        };
    }, [controlledDocument, importSource?.layout, importSource?.source]);
    const mutateDocument = useCallback((operation, meta) => {
        const current = documentRef.current;
        if (!current)
            return;
        const next = applyBoardOperation(current, operation);
        documentRef.current = next;
        if (!controlledDocument)
            setInternalDocument(next);
        onDocumentChange?.({ ...meta, document: next, operation });
    }, [controlledDocument, onDocumentChange]);
    const updateViewport = useCallback((update) => {
        setViewport((current) => {
            const next = typeof update === 'function' ? update(current) : update;
            viewportRef.current = next;
            return next;
        });
    }, []);
    const updateInlineViewport = useCallback((update) => {
        setInlineViewport((current) => {
            const next = typeof update === 'function' ? update(current) : update;
            inlineViewportRef.current = next;
            return next;
        });
    }, []);
    const updateMediaTransform = useCallback((update) => {
        setMediaTransform((current) => {
            const next = typeof update === 'function' ? update(current) : update;
            mediaTransformRef.current = next;
            return next;
        });
    }, []);
    useEffect(() => {
        if (!mediaTransformValue)
            return;
        updateMediaTransform(resolveMediaTransform(mediaTransformValue, mediaTransformRef.current));
    }, [
        mediaTransformValue?.position?.x,
        mediaTransformValue?.position?.y,
        mediaTransformValue?.scale,
        updateMediaTransform,
    ]);
    const setBoardTool = useCallback((tool) => {
        boardToolRef.current = tool;
        setBoardToolState(tool);
        if (tool === 'hand') {
            marqueeSessionRef.current = null;
            setMarqueeRect(null);
            setSelectedNodeIds([]);
            setSelectedEdgeId(null);
            setMediaSelected(false);
            setShapePicker(null);
        }
    }, []);
    const measureContentBounds = useCallback(() => {
        const canvas = canvasRef.current;
        const stage = stageRef.current;
        if (!canvas || !stage)
            return null;
        const diagramElements = Array.from(stage.querySelectorAll('svg .de-board__node, svg .de-board__edge-label, svg .node, svg .edgeLabel'));
        const candidates = diagramElements.length > 0
            ? diagramElements
            : Array.from(stage.querySelectorAll('.de-diagram-media-item, img, svg'));
        const rects = candidates
            .map((element) => element.getBoundingClientRect())
            .filter((rect) => rect.width > 0 || rect.height > 0);
        if (rects.length === 0) {
            return { height: stage.offsetHeight, left: 0, top: 0, width: stage.offsetWidth };
        }
        const canvasRect = canvas.getBoundingClientRect();
        const current = viewportRef.current;
        const left = Math.min(...rects.map((rect) => rect.left));
        const right = Math.max(...rects.map((rect) => rect.right));
        const top = Math.min(...rects.map((rect) => rect.top));
        const bottom = Math.max(...rects.map((rect) => rect.bottom));
        return {
            left: (left - canvasRect.left - current.x) / current.scale,
            top: (top - canvasRect.top - current.y) / current.scale,
            width: (right - left) / current.scale,
            height: (bottom - top) / current.scale,
        };
    }, []);
    const centerAtScale = useCallback((scale) => {
        const canvas = canvasRef.current;
        const bounds = measureContentBounds();
        if (!canvas || !bounds)
            return;
        updateViewport({
            x: (canvas.clientWidth - bounds.width * scale) / 2 - bounds.left * scale,
            y: (canvas.clientHeight - bounds.height * scale) / 2 - bounds.top * scale,
            scale,
        });
    }, [measureContentBounds, updateViewport]);
    const fitView = useCallback(() => {
        const canvas = canvasRef.current;
        const bounds = measureContentBounds();
        if (!canvas || !bounds || bounds.width < 2 || bounds.height < 2)
            return;
        const horizontalPadding = Math.min(260, Math.max(96, canvas.clientWidth * 0.18));
        const verticalPadding = Math.min(176, Math.max(96, canvas.clientHeight * 0.18));
        const scale = clamp(Math.min((canvas.clientWidth - horizontalPadding) / bounds.width, (canvas.clientHeight - verticalPadding) / bounds.height, 1.2), MIN_ZOOM, MAX_ZOOM);
        updateViewport({
            x: (canvas.clientWidth - bounds.width * scale) / 2 - bounds.left * scale,
            y: (canvas.clientHeight - bounds.height * scale) / 2 - bounds.top * scale,
            scale,
        });
        hasFittedRef.current = true;
    }, [measureContentBounds, updateViewport]);
    const zoomAt = useCallback((nextScale, clientX, clientY) => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const current = viewportRef.current;
        const scale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
        const rect = canvas.getBoundingClientRect();
        const pointX = clientX === undefined ? rect.width / 2 : clientX - rect.left;
        const pointY = clientY === undefined ? rect.height / 2 : clientY - rect.top;
        const contentX = (pointX - current.x) / current.scale;
        const contentY = (pointY - current.y) / current.scale;
        updateViewport({
            x: pointX - contentX * scale,
            y: pointY - contentY * scale,
            scale,
        });
    }, [updateViewport]);
    const zoomBy = useCallback((factor) => {
        zoomAt(viewportRef.current.scale * factor);
    }, [zoomAt]);
    const closeViewer = useCallback(() => {
        marqueeSessionRef.current = null;
        setMarqueeRect(null);
        setEditor(null);
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        setMediaSelected(false);
        setShapePicker(null);
        setModeMenuOpen(false);
        setZoomMenuOpen(false);
        setHelpOpen(false);
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
    }, []);
    const openViewer = useCallback((requestedMode) => {
        if (!zoomable)
            return;
        const fallbackMode = canEdit && initialMode !== 'view' ? 'edit' : 'view';
        setBoardMode(canEdit ? (requestedMode ?? fallbackMode) : 'view');
        setBoardTool(canEdit ? 'select' : 'hand');
        marqueeSessionRef.current = null;
        setMarqueeRect(null);
        setPlaceholderHeight(inlineFigureRef.current?.getBoundingClientRect().height ?? 0);
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        setMediaSelected(false);
        setShapePicker(null);
        hasFittedRef.current = false;
        updateViewport({ x: 0, y: 0, scale: 1 });
        setOpen(true);
    }, [canEdit, initialMode, setBoardTool, updateViewport, zoomable]);
    const handleEditRequest = useCallback((request) => {
        const stage = stageRef.current;
        if (!stage)
            return;
        const stageRect = stage.getBoundingClientRect();
        const scale = viewportRef.current.scale;
        setEditor({
            fontSize: request.fontSize / scale,
            nodeId: request.nodeId,
            label: request.label,
            placeholder: request.placeholder,
            position: request.position,
            left: (request.rect.left - stageRect.left) / scale,
            top: (request.rect.top - stageRect.top) / scale,
            width: request.rect.width / scale,
            height: request.rect.height / scale,
        });
    }, []);
    const handleSelectNode = useCallback((nodeId, additive = false) => {
        setSelectedNodeIds((current) => {
            if (!nodeId)
                return [];
            if (current.includes(nodeId))
                return current;
            return additive ? [...current, nodeId] : [nodeId];
        });
        if (nodeId) {
            setSelectedEdgeId(null);
            setMediaSelected(false);
            setShapePicker(null);
        }
    }, []);
    const handleSelectEdge = useCallback((edgeId) => {
        setSelectedEdgeId(edgeId);
        if (edgeId) {
            setSelectedNodeIds([]);
            setMediaSelected(false);
            setShapePicker(null);
        }
    }, []);
    const handleConnect = useCallback((request) => {
        const edge = { ...request, id: createBoardElementId('edge') };
        const boardEdge = {
            ...edge,
            arrow: true,
            label: '',
            manual: true,
            stroke: 'normal',
        };
        mutateDocument({ edge: boardEdge, type: 'create-edge' }, { edgeId: edge.id, reason: 'create-edge' });
    }, [mutateDocument]);
    const handleEdgeRouteChange = useCallback((change) => {
        mutateDocument({
            edgeId: change.edgeId,
            labelPosition: change.route.label,
            points: change.route.points,
            type: 'update-edge-route',
        }, { edgeId: change.edgeId, reason: 'edge-route' });
    }, [mutateDocument]);
    const handleConnectionDrop = useCallback((request) => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const canvasRect = canvas.getBoundingClientRect();
        setEditor(null);
        setShapePicker({
            ...request,
            left: request.clientX - canvasRect.left,
            placement: request.clientX > canvasRect.right - 300 ? 'left' : 'right',
            top: request.clientY - canvasRect.top,
        });
    }, []);
    const createConnectedShape = useCallback((shape) => {
        if (!shapePicker)
            return;
        const node = {
            id: createBoardElementId('node'),
            label: '输入文本',
            placeholder: true,
            position: shapePicker.position,
            shape,
            tone: shapePicker.tone,
        };
        const edge = {
            id: createBoardElementId('edge'),
            sourceId: shapePicker.sourceId,
            sourceSide: shapePicker.sourceSide,
            targetId: node.id,
            targetSide: shapePicker.targetSide,
        };
        const boardNode = { ...node, classes: [] };
        const boardEdge = {
            ...edge,
            arrow: true,
            label: '',
            manual: true,
            stroke: 'normal',
        };
        mutateDocument({ edge: boardEdge, node: boardNode, type: 'create-node-and-edge' }, { edgeId: edge.id, nodeId: node.id, reason: 'create-node-and-edge' });
        setSelectedNodeIds([node.id]);
        setSelectedEdgeId(null);
        setMediaSelected(false);
        setShapePicker(null);
    }, [mutateDocument, shapePicker]);
    const commitEditor = useCallback(() => {
        if (!editor)
            return;
        const label = editor.label.trim();
        if (!label) {
            setEditor(null);
            return;
        }
        mutateDocument({ label, nodeId: editor.nodeId, type: 'update-node-label' }, { nodeId: editor.nodeId, reason: 'node-label' });
        setEditor(null);
    }, [editor, mutateDocument]);
    const cancelEditor = useCallback(() => {
        setEditor(null);
    }, []);
    const handleDiagramNodeChange = useCallback((change) => {
        mutateDocument(change.reason === 'label'
            ? { label: change.label, nodeId: change.nodeId, type: 'update-node-label' }
            : { nodeId: change.nodeId, position: change.position, type: 'update-node-position' }, {
            nodeId: change.nodeId,
            reason: change.reason === 'label' ? 'node-label' : 'node-position',
        });
    }, [mutateDocument]);
    useEffect(() => {
        setMounted(true);
    }, []);
    useEffect(() => {
        if (!editor)
            return;
        const frame = requestAnimationFrame(() => {
            const input = editorInputRef.current;
            input?.focus();
            if (editor.placeholder)
                input?.select();
            else
                input?.setSelectionRange(input.value.length, input.value.length);
        });
        return () => cancelAnimationFrame(frame);
    }, [editor?.nodeId]);
    useEffect(() => {
        if (boardMode === 'edit')
            return;
        setEditor(null);
        marqueeSessionRef.current = null;
        setMarqueeRect(null);
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        setMediaSelected(false);
        setShapePicker(null);
    }, [boardMode]);
    useEffect(() => {
        if (!open)
            return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const isTypingTarget = (target) => target instanceof HTMLElement &&
            (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                if (event.target instanceof Element && event.target.closest('.de-diagram-node-editor'))
                    return;
                if (modeMenuOpen || zoomMenuOpen || helpOpen || shapePicker) {
                    event.preventDefault();
                    setModeMenuOpen(false);
                    setZoomMenuOpen(false);
                    setHelpOpen(false);
                    setShapePicker(null);
                    return;
                }
                event.preventDefault();
                closeViewer();
                return;
            }
            if (event.key === 'Tab') {
                trapDialogFocus(event, dialogRef.current);
                return;
            }
            if (isTypingTarget(event.target))
                return;
            if (event.code === 'Space') {
                event.preventDefault();
                spacePressedRef.current = true;
                setSpacePressed(true);
                return;
            }
            if (event.key.toLowerCase() === 'h') {
                event.preventDefault();
                setBoardTool(boardToolRef.current === 'hand' ? 'select' : 'hand');
            }
            else if (event.key === '+' || event.key === '=') {
                event.preventDefault();
                zoomBy(ZOOM_FACTOR);
            }
            else if (event.key === '-') {
                event.preventDefault();
                zoomBy(1 / ZOOM_FACTOR);
            }
            else if (event.key === '0' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                centerAtScale(1);
            }
            else if (event.key === '1' && event.shiftKey) {
                event.preventDefault();
                fitView();
            }
        };
        const handleKeyUp = (event) => {
            if (event.code !== 'Space')
                return;
            spacePressedRef.current = false;
            panSessionRef.current = null;
            setSpacePressed(false);
            setIsPanning(false);
        };
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
            spacePressedRef.current = false;
            panSessionRef.current = null;
        };
    }, [
        centerAtScale,
        closeViewer,
        fitView,
        helpOpen,
        modeMenuOpen,
        open,
        setBoardTool,
        shapePicker,
        zoomBy,
        zoomMenuOpen,
    ]);
    useEffect(() => {
        if (!open)
            return;
        let firstFrame = requestAnimationFrame(() => {
            firstFrame = requestAnimationFrame(fitView);
        });
        const stage = stageRef.current;
        const observer = typeof ResizeObserver === 'undefined'
            ? null
            : new ResizeObserver(() => {
                if (!hasFittedRef.current)
                    fitView();
            });
        if (stage)
            observer?.observe(stage);
        return () => {
            cancelAnimationFrame(firstFrame);
            observer?.disconnect();
        };
    }, [fitView, open]);
    const handleFigureClick = (event) => {
        onClick?.(event);
        if (event.defaultPrevented || !zoomable)
            return;
        const target = event.target;
        if (target instanceof Element && target.closest('a, button, input, select, textarea'))
            return;
        openViewer(canEdit ? 'edit' : 'view');
    };
    const handleFigureDoubleClick = (event) => {
        onDoubleClick?.(event);
        if (event.defaultPrevented || !zoomable)
            return;
        const target = event.target;
        if (target instanceof Element && target.closest('a, button, input, select, textarea'))
            return;
        event.preventDefault();
        openViewer(canEdit ? 'edit' : 'view');
    };
    const handleFigureKeyDown = (event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || !zoomable)
            return;
        if (event.key === 'Enter') {
            event.preventDefault();
            openViewer(canEdit ? 'edit' : 'view');
        }
    };
    const handleWheel = useCallback((event) => {
        event.preventDefault();
        setZoomMenuOpen(false);
        if (event.ctrlKey || event.metaKey) {
            zoomAt(viewportRef.current.scale * Math.exp(-event.deltaY * 0.0025), event.clientX, event.clientY);
            return;
        }
        updateViewport((current) => ({
            ...current,
            x: current.x - (event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX),
            y: current.y - (event.shiftKey ? 0 : event.deltaY),
        }));
    }, [updateViewport, zoomAt]);
    useEffect(() => {
        if (!open)
            return;
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleWheel);
    }, [handleWheel, open]);
    const handleInlineWheel = useCallback((event) => {
        if (!zoomable)
            return;
        event.preventDefault();
        const canvas = inlineCanvasRef.current;
        if (!canvas)
            return;
        if (event.ctrlKey || event.metaKey) {
            const current = inlineViewportRef.current;
            const rect = canvas.getBoundingClientRect();
            const pointX = event.clientX - rect.left;
            const pointY = event.clientY - rect.top;
            const scale = clamp(current.scale * Math.exp(-event.deltaY * 0.0025), MIN_ZOOM, MAX_ZOOM);
            const contentX = (pointX - current.x) / current.scale;
            const contentY = (pointY - current.y) / current.scale;
            updateInlineViewport({
                x: pointX - contentX * scale,
                y: pointY - contentY * scale,
                scale,
            });
            return;
        }
        updateInlineViewport((current) => ({
            ...current,
            x: current.x - (event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX),
            y: current.y - (event.shiftKey ? 0 : event.deltaY),
        }));
    }, [updateInlineViewport, zoomable]);
    useEffect(() => {
        if (open || !zoomable)
            return;
        const canvas = inlineCanvasRef.current;
        if (!canvas)
            return;
        canvas.addEventListener('wheel', handleInlineWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleInlineWheel);
    }, [handleInlineWheel, open, zoomable]);
    const handleCanvasPointerDown = (event) => {
        setModeMenuOpen(false);
        setZoomMenuOpen(false);
        setHelpOpen(false);
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('button, a, input, textarea, [role="menu"]'))
            return;
        const interactiveElement = target?.closest('[data-de-node-id], [data-de-edge-id], [data-de-media-item]');
        const additive = event.shiftKey || event.metaKey || event.ctrlKey;
        const canStartMarquee = event.button === 0 &&
            canEdit &&
            boardMode === 'edit' &&
            Boolean(boardDocument) &&
            boardToolRef.current === 'select' &&
            !spacePressedRef.current &&
            !interactiveElement;
        if (canStartMarquee) {
            event.preventDefault();
            const canvasRect = event.currentTarget.getBoundingClientRect();
            const originX = clamp(event.clientX - canvasRect.left, 0, canvasRect.width);
            const originY = clamp(event.clientY - canvasRect.top, 0, canvasRect.height);
            event.currentTarget.setPointerCapture(event.pointerId);
            marqueeSessionRef.current = {
                additive,
                originX,
                originY,
                pointerId: event.pointerId,
                selectionStart: [...selectedNodeIds],
            };
            if (!additive)
                setSelectedNodeIds([]);
            setSelectedEdgeId(null);
            setMediaSelected(false);
            setShapePicker(null);
            setEditor(null);
            setMarqueeRect({ height: 0, left: originX, top: originY, width: 0 });
            return;
        }
        if (!interactiveElement) {
            setSelectedNodeIds([]);
            setSelectedEdgeId(null);
            setMediaSelected(false);
            setShapePicker(null);
        }
        const shouldPan = event.button === 2 ||
            (event.button === 0 &&
                (boardToolRef.current === 'hand' ||
                    spacePressedRef.current ||
                    (!boardDocument && !interactiveElement)));
        if (!shouldPan)
            return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        panSessionRef.current = {
            lastX: event.clientX,
            lastY: event.clientY,
            pointerId: event.pointerId,
        };
        setIsPanning(true);
    };
    const handleCanvasPointerMove = (event) => {
        const marqueeSession = marqueeSessionRef.current;
        if (marqueeSession?.pointerId === event.pointerId) {
            const canvasRect = event.currentTarget.getBoundingClientRect();
            const currentX = clamp(event.clientX - canvasRect.left, 0, canvasRect.width);
            const currentY = clamp(event.clientY - canvasRect.top, 0, canvasRect.height);
            setMarqueeRect(rectFromPoints(marqueeSession.originX, marqueeSession.originY, currentX, currentY));
            return;
        }
        const session = panSessionRef.current;
        if (!session || session.pointerId !== event.pointerId)
            return;
        const deltaX = event.clientX - session.lastX;
        const deltaY = event.clientY - session.lastY;
        session.lastX = event.clientX;
        session.lastY = event.clientY;
        updateViewport((current) => ({ ...current, x: current.x + deltaX, y: current.y + deltaY }));
    };
    const finishCanvasInteraction = (event, cancelled = false) => {
        const marqueeSession = marqueeSessionRef.current;
        if (marqueeSession?.pointerId === event.pointerId) {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
            const canvasRect = event.currentTarget.getBoundingClientRect();
            const currentX = clamp(event.clientX - canvasRect.left, 0, canvasRect.width);
            const currentY = clamp(event.clientY - canvasRect.top, 0, canvasRect.height);
            const selectionRect = rectFromPoints(marqueeSession.originX, marqueeSession.originY, currentX, currentY);
            if (cancelled) {
                setSelectedNodeIds(marqueeSession.selectionStart);
            }
            else if (selectionRect.width >= 3 || selectionRect.height >= 3) {
                const screenSelection = {
                    bottom: canvasRect.top + selectionRect.top + selectionRect.height,
                    left: canvasRect.left + selectionRect.left,
                    right: canvasRect.left + selectionRect.left + selectionRect.width,
                    top: canvasRect.top + selectionRect.top,
                };
                const selectedByMarquee = Array.from(event.currentTarget.querySelectorAll('[data-de-node-id]'))
                    .filter((element) => rectanglesIntersect(screenSelection, element.getBoundingClientRect()))
                    .map((element) => element.dataset.deNodeId)
                    .filter((nodeId) => Boolean(nodeId));
                setSelectedNodeIds(marqueeSession.additive
                    ? [...new Set([...marqueeSession.selectionStart, ...selectedByMarquee])]
                    : selectedByMarquee);
            }
            marqueeSessionRef.current = null;
            setMarqueeRect(null);
            return;
        }
        if (panSessionRef.current?.pointerId !== event.pointerId)
            return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        panSessionRef.current = null;
        setIsPanning(false);
    };
    const beginMediaInteraction = (event, mode) => {
        if (!canEdit || boardMode !== 'edit' || boardToolRef.current !== 'select' || event.button !== 0) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const rect = mediaItemRef.current?.getBoundingClientRect();
        event.currentTarget.setPointerCapture(event.pointerId);
        mediaDragRef.current = {
            basis: Math.max(180, Math.min(rect?.width ?? 180, rect?.height ?? 180)),
            mode,
            pointerId: event.pointerId,
            pointerStart: { x: event.clientX, y: event.clientY },
            transformStart: { ...mediaTransformRef.current },
        };
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        setMediaSelected(true);
    };
    const moveMediaInteraction = (event) => {
        const session = mediaDragRef.current;
        if (!session || session.pointerId !== event.pointerId)
            return;
        const scale = viewportRef.current.scale;
        const deltaX = (event.clientX - session.pointerStart.x) / scale;
        const deltaY = (event.clientY - session.pointerStart.y) / scale;
        if (session.mode === 'move') {
            updateMediaTransform({ ...session.transformStart, x: session.transformStart.x + deltaX, y: session.transformStart.y + deltaY });
            return;
        }
        const factor = 1 + (deltaX + deltaY) / session.basis;
        updateMediaTransform({ ...session.transformStart, scale: clamp(session.transformStart.scale * factor, 0.2, 4) });
    };
    const finishMediaInteraction = (event) => {
        const session = mediaDragRef.current;
        if (!session || session.pointerId !== event.pointerId)
            return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        mediaDragRef.current = null;
        const transform = mediaTransformRef.current;
        onMediaChange?.({
            position: { x: transform.x, y: transform.y },
            reason: session.mode === 'move' ? 'position' : 'scale',
            scale: transform.scale,
        });
    };
    const cancelMediaInteraction = (event) => {
        if (mediaDragRef.current?.pointerId !== event.pointerId)
            return;
        mediaDragRef.current = null;
    };
    const editModeActive = canEdit && boardMode === 'edit';
    const canvasPanActive = boardTool === 'hand' || spacePressed;
    const inlineFigure = (_jsxs("figure", { ref: inlineFigureRef, className: joinClassNames('de-diagram', className), "data-editable": canEdit ? 'true' : undefined, "data-grid": grid ? 'true' : undefined, "data-zoomable": zoomable ? 'true' : undefined, tabIndex: zoomable ? 0 : undefined, onClick: handleFigureClick, onDoubleClick: handleFigureDoubleClick, onKeyDown: handleFigureKeyDown, ...props, children: [zoomable ? (_jsxs("div", { className: "de-diagram-inline-toolbar", "aria-label": "\u753B\u677F\u64CD\u4F5C", children: [_jsxs("button", { ref: triggerRef, type: "button", className: "de-diagram-inline-entry", "aria-label": `${canEdit ? '编辑' : '查看'}画板：${accessibleTitle}`, onClick: (event) => {
                            event.stopPropagation();
                            openViewer(canEdit ? 'edit' : 'view');
                        }, children: [canEdit ? (_jsx(PenLine, { "aria-hidden": "true", size: 18, strokeWidth: 1.9 })) : (_jsx(Eye, { "aria-hidden": "true", size: 18, strokeWidth: 1.9 })), _jsx("span", { children: canEdit ? '编辑' : '查看' })] }), _jsx("span", { className: "de-diagram-inline-divider", "aria-hidden": "true" }), _jsx("button", { type: "button", "aria-label": `全屏打开画板：${accessibleTitle}`, title: "\u5168\u5C4F\u6253\u5F00", onClick: (event) => {
                            event.stopPropagation();
                            openViewer(canEdit ? 'edit' : 'view');
                        }, children: _jsx(Maximize2, { "aria-hidden": "true", size: 18, strokeWidth: 1.9 }) })] })) : null, _jsx("div", { ref: inlineCanvasRef, className: "de-diagram-inline-canvas", children: _jsx("div", { className: "de-diagram-inline-stage", style: {
                        transform: `translate3d(${inlineViewport.x}px, ${inlineViewport.y}px, 0) scale(${inlineViewport.scale})`,
                    }, children: boardDocument ? (_jsx(BoardCanvas, { accessibleLabel: accessibleTitle, document: boardDocument, editable: false, fitContent: true, panActive: false })) : importSource ? (_jsx(BoardLoadState, { error: importError })) : (children) }) })] }));
    const canvasStyle = {
        '--de-diagram-grid-size': `${22 * viewport.scale}px`,
        '--de-diagram-grid-x': `${viewport.x}px`,
        '--de-diagram-grid-y': `${viewport.y}px`,
    };
    return (_jsxs(_Fragment, { children: [open ? (_jsx("div", { className: "de-diagram-placeholder", style: placeholderHeight > 0 ? { height: placeholderHeight } : undefined, "aria-hidden": "true" })) : (inlineFigure), mounted
                ? createPortal(_jsx(LazyMotion, { features: domMax, strict: true, children: _jsx(AnimatePresence, { children: open ? (_jsx(m.div, { className: "de-root de-prose de-diagram-viewer-overlay", initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: prefersReducedMotion ? 0 : 0.14 }, children: _jsxs(m.section, { ref: dialogRef, className: "de-diagram-viewer-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": `${dialogId}-title`, initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: prefersReducedMotion ? 0 : 0.16 }, children: [_jsx("h2", { id: `${dialogId}-title`, className: "de-diagram-a11y-title", children: accessibleTitle }), _jsxs("div", { className: "de-diagram-board-brand de-diagram-board-float", children: [_jsxs("button", { type: "button", autoFocus: true, onClick: closeViewer, "aria-label": "\u9000\u51FA\u753B\u677F", children: [_jsx(X, { "aria-hidden": "true", size: 20, strokeWidth: 1.9 }), _jsx("span", { children: "\u9000\u51FA" })] }), _jsx("span", { className: "de-diagram-board-divider", "aria-hidden": "true" }), _jsxs("span", { className: "de-diagram-board-identity", children: [_jsx("span", { className: "de-diagram-board-mark", "aria-hidden": "true", children: _jsx(Workflow, { size: 17, strokeWidth: 2.1 }) }), _jsx("span", { children: "\u753B\u677F" })] })] }), _jsxs("div", { className: "de-diagram-board-mode-wrap", children: [_jsxs("div", { className: "de-diagram-board-mode de-diagram-board-float", children: [_jsx("span", { className: "de-diagram-board-title", title: accessibleTitle, children: accessibleTitle }), _jsx("span", { className: "de-diagram-board-divider", "aria-hidden": "true" }), canEdit ? (_jsxs("button", { type: "button", "aria-expanded": modeMenuOpen, "aria-haspopup": "menu", onClick: () => setModeMenuOpen((current) => !current), children: [editModeActive ? (_jsx(PenLine, { "aria-hidden": "true", size: 18, strokeWidth: 1.9 })) : (_jsx(Eye, { "aria-hidden": "true", size: 18, strokeWidth: 1.9 })), _jsx("span", { children: editModeActive ? '编辑' : '浏览' }), _jsx(ChevronDown, { "aria-hidden": "true", size: 15, strokeWidth: 1.9 })] })) : (_jsxs("span", { className: "de-diagram-board-readonly", children: [_jsx(Eye, { "aria-hidden": "true", size: 18, strokeWidth: 1.9 }), _jsx("span", { children: "\u6D4F\u89C8" })] }))] }), _jsx(AnimatePresence, { children: modeMenuOpen ? (_jsxs(m.div, { className: "de-diagram-board-menu de-diagram-board-mode-menu", role: "menu", initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: prefersReducedMotion ? 0 : 0.12 }, children: [_jsxs("button", { type: "button", role: "menuitemradio", "aria-checked": boardMode === 'edit', onClick: () => {
                                                                setBoardMode('edit');
                                                                setBoardTool('select');
                                                                setModeMenuOpen(false);
                                                            }, children: [_jsx(PenLine, { "aria-hidden": "true", size: 17 }), _jsxs("span", { children: [_jsx("strong", { children: "\u7F16\u8F91" }), _jsx("small", { children: boardDocument ? '拖动节点并修改文字' : '拖动并缩放图形' })] })] }), _jsxs("button", { type: "button", role: "menuitemradio", "aria-checked": boardMode === 'view', onClick: () => {
                                                                setBoardMode('view');
                                                                setBoardTool('hand');
                                                                setModeMenuOpen(false);
                                                            }, children: [_jsx(Eye, { "aria-hidden": "true", size: 17 }), _jsxs("span", { children: [_jsx("strong", { children: "\u6D4F\u89C8" }), _jsx("small", { children: "\u4EC5\u7F29\u653E\u548C\u5E73\u79FB\u753B\u5E03" })] })] })] })) : null })] }), _jsxs("nav", { className: "de-diagram-board-tools de-diagram-board-float", "aria-label": "\u753B\u677F\u5DE5\u5177", children: [editModeActive ? (_jsx("button", { type: "button", "aria-label": "\u9009\u62E9\u5DE5\u5177", "aria-pressed": boardTool === 'select', title: "\u9009\u62E9", onClick: () => setBoardTool('select'), children: _jsx(MousePointer2, { "aria-hidden": "true", size: 20, strokeWidth: 1.8 }) })) : null, _jsx("button", { type: "button", "aria-label": "\u624B\u578B\u79FB\u52A8\u5DE5\u5177", "aria-keyshortcuts": "H", "aria-pressed": boardTool === 'hand', title: "\u79FB\u52A8\u753B\u5E03\uFF08H\uFF09", onClick: () => setBoardTool(boardTool === 'hand' ? 'select' : 'hand'), children: _jsx(Hand, { "aria-hidden": "true", size: 20, strokeWidth: 1.8 }) })] }), _jsxs(m.div, { ref: canvasRef, className: "de-diagram-viewer-canvas", "data-grid": grid ? 'true' : undefined, "data-pan-active": canvasPanActive ? 'true' : undefined, "data-panning": isPanning ? 'true' : undefined, "data-selecting": marqueeRect ? 'true' : undefined, style: canvasStyle, onContextMenu: (event) => event.preventDefault(), onPointerDown: handleCanvasPointerDown, onPointerMove: handleCanvasPointerMove, onPointerUp: finishCanvasInteraction, onPointerCancel: (event) => finishCanvasInteraction(event, true), children: [_jsxs("div", { ref: stageRef, className: "de-diagram-viewer-stage", style: {
                                                    transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
                                                }, children: [_jsx("figure", { ref: viewerFigureRef, className: joinClassNames('de-diagram', 'de-diagram-viewer-figure', className), "data-editable": editModeActive ? 'true' : undefined, "data-viewer": "true", ...props, children: boardDocument ? (_jsx(BoardCanvas, { accessibleLabel: accessibleTitle, document: boardDocument, editable: editModeActive, editingNodeId: editor?.nodeId, onChange: handleDiagramNodeChange, onConnect: handleConnect, onConnectionDrop: handleConnectionDrop, onEdgeRouteChange: handleEdgeRouteChange, onEditRequest: handleEditRequest, onReady: () => {
                                                                if (!hasFittedRef.current)
                                                                    requestAnimationFrame(fitView);
                                                            }, onSelectNode: handleSelectNode, onSelectEdge: handleSelectEdge, panActive: canvasPanActive, selectedEdgeId: selectedEdgeId, selectedNodeIds: selectedNodeIds })) : importSource ? (_jsx(BoardLoadState, { error: importError })) : (_jsxs("div", { ref: mediaItemRef, className: "de-diagram-media-item", "data-de-media-item": "true", "data-selected": mediaSelected ? 'true' : undefined, style: {
                                                                transform: `translate3d(${mediaTransform.x}px, ${mediaTransform.y}px, 0) scale(${mediaTransform.scale})`,
                                                            }, onPointerDown: (event) => beginMediaInteraction(event, 'move'), onPointerMove: moveMediaInteraction, onPointerUp: finishMediaInteraction, onPointerCancel: cancelMediaInteraction, children: [children, editModeActive && mediaSelected && !canvasPanActive ? (_jsx("span", { className: "de-diagram-media-scale-handle", "aria-label": "\u8C03\u6574\u56FE\u7247\u6216\u56FE\u5F62\u5927\u5C0F", role: "button", tabIndex: 0, onPointerDown: (event) => beginMediaInteraction(event, 'scale') })) : null] })) }), _jsx(AnimatePresence, { children: editor ? (_jsx("div", { className: "de-diagram-node-editor", style: {
                                                                left: editor.left,
                                                                top: editor.top,
                                                                width: editor.width,
                                                                height: editor.height,
                                                            }, onBlur: (event) => {
                                                                if (!event.currentTarget.contains(event.relatedTarget))
                                                                    commitEditor();
                                                            }, onPointerDown: (event) => event.stopPropagation(), children: _jsx("textarea", { ref: editorInputRef, value: editor.label, "aria-label": "\u7F16\u8F91\u8282\u70B9\u6587\u5B57", style: {
                                                                    fontSize: editor.fontSize,
                                                                    paddingTop: Math.max(0, (editor.height -
                                                                        editor.label.split('\n').length * editor.fontSize * 1.2) /
                                                                        2),
                                                                }, onChange: (event) => setEditor((current) => current ? { ...current, label: event.target.value } : current), onKeyDown: (event) => {
                                                                    event.stopPropagation();
                                                                    if (event.key === 'Escape') {
                                                                        event.preventDefault();
                                                                        cancelEditor();
                                                                    }
                                                                    else if (event.key === 'Enter' &&
                                                                        (event.metaKey || event.ctrlKey)) {
                                                                        event.preventDefault();
                                                                        commitEditor();
                                                                    }
                                                                } }) }, editor.nodeId)) : null })] }), marqueeRect ? (_jsx("div", { className: "de-diagram-selection-marquee", "aria-hidden": "true", style: {
                                                    height: marqueeRect.height,
                                                    left: marqueeRect.left,
                                                    top: marqueeRect.top,
                                                    width: marqueeRect.width,
                                                } })) : null, shapePicker ? (_jsx(m.div, { className: "de-diagram-shape-picker", "data-placement": shapePicker.placement, role: "menu", "aria-label": "\u9009\u62E9\u8981\u521B\u5EFA\u7684\u56FE\u5F62", style: { left: shapePicker.left, top: shapePicker.top }, initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: prefersReducedMotion ? 0 : 0.12 }, onPointerDown: (event) => event.stopPropagation(), children: QUICK_SHAPES.map((option) => (_jsx("button", { type: "button", role: "menuitem", "aria-label": `创建${option.label}`, title: option.label, onClick: () => createConnectedShape(option.shape), children: _jsx(ShapeGlyph, { shape: option.shape }) }, option.shape))) }, `${shapePicker.sourceId}-${shapePicker.clientX}-${shapePicker.clientY}`)) : null] }), _jsxs("div", { className: "de-diagram-board-zoom-wrap", children: [_jsx(AnimatePresence, { children: helpOpen ? (_jsxs(m.div, { className: "de-diagram-board-help-popover", initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 4 }, transition: { duration: prefersReducedMotion ? 0 : 0.12 }, children: [_jsx("strong", { children: "\u79FB\u52A8\u4E0E\u7F29\u653E" }), _jsx("span", { children: "H \u6216\u624B\u578B\u5DE5\u5177\uFF1A\u62D6\u52A8\u753B\u5E03" }), _jsx("span", { children: "Space + \u5DE6\u952E\u62D6\u52A8\uFF0C\u6216\u76F4\u63A5\u53F3\u952E\u62D6\u52A8" }), _jsx("span", { children: "\u2318 / Ctrl + \u6EDA\u8F6E\uFF1A\u4EE5\u6307\u9488\u4E3A\u4E2D\u5FC3\u7F29\u653E" })] })) : null }), _jsx(AnimatePresence, { children: zoomMenuOpen ? (_jsxs(m.div, { className: "de-diagram-board-menu de-diagram-board-zoom-menu", role: "menu", initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 4 }, transition: { duration: prefersReducedMotion ? 0 : 0.12 }, children: [_jsxs("button", { type: "button", role: "menuitem", onClick: () => {
                                                                centerAtScale(1);
                                                                setZoomMenuOpen(false);
                                                            }, children: [_jsx("span", { children: "\u7F29\u653E\u81F3 100%" }), _jsx("kbd", { children: "\u2318 / Ctrl + 0" })] }), _jsxs("button", { type: "button", role: "menuitem", onClick: () => {
                                                                fitView();
                                                                setZoomMenuOpen(false);
                                                            }, children: [_jsx("span", { children: "\u5168\u89C8" }), _jsx("kbd", { children: "Shift + 1" })] })] })) : null }), _jsxs("div", { className: "de-diagram-board-zoom de-diagram-board-float", children: [_jsx("button", { type: "button", "aria-label": "\u624B\u578B\u79FB\u52A8\u5DE5\u5177", "aria-keyshortcuts": "H", "aria-pressed": boardTool === 'hand', title: "\u79FB\u52A8\u753B\u5E03\uFF08H\uFF09", onClick: () => setBoardTool(boardTool === 'hand' ? 'select' : 'hand'), children: _jsx(Hand, { "aria-hidden": "true", size: 20, strokeWidth: 1.8 }) }), _jsx("span", { className: "de-diagram-board-divider", "aria-hidden": "true" }), _jsx("button", { type: "button", "aria-label": "\u7F29\u5C0F\u753B\u677F", title: "\u7F29\u5C0F\uFF08-\uFF09", disabled: viewport.scale <= MIN_ZOOM, onClick: () => zoomBy(1 / ZOOM_FACTOR), children: _jsx(Minus, { "aria-hidden": "true", size: 20, strokeWidth: 1.8 }) }), _jsxs("button", { type: "button", className: "de-diagram-board-zoom-value", "aria-label": `当前缩放 ${Math.round(viewport.scale * 100)}%，打开缩放菜单`, "aria-expanded": zoomMenuOpen, "aria-haspopup": "menu", onClick: () => setZoomMenuOpen((current) => !current), children: [Math.round(viewport.scale * 100), "%"] }), _jsx("button", { type: "button", "aria-label": "\u653E\u5927\u753B\u677F", title: "\u653E\u5927\uFF08+\uFF09", disabled: viewport.scale >= MAX_ZOOM, onClick: () => zoomBy(ZOOM_FACTOR), children: _jsx(Plus, { "aria-hidden": "true", size: 20, strokeWidth: 1.8 }) })] }), _jsx("button", { type: "button", className: "de-diagram-board-help de-diagram-board-float", "aria-label": "\u67E5\u770B\u753B\u677F\u64CD\u4F5C\u5E2E\u52A9", "aria-expanded": helpOpen, onClick: () => setHelpOpen((current) => !current), children: _jsx(HelpCircle, { "aria-hidden": "true", size: 20, strokeWidth: 1.8 }) })] })] }) }, "diagram-board")) : null }) }), document.body)
                : null] }));
}
function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}
function rectFromPoints(x1, y1, x2, y2) {
    return {
        height: Math.abs(y2 - y1),
        left: Math.min(x1, x2),
        top: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
    };
}
function rectanglesIntersect(first, second) {
    return (first.left <= second.right &&
        first.right >= second.left &&
        first.top <= second.bottom &&
        first.bottom >= second.top);
}
function resolveMediaTransform(value, fallback = { scale: 1, x: 0, y: 0 }) {
    const position = value?.position;
    return {
        scale: typeof value?.scale === 'number' && Number.isFinite(value.scale)
            ? clamp(value.scale, 0.2, 4)
            : fallback.scale,
        x: typeof position?.x === 'number' && Number.isFinite(position.x) ? position.x : fallback.x,
        y: typeof position?.y === 'number' && Number.isFinite(position.y) ? position.y : fallback.y,
    };
}
function BoardLoadState({ error }) {
    return (_jsx("div", { className: "de-board de-board--status", role: "status", children: error ? (_jsxs(_Fragment, { children: [_jsx("strong", { children: "\u6682\u65F6\u65E0\u6CD5\u5BFC\u5165\u8FD9\u5F20\u56FE\u8868" }), _jsx("span", { children: error })] })) : (_jsx("span", { children: "\u6B63\u5728\u6784\u5EFA\u753B\u677F\u2026" })) }));
}
function createBoardElementId(prefix) {
    boardElementSequence += 1;
    return `de-${prefix}-${Date.now().toString(36)}-${boardElementSequence.toString(36)}`;
}
function ShapeGlyph({ shape }) {
    return (_jsx("svg", { viewBox: "0 0 30 24", "aria-hidden": "true", children: shape === 'diamond' ? (_jsx("path", { d: "M15 2 28 12 15 22 2 12Z" })) : shape === 'circle' ? (_jsx("ellipse", { cx: "15", cy: "12", rx: "10", ry: "10" })) : (_jsx("rect", { x: "2", y: "4", width: "26", height: "16", rx: shape === 'stadium' ? 8 : shape === 'round' ? 5 : 1.5 })) }));
}
function trapDialogFocus(event, dialog) {
    if (!dialog)
        return;
    const focusable = Array.from(dialog.querySelectorAll('button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hidden && element.getClientRects().length > 0);
    if (focusable.length === 0)
        return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    }
    else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}
//# sourceMappingURL=Board.js.map