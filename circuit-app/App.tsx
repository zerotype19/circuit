import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { InterruptOverlay } from "./src/components/InterruptOverlay";
import { CircuitProvider, useCircuit } from "./src/context/CircuitContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { colors } from "./src/theme";

function BootShell() {
  const circuit = useCircuit();
  const priorDeliveriesToday = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = start + 86400000;
    const n = circuit.persisted.signalHistory.filter((h) => h.at >= start && h.at < end).length;
    // Current interrupt is already in history when the overlay mounts — soften from *prior* count.
    if (circuit.interruptVisible && n > 0) {
      return n - 1;
    }
    return n;
  }, [circuit.persisted.signalHistory, circuit.interruptVisible]);

  if (!circuit.hydrated) {
    return <View style={styles.boot} />;
  }
  return (
    <>
      <RootNavigator />
      <InterruptOverlay
        visible={circuit.interruptVisible}
        message={circuit.interruptMessage}
        signalKind={circuit.interruptKind}
        priorDeliveriesToday={priorDeliveriesToday}
        interruptDeliveryId={circuit.interruptDeliveryId}
        interruptFeedback={circuit.interruptFeedback}
        onSubmitInterruptFeedback={circuit.submitInterruptFeedback}
        onDismiss={circuit.dismissInterrupt}
      />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <CircuitProvider>
        <BootShell />
        <StatusBar style="light" />
      </CircuitProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
