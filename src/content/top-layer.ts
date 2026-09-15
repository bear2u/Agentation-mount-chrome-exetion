export function placeHostInTopLayer(host: HTMLElement): boolean {
  host.setAttribute('popover', 'manual');
  if (!host.isConnected) document.documentElement.append(host);

  if (typeof host.showPopover !== 'function') return false;

  try {
    // Reinsert an already-open popover at the end of the browser top layer.
    // This keeps the picker above a native <dialog> that opened later.
    if (host.matches(':popover-open')) host.hidePopover();
    host.showPopover();
    return host.matches(':popover-open');
  } catch {
    return false;
  }
}
