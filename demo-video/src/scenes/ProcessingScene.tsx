import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { theme } from '../theme';

const Stage = ({
  name,
  emoji,
  isActive,
  progress
}: {
  name: string;
  emoji: string;
  isActive: boolean;
  progress: number;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 15 }}>
    <div
      style={{
        fontSize: 60,
        opacity: isActive ? 1 : 0.4,
        transition: 'opacity 0.3s',
      }}
    >
      {emoji}
    </div>
    <p
      style={{
        fontSize: 18,
        color: isActive ? theme.colors.cyan : theme.colors.textMuted,
        fontFamily: theme.fonts.primary,
        margin: 0,
        fontWeight: isActive ? 600 : 400,
        transition: 'color 0.3s',
      }}
    >
      {name}
    </p>
    <div
      style={{
        width: 120,
        height: 4,
        backgroundColor: theme.bg.card,
        borderRadius: 2,
        overflow: 'hidden',
        marginTop: 5,
      }}
    >
      <div
        style={{
          width: `${Math.max(0, progress * 100)}%`,
          height: '100%',
          backgroundColor: theme.colors.cyan,
        }}
      />
    </div>
  </div>
);

export const ProcessingScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const stagesOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const metricsOpacity = interpolate(frame, [240, 270], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fadeOutOpacity = interpolate(frame, [500, 570], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const ingestProgress = interpolate(frame, [90, 150], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const localProgress = interpolate(frame, [150, 210], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const flashProgress = interpolate(frame, [210, 270], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const proProgress = interpolate(frame, [270, 330], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const postProgress = interpolate(frame, [330, 390], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const packetsCount = interpolate(frame, [240, 330], [0, 245], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const violationsCount = interpolate(frame, [330, 420], [0, 12], {
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
          background: `radial-gradient(circle at 50% 50%, ${theme.colors.green}15, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ opacity: titleOpacity, marginBottom: 60 }}>
        <h2
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: theme.colors.green,
            margin: 0,
            fontFamily: theme.fonts.primary,
            textAlign: 'center',
          }}
        >
          2. AI Processing Pipeline
        </h2>
      </div>

      <div
        style={{
          opacity: stagesOpacity,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 30,
          marginBottom: 80,
          maxWidth: 1300,
        }}
      >
        <Stage
          name="Ingest"
          emoji="📥"
          isActive={ingestProgress > 0}
          progress={ingestProgress}
        />
        <Stage
          name="Local Detection"
          emoji="👁️"
          isActive={localProgress > 0}
          progress={localProgress}
        />
        <Stage
          name="Gemini Flash"
          emoji="⚡"
          isActive={flashProgress > 0}
          progress={flashProgress}
        />
        <Stage
          name="Gemini Pro"
          emoji="🧠"
          isActive={proProgress > 0}
          progress={proProgress}
        />
        <Stage
          name="Postprocess"
          emoji="📊"
          isActive={postProgress > 0}
          progress={postProgress}
        />
      </div>

      <div
        style={{
          opacity: metricsOpacity,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 60,
          maxWidth: 900,
        }}
      >
        <div
          style={{
            padding: 40,
            backgroundColor: theme.bg.card,
            borderRadius: 12,
            border: `2px solid ${theme.colors.cyan}`,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 60,
              fontWeight: 700,
              color: theme.colors.cyan,
              fontFamily: 'monospace',
              margin: 0,
            }}
          >
            {Math.round(packetsCount)}
          </div>
          <p
            style={{
              fontSize: 20,
              color: theme.colors.textMuted,
              fontFamily: theme.fonts.primary,
              margin: '15px 0 0 0',
            }}
          >
            Packets Analyzed
          </p>
        </div>

        <div
          style={{
            padding: 40,
            backgroundColor: theme.bg.card,
            borderRadius: 12,
            border: `2px solid ${theme.colors.orange}`,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 60,
              fontWeight: 700,
              color: theme.colors.orange,
              fontFamily: 'monospace',
              margin: 0,
            }}
          >
            {Math.round(violationsCount)}
          </div>
          <p
            style={{
              fontSize: 20,
              color: theme.colors.textMuted,
              fontFamily: theme.fonts.primary,
              margin: '15px 0 0 0',
            }}
          >
            Violations Found
          </p>
        </div>
      </div>
    </div>
  );
};
