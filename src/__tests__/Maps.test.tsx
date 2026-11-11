import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";
import { Maps } from "../app/Maps";
import { AuthContext } from "../contexts/AuthContext";
import { service } from "../services/api";

const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => {
  const React = require("react");
  return {
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
    useFocusEffect: (cb: () => void) => {
      React.useEffect(cb, []);
    },
  };
});

jest.mock("expo-font", () => ({
  useFonts: () => [true],
}));

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  geocodeAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View, TouchableOpacity } = require("react-native");
  const MockMapView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      animateToRegion: jest.fn(),
      fitToCoordinates: jest.fn(),
    }));
    return <View testID="map-view">{props.children}</View>;
  });
  const MockMarker = (props: any) => (
    <TouchableOpacity testID="map-marker" onPress={props.onPress}>
      {props.children}
    </TouchableOpacity>
  );
  const MockCallout = (props: any) => <View>{props.children}</View>;
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    Callout: MockCallout,
  };
});

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View };
});

jest.mock("../components/Header", () => {
  const { Text } = require("react-native");
  return { Header: () => <Text>CRA Header</Text> };
});

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
    MaterialIcons: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

jest.mock("../services/api", () => ({
  service: {
    getPostagensAprovadas: jest.fn(),
    getTodasPostagens: jest.fn(),
  },
}));

describe("Tela <Maps />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    global.fetch = jest.fn();
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });
    (Location.getLastKnownPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: -23.5505, longitude: -46.6333 },
    });
  });

  // CT-19: Geocodificação e Plotagem de Alertas no Mapa (Caminho Feliz)
  it("CT-19: deve carregar casos aprovados, converter CEP em coordenadas e exibir contador de alertas no mapa", async () => {
    (service.getPostagensAprovadas as jest.Mock).mockResolvedValueOnce([
      {
        id: "p-mapa-1",
        nome: "Rafael Costa",
        idade: 11,
        cep: "01310-100",
        ultimaLocalidade: "Av. Paulista, São Paulo - SP",
        fotoPerfil: "https://exemplo.com/rafael.jpg",
        status: "Aprovada",
      },
    ]);

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lat: "-23.5614", lng: "-46.6559" }),
    });

    const { getByText } = render(
      <AuthContext.Provider value={{ userToken: null, setUserToken: jest.fn() }}>
        <Maps />
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(service.getPostagensAprovadas).toHaveBeenCalledTimes(1);
      expect(getByText(/1 alerta no mapa/)).toBeTruthy();
      expect(getByText("Rafael Costa")).toBeTruthy();
    });
  });

  // CT-20: Busca de Endereço Inválido no Mapa (Tratamento de Erro)
  it("CT-20: deve exibir alerta quando o endereço pesquisado na barra de busca não for localizado", async () => {
    (service.getPostagensAprovadas as jest.Mock).mockResolvedValueOnce([]);
    (Location.geocodeAsync as jest.Mock).mockResolvedValueOnce([]);

    const { getByPlaceholderText, getByText } = render(
      <AuthContext.Provider value={{ userToken: null, setUserToken: jest.fn() }}>
        <Maps />
      </AuthContext.Provider>
    );

    const searchInput = getByPlaceholderText(
      "Pesquisar endereço, bairro ou CEP..."
    );
    fireEvent.changeText(searchInput, "Endereco Inexistente XYZ 999");
    fireEvent(searchInput, "submitEditing");

    await waitFor(() => {
      expect(Location.geocodeAsync).toHaveBeenCalledWith(
        "Endereco Inexistente XYZ 999"
      );
      expect(Alert.alert).toHaveBeenCalledWith(
        "Local não encontrado",
        "Não conseguimos localizar este endereço ou CEP. Tente incluir a cidade ou estado."
      );
    });
  });
});

