import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import * as Location from "expo-location";
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Callout } from "react-native-maps";
import { AuthContext } from "../contexts/AuthContext";
import { Header } from "../components/Header";
import { service } from "../services/api";
import { RootStackParamList } from "../types/ParamList";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Postagem } from "../components/Postagens";

type NavigationProps = NativeStackNavigationProp<RootStackParamList, "Maps">;

type CoordType = {
  id: string;
  latitude: number;
  longitude: number;
  titulo: string;
  fotoPerfil: string;
  ultimaLocalidade: string;
  cep?: string;
  idade?: number;
  dataDesaparecimento?: string;
  postagem: Postagem;
};

type SearchedLocation = {
  latitude: number;
  longitude: number;
  title: string;
};

// PIN CIRCULAR 66x66 COM FOTO DO DESAPARECIDO
function CasePin({
  coord,
  isSelected,
  onPress,
}: {
  coord: CoordType;
  isSelected: boolean;
  onPress: () => void;
}) {
  const [imageError, setImageError] = useState(false);
  const isValidUrl =
    Boolean(coord.fotoPerfil) &&
    typeof coord.fotoPerfil === "string" &&
    (coord.fotoPerfil.startsWith("http") ||
      coord.fotoPerfil.startsWith("data:image/") ||
      coord.fotoPerfil.startsWith("file://")) &&
    !coord.fotoPerfil.includes("example.com");

  return (
    <Marker
      key={`pin-${coord.id}-${isValidUrl && !imageError ? "img" : "icon"}-${
        isSelected ? "sel" : "unsel"
      }`}
      coordinate={{
        latitude: coord.latitude,
        longitude: coord.longitude,
      }}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={onPress}
      onSelect={onPress}
      tracksViewChanges={Platform.OS === "android"}
    >
      <View
        pointerEvents="none"
        style={[
          styles.markerCircle,
          isSelected && styles.markerCircleSelected,
        ]}
      >
        {isValidUrl && !imageError ? (
          <Image
            source={{ uri: coord.fotoPerfil }}
            style={styles.markerImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <MaterialIcons name="person" size={36} color="#FFFFFF" />
        )}

        {/* Ponto indicador de alerta ativo */}
        <View style={styles.markerStatusDot} />
      </View>

      <Callout onPress={onPress}>
        <View style={styles.calloutBox}>
          <Text style={styles.calloutTitle} numberOfLines={1}>
            {coord.titulo}
          </Text>
          <Text style={styles.calloutSubtitle}>Toque para ver a postagem</Text>
        </View>
      </Callout>
    </Marker>
  );
}

export function Maps() {
  const [fontsLoaded] = useFonts({
    ManropeExtraBold: require("../../assets/fonts/Manrope-ExtraBold.ttf"),
    PublicSansMedium: require("../../assets/fonts/PublicSans-Medium.ttf"),
    PublicSansSemiBold: require("../../assets/fonts/PublicSans-SemiBold.ttf"),
  });

  const navigation = useNavigation<NavigationProps>();
  const mapRef = useRef<MapView>(null);
  const geocodeCache = useRef<Record<string, { lat: number; lng: number }>>({});

  const [coordenadas, setCoordenadas] = useState<CoordType[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [selectedCoord, setSelectedCoord] = useState<CoordType | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchedLocation, setSearchedLocation] =
    useState<SearchedLocation | null>(null);

  const { userToken } = useContext(AuthContext);

  const KNOWN_ADDRESS_COORDS: Record<string, { lat: number; lng: number }> = {
    "rua mary garden, jardim rubilene, são paulo - sp": {
      lat: -23.7039012,
      lng: -46.6349372,
    },
    "rua manoel amaral, centro, diadema - sp": {
      lat: -23.6915562,
      lng: -46.6323483,
    },
    "rua joão fernandes de oliveira, centro, diadema - sp": {
      lat: -23.6925922,
      lng: -46.6326565,
    },
    "rua francisco alves, centro, diadema - sp": {
      lat: -23.69325,
      lng: -46.63315,
    },
    "rua antônio pedrozelli, centro, diadema - sp": {
      lat: -23.6920223,
      lng: -46.6317051,
    },
    "rua josé zara, centro, diadema - sp": {
      lat: -23.6898626,
      lng: -46.6301148,
    },
    "rua júlio prestes, centro, diadema - sp": {
      lat: -23.6936982,
      lng: -46.6307328,
    },
    "avenida nossa senhora das vitórias, centro, diadema - sp": {
      lat: -23.6894719,
      lng: -46.6274497,
    },
    "rua primeiro-sargento nestor romualdo tenório, centro, diadema - sp": {
      lat: -23.6971141,
      lng: -46.6289579,
    },
    "rua washington luiz, centro, diadema - sp": {
      lat: -23.69285,
      lng: -46.62585,
    },
    "rua são judas tadeu, centro, diadema - sp": {
      lat: -23.6703435,
      lng: -46.6183545,
    },
    "rua doutor carlos de rezende enout, parque doroteia, são paulo - sp": {
      lat: -23.701392,
      lng: -46.63936,
    },
  };

  // RESOLUÇÃO DE COORDENADAS RESILIENTE (CACHE -> CEP -> GEOCODE NATIVO -> PHOTON -> FALLBACK)
  async function resolverCoordenadas(
    postagem: Postagem
  ): Promise<{ latitude: number; longitude: number } | null> {
    const chaveCache = `${postagem.id || (postagem as any)._id}-${
      postagem.cep || ""
    }-${postagem.ultimaLocalidade || ""}`;

    if (geocodeCache.current[chaveCache]) {
      return {
        latitude: geocodeCache.current[chaveCache].lat,
        longitude: geocodeCache.current[chaveCache].lng,
      };
    }

    const normalizedLoc = (postagem.ultimaLocalidade || "")
      .trim()
      .toLowerCase();
    if (normalizedLoc && KNOWN_ADDRESS_COORDS[normalizedLoc]) {
      const known = KNOWN_ADDRESS_COORDS[normalizedLoc];
      geocodeCache.current[chaveCache] = known;
      return { latitude: known.lat, longitude: known.lng };
    }

    // 1. Tenta por CEP com AwesomeAPI
    const cepClean = (
      postagem.cep ||
      postagem.ultimaLocalidade?.match(/\b\d{5}-?\d{3}\b/)?.[0] ||
      postagem.ultimaLocalidade?.match(/\b\d{8}\b/)?.[0] ||
      ""
    ).replace(/\D/g, "");

    if (cepClean.length === 8) {
      try {
        const response = await fetch(
          `https://cep.awesomeapi.com.br/json/${cepClean}`
        );
        if (response.ok) {
          const json = await response.json();
          if (json.lat && json.lng) {
            const lat = parseFloat(json.lat);
            const lng = parseFloat(json.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
              geocodeCache.current[chaveCache] = { lat, lng };
              return { latitude: lat, longitude: lng };
            }
          }
        }
      } catch {}

      try {
        const data = await Location.geocodeAsync(cepClean);
        if (data && data.length > 0 && !isNaN(data[0].latitude)) {
          const coords = {
            latitude: data[0].latitude,
            longitude: data[0].longitude,
          };
          geocodeCache.current[chaveCache] = {
            lat: coords.latitude,
            lng: coords.longitude,
          };
          return coords;
        }
      } catch {}
    }

    // 2. Tenta por Geocoder Nativo com texto do endereço
    if (postagem.ultimaLocalidade) {
      try {
        const data = await Location.geocodeAsync(postagem.ultimaLocalidade);
        if (data && data.length > 0 && !isNaN(data[0].latitude)) {
          const coords = {
            latitude: data[0].latitude,
            longitude: data[0].longitude,
          };
          geocodeCache.current[chaveCache] = {
            lat: coords.latitude,
            lng: coords.longitude,
          };
          return coords;
        }
      } catch {}

      // 3. Tenta simplificar para Rua + Cidade (removendo bairro intermediário)
      const partes = postagem.ultimaLocalidade.split(",");
      const ruaCidade =
        partes.length > 2
          ? `${partes[0].trim()}, ${partes[partes.length - 1].trim()}`
          : postagem.ultimaLocalidade;

      if (partes.length > 1) {
        try {
          const data = await Location.geocodeAsync(ruaCidade);
          if (data && data.length > 0 && !isNaN(data[0].latitude)) {
            const coords = {
              latitude: data[0].latitude,
              longitude: data[0].longitude,
            };
            geocodeCache.current[chaveCache] = {
              lat: coords.latitude,
              lng: coords.longitude,
            };
            return coords;
          }
        } catch {}
      }

      // 4. Fallback com Photon Komoot (OpenStreetMap sem bloqueio 403)
      for (const candidate of [ruaCidade, postagem.ultimaLocalidade]) {
        try {
          const resPhoton = await fetch(
            `https://photon.komoot.io/api/?q=${encodeURIComponent(
              `${candidate}, Brasil`
            )}&limit=1`
          );
          if (resPhoton.ok) {
            const jsonPhoton = await resPhoton.json();
            const coordsArr =
              jsonPhoton?.features?.[0]?.geometry?.coordinates;
            if (Array.isArray(coordsArr) && coordsArr.length >= 2) {
              const lng = parseFloat(coordsArr[0]);
              const lat = parseFloat(coordsArr[1]);
              if (!isNaN(lat) && !isNaN(lng)) {
                geocodeCache.current[chaveCache] = { lat, lng };
                return { latitude: lat, longitude: lng };
              }
            }
          }
        } catch {}
      }

      // 5. Fallback garantido por cidade para que nenhum caso deixe de aparecer no mapa
      const lower = normalizedLoc;
      const baseLat = lower.includes("diadema") ? -23.6915 : -23.55052;
      const baseLng = lower.includes("diadema") ? -46.6285 : -46.633308;
      geocodeCache.current[chaveCache] = { lat: baseLat, lng: baseLng };
      return { latitude: baseLat, longitude: baseLng };
    }

    return null;
  }

  // CARREGA TODAS AS POSTAGENS E PLOTA NO MAPA
  const carregarCasosNoMapa = useCallback(async () => {
    try {
      setIsLoadingPosts(true);
      const postagens =
        userToken?.roles?.[0]?.name === "ADMIN"
          ? await service.getTodasPostagens()
          : await service.getPostagensAprovadas();

      if (!postagens || !Array.isArray(postagens)) {
        setCoordenadas([]);
        return;
      }

      const promessas = postagens.map(async (postagem, idx) => {
        if (!postagem.ultimaLocalidade && !postagem.cep) return null;

        try {
          const coords = await resolverCoordenadas(postagem);
          if (coords && !isNaN(coords.latitude) && !isNaN(coords.longitude)) {
            // Offset sutil se houver postagens com coordenadas idênticas
            const offset =
              (idx % 3 === 0 ? 0 : 0.00012) * (idx % 2 === 0 ? 1 : -1);

            const item: CoordType = {
              id: postagem.id || (postagem as any)._id,
              latitude: coords.latitude + offset,
              longitude: coords.longitude + offset,
              titulo: postagem.nome,
              fotoPerfil: postagem.fotoPerfil || "",
              ultimaLocalidade: postagem.ultimaLocalidade,
              cep: postagem.cep,
              idade: postagem.idade,
              dataDesaparecimento: postagem.data,
              postagem: postagem,
            };
            return item;
          }
        } catch {
          return null;
        }
        return null;
      });

      const resultados = await Promise.all(promessas);
      const validas = resultados.filter(
        (item): item is CoordType =>
          item !== null && !isNaN(item.latitude) && !isNaN(item.longitude)
      );
      setCoordenadas(validas);
    } catch (error) {
      console.log("Erro ao carregar endereços no mapa:", error);
    } finally {
      setIsLoadingPosts(false);
    }
  }, [userToken]);

  // Recarrega sempre que a tela de mapas ganha foco
  useFocusEffect(
    useCallback(() => {
      carregarCasosNoMapa();
    }, [carregarCasosNoMapa])
  );

  // Solicita permissão e centraliza no usuário uma vez ao iniciar
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          setHasLocationPermission(true);
          await goToMyLocation();
        }
      } catch {}
    })();
  }, []);

  async function goToMyLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permissão de GPS",
          "Permita o acesso à localização para centralizar onde você está."
        );
        return;
      }
      setHasLocationPermission(true);

      // Tenta obter a última posição conhecida primeiro para resposta imediata
      let location = await Location.getLastKnownPositionAsync({});
      if (!location) {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      if (location?.coords) {
        mapRef.current?.animateToRegion(
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          800
        );
      }
    } catch (error) {
      console.log("Erro ao obter localização atual:", error);
    }
  }

  function handleSelectPin(coord: CoordType) {
    setSelectedCoord(coord);

    navigation.navigate("PostagemDetalhes", {
      id: coord.id,
      postagem: coord.postagem,
    });
  }

  async function handleSearch() {
    Keyboard.dismiss();
    const query = searchQuery.trim();
    if (!query) return;

    try {
      setIsSearching(true);
      let latitude: number | null = null;
      let longitude: number | null = null;

      // 1. Busca por CEP (8 dígitos)
      const cepClean = query.replace(/\D/g, "");
      if (cepClean.length === 8) {
        try {
          const res = await fetch(
            `https://cep.awesomeapi.com.br/json/${cepClean}`
          );
          if (res.ok) {
            const json = await res.json();
            if (json.lat && json.lng) {
              latitude = parseFloat(json.lat);
              longitude = parseFloat(json.lng);
            }
          }
        } catch {}
      }

      // 2. Busca por texto
      if (latitude === null || longitude === null) {
        const data = await Location.geocodeAsync(query);
        if (data && data.length > 0 && !isNaN(data[0].latitude)) {
          latitude = data[0].latitude;
          longitude = data[0].longitude;
        }
      }

      if (latitude !== null && longitude !== null && !isNaN(latitude)) {
        setSearchedLocation({
          latitude,
          longitude,
          title: query,
        });

        setSelectedCoord(null);

        mapRef.current?.animateToRegion(
          {
            latitude,
            longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          },
          1000
        );
      } else {
        Alert.alert(
          "Local não encontrado",
          "Não conseguimos localizar este endereço ou CEP. Tente incluir a cidade ou estado."
        );
      }
    } catch (error) {
      Alert.alert(
        "Erro na busca",
        "Ocorreu um erro ao buscar esse local no mapa."
      );
    } finally {
      setIsSearching(false);
    }
  }

  function handleFitAllCases() {
    if (coordenadas.length === 0) return;

    if (coordenadas.length === 1) {
      mapRef.current?.animateToRegion(
        {
          latitude: coordenadas[0].latitude,
          longitude: coordenadas[0].longitude,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        },
        800
      );
      return;
    }

    mapRef.current?.fitToCoordinates(
      coordenadas.map((c) => ({
        latitude: c.latitude,
        longitude: c.longitude,
      })),
      {
        edgePadding: { top: 120, right: 60, bottom: 220, left: 60 },
        animated: true,
      }
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeHeader}>
        <Header />
      </SafeAreaView>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          showsUserLocation={hasLocationPermission}
          showsMyLocationButton={false}
          showsCompass={true}
          onPress={() => setSelectedCoord(null)}
          initialRegion={{
            latitude: -23.5505,
            longitude: -46.6333,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {/* Marcadores dos casos cadastrados (Círculo 66x66) */}
          {coordenadas.map((coord: CoordType) => (
            <CasePin
              key={coord.id}
              coord={coord}
              isSelected={selectedCoord?.id === coord.id}
              onPress={() => handleSelectPin(coord)}
            />
          ))}

          {/* Marcador de local pesquisado */}
          {searchedLocation &&
            !isNaN(searchedLocation.latitude) &&
            !isNaN(searchedLocation.longitude) && (
              <Marker
                coordinate={{
                  latitude: searchedLocation.latitude,
                  longitude: searchedLocation.longitude,
                }}
                pinColor="#0040A1"
                title={searchedLocation.title}
                description="Local pesquisado"
              />
            )}
        </MapView>

        {/* Barra de Pesquisa Superior */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#64748B" />

            <TextInput
              style={styles.searchInput}
              placeholder="Pesquisar endereço, bairro ou CEP..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />

            {isSearching && (
              <ActivityIndicator
                size="small"
                color="#0040A1"
                style={{ marginRight: 4 }}
              />
            )}

            {searchQuery.length > 0 && !isSearching && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  setSearchedLocation(null);
                }}
                style={{ padding: 4 }}
              >
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleSearch}
              style={styles.searchButton}
            >
              <Ionicons name="arrow-forward" size={18} color="white" />
            </TouchableOpacity>
          </View>

          {/* Indicador de Casos Ativos no Mapa */}
          {coordenadas.length > 0 && (
            <TouchableOpacity
              style={styles.casesBadge}
              onPress={handleFitAllCases}
              activeOpacity={0.85}
            >
              <View style={styles.casesBadgeDot} />
              <Text style={styles.casesBadgeText}>
                {coordenadas.length} alerta{coordenadas.length > 1 ? "s" : ""}{" "}
                no mapa •{" "}
                <Text style={{ fontWeight: "700" }}>Enquadrar todos</Text>
              </Text>
            </TouchableOpacity>
          )}

          {isLoadingPosts && (
            <View style={styles.loadingBadge}>
              <ActivityIndicator size="small" color="#0040A1" />
              <Text style={styles.loadingBadgeText}>Carregando casos...</Text>
            </View>
          )}
        </View>

        {/* Botão Minha Localização (GPS) posicionado acima da barra inferior */}
        <TouchableOpacity
          style={styles.gpsButton}
          onPress={goToMyLocation}
          activeOpacity={0.8}
        >
          <MaterialIcons name="my-location" size={24} color="#0040A1" />
        </TouchableOpacity>

        {/* CARD INFERIOR FLUTUANTE DE PRÉ-VISUALIZAÇÃO */}
        {selectedCoord && (
          <View style={styles.bottomCardWrapper}>
            <TouchableOpacity
              style={styles.bottomCard}
              activeOpacity={0.9}
              onPress={() => {
                navigation.navigate("PostagemDetalhes", {
                  id: selectedCoord.id,
                  postagem: selectedCoord.postagem,
                });
              }}
            >
              <TouchableOpacity
                style={styles.closeCardBtn}
                onPress={() => setSelectedCoord(null)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>

              <View style={styles.cardInfoRow}>
                {selectedCoord.fotoPerfil &&
                (selectedCoord.fotoPerfil.startsWith("http") ||
                  selectedCoord.fotoPerfil.startsWith("data:image/") ||
                  selectedCoord.fotoPerfil.startsWith("file://")) ? (
                  <Image
                    source={{ uri: selectedCoord.fotoPerfil }}
                    style={styles.cardAvatar}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.cardAvatarFallback}>
                    <MaterialIcons name="person" size={32} color="#0040A1" />
                  </View>
                )}

                <View style={styles.cardTexts}>
                  <Text style={styles.cardNome} numberOfLines={1}>
                    {selectedCoord.titulo}
                  </Text>

                  <View style={styles.cardChipsRow}>
                    {Boolean(selectedCoord.idade) && (
                      <View style={styles.cardChip}>
                        <MaterialIcons name="cake" size={12} color="#64748B" />
                        <Text style={styles.cardChipText}>
                          {selectedCoord.idade} anos
                        </Text>
                      </View>
                    )}

                    <View style={[styles.cardChip, styles.cardChipLocation]}>
                      <MaterialIcons name="place" size={12} color="#0040A1" />
                      <Text style={styles.cardChipText} numberOfLines={1}>
                        {selectedCoord.ultimaLocalidade}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.cardActionButton}
                onPress={() => {
                  navigation.navigate("PostagemDetalhes", {
                    id: selectedCoord.id,
                    postagem: selectedCoord.postagem,
                  });
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.cardActionButtonText}>
                  Ver Detalhes do Alerta
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  safeHeader: {
    backgroundColor: "#FFFFFF",
    zIndex: 30,
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    width: "100%",
    height: "100%",
  },

  // MARCADOR CIRCULAR 66x66
  markerCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 3.5,
    borderColor: "#0040A1",
    backgroundColor: "#0040A1",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    position: "relative",
  },
  markerCircleSelected: {
    borderColor: "#E11D48",
    borderWidth: 4,
    transform: [{ scale: 1.1 }],
    elevation: 12,
  },
  markerImage: {
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  markerStatusDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  // BARRA DE PESQUISA
  searchWrapper: {
    position: "absolute",
    top: 14,
    left: 16,
    right: 16,
    zIndex: 20,
    gap: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 9999,
    paddingHorizontal: 16,
    height: 52,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    paddingVertical: 8,
    fontFamily: "PublicSansMedium",
  },
  searchButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#0040A1",
    justifyContent: "center",
    alignItems: "center",
  },
  casesBadge: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  casesBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  casesBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "PublicSansMedium",
  },
  loadingBadge: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  loadingBadgeText: {
    fontSize: 11,
    color: "#64748B",
    fontFamily: "PublicSansMedium",
  },

  // BOTÃO MINHA LOCALIZAÇÃO
  gpsButton: {
    position: "absolute",
    bottom: 95,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    zIndex: 10,
  },

  // CARD INFERIOR FLUTUANTE
  bottomCardWrapper: {
    position: "absolute",
    bottom: 85,
    left: 16,
    right: 16,
    zIndex: 25,
  },
  bottomCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  closeCardBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  cardInfoRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  cardAvatar: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
  },
  cardAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#EEF4FF",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTexts: {
    flex: 1,
    paddingRight: 20,
  },
  cardNome: {
    fontSize: 16,
    fontFamily: "ManropeExtraBold",
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  cardChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  cardChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  cardChipLocation: {
    backgroundColor: "#EEF4FF",
    maxWidth: "75%",
  },
  cardChipText: {
    fontSize: 11,
    fontFamily: "PublicSansMedium",
    color: "#334155",
  },
  cardActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0040A1",
    height: 42,
    borderRadius: 10,
    gap: 6,
  },
  cardActionButtonText: {
    color: "#FFFFFF",
    fontFamily: "PublicSansSemiBold",
    fontSize: 13,
    fontWeight: "600",
  },
  calloutBox: {
    padding: 8,
    minWidth: 140,
    alignItems: "center",
  },
  calloutTitle: {
    fontFamily: "PublicSansBold",
    fontSize: 13,
    color: "#0F172A",
    marginBottom: 2,
    textAlign: "center",
  },
  calloutSubtitle: {
    fontFamily: "PublicSansMedium",
    fontSize: 11,
    color: "#0040A1",
    textAlign: "center",
  },
});
