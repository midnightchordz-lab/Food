import React from 'react';
import { Pressable, PressableProps, ViewStyle, StyleProp } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  style?: StyleProp<ViewStyle>;
  /** How far to scale down on press (default 0.96) */
  activeScale?: number;
  children?: React.ReactNode;
};

/**
 * A Pressable that smoothly scales + softens opacity on press, giving a
 * gentle, springy tap feel. Drop-in replacement for Pressable.
 */
export function PressableScale({ style, activeScale = 0.96, children, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        scale.value = withTiming(activeScale, { duration: 120, easing: Easing.out(Easing.quad) });
        opacity.value = withTiming(0.92, { duration: 120 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
        opacity.value = withTiming(1, { duration: 160 });
        onPressOut?.(e);
      }}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
