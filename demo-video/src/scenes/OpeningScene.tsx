import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { theme } from '../theme';
import { AnimatedText } from '../components/AnimatedText';
import { AnimatedIcon } from '../components/AnimatedIcon';

export const OpeningScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 20, 120], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const stat1Opacity = interpolate(frame, [60, 80, 200], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const stat2Opacity = interpolate(frame, [120, 140, 260], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const stat3Opacity = interpolate(frame, [180, 200, 320], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const questionOpacity = interpolate(frame, [240, 260, 400], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fadeOutOpacity = interpolate(frame, [820, 900], [1, 0], {
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
          background: `radial-gradient(circle at 50% 50%, ${theme.colors.orange}15, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ opacity: titleOpacity, marginBottom: 100 }}>
        <h1
          style={{
            fontSize: 96,
            fontWeight: 800,
            color: theme.colors.cyan,
            margin: 0,
            fontFamily: theme.fonts.primary,
            textAlign: 'center',
            letterSpacing: 2,
          }}
        >
          The Problem
        </h1>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 60,
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
          maxWidth: 1600,
          padding: '0 60px',
        }}
      >
        <div
          style={{
            opacity: stat1Opacity,
            flex: 1,
            minWidth: 300,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 72, marginBottom: 20, color: theme.colors.red }}>
            🚗
          </div>
          <p
            style={{
              fontSize: 32,
              color: theme.colors.text,
              fontFamily: theme.fonts.primary,
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Reckless Driving
          </p>
          <p
            style={{
              fontSize: 20,
              color: theme.colors.textMuted,
              fontFamily: theme.fonts.primary,
              margin: '10px 0 0 0',
            }}
          >
            Zero regard for safety
          </p>
        </div>

        <div
          style={{
            opacity: stat2Opacity,
            flex: 1,
            minWidth: 300,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 72, marginBottom: 20, color: theme.colors.orange }}>
            ⛔
          </div>
          <p
            style={{
              fontSize: 32,
              color: theme.colors.text,
              fontFamily: theme.fonts.primary,
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Rule Violations
          </p>
          <p
            style={{
              fontSize: 20,
              color: theme.colors.textMuted,
              fontFamily: theme.fonts.primary,
              margin: '10px 0 0 0',
            }}
          >
            Red lights, wrong lanes, no helmet
          </p>
        </div>

        <div
          style={{
            opacity: stat3Opacity,
            flex: 1,
            minWidth: 300,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 72, marginBottom: 20, color: theme.colors.green }}>
            👥
          </div>
          <p
            style={{
              fontSize: 32,
              color: theme.colors.text,
              fontFamily: theme.fonts.primary,
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Zero Civic Sense
          </p>
          <p
            style={{
              fontSize: 20,
              color: theme.colors.textMuted,
              fontFamily: theme.fonts.primary,
              margin: '10px 0 0 0',
            }}
          >
            No accountability for violators
          </p>
        </div>
      </div>

      <div style={{ opacity: questionOpacity, marginTop: 120 }}>
        <p
          style={{
            fontSize: 48,
            fontWeight: 600,
            color: theme.colors.cyan,
            fontFamily: theme.fonts.primary,
            margin: 0,
            textAlign: 'center',
            maxWidth: 1200,
          }}
        >
          Who holds violators accountable?
        </p>
      </div>
    </div>
  );
};
