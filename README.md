# Component Lens

웹페이지 위에서 요소를 선택하고 코멘트를 남긴 뒤, AI 코딩 도구가 이해할 수 있는 Markdown으로 복사하는 Chrome/Edge 확장 프로그램입니다. 확장 프로그램 UI만 React로 구현되어 있으며 대상 페이지는 React, Vue, Svelte, 서버 렌더링 HTML 등 어떤 프레임워크여도 사용할 수 있습니다.

Agentation과 비슷한 시각적 피드백 흐름을 특정 React 프로젝트에 코드를 삽입하지 않고 일반 웹페이지에서 사용할 수 있도록 만든 독립 확장 프로그램입니다.

## 주요 기능

- 마우스 hover로 요소 경계와 간단한 이름 표시
- 요소별 코멘트와 우선순위 기록
- CSS selector, 전체 DOM 경로, 좌표, 크기, 클래스, 주변 텍스트 수집
- 접근성 role/name/state와 주요 computed style 수집
- 페이지에 번호 마커 표시
- 모든 주석을 구조화된 Markdown으로 복사
- CSS 애니메이션, transition, 미디어 일시정지
- 페이지 URL별 로컬 저장
- Shadow DOM 격리로 대상 사이트 스타일과 충돌 방지
- 네이티브 `<dialog>` 등 브라우저 top layer 팝업 위에서도 요소 선택

## 빠른 설치

1. 저장소의 `component-lens-extension.zip`을 내려받아 압축을 풉니다.
2. Chrome에서 `chrome://extensions`를 엽니다.
3. 우측 상단의 개발자 모드를 켭니다.
4. `압축해제된 확장 프로그램을 로드합니다`를 누릅니다.
5. 압축을 푼 경로 안의 `dist` 폴더를 선택합니다.

소스에서 직접 빌드하려면 다음 절차를 사용합니다.

## 빌드

```bash
git clone git@github.com:bear2u/Agentation-mount-chrome-exetion.git
cd Agentation-mount-chrome-exetion
pnpm install
pnpm test
pnpm build
```

빌드 결과는 `dist/`에 생성됩니다.

## Chrome에 설치

1. Chrome에서 `chrome://extensions`를 엽니다.
2. 우측 상단의 개발자 모드를 켭니다.
3. `압축해제된 확장 프로그램을 로드합니다`를 누릅니다.
4. 이 프로젝트의 `dist` 폴더를 선택합니다.
5. 주석을 남길 웹페이지에서 Component Lens 아이콘을 누르고 `현재 페이지에서 시작`을 선택합니다.

Chrome 내부 페이지, Chrome Web Store, 브라우저 설정 페이지에는 보안 정책상 스크립트를 주입할 수 없습니다.

기존 버전을 이미 로드했다면 빌드 후 `chrome://extensions`의 Component Lens 카드에서 새로고침 버튼을 누르고, 테스트할 웹페이지도 새로고침해야 변경된 콘텐츠 스크립트가 적용됩니다.

## 사용법

1. `요소 선택` 상태에서 페이지 요소를 클릭합니다.
2. 원하는 변경사항과 우선순위를 입력하고 `주석 추가`를 누릅니다.
3. 필요한 요소를 계속 선택합니다.
4. `전체 복사`를 눌러 Markdown을 복사한 뒤 Codex, Claude Code 또는 다른 AI 도구에 붙여넣습니다.

`Esc`를 누르면 요소 선택 모드가 꺼집니다. 휴지통 버튼은 현재 URL에 저장된 모든 주석을 삭제합니다.

## 범위와 제한

DOM 기반 문맥은 모든 일반 웹페이지에서 수집됩니다. React 컴포넌트명과 소스 파일/줄 번호는 브라우저 확장만으로 안정적으로 얻을 수 없으므로 현재 버전은 포함하지 않습니다. 이를 추가하려면 개발 서버의 source map 또는 프레임워크별 빌드 플러그인과 연동해야 합니다.

- Chrome 내부 페이지, Chrome Web Store, 브라우저 설정 페이지에서는 동작하지 않습니다.
- 교차 출처 iframe 내부 요소는 브라우저 보안 정책 때문에 선택할 수 없습니다.
- SPA에서 URL이 바뀐 뒤에는 확장 도구를 다시 열면 새 페이지 기준으로 주석을 관리할 수 있습니다.

## 권한과 개인정보

| 권한 | 사용 목적 |
| --- | --- |
| `activeTab` | 사용자가 확장 아이콘을 누른 현재 탭에만 임시 접근 |
| `scripting` | 선택 도구를 현재 페이지에 주입 |
| `storage` | URL별 주석을 브라우저 로컬 저장소에 보관 |
| `clipboardWrite` | 구조화된 Markdown을 클립보드에 복사 |

수집한 내용은 외부 서버로 전송하지 않습니다. 광범위한 `<all_urls>` 호스트 권한도 요청하지 않습니다.

## 프로젝트 구조

```text
public/manifest.json             Manifest V3 설정
src/popup/                       확장 팝업 React UI
src/content/                     페이지 위에 표시되는 React 주석 도구
src/shared/                      selector, 문맥 수집, Markdown 변환
scripts/verify-content-bundle.mjs 브라우저 비호환 전역 검사
tests/fixtures/                  콘텐츠 스크립트 브라우저 재현 페이지
```

## 검증

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm audit --audit-level high
```

`pnpm build`는 콘텐츠 번들에 브라우저에서 지원하지 않는 Node 런타임 전역이 남았는지도 함께 검사합니다.

## 문제 해결

### 확장 아이콘을 눌러도 도구가 나타나지 않을 때

1. `chrome://extensions`에서 Component Lens를 새로고침합니다.
2. 대상 웹페이지를 새로고침합니다.
3. 대상 주소가 `http://` 또는 `https://`로 시작하는 일반 웹페이지인지 확인합니다.

### `process is not defined` 또는 React hook 관련 소스가 표시될 때

이전 `0.1.0` 빌드가 남아 있는 상태입니다. 최신 소스를 빌드하거나 ZIP을 다시 받은 뒤 확장을 새로고침하고 대상 페이지도 새로고침하세요. 수정된 버전은 `0.1.1` 이상입니다.

### 결제창 같은 페이지 팝업 위에서 선택되지 않을 때

네이티브 `<dialog>`를 포함한 브라우저 top layer 팝업 지원은 `0.1.2`부터 포함됩니다. `0.1.3`부터는 팝업을 닫지 않고도 주석 입력창에 텍스트를 입력할 수 있습니다. 최신 ZIP으로 다시 설치하거나 빌드한 뒤 확장과 대상 페이지를 모두 새로고침하세요.
