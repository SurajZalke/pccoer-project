# Quick Start Guide: AI & Animations

## 🚀 Getting Started

### 1. Environment Setup

Your `.env` file needs these API keys configured (get your own from Google AI Studio and Groq Console — do not reuse any keys that were previously committed to this repo, they should be treated as compromised):

```env
VITE_GEMINI_KEYS=["your-gemini-key-1","your-gemini-key-2","your-gemini-key-3"]
VITE_GROQ_KEYS=["your-groq-key-1","your-groq-key-2"]
```

### 2. Build & Run

```bash
# Install dependencies (if needed)
npm install

# Development
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

### 3. Using the Enhanced AI Widget

The widget is automatically available in your app. It provides:
- 💬 Chat interface for asking questions
- ⚡ Page analysis with one click
- 🎯 Draggable interface
- 📱 Responsive design

### 4. Using Animations

Add animations to any element:

```tsx
import { animationClasses, animationPresets } from '@/utils/animations';

// Simple fade in
<div className={animationClasses.fadeInUp}>Content</div>

// Use presets
<div className={animationPresets.cardEnter}>Card</div>

// Hover animation
<button className="hover-scale-up">Hover me</button>
```

### 5. Using AI Provider Manager

```tsx
import { callAIAPI } from '@/services/aiProviderManager';

// Generate content with automatic failover
const response = await callAIAPI('Your prompt here');
console.log(response.text);        // AI response
console.log(response.provider);    // 'groq' or 'gemini'
```

---

## 📊 What Changed

### Services Updated
- ✅ `aiExplanationService.ts` - Now uses dual providers
- ✅ `aiAnalysisService.ts` - Now uses dual providers
- ✅ `AIAnalysisContext.tsx` - Now uses dual providers
- ✅ `FileUploadComponent.tsx` - Now uses dual providers

### New Files
- ✅ `src/services/aiProviderManager.ts` - AI provider management
- ✅ `src/components/EnhancedAIWidget.tsx` - Enhanced AI widget
- ✅ `src/utils/animations.ts` - Animation utilities
- ✅ `src/styles/animations.css` - 30+ animations

### Configuration
- ✅ `.env` - Updated with new API keys
- ✅ `src/index.css` - Added animations import

---

## 🎨 Animation Examples

### Fade In
```tsx
<div className="animate-fade-in">Fades in smoothly</div>
```

### Scale In
```tsx
<div className="animate-scale-in">Scales in from small</div>
```

### Slide In
```tsx
<div className="animate-slide-in-left">Slides in from left</div>
```

### Bounce
```tsx
<div className="animate-bounce">Bounces continuously</div>
```

### Pulse
```tsx
<div className="animate-pulse">Pulses gently</div>
```

### Spin
```tsx
<div className="animate-spin">Spins continuously</div>
```

### Staggered List
```tsx
import { getStaggeredAnimation } from '@/utils/animations';

{items.map((item, index) => (
  <div key={index} className={getStaggeredAnimation('fadeInUp', index)}>
    {item}
  </div>
))}
```

---

## 🤖 AI Provider Strategy

### How It Works

1. **GROQ First** (Default)
   - Faster response times
   - Lower latency
   - Cost-effective

2. **Automatic Failover**
   - If GROQ fails → tries Gemini
   - If Gemini fails → tries next GROQ key
   - Continues until success or all keys exhausted

3. **Smart Retry**
   - Exponential backoff: 1s → 2s → 4s
   - Random jitter to prevent thundering herd
   - Max 3 attempts per provider

### Monitoring

```tsx
import { getProviderHealth, getAPIStats } from '@/services/aiProviderManager';

// Check provider health
const health = getProviderHealth();
console.log(health.groq.isHealthy);
console.log(health.gemini.failureCount);

// Get API statistics
const stats = getAPIStats();
console.log(stats.groq.totalKeys);
console.log(stats.gemini.currentKeyIndex);
```

---

## 🔧 Troubleshooting

### Animations Not Working?
1. Check that `animations.css` is imported in `index.css`
2. Verify Tailwind CSS is properly configured
3. Check browser DevTools for CSS errors
4. Clear browser cache and rebuild

### AI API Failing?
1. Verify API keys in `.env` file
2. Check API key format (must have `VITE_` prefix)
3. Monitor provider health: `getProviderHealth()`
4. Check console for detailed error messages
5. Ensure rate limits haven't been exceeded

### Widget Not Showing?
1. Ensure `AIAnalysisProvider` wraps your app
2. Check z-index conflicts with other elements
3. Verify `EnhancedAIWidget` is imported and rendered
4. Check browser console for errors

---

## 📚 Documentation

- **Full Guide**: `AI_FEATURES_GUIDE.md`
- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`
- **This File**: `QUICK_START.md`

---

## ✨ Key Features

### AI Provider Manager
- ✅ Dual provider support (GROQ + Gemini)
- ✅ Automatic failover
- ✅ Key rotation
- ✅ Rate limit handling
- ✅ Health tracking
- ✅ Exponential backoff

### Animation System
- ✅ 30+ professional animations
- ✅ TypeScript utilities
- ✅ Animation presets
- ✅ Staggered animations
- ✅ Accessibility support
- ✅ GPU acceleration

### Enhanced Widget
- ✅ Draggable interface
- ✅ Chat functionality
- ✅ Page analysis
- ✅ Minimizable state
- ✅ Auto-scrolling
- ✅ Smooth animations

---

## 🎯 Next Steps

1. **Test the AI Widget**
   - Open your app
   - Look for the floating AI widget (bottom right)
   - Try asking a question
   - Try analyzing the current page

2. **Add Animations**
   - Add animation classes to your components
   - Use animation presets for common patterns
   - Test staggered animations on lists

3. **Monitor API Usage**
   - Check provider health regularly
   - Monitor API statistics
   - Adjust retry logic if needed

4. **Customize**
   - Modify animation durations in `animations.css`
   - Adjust widget styling in `EnhancedAIWidget.tsx`
   - Add more animation presets as needed

---

## 📞 Support

For issues or questions:
1. Check the documentation files
2. Review console error messages
3. Check provider health status
4. Verify API keys are correct
5. Clear cache and rebuild

---

## 🎉 You're All Set!

Your application now has:
- ✅ Intelligent AI provider management
- ✅ Beautiful animations throughout
- ✅ Enhanced AI assistant widget
- ✅ Better reliability and performance
- ✅ Improved user experience

Happy coding! 🚀

---

**Last Updated**: May 30, 2026
**Version**: 1.0.0
