import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Postagem } from "./Postagens";
import { ComentarioFormatado } from "../services/api";

type NotificationsModalProps = {
  visible: boolean;
  onClose: () => void;
  isAdmin: boolean;
  pendingPosts: Postagem[];
  pendingComments: ComentarioFormatado[];
  isLoading: boolean;
  onRefresh: () => void;
  onAprovarPost: (post: Postagem) => Promise<void>;
  onRecusarPost: (post: Postagem) => Promise<void>;
  onLiberarComentario: (comentario: ComentarioFormatado) => Promise<void>;
  onRecusarComentario: (comentario: ComentarioFormatado) => Promise<void>;
  onNavigateToPost: (post: Postagem) => void;
};

export function NotificationsModal({
  visible,
  onClose,
  isAdmin,
  pendingPosts,
  pendingComments,
  isLoading,
  onRefresh,
  onAprovarPost,
  onRecusarPost,
  onLiberarComentario,
  onRecusarComentario,
  onNavigateToPost,
}: NotificationsModalProps) {
  const [activeTab, setActiveTab] = useState<"todos" | "postagens" | "comentarios">("todos");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const totalPendentes = pendingPosts.length + pendingComments.length;

  async function handleAprovarPost(post: Postagem) {
    setProcessingId(post.id || (post as any)._id);
    try {
      await onAprovarPost(post);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRecusarPost(post: Postagem) {
    setProcessingId(post.id || (post as any)._id);
    try {
      await onRecusarPost(post);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleLiberarComentario(comentario: ComentarioFormatado) {
    setProcessingId(comentario.id);
    try {
      await onLiberarComentario(comentario);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRecusarComentario(comentario: ComentarioFormatado) {
    setProcessingId(comentario.id);
    try {
      await onRecusarComentario(comentario);
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Top Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <View style={styles.iconCircle}>
                <Ionicons name="notifications" size={18} color="#0040A1" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Central de Moderação</Text>
                <Text style={styles.modalSubtitle}>
                  {isAdmin
                    ? `${totalPendentes} pendência(s) de moderação`
                    : "Notificações de alertas"}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={onRefresh}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={18} color="#64748B" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Abas se for admin */}
          {isAdmin && (
            <View style={styles.tabsRow}>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === "todos" && styles.tabButtonActive,
                ]}
                onPress={() => setActiveTab("todos")}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === "todos" && styles.tabButtonTextActive,
                  ]}
                >
                  Tudo ({totalPendentes})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === "postagens" && styles.tabButtonActive,
                ]}
                onPress={() => setActiveTab("postagens")}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === "postagens" && styles.tabButtonTextActive,
                  ]}
                >
                  Postagens ({pendingPosts.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === "comentarios" && styles.tabButtonActive,
                ]}
                onPress={() => setActiveTab("comentarios")}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === "comentarios" && styles.tabButtonTextActive,
                  ]}
                >
                  Comentários ({pendingComments.length})
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Conteúdo com Scroll */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {isLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#0040A1" />
                <Text style={styles.loadingText}>Atualizando notificações...</Text>
              </View>
            ) : !isAdmin ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={52}
                  color="#10B981"
                />
                <Text style={styles.emptyTitle}>Tudo atualizado!</Text>
                <Text style={styles.emptySubtitle}>
                  Você receberá notificações aqui sempre que houver novidades sobre
                  alertas da comunidade.
                </Text>
              </View>
            ) : totalPendentes === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="shield-checkmark"
                  size={52}
                  color="#10B981"
                />
                <Text style={styles.emptyTitle}>Nenhuma pendência!</Text>
                <Text style={styles.emptySubtitle}>
                  Todas as postagens e comentários foram moderados e liberados com
                  sucesso.
                </Text>
              </View>
            ) : (
              <>
                {/* 1. SEÇÃO DE POSTAGENS PENDENTES */}
                {(activeTab === "todos" || activeTab === "postagens") &&
                  pendingPosts.length > 0 && (
                    <View style={styles.sectionBlock}>
                      <View style={styles.sectionHeader}>
                        <Ionicons name="megaphone" size={16} color="#0040A1" />
                        <Text style={styles.sectionTitle}>
                          Postagens Aguardando Liberação (
                          {pendingPosts.length})
                        </Text>
                      </View>

                      {pendingPosts.map((post) => {
                        const postId = post.id || (post as any)._id;
                        const isThisProcessing = processingId === postId;

                        return (
                          <View key={postId} style={styles.pendingCard}>
                            <View style={styles.cardTopRow}>
                              {post.fotoPerfil &&
                              (post.fotoPerfil.startsWith("http") ||
                                post.fotoPerfil.startsWith("data:image/") ||
                                post.fotoPerfil.startsWith("file://")) ? (
                                <Image
                                  source={{ uri: post.fotoPerfil }}
                                  style={styles.cardAvatar}
                                  resizeMode="cover"
                                />
                              ) : (
                                <View style={styles.avatarPlaceholder}>
                                  <Ionicons
                                    name="person"
                                    size={20}
                                    color="#94A3B8"
                                  />
                                </View>
                              )}

                              <View style={{ flex: 1 }}>
                                <View style={styles.cardBadgeRow}>
                                  <Text style={styles.cardItemTitle} numberOfLines={1}>
                                    {post.nome}
                                  </Text>
                                  <View style={styles.amberTag}>
                                    <Text style={styles.amberTagText}>NOVA POSTAGEM</Text>
                                  </View>
                                </View>

                                <Text style={styles.cardItemMeta}>
                                  {post.idade} anos • {post.ultimaLocalidade}
                                </Text>

                                <Text style={styles.cardItemReporter}>
                                  Reportado por:{" "}
                                  <Text style={{ fontWeight: "600" }}>
                                    {post.usuarioPostagem?.nome || "Usuário"}
                                  </Text>
                                </Text>
                              </View>
                            </View>

                            {/* Botões de Ação da Postagem */}
                            <View style={styles.cardActionsRow}>
                              <TouchableOpacity
                                style={styles.viewDetailBtn}
                                onPress={() => {
                                  onClose();
                                  onNavigateToPost(post);
                                }}
                                activeOpacity={0.8}
                              >
                                <Ionicons
                                  name="eye-outline"
                                  size={15}
                                  color="#0040A1"
                                />
                                <Text style={styles.viewDetailBtnText}>
                                  Ver Detalhes
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[
                                  styles.approveBtn,
                                  isThisProcessing && styles.btnDisabled,
                                ]}
                                onPress={() => handleAprovarPost(post)}
                                disabled={isThisProcessing}
                                activeOpacity={0.85}
                              >
                                <Ionicons
                                  name="checkmark"
                                  size={15}
                                  color="#FFFFFF"
                                />
                                <Text style={styles.actionBtnText}>Aprovar</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[
                                  styles.rejectBtn,
                                  isThisProcessing && styles.btnDisabled,
                                ]}
                                onPress={() => handleRecusarPost(post)}
                                disabled={isThisProcessing}
                                activeOpacity={0.85}
                              >
                                <Ionicons
                                  name="close"
                                  size={15}
                                  color="#FFFFFF"
                                />
                                <Text style={styles.actionBtnText}>Recusar</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}

                {/* 2. SEÇÃO DE COMENTÁRIOS PENDENTES */}
                {(activeTab === "todos" || activeTab === "comentarios") &&
                  pendingComments.length > 0 && (
                    <View style={styles.sectionBlock}>
                      <View style={styles.sectionHeader}>
                        <Ionicons
                          name="chatbubbles"
                          size={16}
                          color="#0040A1"
                        />
                        <Text style={styles.sectionTitle}>
                          Comentários Aguardando Liberação (
                          {pendingComments.length})
                        </Text>
                      </View>

                      {pendingComments.map((comentario) => {
                        const isThisProcessing =
                          processingId === comentario.id;

                        return (
                          <View
                            key={comentario.id}
                            style={[styles.pendingCard, styles.commentPendingCard]}
                          >
                            <View style={styles.commentCardHeader}>
                              <View style={styles.authorGroup}>
                                <View style={styles.commentAvatarCircle}>
                                  <Text style={styles.commentAvatarText}>
                                    {(comentario.autor || "U")
                                      .charAt(0)
                                      .toUpperCase()}
                                  </Text>
                                </View>
                                <View>
                                  <Text style={styles.commentAuthorName}>
                                    {comentario.autor}
                                  </Text>
                                  <Text style={styles.commentPostId}>
                                    Postagem ID: ...{comentario.postagemId.slice(-6)}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.amberTag}>
                                <Ionicons
                                  name="time-outline"
                                  size={11}
                                  color="#D97706"
                                />
                                <Text style={styles.amberTagText}>
                                  PENDENTE
                                </Text>
                              </View>
                            </View>

                            <View style={styles.commentTextBubble}>
                              <Text style={styles.commentText}>
                                "{comentario.texto}"
                              </Text>
                            </View>

                            {/* Botões de Moderação do Comentário */}
                            <View style={styles.cardActionsRow}>
                              <TouchableOpacity
                                style={[
                                  styles.approveBtn,
                                  isThisProcessing && styles.btnDisabled,
                                ]}
                                onPress={() =>
                                  handleLiberarComentario(comentario)
                                }
                                disabled={isThisProcessing}
                                activeOpacity={0.85}
                              >
                                <Ionicons
                                  name="checkmark-circle"
                                  size={15}
                                  color="#FFFFFF"
                                />
                                <Text style={styles.actionBtnText}>
                                  Liberar Comentário
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[
                                  styles.rejectBtn,
                                  isThisProcessing && styles.btnDisabled,
                                ]}
                                onPress={() =>
                                  handleRecusarComentario(comentario)
                                }
                                disabled={isThisProcessing}
                                activeOpacity={0.85}
                              >
                                <Ionicons
                                  name="trash-outline"
                                  size={15}
                                  color="#FFFFFF"
                                />
                                <Text style={styles.actionBtnText}>Recusar</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    minHeight: "50%",
    paddingTop: 16,
    paddingBottom: 30,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EEF4FF",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    fontFamily: "ManropeExtraBold",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748B",
    fontFamily: "PublicSansMedium",
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
  },
  tabButtonActive: {
    backgroundColor: "#0040A1",
  },
  tabButtonText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
    fontFamily: "PublicSansSemiBold",
  },
  tabButtonTextActive: {
    color: "#FFFFFF",
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
    fontFamily: "PublicSansMedium",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    paddingHorizontal: 30,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 8,
    fontFamily: "ManropeExtraBold",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    fontFamily: "PublicSansMedium",
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0040A1",
    fontFamily: "ManropeExtraBold",
  },
  pendingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    gap: 12,
  },
  commentPendingCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
  },
  cardTopRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  cardAvatar: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardItemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    fontFamily: "ManropeExtraBold",
    flex: 1,
  },
  amberTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FEF3C7",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  amberTagText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#B45309",
    fontFamily: "PublicSansSemiBold",
  },
  cardItemMeta: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontFamily: "PublicSansMedium",
  },
  cardItemReporter: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
    fontFamily: "PublicSansMedium",
  },
  cardActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  viewDetailBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#EEF4FF",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  viewDetailBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0040A1",
    fontFamily: "PublicSansSemiBold",
  },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#10B981",
    paddingVertical: 8,
    borderRadius: 8,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#EF4444",
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "PublicSansSemiBold",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  commentCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authorGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0040A1",
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  commentAuthorName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
    fontFamily: "PublicSansSemiBold",
  },
  commentPostId: {
    fontSize: 10,
    color: "#94A3B8",
    fontFamily: "PublicSansMedium",
  },
  commentTextBubble: {
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  commentText: {
    fontSize: 13,
    color: "#334155",
    fontStyle: "italic",
    lineHeight: 18,
    fontFamily: "PublicSansMedium",
  },
});
