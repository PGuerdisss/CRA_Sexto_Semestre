import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "../components/Header";
import { Postagens } from "../components/Postagens";

export function Feed() {
  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <Header />
      <View style={styles.postagemContainer}>
        <Postagens />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  postagemContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
  },
});
