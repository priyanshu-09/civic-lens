import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { theme } from '../theme';

export const UploadFlowScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 20, 150], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const uploadIconOpacity = interpolate(frame, [60, 90, 250], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const uploadProgress = interpolate(frame, [120, 200], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const roiOpacity = interpolate(frame, [240, 270, 400], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const buttonOpacity = interpolate(frame, [330, 360, 480], [0, 1, 1], {
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
          background: `radial-gradient(circle at 50% 50%, ${theme.colors.orange}15, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ opacity: titleOpacity, marginBottom: 80 }}>
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
          1. Upload Dashcam Video
        </h2>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 100,
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: 1200,
        }}
      >
        <div
          style={{
            opacity: uploadIconOpacity,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 30,
          }}
        >
          <div
            style={{
              fontSize: 100,
              color: theme.colors.cyan,
            }}
          >
            📹
          </div>
          <div
            style={{
              width: 300,
              height: 8,
              backgroundColor: theme.bg.card,
              borderRadius: 4,
              overflow: 'hidden',
              border: `2px solid ${theme.colors.cyan}`,
            }}
          >
            <div
              style={{
                width: `${uploadProgress * 100}%`,
                height: '100%',
                backgroundColor: theme.colors.cyan,
                transition: 'width 0.1s linear',
              }}
            />
          </div>
          <p
            style={{
              fontSize: 24,
              color: theme.colors.textMuted,
              fontFamily: theme.fonts.primary,
              margin: 0,
            }}
          >
            {Math.round(uploadProgress * 100)}% Complete
          </p>
        </div>

        <div style={{ opacity: roiOpacity }}>
          <div
            style={{
              padding: 40,
              backgroundColor: theme.bg.card,
              borderRadius: 12,
              border: `2px solid ${theme.colors.green}`,
              minWidth: 400,
            }}
          >
            <p
              style={{
                fontSize: 20,
                color: theme.colors.green,
                fontFamily: theme.fonts.primary,
                margin: '0 0 20px 0',
                fontWeight: 600,
              }}
            >
              Configure ROI (Region of Interest)
            </p>

            <div
              style={{
                backgroundColor: theme.bg.darker,
                borderRadius: 8,
                padding: 20,
                marginBottom: 15,
                border: `1px solid ${theme.colors.cyan}40`,
              }}
            >
              <p
                style={{
                  fontSize: 14,
                  color: theme.colors.textMuted,
                  fontFamily: 'monospace',
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                {`{`}
                <br />
                {`  "zones": [{`}
                <br />
                {`    "x": 100, "y": 50,`}
                <br />
                {`    "width": 1720, "height": 600`}
                <br />
                {`  }]`}
                <br />
                {`}`}
              </p>
            </div>

            <p
              style={{
                fontSize: 16,
                color: theme.colors.textMuted,
                fontFamily: theme.fonts.primary,
                margin: 0,
              }}
            >
              Define areas to analyze
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          opacity: buttonOpacity,
          marginTop: 80,
          display: 'flex',
          gap: 20,
          justifyContent: 'center',
        }}
      >
        <button
          style={{
            padding: '16px 60px',
            fontSize: 24,
            fontWeight: 600,
            backgroundColor: theme.colors.cyan,
            color: theme.bg.darker,
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: theme.fonts.primary,
            letterSpacing: 1,
          }}
        >
          ANALYZE
        </button>
      </div>
    </div>
  );
};
