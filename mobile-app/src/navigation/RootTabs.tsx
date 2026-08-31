import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { colors } from "../theme/colors";

import TodayScreen from "../screens/TodayScreen";
import FocusScreen from "../screens/FocusScreen";
import EnergyScreen from "../screens/EnergyScreen";
import TriggersScreen from "../screens/TriggersScreen";
import QuestionScreen from "../screens/QuestionScreen";
import ReportScreen from "../screens/ReportScreen";
import ReminderScreen from "../screens/ReminderScreen";

const Tab = createBottomTabNavigator();

// Maps 1:1 to the original web app's `tab` state ("today" | "focus" | ...)
// — same six sections, now real native screens instead of conditional divs.
const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.card, border: colors.cardBorder },
};

// No screen declared a tabBarIcon, so React Navigation fell back to its
// built-in placeholder — a "⏷" glyph that the Android system font has no
// character for, which is why all seven tabs showed empty tofu boxes on a real
// device. Each tab names its own icon now.
type FeatherName = React.ComponentProps<typeof Feather>["name"];

const icon =
  (name: FeatherName) =>
  ({ color, size }: { color: string; size: number }) => <Feather name={name} size={size} color={color} />;

export default function RootTabs() {
  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.cardBorder },
          // Seven tabs share a 320px-wide screen on the smallest devices, so
          // each gets ~45px. At 9px "Напомнить" still came back ellipsised in
          // the device screenshot; 8px is what actually fits all seven whole.
          tabBarLabelStyle: { fontSize: 8 },
          tabBarItemStyle: { paddingHorizontal: 0 },
        }}
      >
        <Tab.Screen name="Чек-лист" component={TodayScreen} options={{ tabBarIcon: icon("check-square") }} />
        <Tab.Screen name="Фокус" component={FocusScreen} options={{ tabBarIcon: icon("target") }} />
        <Tab.Screen name="Энергия" component={EnergyScreen} options={{ tabBarIcon: icon("activity") }} />
        <Tab.Screen name="Триггеры" component={TriggersScreen} options={{ tabBarIcon: icon("zap-off") }} />
        <Tab.Screen name="Вопрос" component={QuestionScreen} options={{ tabBarIcon: icon("help-circle") }} />
        <Tab.Screen name="Отчёт" component={ReportScreen} options={{ tabBarIcon: icon("bar-chart-2") }} />
        <Tab.Screen
          name="Напоминание"
          component={ReminderScreen}
          options={{ tabBarIcon: icon("bell"), tabBarLabel: "Напомнить" }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
