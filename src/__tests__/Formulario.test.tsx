import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Formulario } from "../components/Formulario";
import { service } from "../services/api";

const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

jest.mock("expo-font", () => ({
  useFonts: () => [true],
}));

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("../lib/supabase", () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ data: { path: "foto.jpg" }, error: null }),
        getPublicUrl: jest.fn(() => ({
          data: { publicUrl: "https://supabase.co/storage/postagens/foto.jpg" },
        })),
      })),
    },
  },
}));

jest.mock("../services/api", () => ({
  service: {
    criarPostagem: jest.fn(),
  },
}));

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    MaterialIcons: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

describe("Componente <Formulario />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    global.fetch = jest.fn();
  });

  // CT-12: Renderização dos Campos Obrigatórios
  it("CT-12: deve renderizar todos os campos do formulário de relato de desaparecimento", () => {
    const { getByPlaceholderText, getByText } = render(<Formulario />);

    expect(getByText("Upload da Foto")).toBeTruthy();
    expect(getByPlaceholderText("Nome")).toBeTruthy();
    expect(getByPlaceholderText("Anos")).toBeTruthy();
    expect(getByPlaceholderText("00000-000")).toBeTruthy();
    expect(
      getByPlaceholderText(
        "Ex: Av. Paulista, 1000 - Bela Vista, São Paulo - SP"
      )
    ).toBeTruthy();
    expect(getByPlaceholderText("Descriçao")).toBeTruthy();
    expect(getByText("Enviar")).toBeTruthy();
  });

  // CT-13: Consulta Automática de CEP via ViaCEP (Caminho Feliz)
  it("CT-13: deve preencher automaticamente o endereço ao digitar um CEP válido de 8 dígitos", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        logradouro: "Avenida Paulista",
        bairro: "Bela Vista",
        localidade: "São Paulo",
        uf: "SP",
      }),
    });

    const { getByPlaceholderText, getByText, getByDisplayValue } = render(
      <Formulario />
    );

    const inputCep = getByPlaceholderText("00000-000");
    fireEvent.changeText(inputCep, "01310100");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "https://viacep.com.br/ws/01310100/json/"
      );
      expect(
        getByDisplayValue("Avenida Paulista, Bela Vista, São Paulo - SP")
      ).toBeTruthy();
      expect(
        getByText(
          "Endereço preenchido automaticamente! Adicione o número ou referência se souber."
        )
      ).toBeTruthy();
    });
  });

  // CT-14: Tratamento de CEP Inexistente na API ViaCEP
  it("CT-14: deve exibir feedback de erro amigável quando o CEP não for encontrado", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ erro: true }),
    });

    const { getByPlaceholderText, getByText } = render(<Formulario />);

    const inputCep = getByPlaceholderText("00000-000");
    fireEvent.changeText(inputCep, "99999999");

    await waitFor(() => {
      expect(
        getByText("CEP não encontrado. Digite o endereço manualmente abaixo.")
      ).toBeTruthy();
    });
  });

  // CT-15: Validação de Campos Obrigatórios em Branco
  it("CT-15: deve exibir mensagens de erro de validação ao tentar enviar o formulário vazio", async () => {
    const { getByText } = render(<Formulario />);

    fireEvent.press(getByText("Enviar"));

    await waitFor(() => {
      expect(getByText("Nome obrigatorio")).toBeTruthy();
      expect(getByText("Idade obrigatorio")).toBeTruthy();
      expect(
        getByText("O endereço da última localização é obrigatório")
      ).toBeTruthy();
      expect(getByText("Descriçao obrigatorio")).toBeTruthy();
      expect(getByText("Data obrigatoria")).toBeTruthy();
    });
    expect(service.criarPostagem).not.toHaveBeenCalled();
  });
});

