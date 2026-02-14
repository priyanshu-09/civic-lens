import React from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { theme } from './theme';
import { OpeningScene } from './scenes/OpeningScene';
import { SolutionScene } from './scenes/SolutionScene';
import { UploadFlowScene } from './scenes/UploadFlowScene';
import { ProcessingScene } from './scenes/ProcessingScene';
import { ReviewScene } from './scenes/ReviewScene';
import { FeaturesScene } from './scenes/FeaturesScene';
import { ClosingScene } from './scenes/ClosingScene';

const SceneSegment = ({ from, to, children }: { from: number; to: number; children: React.ReactNode }) => {
  const frame = useCurrentFrame();
  const isVisible = frame >= from && frame < to;

  if (!isVisible) {
    return null;
  }

  return <>{children}</>;
};

export const CivicLensDemo: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg.darker }}>
      <SceneSegment from={0} to={900}>
        <OpeningScene />
      </SceneSegment>

      <SceneSegment from={900} to={1470}>
        <SolutionScene />
      </SceneSegment>

      <SceneSegment from={1470} to={2070}>
        <UploadFlowScene />
      </SceneSegment>

      <SceneSegment from={2070} to={2670}>
        <ProcessingScene />
      </SceneSegment>

      <SceneSegment from={2670} to={3270}>
        <ReviewScene />
      </SceneSegment>

      <SceneSegment from={3270} to={3870}>
        <FeaturesScene />
      </SceneSegment>

      <SceneSegment from={3870} to={4620}>
        <ClosingScene />
      </SceneSegment>
    </AbsoluteFill>
  );
};
