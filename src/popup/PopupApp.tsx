import { useState } from 'react';
import { CrosshairIcon } from '../shared/icons';

type Status = 'idle' | 'loading' | 'error';

export function PopupApp() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  const openLens = async () => {
    setStatus('loading');
    setMessage('');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id || !tab.url || !/^https?:\/\//.test(tab.url)) {
        throw new Error('일반 웹페이지에서만 사용할 수 있습니다.');
      }
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
      window.close();
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : '이 페이지에서 도구를 열 수 없습니다.');
    }
  };

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div className="brand-mark" aria-hidden="true"><CrosshairIcon /></div>
        <div>
          <p className="eyebrow">UI ANNOTATION</p>
          <h1>Component Lens</h1>
        </div>
      </header>

      <p className="intro">
        화면의 요소를 가리키고 피드백을 남기세요. 프레임워크와 관계없이 AI가 찾을 수 있는 문맥으로 정리합니다.
      </p>

      <button
        className="primary-button"
        type="button"
        onClick={openLens}
        disabled={status === 'loading'}
        aria-busy={status === 'loading'}
      >
        <CrosshairIcon />
        {status === 'loading' ? '도구 여는 중' : '현재 페이지에서 시작'}
      </button>

      {status === 'error' && <p className="error-message" role="alert">{message}</p>}

      <footer>
        현재 탭에만 접근하며 주석은 브라우저에 로컬 저장됩니다.
      </footer>
    </main>
  );
}
