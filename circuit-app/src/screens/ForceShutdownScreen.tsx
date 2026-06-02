import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { CircuitButton } from "../components/CircuitButton";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { useCircuit } from "../context/CircuitContext";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Shutdown">;

export function ForceShutdownScreen({ navigation }: Props) {
  const { endForceShutdownEarly } = useCircuit();

  return (
    <ScreenScaffold>
      <View style={styles.center}>
        <Text style={styles.body}>
          Circuit is silent for 15 minutes.{"\n\n"}Put the phone down.
        </Text>
        <View style={styles.spacer} />
        <CircuitButton
          label="End Early"
          onPress={() => {
            void endForceShutdownEarly().then(() => navigation.goBack());
          }}
        />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: spacing.xl,
  },
  body: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 30,
  },
  spacer: {
    height: spacing.xl,
  },
});
