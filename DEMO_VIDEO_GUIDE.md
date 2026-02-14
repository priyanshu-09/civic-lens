# Civic Lens Demo Video Guide

## Overview

A professional 90-second dark-themed Remotion video has been created to showcase Civic Lens. The video tells a compelling story about the problem of traffic violations in India and how Civic Lens provides an AI-powered solution with human review.

## Quick Start

Navigate to the demo-video directory and follow these steps:

```bash
cd demo-video
npm install
npm run dev
```

This starts the Remotion preview server at `http://localhost:3000` where you can watch and interact with the video.

## Video Structure (90 seconds total)

### Scene 1: The Problem (30 seconds)
- Dark theme with gradient overlays
- Animated statistics about reckless driving, rule violations, and zero civic sense
- Thought-provoking question: "Who holds violators accountable?"
- Icons: 🚗 (reckless), ⛔ (violations), 👥 (accountability)

### Scene 2: The Solution (15 seconds)
- Introduction of Civic Lens branding
- Visual flow showing the concept: Dashcam → AI Analysis → Authorities
- Key tagline: "AI-Powered Traffic Violation Detection"
- Emphasis: "Clear Evidence. Better Enforcement."

### Scene 3: Upload Flow (12 seconds)
- User uploads dashcam video with animated progress bar
- ROI (Region of Interest) configuration visualization
- Animated button press to start analysis

### Scene 4: Processing Pipeline (15 seconds)
- 5-stage pipeline visualization:
  - Ingest (📥)
  - Local Detection (👁️)
  - Gemini Flash (⚡)
  - Gemini Pro (🧠)
  - Postprocess (📊)
- Animated metrics: packets analyzed, violations found
- Real-time progress bars for each stage

### Scene 5: Review & Verification (12 seconds)
- Scrolling violation cards with:
  - Event type and ID
  - Confidence scores
  - Risk level
  - Evidence thumbnails
  - Accept/Reject buttons
- Export case pack button with animation

### Scene 6: Key Features (10 seconds)
- 4 feature cards in 2x2 grid:
  - 🎯 Multiple Violations (helmet, red light, etc.)
  - 🧠 AI Verification (Gemini Flash & Pro)
  - 👁️ Full Transparency (packet lineage)
  - ✅ Human Review (accuracy)

### Scene 7: Closing Call-to-Action (10 seconds)
- Civic Lens branding and mission
- Impact flow: Detect → Verify → Report
- "GET STARTED" button with glow effect
- GitHub repository link

## Design System

### Color Palette
- **Primary Background**: `#0f1419` (dark charcoal) / `#0a0e13` (darker)
- **Card Background**: `#1a2332`
- **Accent Colors**:
  - Cyan: `#00d4ff` (primary highlights, transitions)
  - Orange: `#ff6b35` (secondary, caution)
  - Green: `#00ff88` (success, call-to-action)
  - Red: `#ff4757` (violations, errors)
- **Text**: White with muted gray for secondary content

### Typography
- System font stack: `system-ui, -apple-system, sans-serif`
- Font sizes: 96px (main titles), 64px (subtitles), 32-48px (content)
- Font weights: 600-900 (bold for emphasis)

### Animation Principles
- Smooth easing for text reveals
- Scale animations for card entries
- Opacity transitions for scene changes
- Progress bar animations for metrics
- 30fps video for smooth motion

## File Structure

```
demo-video/
├── README.md                    # Detailed project documentation
├── package.json                 # Dependencies
├── tsconfig.json               # TypeScript configuration
├── remotion.config.ts          # Remotion video settings (1920x1080, 30fps)
├── .gitignore
├── node_modules/
├── src/
│   ├── index.tsx              # Remotion entry point
│   ├── Root.tsx               # Root composition
│   ├── CivicLensDemo.tsx      # Main orchestrator (all scenes)
│   ├── theme.ts               # Global color & animation config
│   ├── components/
│   │   ├── AnimatedText.tsx   # Reusable text component
│   │   └── AnimatedIcon.tsx   # Reusable icon component
│   └── scenes/
│       ├── OpeningScene.tsx       # Problem statement
│       ├── SolutionScene.tsx      # Solution intro
│       ├── UploadFlowScene.tsx    # Upload process
│       ├── ProcessingScene.tsx    # Pipeline stages
│       ├── ReviewScene.tsx        # Review workflow
│       ├── FeaturesScene.tsx      # Feature highlights
│       └── ClosingScene.tsx       # Call-to-action
```

## Rendering

### Preview (Interactive)
```bash
npm run dev
```
Opens Remotion player for real-time editing and preview.

### Build MP4
```bash
npm run build
```
Renders `output.mp4` (H.264 codec, 1920x1080 @ 30fps).

### Build GIF
```bash
npm run build-gif
```
Renders `output.gif` for social media sharing.

## Customization

### Change Colors
Edit `src/theme.ts`:
```typescript
export const theme = {
  colors: {
    cyan: '#00d4ff',      // Primary accent
    orange: '#ff6b35',    // Secondary
    green: '#00ff88',     // Success
    // ... etc
  },
};
```

### Adjust Timing
Each scene has frame-based timing. Edit individual scene files to adjust:
- When animations start (delay parameter)
- Animation duration (duration in interpolate calls)
- When scenes transition (SceneSegment from/to in CivicLensDemo.tsx)

### Modify Content
- Text: Edit strings in each scene component
- Icons: Replace emoji with different ones or SVG components
- Metrics: Adjust interpolate ranges for different numbers

## Technical Details

- **Language**: TypeScript + React
- **Video Renderer**: Remotion 4.x
- **Output Formats**: MP4, GIF
- **Resolution**: 1920x1080 (Full HD)
- **Frame Rate**: 30fps
- **Duration**: 90 seconds (2700 frames)
- **Total Video Size**: ~30-50MB (MP4, depends on codec settings)

## Performance Notes

- Preview mode: Real-time rendering in browser
- Build mode: Server-side rendering (can take 5-10 minutes depending on system)
- No external assets or dependencies needed (pure CSS/React)
- Self-contained and easy to deploy

## Deployment Ideas

1. **GitHub**: Commit to repo, add link in README
2. **YouTube**: Upload rendered MP4 for promotion
3. **Twitter/X**: Convert to GIF for immediate playback
4. **Landing Page**: Embed in promotional website
5. **Pitch Deck**: Include MP4 in Figma/PowerPoint presentations

## Next Steps

1. Review the video in preview mode: `npm run dev`
2. Make any color or timing adjustments as needed
3. Render final version: `npm run build`
4. Share the output.mp4 on social media or embed in promotions
