import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { Register } from "./src/app/Register";
import { Login } from "./src/app/Login";
import { RootStackParamList } from "./src/types/ParamList";
import { Maps } from "./src/app/Maps";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthContext, AuthProvider } from "./src/contexts/AuthContext";
import { useContext } from "react";
import { PublicRoutes } from "./src/routes/PublicRoutes";
import { PrivateRoutes } from "./src/routes/PrivateRoutes";
import { Routes } from "./src/routes/Routes";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Routes />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
