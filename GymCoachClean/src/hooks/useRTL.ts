import {useLocale} from '../contexts/LocaleContext';
import {StyleSheet} from 'react-native';

/**
 * Hook to create RTL-aware styles
 */
export function useRTL() {
  const {isRTL} = useLocale();

  const createRTLStyle = (baseStyle: any, rtlOverrides?: any) => {
    if (!isRTL) return baseStyle;

    return StyleSheet.flatten([baseStyle, rtlOverrides]);
  };

  const getRTLFlexDirection = (
    ltrDirection: 'row' | 'row-reverse' | 'column' | 'column-reverse' = 'row',
  ) => {
    if (!isRTL) return ltrDirection;

    switch (ltrDirection) {
      case 'row':
        return 'row-reverse';
      case 'row-reverse':
        return 'row';
      case 'column':
        return 'column';
      case 'column-reverse':
        return 'column-reverse';
      default:
        return ltrDirection;
    }
  };

  const getRTLPosition = (ltrPosition: {left?: number; right?: number}) => {
    if (!isRTL) return ltrPosition;

    const {left, right, ...otherProps} = ltrPosition;
    return {
      ...otherProps,
      left: right,
      right: left,
    };
  };

  return {
    isRTL,
    createRTLStyle,
    getRTLFlexDirection,
    getRTLPosition,
  };
}
