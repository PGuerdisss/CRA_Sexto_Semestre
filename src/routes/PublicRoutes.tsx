import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/ParamList";
import { Register } from "../app/Register";
import { Login } from "../app/Login";

export function PublicRoutes() {
  const Stack = createNativeStackNavigator<RootStackParamList>();
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="Register"
    >
      <Stack.Screen name="Register" component={Register} />
      <Stack.Screen name="Login" component={Login} />
    </Stack.Navigator>
  );
}
