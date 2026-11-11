import {
  View,
  StyleSheet,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { PostagemItem } from "./PostagemItem";
import { useCallback, useContext, useEffect, useState } from "react";
import { service } from "../services/api";
import { TitulosPostagens } from "./TitulosPostagens";
import { AuthContext } from "../contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";

type UsuarioPostagem = {
  id: string;
  nome: string;
  email: string;
};

export type Postagem = {
  id: string;
  nome: string;
  idade: number;
  ultimaLocalidade: string;
  cep?: string;
  fotoPerfil: string;
  informacoesAdicionais: string;
  data: string;
  status: string;
  usuarioPostagem: UsuarioPostagem;
};

export function Postagens() {
  const [postagens, setPostagens] = useState<Postagem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { userToken } = useContext(AuthContext);

  useEffect(() => {
    fetchPostagens()
      .then((data) => setPostagens(data || []))
      .catch((err) => {
        console.log("Erro ao carregar postagens:", err);
        setPostagens([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [userToken]);

  async function fetchPostagens() {
    const postagens =
      userToken?.roles?.[0]?.name === "ADMIN"
        ? service.getTodasPostagens()
        : service.getPostagensAprovadas();

    return postagens;
  }

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchPostagens()
      .then((data) => setPostagens(data || []))
      .catch((err) => {
        console.log("Erro ao recarregar postagens:", err);
      })
      .finally(() => {
        setIsRefreshing(false);
      });
  }, [userToken]);

  return (
    <View style={{ flex: 1 }}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0040A1" />
          <Text style={styles.loadingText}>Carregando postagens...</Text>
          <Text style={styles.loadingSubtext}>
            Conectando aos servidores do CRA...
          </Text>
        </View>
      ) : postagens.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={48} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Nenhuma postagem ativa</Text>
          <Text style={styles.emptySubtitle}>
            Não encontramos alertas recentes no momento. Puxe para baixo ou toque no botão para tentar novamente.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={onRefresh}
            activeOpacity={0.8}
          >
            <Ionicons name="reload" size={16} color="#0040A1" />
            <Text style={styles.retryButtonText}>Recarregar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ListHeaderComponent={<TitulosPostagens />}
          data={postagens}
          keyExtractor={(postagem) => postagem.id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
            />
          }
          renderItem={({ item }) => (
            <PostagemItem
              todasPostagens={postagens}
              setPostagens={setPostagens}
              item={item}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          )}
          contentContainerStyle={{
            paddingBottom: 120, // Garante que o último card e botão não fiquem cobertos pela barra de navegação
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    paddingVertical: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontFamily: "PublicSansSemiBold",
    fontSize: 15,
    color: "#0F172A",
    marginTop: 16,
  },
  loadingSubtext: {
    fontFamily: "PublicSansMedium",
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
  },
  emptyContainer: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontFamily: "ManropeExtraBold",
    fontSize: 18,
    color: "#0F172A",
    marginTop: 12,
  },
  emptySubtitle: {
    fontFamily: "PublicSansMedium",
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#0040A1",
    borderRadius: 20,
  },
  retryButtonText: {
    fontFamily: "PublicSansSemiBold",
    fontSize: 13,
    color: "#0040A1",
  },
});
