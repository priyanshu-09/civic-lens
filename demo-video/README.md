# Civic Lens Demo Video

A dark-themed Remotion video demonstrating the Civic Lens platform - an AI-powered traffic violation detection system.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the preview server:
```bash
npm run dev
```

This opens the Remotion player at `http://localhost:3000` where you can preview the video.

## Build

Render the video as an MP4:
```bash
npm run build
```

Or as a GIF:
```bash
npm run build-gif
```

Output files will be created in the root directory.

## Video Structure

The video is approximately 90 seconds (2700 frames at 30fps) and consists of 7 scenes:

1. **Opening Scene (30 sec)** - The Problem: Reckless driving, rule violations, zero civic sense
2. **Solution Scene (15 sec)** - Introduction to Civic Lens and the core concept
3. **Upload Flow Scene (12 sec)** - User uploads dashcam video and configures ROI
4. **Processing Scene (15 sec)** - AI pipeline stages with metrics
5. **Review Scene (12 sec)** - Reviewers verify violations before submission
6. **Features Scene (10 sec)** - Key features highlighted
7. **Closing Scene (10 sec)** - Call-to-action and final message

## Dark Theme Colors

- **Primary Background**: Deep charcoal (#0f1419, #0a0e13)
- **Card Background**: #1a2332
- **Accent Colors**:
  - Cyan: #00d4ff (primary highlight)
  - Orange: #ff6b35 (secondary)
  - Green: #00ff88 (success/call-to-action)
  - Red: #ff4757 (violations/errors)

## File Structure

```
src/
├── theme.ts                 # Color and animation configuration
├── components/
│   ├── AnimatedText.tsx    # Reusable animated text component
│   └── AnimatedIcon.tsx    # Reusable animated icon component
├── scenes/
│   ├── OpeningScene.tsx    # Problem statement
│   ├── SolutionScene.tsx   # Solution introduction
│   ├── UploadFlowScene.tsx # Upload process
│   ├── ProcessingScene.tsx # Pipeline visualization
│   ├── ReviewScene.tsx     # Review workflow
│   ├── FeaturesScene.tsx   # Feature highlights
│   └── ClosingScene.tsx    # Call-to-action
├── CivicLensDemo.tsx       # Main orchestration component
├── Root.tsx                # Remotion composition root
└── index.tsx               # Entry point
```

## Customization

You can customize:
- Colors in `src/theme.ts`
- Animation timing in individual scene files
- Text content in each scene component
- Video duration in `remotion.config.ts`
