import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Dialog } from './LensApp';

describe('Dialog', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalShowModal: PropertyDescriptor | undefined;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShowModal);
    else delete (HTMLDialogElement.prototype as { showModal?: unknown }).showModal;
  });

  it('opens a native modal dialog so a page modal cannot block its text inputs', () => {
    const showModal = vi.fn();
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: showModal,
    });

    act(() => {
      root.render(
        <Dialog
          title="선택한 버튼"
          labelledBy="dialog-title"
          returnFocusRef={createRef<HTMLButtonElement>()}
          onClose={vi.fn()}
        >
          <textarea aria-label="주석" />
        </Dialog>,
      );
    });

    expect(container.querySelector('dialog')).not.toBeNull();
    expect(showModal).toHaveBeenCalledTimes(1);
  });
});
