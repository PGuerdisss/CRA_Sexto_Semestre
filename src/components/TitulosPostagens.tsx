import { useFonts } from "expo-font";
import { View, StyleSheet, Text } from "react-native";

export function TitulosPostagens() {
  const [fontsLoaded] = useFonts({
    ManropeExtraBold: require("../../assets/fonts/Manrope-ExtraBold.ttf"),
    PublicSansMedium: require("../../assets/fonts/PublicSans-Medium.ttf"),
    PublicSansSemiBold: require("../../assets/fonts/PublicSans-SemiBold.ttf"),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Postagens</Text>
      <Text style={styles.subtitle}>Postagens ativas da sua comunidade.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    color: "#0F172A",
    fontFamily: "ManropeExtraBold",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: "PublicSansMedium",
    fontSize: 15,
    color: "#64748B",
    marginTop: 6,
    lineHeight: 22,
  },
});
