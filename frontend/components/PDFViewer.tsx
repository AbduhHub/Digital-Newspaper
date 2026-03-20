"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchAds } from "../lib/fetchAds";

//  Constants
const MIN_ZOOM = 0.35;
const MAX_ZOOM_DESKTOP = 3;
const MAX_ZOOM_MOBILE = 3.5;
const MAX_CONCURRENT_RENDERS = 3;
const VIRTUAL_WINDOW_DESKTOP = 8;
const VIRTUAL_WINDOW_MOBILE = 4;
const RENDER_BUFFER_DESKTOP = 5;
const RENDER_BUFFER_MOBILE = 3;
const EVICT_SAFE_BUFFER = 4;
const MAX_DOM_PAGES = 20;
const DOUBLE_TAP_MS = 350;
const RESIZE_DEBOUNCE_MS = 150;
const FIT_WIDTH_PADDING_PX = 48;

//  Types
type Props = {
  pages: string[];
  thumbnailPages?: string[];
};

type RenderedPage = {
  pageNumber: number;
  element: HTMLDivElement;
  naturalWidth: number;
  naturalHeight: number;
};

//  Component
export default function PDFViewer({ pages = [], thumbnailPages = [] }: Props) {
  //  device / viewport
  const [isMobile, setIsMobile] = useState(false);
  const isMobileRef = useRef(false);
  const MAX_ZOOM = isMobile ? MAX_ZOOM_MOBILE : MAX_ZOOM_DESKTOP;

  //  DOM refs
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const zoomLayerRef = useRef<HTMLDivElement>(null);
  const pagesWrapperRef = useRef<HTMLDivElement>(null);

  //  page state + refs (refs used inside async callbacks to avoid stale closures)
  const [numPages, setNumPages] = useState(0);
  const numPagesRef = useRef(0);
  const [activePage, setActivePage] = useState(1);
  const activePageRef = useRef(1);

  //  loading
  const [loading, setLoading] = useState(true);
  const [loadingPercent, setLoadingPercent] = useState(0);

  //  UI
  const [showSidebar, setShowSidebar] = useState(true);
  const [readingMode, setReadingMode] = useState(false);
  const readingModeRef = useRef(false);
  const [uiVisible, setUiVisible] = useState(true);

  const [pageCounterPulse, setPageCounterPulse] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const hasMountedRef = useRef(false);

  //  ads
  const [sidebarAds, setSidebarAds] = useState<any[]>([]);
  const betweenAdsRef = useRef<any[]>([]);
  const [adsReady, setAdsReady] = useState(false);

  //  zoom — both state (for React UI) and ref (for sync callbacks)
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);

  //  fit-width
  const [fitWidth, setFitWidth] = useState(true);
  const fitWidthRef = useRef(true);

  //  render pipeline
  const renderedPagesRef = useRef<Map<number, RenderedPage>>(new Map());
  const renderingPagesRef = useRef<Set<number>>(new Set());
  const loadedPagesRef = useRef<Set<number>>(new Set());
  const renderQueueRef = useRef<number[]>([]);
  const renderingNowRef = useRef(0);
  const imageAbortRef = useRef<Map<number, AbortController>>(new Map());

  const initializedPagesRef = useRef<string[] | null>(null);

  //  gesture state
  const pinchRef = useRef({
    active: false,
    startDist: 0,
    startZoom: 1,
    centerX: 0,
    centerY: 0,
  });
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
  });
  const lastTapRef = useRef(0);

  //  DPR
  const dprRef = useRef(
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
  );

  const uiFont = `'Inter', system-ui, sans-serif`;
  const urduFont = `'Noto Nastaliq Urdu', serif`;
  const zoomPresets = useMemo(() => [75, 100, 125, 150, 200, 300], []);

  //
  // PADDING HELPERS — always read from DOM, never hardcode
  //
  function getZoomLayerPaddingTop(): number {
    const layer = zoomLayerRef.current;
    if (!layer) return 0;
    return parseInt(getComputedStyle(layer).paddingTop, 10) || 0;
  }

  function getZoomLayerPaddingX(): number {
    const layer = zoomLayerRef.current;
    if (!layer) return FIT_WIDTH_PADDING_PX;
    const s = getComputedStyle(layer);
    return (
      (parseInt(s.paddingLeft, 10) || 0) + (parseInt(s.paddingRight, 10) || 0)
    );
  }

  //
  // SYNC STATE → REFS
  //
  useEffect(() => {
    numPagesRef.current = numPages;
  }, [numPages]);
  useEffect(() => {
    activePageRef.current = activePage;
  }, [activePage]);
  useEffect(() => {
    fitWidthRef.current = fitWidth;
  }, [fitWidth]);
  useEffect(() => {
    readingModeRef.current = readingMode;
  }, [readingMode]);
  useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);

  // Pulse the page counter badge whenever the active page changes.
  // hasMountedRef prevents firing on the very first render.
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    setPageCounterPulse(true);
    const t = setTimeout(() => setPageCounterPulse(false), 180);
    return () => clearTimeout(t);
  }, [activePage]);

  //
  // MOBILE DETECTION
  //
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 900);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (isMobile) setShowSidebar(false);
  }, [isMobile]);

  //
  // DPR CHANGE — matchMedia, not resize
  //
  useEffect(() => {
    let mql: MediaQueryList | null = null;
    function onDprChange() {
      const newDpr = window.devicePixelRatio || 1;
      if (Math.abs(newDpr - dprRef.current) > 0.01) {
        dprRef.current = newDpr;
        hardResetRenderer();
      }
      mql?.removeEventListener("change", onDprChange);
      mql = matchMedia(`(resolution: ${newDpr}dppx)`);
      mql.addEventListener("change", onDprChange);
    }
    mql = matchMedia(`(resolution: ${dprRef.current}dppx)`);
    mql.addEventListener("change", onDprChange);
    return () => mql?.removeEventListener("change", onDprChange);
  }, []);

  //
  // BLOCK BROWSER PINCH-ZOOM (wheel)
  //
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    stage.addEventListener("wheel", handler, { passive: false });
    return () => stage.removeEventListener("wheel", handler);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const handler = (e: TouchEvent) => {
      if (!pinchRef.current.active || e.touches.length !== 2) return;
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.sqrt(
        (t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2,
      );
      const newZoom = clamp(
        pinchRef.current.startZoom * (dist / pinchRef.current.startDist),
        MIN_ZOOM,
        isMobileRef.current ? MAX_ZOOM_MOBILE : MAX_ZOOM_DESKTOP,
      );
      const rect = stage.getBoundingClientRect();
      const padTop = parseInt(getComputedStyle(stage).paddingTop, 10) || 0;
      const padLeft = parseInt(getComputedStyle(stage).paddingLeft, 10) || 0;
      // Origin is raw scroll-space (no division by zoom) — consistent with onWheel.
      applyLayoutZoom(newZoom, {
        x: pinchRef.current.centerX - rect.left - padLeft + stage.scrollLeft,
        y: pinchRef.current.centerY - rect.top - padTop + stage.scrollTop,
      });
    };

    stage.addEventListener("touchmove", handler, { passive: false });
    return () => stage.removeEventListener("touchmove", handler);
  }, []);

  //
  // ADS
  //
  useEffect(() => {
    fetchAds("sidebar")
      .then(setSidebarAds)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setAdsReady(true), 3000);
    fetchAds("between_pages")
      .then((ads) => {
        betweenAdsRef.current = ads;
        setAdsReady(true);
      })
      .catch(() => setAdsReady(true))
      .finally(() => clearTimeout(timeout));
    return () => clearTimeout(timeout);
  }, []);

  //
  // LOAD / RESET
  //
  useEffect(() => {
    if (!pages.length || !adsReady) return;

    if (initializedPagesRef.current === pages) return;
    initializedPagesRef.current = pages;

    setLoading(true);
    setLoadingPercent(0);

    const total = pages.length;
    setNumPages(total);
    numPagesRef.current = total;
    setActivePage(1);
    activePageRef.current = 1;

    // Reset zoom to 1 so applyFitWidth starts from a known baseline
    zoomRef.current = 1;
    setZoom(1);

    hardResetRenderer();
    requestAnimationFrame(() => renderVisiblePages(1, total));
  }, [pages, adsReady]);

  // DOUBLE-CLICK to zoom

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const handler = (e: MouseEvent) => {
      const rect = stage.getBoundingClientRect();
      const padTop = parseInt(getComputedStyle(stage).paddingTop, 10) || 0;
      const padLeft = parseInt(getComputedStyle(stage).paddingLeft, 10) || 0;
      const originX = e.clientX - rect.left - padLeft + stage.scrollLeft;
      const originY = e.clientY - rect.top - padTop + stage.scrollTop;
      const maxZ = isMobileRef.current ? MAX_ZOOM_MOBILE : MAX_ZOOM_DESKTOP;
      const newZoom =
        zoomRef.current < 1.5 ? clamp(zoomRef.current * 2, MIN_ZOOM, maxZ) : 1;
      applyLayoutZoom(newZoom, { x: originX, y: originY });
      setFitWidth(false);
      fitWidthRef.current = false;
    };
    stage.addEventListener("dblclick", handler);
    return () => stage.removeEventListener("dblclick", handler);
  }, []);

  // HARD RESET

  function hardResetRenderer() {
    imageAbortRef.current.forEach((ac) => ac.abort());
    imageAbortRef.current.clear();
    renderQueueRef.current = [];
    renderingNowRef.current = 0;
    renderingPagesRef.current.clear();
    renderedPagesRef.current.clear();
    loadedPagesRef.current.clear();
    const wrapper = pagesWrapperRef.current;
    if (wrapper) {
      // innerHTML="" removes page wrappers AND their ad siblings in one shot.
      wrapper.innerHTML = "";
    }
  }

  //
  // VIRTUAL RENDERING
  //
  function renderVisiblePages(
    center: number,
    totalPages = numPagesRef.current,
  ) {
    if (!totalPages) return;

    const VWIN = isMobileRef.current
      ? VIRTUAL_WINDOW_MOBILE
      : VIRTUAL_WINDOW_DESKTOP;
    const RBUF = isMobileRef.current
      ? RENDER_BUFFER_MOBILE
      : RENDER_BUFFER_DESKTOP;

    const start = Math.max(1, center - VWIN - RBUF);
    const end = Math.min(totalPages, center + VWIN + RBUF);

    const needed = new Set<number>();
    for (let i = start; i <= end; i++) needed.add(i);

    needed.forEach((p) => {
      if (!renderedPagesRef.current.has(p) && !renderingPagesRef.current.has(p))
        enqueueRender(p);
    });

    // Evict with hard cap
    const allRendered = Array.from(renderedPagesRef.current.keys()).sort(
      (a, b) => a - b,
    );
    let evicted = 0;
    for (const p of allRendered) {
      const farEnough = Math.abs(p - center) > VWIN + EVICT_SAFE_BUFFER;
      const overCap = renderedPagesRef.current.size - evicted > MAX_DOM_PAGES;
      if ((farEnough || overCap) && !renderingPagesRef.current.has(p)) {
        renderQueueRef.current = renderQueueRef.current.filter((q) => q !== p);
        evictPage(p);
        evicted++;
      }
    }
  }

  function evictPage(p: number) {
    const page = renderedPagesRef.current.get(p);
    if (!page) return;
    imageAbortRef.current.get(p)?.abort();
    imageAbortRef.current.delete(p);
    page.element.querySelectorAll("img").forEach((img) => {
      img.src = "";
    });
    const adSibling = pagesWrapperRef.current?.querySelector(
      `[data-ad-after-page="${p}"]`,
    );
    adSibling?.remove();
    page.element.remove();
    renderedPagesRef.current.delete(p);
  }

  function enqueueRender(page: number) {
    if (renderedPagesRef.current.has(page)) return;
    if (
      renderQueueRef.current.includes(page) ||
      renderingPagesRef.current.has(page)
    )
      return;
    renderQueueRef.current.push(page);
    processQueue();
  }

  function processQueue() {
    while (
      renderingNowRef.current < MAX_CONCURRENT_RENDERS &&
      renderQueueRef.current.length
    ) {
      const next = renderQueueRef.current.shift()!;
      renderingNowRef.current++;
      renderPage(next).finally(() => {
        renderingNowRef.current--;
        processQueue();
      });
    }
  }

  //
  // RENDER PAGE
  //
  // ZOOM MODEL: layout-zoom.
  //   wrapper.style.width = naturalWidth × z
  //   img inside is width:100% height:auto  → aspect ratio always preserved
  //   No CSS transform on pages. Scroll-space == layout-space.
  //
  async function renderPage(pageNumber: number) {
    if (
      renderedPagesRef.current.has(pageNumber) ||
      renderingPagesRef.current.has(pageNumber)
    )
      return;

    renderingPagesRef.current.add(pageNumber);

    const url = pages[pageNumber - 1];
    if (!url || !pagesWrapperRef.current) {
      renderingPagesRef.current.delete(pageNumber);
      return;
    }

    const ac = new AbortController();
    imageAbortRef.current.set(pageNumber, ac);

    const img = new Image();
    img.fetchPriority = pageNumber <= 2 ? "high" : "auto";
    img.decoding = "async";
    img.loading = pageNumber <= 4 ? "eager" : "lazy";
    img.draggable = false;
    img.style.pointerEvents = "none";
    img.style.userSelect = "none";

    const loaded = await new Promise<boolean>((resolve) => {
      const done = (ok: boolean) => () => {
        img.onload = null;
        img.onerror = null;
        resolve(ok);
      };
      ac.signal.addEventListener("abort", () => resolve(false), { once: true });
      img.onload = done(true);
      img.onerror = done(false);
      img.src = url;
    });

    imageAbortRef.current.delete(pageNumber);

    if (
      !loaded ||
      !zoomLayerRef.current?.isConnected ||
      !pagesWrapperRef.current
    ) {
      renderingPagesRef.current.delete(pageNumber);
      return;
    }
    if (renderedPagesRef.current.has(pageNumber)) {
      renderingPagesRef.current.delete(pageNumber);
      return;
    }

    // Image fills wrapper width, height is auto (preserves aspect ratio)
    img.style.display = "block";
    img.style.width = "100%";
    img.style.height = "auto";

    const currentZ = zoomRef.current;
    const baseWidth = img.naturalWidth;

    const wrapper = document.createElement("div");
    wrapper.dataset.page = String(pageNumber);
    wrapper.dataset.baseWidth = String(baseWidth);
    wrapper.id = `page-${pageNumber}`;

    wrapper.style.width = `${baseWidth * currentZ}px`;
    wrapper.style.margin = "18px auto";
    wrapper.style.position = "relative";
    wrapper.style.display = "block";
    wrapper.style.borderRadius = "10px";
    wrapper.style.background = "#fff";
    wrapper.style.boxShadow = "0 10px 28px rgba(0,0,0,0.35)";
    wrapper.style.overflow = "hidden";
    wrapper.style.visibility = "hidden";

    wrapper.appendChild(img);

    const VWIN = isMobileRef.current
      ? VIRTUAL_WINDOW_MOBILE
      : VIRTUAL_WINDOW_DESKTOP;
    const RBUF = isMobileRef.current
      ? RENDER_BUFFER_MOBILE
      : RENDER_BUFFER_DESKTOP;
    if (Math.abs(pageNumber - activePageRef.current) > VWIN + RBUF + 2) {
      renderingPagesRef.current.delete(pageNumber);
      return;
    }

    // Register BEFORE setLoading checks so size is accurate
    renderedPagesRef.current.set(pageNumber, {
      pageNumber,
      element: wrapper,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    });

    insertPageSorted(wrapper, pageNumber);
    loadedPagesRef.current.add(pageNumber);

    // Loading progress: target = first 3 pages so bar fills 33%→67%→100%.
    // Double rAF before setLoading(false) ensures React flushes the 100%
    // render first, so the bar is always visibly full before it disappears.
    const loadTarget = Math.min(pages.length, MAX_CONCURRENT_RENDERS);
    const pct = Math.min(
      100,
      Math.round((loadedPagesRef.current.size / loadTarget) * 100),
    );
    setLoadingPercent(pct);
    if (loadedPagesRef.current.size >= loadTarget) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setLoading(false)),
      );
    }

    // Fit width when page 1 arrives — double rAF for layout stability.
    // applyFitWidth calls applyLayoutZoom which resizes ALL rendered pages,
    // so any pages that arrived before page 1 get corrected as well.
    if (pageNumber === 1) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (fitWidthRef.current) applyFitWidth();
        }),
      );
    }

    if (pageNumber % 2 === 0 && betweenAdsRef.current.length > 0) {
      const adIndex = Math.floor(
        (pageNumber / 2 - 1) % betweenAdsRef.current.length,
      );
      const ad = betweenAdsRef.current[adIndex];
      if (ad) {
        const adEl = document.createElement("div");
        adEl.dataset.adAfterPage = String(pageNumber);
        adEl.style.cssText =
          "margin:0 auto 18px;max-width:800px;text-align:center;";
        const imgAd = document.createElement("img");
        imgAd.src = ad.image;
        imgAd.style.cssText =
          "display:block;max-width:100%;height:auto;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.35);margin:0 auto;";
        adEl.appendChild(imgAd);
        wrapper.after(adEl); // sibling after the page, not a child inside it
      }
    }

    requestAnimationFrame(() => {
      wrapper.style.visibility = "visible";
    });
    renderingPagesRef.current.delete(pageNumber);
  }

  function insertPageSorted(el: HTMLDivElement, page: number) {
    const layer = pagesWrapperRef.current;
    if (!layer) return;
    for (const n of Array.from(layer.children)) {
      const dataPage = Number((n as HTMLElement).dataset.page);
      // Skip ad-sibling elements — they have data-ad-after-page, not data-page.
      if (dataPage && dataPage > page) {
        layer.insertBefore(el, n);
        return;
      }
    }
    layer.appendChild(el);
  }

  //
  // FIT WIDTH
  //
  function applyFitWidth() {
    const stage = stageRef.current;
    if (!stage) return;

    // Prefer page 1 as reference; fall back to first available
    const p1 =
      renderedPagesRef.current.get(1)?.element ??
      (renderedPagesRef.current.values().next().value?.element as
        | HTMLDivElement
        | undefined);
    if (!p1) return;

    const baseWidth = Number(p1.dataset.baseWidth);
    if (!baseWidth) return;

    const padX = getZoomLayerPaddingX();
    // clientWidth already excludes the scrollbar — no extra subtraction needed.
    const usable = stage.clientWidth - padX;
    const target = Math.max(MIN_ZOOM, usable / baseWidth);

    stage.scrollLeft = 0;
    applyLayoutZoom(target);
  }

  function toggleFitWidth() {
    const next = !fitWidth;
    setFitWidth(next);
    fitWidthRef.current = next;
    if (next) requestAnimationFrame(() => applyFitWidth());
  }

  useEffect(() => {
    if (!fitWidth) return;
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => applyFitWidth(), RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
    };
  }, [fitWidth]);

  //
  // FULLSCREEN
  //
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setReadingMode(false);
        readingModeRef.current = false;
        setUiVisible(true);
        if (!isMobileRef.current) setShowSidebar(true);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  //
  // ACTIVE PAGE TRACKING
  //
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let ticking = false;

    const handler = () => {
      const rendered = renderedPagesRef.current;
      if (!rendered.size) return;

      // Compute the true centre of the visible content area, excluding
      // the stage's own paddingTop/paddingBottom so the anchor is accurate.
      const _padTop = parseInt(getComputedStyle(stage).paddingTop, 10) || 0;
      const _padBot = parseInt(getComputedStyle(stage).paddingBottom, 10) || 0;
      const contentAreaH = stage.clientHeight - _padTop - _padBot;
      const viewportMid = stage.scrollTop + _padTop + contentAreaH / 2;
      const stageRect = stage.getBoundingClientRect();

      let bestPage = activePageRef.current;
      let bestDist = Infinity;

      for (const { element: el } of rendered.values()) {
        if (!el.isConnected) continue;
        const elRect = el.getBoundingClientRect();
        const pageCenter =
          stage.scrollTop + (elRect.top - stageRect.top) + elRect.height / 2;
        const dist = Math.abs(pageCenter - viewportMid);
        if (dist < bestDist) {
          bestDist = dist;
          bestPage = Number(el.dataset.page);
        }
      }

      if (bestPage !== activePageRef.current) {
        setActivePage(bestPage);
        activePageRef.current = bestPage;
        document
          .getElementById(`thumb-${bestPage}`)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        renderVisiblePages(bestPage, numPagesRef.current);
      }
    };

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handler();
          ticking = false;
        });
        ticking = true;
      }
    };

    stage.addEventListener("scroll", onScroll, { passive: true });
    return () => stage.removeEventListener("scroll", onScroll);
  }, []);

  //
  // NAVIGATION
  //
  async function goToPage(page: number) {
    const total = numPagesRef.current;
    if (!total) return;
    const safe = Math.max(1, Math.min(total, page));
    const stage = stageRef.current;
    if (!stage) return;

    renderVisiblePages(safe, total);

    let el = renderedPagesRef.current.get(safe)?.element ?? null;
    if (!el) {
      await renderPage(safe);
      el =
        pagesWrapperRef.current?.querySelector<HTMLDivElement>(
          `#page-${safe}`,
        ) ?? null;
    }
    if (!el) return;

    const padTop = getZoomLayerPaddingTop();
    const stageRect = stage.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetTop = stage.scrollTop + (elRect.top - stageRect.top) - padTop;
    stage.scrollTo({ top: targetTop, behavior: "smooth" });
  }

  function nextPage() {
    goToPage(activePageRef.current + 1);
  }
  function prevPage() {
    goToPage(activePageRef.current - 1);
  }

  // KEYBOARD
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowLeft")
        nextPage(); // Urdu: left = forward
      else if (e.key === "ArrowRight") prevPage();
      else if (e.key === "Escape" && readingModeRef.current) exitReadingMode();
      else if (e.key === "Home") goToPage(1);
      else if (e.key === "End") goToPage(numPagesRef.current);
      else if (e.key === "0") {
        setFitWidth(false);
        fitWidthRef.current = false;
        applyLayoutZoom(1);
      } else if (e.key.toLowerCase() === "f") {
        setFitWidth(true);
        fitWidthRef.current = true;
        requestAnimationFrame(() => applyFitWidth());
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function applyLayoutZoom(newZoom: number, origin?: { x: number; y: number }) {
    const stage = stageRef.current;
    if (!stage) return;

    const prevZoom = zoomRef.current;

    const maxZ = isMobileRef.current ? MAX_ZOOM_MOBILE : MAX_ZOOM_DESKTOP;
    const z = clamp(newZoom, MIN_ZOOM, maxZ);
    if (z === prevZoom) return;

    const ratio = z / prevZoom;

    // Snapshot scroll values BEFORE any DOM changes.
    const oldScrollLeft = stage.scrollLeft;
    const oldScrollTop = stage.scrollTop;

    // Origin in raw scroll-space.
    // Default to the visual centre of the content area (excluding stage padding)
    // so button-triggered zoom anchors correctly rather than drifting toward the
    // padded edges.
    const _sPadTop = parseInt(getComputedStyle(stage).paddingTop, 10) || 0;
    const _sPadLeft = parseInt(getComputedStyle(stage).paddingLeft, 10) || 0;
    const _sPadBot = parseInt(getComputedStyle(stage).paddingBottom, 10) || 0;
    const _contentW = stage.clientWidth - _sPadLeft;
    const _contentH = stage.clientHeight - _sPadTop - _sPadBot;
    const originX = origin?.x ?? oldScrollLeft + _sPadLeft + _contentW / 2;
    const originY = origin?.y ?? oldScrollTop + _sPadTop + _contentH / 2;

    zoomRef.current = z;
    setZoom(z);

    // Resize all rendered pages. This changes DOM layout — page heights change
    // because img is width:100% height:auto. Browser reflows on next paint.
    renderedPagesRef.current.forEach(({ element }) => {
      const baseWidth = Number(element.dataset.baseWidth);
      if (baseWidth) element.style.width = `${baseWidth * z}px`;
    });

    const newScrollLeft = Math.max(
      0,
      originX * ratio - (originX - oldScrollLeft),
    );
    const newScrollTop = Math.max(
      0,
      originY * ratio - (originY - oldScrollTop),
    );
    requestAnimationFrame(() => {
      const s = stageRef.current;
      if (!s) return;
      s.scrollLeft = newScrollLeft;
      s.scrollTop = newScrollTop;
    });
  }

  //
  // WHEEL ZOOM (Ctrl + scroll)
  //
  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const rect = stage.getBoundingClientRect();
    const padTop = parseInt(getComputedStyle(stage).paddingTop, 10) || 0;
    const padLeft = parseInt(getComputedStyle(stage).paddingLeft, 10) || 0;

    const originX = e.clientX - rect.left - padLeft + stage.scrollLeft;
    const originY = e.clientY - rect.top - padTop + stage.scrollTop;

    const maxZ = isMobileRef.current ? MAX_ZOOM_MOBILE : MAX_ZOOM_DESKTOP;
    applyLayoutZoom(
      clamp(zoomRef.current * (e.deltaY > 0 ? 0.92 : 1.08), MIN_ZOOM, maxZ),
      { x: originX, y: originY },
    );
    setFitWidth(false);
    fitWidthRef.current = false;
  }

  //
  // DRAG PAN
  //
  function onPointerDown(e: React.PointerEvent) {
    const stage = stageRef.current;
    if (!stage || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, select")) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: stage.scrollLeft,
      startScrollTop: stage.scrollTop,
    };
    setIsDragging(true);
    stage.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const stage = stageRef.current;
    if (!stage || !dragRef.current.active) return;
    stage.scrollLeft =
      dragRef.current.startScrollLeft - (e.clientX - dragRef.current.startX);
    stage.scrollTop =
      dragRef.current.startScrollTop - (e.clientY - dragRef.current.startY);
  }

  function onPointerUp(e: React.PointerEvent) {
    dragRef.current.active = false;
    setIsDragging(false);
    try {
      stageRef.current?.releasePointerCapture(e.pointerId);
    } catch {}
  }

  //
  // PINCH ZOOM (touch start / end — move is handled by the DOM listener above)
  //
  function touchDist(t1: React.Touch, t2: React.Touch) {
    return Math.sqrt(
      (t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2,
    );
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 2) return;
    const [t1, t2] = [e.touches[0], e.touches[1]];
    pinchRef.current = {
      active: true,
      startDist: touchDist(t1, t2),
      startZoom: zoomRef.current,
      centerX: (t1.clientX + t2.clientX) / 2,
      centerY: (t1.clientY + t2.clientY) / 2,
    };

    dragRef.current.active = false;
    setIsDragging(false);
    setFitWidth(false);
    fitWidthRef.current = false;
  }

  // onTouchMove intentionally omitted from JSX — handled by the non-passive
  // DOM listener registered in the useEffect above.

  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchRef.current.active = false;
  }

  //
  // DOUBLE TAP
  //
  function onTap(pos: { x: number; y: number }) {
    if (!isMobileRef.current) return;
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const padTop = parseInt(getComputedStyle(stage).paddingTop, 10) || 0;
      const padLeft = parseInt(getComputedStyle(stage).paddingLeft, 10) || 0;
      const maxZ = isMobileRef.current ? MAX_ZOOM_MOBILE : MAX_ZOOM_DESKTOP;
      applyLayoutZoom(zoomRef.current < 1.5 ? clamp(2, MIN_ZOOM, maxZ) : 1, {
        // Origin is raw scroll-space — consistent with onWheel / dblclick.
        x: pos.x - rect.left - padLeft + stage.scrollLeft,
        y: pos.y - rect.top - padTop + stage.scrollTop,
      });
      setFitWidth(false);
      fitWidthRef.current = false;
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }

  //
  // READING MODE
  //
  async function enterReadingMode() {
    setReadingMode(true);
    readingModeRef.current = true;
    setUiVisible(false);
    setShowSidebar(false);
    setFitWidth(true);
    fitWidthRef.current = true;
    requestAnimationFrame(() => requestAnimationFrame(() => applyFitWidth()));
    try {
      await document.documentElement.requestFullscreen();
    } catch {}
  }

  async function exitReadingMode() {
    setReadingMode(false);
    readingModeRef.current = false;
    setUiVisible(true);
    if (!isMobileRef.current) setShowSidebar(true);
    setFitWidth(false);
    fitWidthRef.current = false;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {}
  }

  function onMobileTopZoneTap() {
    if (!isMobileRef.current || readingModeRef.current) return;
    setUiVisible((v) => !v);
  }

  const scalePercent = Math.round(zoom * 100);

  //
  // RENDER
  //
  return (
    <div
      ref={rootRef}
      style={{
        display: "flex",
        height: "100vh",
        background: readingMode ? "#000" : "linear-gradient(#1c1c1c, #141414)",
        color: "#fff",
        fontFamily: uiFont,
        overflow: "hidden",
      }}
    >
      {/*  SIDEBAR  */}
      {showSidebar && uiVisible && (
        <div
          style={{
            width: 190,
            overflowY: "auto",
            background: "rgba(20,20,20,0.55)",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            padding: 12,
            backdropFilter: "blur(10px)",
          }}
        >
          {(thumbnailPages ?? []).map((thumb, index) => {
            const p = index + 1;
            const active = p === activePage;
            return (
              <React.Fragment key={p}>
                <div style={{ marginBottom: 14 }}>
                  <img
                    id={`thumb-${p}`}
                    src={thumb}
                    loading="lazy"
                    decoding="async"
                    onClick={() => goToPage(p)}
                    style={{
                      width: "100%",
                      cursor: "pointer",
                      borderRadius: 14,
                      border: "none",
                      opacity: active ? 1 : 0.35,
                      transform: active ? "scale(1.02)" : "scale(1)",
                      boxShadow: active
                        ? "0 0 0 2px rgba(255,255,255,0.18), 0 18px 40px rgba(0,0,0,0.55)"
                        : "0 6px 18px rgba(0,0,0,0.30)",
                      transition:
                        "transform 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease",
                      background: "#0b0b0b",
                    }}
                  />
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      opacity: active ? 0.95 : 0.5,
                      textAlign: "center",
                    }}
                  >
                    {p}
                  </div>
                </div>
                {(index + 1) % 3 === 0 && sidebarAds.length > 0 && (
                  <div
                    style={{
                      marginBottom: 18,
                      padding: 6,
                      background: "#fff",
                      borderRadius: 10,
                    }}
                  >
                    <img
                      src={
                        sidebarAds[Math.floor(index / 3) % sidebarAds.length]
                          .image
                      }
                      style={{
                        width: "100%",
                        display: "block",
                        borderRadius: 8,
                      }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/*  MAIN  */}
      <div style={{ flex: 1, position: "relative" }}>
        {isMobile && !readingMode && (
          <div
            onClick={onMobileTopZoneTap}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 70,
              zIndex: 100,
            }}
          />
        )}

        {/* TOP BAR */}
        {(uiVisible || readingMode) && (
          <div
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              right: 14,
              zIndex: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                pointerEvents: "auto",
              }}
            >
              {!isMobile && !readingMode && (
                <button
                  onClick={() => setShowSidebar((s) => !s)}
                  style={miniBtn}
                  title="Toggle thumbnails"
                >
                  ☰
                </button>
              )}
              <div
                style={{
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(10px)",
                  padding: "8px 12px",
                  borderRadius: 999,
                  fontSize: 13,
                  opacity: 0.92,
                  transition: "opacity 120ms ease, transform 120ms ease",
                  transform: pageCounterPulse ? "scale(1.02)" : "scale(1)",
                }}
              >
                <span style={{ fontFamily: urduFont, marginRight: 6 }}>
                  صفحہ
                </span>
                <span style={{ fontWeight: 700 }}>{activePage}</span>
                <span style={{ opacity: 0.7 }}> / {numPages || "-"}</span>
              </div>
            </div>

            <div
              style={{
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => {
                    setFitWidth(false);
                    fitWidthRef.current = false;
                    applyLayoutZoom(
                      clamp(zoomRef.current * 0.9, MIN_ZOOM, MAX_ZOOM),
                    );
                  }}
                  style={miniBtn}
                  title="Zoom out"
                >
                  −
                </button>

                <select
                  value={closestPreset(scalePercent, zoomPresets)}
                  onChange={(e) => {
                    setFitWidth(false);
                    fitWidthRef.current = false;
                    applyLayoutZoom(Number(e.target.value) / 100);
                  }}
                  style={miniSelect}
                >
                  {zoomPresets.map((z) => (
                    <option key={z} value={z}>
                      {z}%
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    setFitWidth(false);
                    fitWidthRef.current = false;
                    applyLayoutZoom(
                      clamp(zoomRef.current * 1.1, MIN_ZOOM, MAX_ZOOM),
                    );
                  }}
                  style={miniBtn}
                  title="Zoom in"
                >
                  +
                </button>
              </div>

              <div
                style={{
                  width: 1,
                  height: 22,
                  background: "rgba(255,255,255,0.08)",
                }}
              />

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={toggleFitWidth}
                  style={miniBtn}
                  title={fitWidth ? "Exit fit width" : "Fit width"}
                >
                  ↔
                </button>
                {!readingMode ? (
                  <button
                    onClick={enterReadingMode}
                    style={miniBtn}
                    title="Reading mode"
                  >
                    ⛶
                  </button>
                ) : (
                  <button
                    onClick={exitReadingMode}
                    style={miniBtn}
                    title="Exit reading mode"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LOADING */}
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 55,
              flexDirection: "column",
              gap: 12,
              background: "rgba(0,0,0,0.25)",
              backdropFilter: "blur(4px)",
            }}
          >
            <div style={{ fontSize: 14, opacity: 0.9 }}>Loading newspaper…</div>
            <div
              style={{
                width: 280,
                height: 7,
                background: "rgba(255,255,255,0.10)",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${loadingPercent}%`,
                  height: "100%",
                  background: "rgba(26,115,232,0.95)",
                  transition: "width 200ms linear",
                }}
              />
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{loadingPercent}%</div>
          </div>
        )}

        {/*
          STAGE — the scrollable viewport.

          zoomLayer: provides padding around pages. display is default (block),
          no transform, no will-change.

          pagesWrapper: display:block is REQUIRED.
            - Each page div has margin:auto which centres it within the block container.
            - The block container naturally stretches to the widest child, so all
              pages center correctly even when they have different natural widths.
            - flex layout would break this: flex-start means no centering, flex
              center fights the zoom model.
        */}
        <div
          ref={stageRef}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTouchStart={onTouchStart}
          onTouchEnd={(e) => {
            const wasPinching = pinchRef.current.active;
            const touch = e.changedTouches?.[0];
            onTouchEnd(e);
            if (!wasPinching && touch)
              onTap({ x: touch.clientX, y: touch.clientY });
          }}
          style={{
            position: "absolute",
            inset: 0,
            overflowX: "auto",
            overflowY: "auto",
            willChange: "scroll-position",
            paddingTop: readingMode ? 0 : 70,
            paddingBottom: readingMode ? 0 : 40,
            background: "transparent",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "none",
            touchAction: "pan-x pan-y",
            cursor: isDragging ? "grabbing" : "grab",
          }}
        >
          <div
            ref={zoomLayerRef}
            style={{ padding: readingMode ? "0" : "20px 24px" }}
          >
            <div ref={pagesWrapperRef} style={{ display: "block" }} />
          </div>
        </div>

        {/* BOTTOM BAR */}
        {!readingMode && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 16,
              display: "flex",
              justifyContent: "center",
              zIndex: 70,
              pointerEvents: "none",
              opacity: uiVisible ? 1 : 0,
              transform: uiVisible ? "translateY(0)" : "translateY(10px)",
              transition: "opacity 200ms ease, transform 200ms ease",
            }}
          >
            <div
              style={{
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: 18,
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
                padding: "10px 16px",
                borderRadius: 999,
              }}
            >
              <button
                onClick={nextPage}
                title="Next page"
                style={bottomBtn}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
              >
                ← <span style={{ fontFamily: urduFont }}>اگلا</span>
              </button>
              <div
                style={{
                  fontSize: 13,
                  opacity: 0.85,
                  minWidth: 130,
                  textAlign: "center",
                }}
              >
                <span style={{ fontFamily: urduFont }}>صفحہ</span>{" "}
                <span style={{ fontWeight: 700 }}>{activePage}</span>{" "}
                <span style={{ opacity: 0.7 }}>of {numPages || "-"}</span>
              </div>
              <button
                onClick={prevPage}
                title="Previous page"
                style={bottomBtn}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
              >
                <span style={{ fontFamily: urduFont }}>پچھلا</span> →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

//  HELPERS

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function closestPreset(value: number, presets: number[]) {
  return presets.reduce(
    (best, p) => (Math.abs(p - value) < Math.abs(best - value) ? p : best),
    presets[0],
  );
}

//  STYLES

const miniBtn: React.CSSProperties = {
  height: 34,
  minWidth: 34,
  padding: "0 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.35)",
  color: "#fff",
  fontSize: 13,
  cursor: "pointer",
  backdropFilter: "blur(10px)",
};

const miniSelect: React.CSSProperties = {
  height: 34,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.35)",
  color: "#fff",
  padding: "0 12px",
  cursor: "pointer",
  backdropFilter: "blur(10px)",
  outline: "none",
};

const bottomBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#fff",
  cursor: "pointer",
  fontSize: 13,
  opacity: 0.7,
  transition: "opacity 0.2s ease",
  padding: "6px 10px",
};
