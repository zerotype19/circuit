import { Pressable, StyleSheet, Text, type PressableProps, type TextStyle, type ViewStyle } from "react-native";
import { colors } from "../theme";

type Props = Omit<PressableProps, "style"> & {
  label: string;
  variant?: "primary" | "secondary";
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle;
};

export function CircuitButton({ label, variant = "primary", style, textStyle, ...rest }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        variant === "primary" ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        ...(Array.isArray(style) ? style : style ? [style] : []),
      ]}
      {...rest}
    >
      <Text style={[styles.label, textStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  primary: {
    backgroundColor: colors.background,
  },
  secondary: {
    backgroundColor: colors.background,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    color: colors.text,
    fontSize: 18,
    letterSpacing: 0.5,
  },
});
