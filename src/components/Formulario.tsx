import { useFonts } from "expo-font";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
  ImageBackground,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { Controller, useForm } from "react-hook-form";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { supabase } from "../lib/supabase";
import { decode } from "base64-arraybuffer";
import { File } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import "react-native-url-polyfill/auto";
import { service } from "../services/api";
import {
  NavigationContainerProps,
  useNavigation,
} from "@react-navigation/native";
import { RootStackParamList } from "../types/ParamList";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

export type PostagemRequest = {
  nome: string;
  idade: number;
  cep?: string;
  ultimaLocalidade: string;
  fotoPerfil: string;
  informacoesAdicionais: string;
  data: Date;
};

type NavigationProps = NativeStackNavigationProp<RootStackParamList, "Report">;

export function Formulario() {
  const [selectedImage, setSelectedImage] = useState<string | undefined>(
    undefined,
  );
  const navigation = useNavigation<NavigationProps>();
  const [fontsLoaded] = useFonts({
    ManropeExtraBold: require("../../assets/fonts/Manrope-ExtraBold.ttf"),
    PublicSansMedium: require("../../assets/fonts/PublicSans-Medium.ttf"),
    PublicSansSemiBold: require("../../assets/fonts/PublicSans-SemiBold.ttf"),
    PublicSansBold: require("../../assets/fonts/PublicSans-Bold.ttf"),
  });
  const [data, setData] = useState(undefined);
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepFeedback, setCepFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PostagemRequest>({
    defaultValues: {
      nome: "",
      idade: undefined,
      cep: "",
      ultimaLocalidade: "",
      fotoPerfil: "",
      informacoesAdicionais: "",
      data: undefined,
    },
  });

  async function handleCepChange(
    text: string,
    onChangeField: (val: string) => void
  ) {
    const raw = text.replace(/\D/g, "").slice(0, 8);
    const masked =
      raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
    onChangeField(masked);

    if (raw.length === 8) {
      try {
        setLoadingCep(true);
        setCepFeedback("Buscando endereço pelo CEP...");
        const response = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
        const json = await response.json();

        if (json.erro) {
          setCepFeedback(
            "CEP não encontrado. Digite o endereço manualmente abaixo."
          );
        } else {
          const parts = [
            json.logradouro,
            json.bairro,
            json.localidade && json.uf
              ? `${json.localidade} - ${json.uf}`
              : json.localidade,
          ].filter(Boolean);

          const fullAddress = parts.join(", ");
          setValue("ultimaLocalidade", fullAddress, { shouldValidate: true });
          setCepFeedback(
            "Endereço preenchido automaticamente! Adicione o número ou referência se souber."
          );
        }
      } catch (err) {
        setCepFeedback(
          "Não foi possível consultar o CEP. Digite o endereço manualmente abaixo."
        );
      } finally {
        setLoadingCep(false);
      }
    } else {
      setCepFeedback(null);
    }
  }

  async function onSubmit(data: PostagemRequest) {
    if (isUploadingImage) {
      Alert.alert(
        "Aguarde o envio da foto",
        "A imagem selecionada ainda está sendo enviada para o servidor. Aguarde alguns instantes."
      );
      return;
    }

    if (!data.fotoPerfil || data.fotoPerfil.trim() === "") {
      Alert.alert(
        "Foto obrigatória",
        "Por favor, selecione e adicione uma foto clara da pessoa antes de cadastrar o caso."
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await service.criarPostagem(data);
      Alert.alert(
        "Alerta Criado",
        "O caso foi reportado com sucesso e enviado para análise da equipe."
      );
      navigation.navigate("Feed");
    } catch (error: any) {
      console.log(
        "Erro ao criar postagem:",
        error?.response?.data || error?.message
      );
      const msg =
        error?.response?.data?.message ||
        "Não foi possível cadastrar o caso. Verifique os dados e tente novamente.";
      Alert.alert("Falha no envio", String(msg));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function readImageAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
    // 1. Tenta a nova API File do Expo (SDK 54+)
    try {
      const file = new File(uri);
      if (typeof file.arrayBuffer === "function") {
        const buffer = await file.arrayBuffer();
        if (buffer && buffer.byteLength > 0) {
          return buffer;
        }
      }
    } catch (e) {
      console.log("File.arrayBuffer() fallback:", e);
    }

    // 2. Tenta com expo-file-system/legacy
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (base64) {
        return decode(base64);
      }
    } catch (e) {
      console.log("FileSystem legacy fallback:", e);
    }

    // 3. Fallback nativo via fetch(uri) do React Native (suporta file:// no RN)
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }

  async function uploadParaBucket(
    uri: string,
    base64Data?: string | null
  ): Promise<string | null> {
    try {
      setIsUploadingImage(true);

      // Lê a imagem como ArrayBuffer usando a melhor API disponível
      const arrayBuffer = await readImageAsArrayBuffer(uri);

      const cleanExt = (uri.split(".").pop() || "jpg")
        .toLowerCase()
        .replace("jpeg", "jpg");
      const isPng = cleanExt === "png";
      const contentType = isPng ? "image/png" : "image/jpeg";
      const fileName = `${Date.now()}.${isPng ? "png" : "jpg"}`;

      // 1. Tenta o upload no Supabase Storage
      const { error } = await supabase.storage
        .from("postagens")
        .upload(fileName, arrayBuffer, {
          contentType,
          upsert: false,
        });

      if (!error) {
        const { data: urlData } = supabase.storage
          .from("postagens")
          .getPublicUrl(fileName);

        if (urlData?.publicUrl) {
          return urlData.publicUrl;
        }
      } else {
        console.warn(
          "Supabase indisponível/pausado, ativando fallback de imagem:",
          error.message
        );
      }
    } catch (error: any) {
      console.warn(
        "Fallback de imagem ativado (Supabase offline):",
        error?.message || error
      );
    }

    // 2. Fallback automático: Data URI em Base64 (salva direto no banco MongoDB) ou URI local
    try {
      if (base64Data) {
        return `data:image/jpeg;base64,${base64Data}`;
      }
      const base64Fallback = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (base64Fallback) {
        return `data:image/jpeg;base64,${base64Fallback}`;
      }
    } catch {}

    setIsUploadingImage(false);
    return uri;
  }

  async function pickImageAsync() {
    if (isUploadingImage) return;

    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso às suas fotos para anexar a foto do caso."
        );
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.4,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const localUri = asset.uri;
        setSelectedImage(localUri);

        try {
          const publicUrl = await uploadParaBucket(localUri, asset.base64);
          if (publicUrl) {
            setValue("fotoPerfil", publicUrl, { shouldValidate: true });
          } else {
            setSelectedImage(undefined);
            setValue("fotoPerfil", "");
          }
        } finally {
          setIsUploadingImage(false);
        }
      }
    } catch (err) {
      console.error("Erro ao selecionar imagem:", err);
      setIsUploadingImage(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.formTitle}>Informações {"\n"}Básicas</Text>
      <TouchableOpacity
        onPress={pickImageAsync}
        disabled={isUploadingImage}
        activeOpacity={0.85}
        style={styles.imagePickerTouchable}
      >
        {selectedImage ? (
          <View style={styles.imagePreviewContainer}>
            <Image
              source={{ uri: selectedImage }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            {isUploadingImage ? (
              <View style={styles.imageLoadingOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.imageLoadingText}>
                  Enviando imagem para o servidor...
                </Text>
              </View>
            ) : (
              <View style={styles.imageChangeOverlay}>
                <View style={styles.changeBadge}>
                  <MaterialIcons
                    name="photo-camera"
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.changeBadgeText}>Trocar foto</Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          <View
            style={[
              styles.fileInput,
              { backgroundColor: "#E5E8EB" },
            ]}
          >
            {isUploadingImage ? (
              <View style={{ alignItems: "center", gap: 12 }}>
                <ActivityIndicator size="large" color="#0040A1" />
                <Text style={styles.fileInputText}>Enviando foto...</Text>
              </View>
            ) : (
              <>
                <MaterialIcons
                  name="camera-alt"
                  size={64}
                  color={"#0040A1"}
                  style={{ marginBottom: 16 }}
                />
                <Text style={{ fontFamily: "ManropeExtraBold", fontSize: 16 }}>
                  Upload da Foto
                </Text>
                <Text style={styles.fileInputText}>
                  Arraste ou clique para selecionar a foto mais recente e clara da
                  criança.
                </Text>
              </>
            )}
          </View>
        )}
      </TouchableOpacity>
      {errors.fotoPerfil && (
        <Text
          style={{
            color: "#EF4444",
            fontSize: 13,
            alignSelf: "flex-start",
            marginTop: -24,
            paddingLeft: 4,
          }}
        >
          {errors.fotoPerfil.message || "Por favor, adicione uma foto."}
        </Text>
      )}
      <View style={{ flex: 1, width: "100%", gap: 24 }}>
        <View>
          <Text style={styles.label}>NOME COMPLETO</Text>
          {errors.nome && (
            <Text style={{ color: "red", paddingLeft: 4 }}>
              {errors.nome.message}
            </Text>
          )}
          <Controller
            control={control}
            name="nome"
            rules={{ required: "Nome obrigatorio" }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                placeholder="Nome"
                style={{
                  width: "100%",
                  backgroundColor: "#E5E8EB",
                  padding: 16,
                  borderRadius: 8,
                  marginTop: 12,
                }}
              />
            )}
          />
        </View>
        <View>
          <Text style={styles.label}>IDADE</Text>
          {errors.idade && (
            <Text style={{ color: "red", paddingLeft: 4 }}>
              {errors.idade.message}
            </Text>
          )}
          <Controller
            control={control}
            name="idade"
            rules={{ required: "Idade obrigatorio" }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="numeric"
                placeholder="Anos"
                style={{
                  width: "100%",
                  backgroundColor: "#E5E8EB",
                  padding: 16,
                  borderRadius: 8,
                  marginTop: 12,
                }}
              />
            )}
          />
        </View>
        <View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={styles.label}>CEP (OPCIONAL)</Text>
            {loadingCep && (
              <ActivityIndicator size="small" color="#0040A1" style={{ marginRight: 8 }} />
            )}
          </View>
          <Controller
            control={control}
            name="cep"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                onChangeText={(text) => handleCepChange(text, onChange)}
                onBlur={onBlur}
                value={value}
                keyboardType="numeric"
                maxLength={9}
                placeholder="00000-000"
                placeholderTextColor="#94A3B8"
                style={{
                  width: "100%",
                  backgroundColor: "#E5E8EB",
                  padding: 16,
                  borderRadius: 8,
                  marginTop: 8,
                }}
              />
            )}
          />
          {cepFeedback && (
            <Text
              style={{
                fontSize: 12,
                marginTop: 6,
                paddingLeft: 4,
                color: cepFeedback.includes("automaticamente")
                  ? "#059669"
                  : cepFeedback.includes("Buscando")
                  ? "#0040A1"
                  : "#DC2626",
              }}
            >
              {cepFeedback}
            </Text>
          )}
        </View>

        <View>
          <Text style={styles.label}>ÚLTIMA LOCALIZAÇÃO (ENDEREÇO COMPLETO)</Text>
          {errors.ultimaLocalidade && (
            <Text style={{ color: "red", paddingLeft: 4, marginTop: 4 }}>
              {errors.ultimaLocalidade.message}
            </Text>
          )}
          <Controller
            control={control}
            name="ultimaLocalidade"
            rules={{ required: "O endereço da última localização é obrigatório" }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                placeholder="Ex: Av. Paulista, 1000 - Bela Vista, São Paulo - SP"
                placeholderTextColor="#94A3B8"
                style={{
                  width: "100%",
                  backgroundColor: "#E5E8EB",
                  padding: 16,
                  borderRadius: 8,
                  marginTop: 8,
                }}
              />
            )}
          />
        </View>
        <View>
          <Text style={styles.label}>DESCRIÇAO</Text>
          {errors.informacoesAdicionais && (
            <Text style={{ color: "red", paddingLeft: 4 }}>
              {errors.informacoesAdicionais.message}
            </Text>
          )}
          <Controller
            control={control}
            name="informacoesAdicionais"
            rules={{ required: "Descriçao obrigatorio" }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                placeholder="Descriçao"
                style={{
                  width: "100%",
                  backgroundColor: "#E5E8EB",
                  padding: 16,
                  borderRadius: 8,
                  marginTop: 12,
                }}
              />
            )}
          />
        </View>

        <View>
          <Controller
            control={control}
            name="data"
            rules={{ required: "Data obrigatoria" }}
            render={({ field: { onChange, value } }) => (
              <>
                <Text style={styles.label}>DATA</Text>
                {errors.data && (
                  <Text style={{ color: "red", paddingLeft: 4 }}>
                    {errors.data.message}
                  </Text>
                )}
                <TouchableOpacity onPress={() => setMostrarCalendario(true)}>
                  <Text
                    style={{
                      width: "100%",
                      backgroundColor: "#E5E8EB",
                      padding: 16,
                      borderRadius: 8,
                      marginTop: 12,
                    }}
                  >
                    {value?.toLocaleDateString() || ""}
                  </Text>
                  {/* <Text>
                  Data:{" "}
                  {value ? value.toLocaleDateString("pt-BR") : "Selecionar"}
                </Text> */}
                </TouchableOpacity>

                {mostrarCalendario && (
                  <DateTimePicker
                    value={value || new Date()}
                    mode="date"
                    onChange={(event, date) => {
                      setMostrarCalendario(false);
                      if (date) onChange(date);
                    }}
                  />
                )}
              </>
            )}
          />
        </View>
        <TouchableOpacity
          onPress={() => handleSubmit(onSubmit)()}
          disabled={isSubmitting}
          style={{
            width: "100%",
            height: 56,
            backgroundColor: isSubmitting ? "#7296cc" : "#0040A1",
            borderRadius: 9999,
            paddingVertical: 16,
            marginVertical: 24,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={{ textAlign: "center", color: "white", fontSize: 16 }}>
              Enviar
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 40,
  },
  formTitle: {
    alignSelf: "flex-start",
    fontFamily: "ManropeExtraBold",
    fontSize: 24,
    letterSpacing: 0.6,
    lineHeight: 32,
  },
  fileInput: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    height: 256,
    paddingHorizontal: 44,
  },
  fileInputText: {
    fontFamily: "PublicSansMedium",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  label: {
    paddingLeft: 4,
    alignSelf: "flex-start",
    fontFamily: "PublicSansBold",
    fontSize: 12,
    color: "#424654",
    lineHeight: 16,
    letterSpacing: 1.2,
  },
  imagePickerTouchable: {
    width: "100%",
  },
  imagePreviewContainer: {
    width: "100%",
    height: 256,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#0F172A",
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  imageLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  imageLoadingText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "PublicSansMedium",
    marginTop: 12,
    textAlign: "center",
  },
  imageChangeOverlay: {
    position: "absolute",
    bottom: 12,
    right: 12,
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 32, 96, 0.85)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
  },
  changeBadgeText: {
    color: "#FFFFFF",
    fontFamily: "PublicSansSemiBold",
    fontSize: 13,
  },
});
