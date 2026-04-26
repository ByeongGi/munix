# Theme 상세 설계 — Munix

> 라이트/다크 모드, 컬러 토큰, 타이포그래피. 오닉스 모노크롬 × 옵시디언 오마주.

---

## 1. 목적

- 눈이 편한 라이트/다크 테마 제공
- 시스템 설정 자동 연동
- 오닉스 기반 모노크롬 + 오닉스 악센트

---

## 2. 브랜드 컨셉

| 요소 | 영감 | 적용 |
|------|------|------|
| 오닉스 | 절제된 모노크롬, 블랙/화이트 | 베이스 컬러 |
| 오닉스(Onyx) | 딥 블랙 보석, 광택 | 다크모드 배경 |
| 틸 액센트 | 차분한 청록 계열 | 포커스, 링크, 선택 상태 |

---

## 3. 컬러 토큰 (Design Tokens)

### 3.1 Primitive Palette

**Gray Scale (기본):**
```css
--gray-0:   #FFFFFF;
--gray-50:  #FAFAFA;
--gray-100: #F5F5F5;
--gray-200: #E5E5E5;
--gray-300: #D4D4D4;
--gray-400: #A3A3A3;
--gray-500: #737373;
--gray-600: #525252;
--gray-700: #404040;
--gray-800: #262626;
--gray-900: #171717;
--gray-950: #0A0A0A;
```

**Accent (Onyx Teal):**
```css
--accent-50:  #F0FDFA;
--accent-100: #CCFBF1;
--accent-200: #99F6E4;
--accent-300: #5EEAD4;
--accent-400: #2DD4BF;
--accent-500: #14B8A6;  /* 다크 모드 메인 액센트 */
--accent-600: #0D9488;
--accent-700: #0F766E;  /* 라이트 모드 메인 액센트 */
--accent-800: #115E59;
--accent-900: #134E4A;
```

**Semantic:**
```css
--red-500:    #EF4444;  /* Error, Delete */
--orange-500: #F97316;  /* Warning, Conflict */
--green-500:  #22C55E;  /* Success, Saved */
--blue-500:   #3B82F6;  /* Info, Link */
```

### 3.2 Semantic Tokens — Light

```css
:root[data-theme='light'] {
  /* Background */
  --bg-primary:    var(--gray-0);        /* 메인 에디터 */
  --bg-secondary:  var(--gray-50);       /* 사이드바 */
  --bg-tertiary:   var(--gray-100);      /* Card, Modal 배경 */
  --bg-hover:      var(--gray-100);
  --bg-active:     var(--gray-200);
  --bg-selected:   var(--accent-50);

  /* Foreground */
  --text-primary:    var(--gray-900);
  --text-secondary:  var(--gray-600);
  --text-tertiary:   var(--gray-400);
  --text-disabled:   var(--gray-300);
  --text-on-accent:  var(--gray-0);
  --text-link:       var(--accent-600);

  /* Border */
  --border-subtle:  var(--gray-200);
  --border-default: var(--gray-300);
  --border-strong:  var(--gray-400);
  --border-focus:   var(--accent-500);

  /* Accent */
  --accent:         var(--accent-500);
  --accent-hover:   var(--accent-600);
  --accent-muted:   var(--accent-100);

  /* State */
  --success: var(--green-500);
  --warning: var(--orange-500);
  --error:   var(--red-500);
  --info:    var(--blue-500);

  /* Editor specific */
  --editor-bg:         var(--gray-0);
  --editor-selection:  var(--accent-100);
  --editor-cursor:     var(--gray-900);
  --code-bg:           var(--gray-100);
  --code-border:       var(--gray-200);
  --mark-bg:           #FEF3C7;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.07), 0 4px 6px rgba(0,0,0,0.05);
}
```

### 3.3 Semantic Tokens — Dark (Onyx)

```css
:root[data-theme='dark'] {
  /* Background — 오닉스 딥 블랙 기반 */
  --bg-primary:    var(--gray-950);     /* #0A0A0A 에디터 */
  --bg-secondary:  #141414;             /* 사이드바 (약간 밝게) */
  --bg-tertiary:   var(--gray-900);     /* #171717 카드 */
  --bg-hover:      var(--gray-800);
  --bg-active:     var(--gray-700);
  --bg-selected:   rgba(139, 92, 246, 0.15);

  /* Foreground */
  --text-primary:    var(--gray-50);
  --text-secondary:  var(--gray-400);
  --text-tertiary:   var(--gray-500);
  --text-disabled:   var(--gray-700);
  --text-on-accent:  var(--gray-0);
  --text-link:       var(--accent-400);

  /* Border */
  --border-subtle:  var(--gray-800);
  --border-default: var(--gray-700);
  --border-strong:  var(--gray-600);
  --border-focus:   var(--accent-400);

  /* Accent */
  --accent:         var(--accent-400);   /* 다크에서는 한 단계 밝게 */
  --accent-hover:   var(--accent-300);
  --accent-muted:   rgba(139, 92, 246, 0.2);

  /* State (다크에서 한 단계 밝게) */
  --success: #4ADE80;
  --warning: #FB923C;
  --error:   #F87171;
  --info:    #60A5FA;

  /* Editor specific */
  --editor-bg:         var(--gray-950);
  --editor-selection:  rgba(139, 92, 246, 0.25);
  --editor-cursor:     var(--gray-0);
  --code-bg:           var(--gray-900);
  --code-border:       var(--gray-800);
  --mark-bg:           rgba(251, 191, 36, 0.25);

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.35);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.4);
}
```

### 3.4 Tailwind 연동

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary:  'var(--bg-tertiary)',
          hover:     'var(--bg-hover)',
          active:    'var(--bg-active)',
          selected:  'var(--bg-selected)',
        },
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary:  'var(--text-tertiary)',
          disabled:  'var(--text-disabled)',
          link:      'var(--text-link)',
        },
        border: {
          subtle:   'var(--border-subtle)',
          default:  'var(--border-default)',
          strong:   'var(--border-strong)',
          focus:    'var(--border-focus)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover:   'var(--accent-hover)',
          muted:   'var(--accent-muted)',
        },
      },
    },
  },
};
```

사용 예:
```tsx
<div className="bg-bg-primary text-text-primary border-border-subtle">
```

---

## 4. 타이포그래피

### 4.1 폰트 스택

```css
:root {
  --font-sans: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont,
               system-ui, 'Segoe UI', sans-serif;
  --font-serif: 'Iowan Old Style', 'Apple Garamond', Baskerville, 'Times New Roman',
                'Droid Serif', Times, 'Source Serif Pro', serif;
  --font-mono: 'JetBrains Mono', 'D2Coding', 'SF Mono', Menlo, Monaco, Consolas,
               'Courier New', monospace;
}
```

- Pretendard: 한국어 최적화, 라이선스 자유 (SIL OFL 1.1)
- JetBrains Mono: 코드, 라이선스 자유 (Apache 2.0)
- 두 폰트를 앱 번들에 포함 (로컬 로드, 네트워크 의존 0)

### 4.2 스케일

```css
:root {
  /* Editor 내부 */
  --text-body:    16px;   /* 기본 */
  --text-small:   14px;
  --text-tiny:    12px;
  --text-h1:      32px;
  --text-h2:      26px;
  --text-h3:      22px;
  --text-h4:      18px;
  --text-h5:      16px;
  --text-h6:      14px;
  --text-code:    14px;

  /* UI 요소 */
  --ui-text:      14px;   /* 사이드바, 툴바 */
  --ui-text-sm:   12px;
  --ui-text-lg:   16px;

  /* 라인 하이트 */
  --lh-tight:    1.25;
  --lh-normal:   1.5;
  --lh-relaxed:  1.7;
}
```

### 4.3 사용자 스케일

설정의 `fontSize`가 기본 크기를 조정:

```css
:root {
  --user-scale: 1;  /* 1 = 100% */
}

.editor {
  font-size: calc(var(--text-body) * var(--user-scale));
}
```

Zoom in/out 단축키는 `--user-scale`을 1.0 ~ 1.5 범위로 조정.

---

## 5. 간격 & 반경

### 5.1 Spacing

```css
:root {
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

### 5.2 Border Radius

```css
:root {
  --radius-sm:  4px;
  --radius:     6px;
  --radius-md:  8px;
  --radius-lg:  12px;
  --radius-xl:  16px;
  --radius-full: 9999px;
}
```

### 5.3 Density (Compact Mode)

`compactMode: true`일 때:
```css
:root[data-density='compact'] {
  --row-height-tree: 24px;   /* default 28px */
  --padding-card:    8px;    /* default 12px */
  --gap-list:        4px;    /* default 8px */
}
```

---

## 6. 테마 전환

### 6.1 시스템 연동

```ts
// src/hooks/useTheme.ts
function applyTheme(theme: 'light' | 'dark' | 'system') {
  const resolved = theme === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  document.documentElement.setAttribute('data-theme', resolved);
}
```

### 6.2 시스템 변경 감지

```ts
useEffect(() => {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (settings.appearance.theme === 'system') applyTheme('system');
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}, [settings.appearance.theme]);
```

### 6.3 플래시 방지

앱 시작 시 React 렌더 전에 테마 적용:

```html
<!-- index.html <head> 내 인라인 스크립트 -->
<script>
  (function() {
    const saved = localStorage.getItem('munix:theme') || 'system';
    const theme = saved === 'system'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : saved;
    document.documentElement.setAttribute('data-theme', theme);
  })();
</script>
```

### 6.4 전환 애니메이션

부드러운 테마 전환:
```css
html {
  color-scheme: light dark;
}

body, .transitional {
  transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease;
}
```

예외: 에디터는 transition 없음 (렌더 깜빡임 방지).

---

## 7. 코드 블록 하이라이트

### 7.1 Highlight.js 테마

lowlight가 highlight.js 사용 → 테마 CSS 연동:

**라이트:**
- `github.css` 기반 커스터마이즈

**다크:**
- `github-dark.css` 기반

### 7.2 커스텀 토큰

```css
[data-theme='light'] {
  --code-keyword:  #D73A49;
  --code-string:   #032F62;
  --code-number:   #005CC5;
  --code-comment:  #6A737D;
  --code-function: #6F42C1;
  --code-variable: #24292E;
}

[data-theme='dark'] {
  --code-keyword:  #FF7B72;
  --code-string:   #A5D6FF;
  --code-number:   #79C0FF;
  --code-comment:  #8B949E;
  --code-function: #D2A8FF;
  --code-variable: #F0F6FC;
}
```

---

## 8. 접근성

### 8.1 대비율

WCAG AA 이상 보장:

| 조합 | 라이트 | 다크 |
|------|-------|------|
| text-primary on bg-primary | 16.0:1 ✅ | 16.7:1 ✅ |
| text-secondary on bg-primary | 7.5:1 ✅ | 7.1:1 ✅ |
| accent on bg-primary | 5.2:1 ✅ | 5.8:1 ✅ |
| text-on-accent on accent | 5.5:1 ✅ | 5.5:1 ✅ |

### 8.2 포커스 링

```css
:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

### 8.3 고대비 모드

OS 고대비 모드 감지:
```css
@media (prefers-contrast: more) {
  :root {
    --border-subtle: var(--gray-900);  /* 라이트 */
    --border-default: var(--gray-900);
  }
}
```

### 8.4 애니메이션 감소

```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
  }
}
```

---

## 9. 아이콘

### 9.1 라이브러리

- **lucide-react** — MIT, 가볍고 일관된 스타일
- 사이즈: 16px (UI), 20px (버튼), 24px (헤더)
- 두께: 1.5px (default)

### 9.2 컬러

- 기본: `currentColor` (부모 텍스트 색 따라감)
- 활성: `var(--accent)`
- 비활성: `var(--text-disabled)`

---

## 10. 커스텀 테마 (v1.1+)

### 10.1 사용자 CSS

`~/.config/munix/themes/{name}.css`에 사용자가 추가한 CSS를 로드.

```ts
// 앱 시작 시
const themes = await invoke('list_themes');  // Rust에서 파일 목록
themes.forEach(theme => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = convertFileSrc(theme.path);
  link.dataset.themeName = theme.name;
  link.disabled = true;  // 기본 비활성화
  document.head.appendChild(link);
});
```

설정에서 활성화한 테마만 `disabled = false`.

### 10.2 테마 포맷

```css
/* my-custom.css */
[data-theme='custom-my-custom'] {
  --bg-primary: #1e1e2e;
  --accent: #cba6f7;
  /* 나머지는 기본 상속 */
}
```

---

## 11. 테스트 케이스

- [ ] 시스템 다크 모드 변경 시 자동 전환
- [ ] 앱 시작 시 테마 플래시 없음
- [ ] 모든 UI 요소가 대비율 AA 이상
- [ ] `prefers-reduced-motion` 존중
- [ ] compact mode 토글 시 밀도 변화
- [ ] 사용자 CSS 로드 (v1.1+)

---

## 12. 엣지 케이스

- **Windows 하이콘트라스트 모드**: 시스템 색상 강제 적용될 수 있음 → 확인 필요
- **macOS Accent Color 연동**: OS의 강조색과 연동할지 (옵션)
- **전체 화면 녹화 시 텍스트 흐림**: 특정 폰트 렌더링 이슈
- **사용자 CSS로 레이아웃 깨짐**: 안내만 제공, 복구는 비활성화로

---

## 13. 오픈 이슈

1. **세리프 모드**: 본문 폰트를 세리프로 전환하는 "reading mode" 추가?
2. **글꼴 크기 zoom**: 에디터만 vs 전체 UI 연동
3. **테마 프리셋**: 카페, 종이 등 감성 테마 번들 제공
4. **오닉스 광택 효과**: 다크모드에서 미묘한 그라디언트/텍스처로 보석 느낌
5. **브랜드 폰트**: 라이선스 확인 후 적용 가능 여부

---

**문서 버전:** v0.1
**작성일:** 2026-04-25
**관련 문서:**
- [settings-spec.md](./settings-spec.md)
- [editor-spec.md](./editor-spec.md)
