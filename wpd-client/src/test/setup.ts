import { vi } from 'vitest';

const noop = () => {};
const gradient = { addColorStop: noop };

const context2dStub = new Proxy(
  {
    canvas: null,
    measureText: () => ({ width: 0 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    setLineDash: noop,
  } as Record<string, unknown>,
  {
    get(target, property) {
      if (property in target) {
        return target[property as keyof typeof target];
      }
      return noop;
    },
    set(target, property, value) {
      target[property as keyof typeof target] = value;
      return true;
    },
  }
);

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn(() => context2dStub),
});
