import "@testing-library/jest-dom/vitest";
import { setIpcClient } from "@/lib/ipc";
import { createMockIpcClient } from "@/testing/mock-ipc";

setIpcClient(createMockIpcClient());

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverMock {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element) {
    this.callback(
      [
        {
          target,
          isIntersecting: true,
          intersectionRatio: 1,
          time: 0,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRect: target.getBoundingClientRect(),
          rootBounds: null,
        } as IntersectionObserverEntry,
      ],
      this,
    );
  }

  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: () => null,
});

Object.defineProperty(Element.prototype, "scrollIntoView", {
  configurable: true,
  value: () => {},
});

Object.assign(window, {
  ResizeObserver: ResizeObserverMock,
  IntersectionObserver: IntersectionObserverMock,
  requestIdleCallback: (
    callback: IdleRequestCallback,
    _options?: IdleRequestOptions,
  ) =>
    window.setTimeout(
      () =>
        callback({
          didTimeout: false,
          timeRemaining: () => 50,
        }),
      0,
    ),
  cancelIdleCallback: (id: number) => window.clearTimeout(id),
  confirm: () => true,
});
