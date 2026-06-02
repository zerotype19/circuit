import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text } from "react-native";
import { BackLink } from "../components/BackLink";
import { ScreenScaffold } from "../components/ScreenScaffold";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Privacy">;

const copy = [
  "Circuit runs locally.",
  "",
  "Signals follow your device clock and timezone — mornings, mid-days, evenings, Sundays, late nights.",
  "They arrive as local notifications and, when you’re in the app, as a full-screen moment with haptics.",
  "Circuit does not read which apps you use.",
  "",
  "No account.",
  "No cloud sync.",
  "No behavioral data sent anywhere.",
  "",
  "Nothing leaves your device.",
].join("\n");

export function PrivacyScreen({ navigation }: Props) {
  return (
    <ScreenScaffold scroll>
      <BackLink navigation={navigation} />
      <Text style={styles.body}>{copy}</Text>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 28,
    marginBottom: spacing.lg,
  },
});
