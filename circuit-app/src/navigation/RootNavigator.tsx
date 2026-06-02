import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useCircuit } from "../context/CircuitContext";
import { ContractScreen } from "../screens/ContractScreen";
import { ForceShutdownScreen } from "../screens/ForceShutdownScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { OpeningScreen } from "../screens/OpeningScreen";
import { PrivacyScreen } from "../screens/PrivacyScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { DevSignalPreviewScreen } from "../screens/DevSignalPreviewScreen";
import { ToneModeScreen } from "../screens/ToneModeScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#000000",
    card: "#000000",
    text: "#FFFFFF",
    border: "#2A2A2A",
    primary: "#FFFFFF",
  },
};

export function RootNavigator() {
  const { persisted } = useCircuit();
  const initialRouteName = persisted.onboardingCompleted ? "Home" : "Opening";

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: "#000000" },
        }}
      >
        <Stack.Screen name="Opening" component={OpeningScreen} />
        <Stack.Screen name="Contract" component={ContractScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Privacy" component={PrivacyScreen} />
        <Stack.Screen name="ToneMode" component={ToneModeScreen} />
        <Stack.Screen name="Shutdown" component={ForceShutdownScreen} />
        {__DEV__ ? <Stack.Screen name="DevSignalPreview" component={DevSignalPreviewScreen} /> : false}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
