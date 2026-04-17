import { View, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { Colors } from "../../constants/Colors";
import FloatingChat from "../../components/FloatingChat";
import { WeatherProvider } from "../../contexts/WeatherContext";

export default function TabLayout() {
  return (
    <WeatherProvider>
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown:             false,
          tabBarActiveTintColor:   Colors.primary,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarStyle: {
            backgroundColor: "#fff",
            borderTopColor:  Colors.border,
            borderTopWidth:  1,
            paddingBottom:   4,
            height:          58,
          },
          tabBarLabelStyle: { fontSize: 11, marginBottom: 2 },
        }}
      >
        <Tabs.Screen
          name="camera"
          options={{ title: "Chụp ảnh", tabBarIcon: ({ color }) => <TabIcon icon="📷" color={color} /> }}
        />
        <Tabs.Screen
          name="result"
          options={{ title: "Kết quả", tabBarIcon: ({ color }) => <TabIcon icon="🔬" color={color} /> }}
        />
        <Tabs.Screen
          name="history"
          options={{ title: "Lịch sử", tabBarIcon: ({ color }) => <TabIcon icon="📋" color={color} /> }}
        />
        <Tabs.Screen
          name="treatment"
          options={{ title: "Xử lý", tabBarIcon: ({ color }) => <TabIcon icon="💊" color={color} /> }}
        />
        <Tabs.Screen
          name="news"
          options={{ title: "Tin tức", tabBarIcon: ({ color }) => <TabIcon icon="📰" color={color} /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: "Tài khoản", tabBarIcon: ({ color }) => <TabIcon icon="👤" color={color} /> }}
        />
      </Tabs>

      {/* Global floating AI chat — always on top */}
      <FloatingChat />
    </View>
    </WeatherProvider>
  );
}

function TabIcon({ icon, color }: { icon: string; color: string }) {
  const { Text } = require("react-native");
  return <Text style={{ fontSize: 22 }}>{icon}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
