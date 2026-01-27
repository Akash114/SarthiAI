import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { formatDisplayDate } from "../utils/datetime";

type Props = {
  visible: boolean;
  day: string;
  options: string[];
  onSelect: (time: string) => void;
  onClose: () => void;
};

export function TimeSlotModal({ visible, day, options, onSelect, onClose }: Props) {
  const dateLabel = day ? formatDisplayDate(day) : null;

  if (!visible) {
    return null;
  }

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{dateLabel ? `Available slots for ${dateLabel}` : "Available slots"}</Text>
          {options.length ? (
            <ScrollView style={styles.list}>
              {options.map((slot) => (
                <TouchableOpacity key={slot} style={styles.slot} onPress={() => onSelect(slot)}>
                  <Text style={styles.slotText}>{slot}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.empty}>No open slots for this day. Pick another date.</Text>
          )}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    borderRadius: 20,
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#111827",
  },
  list: {
    maxHeight: 260,
  },
  slot: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  slotText: {
    fontSize: 16,
    color: "#1F2937",
  },
  empty: {
    textAlign: "center",
    color: "#6B7280",
    marginVertical: 16,
  },
  closeButton: {
    marginTop: 12,
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  closeText: {
    color: "#2563EB",
    fontWeight: "600",
  },
});
