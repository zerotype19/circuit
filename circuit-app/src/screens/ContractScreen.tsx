import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { CircuitButton } from "../components/CircuitButton";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { useCircuit } from "../context/CircuitContext";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Contract">;

const body = [
  "Circuit interrupts at four sharp moments — morning before work, evening closure, Sunday night, late night spirals.",
  "",
  "It does not watch your apps.",
  "It uses the clock, your timezone, and careful language.",
  "",
  "Everything stays on this device.",
  "No account. No cloud. No analytics.",
];

export function ContractScreen({ navigation }: Props) {
  const { completeOnboardingFlow } = useCircuit();

  return (
    <ScreenScaffold scroll>
      <Text style={styles.block}>{body.join("\n")}</Text>
      <View style={styles.footer}>
        <CircuitButton
          label="Activate"
          onPress={() => {
            void completeOnboardingFlow().then(() =>
              navigation.reset({ index: 0, routes: [{ name: "Home" }] })
            );
          }}
        />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  block: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 28,
    marginBottom: spacing.lg,
  },
  footer: {
    marginTop: spacing.lg,
  },
});
