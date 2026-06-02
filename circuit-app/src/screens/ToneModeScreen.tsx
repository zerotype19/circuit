import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BackLink } from "../components/BackLink";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { useCircuit } from "../context/CircuitContext";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ToneMode">;

export function ToneModeScreen({ navigation }: Props) {
  const { setToneMode, persisted } = useCircuit();
  const current = persisted.settings.toneMode;

  const choose = async (mode: "direct" | "brutal") => {
    await setToneMode(mode);
    navigation.goBack();
  };

  return (
    <ScreenScaffold scroll>
      <BackLink navigation={navigation} />
      <Text style={styles.title}>Signal tone</Text>
      <Text style={styles.sub}>
        Steady uses the full library. Edged tilts toward higher‑intensity, more confronting lines — still not
        motivation, still not “quotes.”
      </Text>
      <View style={styles.list}>
        <Pressable
          onPress={() => void choose("direct")}
          style={[styles.row, current === "direct" && styles.rowOn]}
        >
          <Text style={[styles.rowText, current === "direct" && styles.rowTextOn]}>Steady</Text>
        </Pressable>
        <Pressable
          onPress={() => void choose("brutal")}
          style={[styles.row, current === "brutal" && styles.rowOn]}
        >
          <Text style={[styles.rowText, current === "brutal" && styles.rowTextOn]}>Edged</Text>
        </Pressable>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 22,
    marginBottom: spacing.sm,
  },
  sub: {
    color: colors.muted,
    fontSize: 15,
    marginBottom: spacing.lg,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
    paddingHorizontal: spacing.sm,
  },
  rowOn: {
    borderColor: colors.text,
  },
  rowText: {
    color: colors.muted,
    fontSize: 17,
  },
  rowTextOn: {
    color: colors.text,
  },
});
