import React, { useEffect, useState } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    SafeAreaView,
} from 'react-native';
import { colors } from '../../../constants/colors';
import { fonts } from '../../../constants/fonts';
import useDeviceLayout from '../../../hooks/useDeviceLayout';

const fields = [
    { key: 'Type', label: 'Type', keyboardType: 'default' },
    { key: 'Shape', label: 'Shape', keyboardType: 'default' },
    { key: 'Carat', label: 'Carat', keyboardType: 'decimal-pad' },
    { key: 'MmSize', label: 'Mm Size', keyboardType: 'decimal-pad' },
    { key: 'SieveSize', label: 'Sieve Size', keyboardType: 'default' },
    { key: 'Price', label: 'Price', keyboardType: 'decimal-pad' },
];

const DiamondEditModal = ({
    visible,
    diamond,
    onClose,
    onSave,
}) => {
    const initialData = diamond || {};
    const [localData, setLocalData] = useState({ ...initialData });
    const { isTablet } = useDeviceLayout();

    useEffect(() => {
        setLocalData({ ...(diamond || {}) });
    }, [diamond]);

    const handleChange = (key, value) => {
        setLocalData(prev => ({
            ...prev,
            [key]: value,
        }));
    };

    const handleSave = () => {
        onSave({
            ...localData,
            Carat: parseFloat(localData.Carat) || 0,
            MmSize: parseFloat(localData.MmSize) || 0,
            Price: parseFloat(localData.Price) || 0,
        });
    };

    return (
        <Modal
            animationType={isTablet ? 'fade' : 'slide'}
            visible={visible}
            onRequestClose={onClose}
            transparent={isTablet}
            presentationStyle={isTablet ? 'overFullScreen' : 'fullScreen'}
        >
            <View style={isTablet ? styles.tabletOverlay : styles.fullscreenWrapper}>
                <View style={isTablet ? styles.tabletContainer : styles.fullscreenContainer}>
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>Edit Diamond</Text>
                            <Text style={styles.subtitle}>{localData.Type || '—'}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Text style={styles.closeText}>Close</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.form}
                        contentContainerStyle={isTablet ? styles.formContentTablet : styles.formContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={isTablet ? styles.fieldsGrid : null}>
                            {fields.map(field => (
                                <View
                                    key={field.key}
                                    style={[
                                        styles.field,
                                        isTablet && styles.fieldTablet
                                    ]}
                                >
                                    <Text style={styles.label}>{field.label}</Text>
                                    <TextInput
                                        value={localData[field.key]?.toString() || ''}
                                        onChangeText={(value) => handleChange(field.key, value)}
                                        style={styles.input}
                                        keyboardType={field.keyboardType}
                                        placeholder={`Enter ${field.label}`}
                                        placeholderTextColor={colors.textSecondary}
                                    />
                                </View>
                            ))}
                        </View>
                    </ScrollView>

                    <View style={[styles.footer, isTablet && styles.footerTablet]}>
                        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                            <Text style={styles.saveButtonText}>Save Changes</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    fullscreenWrapper: {
        flex: 1,
        backgroundColor: colors.background || '#F6F6F6',
    },
    fullscreenContainer: {
        flex: 1,
    },
    tabletOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    tabletContainer: {
        width: '100%',
        maxWidth: 600,
        backgroundColor: colors.background || '#F6F6F6',
        borderRadius: 12,
        overflow: 'hidden',
        maxHeight: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 12,
        backgroundColor: colors.background || '#F6F6F6',
    },
    title: {
        fontSize: fonts.lg,
        fontFamily: fonts.bold,
        color: colors.textPrimary,
    },
    subtitle: {
        fontSize: fonts.sm,
        color: colors.textSecondary,
        marginTop: 2,
    },
    closeText: {
        fontSize: fonts.sm,
        color: colors.primary,
        fontFamily: fonts.medium,
    },
    form: {
        flex: 1,
        paddingHorizontal: 20,
    },
    formContent: {
        paddingBottom: 40,
    },
    formContentTablet: {
        paddingBottom: 20,
    },
    fieldsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -8,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.white,
    },
    footerTablet: {
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
    },
    field: {
        marginBottom: 14,
    },
    fieldTablet: {
        width: '33.33%',
        paddingHorizontal: 8,
    },
    label: {
        fontSize: fonts.sm,
        color: colors.textSecondary,
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: fonts.base,
        color: colors.textPrimary,
    },
    saveButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    saveButtonText: {
        color: colors.textWhite,
        fontSize: fonts.base,
        fontFamily: fonts.bold,
    },
});

export default DiamondEditModal;

