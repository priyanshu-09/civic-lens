import React from 'react';
import { useMotionTemplate, useSpring, useTransform } from 'remotion';
import { theme } from '../theme';

interface AnimatedTextProps {
  text: string;
  fontSize?: number;
  fontWeight?: number;
  delay?: number;
  duration?: number;
  color?: string;
  letterSpacing?: number;
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  fontSize = 48,
  fontWeight = 600,
  delay = 0,
  duration = 30,
  color = theme.colors.text,
  letterSpacing = 0,
}) => {
  const spring = useSpring({
    from: { opacity: 0, y: 20 },
    to: { opacity: 1, y: 0 },
    config: { damping: 8, mass: 1 },
    delay,
    durationInFrames: duration,
  });

  return (
    <div
      style={{
        opacity: spring.opacity,
        transform: spring.y.get ? `translateY(${spring.y.get()}px)` : 'translateY(0)',
        fontSize,
        fontWeight,
        color,
        fontFamily: theme.fonts.primary,
        letterSpacing,
        textAlign: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
};
