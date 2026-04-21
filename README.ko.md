# jsonpad

어드민 페이지처럼 `<input>` · `<textarea>` 안에 JSON 이 박혀 있는 필드를 제대로 된 에디터로 편집하기 위한 Chrome 확장. 편집할 때만 모달을 띄우고, 원본 필드에는 다시 compact JSON 으로 써 넣어 폼 형태를 그대로 둔다.

상태: **PoC**.

> 언어: [English](README.md) · **한국어**

## 왜

어드민 툴은 흔히 한 필드에 compact JSON 을 통째로 담는다. 그 자리에서 편집하면 한 줄로 이어진 텍스트를 눈으로 괄호 짝 맞춰가며 고쳐야 하고, 저장할 때까지 파싱될지 알기 어렵다. jsonpad 는 폼이 제출하는 값은 건드리지 않으면서 필요할 때만 실제 에디터를 띄운다.

## 기능

- 값이 JSON 형태인 필드에 포커스하면 `{}` 트리거 노출
- 트리거의 `×` 버튼으로 해당 필드만 숨김 (세션 한정)
- `Alt` + `Shift` + `J` 로 아무 필드에서나 강제 오픈
- 툴바 팝업: on/off 토글, 기본 레이아웃(`split` / `raw` / `jsoncrack`) 선택, raw 에디터 줄바꿈 토글
- 모달은 `raw` 에디터와 `jsoncrack` 그래프 뷰를 좌우로 같이 보여줌
  - `raw` 에디터는 `Enter` 자동 인덴트, `Tab` / `Shift` + `Tab` 으로 현재 라인 · 멀티라인 선택 인덴트 조작 지원 (컬러 하이라이팅은 v1 에서 에디터 라이브러리 도입과 함께)
  - 헤더에서 `split` / `raw` / `jsoncrack` 3모드 전환
  - `raw` 만 편집 가능, `jsoncrack` 은 jsoncrack.com iframe 으로 읽기 전용 (데이터는 브라우저 밖으로 안 나감)
  - **sync** 버튼 또는 `Ctrl`/`Cmd` + `Shift` + `Enter` 로 현재 raw 를 그래프에 반영. 모달 열 때 · format 시 · 프리셋 로드 시 자동 sync
- **Open in jsoncrack editor**: 현재 JSON 을 클립보드에 복사하고 [jsoncrack.com/editor](https://jsoncrack.com/editor) 를 새 탭으로 열기 (에디터에서 `Ctrl`/`Cmd` + `V` 로 붙여넣기. jsoncrack 은 URL prefill 을 지원하지 않음)
- **Open in JSON Hero**: [jsonhero.io](https://jsonhero.io) 를 URL 에 base64 페이로드를 실어서 새 탭으로 열기 (서버 저장 없음, 다만 URL 은 브라우저 히스토리에 남고 서버 로그에 기록될 수 있음 · ~20k 자 제한)
- 적용 시 **compact JSON** 으로 주입, `input` · `change` 이벤트 dispatch (React, Vue 등 프레임워크 state 반영)
- 프리셋 저장 (`chrome.storage.local`)
- 브릿지 · 데몬 없이 동작하는 AI 연동
  - **Copy AI prompt** — 현재 JSON 기반 프롬프트를 클립보드로 복사
  - **Paste from clipboard** — AI 출력을 바로 에디터에 붙여넣기
- 모달 단축키: `Esc` 취소 · `Ctrl`/`Cmd` + `Enter` apply · `Ctrl`/`Cmd` + `Shift` + `Enter` sync · `Ctrl`/`Cmd` + `S` format

## 설치 (개발자 모드)

1. 저장소 clone
2. `chrome://extensions` 열기
3. **개발자 모드** 켜기
4. **압축해제된 확장 프로그램 로드** → 이 디렉터리 선택

웹 스토어 배포는 v1 에서.

## 사용법

`<input>` 이나 `<textarea>` 에 포커스하면 필드 우상단에 `{}` 버튼이 뜬다. 클릭 → 편집 → apply. 원본 필드에는 compact JSON 으로 되돌아간다.

## 로드맵

**v1**

- 트리 · 구조화 뷰 (jsonhero 스타일)
- 스키마 저장 + 스키마 기반 폼 뷰
- DOM 패턴 (XPath 등) 으로 필드별 스키마 자동 추천 · 적용
- 원본 대비 diff 뷰
- 세션 내 undo 히스토리, 경로 breadcrumb, JSON 내부 검색
- 서브트리 복사 (값 · JSONPath)
- 관대한 파서: trailing comma, single quote, unquoted key
- 리라이트 시 확장 보일러플레이트(CRXJS, wxt) 도입 검토

**아이디어 (미확정)**

- 선택 설치형 로컬 HTTP 브릿지를 통한 AI 직결
  - AI 가 `curl POST` 로 스키마 · 프리셋 푸시
  - 확장이 AI 쪽에 제안 프롬프트를 노출

## 프로젝트 구조

```
manifest.json   MV3 매니페스트
content.js      감지 · 모달 · 저장 로직
modal.css       오버레이 · 모달 스타일
popup.html/js   툴바 팝업 (on/off · 기본 뷰)
```

의존성 없음. 번들러 없음. 파일 수정 후 `chrome://extensions` 에서 **새로고침**.

## 라이선스

TBD
