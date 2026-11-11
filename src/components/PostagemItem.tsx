import {
  View,
  StyleSheet,
  Image,
  Text,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { Postagem } from "./Postagens";
import { useFonts } from "expo-font";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/ParamList";
import { useNavigation } from "@react-navigation/native";
import { useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { service } from "../services/api";

type NavigationProps = NativeStackNavigationProp<RootStackParamList, "Feed">;

export function PostagemItem({
  item,
  isLoading,
  setIsLoading,
  setPostagens,
  todasPostagens,
}: {
  item: Postagem;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setPostagens: React.Dispatch<React.SetStateAction<Postagem[]>>;
  todasPostagens: Postagem[];
}) {
  const [fontsLoaded] = useFonts({
    ManropeExtraBold: require("../../assets/fonts/Manrope-ExtraBold.ttf"),
    PublicSansMedium: require("../../assets/fonts/PublicSans-Medium.ttf"),
    PublicSansSemiBold: require("../../assets/fonts/PublicSans-SemiBold.ttf"),
  });
  const navigation = useNavigation<NavigationProps>();
  const { userToken } = useContext(AuthContext);

  async function handleMudarStatusPostagem(status: string, id: string) {
    await service.mudarStatusPostagem(status, id);
    const updatedPostagems = todasPostagens.map((postagem) => {
      if (postagem.id === id) {
        return {
          ...postagem,
          status,
        };
      }
      return postagem;
    });
    setPostagens(updatedPostagems);
  }

  function confirmarMudancaStatus(status: string, id: string, nome: string) {
    let titulo = `Finalizar como "${status}"?`;
    let mensagem = `Deseja registrar o caso de "${nome}" como "${status}" no banco de dados?`;

    if (status === "Aprovada") {
      titulo = "Reabrir caso?";
      mensagem = `Deseja reabrir o caso de "${nome}" para o status Ativo no feed?`;
    }

    Alert.alert(titulo, mensagem, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar",
        style: status === "Recusada" ? "destructive" : "default",
        onPress: async () => {
          try {
            await handleMudarStatusPostagem(status, id);
            Alert.alert("Sucesso", `Status atualizado para "${status}".`);
          } catch (err) {
            Alert.alert("Erro", "Não foi possível atualizar o status no banco.");
          }
        },
      },
    ]);
  }

  function confirmarExclusaoPermanente(id: string, nome: string) {
    Alert.alert(
      "Apagar para sempre?",
      `Tem certeza que deseja excluir permanentemente a postagem de "${nome}"? Esta ação não poderá ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar Para Sempre",
          style: "destructive",
          onPress: async () => {
            try {
              await service.mudarStatusPostagem("Excluida", id);
              setPostagens(todasPostagens.filter((p) => p.id !== id));
              Alert.alert("Postagem Excluída", `O registro de "${nome}" foi apagado permanentemente.`);
            } catch (err) {
              Alert.alert("Erro", "Não foi possível excluir a postagem.");
            }
          },
        },
      ]
    );
  }

  const isValidUrl =
    Boolean(item.fotoPerfil) &&
    (item.fotoPerfil.startsWith("http") ||
      item.fotoPerfil.startsWith("data:image/") ||
      item.fotoPerfil.startsWith("file://")) &&
    !item.fotoPerfil.includes("example.com");

  function renderStatusBadge() {
    if (!item.status) return null;

    let badgeStyle = styles.statusApproved;
    let badgeText = item.status.toUpperCase();

    if (item.status === "Aprovada") {
      badgeStyle = styles.statusApproved;
      badgeText = "ATIVO";
    } else if (item.status === "Pendente") {
      badgeStyle = styles.statusPending;
      badgeText = "PENDENTE";
    } else if (item.status === "Encontrado") {
      badgeStyle = styles.statusFound;
      badgeText = "✓ ENCONTRADO";
    } else if (item.status === "Não encontrado") {
      badgeStyle = styles.statusNotFound;
      badgeText = "✕ NÃO ENCONTRADO";
    } else if (item.status === "Recusada") {
      badgeStyle = styles.statusRejected;
      badgeText = "RECUSADA";
    }

    return (
      <View style={[styles.statusBadge, badgeStyle]}>
        <Text style={styles.statusBadgeText}>{badgeText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Contêiner da Imagem */}
      <View style={styles.imageContainer}>
        {isValidUrl ? (
          <Image
            source={{ uri: item.fotoPerfil }}
            style={styles.imagem}
            resizeMode="cover"
            onLoad={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
          />
        ) : (
          <View style={styles.placeholderContainer}>
            <Ionicons name="person" size={60} color="#94A3B8" />
          </View>
        )}

        {/* Badge dinâmica de Status */}
        {renderStatusBadge()}
      </View>

      {/* Conteúdo com Padding Interno */}
      <View style={styles.cardContent}>
        {/* Nome: Título forte em destaque */}
        <Text style={styles.nome} numberOfLines={1}>
          {item.nome}
        </Text>

        {/* Informações em Chips/Badges lado a lado (flexDirection: row) */}
        <View style={styles.chipsRow}>
          {/* Chip de Idade */}
          <View style={styles.chip}>
            <MaterialIcons name="cake" size={14} color="#64748B" />
            <Text style={styles.chipText}>{item.idade} anos</Text>
          </View>

          {/* Chip de Localidade */}
          {Boolean(item.ultimaLocalidade) && (
            <View style={[styles.chip, styles.chipLocation]}>
              <MaterialIcons name="place" size={14} color="#0040A1" />
              <Text style={styles.chipText} numberOfLines={1}>
                {item.ultimaLocalidade}
              </Text>
            </View>
          )}
        </View>

        {/* Descrição com espaçamento e cor suave */}
        {Boolean(item.informacoesAdicionais) && (
          <Text style={styles.descricao} numberOfLines={3}>
            {item.informacoesAdicionais}
          </Text>
        )}

        {/* Botão de Ação: largura total, borderRadius: 8 e texto centralizado */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() =>
            navigation.navigate("PostagemDetalhes", {
              id: item.id || (item as any)._id,
              postagem: item,
            })
          }
          activeOpacity={0.85}
        >
          <Text style={styles.actionButtonText}>Ver Detalhes</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color="#FFFFFF"
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>

        {/* ÁREA DO ADMIN: Moderação e Finalização de Casos */}
        {userToken?.roles?.[0]?.name === "ADMIN" && (
          <View style={styles.adminContainer}>
            <Text style={styles.adminContainerTitle}>GERENCIAMENTO (ADMIN)</Text>

            {/* Caso 1: Postagem Pendente de Análise */}
            {item.status === "Pendente" && (
              <View style={styles.adminRow}>
                <TouchableOpacity
                  style={styles.approveButton}
                  onPress={() => confirmarMudancaStatus("Aprovada", item.id, item.nome)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" />
                  <Text style={styles.adminButtonText}>Aprovar Alerta</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => confirmarMudancaStatus("Recusada", item.id, item.nome)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="close-sharp" size={16} color="#FFFFFF" />
                  <Text style={styles.adminButtonText}>Recusar</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Caso 2: Postagem Ativa — Finalizar como 'Encontrado' ou 'Não encontrado' */}
            {item.status === "Aprovada" && (
              <View style={styles.adminRow}>
                <TouchableOpacity
                  style={styles.foundButton}
                  onPress={() => confirmarMudancaStatus("Encontrado", item.id, item.nome)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.adminButtonText}>Encontrado</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.notFoundButton}
                  onPress={() => confirmarMudancaStatus("Não encontrado", item.id, item.nome)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="close-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.adminButtonText}>Não encontrado</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Caso 3: Postagem já finalizada — Opção de Reabrir */}
            {(item.status === "Encontrado" || item.status === "Não encontrado") && (
              <View style={styles.finalizedRow}>
                <Text style={styles.finalizedNotice}>
                  Status no banco: <Text style={{ fontWeight: "700" }}>{item.status}</Text>
                </Text>
                <TouchableOpacity
                  style={styles.reopenButton}
                  onPress={() => confirmarMudancaStatus("Aprovada", item.id, item.nome)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="refresh" size={14} color="#0040A1" />
                  <Text style={styles.reopenButtonText}>Reabrir Alerta</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Botão para o Admin apagar a postagem para sempre */}
            <TouchableOpacity
              style={{
                marginTop: 8,
                height: 38,
                backgroundColor: "#FEE2E2",
                borderWidth: 1,
                borderColor: "#FCA5A5",
                borderRadius: 8,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
              onPress={() => confirmarExclusaoPermanente(item.id, item.nome)}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={15} color="#DC2626" />
              <Text
                style={{
                  color: "#DC2626",
                  fontFamily: "PublicSansSemiBold",
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                Apagar Postagem Para Sempre
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 20,
    elevation: 3,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    overflow: "hidden",
    borderWidth: Platform.OS === "android" ? 0.5 : 1,
    borderColor: "#E2E8F0",
  },
  imageContainer: {
    width: "100%",
    height: 220,
    maxHeight: 250,
    backgroundColor: "#F1F5F9",
    position: "relative",
  },
  imagem: {
    width: "100%",
    height: "100%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  placeholderContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  statusBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusApproved: {
    backgroundColor: "rgba(16, 185, 129, 0.92)",
  },
  statusPending: {
    backgroundColor: "rgba(245, 158, 11, 0.92)",
  },
  statusFound: {
    backgroundColor: "rgba(5, 150, 105, 0.95)",
  },
  statusNotFound: {
    backgroundColor: "rgba(71, 85, 105, 0.95)",
  },
  statusRejected: {
    backgroundColor: "rgba(239, 68, 68, 0.92)",
  },
  statusBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "PublicSansSemiBold",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cardContent: {
    padding: 16,
  },
  nome: {
    fontFamily: "ManropeExtraBold",
    fontSize: 20,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 10,
    lineHeight: 26,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 5,
  },
  chipLocation: {
    maxWidth: "70%",
  },
  chipText: {
    fontFamily: "PublicSansMedium",
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  descricao: {
    fontFamily: "PublicSansMedium",
    fontSize: 14,
    lineHeight: 21,
    color: "#475569",
    marginTop: 12,
  },
  actionButton: {
    width: "100%",
    height: 46,
    backgroundColor: "#0040A1",
    borderRadius: 8,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "PublicSansSemiBold",
    fontWeight: "600",
    textAlign: "center",
  },
  adminContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  adminContainerTitle: {
    fontFamily: "PublicSansSemiBold",
    fontSize: 11,
    color: "#64748B",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  adminRow: {
    flexDirection: "row",
    gap: 10,
  },
  approveButton: {
    flex: 1,
    height: 42,
    backgroundColor: "#10B981",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  rejectButton: {
    flex: 1,
    height: 42,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  foundButton: {
    flex: 1,
    height: 42,
    backgroundColor: "#059669",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  notFoundButton: {
    flex: 1,
    height: 42,
    backgroundColor: "#475569",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  adminButtonText: {
    color: "#FFFFFF",
    fontFamily: "PublicSansSemiBold",
    fontSize: 13,
    fontWeight: "600",
  },
  finalizedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  finalizedNotice: {
    fontFamily: "PublicSansMedium",
    fontSize: 12,
    color: "#334155",
  },
  reopenButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "#EEF4FF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#0040A1",
  },
  reopenButtonText: {
    fontFamily: "PublicSansSemiBold",
    fontSize: 12,
    color: "#0040A1",
  },
});
