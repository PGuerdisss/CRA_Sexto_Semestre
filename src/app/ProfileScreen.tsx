import React, { useContext, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
} from "react-native";
import { Feather, FontAwesome, Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { styles } from "./stylex";
import { AuthContext } from "../contexts/AuthContext";
import * as SecureStore from "expo-secure-store";

type DelegaciaProxima = {
  id: string;
  nome: string;
  endereco: string;
  latitude: number;
  longitude: number;
  distanciaKm: number;
};

function calcularDistanciaKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const PASSOS_BOLETIM = [
  {
    numero: "1",
    titulo: "Não aguarde 24 horas (Ação Imediata)",
    descricao:
      "Pela Lei Federal nº 11.259/2005 (Lei da Busca Imediata) e pelo Estatuto da Criança e do Adolescente (ECA), NÃO existe prazo de espera de 24h ou 48h. Procure a delegacia imediatamente após notar o desaparecimento.",
    icone: "time-outline" as const,
  },
  {
    numero: "2",
    titulo: "Separe os documentos e uma foto recente",
    descricao:
      "Leve um documento de identificação seu (RG ou CNH), o documento da pessoa desaparecida (RG, CPF ou Certidão de Nascimento) e uma fotografia recente, nítida e de rosto inteiro.",
    icone: "id-card-outline" as const,
  },
  {
    numero: "3",
    titulo: "Anote informações essenciais do caso",
    descricao:
      "Informe à polícia: roupas e calçados que a pessoa usava, último local e horário exato em que foi vista, características físicas (altura, cicatrizes, manchas), uso de medicamentos contínuos e telefone/redes sociais de amigos próximos.",
    icone: "document-text-outline" as const,
  },
  {
    numero: "4",
    titulo: "Compareça à Delegacia mais próxima",
    descricao:
      "Qualquer Delegacia de Polícia Civil ou DHPP (Divisão de Homicídios e Proteção à Pessoa) tem obrigação legal de registrar o Boletim de Ocorrência na hora e iniciar o alerta de busca nos órgãos de segurança.",
    icone: "location-outline" as const,
  },
  {
    numero: "5",
    titulo: "Guarde o protocolo e divulgue no CRA",
    descricao:
      "Solicite uma cópia ou o número de protocolo do B.O., peça a inclusão no Cadastro Nacional de Pessoas Desaparecidas e publique o alerta aqui no aplicativo CRA para mobilizar toda a comunidade da sua região.",
    icone: "megaphone-outline" as const,
  },
];

export const ProfileScreen = ({ navigation }: any) => {
  const { userToken, setUserToken } = useContext(AuthContext);

  const isAdmin = userToken?.roles?.[0]?.name === "ADMIN";

  // Estados do Assistente de Boletim de Ocorrência e Localização de Delegacia
  const [boModalVisible, setBoModalVisible] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [userCoords, setUserCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [userAddress, setUserAddress] = useState<string>("");
  const [delegaciasProximas, setDelegaciasProximas] = useState<
    DelegaciaProxima[]
  >([]);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Componente para Itens de Menu com Seta
  const MenuItem = ({ icon, text, onPress, color = "#343A40" }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuItemLeft}>
        <View
          style={[styles.menuIconWrapper, { backgroundColor: color + "10" }]}
        >
          <Feather name={icon} size={18} color={color} />
        </View>
        <Text style={[styles.menuText, { color }]}>{text}</Text>
      </View>
      <Feather name="chevron-right" size={20} color="#ADB5BD" />
    </TouchableOpacity>
  );

  // Componente para Informações de Leitura
  const InfoItem = ({ label, value, icon }: any) => (
    <View style={styles.infoItem}>
      <View style={styles.infoItemLeft}>
        <Feather
          name={icon}
          size={16}
          color="#868E96"
          style={{ marginRight: 10 }}
        />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value || "Não informado"}</Text>
    </View>
  );

  async function handleLogout() {
    try {
      await SecureStore.deleteItemAsync("token");
    } catch (e) {
      console.log("Erro ao limpar token:", e);
    }
    setUserToken(null);
  }

  async function buscarDelegaciasProximas() {
    setLoadingLocation(true);
    setLocationError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError(
          "Permissão de localização negada. Ative o GPS nas configurações do celular para localizarmos a delegacia mais próxima de você."
        );
        setLoadingLocation(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = position.coords;
      setUserCoords({ latitude, longitude });

      // Obtém o endereço atual aproximado do usuário
      try {
        const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (rev && rev.length > 0) {
          const item = rev[0];
          const rua = item.street || item.name || "";
          const bairro = item.district || item.subregion || "";
          const cidade = item.city || item.region || "";
          const partes = [rua, bairro, cidade].filter(Boolean);
          if (partes.length > 0) {
            setUserAddress(partes.join(", "));
          }
        }
      } catch {}

      // Busca delegacias em um raio próximo (~15km) usando OpenStreetMap Nominatim
      const delta = 0.15;
      const viewbox = `${longitude - delta},${latitude + delta},${
        longitude + delta
      },${latitude - delta}`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=Delegacia+de+Policia&bounded=1&viewbox=${viewbox}&limit=6&addressdetails=1`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": "ChildRescueAlertApp/1.0",
          "Accept-Language": "pt-BR",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const formatadas: DelegaciaProxima[] = data
            .map((d: any, idx: number) => {
              const lat = parseFloat(d.lat);
              const lon = parseFloat(d.lon);
              const dist = calcularDistanciaKm(latitude, longitude, lat, lon);
              const nomePrincipal =
                d.name ||
                (typeof d.display_name === "string"
                  ? d.display_name.split(",")[0]
                  : "Delegacia de Polícia");
              const enderecoCurto =
                typeof d.display_name === "string"
                  ? d.display_name
                      .split(",")
                      .slice(1, 4)
                      .map((s: string) => s.trim())
                      .join(", ")
                  : "Ver localização no mapa";

              return {
                id: String(d.place_id || idx),
                nome: nomePrincipal,
                endereco: enderecoCurto,
                latitude: lat,
                longitude: lon,
                distanciaKm: dist,
              };
            })
            .sort((a, b) => a.distanciaKm - b.distanciaKm)
            .slice(0, 4);

          setDelegaciasProximas(formatadas);
        } else {
          setDelegaciasProximas([]);
        }
      }
    } catch (err) {
      console.log("Erro ao obter localização atual:", err);
      setLocationError(
        "Não foi possível obter sua localização exata no momento, mas você ainda pode abrir a busca de delegacias direto no mapa."
      );
    } finally {
      setLoadingLocation(false);
    }
  }

  function handleAbrirAssistenteBO() {
    setBoModalVisible(true);
    buscarDelegaciasProximas();
  }

  async function handleAbrirMapaDelegaciasProximas() {
    try {
      let coords = userCoords;
      if (!coords) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          setUserCoords(coords);
        }
      }

      const query = encodeURIComponent("Delegacia de Polícia Civil");
      if (coords) {
        const { latitude, longitude } = coords;
        const url = Platform.select({
          ios: `maps:0,0?q=${query}&sll=${latitude},${longitude}`,
          android: `geo:${latitude},${longitude}?q=${query}`,
          default: `https://www.google.com/maps/search/?api=1&query=${query}&center=${latitude},${longitude}`,
        });

        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
          return;
        }
        await Linking.openURL(
          `https://www.google.com/maps/search/?api=1&query=${query}+perto+de+${latitude},${longitude}`
        );
      } else {
        await Linking.openURL(
          `https://www.google.com/maps/search/?api=1&query=${query}`
        );
      }
    } catch {
      Alert.alert(
        "Erro ao abrir o mapa",
        "Não foi possível abrir o aplicativo de mapas do seu celular."
      );
    }
  }

  async function handleTracarRotaDelegacia(delegacia: DelegaciaProxima) {
    try {
      const { latitude, longitude, nome } = delegacia;
      const label = encodeURIComponent(nome);
      const url = Platform.select({
        ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
        android: `google.navigation:q=${latitude},${longitude}`,
        default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
      });

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
        );
      }
    } catch {
      Alert.alert(
        "Erro",
        "Não foi possível iniciar a rota até a delegacia selecionada."
      );
    }
  }

  function handleLigarEmergencia(numero: string) {
    Linking.openURL(`tel:${numero}`).catch(() => {
      Alert.alert(
        "Telefone de Emergência",
        `Disque ${numero} no teclado do seu celular.`
      );
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {userToken == null ? (
          // Visual para Usuário Convidado (Sem login)
          <View style={localStyles.guestContainer}>
            <View style={localStyles.guestHeader}>
              <View style={styles.avatarWrapper}>
                <FontAwesome name="user-circle" color={"#94A3B8"} size={96} />
              </View>
              <Text style={localStyles.guestTitle}>
                Navegando como Visitante
              </Text>
              <Text style={localStyles.guestSubtitle}>
                Conecte-se ou cadastre-se para efetuar postagens, gerenciar
                alertas e acessar suas informações.
              </Text>
            </View>

            <View style={localStyles.guestButtonsContainer}>
              <TouchableOpacity
                style={localStyles.loginButton}
                onPress={() => navigation.navigate("Login")}
                activeOpacity={0.8}
              >
                <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
                <Text style={localStyles.loginButtonText}>
                  Cadastrar ou Conectar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={localStyles.registerButton}
                onPress={() => navigation.navigate("Register")}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add-outline" size={18} color="#0040A1" />
                <Text style={localStyles.registerButtonText}>
                  Criar nova conta
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.versionText}>CRA App - Versão 1.0.24</Text>
          </View>
        ) : (
          // Visual para Usuário Autenticado
          <>
            {/* Header Escuro (Visualmente Contido) */}
            <View style={styles.darkHeader}>
              <View style={styles.headerTopRow}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => navigation.navigate("Feed")}
                />
                <TouchableOpacity style={styles.editIcon} />
              </View>

              <View style={styles.profileMainInfo}>
                <View style={styles.avatarWrapper}>
                  <FontAwesome name="user-circle" color={"white"} size={100} />
                  <View style={styles.onlineBadge} />
                </View>
                <Text style={styles.userName}>{userToken?.username}</Text>
                <Text style={styles.userEmail}>{userToken?.email}</Text>
                <View
                  style={[
                    localStyles.roleBadge,
                    isAdmin
                      ? localStyles.roleBadgeAdmin
                      : localStyles.roleBadgeUser,
                  ]}
                >
                  <Ionicons
                    name={isAdmin ? "shield-checkmark" : "person-circle-outline"}
                    size={14}
                    color={isAdmin ? "#FDE68A" : "#BFDBFE"}
                  />
                  <Text
                    style={[
                      localStyles.roleBadgeText,
                      isAdmin
                        ? localStyles.roleBadgeTextAdmin
                        : localStyles.roleBadgeTextUser,
                    ]}
                  >
                    {isAdmin ? "Administrador CRA" : "Usuário Cadastrado"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Conteúdo sobre o fundo claro */}
            <View style={styles.whiteContentBody}>
              {/* ÁREA EXCLUSIVA DO USUÁRIO CADASTRADO (NÃO ADMIN): AUXÍLIO PARA B.O. E DELEGACIA PRÓXIMA */}
              {!isAdmin && (
                <>
                  <Text style={styles.sectionTitle}>
                    AUXÍLIO EM CASO DE DESAPARECIMENTO
                  </Text>
                  <View style={localStyles.boSupportCard}>
                    <View style={localStyles.boCardHeader}>
                      <View style={localStyles.boIconCircle}>
                        <MaterialIcons
                          name="local-police"
                          size={24}
                          color="#0040A1"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={localStyles.boCardTitle}>
                          Registrar Boletim de Ocorrência
                        </Text>
                        <Text style={localStyles.boCardSubtitle}>
                          Localize a delegacia mais próxima de você pelo GPS e
                          veja o passo a passo oficial para comunicar o
                          desaparecimento.
                        </Text>
                      </View>
                    </View>

                    <View style={localStyles.lawHighlightBox}>
                      <Ionicons
                        name="alert-circle"
                        size={18}
                        color="#B45309"
                      />
                      <Text style={localStyles.lawHighlightText}>
                        <Text style={{ fontWeight: "700" }}>
                          Lei da Busca Imediata (Lei 11.259/05):{" "}
                        </Text>
                        Não é preciso esperar 24h para registrar o
                        desaparecimento na delegacia.
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={localStyles.boPrimaryButton}
                      onPress={handleAbrirAssistenteBO}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name="navigate-circle-outline"
                        size={20}
                        color="#FFFFFF"
                      />
                      <Text style={localStyles.boPrimaryButtonText}>
                        Passo a Passo do B.O. e Delegacia Próxima
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={localStyles.boSecondaryButton}
                      onPress={handleAbrirMapaDelegaciasProximas}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="location-outline"
                        size={18}
                        color="#0040A1"
                      />
                      <Text style={localStyles.boSecondaryButtonText}>
                        Abrir Delegacias Próximas no Mapa (GPS)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <Text style={styles.sectionTitle}>DADOS DA CONTA</Text>
              <View style={styles.card}>
                <InfoItem
                  icon="user"
                  label="Nome"
                  value={userToken?.username}
                />
                <InfoItem
                  icon="mail"
                  label="E-mail"
                  value={userToken?.email}
                />
                <InfoItem
                  icon="phone"
                  label="Contato"
                  value="(11) 99999-9999"
                />
              </View>

              {/* Botão Sair/Logout */}
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
              >
                <Feather
                  name="log-out"
                  size={20}
                  color="#FF6B6B"
                  style={{ marginRight: 10 }}
                />
                <Text style={styles.logoutButtonText}>Sair da conta</Text>
              </TouchableOpacity>

              <Text style={styles.versionText}>CRA App - Versão 1.0.24</Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* MODAL COMPLETO: GUIA PASSO A PASSO DO B.O. + DELEGACIAS PRÓXIMAS (GPS) */}
      <Modal
        visible={boModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setBoModalVisible(false)}
      >
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContainer}>
            {/* Cabeçalho do Modal */}
            <View style={localStyles.modalHeader}>
              <View style={localStyles.modalTitleRow}>
                <View style={localStyles.modalHeaderIcon}>
                  <MaterialIcons
                    name="local-police"
                    size={22}
                    color="#0040A1"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={localStyles.modalTitle}>
                    Guia de Boletim de Ocorrência
                  </Text>
                  <Text style={localStyles.modalSubtitle}>
                    Orientações oficiais e delegacias próximas ao seu GPS
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={localStyles.modalCloseBtn}
                onPress={() => setBoModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#475569" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={localStyles.modalScroll}
              contentContainerStyle={localStyles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* SEÇÃO 1: DELEGACIAS PRÓXIMAS PELA LOCALIZAÇÃO ATUAL */}
              <View style={localStyles.gpsSectionCard}>
                <View style={localStyles.gpsSectionHeader}>
                  <View style={localStyles.gpsHeaderLeft}>
                    <Ionicons name="locate" size={18} color="#0040A1" />
                    <Text style={localStyles.gpsSectionTitle}>
                      Delegacias Próximas de Você
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={localStyles.gpsRefreshBtn}
                    onPress={buscarDelegaciasProximas}
                    disabled={loadingLocation}
                  >
                    <Ionicons name="refresh" size={15} color="#0040A1" />
                    <Text style={localStyles.gpsRefreshText}>Atualizar GPS</Text>
                  </TouchableOpacity>
                </View>

                {userAddress ? (
                  <View style={localStyles.currentAddressRow}>
                    <Ionicons
                      name="pin-outline"
                      size={15}
                      color="#475569"
                    />
                    <Text style={localStyles.currentAddressText}>
                      Sua localização atual: {userAddress}
                    </Text>
                  </View>
                ) : null}

                {loadingLocation ? (
                  <View style={localStyles.gpsLoadingBox}>
                    <ActivityIndicator size="small" color="#0040A1" />
                    <Text style={localStyles.gpsLoadingText}>
                      Obtendo sua localização atual e buscando delegacias
                      próximas...
                    </Text>
                  </View>
                ) : locationError ? (
                  <View style={localStyles.gpsErrorBox}>
                    <Ionicons
                      name="warning-outline"
                      size={18}
                      color="#D97706"
                    />
                    <Text style={localStyles.gpsErrorText}>
                      {locationError}
                    </Text>
                  </View>
                ) : delegaciasProximas.length > 0 ? (
                  <View style={localStyles.delegaciasList}>
                    {delegaciasProximas.map((del) => (
                      <View key={del.id} style={localStyles.delegaciaItem}>
                        <View style={{ flex: 1 }}>
                          <View style={localStyles.delegaciaTopRow}>
                            <Text
                              style={localStyles.delegaciaName}
                              numberOfLines={1}
                            >
                              {del.nome}
                            </Text>
                            <View style={localStyles.distanceBadge}>
                              <Text style={localStyles.distanceBadgeText}>
                                {del.distanciaKm < 1
                                  ? `${Math.round(del.distanciaKm * 1000)} m`
                                  : `${del.distanciaKm.toFixed(1)} km`}
                              </Text>
                            </View>
                          </View>
                          <Text
                            style={localStyles.delegaciaAddress}
                            numberOfLines={2}
                          >
                            {del.endereco}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={localStyles.routeBtn}
                          onPress={() => handleTracarRotaDelegacia(del)}
                          activeOpacity={0.85}
                        >
                          <Ionicons
                            name="navigate"
                            size={14}
                            color="#FFFFFF"
                          />
                          <Text style={localStyles.routeBtnText}>Rota</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={localStyles.noStationFoundText}>
                    Toque no botão abaixo para visualizar todas as delegacias
                    próximas à sua posição diretamente no aplicativo de Mapas.
                  </Text>
                )}

                <TouchableOpacity
                  style={localStyles.openMapsFullBtn}
                  onPress={handleAbrirMapaDelegaciasProximas}
                  activeOpacity={0.85}
                >
                  <Ionicons name="map-outline" size={18} color="#FFFFFF" />
                  <Text style={localStyles.openMapsFullBtnText}>
                    Ver Delegacias Próximas no Google / Apple Maps
                  </Text>
                </TouchableOpacity>
              </View>

              {/* SEÇÃO 2: PASSO A PASSO OFICIAL PARA O BOLETIM DE OCORRÊNCIA */}
              <Text style={localStyles.stepsHeaderTitle}>
                PASSO A PASSO PARA REGISTRAR O B.O.
              </Text>

              {PASSOS_BOLETIM.map((passo) => (
                <View key={passo.numero} style={localStyles.stepCard}>
                  <View style={localStyles.stepBadge}>
                    <Text style={localStyles.stepBadgeNumber}>
                      {passo.numero}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={localStyles.stepTitleRow}>
                      <Ionicons
                        name={passo.icone}
                        size={16}
                        color="#0040A1"
                      />
                      <Text style={localStyles.stepTitle}>{passo.titulo}</Text>
                    </View>
                    <Text style={localStyles.stepDescription}>
                      {passo.descricao}
                    </Text>
                  </View>
                </View>
              ))}

              {/* SEÇÃO 3: TELEFONES DE EMERGÊNCIA RÁPIDA */}
              <Text style={localStyles.stepsHeaderTitle}>
                CANAIS DE EMERGÊNCIA (LIGAÇÃO DIRETA)
              </Text>
              <View style={localStyles.emergencyRow}>
                <TouchableOpacity
                  style={localStyles.emergencyBtn}
                  onPress={() => handleLigarEmergencia("190")}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={18} color="#DC2626" />
                  <Text style={localStyles.emergencyNumber}>190</Text>
                  <Text style={localStyles.emergencyLabel}>
                    Polícia Militar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={localStyles.emergencyBtn}
                  onPress={() => handleLigarEmergencia("197")}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={18} color="#0040A1" />
                  <Text
                    style={[
                      localStyles.emergencyNumber,
                      { color: "#0040A1" },
                    ]}
                  >
                    197
                  </Text>
                  <Text style={localStyles.emergencyLabel}>Polícia Civil</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={localStyles.emergencyBtn}
                  onPress={() => handleLigarEmergencia("100")}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={18} color="#D97706" />
                  <Text
                    style={[
                      localStyles.emergencyNumber,
                      { color: "#D97706" },
                    ]}
                  >
                    100
                  </Text>
                  <Text style={localStyles.emergencyLabel}>
                    Direitos Humanos
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Botão de Atalho para Publicar Alerta no CRA */}
              <TouchableOpacity
                style={localStyles.publishCraBtn}
                onPress={() => {
                  setBoModalVisible(false);
                  navigation.navigate("Report");
                }}
                activeOpacity={0.85}
              >
                <MaterialIcons name="report" size={20} color="#0040A1" />
                <Text style={localStyles.publishCraBtnText}>
                  Também quero publicar este alerta no CRA
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const localStyles = StyleSheet.create({
  guestContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 480,
  },
  guestHeader: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 32,
  },
  guestTitle: {
    fontFamily: "ManropeExtraBold",
    fontSize: 22,
    color: "#0F172A",
    marginTop: 18,
    marginBottom: 8,
    textAlign: "center",
  },
  guestSubtitle: {
    fontFamily: "PublicSansMedium",
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  guestButtonsContainer: {
    width: "100%",
    gap: 12,
    marginBottom: 40,
  },
  loginButton: {
    width: "100%",
    height: 52,
    backgroundColor: "#0040A1",
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#0040A1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontFamily: "PublicSansSemiBold",
    fontSize: 15,
    fontWeight: "600",
  },
  registerButton: {
    width: "100%",
    height: 52,
    backgroundColor: "#EEF4FF",
    borderWidth: 1.5,
    borderColor: "#0040A1",
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  registerButtonText: {
    color: "#0040A1",
    fontFamily: "PublicSansSemiBold",
    fontSize: 15,
    fontWeight: "600",
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  roleBadgeUser: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.4)",
  },
  roleBadgeAdmin: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(253, 230, 138, 0.4)",
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "PublicSansSemiBold",
  },
  roleBadgeTextUser: {
    color: "#DBEAFE",
  },
  roleBadgeTextAdmin: {
    color: "#FEF3C7",
  },
  boSupportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    elevation: 3,
    shadowColor: "#0040A1",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    gap: 12,
  },
  boCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  boIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#EEF4FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  boCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    fontFamily: "ManropeExtraBold",
    marginBottom: 4,
  },
  boCardSubtitle: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
    fontFamily: "PublicSansMedium",
  },
  lawHighlightBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 10,
    padding: 10,
  },
  lawHighlightText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 17,
    fontFamily: "PublicSansMedium",
  },
  boPrimaryButton: {
    backgroundColor: "#0040A1",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    elevation: 2,
  },
  boPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "PublicSansSemiBold",
  },
  boSecondaryButton: {
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#93C5FD",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  boSecondaryButtonText: {
    color: "#0040A1",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "PublicSansSemiBold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    minHeight: "75%",
    paddingTop: 16,
    paddingBottom: 28,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  modalHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
    marginTop: 2,
    fontFamily: "PublicSansMedium",
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 18,
    paddingBottom: 36,
  },
  gpsSectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    marginBottom: 20,
    gap: 12,
  },
  gpsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gpsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gpsSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    fontFamily: "ManropeExtraBold",
  },
  gpsRefreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EEF4FF",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  gpsRefreshText: {
    fontSize: 12,
    color: "#0040A1",
    fontWeight: "600",
  },
  currentAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F1F5F9",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  currentAddressText: {
    flex: 1,
    fontSize: 12,
    color: "#334155",
    fontFamily: "PublicSansMedium",
  },
  gpsLoadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
  },
  gpsLoadingText: {
    flex: 1,
    fontSize: 13,
    color: "#475569",
  },
  gpsErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    padding: 10,
    borderRadius: 8,
  },
  gpsErrorText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 17,
  },
  delegaciasList: {
    gap: 10,
  },
  delegaciaItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  delegaciaTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  delegaciaName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    flexShrink: 1,
  },
  distanceBadge: {
    backgroundColor: "#DBEAFE",
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 10,
  },
  distanceBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0040A1",
  },
  delegaciaAddress: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 16,
  },
  routeBtn: {
    backgroundColor: "#0040A1",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  routeBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  noStationFoundText: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
  },
  openMapsFullBtn: {
    backgroundColor: "#0040A1",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  openMapsFullBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "PublicSansSemiBold",
  },
  stepsHeaderTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.8,
    marginBottom: 12,
    marginTop: 6,
  },
  stepCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0040A1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  stepBadgeNumber: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  stepTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
  },
  stepDescription: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 19,
  },
  emergencyRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  emergencyBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  emergencyNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: "#DC2626",
  },
  emergencyLabel: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
  },
  publishCraBtn: {
    backgroundColor: "#EEF4FF",
    borderWidth: 1.5,
    borderColor: "#0040A1",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  publishCraBtnText: {
    color: "#0040A1",
    fontSize: 14,
    fontWeight: "700",
  },
});
