import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { theme } from '../theme';

const ViolationCard = ({ title, confidence, delay }: { title: string; confidence: number; delay: number }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - delay, [0, 30, 250], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const slideX = interpolate(frame - delay, [0, 30], [-100, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${slideX}px)`,
        padding: 30,
        backgroundColor: theme.bg.card,
        borderRadius: 12,
        border: `2px solid ${theme.colors.cyan}`,
        minWidth: 380,
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 15 }}>
        <div>
          <h3
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: theme.colors.text,
              fontFamily: theme.fonts.primary,
              margin: 0,
            }}
          >
            {title}
          </h3>
          <p
            style={{
              fontSize: 14,
              color: theme.colors.textMuted,
              fontFamily: theme.fonts.primary,
              margin: '8px 0 0 0',
            }}
          >
            Event ID: EVT_12847
          </p>
        </div>
        <div
          style={{
            fontSize: 32,
            opacity: 0.7,
          }}
        >
          {title === 'Red Light Jump' && '🚨'}
          {title === 'Wrong Side Driving' && '🚗'}
          {title === 'No Helmet' && '⛑️'}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 30,
          marginBottom: 20,
          fontSize: 14,
          fontFamily: theme.fonts.primary,
        }}
      >
        <div>
          <span style={{ color: theme.colors.textMuted }}>Confidence:</span>{' '}
          <span style={{ color: theme.colors.cyan, fontWeight: 600 }}>{(confidence * 100).toFixed(0)}%</span>
        </div>
        <div>
          <span style={{ color: theme.colors.textMuted }}>Risk:</span>{' '}
          <span style={{ color: theme.colors.orange, fontWeight: 600 }}>High</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 15,
        }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 80,
              height: 60,
              backgroundColor: theme.bg.darker,
              borderRadius: 6,
              border: `1px solid ${theme.colors.cyan}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              opacity: 0.6,
            }}
          >
            📸
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 12,
        }}
      >
        <button
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: theme.colors.green,
            color: theme.bg.darker,
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: theme.fonts.primary,
          }}
        >
          ACCEPT
        </button>
        <button
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: theme.bg.darker,
            color: theme.colors.red,
            border: `1px solid ${theme.colors.red}`,
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: theme.fonts.primary,
          }}
        >
          REJECT
        </button>
      </div>
    </div>
  );
};

export const ReviewScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const scrollOpacity = interpolate(frame, [60, 90, 420], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const exportOpacity = interpolate(frame, [420, 450, 520], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fadeOutOpacity = interpolate(frame, [520, 590], [1, 0], {
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
        justifyContent: 'flex-start',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        opacity: fadeOutOpacity,
        padding: '60px 40px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: `radial-gradient(circle at 50% 50%, ${theme.colors.orange}15, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ opacity: titleOpacity, marginBottom: 50 }}>
        <h2
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: theme.colors.orange,
            margin: 0,
            fontFamily: theme.fonts.primary,
            textAlign: 'center',
          }}
        >
          3. Review & Verify
        </h2>
      </div>

      <div
        style={{
          opacity: scrollOpacity,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          maxWidth: 500,
          maxHeight: 400,
          overflowY: 'hidden',
        }}
      >
        <ViolationCard title="Red Light Jump" confidence={0.94} delay={120} />
        <ViolationCard title="Wrong Side Driving" confidence={0.87} delay={150} />
        <ViolationCard title="No Helmet" confidence={0.91} delay={180} />
      </div>

      <div
        style={{
          opacity: exportOpacity,
          marginTop: 50,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 80,
            marginBottom: 20,
            color: theme.colors.green,
          }}
        >
          📦
        </div>
        <button
          style={{
            padding: '16px 60px',
            fontSize: 24,
            fontWeight: 600,
            backgroundColor: theme.colors.green,
            color: theme.bg.darker,
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: theme.fonts.primary,
            letterSpacing: 1,
          }}
        >
          EXPORT CASE PACK
        </button>
        <p
          style={{
            fontSize: 16,
            color: theme.colors.textMuted,
            fontFamily: theme.fonts.primary,
            margin: '20px 0 0 0',
          }}
        >
          Generates comprehensive report with evidence & metadata
        </p>
      </div>
    </div>
  );
};
