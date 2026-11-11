import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { styles } from "./LoginStyle";
import { useFonts } from "expo-font";
import { RootStackParamList } from "../types/ParamList";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useContext, useState } from "react";
import { Logo } from "../components/Logo";
import { Controller, useForm } from "react-hook-form";
import { service } from "../services/api";
import * as SecureStore from "expo-secure-store";
import { AuthContext } from "../contexts/AuthContext";

type NavigationProps = NativeStackNavigationProp<RootStackParamList, "Login">;

export type LoginForm = {
  email: string;
  password: string;
};

export function Login() {
  const navigation = useNavigation<NavigationProps>();

  const [fontsLoaded] = useFonts({
    ManropeExtraBold: require("../../assets/fonts/Manrope-ExtraBold.ttf"),
    PublicSansMedium: require("../../assets/fonts/PublicSans-Medium.ttf"),
    PublicSansSemiBold: require("../../assets/fonts/PublicSans-SemiBold.ttf"),
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { userToken, setUserToken } = useContext(AuthContext);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(data: LoginForm) {
    try {
      setIsSubmitting(true);
      const token = await service.login({
        email: data.email,
        password: data.password,
      });
      await SecureStore.setItemAsync("token", token);
      const user = await service.getSelfUser();
      setUserToken(user);
      navigation.navigate("MainTabs");
    } catch (error: any) {
      console.log("Erro no login:", error?.response?.data || error?.message);
      const serverMessage =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        (typeof error?.response?.data === "string" ? error.response.data : null);

      if (serverMessage) {
        Alert.alert("Login inválido", String(serverMessage));
      } else if (
        error?.code === "ECONNABORTED" ||
        error?.message?.includes("timeout")
      ) {
        Alert.alert(
          "Servidor inicializando",
          "O servidor backend está iniciando do modo de suspensão. Por favor, aguarde alguns segundos e tente novamente."
        );
      } else if (
        error?.code === "ERR_NETWORK" ||
        !error?.response ||
        error?.message?.includes("Network Error")
      ) {
        Alert.alert(
          "Conexão com o servidor",
          "Não foi possível conectar ao servidor. O servidor gratuito pode estar acordando ou verifique sua conexão. Tente novamente em alguns segundos."
        );
      } else {
        Alert.alert("Login inválido", "E-mail ou senha incorretos");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Carregando...</Text>
      </View>
    );
  }

  return (
    <ScrollView>
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: "center",
          paddingTop: 35,
          paddingLeft: 24,
          paddingRight: 24,
          gap: 32,
          backgroundColor: "#eaf0f8",
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 342,
            flexDirection: "row",
            justifyContent: "flex-start",
          }}
        >
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 14,
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "#CBD5E1",
            }}
            onPress={() => navigation.navigate("MainTabs")}
          >
            <Ionicons name="arrow-back" size={18} color="#0040A1" />
            <Text
              style={{
                color: "#0040A1",
                fontFamily: "PublicSansSemiBold",
                fontSize: 13,
              }}
            >
              Voltar ao feed
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.container}>
          <Logo size={100} />

          <Text style={{ fontFamily: "ManropeExtraBold", fontSize: 36 }}>
            CRA
          </Text>

          <Text style={{ fontFamily: "PublicSansMedium", fontSize: 16 }}>
            CHILD RESCUE ALERT
          </Text>
        </View>
        <View
          style={{
            maxWidth: 342,
            width: "100%",
            minHeight: 467,
            backgroundColor: "white",
            padding: 40,
            borderRadius: 12,
          }}
        >
          <Text style={{ paddingLeft: 4, fontSize: 14 }}>Email Address</Text>

          <Controller
            control={control}
            name="email"
            rules={{ required: "E-mail obrigatorio" }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                placeholder="name@example.com"
                style={{
                  marginTop: 10,
                  backgroundColor: "#E5E8EB",
                  borderRadius: 8,
                  paddingVertical: 18,
                  paddingHorizontal: 16,
                  marginVertical: 24,
                }}
              />
            )}
          />
          {errors.email && (
            <Text style={{ color: "red", marginBottom: 10 }}>
              {errors.email.message}
            </Text>
          )}

          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text style={{ paddingLeft: 4, fontSize: 14 }}>Password</Text>
            <TouchableOpacity>
              <Text
                style={{
                  fontFamily: "PublicSansSemiBold",
                  paddingLeft: 4,
                  fontSize: 12,
                  color: "#0040A1",
                }}
              >
                Esqueceu a senha?
              </Text>
            </TouchableOpacity>
          </View>

          <Controller
            control={control}
            name="password"
            rules={{ required: "A senha é obrigatória" }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                placeholder="••••••••"
                style={{
                  marginTop: 10,
                  backgroundColor: "#E5E8EB",
                  borderRadius: 8,
                  paddingVertical: 18,
                  paddingHorizontal: 16,
                  marginVertical: 24,
                }}
              />
            )}
          />
          {errors.password && (
            <Text style={{ color: "red", marginBottom: 10 }}>
              {errors.password.message}
            </Text>
          )}

          <TouchableOpacity
            style={{
              width: "100%",
              height: 56,
              backgroundColor: isSubmitting ? "#7296cc" : "#0040A1",
              borderRadius: 9999,
              paddingVertical: 16,
              marginVertical: 24,
              justifyContent: "center",
              alignItems: "center",
            }}
            disabled={isSubmitting}
            onPress={() => handleSubmit(onSubmit)()}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ textAlign: "center", fontSize: 16, color: "white" }}>
                Login
              </Text>
            )}
          </TouchableOpacity>
          <View
            style={{
              height: 1,
              backgroundColor: "#ccc",
              width: "100%",
              marginTop: 16,
            }}
          />
          <View
            style={{
              flex: 1,
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              marginTop: 24,
            }}
          >
            <Text style={{ fontFamily: "PublicSansMedium", fontSize: 14 }}>
              Não tem uma conta?
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Register")}>
              <Text
                style={{ fontFamily: "PublicSansSemiBold", color: "#0040A1" }}
              >
                Crie uma agora
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}
