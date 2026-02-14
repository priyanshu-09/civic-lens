import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { theme } from '../theme';

export const SolutionScene: React.FC = () => {
  const frame = useCurrentFrame();

  const logoOpacity = interpolate(frame, [0, 30, 150], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const logoScale = interpolate(frame, [0, 30, 150], [0.5, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const taglineOpacity = interpolate(frame, [60, 90, 250], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const flowOpacity = interpolate(frame, [150, 180, 400], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fadeOutOpacity = interpolate(frame, [500, 570], [1, 0], {
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

      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          marginBottom: 50,
        }}
      >
        <div
          style={{
            fontSize: 120,
            marginBottom: 20,
            color: theme.colors.cyan,
            textAlign: 'center',
          }}
        >
          📹
        </div>
        <h1
          style={{
            fontSize: 96,
            fontWeight: 900,
            color: theme.colors.text,
            margin: 0,
            fontFamily: theme.fonts.primary,
            textAlign: 'center',
            letterSpacing: 3,
            textShadow: `0 0 40px ${theme.colors.cyan}40`,
          }}
        >
          Civic Lens
        </h1>
      </div>

      <div style={{ opacity: taglineOpacity, marginBottom: 80 }}>
        <p
          style={{
            fontSize: 40,
            color: theme.colors.cyan,
            fontFamily: theme.fonts.primary,
            margin: 0,
            textAlign: 'center',
            fontWeight: 500,
          }}
        >
          AI-Powered Traffic Violation Detection
        </p>
      </div>

      <div
        style={{
          opacity: flowOpacity,
          display: 'flex',
          alignItems: 'center',
          gap: 60,
          fontSize: 72,
          maxWidth: 1000,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 10 }}>📸</div>
          <p
            style={{
              fontSize: 20,
              color: theme.colors.textMuted,
              fontFamily: theme.fonts.primary,
              margin: 0,
            }}
          >
            Dashcam
          </p>
        </div>

        <div
          style={{
            color: theme.colors.orange,
            fontSize: 48,
            fontWeight: 300,
          }}
        >
          →
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 10 }}>🤖</div>
          <p
            style={{
              fontSize: 20,
              color: theme.colors.textMuted,
              fontFamily: theme.fonts.primary,
              margin: 0,
            }}
          >
            AI Analysis
          </p>
        </div>

        <div
          style={{
            color: theme.colors.orange,
            fontSize: 48,
            fontWeight: 300,
          }}
        >
          →
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 10 }}>⚖️</div>
          <p
            style={{
              fontSize: 20,
              color: theme.colors.textMuted,
              fontFamily: theme.fonts.primary,
              margin: 0,
            }}
          >
            Authorities
          </p>
        </div>
      </div>

      <div style={{ marginTop: 100, opacity: taglineOpacity, textAlign: 'center' }}>
        <p
          style={{
            fontSize: 32,
            color: theme.colors.green,
            fontFamily: theme.fonts.primary,
            margin: 0,
            fontWeight: 600,
          }}
        >
          Clear Evidence. Better Enforcement.
        </p>
      </div>
    </div>
  );
};
