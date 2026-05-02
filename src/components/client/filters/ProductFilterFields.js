import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../../constants/colors';

/** Short labels (e.g. "10 kt") render as circles; longer ones (e.g. "925 Silver") as pills. */
const SHORT_CHIP_LABEL_MAX_LEN = 6;

const isShortChipLabel = (text) => String(text || '').length <= SHORT_CHIP_LABEL_MAX_LEN;

const getSelectedLabel = (options, selectedValue) => {
  const selectedOption = options.find((option) => (option?.value ?? option?.label) === selectedValue);
  return selectedOption?.label || selectedValue || '';
};

export const ChipsFilterField = ({ label, options = [], selectedValue, onSelect }) => {
  return (
    <View style={styles.filterBlock}>
      <View style={styles.chipsFieldRow}>
        <Text style={styles.chipsFieldLabel}>{label} :</Text>
        {options.map((option) => {
          const optionValue = option?.value ?? option?.label ?? '';
          const optionLabel = option?.label || optionValue;
          const active = selectedValue === optionValue;
          const short = isShortChipLabel(optionLabel);
          return (
            <TouchableOpacity
              key={`${label}-${optionValue}`}
              activeOpacity={0.8}
              onPress={() => onSelect(optionValue)}
              style={[
                styles.chip,
                short ? styles.chipCircle : styles.chipPill,
                active ? styles.chipActive : styles.chipInactive,
              ]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{optionLabel}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export const MultiChipsFilterField = ({ label, options = [], selectedValues = [], onToggle }) => {
  return (
    <View style={styles.filterBlock}>
      <View style={styles.chipsFieldRow}>
        <Text style={styles.chipsFieldLabel}>{label} :</Text>
        {options.map((option) => {
          const optionValue = option?.value ?? option?.label ?? '';
          const optionLabel = option?.label || optionValue;
          const active = Array.isArray(selectedValues) && selectedValues.includes(optionValue);
          const short = isShortChipLabel(optionLabel);
          return (
            <TouchableOpacity
              key={`${label}-${optionValue}`}
              activeOpacity={0.8}
              onPress={() => onToggle(optionValue)}
              style={[
                styles.chip,
                short ? styles.chipCircle : styles.chipPill,
                active ? styles.chipActive : styles.chipInactive,
              ]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{optionLabel}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export const DropdownFilterField = ({ label, options = [], selectedValue, onSelect }) => {
  const [open, setOpen] = useState(false);
  const selectedLabel = useMemo(
    () => getSelectedLabel(options, selectedValue) || '',
    [options, selectedValue],
  );

  return (
    <View style={styles.filterBlock}>
      <View style={styles.dropdownFieldRow}>
        <Text style={styles.dropdownFieldLabel}>{label} :</Text>
        <TouchableOpacity
          style={[styles.dropdownButton, open && styles.dropdownButtonOpen]}
          activeOpacity={0.85}
          onPress={() => setOpen((prev) => !prev)}>
          <Text style={styles.dropdownButtonText}>{selectedLabel || `Select ${label}`}</Text>
          <Text style={styles.dropdownChevron}>{open ? '\u25B2' : '\u25BC'}</Text>
        </TouchableOpacity>
      </View>

      {open ? (
        <View style={styles.dropdownList}>
          {options.map((option) => {
            const optionValue = option?.value ?? option?.label ?? '';
            const active = selectedValue === optionValue;
            return (
              <TouchableOpacity
                key={`${label}-${optionValue}`}
                activeOpacity={0.8}
                onPress={() => {
                  onSelect(optionValue);
                  setOpen(false);
                }}
                style={[styles.dropdownOption, active && styles.dropdownOptionActive]}>
                <Text style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}>
                  {option?.label || optionValue}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  filterBlock: {
    marginBottom: 10,
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
    padding: 10,
  },
  filterLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  chipsFieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    rowGap: 8,
  },
  chipsFieldLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '400',
  },
  chip: {
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  chipInactive: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
  },
  /** Compact rounded chip — sized to fit “10 kt” / “14 kt” without ellipsis (not a fixed tiny circle). */
  chipCircle: {
    minWidth: 48,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 22,
  },
  chipPill: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
  },
  chipActive: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  dropdownFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  dropdownFieldLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '400',
    minWidth: 84,
  },
  dropdownButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownButtonOpen: {
    backgroundColor: colors.primaryExtraLight,
  },
  dropdownButtonText: {
    color: '#A7A7A7',
    fontSize: 16,
  },
  dropdownChevron: {
    color: colors.textPrimary,
    fontSize: 12,
  },
  dropdownList: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownOptionActive: {
    backgroundColor: colors.primaryExtraLight,
  },
  dropdownOptionText: {
    color: colors.textPrimary,
    fontSize: 13,
  },
  dropdownOptionTextActive: {
    color: '#1A6A70',
    fontWeight: '600',
  },
});
