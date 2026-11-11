import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/ParamList";
import { Register } from "../app/Register";
import { Login } from "../app/Login";
import { Maps } from "../app/Maps";
import { TabsRoutes } from "./TabsRoutes";
import { PostagemDetalhes } from "../app/PostagemDetalhes";

export function PrivateRoutes() {
  const Stack = createNativeStackNavigator<RootStackParamList>();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="MainTabs"
        component={TabsRoutes}
        options={{ headerShown: false }}
      />
      {/* <Stack.Screen name="PostagemDetalhes" component={PostagemDetalhes} /> */}
    </Stack.Navigator>
  );
}
