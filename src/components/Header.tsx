import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Logo } from "./Logo";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useContext, useEffect, useState, useCallback } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/ParamList";
import { service, ComentarioFormatado } from "../services/api";
import { Postagem } from "./Postagens";
import { NotificationsModal } from "./NotificationsModal";

export function Header() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userToken } = useContext(AuthContext);

  const isAdmin = userToken?.roles?.[0]?.name === "ADMIN";

  // Estados de Notificações
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingPosts, setPendingPosts] = useState<Postagem[]>([]);
  const [pendingComments, setPendingComments] = useState<ComentarioFormatado[]>(
    []
  );
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const carregarNotificacoes = useCallback(async () => {
    if (!isAdmin) {
      setPendingPosts([]);
      setPendingComments([]);
      return;
    }

    try {
      setLoadingNotifications(true);
      // 1. Busca postagens pendentes
      const todas = await service.getTodasPostagens();
      const pendentes = Array.isArray(todas)
        ? todas.filter((p) => p.status === "Pendente")
        : [];
      setPendingPosts(pendentes);

      // 2. Busca comentários pendentes de aprovação
      const comentariosPendentes = await service.getComentariosPendentes();
      setPendingComments(comentariosPendentes);
    } catch (err) {
      console.log("Erro ao carregar pendências para o admin:", err);
    } finally {
      setLoadingNotifications(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    carregarNotificacoes();

    // Atualiza periodicamente a cada 20 segundos para avisar o administrador em tempo real
    if (isAdmin) {
      const interval = setInterval(() => {
        carregarNotificacoes();
      }, 20000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, carregarNotificacoes]);

  // Ações de Moderação no Modal
  async function handleAprovarPost(post: Postagem) {
    const postId = post.id || (post as any)._id;
    try {
      await service.mudarStatusPostagem("Aprovada", postId);
      Alert.alert("Sucesso", `Postagem "${post.nome}" aprovada e liberada no feed.`);
      await carregarNotificacoes();
    } catch (err) {
      Alert.alert("Erro", "Não foi possível aprovar a postagem.");
    }
  }

  async function handleRecusarPost(post: Postagem) {
    const postId = post.id || (post as any)._id;
    try {
      await service.mudarStatusPostagem("Recusada", postId);
      Alert.alert("Aviso", `Postagem "${post.nome}" recusada.`);
      await carregarNotificacoes();
    } catch (err) {
      Alert.alert("Erro", "Não foi possível recusar a postagem.");
    }
  }

  async function handleLiberarComentario(comentario: ComentarioFormatado) {
    try {
      await service.moderarComentario(comentario, "Aprovada");
      Alert.alert("Sucesso", "Comentário liberado com sucesso!");
      await carregarNotificacoes();
    } catch (err) {
      Alert.alert("Erro", "Não foi possível liberar o comentário.");
    }
  }

  async function handleRecusarComentario(comentario: ComentarioFormatado) {
    try {
      await service.moderarComentario(comentario, "Recusada");
      Alert.alert("Aviso", "Comentário recusado.");
      await carregarNotificacoes();
    } catch (err) {
      Alert.alert("Erro", "Não foi possível recusar o comentário.");
    }
  }

  function handleNavigateToPost(post: Postagem) {
    const postId = post.id || (post as any)._id;
    navigation.navigate("PostagemDetalhes", { id: postId, postagem: post });
  }

  const totalNotificacoes = pendingPosts.length + pendingComments.length;

  return (
    <>
      <View style={styles.header}>
        {userToken == null ? (
          // Usuário visitante: Botão "Cadastrar / Conectar" no canto superior esquerdo
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() => navigation.navigate("Login")}
            activeOpacity={0.75}
          >
            <Ionicons name="log-in-outline" size={18} color="#0040A1" />
            <Text style={styles.connectButtonText}>Cadastrar / Conectar</Text>
          </TouchableOpacity>
        ) : (
          // Usuário logado: Título CRA
          <View style={styles.headerTitle}>
            <Logo size={24} />
            <Text style={styles.headerText}>CHILD RESCUE ALERT</Text>
          </View>
        )}

        {userToken == null ? (
          // Identidade CRA no canto direito para visitante
          <View style={styles.guestBrandContainer}>
            <Logo size={22} />
            <Text style={styles.guestBrandText}>CRA</Text>
          </View>
        ) : (
          // Botão do Sininho de Notificações com Badge para Administrador
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={
                totalNotificacoes > 0
                  ? "notifications"
                  : "notifications-outline"
              }
              color={totalNotificacoes > 0 ? "#0040A1" : "#64748B"}
              size={22}
            />

            {isAdmin && totalNotificacoes > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>
                  {totalNotificacoes > 9 ? "9+" : totalNotificacoes}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Modal Central de Notificações */}
      <NotificationsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        isAdmin={isAdmin}
        pendingPosts={pendingPosts}
        pendingComments={pendingComments}
        isLoading={loadingNotifications}
        onRefresh={carregarNotificacoes}
        onAprovarPost={handleAprovarPost}
        onRecusarPost={handleRecusarPost}
        onLiberarComentario={handleLiberarComentario}
        onRecusarComentario={handleRecusarComentario}
        onNavigateToPost={handleNavigateToPost}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 58,
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    elevation: 2,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  headerTitle: {
    color: "#0F172A",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerText: {
    fontFamily: "PublicSansSemiBold",
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  connectButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF4FF",
    borderWidth: 1.2,
    borderColor: "#0040A1",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  connectButtonText: {
    fontFamily: "PublicSansSemiBold",
    fontSize: 13,
    color: "#0040A1",
    fontWeight: "600",
  },
  guestBrandContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  guestBrandText: {
    fontFamily: "PublicSansSemiBold",
    fontSize: 16,
    color: "#0040A1",
    fontWeight: "700",
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  badgeContainer: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    fontFamily: "PublicSansSemiBold",
  },
});
