import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { pickDailyFocusLine } from "../data/signalBanks";
import { CircuitButton } from "../components/CircuitButton";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { useCircuit } from "../context/CircuitContext";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const {
    persisted,
    nextSignalSummary,
    dayMode,
    startForceShutdown,
    bumpSchedulePreview,
  } = useCircuit();

  useFocusEffect(
    useCallback(() => {
      bumpSchedulePreview();
    }, [bumpSchedulePreview])
  );

  const shutdownActive = Boolean(
    persisted.settings.shutdownUntil && persisted.settings.shutdownUntil > Date.now()
  );
  const pauseActive = Boolean(
    persisted.settings.pauseSignalsUntil && persisted.settings.pauseSignalsUntil > Date.now()
  );

  const focusLine = useMemo(() => pickDailyFocusLine(), []);

  const nextLine = shutdownActive
    ? "Signals paused during silent window."
    : pauseActive
      ? `Signals paused until ${new Date(persisted.settings.pauseSignalsUntil!).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}.`
    : nextSignalSummary
      ? `Next signal: ${nextSignalSummary}`
      : "Enable notifications in Settings to schedule signals.";

  return (
    <ScreenScaffold scroll>
      <Text style={styles.header}>Circuit</Text>
      <Text style={styles.next}>{nextLine}</Text>
      <Text style={styles.mode}>
        Mode: {shutdownActive || pauseActive ? "Silent" : dayMode}
      </Text>
      {!shutdownActive && !pauseActive ? (
        <>
          <Text style={styles.focusLabel}>Today’s focus</Text>
          <Text style={styles.focus}>{focusLine}</Text>
        </>
      ) : null}
      <Text style={styles.localNote}>Local only. Nothing leaves your device.</Text>
      <View style={styles.actions}>
        <CircuitButton
          label="Force Shutdown (15 min)"
          onPress={() => {
            void startForceShutdown().then(() => navigation.navigate("Shutdown"));
          }}
        />
        <View style={styles.gap} />
        <CircuitButton label="Settings" variant="secondary" onPress={() => navigation.navigate("Settings")} />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  header: {
    color: colors.text,
    fontSize: 28,
    marginBottom: spacing.lg,
  },
  next: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 28,
    marginBottom: spacing.sm,
  },
  mode: {
    color: colors.muted,
    fontSize: 16,
    marginBottom: spacing.lg,
  },
  focusLabel: {
    color: colors.muted,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  focus: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 26,
    marginBottom: spacing.lg,
  },
  localNote: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  actions: {
    marginTop: spacing.md,
  },
  gap: {
    height: spacing.sm,
  },
});
