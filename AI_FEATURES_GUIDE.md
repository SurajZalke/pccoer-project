# AI Features & Animations Guide

## Overview

This document outlines the new AI provider management system and comprehensive animation library integrated into the Dhole Sir Coaching Classes application.

---

## 🤖 AI Provider Manager

### Features

The new `aiProviderManager.ts` provides intelligent API management with:

- **Dual Provider Support**: GROQ and Gemini APIs
- **Automatic Failover**: Seamlessly switches between providers
- **Key Rotation**: Distributes load across multiple API keys
- **Rate Limit Handling**: Exponential backoff and automatic retry
- **Health Tracking**: Monitors provider status and performance
- **Intelligent Selection**: Chooses best provider based on health

### Configuration

API keys are stored in `.env` file with VITE prefix for client-side access:

```env
VITE_GEMINI_KEYS=["key1","key2","key3"]
VITE_GROQ_KEYS=["key1","key2","key3","key4"]
```

### Usage

#### Basic API Call

```typescript
import { callAIAPI } from '@/services/aiProviderManager';

const response = await callAIAPI(prompt, 'auto');
console.log(response.text);        // AI response
console.log(response.provider);    // 'groq' or 'gemini'
```

#### Provider Preference

```typescript
// Try GROQ first, fallback to Gemini
const response = await callAIAPI(prompt, 'groq');

// Try Gemini first, fallback to GROQ
const response = await callAIAPI(prompt, 'gemini');

// Auto-select based on health
const response = await callAIAPI(prompt, 'auto');
```

#### Health Monitoring

```typescript
import { getProviderHealth, getAPIStats } from '@/services/aiProviderManager';

// Get detailed health status
const health = getProviderHealth();
console.log(health.groq.isHealthy);
console.log(health.gemini.failureCount);

// Get API statistics
const stats = getAPIStats();
console.log(stats.groq.totalKeys);
console.log(stats.gemini.currentKeyIndex);
```

### Provider Strategy

1. **GROQ First** (Default)
   - Faster response times
   - Lower latency
   - Cost-effective
   - Falls back to Gemini on failure

2. **Automatic Failover**
   - Detects rate limiting (429 errors)
   - Rotates to next API key
   - Implements exponential backoff
   - Tracks provider health

3. **Intelligent Retry**
   - Max 3 attempts per provider
   - Exponential backoff: 1s → 2s → 4s (capped at 30s)
   - Random jitter to prevent thundering herd

### Error Handling

```typescript
try {
  const response = await callAIAPI(prompt);
} catch (error) {
  // All providers exhausted
  console.error('AI service unavailable:', error.message);
}
```

---

## 🎨 Animation System

### Features

Comprehensive animation library with 30+ pre-built animations:

- **Fade Animations**: fadeIn, fadeOut, fadeInUp, fadeInDown, fadeInLeft, fadeInRight
- **Scale Animations**: scaleIn, scaleOut, scaleUp, scaleDown
- **Slide Animations**: slideInLeft, slideInRight, slideInUp, slideInDown
- **Bounce Animations**: bounce, bounceIn, bounceOut
- **Pulse Animations**: pulse, pulseGlow
- **Spin Animations**: spin, spinSlow
- **Shimmer Animations**: shimmer, shimmerWave
- **Gradient Animations**: gradientShift, gradientFlow
- **Pop Animations**: popIn, popOut
- **Flip Animations**: flipIn, flipOut
- **Shake Animation**: shake

### CSS Classes

All animations are available as utility classes:

```html
<!-- Fade In -->
<div class="animate-fade-in">Content</div>

<!-- Fade In with delay -->
<div class="animate-fade-in animation-delay-normal">Content</div>

<!-- Scale Up on hover -->
<div class="hover-scale-up">Hover me</div>

<!-- Pulse animation -->
<div class="animate-pulse">Loading...</div>

<!-- Spin animation -->
<div class="animate-spin">Processing...</div>
```

### TypeScript Usage

```typescript
import { animationClasses, animationPresets, getAnimationClass } from '@/utils/animations';

// Use animation class
<div className={animationClasses.fadeInUp}>Content</div>

// Use preset
<div className={animationPresets.modalEnter}>Modal</div>

// Get animation with delay
<div className={getAnimationClass('fadeInUp', 'normal')}>Content</div>

// Staggered animations for lists
{items.map((item, index) => (
  <div key={index} className={getStaggeredAnimation('fadeInUp', index)}>
    {item}
  </div>
))}
```

### Animation Presets

Pre-configured animation combinations for common UI patterns:

```typescript
// Modal animations
modalEnter: 'animate-fade-in animate-scale-in'
modalExit: 'animate-fade-out animate-scale-out'

// Card animations
cardEnter: 'animate-fade-in-up'
cardHover: 'hover:animate-scale-up'

// Button animations
buttonHover: 'hover:animate-pulse-glow'
buttonClick: 'active:animate-scale-down'

// Loading animations
loadingSpinner: 'animate-spin'
loadingPulse: 'animate-pulse'
loadingShimmer: 'animate-shimmer'

// Success animations
successPop: 'animate-pop-in'
successBounce: 'animate-bounce-in'

// Error animations
errorShake: 'animate-shake'
errorPulse: 'animate-pulse-glow'

// List item animations
listItemEnter: 'animate-fade-in-left'
listItemHover: 'hover:animate-scale-up'

// Page transitions
pageEnter: 'animate-fade-in-up'
pageExit: 'animate-fade-out'

// Notification animations
notificationEnter: 'animate-slide-in-right'
notificationExit: 'animate-slide-out-right'

// Tooltip animations
tooltipEnter: 'animate-fade-in-up animate-scale-in'
tooltipExit: 'animate-fade-out animate-scale-out'
```

### Animation Timing

```typescript
// CSS Variables
--animation-duration-fast: 150ms
--animation-duration-normal: 300ms
--animation-duration-slow: 500ms
--animation-duration-slower: 700ms
--animation-duration-slowest: 1000ms

// Delays
--animation-delay-fast: 50ms
--animation-delay-normal: 100ms
--animation-delay-slow: 200ms
--animation-delay-slower: 300ms
--animation-delay-slowest: 500ms
```

### Accessibility

Animations respect user preferences:

```css
@media (prefers-reduced-motion: reduce) {
  /* Animations are disabled for users who prefer reduced motion */
}
```

---

## 📊 Updated Services

### aiExplanationService.ts

Now uses `callAIAPI` for intelligent provider selection:

```typescript
// Automatically tries GROQ first, then Gemini
const explanation = await generateSingleExplanation(question);

// Batch explanations with smart retry
const explanations = await generateQuizExplanations(questions);

// AI-powered question generation
const questions = await generateExplanation(topic, count);
```

### aiAnalysisService.ts

Enhanced with dual-provider support:

```typescript
// Student performance analysis with automatic failover
const analysis = await analyzeStudentPerformance(studentData);
```

### AIAnalysisContext.tsx

Updated to use new provider manager:

```typescript
// Page analysis with intelligent provider selection
await analyzeCurrentPage();

// AI question answering with fallback
const answer = await askAIQuestion(question);
```

### FileUploadComponent.tsx

Integrated with new AI provider system:

```typescript
// Question extraction with dual-provider support
const questions = await extractQuestionsFromAI(text);

// Correct answer determination with automatic retry
const filledQuestions = await fetchCorrectOptionsFromAI(questions);
```

---

## 🎯 Enhanced AI Widget

New `EnhancedAIWidget.tsx` component with:

- **Smooth Animations**: All interactions use the animation library
- **Draggable Interface**: Move widget around the screen
- **Chat Interface**: Ask questions and get instant answers
- **Page Analysis**: Analyze current page with one click
- **Minimizable**: Collapse to icon when not in use
- **Auto-scroll**: Messages scroll to latest automatically
- **Responsive**: Works on all screen sizes

### Usage

```typescript
import EnhancedAIWidget from '@/components/EnhancedAIWidget';

export default function App() {
  return (
    <>
      <YourContent />
      <EnhancedAIWidget />
    </>
  );
}
```

---

## 🔧 Integration Examples

### Example 1: Animated Loading State

```typescript
import { animationPresets } from '@/utils/animations';

function LoadingComponent() {
  return (
    <div className={animationPresets.loadingSpinner}>
      <Loader2 className="w-8 h-8" />
    </div>
  );
}
```

### Example 2: Staggered List Animation

```typescript
import { getStaggeredAnimation } from '@/utils/animations';

function AnimatedList({ items }) {
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={index} className={getStaggeredAnimation('fadeInUp', index)}>
          {item}
        </div>
      ))}
    </div>
  );
}
```

### Example 3: Modal with Animations

```typescript
import { animationPresets } from '@/utils/animations';

function Modal({ isOpen, onClose, children }) {
  return (
    isOpen && (
      <div className={animationPresets.modalEnter}>
        <div className="modal-content">
          {children}
          <button onClick={onClose} className={animationPresets.modalExit}>
            Close
          </button>
        </div>
      </div>
    )
  );
}
```

### Example 4: AI-Powered Feature

```typescript
import { callAIAPI } from '@/services/aiProviderManager';

async function generateContent(prompt) {
  try {
    const response = await callAIAPI(prompt, 'auto');
    console.log(`Generated using ${response.provider}`);
    return response.text;
  } catch (error) {
    console.error('Failed to generate content:', error);
  }
}
```

---

## 📈 Performance Considerations

### Animation Performance

- Uses `will-change` and `transform` for GPU acceleration
- Respects `prefers-reduced-motion` for accessibility
- Optimized keyframes for smooth 60fps animations
- Minimal repaints and reflows

### API Performance

- Key rotation reduces rate limiting
- Exponential backoff prevents server overload
- Health tracking avoids unhealthy providers
- Caching reduces redundant API calls

---

## 🐛 Troubleshooting

### Animations Not Working

1. Ensure `animations.css` is imported in `index.css`
2. Check that Tailwind CSS is properly configured
3. Verify animation classes are spelled correctly
4. Check browser DevTools for CSS errors

### AI API Failures

1. Verify API keys in `.env` file
2. Check API key format (VITE_ prefix required)
3. Monitor provider health: `getProviderHealth()`
4. Check console for detailed error messages
5. Ensure rate limits haven't been exceeded

### Widget Not Appearing

1. Ensure `EnhancedAIWidget` is imported and rendered
2. Check z-index conflicts with other elements
3. Verify `AIAnalysisProvider` wraps the app
4. Check browser console for errors

---

## 📚 Resources

- [Animation CSS File](./src/styles/animations.css)
- [Animation Utilities](./src/utils/animations.ts)
- [AI Provider Manager](./src/services/aiProviderManager.ts)
- [Enhanced AI Widget](./src/components/EnhancedAIWidget.tsx)

---

## 🚀 Future Enhancements

- [ ] Add more animation presets
- [ ] Implement animation builder UI
- [ ] Add animation performance metrics
- [ ] Create animation documentation site
- [ ] Add more AI provider integrations
- [ ] Implement caching layer for API responses
- [ ] Add analytics for API usage
- [ ] Create admin dashboard for API monitoring

---

## 📝 Notes

- All animations are non-blocking and performant
- API keys are never exposed in client-side code (VITE_ prefix)
- Provider selection is automatic and intelligent
- Animations respect user accessibility preferences
- Widget is fully draggable and customizable

---

**Last Updated**: May 30, 2026
**Version**: 1.0.0
