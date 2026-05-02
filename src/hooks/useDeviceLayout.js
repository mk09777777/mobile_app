import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

const TABLET_MIN_DIMENSION = 768;

const useDeviceLayout = () => {
  const { width, height } = useWindowDimensions();
  const isPortrait = height >= width;
  const isTablet = Math.min(width, height) >= TABLET_MIN_DIMENSION;

  return useMemo(
    () => ({
      width,
      height,
      isTablet,
      isPhone: !isTablet,
      isPortrait,
      isLandscape: !isPortrait,
    }),
    [width, height, isTablet, isPortrait],
  );
};

export default useDeviceLayout;
export { useDeviceLayout };
