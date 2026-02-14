import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { theme } from '../theme';

export const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();

  const logoOpacity = interpolate(frame, [0, 30, 150], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleOpacity = interpolate(frame, [60, 90, 250], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const descriptionOpacity = interpolate(frame, [120, 150, 350], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const impactOpacity = interpolate(frame, [200, 230, 450], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const ctaOpacity = interpolate(frame, [280, 310, 500], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const finalFadeOpacity = interpolate(frame, [550, 600], [1, 0], {
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
        opacity: finalFadeOpacity,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: `radial-gradient(circle at 50% 50%, ${theme.colors.green}15, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ opacity: logoOpacity, marginBottom: 40 }}>
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
            fontSize: 72,
            fontWeight: 900,
            color: theme.colors.text,
            margin: 0,
            fontFamily: theme.fonts.primary,
            textAlign: 'center',
            letterSpacing: 2,
            textShadow: `0 0 40px ${theme.colors.cyan}40`,
          }}
        >
          Civic Lens
        </h1>
      </div>

      <div style={{ opacity: titleOpacity, marginBottom: 40 }}>
        <h2
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: theme.colors.green,
            margin: 0,
            fontFamily: theme.fonts.primary,
            textAlign: 'center',
          }}
        >
          Making Roads Safer
        </h2>
      </div>

      <div style={{ opacity: descriptionOpacity, marginBottom: 60, maxWidth: 800 }}>
        <p
          style={{
            fontSize: 28,
            color: theme.colors.textMuted,
            fontFamily: theme.fonts.primary,
            margin: 0,
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          AI-powered accountability for traffic violations
        </p>
      </div>

      <div
        style={{
          opacity: impactOpacity,
          display: 'flex',
          gap: 60,
          marginBottom: 80,
          justifyContent: 'center',
          maxWidth: 1000,
        }}
      >
        <div style={{ textAlign: 'center', flex: 1 }}>
          <p
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: theme.colors.cyan,
              fontFamily: 'monospace',
              margin: 0,
            }}
          >
            Detect
          </p>
          <p
            style={{
              fontSize: 16,
              color: theme.colors.textMuted,
              fontFamily: theme.fonts.primary,
              margin: '10px 0 0 0',
            }}
          >
            Violations automatically
          </p>
        </div>

        <div
          style={{
            color: theme.colors.orange,
            fontSize: 32,
            opacity: 0.5,
          }}
        >
          →
        </div>

        <div style={{ textAlign: 'center', flex: 1 }}>
          <p
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: theme.colors.orange,
              fontFamily: 'monospace',
              margin: 0,
            }}
          >
            Verify
          </p>
          <p
            style={{
              fontSize: 16,
              color: theme.colors.textMuted,
              fontFamily: theme.fonts.primary,
              margin: '10px 0 0 0',
            }}
          >
            With AI & humans
          </p>
        </div>

        <div
          style={{
            color: theme.colors.green,
            fontSize: 32,
            opacity: 0.5,
          }}
        >
          →
        </div>

        <div style={{ textAlign: 'center', flex: 1 }}>
          <p
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: theme.colors.green,
              fontFamily: 'monospace',
              margin: 0,
            }}
          >
            Report
          </p>
          <p
            style={{
              fontSize: 16,
              color: theme.colors.textMuted,
              fontFamily: theme.fonts.primary,
              margin: '10px 0 0 0',
            }}
          >
            To authorities
          </p>
        </div>
      </div>

      <div style={{ opacity: ctaOpacity }}>
        <button
          style={{
            padding: '18px 80px',
            fontSize: 28,
            fontWeight: 700,
            backgroundColor: theme.colors.cyan,
            color: theme.bg.darker,
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
            fontFamily: theme.fonts.primary,
            letterSpacing: 2,
            marginBottom: 40,
            boxShadow: `0 0 30px ${theme.colors.cyan}40`,
          }}
        >
          GET STARTED
        </button>

        <p
          style={{
            fontSize: 18,
            color: theme.colors.textMuted,
            fontFamily: theme.fonts.primary,
            margin: '30px 0 0 0',
            textAlign: 'center',
          }}
        >
          github.com/civic-lens
        </p>
      </div>
    </div>
  );
};
