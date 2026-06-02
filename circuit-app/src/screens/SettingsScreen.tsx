import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { useCircuit } from "../context/CircuitContext";
import type { RootStackParamList } from "../navigation/types";
import type { AnchorSlotKind } from "../types";
import { colors, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Text style={styles.rowText}>{label}</Text>
    </Pressable>
  );
}

function confirmTestSlot(kind: AnchorSlotKind, title: string, send: (k: AnchorSlotKind) => Promise<void>) {
  Alert.alert(title, "Uses the real signal engine, haptics, and overlay for this slot.", [
    { text: "Cancel", style: "cancel" },
    { text: "Send", onPress: () => void send(kind) },
  ]);
}

export function SettingsScreen({ navigation }: Props) {
  const {
    resetLocalData,
    sendTestSignalForKind,
    pauseSignalsTonight,
    pauseSignals24Hours,
    pauseSignalsThroughWeekend,
    clearSignalPause,
  } = useCircuit();

  const onReset = () => {
    Alert.alert("Reset Local Data", "This clears logs and settings.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: () => {
          void resetLocalData().then(() => navigation.reset({ index: 0, routes: [{ name: "Opening" }] }));
        },
      },
    ]);
  };

  const onPause = () => {
    Alert.alert("Pause signals", "Recurring anchors stop until the window ends. Nothing leaves your device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Until next 6am",
        onPress: () => void pauseSignalsTonight(),
      },
      {
        text: "24 hours",
        onPress: () => void pauseSignals24Hours(),
      },
      {
        text: "Until Mon 6am",
        onPress: () => void pauseSignalsThroughWeekend(),
      },
      {
        text: "Resume signals",
        onPress: () => void clearSignalPause(),
      },
    ]);
  };

  return (
    <ScreenScaffold scroll>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.list}>
        <Row label="Signal tone" onPress={() => navigation.navigate("ToneMode")} />
        <Row label="Pause signals…" onPress={onPause} />
        <Row
          label="Test morning signal"
          onPress={() => confirmTestSlot("morning", "Test morning signal", sendTestSignalForKind)}
        />
        <Row
          label="Test evening signal"
          onPress={() => confirmTestSlot("evening", "Test evening signal", sendTestSignalForKind)}
        />
        <Row
          label="Test Sunday signal"
          onPress={() => confirmTestSlot("sunday", "Test Sunday signal", sendTestSignalForKind)}
        />
        <Row
          label="Test late night signal"
          onPress={() => confirmTestSlot("lateNight", "Test late night signal", sendTestSignalForKind)}
        />
        {__DEV__ ? (
          <Row label="Next 7 signals preview (dev)" onPress={() => navigation.navigate("DevSignalPreview")} />
        ) : null}
        <Row label="Privacy" onPress={() => navigation.navigate("Privacy")} />
        <Row label="Reset Local Data" onPress={onReset} />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 26,
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
  rowPressed: {
    opacity: 0.7,
  },
  rowText: {
    color: colors.text,
    fontSize: 17,
  },
});
