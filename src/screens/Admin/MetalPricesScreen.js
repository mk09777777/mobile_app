import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Text,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGetMetalPricesQuery, useGetMetalPriceHistoryQuery, useAddMetalPriceMutation, useUpdateMetalPriceMutation, useDeleteMetalPriceMutation } from '../../store/api';
import { Card } from '../../components/cards/Cards';
import { Input } from '../../components/common';
import { AnimatedLogoLoader } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { API_BASE_URL } from '../../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MetalPriceHistoryChart from '../../components/charts/MetalPriceHistoryChart';
import BrandedAlert from '../../components/common/BrandedAlert';

const MetalPricesScreen = () => {
  const isMountedRef = useRef(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingPrices, setEditingPrices] = useState({});
  const [editingDates, setEditingDates] = useState({}); // Store dates for editing
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [showMetalTypeDropdown, setShowMetalTypeDropdown] = useState(false);
  const [selectedMetalForChart, setSelectedMetalForChart] = useState('gold');
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));
  
  // Track component mount state and cleanup timeouts
  const timeoutRefs = useRef([]);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Clean up any pending timeouts
      timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
      timeoutRefs.current = [];
    };
  }, []);
  const [newMetalPrice, setNewMetalPrice] = useState({
    metalType: 'gold',
    price: '',
    date: new Date().toISOString().split('T')[0], // Initialize with today's date
    unit: 'per gram',
  });

  // Redux hooks
  const { data: metalPricesData, isLoading: loading, refetch } = useGetMetalPricesQuery(false);
  const { data: metalPriceHistory, isLoading: loadingHistory, refetch: refetchHistory } = useGetMetalPriceHistoryQuery(false);
  const [addMetalPrice, { isLoading: isAddingPrice }] = useAddMetalPriceMutation();
  const [updateMetalPrice, { isLoading: isUpdatingPrice }] = useUpdateMetalPriceMutation();
  const [deleteMetalPrice, { isLoading: isDeletingPrice }] = useDeleteMetalPriceMutation();

  // Extract prices and ids from response
  const metalPrices = metalPricesData?.prices || metalPricesData || null;
  const metalIds = metalPricesData?.ids || {};

  const metalTypes = [
    { value: 'gold', label: 'Gold' },
    { value: 'silver', label: 'Silver' },
    { value: 'platinum', label: 'Platinum' },
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchHistory()]);
    setRefreshing(false);
  };

  // Legacy function kept for compatibility, now uses Redux
  const loadMetalPrices = async () => {
    await refetch();
  };
  
  

  // Initialize editing dates with today's date by default
  useEffect(() => {
    if (metalPrices) {
      const today = new Date().toISOString().split('T')[0];
      const initialDates = {};
      ['gold', 'silver', 'platinum'].forEach(metal => {
        initialDates[metal] = today; // Always use today's date
      });
      setEditingDates(initialDates);
      setEditingPrices({ ...metalPrices });
    }
  }, [metalPrices]);

  const handlePriceChange = (metal, value) => {
    const parsedValue = parseFloat(value) || 0;
    setEditingPrices(prev => ({
      ...prev,
      [metal]: {
        ...prev[metal],
        price: parsedValue,
      },
    }));
  };

  const handleDateChange = (metal, value) => {
    setEditingDates(prev => ({
      ...prev,
      [metal]: value,
    }));
  };

  const handleSavePrices = async () => {
    try {
      
      // First, fetch the full document to get the actual dates of latest entries
      let latestEntryDates = {};
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          const fullEndpointResponse = await fetch(`${API_BASE_URL}/api/metal-prices`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (fullEndpointResponse.ok) {
            const fullData = await fullEndpointResponse.json();
            
            // Extract the latest entry date for each metal
            ['gold', 'silver', 'platinum'].forEach(metalKey => {
              const metalArray = fullData[metalKey];
              if (Array.isArray(metalArray) && metalArray.length > 0) {
                const sortedByDate = [...metalArray].sort((a, b) => {
                  const dateA = new Date(a.date || a.Date || 0);
                  const dateB = new Date(b.date || b.Date || 0);
                  return dateB - dateA; // Descending order (latest first)
                });
                const latestEntry = sortedByDate[0];
                latestEntryDates[metalKey] = latestEntry.date || latestEntry.Date;
              }
            });
          }
        }
      } catch (fetchError) {
        // Silently handle fetch error
      }
      
      // Update all changed prices
      const updatePromises = [];
      const metals = ['gold', 'silver', 'platinum'];
      
      for (const metal of metals) {
        const currentPrice = metalPrices[metal]?.price;
        const newPrice = editingPrices[metal]?.price;
        const date = editingDates[metal];
        
        // Only update if price has changed
        if (currentPrice !== newPrice && newPrice !== undefined && newPrice !== null) {
          // Use the date from the latest existing entry, or today's date if no entry exists
          const dateToUse = latestEntryDates[metal] || new Date().toISOString().split('T')[0];
          
          // Convert to ISO format if needed
          let finalDate = dateToUse;
          if (finalDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            finalDate = `${finalDate}T00:00:00.000Z`;
          } else if (!finalDate.includes('T')) {
            finalDate = new Date(finalDate).toISOString();
          }
          
          // Capture finalDate in a const for use in the promise
          const dateForUpdate = finalDate;
          
          updatePromises.push(
            updateMetalPrice({ metal, date: dateForUpdate, price: newPrice || 0 }).unwrap().then(response => {
              // 204 No Content (null response) is still a success
              // The real test is if the update persists after refetch
              return { metal, response, newPrice, date: dateForUpdate, success: true };
            }).catch(error => {
              if (__DEV__) {
                console.error(`❌ ${metal.toUpperCase()} Update FAILED:`, error?.message || error);
              }
              throw error;
            })
          );
        }
      }
      
      if (updatePromises.length > 0) {
        let results;
        try {
          results = await Promise.all(updatePromises);
        } catch (error) {
          if (__DEV__) {
            console.error('❌ PUT REQUEST FAILED:', error);
          }
          throw error;
        }
        
        // Process the PUT response directly to update UI immediately
        // The PUT response contains the full document with arrays: { gold: [{date, price}, ...], ... }
        const updatedPrices = { ...metalPrices };
        
        // Process each response - each PUT returns the full document with all metals
        results.forEach(({ metal, response, newPrice, date }) => {
          if (response && typeof response === 'object' && (response.gold || response.silver || response.platinum)) {
            // Backend returns full document with arrays for all metals
          ['gold', 'silver', 'platinum'].forEach(metalKey => {
              const metalArray = response[metalKey];
            if (Array.isArray(metalArray) && metalArray.length > 0) {
              // Get the latest entry (most recent date)
              const sortedByDate = [...metalArray].sort((a, b) => {
                const dateA = new Date(a.date || a.Date || 0);
                const dateB = new Date(b.date || b.Date || 0);
                return dateB - dateA; // Descending order (latest first)
              });
              const latestEntry = sortedByDate[0];
                
              updatedPrices[metalKey] = {
                price: latestEntry.price || latestEntry.Price || 0,
                unit: 'per gram',
                lastUpdated: latestEntry.date || latestEntry.Date || new Date().toISOString(),
              };
              }
            });
          } else if (response === null || response === undefined) {
            // Response is null - backend might have returned 204 No Content or empty response
            // Use the values we sent as fallback
            updatedPrices[metal] = {
              price: newPrice,
              unit: 'per gram',
              lastUpdated: date,
            };
          }
        });
        
        // Final check: ensure all updated metals have the correct values
        results.forEach(({ metal, newPrice, date }) => {
          // If this metal wasn't processed from response or price doesn't match, use sent values
          if (!updatedPrices[metal] || updatedPrices[metal].price !== newPrice) {
            updatedPrices[metal] = {
              price: newPrice,
              unit: 'per gram',
              lastUpdated: date,
            };
          }
        });
        
        // Update editing prices to reflect changes
        setEditingPrices({ ...updatedPrices });
        
        showAlert('Success', 'Metal prices updated successfully', 'success');
        
        // Redux will automatically refetch and update the cache
        // Also reload from API in the background to ensure sync
        // Wait longer to ensure backend has processed the update
        const timeoutId = setTimeout(async () => {
          // Remove from refs when executed
          timeoutRefs.current = timeoutRefs.current.filter(id => id !== timeoutId);
          
          // Check if component is still mounted
          if (!isMountedRef.current) {
            return;
          }
          
          try {
            // Wait a bit more to ensure backend has saved the update
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check again if component is still mounted
            if (!isMountedRef.current) {
              return;
            }
            
            // Only refetch if component is still mounted, query is initialized and refetch function exists
            let refetchedPrices = {};
            if (isMountedRef.current && refetch && typeof refetch === 'function') {
              try {
                const refetchResult = await refetch();
                refetchedPrices = refetchResult?.data?.prices || refetchResult?.data || {};
              } catch (refetchError) {
                // Use current metalPrices as fallback
                refetchedPrices = metalPrices || {};
              }
            } else {
              refetchedPrices = metalPrices || {};
            }
            
            // Verify that updates actually persisted
            const updateVerification = [];
            results.forEach(({ metal, newPrice }) => {
              const refetchedPrice = refetchedPrices[metal]?.price;
              const updatePersisted = refetchedPrice === newPrice;
              
              if (!updatePersisted) {
                updateVerification.push({
                  metal,
                  expected: newPrice,
                  actual: refetchedPrice,
                });
              }
            });
            
            if (updateVerification.length > 0) {
              const failedMetals = updateVerification.map(v => v.metal).join(', ');
              const errorMessage = `⚠️ Warning: The following metal prices may not have been saved correctly: ${failedMetals}. ` +
                `Please check the backend API or try updating again.`;
              
              if (__DEV__) {
                console.error('❌ Update Verification Failed:', updateVerification);
              }
              
              // Show alert to user
              showAlert(
                'Update Warning',
                errorMessage + '\n\n' +
                updateVerification.map(v => 
                  `${v.metal}: Expected ${v.expected}, but got ${v.actual || 'N/A'}`
                ).join('\n'),
                'info',
                [{ text: 'OK' }]
              );
            }
          } catch (err) {
            if (__DEV__) {
              console.error('❌ Background reload error:', err);
            }
          }
        }, 500);
        // Store timeout ID for cleanup
        timeoutRefs.current.push(timeoutId);
      } else {
        showAlert('Info', 'No changes to save', 'info');
      }
      
      setIsEditing(false);
    } catch (error) {
      showAlert(
        'Error',
        error.message || 'Failed to update metal prices. Please try again.',
        'error'
      );
    }
  };

  const handleDeletePrice = (metal) => {
    showAlert(
      'Delete Metal Price',
      `Are you sure you want to delete the price for ${metal.charAt(0).toUpperCase() + metal.slice(1)}?`,
      'info',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const date = editingDates[metal] || new Date().toISOString().split('T')[0];
              await deleteMetalPrice({ metal, date }).unwrap();
              showAlert('Success', 'Metal price deleted successfully', 'success');
              
              // Wait a moment for the API to process
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Reload prices to get updated data (Redux will refetch automatically)
              await Promise.all([refetch(), refetchHistory()]);
            } catch (error) {
              showAlert(
                'Error',
                error.message || 'Failed to delete metal price. Please try again.',
                'error'
              );
            }
          },
        },
      ]
    );
  };

  const handleStartEditing = () => {
    // Always show today's date when entering edit mode
    // Use a fresh Date object to ensure we get the current date
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    
    const resetDates = {};
    ['gold', 'silver', 'platinum'].forEach(metal => {
      resetDates[metal] = todayString; // Always use today's date
    });
    
    // Set dates first, then enable editing mode
    setEditingDates(resetDates);
    // Use setTimeout to ensure state update happens before setIsEditing
    setTimeout(() => {
      setIsEditing(true);
    }, 0);
  };

  const handleCancelEdit = () => {
    setEditingPrices(metalPrices);
    // Reset dates to today's date by default
    const today = new Date().toISOString().split('T')[0];
    const resetDates = {};
    ['gold', 'silver', 'platinum'].forEach(metal => {
      resetDates[metal] = today;
    });
    setEditingDates(resetDates);
    setIsEditing(false);
    setIsAdding(false);
    setShowMetalTypeDropdown(false);
    setNewMetalPrice({ 
      metalType: 'gold', 
      price: '', 
      date: new Date().toISOString().split('T')[0],
      unit: 'per gram' 
    });
  };

  const handleAddMetalPrice = async () => {
    if (!newMetalPrice.price || parseFloat(newMetalPrice.price) <= 0) {
      showAlert('Error', 'Please enter a valid price', 'error');
      return;
    }

    if (!newMetalPrice.metalType) {
      showAlert('Error', 'Please select a metal type', 'error');
      return;
    }

    // Date defaults to today if not provided, so no need to validate
    try {
      await addMetalPrice({
        metal: newMetalPrice.metalType,
        price: parseFloat(newMetalPrice.price),
        date: newMetalPrice.date, // Use the date from form
      }).unwrap();

      showAlert('Success', 'Metal price added successfully', 'success');
      setIsAdding(false);
      setNewMetalPrice({ 
        metalType: 'gold', 
        price: '', 
        date: new Date().toISOString().split('T')[0], // Reset to today
        unit: 'per gram' 
      });
      // Reload prices to get the new data (Redux will refetch automatically)
      await Promise.all([refetch(), refetchHistory()]);
    } catch (error) {
      showAlert(
        'Error',
        error.message || 'Failed to add metal price. Please try again.',
        'error'
      );
    }
  };

  // Build a compact summary row for Gold, Silver, Platinum
  const renderSummaryRow = () => {
    if (!metalPrices) return null;
    const order = ['gold', 'silver', 'platinum'];
    // Only show metals that have prices (filter out empty/undefined)
    const items = order
      .filter(key => metalPrices[key] && (metalPrices[key].price !== undefined && metalPrices[key].price !== null))
      .map(key => ({ key, ...metalPrices[key] }));

    if (items.length === 0) return null;

    return (
      <View style={styles.summaryRow}>
        {items.map((item, idx) => (
          <Card key={item.key} style={[styles.summaryCard, idx !== items.length - 1 && { marginRight: 8 }]}>
            <View style={styles.summaryCardHeader}>
              <Text style={styles.summaryTitle}>{item.key.charAt(0).toUpperCase() + item.key.slice(1)}</Text>
              {isEditing && (
                <TouchableOpacity
                  onPress={() => handleDeletePrice(item.key)}
                  style={styles.deleteButton}
                >
                  <Icon name="delete" size={18} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>
            
            {isEditing ? (
              <>
                <Input
                  label="Price"
                  value={editingPrices[item.key]?.price?.toString() || '0'}
                  onChangeText={(value) => handlePriceChange(item.key, value)}
                  keyboardType="numeric"
                  style={styles.editPriceInput}
                />
                <Input
                  label="Date"
                  value={editingDates[item.key] || new Date().toISOString().split('T')[0]}
                  onChangeText={(value) => handleDateChange(item.key, value)}
                  placeholder="YYYY-MM-DD"
                  style={styles.editDateInput}
                />
              </>
            ) : (
              <>
                <Text style={styles.summaryPrice}>${item.price || 0}</Text>
                <Text style={styles.summaryUpdated}>
                  {item.lastUpdated ? `Last up: ${formatDate(item.lastUpdated)}` : 'No date'}
                </Text>
              </>
            )}
          </Card>
        ))}
      </View>
    );
  };

  const renderMetalPriceCard = (metal, data) => (
    <Card key={metal} style={styles.priceCard}>
      <View style={styles.priceHeader}>
        <View style={styles.metalIcon}>
          <Icon name="jewelry" size={20} color={colors.primary} />
        </View>
        <View style={styles.metalInfo}>
          <Text style={[styles.metalName, { fontSize: fonts.lg, fontFamily: fonts.bold, color: colors.textPrimary }]}>
            {metal.charAt(0).toUpperCase() + metal.slice(1)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: fonts.sm }}>
            Last updated: {formatDate(data.lastUpdated)}
          </Text>
        </View>
      </View>

      <View style={styles.priceContent}>
        {isEditing ? (
          <View style={styles.editContainer}>
            <Input
              label="Price"
              value={editingPrices[metal].price.toString()}
              onChangeText={(value) => handlePriceChange(metal, value)}
              keyboardType="numeric"
              style={styles.priceInput}
            />
            <Text style={[styles.priceUnit, { color: colors.textSecondary, fontSize: fonts.sm }]}>
              {data.unit}
            </Text>
          </View>
        ) : (
          <View style={styles.priceDisplay}>
            <View style={{flexDirection:'row', alignItems:'center', justifyContent:'center'}}>
              <Icon name="monetization-on" size={24} color={colors.primary} style={{marginRight:4}} />
              <Text style={[styles.priceValue, { fontSize: fonts['2xl'], fontFamily: fonts.bold, color: colors.textPrimary }]}>
                ${data.price || 0}
              </Text>
            </View>
            <Text style={[styles.priceUnit, { color: colors.textSecondary, fontSize: fonts.sm }]}>
              {data.unit || 'per gram'}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );

  const renderActionButtons = () => (
    <Card style={styles.actionCard}>
      <Text style={[styles.actionTitle, { fontSize: fonts.lg, fontFamily: fonts.bold, color: colors.textPrimary }]}>
        Actions
      </Text>
      
      <View style={styles.actionButtons}>
        {isAdding ? (
          <>
            <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: fonts.sm, marginBottom: 12 }]}>
              Add New Metal Price
            </Text>
            <View style={styles.dropdownContainer}>
              <Text style={styles.dropdownLabel}>Metal Type</Text>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setShowMetalTypeDropdown(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.dropdownText}>
                  {metalTypes.find(m => m.value === newMetalPrice.metalType)?.label || 'Select Metal Type'}
                </Text>
                <Icon name="arrow-drop-down" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Modal
              visible={showMetalTypeDropdown}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowMetalTypeDropdown(false)}
            >
              <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowMetalTypeDropdown(false)}
              >
                <View style={styles.dropdownModal}>
                  {metalTypes.map((metal) => (
                    <TouchableOpacity
                      key={metal.value}
                      style={[
                        styles.dropdownOption,
                        newMetalPrice.metalType === metal.value && styles.dropdownOptionSelected,
                      ]}
                      onPress={() => {
                        setNewMetalPrice(prev => ({ ...prev, metalType: metal.value }));
                        setShowMetalTypeDropdown(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          newMetalPrice.metalType === metal.value && styles.dropdownOptionTextSelected,
                        ]}
                      >
                        {metal.label}
                      </Text>
                      {newMetalPrice.metalType === metal.value && (
                        <Icon name="check" size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </Modal>
            <Input
              label="Price"
              value={newMetalPrice.price}
              onChangeText={(value) => setNewMetalPrice(prev => ({ ...prev, price: value }))}
              keyboardType="numeric"
              placeholder="Enter price"
              style={styles.addInput}
            />
            <Input
              label="Date"
              value={newMetalPrice.date}
              onChangeText={(value) => setNewMetalPrice(prev => ({ ...prev, date: value }))}
              placeholder="YYYY-MM-DD"
              style={styles.addInput}
            />
            <TouchableOpacity
              onPress={handleAddMetalPrice}
              disabled={isAddingPrice}
              style={[styles.adminActionButton, styles.adminActionButtonPrimary, isAddingPrice && styles.btnDisabled]}
              activeOpacity={0.85}
            >
              <Icon name="add" size={18} color={colors.textWhite} />
              <Text style={styles.adminActionText}>
                {isAddingPrice ? "Adding..." : "Add Metal Price"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCancelEdit}
              style={[styles.adminActionButton, styles.adminActionButtonOutline]}
              activeOpacity={0.85}
            >
              <Icon name="close" size={18} color={colors.primary} />
              <Text style={[styles.adminActionText, styles.adminActionOutlineText]}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : isEditing ? (
          <>
            <TouchableOpacity
              onPress={handleSavePrices}
              disabled={isUpdatingPrice}
              style={[styles.adminActionButton, styles.adminActionButtonPrimary, isUpdatingPrice && styles.btnDisabled]}
              activeOpacity={0.85}
            >
              <Icon name="save" size={18} color={colors.textWhite} />
              <Text style={styles.adminActionText}>
                {isUpdatingPrice ? "Saving..." : "Save Changes"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCancelEdit}
              style={[styles.adminActionButton, styles.adminActionButtonOutline]}
              activeOpacity={0.85}
            >
              <Icon name="close" size={18} color={colors.primary} />
              <Text style={[styles.adminActionText, styles.adminActionOutlineText]}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              onPress={handleStartEditing}
              style={[styles.adminActionButton, styles.adminActionButtonPrimary]}
              activeOpacity={0.85}
            >
              <Icon name="edit" size={18} color={colors.textWhite} />
              <Text style={styles.adminActionText}>Edit Prices</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsAdding(true)}
              style={[styles.adminActionButton, styles.adminActionButtonSecondary]}
              activeOpacity={0.85}
            >
              <Icon name="add" size={18} color={colors.textWhite} />
              <Text style={styles.adminActionText}>Add Metal Price</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Card>
  );

  const renderPriceHistory = () => {
    const historyData = metalPriceHistory?.[selectedMetalForChart] || [];
    
    return (
      <Card style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <Text style={[styles.historyTitle, { fontSize: fonts.lg, fontFamily: fonts.bold, color: colors.textPrimary }]}>
            Price History
          </Text>
          
          {/* Metal Type Selector */}
          <View style={styles.metalSelectorContainer}>
            {metalTypes.map((metal) => (
              <TouchableOpacity
                key={metal.value}
                style={[
                  styles.metalSelectorButton,
                  selectedMetalForChart === metal.value && styles.metalSelectorButtonActive,
                ]}
                onPress={() => setSelectedMetalForChart(metal.value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.metalSelectorText,
                    selectedMetalForChart === metal.value && styles.metalSelectorTextActive,
                  ]}
                >
                  {metal.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loadingHistory ? (
          <View style={styles.chartLoadingContainer}>
            <AnimatedLogoLoader size={40} />
          </View>
        ) : (
          <MetalPriceHistoryChart
            historyData={historyData}
            metalType={selectedMetalForChart}
          />
        )}
      </Card>
    );
  };

  if (loading) {
    return <AnimatedLogoLoader size={80} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['left','right','bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop:20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        
        <View style={styles.header}>
          <Text style={{ fontSize: fonts['2xl'], fontFamily: fonts.bold, color: colors.primary }}>
            Metal Prices
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: fonts.sm }}>
            Manage current metal prices for jewellery calculations
          </Text>
        </View>

        {renderSummaryRow()}

        {/* Vertical detailed metal cards removed as requested */}

        {renderActionButtons()}
        {renderPriceHistory()}
      </ScrollView>
      <BrandedAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingTop: 0,
    paddingBottom: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  priceCard: {
    marginTop: 8,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  metalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  metalInfo: {
    flex: 1,
  },
  metalName: {
    marginBottom: 4,
  },
  priceContent: {
    alignItems: 'center',
  },
  editContainer: {
    width: '100%',
    alignItems: 'center',
  },
  priceInput: {
    width: '60%',
    textAlign: 'center',
  },
  priceDisplay: {
    alignItems: 'center',
  },
  priceValue: {
    marginBottom: 4,
  },
  priceUnit: {
    textAlign: 'center',
  },
  actionCard: {
    marginHorizontal: 16,
    marginVertical: 12,
  },
  actionTitle: {
    marginBottom: 16,
  },
  actionButtons: {
    gap: 12,
  },
  adminActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  adminActionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  adminActionButtonSecondary: {
    backgroundColor: colors.primaryLight,
  },
  adminActionButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  adminActionText: {
    color: colors.textWhite,
    fontFamily: fonts.medium,
    fontSize: 14,
    marginLeft: 8,
  },
  adminActionOutlineText: {
    color: colors.primary,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  addInput: {
    marginBottom: 12,
  },
  dropdownContainer: {
    marginBottom: 16,
  },
  dropdownLabel: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
  },
  dropdownText: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    backgroundColor: colors.background,
    borderRadius: 12,
    minWidth: 200,
    maxWidth: '80%',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  dropdownOptionSelected: {
    backgroundColor: colors.backgroundSecondary,
  },
  dropdownOptionText: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  dropdownOptionTextSelected: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  historyCard: {
    marginHorizontal: 16,
    marginVertical: 12,
  },
  historyHeader: {
    marginBottom: 16,
  },
  historyTitle: {
    marginBottom: 12,
  },
  metalSelectorContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  metalSelectorButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metalSelectorButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  metalSelectorText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  metalSelectorTextActive: {
    color: colors.textWhite,
    fontFamily: fonts.bold,
  },
  chartLoadingContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryTitle: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  summaryPrice: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  summaryUpdated: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  deleteButton: {
    padding: 4,
  },
  editPriceInput: {
    marginBottom: 8,
  },
  editDateInput: {
    marginBottom: 4,
  },
});

export default MetalPricesScreen;
