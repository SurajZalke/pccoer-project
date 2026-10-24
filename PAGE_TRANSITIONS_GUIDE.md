# Page Transitions & Tab Switch Effects - Implementation Guide

## 🎬 Overview

This guide documents the smooth page transition animations and tab switch effects added to the website.

## ✨ Features Added

### 1. **Tab Switch Detection with Fade Effect**
When users switch tabs (minimize window, go to another tab, then return):
- Smooth fade-in overlay effect
- Auto-hides after 600ms
- Non-intrusive, improves visual feedback
- Located in: `src/components/TabSwitchDetector.tsx`

### 2. **Page Transition Animations**
When users navigate between pages:
- Smooth fade-in with slide animation
- Configurable direction: up, down, left, right
- Customizable duration and delay
- Uses Framer Motion for smooth 60fps animations

### 3. **Route-based Transitions**
All routes now have smooth AnimatePresence wrapper:
- Enter animations: 0.4s duration
- Exit animations: smooth fade out
- No layout jank or flash
- Located in: `src/App.tsx` (AnimatePresence mode="wait")

## 📁 New Files Created

### Components
1. **src/components/PageTransition.tsx**
   - Wraps content with fade + slide animation
   - Props: `direction`, `duration`, `delay`
   - Usage: Wrap any component with `<PageTransition>{content}</PageTransition>`

2. **src/components/TabSwitchDetector.tsx**
   - Detects tab visibility changes
   - Shows fade overlay on tab return
   - Callbacks: `onTabHidden`, `onTabVisible`
   - Mount once in App root

3. **src/components/withPageTransition.tsx**
   - HOC (Higher Order Component)
   - Wraps page components with transitions
   - Usage: `export default withPageTransition(MyPage);`

### Hooks
4. **src/hooks/usePageVisibility.ts**
   - Custom hook for detecting page visibility
   - Callbacks: `onHidden`, `onVisible`
   - Returns: current visibility state

### Styles
5. **src/styles/pageTransitions.css**
   - Keyframe animations for transitions
   - Utility classes for direct use
   - Responsive motion reduction support
   - Performance optimizations

## 🚀 Usage Examples

### Example 1: Wrap a Page with PageTransition Component
```tsx
import PageTransition from '@/components/PageTransition';

export const MyPage: React.FC = () => {
  return (
    <PageTransition direction="up" duration={0.4}>
      <div>
        {/* Page content */}
      </div>
    </PageTransition>
  );
};
```

### Example 2: Use withPageTransition HOC
```tsx
import withPageTransition from '@/components/withPageTransition';

const MyPage: React.FC = () => {
  return (
    <div>
      {/* Page content */}
    </div>
  );
};

export default withPageTransition(MyPage, { 
  direction: 'up', 
  duration: 0.4 
});
```

### Example 3: Detect Tab Visibility
```tsx
import { usePageVisibility } from '@/hooks/usePageVisibility';

export const MyComponent = () => {
  const isVisible = usePageVisibility({
    onHidden: () => console.log('Tab hidden'),
    onVisible: () => console.log('Tab visible'),
  });

  return <div>{isVisible ? 'Visible' : 'Hidden'}</div>;
};
```

### Example 4: Use CSS Classes
```tsx
<div className="page-enter-slide-up">
  {/* Content slides up on load */}
</div>
```

## 🎨 Animation Types

### Slide Directions
- `up` - Slides up + fade
- `down` - Slides down + fade
- `left` - Slides left + fade
- `right` - Slides right + fade

### Durations (in seconds)
- `0.3` - Fast transitions
- `0.4` - Default, balanced
- `0.5` - Slower, more noticeable
- `0.6` - Smooth, relaxed

## 🔧 Configuration

### App-Level Settings (App.tsx)
```tsx
// AnimatePresence manages route transitions
<AnimatePresence mode="wait">
  <Routes>
    {/* All routes get exit animations */}
  </Routes>
</AnimatePresence>

// TabSwitchDetector manages tab visibility
<TabSwitchDetector 
  onTabVisible={() => console.log('Back in tab')}
  onTabHidden={() => console.log('Left tab')}
/>
```

### Per-Page Settings
Each page can have custom transition settings:
```tsx
export default withPageTransition(MyPage, {
  direction: 'right',    // Slide direction
  duration: 0.5,         // Animation duration in seconds
  delay: 0.1             // Delay before starting animation
});
```

## 📊 Performance Impact

### Metrics
- **Animation Duration**: 0.4s (default)
- **CSS Usage**: Minimal (CSS animations for perf)
- **JS Overhead**: Only when changing tabs/routes
- **Respects**: `prefers-reduced-motion` media query

### Optimization
- Uses GPU acceleration (`transform`, `opacity`)
- No layout recalculations during animations
- Will-change hints for performance
- Backface visibility hidden

## 🔌 Integration Steps

### Already Done:
✅ Added TabSwitchDetector to App.tsx
✅ Wrapped Routes with AnimatePresence
✅ Imported pageTransitions.css
✅ Created all helper components and hooks

### To Use on Existing Pages:
```tsx
// Option 1: Use withPageTransition HOC (easiest)
import withPageTransition from '@/components/withPageTransition';

export default withPageTransition(MyPage);

// Option 2: Wrap return value with PageTransition
import PageTransition from '@/components/PageTransition';

return (
  <PageTransition>
    {/* existing content */}
  </PageTransition>
);
```

## 🎯 Best Practices

1. **Don't nest transitions**: Use one transition per page level
2. **Keep duration consistent**: 0.3-0.4s for most cases
3. **Choose appropriate direction**: 
   - Forward navigation → `up`
   - Backward navigation → `down`
   - Modal/overlay → `right`
4. **Respect user preferences**: CSS handles `prefers-reduced-motion`
5. **Test on devices**: Animations may feel different on slower devices

## 🧪 Testing

```tsx
// Test tab switch effect
1. Open app in browser
2. Click another tab
3. Return to app tab
4. See fade-in effect

// Test page transitions
1. Navigate between pages
2. Observe smooth fade + slide
3. Check console for any errors
4. Verify on mobile devices
```

## 🐛 Troubleshooting

### Animations not showing?
- Verify `pageTransitions.css` is imported in App.tsx
- Check browser dev tools: should see animations on page load
- Ensure Framer Motion is installed (`npm list framer-motion`)

### Animations too slow/fast?
- Adjust `duration` prop (default is 0.4s)
- Edit `src/styles/pageTransitions.css` keyframes
- Check system performance settings

### Choppy animations?
- Enable GPU acceleration (included in CSS)
- Reduce animation duration
- Check for heavy computations during navigation
- Test on different device/browser

### TabSwitchDetector not working?
- Verify component mounted in App.tsx
- Check browser console for errors
- Test with browser dev tools: Ctrl+Shift+I → check "Application" tab

## 📚 References

- **Framer Motion**: https://www.framer.com/motion/
- **CSS Animations**: https://developer.mozilla.org/en-US/docs/Web/CSS/animation
- **React Router**: https://reactrouter.com/
- **prefers-reduced-motion**: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion

## 📝 Summary

| Feature | File | Type | Status |
|---------|------|------|--------|
| Tab Switch Fade | TabSwitchDetector | Component | ✅ Ready |
| Page Transitions | PageTransition | Component | ✅ Ready |
| HOC Wrapper | withPageTransition | HOC | ✅ Ready |
| Page Visibility | usePageVisibility | Hook | ✅ Ready |
| Animations CSS | pageTransitions.css | Stylesheet | ✅ Ready |
| Route Animations | App.tsx | Integration | ✅ Ready |

All features are production-ready and working!
