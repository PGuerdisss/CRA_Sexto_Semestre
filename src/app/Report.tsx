import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "../components/Header";
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Formulario } from "../components/Formulario";
import { useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/ParamList";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";

export function Report() {
  const { userToken } = useContext(AuthContext);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      style={{ backgroundColor: "#FFFFFF" }}
    >
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <Header />
        {userToken ? (
          <Formulario />
        ) : (
          <View style={styles.guestContainer}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="lock-outline" size={48} color="#0040A1" />
            </View>

            <Text style={styles.title}>Identificação Necessária</Text>

            <Text style={styles.description}>
              Para cadastrar um alerta de desaparecimento, você precisa estar
              conectado à sua conta. Isso ajuda a garantir a autenticidade e a
              segurança de cada caso reportado.
            </Text>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => navigation.navigate("Login")}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="log-in-outline"
                  size={20}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.primaryButtonText}>Conectar / Entrar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.navigate("Register")}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="person-add-outline"
                  size={18}
                  color="#0040A1"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.secondaryButtonText}>Criar nova conta</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoBanner}>
              <Ionicons
                name="shield-checkmark-outline"
                size={22}
                color="#0040A1"
              />
              <Text style={styles.infoBannerText}>
                O CRA protege seus dados cadastrais e as informações das postagens sob análise oficial.
              </Text>
            </View>
          </View>
        )}
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  guestContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#EEF4FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "#D0E2FF",
  },
  title: {
    fontFamily: "ManropeExtraBold",
    fontSize: 22,
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontFamily: "PublicSansMedium",
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  actionButtons: {
    width: "100%",
    gap: 12,
    marginBottom: 28,
  },
  primaryButton: {
    width: "100%",
    height: 52,
    backgroundColor: "#0040A1",
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0040A1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: "PublicSansSemiBold",
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryButton: {
    width: "100%",
    height: 52,
    backgroundColor: "#EEF4FF",
    borderWidth: 1.5,
    borderColor: "#0040A1",
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#0040A1",
    fontFamily: "PublicSansSemiBold",
    fontSize: 15,
    fontWeight: "600",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  infoBannerText: {
    flex: 1,
    fontFamily: "PublicSansMedium",
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
});
