import { createRoot } from 'react-dom/client';
import { captureElement } from '../shared/element-context';
import { LensApp } from './LensApp';
import styles from './content.css?inline';

declare global {
  interface Window {
    __componentLens?: { open: () => void };
  }
}

function mountLens(): void {
  if (window.__componentLens) {
    window.__componentLens.open();
    return;
  }

  const host = document.createElement('div');
  host.id = 'component-lens-extension-root';
  host.setAttribute('data-component-lens-root', '');
  document.documentElement.append(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const sheet = document.createElement('style');
  sheet.textContent = styles;
  const mountPoint = document.createElement('div');
  shadow.append(sheet, mountPoint);

  let openRequest: () => void = () => undefined;
  let queuedOpen = true;
  createRoot(mountPoint).render(
    <LensApp
      extensionHost={host}
      capture={captureElement}
      registerOpen={(handler) => {
        openRequest = handler;
        if (queuedOpen) {
          queuedOpen = false;
          queueMicrotask(openRequest);
        }
      }}
    />,
  );

  window.__componentLens = { open: () => openRequest() };

  chrome.runtime.onMessage.addListener((message: { type?: string }) => {
    if (message.type === 'COMPONENT_LENS_OPEN' || message.type === 'COMPONENT_LENS_TOGGLE') {
      window.__componentLens?.open();
    }
  });
}

mountLens();
