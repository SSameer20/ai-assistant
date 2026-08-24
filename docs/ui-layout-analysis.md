# UI Layout Issues Analysis & Prevention

## Critical Layout Issues Identified

### 1. **Code Block Width Breaking UI** ⚠️ **CRITICAL**

**Current Issue:**

- CodeBlock component lacks proper max-width constraints
- Long code lines cause horizontal overflow
- SyntaxHighlighter doesn't wrap properly on long lines

**Locations:**

- [src/ui/components/ui/code-block.tsx](src/ui/components/ui/code-block.tsx)
- [src/ui/App.css](src/ui/App.css#L68) (`.ai-code-block` class)

**Potential Problems:**

```typescript
// ❌ NO max-width constraint on main container
<div className="relative w-full rounded-lg bg-slate-900 p-4 font-mono text-sm">

// ❌ SyntaxHighlighter without wrapLongLines
<SyntaxHighlighter
  wrapLines={true}
  // Missing: wrapLongLines={true}
```

**Symptoms:**

- Horizontal scrolling in app
- UI breaking with long code snippets (especially Java, C++, SQL)
- Window width expanding beyond screen limits

---

### 2. **Content Container Width Issues** ⚠️ **HIGH RISK**

**Current Issue:**

- Content containers use `w-full` without max-width boundaries
- No responsive width constraints for different content types

**Locations:**

- [src/ui/components/Home.tsx](src/ui/components/Home.tsx#L497) - Content display area
- [src/ui/components/MessageComponents.tsx](src/ui/components/MessageComponents.tsx#L40) - Message containers

**Potential Problems:**

```tsx
// ❌ Unbounded width containers
<div className="text-white/90 text-sm overflow-auto w-full h-full space-y-2 max-w-200">
<div className="mb-4 w-full"> // CodeMessageComponent

// ❌ No max-width on message containers
className="mb-3 text-white/90 leading-relaxed"
```

**Symptoms:**

- Content expanding beyond readable limits
- Poor mobile/small screen experience
- Inconsistent layout across different content types

---

### 3. **Window Sizing Logic Flaws** ⚠️ **HIGH RISK**

**Current Issue:**

- Window fit logic uses `document.body.scrollHeight` which includes forced viewport height
- Minimum height too aggressive for small components
- No content-type aware sizing

**Locations:**

- [src/electron/ipc/handlers/WindowIPCHandlers.ts](src/electron/ipc/handlers/WindowIPCHandlers.ts#L13)
- [src/ui/components/Home.tsx](src/ui/components/Home.tsx#L55) - useLayoutEffect calls

**Potential Problems:**

```typescript
// ❌ Flawed height calculation
.executeJavaScript(`Math.ceil(document.body.scrollHeight || 0)`)
// Uses full viewport height due to h-screen layout

// ❌ Too aggressive minimum
const minHeight = 200; // Too large for simple components

// ❌ Frequent refitting without debounce
useLayoutEffect(() => {
  window.size.fitToContent();
}, [/* many dependencies */]);
```

**Symptoms:**

- Windows too tall for small content
- Excessive window resizing/flickering
- Poor performance from frequent resize calls

---

### 4. **Typography and Text Content Overflow** ⚠️ **MEDIUM RISK**

**Current Issue:**

- Long URLs and technical terms can break layout
- No word-break handling for technical content
- Inline code elements lack max-width

**Locations:**

- [src/ui/components/ui/typography.tsx](src/ui/components/ui/typography.tsx)
- [src/ui/App.css](src/ui/App.css#L107) (`.ai-code-inline`)
- [src/ui/helper/sanitize.ts](src/ui/helper/sanitize.ts#L14) - Text normalization

**Potential Problems:**

```css
/* ❌ Inline code without word-break */
.ai-code-inline {
  background-color: #000000;
  color: #cabe86;
  /* Missing: word-break: break-all; */
}

/* ❌ Long words in technical content */
/* No handling for: */
/* - Long function names: someVeryLongFunctionNameThatBreaksLayout() */
/* - URLs: https://extremely-long-url-that-causes-horizontal-scrolling.com */
/* - File paths: /very/long/file/path/that/exceeds/container/width */
```

**Symptoms:**

- Horizontal scrolling from long technical terms
- URLs breaking out of containers
- Poor readability of long content

---

### 5. **Main Layout Structure Issues** ⚠️ **MEDIUM RISK**

**Current Issue:**

- Root layout uses forced full-height (`height: 100%`)
- `h-screen` class forcing viewport height regardless of content
- No responsive layout for different screen sizes

**Locations:**

- [src/ui/main.tsx](src/ui/main.tsx#L20)
- [src/ui/index.css](src/ui/index.css#L6)

**Potential Problems:**

```css
/* ❌ Forced full height */
html,
body,
#root {
  height: 100%; /* Forces full viewport height */
}
```

```tsx
/* ❌ Screen height forcing */
<div className="h-screen flex flex-col items-center">
  <div className="flex-1 flex justify-center items-start"> // Forces expansion
```

**Symptoms:**

- Excessive empty space for small components
- Poor window sizing behavior
- Mobile/tablet layout issues

---

### 6. **Streaming Content Layout Issues** ⚠️ **MEDIUM RISK**

**Current Issue:**

- Streaming messages don't account for dynamic width changes
- No content-aware container sizing during streaming
- Frequent DOM changes causing layout thrashing

**Locations:**

- [src/ui/components/Home.tsx](src/ui/components/Home.tsx#L95) - Chunk processing
- [src/ui/store/types.ts](src/ui/store/types.ts) - Message types

**Potential Problems:**

```tsx
// ❌ Layout recalculation on every chunk
case "code":
  // Updates streaming message content
  // Triggers window.size.fitToContent() every time
  // No debouncing or batching

// ❌ No max-width on streaming containers
{streamingMessage && (
  <MessageRenderer
    message={streamingMessage}
    // Container can expand indefinitely
  />
)}
```

**Symptoms:**

- Performance issues during streaming
- Window size jumping/flickering
- Poor user experience with rapid content changes

---

## Preventive Measures & Solutions

### Immediate Fixes Required

#### 1. **Fix CodeBlock Width Constraints**

```tsx
// ✅ FIXED: Add max-width to CodeBlock
<div
  className="relative w-full rounded-lg bg-slate-900 p-4 font-mono text-sm"
  style={{ maxWidth: "60vw", wordWrap: "break-word", overflowWrap: "break-word" }}
>
```

#### 2. **Add Content Container Limits**

```tsx
// ✅ Apply max-width to all content containers
<div className="ai-content flex-1 min-h-0 max-w-[80vw]">
  <div
    ref={resultRef}
    className="text-white/90 text-sm overflow-auto w-full h-full space-y-2"
    style={{ maxWidth: "100%", wordWrap: "break-word" }}
  >
```

#### 3. **Improve Window Sizing Logic**

```typescript
// ✅ Better height calculation
const getContentHeight = () => {
  const root = document.getElementById("root");
  if (!root) return 200;

  // Temporarily remove forced height
  const originalHeight = root.style.height;
  root.style.height = "auto";

  const actualHeight = root.scrollHeight;

  // Restore original height
  root.style.height = originalHeight;

  return Math.max(100, Math.min(actualHeight + 40, screenHeight - 100));
};
```

### CSS Safeguards

#### 1. **Universal Width Constraints**

```css
/* ✅ Add to App.css */
.ai-response-container {
  max-width: 80vw;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

.ai-long-content {
  max-width: 60vw;
  overflow-x: auto;
  overflow-y: hidden;
}

/* ✅ Better code handling */
.ai-code-inline {
  word-break: break-all;
  max-width: 100%;
  display: inline-block;
  overflow-wrap: break-word;
}
```

#### 2. **Responsive Layout Classes**

```css
/* ✅ Responsive container utilities */
.container-responsive {
  width: 100%;
  max-width: min(90vw, 1200px);
  margin: 0 auto;
}

@media (max-width: 768px) {
  .container-responsive {
    max-width: 95vw;
    padding: 0 1rem;
  }
}
```

### Performance Optimizations

#### 1. **Debounced Window Fitting**

```tsx
// ✅ Add debounced fitting hook
const useDebouncedWindowFit = (dependencies: any[], delay = 150) => {
  const timeoutRef = useRef<number>();

  useLayoutEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      window.size?.fitToContent();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, dependencies);
};
```

#### 2. **Content-Type Aware Sizing**

```tsx
// ✅ Smart window sizing based on content type
const getOptimalWindowSize = (contentType: "text" | "code" | "mixed") => {
  switch (contentType) {
    case "code":
      return { minWidth: 600, maxWidth: "80vw", minHeight: 300 };
    case "text":
      return { minWidth: 400, maxWidth: "60vw", minHeight: 200 };
    case "mixed":
      return { minWidth: 500, maxWidth: "70vw", minHeight: 250 };
  }
};
```

## Testing Checklist

### Critical Width Tests

- [ ] Test with Binary Search in Java (long code blocks)
- [ ] Test with extremely long single lines of code
- [ ] Test with long URLs and technical documentation
- [ ] Test with mixed content (text + code + images)
- [ ] Test window resizing behavior
- [ ] Test on different screen sizes (1080p, 4K, ultrawide)

### Content Type Tests

- [ ] Small text responses
- [ ] Large code files
- [ ] Mixed content with multiple code blocks
- [ ] Streaming content updates
- [ ] Error messages and edge cases

### Performance Tests

- [ ] Rapid content updates during streaming
- [ ] Multiple window resize operations
- [ ] Memory usage during long sessions
- [ ] Smooth animations during content changes

## Monitoring & Alerts

### Layout Break Detection

```tsx
// ✅ Add layout monitoring
const useLayoutMonitor = () => {
  useEffect(() => {
    const checkOverflow = () => {
      const container = document.querySelector("[data-main-container]");
      if (container && container.scrollWidth > container.clientWidth) {
        console.warn("Horizontal overflow detected", {
          scrollWidth: container.scrollWidth,
          clientWidth: container.clientWidth,
          element: container,
        });
      }
    };

    const observer = new ResizeObserver(checkOverflow);
    const container = document.querySelector("[data-main-container]");
    if (container) observer.observe(container);

    return () => observer.disconnect();
  }, []);
};
```

## Future-Proofing Recommendations

1. **Implement CSS Container Queries** for responsive layouts
2. **Add Content Security Policy** for external content
3. **Create Layout Test Suite** for automated testing
4. **Monitor Real-User Performance** metrics
5. **Establish Content Length Limits** for different contexts
6. **Implement Progressive Enhancement** for complex layouts

## Risk Assessment Matrix

| Issue Type             | Severity | Likelihood | Impact | Priority |
| ---------------------- | -------- | ---------- | ------ | -------- |
| Code Block Overflow    | Critical | High       | High   | P0       |
| Container Width Issues | High     | Medium     | High   | P1       |
| Window Sizing Flaws    | Medium   | High       | Medium | P1       |
| Typography Overflow    | Medium   | Medium     | Medium | P2       |
| Layout Structure       | Medium   | Low        | High   | P2       |
| Streaming Performance  | Low      | Medium     | Medium | P3       |

---

_Last Updated: 2 February 2026_
_Review Frequency: After each major content type addition_
