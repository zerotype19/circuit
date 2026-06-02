import type { NavigationProp } from "@react-navigation/native";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../theme";
import type { RootStackParamList } from "../navigation/types";

type Props = {
  navigation: NavigationProp<RootStackParamList>;
};

export function BackLink({ navigation }: Props) {
  return (
    <Pressable onPress={() => navigation.goBack()} style={styles.wrap} hitSlop={12}>
      <Text style={styles.text}>Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
    marginBottom: 24,
    paddingVertical: 4,
  },
  text: {
    color: colors.muted,
    fontSize: 16,
  },
});
