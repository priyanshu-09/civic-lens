import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { theme } from '../theme';

const FeatureCard = ({
  emoji,
  title,
  description,
  delay,
}: {
  emoji: string;
  title: string;
  description: string;
  delay: number;
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - delay, [0, 30, 250], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const scale = interpolate(frame - delay, [0, 30], [0.8, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        padding: 30,
        backgroundColor: theme.bg.card,
        borderRadius: 12,
        border: `2px solid ${theme.colors.cyan}`,
        textAlign: 'center',
        minWidth: 280,
      }}
    >
      <div style={{ fontSize: 56, marginBottom: 15 }}>{emoji}</div>
      <h3
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: theme.colors.text,
          fontFamily: theme.fonts.primary,
          margin: '0 0 10px 0',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 15,
          color: theme.colors.textMuted,
          fontFamily: theme.fonts.primary,
          margin: 0,
          lineHeight: 1.4,
        }}
      >
        {description}
      </p>
    </div>
  );
};

export const FeaturesScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cardsOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fadeOutOpacity = interpolate(frame, [480, 540], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.bg.darker,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        opacity: fadeOutOpacity,
        padding: '40px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: `radial-gradient(circle at 50% 50%, ${theme.colors.cyan}15, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ opacity: titleOpacity, marginBottom: 80 }}>
        <h2
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: theme.colors.cyan,
            margin: 0,
            fontFamily: theme.fonts.primary,
            textAlign: 'center',
          }}
        >
          Why Civic Lens?
        </h2>
      </div>

      <div
        style={{
          opacity: cardsOpacity,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 40,
          maxWidth: 1000,
        }}
      >
        <FeatureCard
          emoji="🎯"
          title="Multiple Violations"
          description="Detects helmet violations, red light jumping, wrong-side driving, and reckless behavior"
          delay={100}
        />
        <FeatureCard
          emoji="🧠"
          title="AI Verification"
          description="Powered by Gemini Flash & Pro for accurate classification and confidence scoring"
          delay={130}
        />
        <FeatureCard
          emoji="👁️"
          title="Full Transparency"
          description="Complete packet lineage tracking from detection through AI verification"
          delay={160}
        />
        <FeatureCard
          emoji="✅"
          title="Human Review"
          description="Reviewers verify all detections before submission to authorities"
          delay={190}
        />
      </div>
    </div>
  );
};
