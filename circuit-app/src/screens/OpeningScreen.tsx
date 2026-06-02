import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { CircuitButton } from "../components/CircuitButton";
import { ScreenScaffold } from "../components/ScreenScaffold";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Opening">;

export function OpeningScreen({ navigation }: Props) {
  return (
    <ScreenScaffold>
      <View style={styles.center}>
        <Text style={styles.title}>Circuit</Text>
        <Text style={styles.tag}>Psychological timing.</Text>
        <View style={styles.spacer} />
        <CircuitButton label="Start" onPress={() => navigation.navigate("Contract")} />
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
  title: {
    color: colors.text,
    fontSize: 40,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  tag: {
    color: colors.muted,
    fontSize: 18,
    marginBottom: spacing.xl,
  },
  spacer: {
    height: spacing.xl,
  },
});
