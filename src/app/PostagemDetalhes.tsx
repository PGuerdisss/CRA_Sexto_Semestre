import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { RootStackParamList } from "../types/ParamList";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { service, ComentarioFormatado } from "../services/api";
import { useContext, useEffect, useState } from "react";
import { Postagem } from "../components/Postagens";
import { Header } from "../components/Header";
import { useFonts } from "expo-font";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../contexts/AuthContext";

type PostagemDetalhesRouteProp = RouteProp<
  RootStackParamList,
  "PostagemDetalhes"
>;

export function PostagemDetalhes() {
  const route = useRoute<PostagemDetalhesRouteProp>();
  const navigation = useNavigation<any>();
  
  // Dados iniciais passados via rota (garante carregamento instantâneo)
  const initialPostagem = route.params?.postagem;
  const targetId =
    route.params?.id || initialPostagem?.id || (initialPostagem as any)?._id;

  const [postagem, setPostagem] = useState<Postagem | null>(
    initialPostagem || null
  );
  const [isLoading, setIsLoading] = useState(!initialPostagem);
  const [imageError, setImageError] = useState(false);
  const { userToken } = useContext(AuthContext);

  // Estados dos Comentários
  const [comentarios, setComentarios] = useState<ComentarioFormatado[]>([]);
  const [loadingComentarios, setLoadingComentarios] = useState(true);
  const [novoComentario, setNovoComentario] = useState("");
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  const [fontsLoaded] = useFonts({
    ManropeExtraBold: require("../../assets/fonts/Manrope-ExtraBold.ttf"),
    PublicSansMedium: require("../../assets/fonts/PublicSans-Medium.ttf"),
    PublicSansSemiBold: require("../../assets/fonts/PublicSans-SemiBold.ttf"),
  });

  async function fetchPostagem(id: string) {
    if (!id) return;
    try {
      const postagemEncontrado = await service.getPostagensById(id);
      if (postagemEncontrado) {
        setPostagem(postagemEncontrado);
      }
    } catch (err) {
      console.log("Erro ao buscar detalhes da postagem:", err);
    }
  }

  async function fetchComentarios(id: string) {
    if (!id) return;
    try {
      const lista = await service.getComentariosByPostagemId(id);
      setComentarios(lista);
    } catch (err) {
      console.log("Erro ao carregar comentários:", err);
    } finally {
      setLoadingComentarios(false);
    }
  }

  useEffect(() => {
    if (targetId) {
      fetchPostagem(targetId).finally(() => setIsLoading(false));
      fetchComentarios(targetId);
    } else {
      setIsLoading(false);
      setLoadingComentarios(false);
    }
  }, [targetId]);

  async function handleMudarStatus(novoStatus: string) {
    if (!targetId) return;

    let titulo = `Finalizar como "${novoStatus}"?`;
    let mensagem = `Deseja registrar o caso de "${postagem?.nome}" como "${novoStatus}" no banco de dados?`;

    if (novoStatus === "Aprovada") {
      titulo = "Reabrir caso?";
      mensagem = `Deseja reabrir o caso de "${postagem?.nome}" como Ativo no feed?`;
    }

    Alert.alert(titulo, mensagem, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar",
        style: novoStatus === "Recusada" ? "destructive" : "default",
        onPress: async () => {
          try {
            await service.mudarStatusPostagem(novoStatus, targetId);
            await fetchPostagem(targetId);
            Alert.alert("Sucesso", `Status atualizado para "${novoStatus}".`);
          } catch (err) {
            Alert.alert("Erro", "Não foi possível atualizar o status no banco.");
          }
        },
      },
    ]);
  }

  async function handleEnviarComentario() {
    if (!novoComentario.trim()) {
      Alert.alert("Aviso", "Por favor, digite uma mensagem antes de enviar.");
      return;
    }

    if (!userToken) {
      Alert.alert(
        "Acesso restrito",
        "Você precisa estar conectado para enviar comentários.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Conectar", onPress: () => navigation.navigate("Login") },
        ]
      );
      return;
    }

    setEnviandoComentario(true);
    try {
      const autorNome =
        userToken?.username || (userToken as any)?.email || "Usuário CRA";
      await service.criarComentario(
        targetId,
        novoComentario.trim(),
        autorNome
      );
      setNovoComentario("");
      await fetchComentarios(targetId);
      Alert.alert(
        "Comentário Enviado!",
        "Obrigado pela informação. O comentário foi enviado para moderação e será liberado pelo administrador."
      );
    } catch (err) {
      console.log("Erro ao enviar comentário:", err);
      Alert.alert("Erro", "Não foi possível enviar seu comentário no momento.");
    } finally {
      setEnviandoComentario(false);
    }
  }

  async function handleModerarComentario(
    comentario: ComentarioFormatado,
    novoStatus: "Aprovada" | "Recusada"
  ) {
    const acao = novoStatus === "Aprovada" ? "liberar" : "recusar";
    Alert.alert(
      "Moderação de Comentário",
      `Deseja realmente ${acao} este comentário?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: novoStatus === "Aprovada" ? "Liberar" : "Recusar",
          style: novoStatus === "Recusada" ? "destructive" : "default",
          onPress: async () => {
            try {
              await service.moderarComentario(comentario, novoStatus);
              await fetchComentarios(targetId);
              Alert.alert(
                "Sucesso",
                `Comentário ${
                  novoStatus === "Aprovada" ? "liberado com sucesso!" : "recusado."
                }`
              );
            } catch (err) {
              Alert.alert("Erro", "Não foi possível atualizar o comentário.");
            }
          },
        },
      ]
    );
  }

  function convertStringToDay(data: string) {
    if (!data) return "";
    try {
      const dataFormatada = new Date(data).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      return dataFormatada;
    } catch {
      return data;
    }
  }

  function renderStatusBadge() {
    if (!postagem?.status) return null;

    let badgeColor = "#10B981";
    let badgeLabel = "ATIVO";

    if (postagem.status === "Aprovada") {
      badgeColor = "#10B981";
      badgeLabel = "ATIVO";
    } else if (postagem.status === "Pendente") {
      badgeColor = "#F59E0B";
      badgeLabel = "PENDENTE";
    } else if (postagem.status === "Encontrado") {
      badgeColor = "#059669";
      badgeLabel = "✓ ENCONTRADO";
    } else if (postagem.status === "Não encontrado") {
      badgeColor = "#64748B";
      badgeLabel = "✕ NÃO ENCONTRADO";
    } else if (postagem.status === "Recusada") {
      badgeColor = "#EF4444";
      badgeLabel = "RECUSADA";
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: badgeColor }]}>
        <Text style={styles.statusBadgeText}>{badgeLabel}</Text>
      </View>
    );
  }

  const isAdmin = userToken?.roles?.[0]?.name === "ADMIN";
  const comentariosExibidos = comentarios.filter((c) => {
    if (isAdmin) return true; // Administrador vê todos (incluindo pendentes)
    return c.status === "Aprovada"; // Pessoas normais só veem liberados
  });

  const isValidUrl =
    Boolean(postagem?.fotoPerfil) &&
    typeof postagem?.fotoPerfil === "string" &&
    (postagem.fotoPerfil.startsWith("http") ||
      postagem.fotoPerfil.startsWith("data:image/") ||
      postagem.fotoPerfil.startsWith("file://"));

  if (isLoading && !postagem) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0040A1" />
        <Text style={styles.loadingText}>Carregando informações do caso...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <Header />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Barra de Navegação Superior (Voltar) */}
          <View style={styles.navBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color="#0040A1" />
              <Text style={styles.backButtonText}>Voltar para o Feed</Text>
            </TouchableOpacity>
          </View>

          {/* CARD DA FOTO PRINCIPAL */}
          <View style={styles.photoContainer}>
            {isValidUrl && !imageError ? (
              <Image
                source={{ uri: postagem?.fotoPerfil }}
                style={styles.photoImage}
                resizeMode="cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="person" size={80} color="#94A3B8" />
                <Text style={styles.placeholderNotice}>
                  Sem foto disponível
                </Text>
              </View>
            )}

            {/* Badge de Status Flutuante */}
            <View style={styles.badgeWrapper}>{renderStatusBadge()}</View>
          </View>

          {/* CARD PRINCIPAL COM INFORMAÇÕES DO DESAPARECIDO */}
          <View style={styles.mainInfoCard}>
            <Text style={styles.nomeText}>
              {postagem?.nome || "Nome não informado"}
            </Text>

            {/* Linha de Chips / Tags */}
            <View style={styles.chipsRow}>
              {Boolean(postagem?.idade) && (
                <View style={styles.chip}>
                  <MaterialIcons name="cake" size={15} color="#64748B" />
                  <Text style={styles.chipText}>{postagem?.idade} anos</Text>
                </View>
              )}

              {Boolean(postagem?.ultimaLocalidade) && (
                <View style={[styles.chip, styles.chipLocation]}>
                  <MaterialIcons name="place" size={15} color="#0040A1" />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {postagem?.ultimaLocalidade}
                  </Text>
                </View>
              )}
            </View>

            {Boolean(postagem?.data) && (
              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={15} color="#64748B" />
                <Text style={styles.dateText}>
                  Visto pela última vez em{" "}
                  <Text style={styles.dateHighlight}>
                    {convertStringToDay(postagem?.data || "")}
                  </Text>
                </Text>
              </View>
            )}

            {Boolean(postagem?.cep) && (
              <View style={styles.dateRow}>
                <Ionicons name="mail-outline" size={15} color="#64748B" />
                <Text style={styles.dateText}>CEP da região: {postagem?.cep}</Text>
              </View>
            )}
          </View>

          {/* DETALHES ADICIONAIS DO CASO */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color="#0040A1"
              />
              <Text style={styles.sectionTitle}>Detalhes do Caso</Text>
            </View>
            <Text style={styles.sectionBodyText}>
              {postagem?.informacoesAdicionais ||
                "Nenhuma informação adicional fornecida para este caso."}
            </Text>
          </View>

          {/* QUEM REPORTOU */}
          <View style={styles.reporterCard}>
            <View style={styles.reporterAvatar}>
              <MaterialIcons name="person" size={26} color="#0040A1" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reporterLabel}>REPORTADO POR</Text>
              <Text style={styles.reporterName}>
                {postagem?.usuarioPostagem?.nome || "Usuário da Comunidade CRA"}
              </Text>
            </View>
          </View>

          {/* PAINEL DE CONTROLE DO ADMIN */}
          {isAdmin && (
            <View style={styles.adminPanel}>
              <View style={styles.adminHeaderRow}>
                <Ionicons name="shield-checkmark" size={18} color="#0040A1" />
                <Text style={styles.adminPanelTitle}>
                  GERENCIAMENTO DO ALERTA (ADMIN)
                </Text>
              </View>

              <Text style={styles.adminPanelSubtitle}>
                Atualize o andamento do caso no banco de dados. Os dados
                permanecem registrados para histórico.
              </Text>

              {postagem?.status === "Pendente" && (
                <View style={styles.adminButtonsRow}>
                  <TouchableOpacity
                    style={[styles.adminBtn, { backgroundColor: "#10B981" }]}
                    onPress={() => handleMudarStatus("Aprovada")}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" />
                    <Text style={styles.adminBtnText}>Aprovar Alerta</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.adminBtn, { backgroundColor: "#EF4444" }]}
                    onPress={() => handleMudarStatus("Recusada")}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="close-sharp" size={16} color="#FFFFFF" />
                    <Text style={styles.adminBtnText}>Recusar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {postagem?.status === "Aprovada" && (
                <View style={styles.adminButtonsRow}>
                  <TouchableOpacity
                    style={[styles.adminBtn, { backgroundColor: "#059669" }]}
                    onPress={() => handleMudarStatus("Encontrado")}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.adminBtnText}>Encontrado</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.adminBtn, { backgroundColor: "#475569" }]}
                    onPress={() => handleMudarStatus("Não encontrado")}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.adminBtnText}>Não encontrado</Text>
                  </TouchableOpacity>
                </View>
              )}

              {(postagem?.status === "Encontrado" ||
                postagem?.status === "Não encontrado") && (
                <View style={styles.finalizedBox}>
                  <Text style={styles.finalizedNotice}>
                    Status atual:{" "}
                    <Text style={{ fontWeight: "700" }}>{postagem.status}</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.reopenBtn}
                    onPress={() => handleMudarStatus("Aprovada")}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="refresh" size={15} color="#0040A1" />
                    <Text style={styles.reopenBtnText}>Reabrir Caso</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ======================================================== */}
          {/* SEÇÃO DE COMENTÁRIOS & PISTAS DA COMUNIDADE              */}
          {/* ======================================================== */}
          <View style={styles.commentsSection}>
            <View style={styles.commentsHeaderRow}>
              <View style={styles.commentsTitleGroup}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={20}
                  color="#0040A1"
                />
                <Text style={styles.commentsSectionTitle}>
                  Comentários & Pistas
                </Text>
              </View>
              <View style={styles.commentCountBadge}>
                <Text style={styles.commentCountText}>
                  {comentariosExibidos.length}
                </Text>
              </View>
            </View>

            <Text style={styles.commentsDescription}>
              Espaço comunitário para envio de informações, avistamentos e
              pistas. Comentários passam por liberação do administrador.
            </Text>

            {/* FORMULÁRIO DE ENVIO: APENAS PARA CONECTADOS */}
            {userToken != null ? (
              <View style={styles.commentInputBox}>
                <Text style={styles.inputLabel}>
                  Deixe uma pista ou comentário:
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Você viu essa pessoa ou tem alguma informação? Escreva aqui..."
                  placeholderTextColor="#94A3B8"
                  value={novoComentario}
                  onChangeText={setNovoComentario}
                  multiline
                  numberOfLines={3}
                />
                <View style={styles.inputFooter}>
                  <Text style={styles.inputDisclaimer}>
                    * Passará pela aprovação do administrador
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      (!novoComentario.trim() || enviandoComentario) &&
                        styles.sendButtonDisabled,
                    ]}
                    onPress={handleEnviarComentario}
                    disabled={!novoComentario.trim() || enviandoComentario}
                    activeOpacity={0.85}
                  >
                    {enviandoComentario ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="send" size={14} color="#FFFFFF" />
                        <Text style={styles.sendButtonText}>Enviar</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* AVISO PARA VISITANTES CONECTAREM-SE */
              <View style={styles.guestNoticeCard}>
                <Ionicons name="lock-closed" size={26} color="#0040A1" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.guestNoticeTitle}>
                    Faça login para comentar
                  </Text>
                  <Text style={styles.guestNoticeText}>
                    Apenas pessoas conectadas podem enviar comentários e pistas
                    sobre os casos.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.guestLoginBtn}
                  onPress={() => navigation.navigate("Login")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.guestLoginBtnText}>Conectar</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* LISTA DE COMENTÁRIOS */}
            <View style={styles.commentsList}>
              {loadingComentarios ? (
                <View style={styles.commentsLoading}>
                  <ActivityIndicator size="small" color="#0040A1" />
                  <Text style={styles.commentsLoadingText}>
                    Carregando comentários...
                  </Text>
                </View>
              ) : comentariosExibidos.length === 0 ? (
                <View style={styles.emptyCommentsBox}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={36}
                    color="#CBD5E1"
                  />
                  <Text style={styles.emptyCommentsTitle}>
                    Nenhum comentário publicado ainda
                  </Text>
                  <Text style={styles.emptyCommentsSubtitle}>
                    Se tiver qualquer pista sobre o paradeiro, compartilhe com a
                    comunidade!
                  </Text>
                </View>
              ) : (
                comentariosExibidos.map((comentario) => {
                  const isPendente = comentario.status === "Pendente";
                  return (
                    <View
                      key={comentario.id}
                      style={[
                        styles.commentCard,
                        isPendente && styles.commentCardPendente,
                      ]}
                    >
                      {/* Topo do Comentário com Autor e Status */}
                      <View style={styles.commentHeader}>
                        <View style={styles.commentAuthorRow}>
                          <View style={styles.commentAuthorAvatar}>
                            <Text style={styles.commentAuthorAvatarText}>
                              {(comentario.autor || "U").charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View>
                            <Text style={styles.commentAuthorName}>
                              {comentario.autor || "Membro da Comunidade"}
                            </Text>
                            {Boolean(comentario.data) && (
                              <Text style={styles.commentDate}>
                                {convertStringToDay(comentario.data || "")}
                              </Text>
                            )}
                          </View>
                        </View>

                        {/* Tag de moderação */}
                        {isPendente ? (
                          <View style={styles.pendenteBadge}>
                            <Ionicons name="time-outline" size={12} color="#D97706" />
                            <Text style={styles.pendenteBadgeText}>
                              Aguardando Liberação
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.liberadoBadge}>
                            <Ionicons
                              name="checkmark-circle-outline"
                              size={12}
                              color="#059669"
                            />
                            <Text style={styles.liberadoBadgeText}>Liberado</Text>
                          </View>
                        )}
                      </View>

                      {/* Texto do Comentário */}
                      <Text style={styles.commentBodyText}>
                        {comentario.texto}
                      </Text>

                      {/* PAINEL DE LIBERAÇÃO DO ADMIN */}
                      {isAdmin && isPendente && (
                        <View style={styles.commentAdminActions}>
                          <Text style={styles.adminActionNotice}>
                            Moderação requerida:
                          </Text>
                          <View style={styles.commentActionButtons}>
                            <TouchableOpacity
                              style={styles.liberarBtn}
                              onPress={() =>
                                handleModerarComentario(comentario, "Aprovada")
                              }
                              activeOpacity={0.8}
                            >
                              <Ionicons
                                name="checkmark"
                                size={14}
                                color="#FFFFFF"
                              />
                              <Text style={styles.liberarBtnText}>
                                Liberar Comentário
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.recusarBtn}
                              onPress={() =>
                                handleModerarComentario(comentario, "Recusada")
                              }
                              activeOpacity={0.8}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={14}
                                color="#EF4444"
                              />
                              <Text style={styles.recusarBtnText}>Recusar</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollView: {
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    paddingBottom: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    fontFamily: "PublicSansMedium",
    fontSize: 15,
    color: "#64748B",
    marginTop: 16,
  },
  navBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  backButtonText: {
    color: "#0040A1",
    fontFamily: "PublicSansSemiBold",
    fontSize: 13,
    fontWeight: "600",
  },
  photoContainer: {
    marginHorizontal: 16,
    height: 240,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
    position: "relative",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  photoPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
  },
  placeholderNotice: {
    fontFamily: "PublicSansMedium",
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 8,
  },
  badgeWrapper: {
    position: "absolute",
    top: 14,
    right: 14,
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  statusBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "PublicSansSemiBold",
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  mainInfoCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  nomeText: {
    fontSize: 24,
    color: "#0F172A",
    fontFamily: "ManropeExtraBold",
    fontWeight: "800",
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F1F5F9",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  chipLocation: {
    backgroundColor: "#EEF4FF",
    maxWidth: "80%",
  },
  chipText: {
    fontSize: 13,
    fontFamily: "PublicSansMedium",
    color: "#334155",
    fontWeight: "500",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  dateText: {
    fontSize: 13,
    fontFamily: "PublicSansMedium",
    color: "#64748B",
  },
  dateHighlight: {
    color: "#1E293B",
    fontWeight: "600",
  },
  sectionCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "ManropeExtraBold",
    fontWeight: "700",
    color: "#0F172A",
  },
  sectionBodyText: {
    fontSize: 14,
    fontFamily: "PublicSansMedium",
    lineHeight: 22,
    color: "#475569",
  },
  reporterCard: {
    marginHorizontal: 16,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  reporterAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EEF4FF",
    alignItems: "center",
    justifyContent: "center",
  },
  reporterLabel: {
    fontFamily: "PublicSansSemiBold",
    fontSize: 11,
    letterSpacing: 0.8,
    color: "#64748B",
  },
  reporterName: {
    fontFamily: "PublicSansSemiBold",
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "600",
    marginTop: 2,
  },
  adminPanel: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#0040A1",
    padding: 18,
  },
  adminHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  adminPanelTitle: {
    fontFamily: "ManropeExtraBold",
    fontSize: 13,
    color: "#0040A1",
    fontWeight: "700",
  },
  adminPanelSubtitle: {
    fontFamily: "PublicSansMedium",
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 14,
  },
  adminButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  adminBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  adminBtnText: {
    color: "#FFFFFF",
    fontFamily: "PublicSansSemiBold",
    fontSize: 13,
    fontWeight: "600",
  },
  finalizedBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  finalizedNotice: {
    fontFamily: "PublicSansMedium",
    fontSize: 13,
    color: "#334155",
  },
  reopenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#EEF4FF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#0040A1",
  },
  reopenBtnText: {
    fontFamily: "PublicSansSemiBold",
    fontSize: 12,
    color: "#0040A1",
    fontWeight: "600",
  },
  // ESTILOS DE COMENTÁRIOS
  commentsSection: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  commentsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  commentsTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentsSectionTitle: {
    fontSize: 18,
    fontFamily: "ManropeExtraBold",
    fontWeight: "800",
    color: "#0F172A",
  },
  commentCountBadge: {
    backgroundColor: "#EEF4FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  commentCountText: {
    fontFamily: "PublicSansSemiBold",
    fontSize: 13,
    color: "#0040A1",
    fontWeight: "700",
  },
  commentsDescription: {
    fontFamily: "PublicSansMedium",
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 14,
  },
  commentInputBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: "PublicSansSemiBold",
    fontSize: 13,
    color: "#0F172A",
    marginBottom: 8,
    fontWeight: "600",
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    padding: 12,
    fontFamily: "PublicSansMedium",
    fontSize: 14,
    color: "#0F172A",
    minHeight: 70,
    textAlignVertical: "top",
  },
  inputFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  inputDisclaimer: {
    fontSize: 11,
    fontFamily: "PublicSansMedium",
    color: "#94A3B8",
    flex: 1,
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0040A1",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  sendButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontFamily: "PublicSansSemiBold",
    fontSize: 13,
    fontWeight: "600",
  },
  guestNoticeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 16,
    marginBottom: 16,
  },
  guestNoticeTitle: {
    fontFamily: "PublicSansSemiBold",
    fontSize: 14,
    color: "#1E3A8A",
    fontWeight: "700",
  },
  guestNoticeText: {
    fontFamily: "PublicSansMedium",
    fontSize: 12,
    color: "#3B82F6",
    marginTop: 2,
    lineHeight: 16,
  },
  guestLoginBtn: {
    backgroundColor: "#0040A1",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  guestLoginBtnText: {
    color: "#FFFFFF",
    fontFamily: "PublicSansSemiBold",
    fontSize: 12,
    fontWeight: "600",
  },
  commentsList: {
    gap: 12,
  },
  commentsLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
  },
  commentsLoadingText: {
    fontFamily: "PublicSansMedium",
    fontSize: 13,
    color: "#64748B",
  },
  emptyCommentsBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyCommentsTitle: {
    fontFamily: "PublicSansSemiBold",
    fontSize: 14,
    color: "#475569",
    fontWeight: "600",
    marginTop: 8,
  },
  emptyCommentsSubtitle: {
    fontFamily: "PublicSansMedium",
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 16,
  },
  commentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  commentCardPendente: {
    borderColor: "#F59E0B",
    borderWidth: 1.5,
    backgroundColor: "#FFFBEB",
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  commentAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentAuthorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0040A1",
    alignItems: "center",
    justifyContent: "center",
  },
  commentAuthorAvatarText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  commentAuthorName: {
    fontFamily: "PublicSansSemiBold",
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "600",
  },
  commentDate: {
    fontFamily: "PublicSansMedium",
    fontSize: 11,
    color: "#94A3B8",
  },
  pendenteBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  pendenteBadgeText: {
    fontSize: 10,
    fontFamily: "PublicSansSemiBold",
    color: "#B45309",
    fontWeight: "700",
  },
  liberadoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ECFDF5",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  liberadoBadgeText: {
    fontSize: 10,
    fontFamily: "PublicSansSemiBold",
    color: "#059669",
    fontWeight: "600",
  },
  commentBodyText: {
    fontFamily: "PublicSansMedium",
    fontSize: 14,
    color: "#334155",
    lineHeight: 20,
  },
  commentAdminActions: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#FDE68A",
  },
  adminActionNotice: {
    fontFamily: "PublicSansSemiBold",
    fontSize: 11,
    color: "#B45309",
    marginBottom: 6,
    fontWeight: "600",
  },
  commentActionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  liberarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10B981",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  liberarBtnText: {
    color: "#FFFFFF",
    fontFamily: "PublicSansSemiBold",
    fontSize: 12,
    fontWeight: "600",
  },
  recusarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEE2E2",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  recusarBtnText: {
    color: "#EF4444",
    fontFamily: "PublicSansSemiBold",
    fontSize: 12,
    fontWeight: "600",
  },
});
