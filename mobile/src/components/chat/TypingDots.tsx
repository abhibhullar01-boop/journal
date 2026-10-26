import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

/** Three quiet dots that fade in turn while the companion thinks. */
export function TypingDots({ color }: { color: string }) {
  const values = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 360, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 360, useNativeDriver: true }),
          Animated.delay((2 - i) * 160 + 120),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [values]);
  return (
    <View style={styles.row} accessibilityLabel="Writing a reply">
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: color,
              opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.9] }),
              transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.1] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 24 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
});
