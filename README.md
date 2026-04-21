# jsonpad

어드민 페이지처럼 `<input>` / `<textarea>` 안에 JSON 을 박아 넣어야 하는 상황에서,
원본은 compact 로 유지하면서 편집할 때만 pretty 모달을 띄워 다루기 위한 Chrome 확장 프로그램.

현재 **PoC** 단계.

## 기능 (PoC)

- `input` / `textarea` 포커스 시 우측 상단에 `{}` 버튼 표시
- 버튼 클릭 → 모달에서 pretty 편집
- format / validate / apply (apply 시 원본에 **compact JSON** 으로 주입 + `input`·`change` 이벤트 dispatch)
- 프리셋 저장/적용 (`chrome.storage.local`)
- AI 연동(복붙 기반):
  - "copy AI prompt" — 현재 JSON 기반 스키마·프리셋 생성 프롬프트 클립보드 복사
  - "paste from clipboard" — AI 가 생성한 JSON 을 에디터에 붙여넣기
- 키보드 단축키: `Esc` 취소 / `Cmd·Ctrl+Enter` apply / `Cmd·Ctrl+S` format

## 설치 (개발자 모드)

1. 이 저장소 클론
2. Chrome → `chrome://extensions`
3. 우측 상단 "개발자 모드" 켜기
4. "압축해제된 확장 프로그램 로드" → 이 디렉터리 선택

## 로드맵

**v1 (리뉴얼)**
- 트리 뷰 / jsonhero 스타일 구조화 뷰
- 스키마 저장 및 스키마 기반 폼 뷰
- DOM 패턴(XPath 등) 기반 필드별 스키마 자동 추천/적용
- Diff 뷰, 세션 내 undo 히스토리
- 경로 breadcrumb, JSON 내 검색
- 서브트리 복사 (값 / JSONPath)
- 관대한 파서 (trailing comma, single quote, unquoted key 자동 수정 제안)
- 확장 프레임워크·보일러플레이트(CRXJS, wxt 등) 도입 검토

**아이디어 (실현 미정)**
- 로컬 HTTP 브릿지(선택 설치)를 통한 AI 직접 연동
  - AI → `curl POST` → 확장으로 스키마/프리셋 실시간 푸시
  - 확장 → AI 에게 노출할 추천 프롬프트 큐잉

## 구조

```
manifest.json   # MV3 매니페스트
content.js      # 감지·모달·저장 로직 전부
modal.css       # 오버레이/모달 스타일
```

의존성 없음. 번들러 없음. 파일 수정 후 `chrome://extensions` 에서 새로고침.
