import { annotationsToMarkdown, captureRegion, createFullPath, createSelector, describeAccessibility } from './element-context';
import type { Annotation } from './types';

describe('element context', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('uses a unique id as the shortest selector', () => {
    document.body.innerHTML = '<main><button id="save-profile">저장</button></main>';
    const button = document.querySelector('button')!;
    expect(createSelector(button)).toBe('#save-profile');
  });

  it('prefers stable testing attributes over structural selectors', () => {
    document.body.innerHTML = '<main><button data-testid="checkout">결제</button><button>취소</button></main>';
    const button = document.querySelector('button')!;
    expect(createSelector(button)).toBe('[data-testid="checkout"]');
  });

  it('creates an unambiguous structural selector for repeated elements', () => {
    document.body.innerHTML = '<main><section><button>첫 번째</button><button>두 번째</button></section></main>';
    const button = document.querySelectorAll('button')[1]!;
    expect(createSelector(button)).toContain('button:nth-of-type(2)');
    expect(document.querySelector(createSelector(button))).toBe(button);
    expect(createFullPath(button)).toContain('html > body > main');
  });

  it('describes implicit roles and accessible names without React metadata', () => {
    document.body.innerHTML = '<button aria-pressed="true">메뉴 열기</button>';
    expect(describeAccessibility(document.querySelector('button')!)).toBe('role=button; name="메뉴 열기"; pressed=true');
  });
});

describe('annotationsToMarkdown', () => {
  it('formats annotations in creation order with agent-readable context', () => {
    const base: Annotation = {
      id: 'second',
      url: 'https://example.com/products',
      pageTitle: '상품',
      createdAt: 20,
      comment: '간격을 줄여주세요.',
      priority: 'normal',
      element: 'button',
      selector: '#buy',
      fullPath: 'html > body > button#buy',
      cssClasses: 'primary',
      nearbyText: '구매하기',
      boundingBox: { x: 20, y: 30, width: 100, height: 40 },
      accessibility: 'role=button; name="구매하기"',
      computedStyles: 'display: block;',
    };
    const first = { ...base, id: 'first', createdAt: 10, comment: '문구를 바꿔주세요.', selector: '#first' };
    const output = annotationsToMarkdown([base, first]);
    expect(output).toContain('## UI 피드백: 상품');
    expect(output).toContain('주석 수: 2');
    expect(output.indexOf('#first')).toBeLessThan(output.indexOf('#buy'));
    expect(output).toContain('```css\ndisplay: block;\n```');
  });

  it('records a dragged screen region as an annotation with its exact coordinates', () => {
    document.title = '영역 테스트';
    const annotation = captureRegion(
      { x: 120, y: 340, width: 280, height: 160 },
      '이 카드 묶음의 여백을 줄여주세요.',
      'high',
    );

    expect(annotation.targetType).toBe('region');
    expect(annotation.element).toBe('드래그 영역');
    expect(annotation.boundingBox).toEqual({ x: 120, y: 340, width: 280, height: 160 });
    expect(annotationsToMarkdown([annotation])).toContain('위치: x=120, y=340, width=280, height=160');
  });
});
