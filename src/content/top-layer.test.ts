import { placeHostInTopLayer } from './top-layer';

describe('placeHostInTopLayer', () => {
  it('opens the extension host as a manual popover', () => {
    const host = document.createElement('div');
    let opened = false;
    Object.defineProperty(host, 'showPopover', {
      configurable: true,
      value: () => { opened = true; },
    });
    const originalMatches = host.matches.bind(host);
    vi.spyOn(host, 'matches').mockImplementation((selector) => {
      if (selector === ':popover-open') return opened;
      return originalMatches(selector);
    });

    expect(placeHostInTopLayer(host)).toBe(true);
    expect(host.getAttribute('popover')).toBe('manual');
    expect(host.parentElement).toBe(document.documentElement);
  });

  it('keeps working in browsers without the Popover API', () => {
    const host = document.createElement('div');
    Object.defineProperty(host, 'showPopover', { configurable: true, value: undefined });
    expect(placeHostInTopLayer(host)).toBe(false);
    expect(host.parentElement).toBe(document.documentElement);
  });

  it('reopens an existing popover so it returns to the front of the top layer', () => {
    const host = document.createElement('div');
    let opened = true;
    const calls: string[] = [];
    Object.defineProperties(host, {
      hidePopover: {
        configurable: true,
        value: () => { calls.push('hide'); opened = false; },
      },
      showPopover: {
        configurable: true,
        value: () => { calls.push('show'); opened = true; },
      },
    });
    const originalMatches = host.matches.bind(host);
    vi.spyOn(host, 'matches').mockImplementation((selector) => {
      if (selector === ':popover-open') return opened;
      return originalMatches(selector);
    });

    expect(placeHostInTopLayer(host)).toBe(true);
    expect(calls).toEqual(['hide', 'show']);
  });
});
