import React from 'react';
import { Composition } from 'remotion';
import { CivicLensDemo } from './CivicLensDemo';

export const Root: React.FC = () => {
  return (
    <Composition
      id="CivicLensDemo"
      component={CivicLensDemo}
      durationInFrames={2700}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  );
};
