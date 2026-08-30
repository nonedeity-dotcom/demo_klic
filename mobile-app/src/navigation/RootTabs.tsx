import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors } from "../theme/colors";

import TodayScreen from "../screens/TodayScreen";
import FocusScreen from "../screens/FocusScreen";
import EnergyScreen from "../screens/EnergyScreen";
import TriggersScreen from "../screens/TriggersScreen";
import QuestionScreen from "../screens/QuestionScreen";
import ReportScreen from "../screens/ReportScreen";

const Tab = createBottomTabNavigator();

// Maps 1:1 to the original web app's `tab` state ("today" | "focus" | ...)
// — same six sections, now real native screens instead of conditional divs.
const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.card, border: colors.cardBorder },
};

export default function RootTabs() {
  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.cardBorder },
        }}
      >
        <Tab.Screen name="Чек-лист" component={TodayScreen} />
        <Tab.Screen name="Фокус" component={FocusScreen} />
        <Tab.Screen name="Энергия" component={EnergyScreen} />
        <Tab.Screen name="Триггеры" component={TriggersScreen} />
        <Tab.Screen name="Вопрос" component={QuestionScreen} />
        <Tab.Screen name="Отчёт" component={ReportScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
