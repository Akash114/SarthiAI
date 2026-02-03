import { ScrollView, StyleSheet, Text, View } from "react-native";
import { BookOpen, Palette, PartyPopper, PersonStanding } from "lucide-react-native";

import type { JourneyCategory } from "../api/journey";
import { useTheme } from "../theme";

type Props = {
  categories: JourneyCategory[];
};

const CATEGORY_ICON_MAP: Record<string, typeof PersonStanding> = {
  fitness: PersonStanding,
  learning: BookOpen,
  hobby: Palette,
  general: Palette,
};

const REST_PLACEHOLDER: JourneyCategory = {
  category: "general",
  display_name: "Rest Day",
  resolution_id: "rest",
  resolution_title: "Rest Day",
  total_tasks: 0,
  completed_tasks: 0,
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export default function DailyJourneyWidget({ categories }: Props) {
  const { theme } = useTheme();
  const items = categories.length ? categories : [REST_PLACEHOLDER];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wrapper}>
      {items.map((journey, index) => {
        const percent = journey.total_tasks ? (journey.completed_tasks / journey.total_tasks) * 100 : 0;
        const complete = percent >= 100 || journey.resolution_id === "rest";
        const AvatarIcon = complete
          ? PartyPopper
          : CATEGORY_ICON_MAP[journey.category] || PersonStanding;
        const ringColor = complete ? theme.success : theme.accent;
        const trackColor = theme.border;
        const avatarBg = complete ? theme.success : theme.accent;
        const title = journey.resolution_title.length > 9 ? `${journey.resolution_title.slice(0, 8)}…` : journey.resolution_title;
        const fraction = journey.total_tasks ? `${journey.completed_tasks}/${journey.total_tasks}` : "Rest";

        return (
          <View key={`${journey.resolution_id}-${index}`} style={styles.avatarCard}>
            <View style={[styles.avatarRing, { borderColor: trackColor }]}>
              <View
                style={[
                  styles.avatarProgress,
                  {
                    borderColor: ringColor,
                    opacity: journey.resolution_id === "rest" ? 0.25 : 0.35 + clamp(percent, 0, 100) / 150,
                  },
                ]}
              />
              <View style={[styles.avatarInner, { backgroundColor: avatarBg }]}>
                <AvatarIcon size={20} color="#fff" />
              </View>
            </View>
            <Text style={[styles.avatarLabel, { color: theme.textPrimary }]}>{title}</Text>
            <Text style={[styles.avatarFraction, { color: theme.textSecondary }]}>{fraction}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 14,
    paddingHorizontal: 2,
  },
  avatarCard: {
    width: 74,
    alignItems: "center",
    gap: 6,
  },
  avatarRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarProgress: {
    position: "absolute",
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
  },
  avatarInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLabel: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  avatarFraction: {
    fontSize: 11,
  },
});
