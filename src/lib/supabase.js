import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jyniwzvaujyguilafunt.supabase.co";
const supabaseAnonKey = "sb_publishable_84-TUragxnmRIPbf556hHw_nkDcGWEl";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
