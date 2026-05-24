import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors } from "../../constants/colors";
import { fonts } from "../../constants/fonts";

const buttons = [
  { label: "Coral pending", key: "coral" },
  { label: "Cad pending", key: "cad" },
  { label: "Design approval pending", key: "design" },
];

export default function Reports() {
  return (
    <View style={styles.container}>
      <View style={styles.buttonGroup}>
        {buttons.map((btn) => (
          <TouchableOpacity key={btn.key} style={styles.button} activeOpacity={0.8}>
            <Text style={styles.buttonText}>{btn.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: 20,
  },
  buttonGroup: {
    width: "100%",
    gap: 14,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: colors.textWhite,
    fontFamily: fonts.bold,
    fontSize: fonts.md,
  },
});