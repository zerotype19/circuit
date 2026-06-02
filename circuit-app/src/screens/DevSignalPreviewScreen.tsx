import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { BackLink } from "../components/BackLink";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { useCircuit } from "../context/CircuitContext";
import { computeNextSevenSignalPreviews } from "../logic/nextSevenSignalPreview";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "DevSignalPreview">;

export function DevSignalPreviewScreen({ navigation }: Props) {
  const { persisted, signalFeedback } = useCircuit();
  const rows = computeNextSevenSignalPreviews({
    toneMode: persisted.settings.toneMode,
    signalHistory: persisted.signalHistory,
    feedbackRecords: signalFeedback,
  });

  return (
    <ScreenScaffold scroll>
      <BackLink navigation={navigation} />
      <Text style={styles.title}>Next 7 signals (dev)</Text>
      <Text style={styles.sub}>
        Uses nextSignalAfter plus selectSignalLine with your local history; each row appends to a scratch
        history for the next pick.
      </Text>
      {rows.map((r, i) => (
        <View key={`${r.at.getTime()}-${r.line.id}-${i}`} style={styles.card}>
          <Text style={styles.meta}>
            {r.at.toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            · {r.slot}
          </Text>
          <Text style={styles.body}>{r.line.text}</Text>
          <Text style={styles.footer}>
            theme: {r.line.theme} · tone: {r.line.tone} · intensity: {r.line.intensity} · id: {r.line.id}
          </Text>
        </View>
      ))}
      {rows.length === 0 ? <Text style={styles.sub}>No upcoming anchors.</Text> : null}
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
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  body: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: spacing.xs,
  },
  footer: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});
