import { useFonts } from "expo-font";
import { StyleSheet, Platform, StatusBar } from "react-native";

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#121A2F",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },

  scrollContent: { flexGrow: 1, backgroundColor: "#F8F9FA" },

  darkHeader: {
    backgroundColor: "#121A2F",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    width: "100%",
  },

  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  editIcon: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-end",
  },

  profileMainInfo: { alignItems: "center", marginBottom: 10 },
  avatarWrapper: { position: "relative", marginBottom: 15 },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.1)",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#40C057",
    borderWidth: 3,
    borderColor: "#121A2F",
  },

  userName: {
    
    fontSize: 24,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  userEmail: {
    
    fontSize: 14,
    color: "#ADB5BD",
  },

  whiteContentBody: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  statsRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 25,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    borderWidth: 1,
    borderColor: "#F1F3F5",
  },
  statItem: { flex: 1, alignItems: "center" },
  statDivider: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#F1F3F5",
  },
  statValue: {
    
    fontSize: 20,
    color: "#212529",
  },
  statLabel: {
    
    fontSize: 12,
    color: "#868E96",
    marginTop: 2,
  },

  sectionTitle: {
    
    fontSize: 12,
    color: "#ADB5BD",
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 10,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E9ECEF",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },

  infoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#F8F9FA",
  },
  infoItemLeft: { flexDirection: "row", alignItems: "center" },
  infoLabel: {
    
    fontSize: 14,
    color: "#868E96",
  },
  infoValue: {
    
    fontSize: 14,
    color: "#343A40",
  },

  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F8F9FA",
  },
  menuItemLeft: { flexDirection: "row", alignItems: "center" },
  menuIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuText: { fontSize: 15 },

  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF5F5",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#FFE3E3",
    elevation: 2,
    shadowColor: "#FF6B6B",
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  logoutButtonText: {
    
    color: "#FF6B6B",
    fontSize: 16,
  },

  versionText: {
    
    fontSize: 12,
    color: "#CED4DA",
    textAlign: "center",
    marginTop: 30,
  },
});
