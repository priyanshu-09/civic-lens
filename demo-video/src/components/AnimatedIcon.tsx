import React from 'react';
import { useTransform, useMotionTemplate, interpolate, Easing, useCurrentFrame } from 'remotion';
import { theme } from '../theme';

interface AnimatedIconProps {
  symbol: string;
  size?: number;
  color?: string;
  delay?: number;
  animationType?: 'pulse' | 'bounce' | 'scale';
  duration?: number;
}

export const AnimatedIcon: React.FC<AnimatedIconProps> = ({
  symbol,
  size = 64,
  color = theme.colors.cyan,
  delay = 0,
  animationType = 'scale',
  duration = 30,
}) => {
  const frame = useCurrentFrame();
  const durationFrames = duration;
  const startFrame = delay;
  const progress = Math.max(0, Math.min(1, (frame - startFrame) / durationFrames));

  let opacity = progress < 1 ? progress : 1;
  let scale = 1;
  let rotation = 0;

  if (animationType === 'scale') {
    scale = progress < 1 ? 0.5 + progress * 0.5 : 1;
    opacity = progress < 1 ? progress : 1;
  } else if (animationType === 'pulse') {
    const pulsProgress = (frame - startFrame) % 30 / 30;
    scale = 1 + Math.sin(pulsProgress * Math.PI * 2) * 0.1;
  } else if (animationType === 'bounce') {
    if (progress < 1) {
      scale = 0.8 + Math.sin(progress * Math.PI) * 0.2;
      opacity = progress;
    }
  }

  return (
    <div
      style={{
        fontSize: size,
        opacity,
        transform: `scale(${scale}) rotate(${rotation}deg)`,
        transition: 'transform 0.3s ease-out',
        display: 'inline-block',
        color,
      }}
    >
      {symbol}
    </div>
  );
};
