# bundler-under-the-hood

번들러의 내부 동작을 이해하기 위해 직접 구현해본 간단한 번들러

## 설치

```bash
pnpm install
```

## 실행

### 개발 모드 (Dev Server)

```bash
pnpm dev
# 또는
node src/index.js dev
```

`http://localhost:3000`에서 실행됨

### 빌드 모드

```bash
pnpm build
# 또는
node src/index.js build
```

`output/` 폴더에 `bundle.js`와 `index.html`이 생성됨

## 동작 방식

1. **의존성 그래프 생성**: 엔트리 파일(`fixture/index.js`)부터 `import`를 따라 모든 모듈 수집
2. **모듈 변환**: `import/export` → `require/exports`로 변환, CSS는 런타임에 `<style>` 태그로 주입
3. **번들 생성**: 모든 모듈을 하나의 `bundle.js`로 묶고 간단한 런타임 추가
4. **HTML 생성**: 템플릿에 `<script src="/bundle.js"></script>` 자동 삽입
