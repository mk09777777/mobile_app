import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Image,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import BrandedAlert from '../../components/common/BrandedAlert';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { launchImageLibrary } from 'react-native-image-picker';

let DocumentPicker;
try {
  DocumentPicker = require('react-native-document-picker').default;
} catch (e) {
  DocumentPicker = null;
}

import { Card } from '../../components/cards/Cards';
import Icon from '../../components/common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { useClients } from '../../features/clients/clientsHooks';
import { useGetStoneTypesQuery, useGetMetalPricesQuery, useCalculatePricingMutation,useImagepriceDataMutation } from '../../store/api';

let generatePDFModule = null;
try {
  const mod = require('react-native-html-to-pdf');
  generatePDFModule = mod.generatePDF || mod.default?.generatePDF || mod.default;
} catch (e) {
  // module will be checked before use
}

export default function PricingCalci() {
  // Form State
  const [clientId, setClientId] = useState('');
  const [stoneType, setStoneType] = useState('');
  const [metalKt, setMetalKt] = useState('18K');
  const [imageFile, setImageFile] = useState(null);
  const [excelFile, setExcelFile] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  // Modals Visibility
  const [showClientModal, setShowClientModal] = useState(false);
  const [showStoneModal, setShowStoneModal] = useState(false);
  const [showMetalModal, setShowMetalModal] = useState(false);
  const [showAllPricesModal, setShowAllPricesModal] = useState(false);

  // API Data
  const { clients = [] } = useClients();
  const { data: stoneTypesData = [] } = useGetStoneTypesQuery();
  const { data: metalPricesData } = useGetMetalPricesQuery(false);
  const [calculatePricing, { isLoading: isCalculating }] = useCalculatePricingMutation();
  const [GetimagepriceData, { isLoading: isImageLoading }] = useImagepriceDataMutation();

  // Editable form state (populated from imageData)
  const [editableStones, setEditableStones] = useState([]);
  const [editableMetal, setEditableMetal] = useState({ Weight: 0, Quality: '18K', Rate: 0 });
  const [editableCharges, setEditableCharges] = useState({ Loss: 10, Labour: 7, ExtraCharges: 0, UndercutPrice: 0 });
  const [pricingResult, setPricingResult] = useState(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingStoneIndex, setEditingStoneIndex] = useState(null);

  // Validation: Check if metal rate and all stone prices are present
  const validatePricingData = useCallback(() => {
    const hasMetalRate = editableMetal && parseFloat(editableMetal.Rate) > 0;
    const allStonesHavePrices = editableStones.length > 0 && editableStones.every(stone => parseFloat(stone.Price || 0) > 0);
    return hasMetalRate && allStonesHavePrices;
  }, [editableMetal, editableStones]);

  const canRecalculate = validatePricingData();

  useEffect(() => {
    if (!imageData) return;
    
    // Check if imageData has any valid pricing information
    const p = imageData.pricing || imageData.extractedData || imageData;
    const extractedData = imageData.extractedData || {};
    
    // Check for valid stones
    const hasStones = p.Stones && Array.isArray(p.Stones) && p.Stones.length > 0;
    const hasExtractedStones = extractedData.Stones && Array.isArray(extractedData.Stones) && extractedData.Stones.length > 0;
    
    // Check for valid metal data
    const hasMetal = p.Metal && (parseFloat(p.Metal.Weight) > 0);
    const hasExtractedMetal = extractedData.Metal && (parseFloat(extractedData.Metal.Weight) > 0);
    
    // Check for valid total pieces
    const hasTotalPieces = (extractedData.TotalPieces && extractedData.TotalPieces > 0) || (p.TotalPieces && p.TotalPieces > 0);
    
    // If no valid data at all, show error and clear
    if (!hasStones && !hasExtractedStones && !hasMetal && !hasExtractedMetal && !hasTotalPieces) {
      Alert.alert(
        'No Data Found',
        'No pricing data was extracted from the image. Please reupload a clear image with visible pricing information.',
        [
          {
            text: 'OK',
            onPress: () => {
              setImageFile(null);
              setImageData(null);
              setEditableStones([]);
              setEditableMetal({ Weight: 0, Quality: '18K', Rate: 0 });
              setPricingResult(null);
            }
          }
        ]
      );
      return;
    }
    
    // Only proceed if we have pricing data
    if (!imageData.pricing) return;
    
    setEditableStones(
      (p.Stones || []).map(s => ({ ...s }))
    );
    setEditableMetal({
      Weight: p.Metal?.Weight || 0,
      Quality: p.Metal?.Quality || metalKt,
      Rate: p.Metal?.Rate || 0,
    });
    setEditableCharges({
      Loss: p.Client?.Loss ?? 10,
      Labour: p.Client?.Labour ?? 7,
      ExtraCharges: p.Client?.ExtraCharges ?? 0,
      UndercutPrice: p.Client?.UndercutPrice ?? 0,
    });
    setPricingResult(p);
    
    // Log the full response for debugging
    console.log('📊 Full Image Data:', JSON.stringify(imageData, null, 2));
  }, [imageData, metalKt]);

  const updateStone = (index, field, value) => {
    setEditableStones(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const deleteStone = (index) => {
    setEditableStones(prev => prev.filter((_, i) => i !== index));
  };

  const addStone = () => {
    setEditableStones(prev => [...prev, {
      Type: '', Color: 'WH', Shape: 'RD',
      MmSize: '', SieveSize: '',
      Weight: 0, Pcs: 0, CtWeight: 0,
      Price: 0, Markup: 0,
    }]);
  };



  const handleRecalculate = async () => {
    if (!clientId) {
      showAlert('Validation Error', 'Client is required for pricing', 'warning');
      return;
    }
    setIsRecalculating(true);
    try {
      const formattedStones = editableStones.map(s => ({
        Type: s.Type || stoneType || '',
        Color: s.Color || '',
        Shape: s.Shape || '',
        MmSize: (s.MmSize || '0').toString(),
        SieveSize: (s.SieveSize || '0').toString(),
        CtWeight: parseFloat(s.CtWeight || 0) || 0,
        Weight: parseFloat(s.Weight || 0) || 0,
        Pcs: parseInt(s.Pcs || 0, 10) || 0,
        Price: parseFloat(s.Price || 0) || 0,
      })).filter(s => s.Type);

      const result = await calculatePricing({
        details: {
          Metal: {
            Weight: parseFloat(editableMetal.Weight || 0) || 0,
            Quality: editableMetal.Quality || metalKt,
          },
          Stones: formattedStones,
          Quantity: 1,
        },
        clientId,
      }).unwrap();

      setPricingResult(result);
      showAlert('Recalculation Complete', `Total Price: $${result.TotalPrice ?? result.totalPrice ?? 0}`, 'info');
    } catch (error) {
      const msg = error?.data?.message || error?.message || 'Recalculation failed';
      showAlert('Error', msg, 'error');
    } finally {
      setIsRecalculating(false);
    }
  };

  const buildPricingHtml = useCallback(() => {
    if (!pricingResult) return '';

    const stonesHtml = editableStones.map((s, idx) => `
      <tr style="${idx % 2 === 0 ? 'background:#f9f9f9' : ''}">
        <td style="padding:8px;border:1px solid #ddd;text-align:center">${s.MmSize || '-'}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center">${s.Color || '-'}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center">${s.Shape || '-'}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center">${s.SieveSize || '-'}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right">${s.Weight || 0}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center">${s.Pcs || 0}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right">${s.CtWeight || 0}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right">${s.Markup || 0}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right">$${s.Price || 0}</td>
      </tr>
    `).join('');

    const applicableDuties = pricingResult.Applicable 
      ? Object.entries(pricingResult.Applicable)
          .filter(([_, value]) => value)
          .map(([key]) => key.replace(/([A-Z])/g, ' $1').trim())
          .join(', ')
      : 'None';

    const clientName = clients.find(c => c.id === clientId || c._id === clientId)?.name || 'N/A';
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #D4AF37; padding-bottom: 20px; }
          .header h1 { color: #D4AF37; margin: 0; font-size: 28px; }
          .header p { color: #666; margin: 5px 0; font-size: 14px; }
          .section { margin: 25px 0; }
          .section-title { background: #D4AF37; color: white; padding: 10px 15px; font-size: 16px; font-weight: bold; margin-bottom: 15px; }
          .info-grid { display: table; width: 100%; margin-bottom: 15px; }
          .info-row { display: table-row; }
          .info-label { display: table-cell; padding: 8px; font-weight: bold; color: #555; width: 40%; border-bottom: 1px solid #eee; }
          .info-value { display: table-cell; padding: 8px; color: #333; border-bottom: 1px solid #eee; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th { background: #8B4513; color: white; padding: 10px; text-align: center; font-size: 13px; border: 1px solid #ddd; }
          td { padding: 8px; border: 1px solid #ddd; font-size: 12px; }
          .total-section { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-top: 20px; }
          .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; }
          .total-label { font-weight: bold; color: #555; }
          .total-value { color: #333; font-weight: bold; }
          .grand-total { font-size: 20px; color: #D4AF37; margin-top: 15px; padding-top: 15px; border-top: 2px solid #D4AF37; }
          .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee; color: #999; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Chandra Jewellery</h1>
          <p>Pricing Calculation Report</p>
          <p>${currentDate}</p>
        </div>

        <div class="section">
          <div class="section-title">Client Information</div>
          <div class="info-grid">
            <div class="info-row">
              <div class="info-label">Client Name:</div>
              <div class="info-value">${clientName}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Stone Type:</div>
              <div class="info-value">${stoneType || 'N/A'}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Total Pieces:</div>
              <div class="info-value">${imageData?.extractedData?.TotalPieces || pricingResult.TotalPieces || 0}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Diamond Weight:</div>
              <div class="info-value">${pricingResult.DiamondWeight || 0} ct</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Metal Details</div>
          <div class="info-grid">
            <div class="info-row">
              <div class="info-label">Weight:</div>
              <div class="info-value">${editableMetal.Weight || 0} g</div>
            </div>
            <div class="info-row">
              <div class="info-label">Quality:</div>
              <div class="info-value">${editableMetal.Quality || 'N/A'}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Rate:</div>
              <div class="info-value">$${editableMetal.Rate || 0}/g</div>
            </div>
          </div>
        </div>

        ${editableStones.length > 0 ? `
        <div class="section">
          <div class="section-title">Stones Breakdown (${editableStones.length} items)</div>
          <table>
            <thead>
              <tr>
                <th>MM</th>
                <th>Color</th>
                <th>Shape</th>
                <th>Sieve</th>
                <th>Avg Wt</th>
                <th>Pcs</th>
                <th>Ct Wt</th>
                <th>Markup</th>
                <th>$/Ct</th>
              </tr>
            </thead>
            <tbody>
              ${stonesHtml}
            </tbody>
          </table>
        </div>` : ''}

        <div class="section">
          <div class="section-title">Client Charges</div>
          <div class="info-grid">
            <div class="info-row">
              <div class="info-label">Loss:</div>
              <div class="info-value">${pricingResult.Client?.Loss || editableCharges.Loss || 0}%</div>
            </div>
            <div class="info-row">
              <div class="info-label">Labour:</div>
              <div class="info-value">$${pricingResult.Client?.Labour || editableCharges.Labour || 0}/g</div>
            </div>
            <div class="info-row">
              <div class="info-label">Extra Charges:</div>
              <div class="info-value">${pricingResult.Client?.ExtraCharges || editableCharges.ExtraCharges || 0}%</div>
            </div>
            ${(pricingResult.Client?.UndercutPrice || editableCharges.UndercutPrice) > 0 ? `
            <div class="info-row">
              <div class="info-label">Undercut Price:</div>
              <div class="info-value">$${pricingResult.Client?.UndercutPrice || editableCharges.UndercutPrice || 0}/ct</div>
            </div>` : ''}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Applicable Duties</div>
          <div class="info-grid">
            <div class="info-row">
              <div class="info-label">Applied Duties:</div>
              <div class="info-value">${applicableDuties}</div>
            </div>
          </div>
        </div>

        <div class="total-section">
          <div class="total-row">
            <span class="total-label">Metal Price:</span>
            <span class="total-value">$${(pricingResult.MetalPrice || 0).toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Diamonds Price:</span>
            <span class="total-value">$${(pricingResult.DiamondsPrice || 0).toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Duties Amount:</span>
            <span class="total-value">$${(pricingResult.DutiesAmount || 0).toFixed(2)}</span>
          </div>
          <div class="total-row grand-total">
            <span class="total-label">TOTAL PRICE:</span>
            <span class="total-value">$${(pricingResult.TotalPrice || 0).toFixed(2)}</span>
          </div>
        </div>

        <div class="footer">
          <p>Generated by Chandra Jewellery Management App</p>
          <p>This is a computer-generated document and does not require a signature</p>
        </div>
      </body>
      </html>`;
  }, [pricingResult, editableStones, editableMetal, editableCharges, imageData, clients, clientId, stoneType]);

  const generatePdfFile = useCallback(async () => {
    if (!pricingResult) {
      throw new Error('No pricing data available to export');
    }
    
    if (typeof generatePDFModule !== 'function') {
      throw new Error('PDF generation library is not available. Please install react-native-html-to-pdf');
    }
    
    const html = buildPricingHtml();
    if (!html) {
      throw new Error('Failed to generate PDF content');
    }
    
    const clientName = clients.find(c => c.id === clientId || c._id === clientId)?.name || 'Client';
    const fileName = `Pricing_${clientName.replace(/\s+/g, '_')}_${Date.now()}`;
    
    const options = {
      html,
      fileName,
      directory: 'Documents',
      base64: false,
    };
    
    const result = await generatePDFModule(options);
    return result;
  }, [buildPricingHtml, pricingResult, clients, clientId]);

  const handleSharePDF = useCallback(async () => {
    if (!pricingResult) {
      showAlert('No Data', 'Please calculate pricing first before sharing', 'info');
      return;
    }
    
    try {
      const pdf = await generatePdfFile();
      
      if (!pdf || !pdf.filePath) {
        throw new Error('PDF generation failed - no file path returned');
      }
      
      // Check if file exists
      const fileExists = await RNFS.exists(pdf.filePath);
      if (!fileExists) {
        throw new Error('PDF file was not created successfully');
      }
      
      // Copy to cache directory for sharing
      const clientName = clients.find(c => c.id === clientId || c._id === clientId)?.name || 'Client';
      const fileName = `Pricing_${clientName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      const cachePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      
      await RNFS.copyFile(pdf.filePath, cachePath);
      
      // Verify cache file exists
      const cacheExists = await RNFS.exists(cachePath);
      if (!cacheExists) {
        throw new Error('Failed to copy PDF to cache');
      }
      
      const shareOptions = {
        title: 'Share Pricing Report',
        message: 'Chandra Jewellery Pricing Report',
        url: Platform.OS === 'android' ? `file://${cachePath}` : cachePath,
        type: 'application/pdf',
        subject: 'Pricing Report',
        failOnCancel: false,
      };
      
      const result = await Share.open(shareOptions);
      
      // Clean up cache file after sharing
      setTimeout(async () => {
        try {
          await RNFS.unlink(cachePath);
        } catch (cleanupError) {
          console.log('Cache cleanup error:', cleanupError);
        }
      }, 5000);
      
    } catch (e) {
      console.error('Share PDF Error:', e);
      if (e?.message && !e.message.includes('User did not share') && !e.message.includes('cancelled') && !e.message.includes('User cancelled')) {
        showAlert('Share Failed', e.message || 'Failed to share PDF. Please try again.', 'error');
      }
    }
  }, [pricingResult, generatePdfFile, clients, clientId]);

  const handleExportDownload = useCallback(async () => {
    if (!pricingResult) {
      showAlert('No Data', 'Please calculate pricing first before exporting', 'info');
      return;
    }
    
    try {
      // Request storage permission for Android
      if (Platform.OS === 'android') {
        const { PermissionsAndroid } = require('react-native');
        
        // For Android 13+ (API 33+), we don't need WRITE_EXTERNAL_STORAGE
        const androidVersion = Platform.Version;
        
        if (androidVersion < 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            {
              title: 'Storage Permission',
              message: 'App needs access to your storage to save PDF files',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );
          
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            showAlert('Permission Denied', 'Storage permission is required to download files', 'warning');
            return;
          }
        }
      }
      
      const pdf = await generatePdfFile();
      
      if (!pdf || !pdf.filePath) {
        throw new Error('PDF generation failed - no file path returned');
      }
      
      // Check if source file exists
      const fileExists = await RNFS.exists(pdf.filePath);
      if (!fileExists) {
        throw new Error('PDF file was not created successfully');
      }
      
      const clientName = clients.find(c => c.id === clientId || c._id === clientId)?.name || 'Client';
      const fileName = `Pricing_${clientName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      const fileUrl = Platform.OS === 'android' ? `file://${pdf.filePath}` : pdf.filePath;
      
      if (Platform.OS === 'ios') {
        // For iOS, trigger the native "Save to Files" dialog
        await Share.open({
          url: fileUrl,
          saveToFiles: true,
          title: 'Save PDF',
          filename: fileName,
        });
      } else {
        // For Android, try to copy the file directly to the public Downloads folder
        const downloadPath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
        
        try {
          // First attempt: copy directly
          await RNFS.copyFile(pdf.filePath, downloadPath);
          
          showAlert('Export Successful', `PDF saved successfully!\n\nFile: ${fileName}\nLocation: Downloads folder\n\nYou can access it from your File Manager.`, 'success', [{ text: 'OK' }]);
        } catch (copyError) {
          console.warn('Direct copy failed, trying base64 write', copyError);
          try {
            // Second attempt: read as base64 and write
            // Helps bypass some scoped storage restrictions on Android 10/11
            const base64data = await RNFS.readFile(pdf.filePath, 'base64');
            await RNFS.writeFile(downloadPath, base64data, 'base64');

            showAlert('Export Successful', `PDF saved successfully!\n\nFile: ${fileName}\nLocation: Downloads folder\n\nYou can access it from your File Manager.`, 'success', [{ text: 'OK' }]);
          } catch (writeError) {
            console.warn('Base64 write failed, falling back to Share', writeError);
            // Final fallback: use the Share module so user can save or send it
            await Share.open({
              url: fileUrl,
              title: 'Save PDF',
              filename: fileName,
            });
          }
        }
      }
    } catch (e) {
      console.error('Export PDF Error:', e);
      // Ignore user cancellation errors
      if (e?.message && !e.message.includes('User did not share') && !e.message.includes('cancelled') && !e.message.includes('User cancelled')) {
        showAlert('Export Failed', e?.message || 'Failed to export PDF. Please check storage permissions and try again.', 'error');
      }
    }
  }, [pricingResult, generatePdfFile, clients, clientId]);



  // Options Formatting
  const clientOptions = clients.map((c) => ({
    label: c.name || 'Unknown Client',
    value: c.id || c._id,
  }));

  const stoneOptions = stoneTypesData.map((st) => ({
    label: st.label,
    value: st.value,
  }));

  const metalQualityOptions = [
    { label: '10K', value: '10K' },
    { label: '14K', value: '14K' },
    { label: '18K', value: '18K' },
    { label: '22K', value: '22K' },
    { label: 'Silver 925', value: 'Silver 925' },
    { label: 'Platinum', value: 'Platinum' },
  ];

  // Calculate Today's Price based on selection
  const getTodayPrice = () => {
    const prices = metalPricesData?.prices || {};
    if (metalKt.includes('Silver')) {
      return prices.silver?.price ? `$${prices.silver.price.toFixed(2)} / g` : 'N/A';
    }
    if (metalKt.includes('Platinum')) {
      return prices.platinum?.price ? `$${prices.platinum.price.toFixed(2)} / g` : 'N/A';
    }
    
    // For Gold (e.g. 10K, 14K, 18K)
    const baseGoldPrice = prices.gold?.price || 0;
    if (!baseGoldPrice) return 'N/A';

    const match = metalKt.match(/(\d+)K/i);
    if (match) {
      const kt = parseInt(match[1], 10);
      const calculatedPrice = baseGoldPrice * (kt / 24);
      return `$${calculatedPrice.toFixed(2)} / g`;
    }
    return 'N/A';
  };

  const todayPriceDisplay = getTodayPrice();

  // Handlers
  const handleImagePick = async () => {
    // Validate required fields before picking image
    if (!clientId) {
      showAlert('Validation Error', 'Please select a client first', 'warning');
      return;
    }
    if (!stoneType) {
      showAlert('Validation Error', 'Please select a stone type first', 'warning');
      return;
    }

    try {
      const pickerResult = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
      if (pickerResult.didCancel) return;
      if (pickerResult.assets && pickerResult.assets.length > 0) {
        const asset = pickerResult.assets[0];
        // Max 20MB limit validation
        if (asset.fileSize && asset.fileSize > 20 * 1024 * 1024) {
          showAlert('File too large', 'Maximum allowed image size is 20MB.', 'warning');
          return;
        }
        setImageFile({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
        });

        // Show loader and extract data from image
        setIsExtracting(true);
        try {
          const apiResult = await GetimagepriceData({
            image: {
              uri: asset.uri,
              name: asset.fileName || `image_${Date.now()}.jpg`,
              type: asset.type || 'image/jpeg',
            },
            clientId: clientId,
            stoneType: stoneType,
            metalQuality: metalKt,
          }).unwrap();

          console.log('🚀 image price data', apiResult);
          setImageData(apiResult);
        } catch (apiError) {
          console.error('❌ API Error:', apiError);
          const errorMsg = apiError?.data?.message || apiError?.error || 'Failed to extract pricing data. Please ensure the client has pricing configuration set up.';
           showAlert('Extraction Error', errorMsg, 'error');
          // Clear the image on error
          setImageFile(null);
        } finally {
          setIsExtracting(false);
        }
      }
    } catch (error) {
      console.error('❌ Image Picker Error:', error);
      showAlert('Error', 'Failed to pick image. Please try again.', 'error');
      setIsExtracting(false);
    }
  };

  const handleExcelPick = async () => {
    if (!DocumentPicker) {
      showAlert('Feature Not Available', 'Document picker is not available on this device.', 'warning');
      return;
    }
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.xlsx, DocumentPicker.types.xls],
      });
      setExcelFile({
        uri: result.uri,
        name: result.name,
        type: result.type,
      });
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        showAlert('Error', 'Failed to pick excel file', 'error');
      }
    }
  };

  const handleCalculate = async (extractedDetails = null) => {
    const data = extractedDetails || imageData;
    const detailsData = data?.pricing || data?.extractedData || data?.details || data;
    
    if (!detailsData) {
      showAlert('Validation Error', 'No pricing data available. Please upload an image first.', 'warning');
      return;
    }
    
    try {
      // Structure the payload exactly as the backend expects
      const rawStones = Array.isArray(detailsData.Stones) 
        ? detailsData.Stones 
        : Array.isArray(detailsData.stones) ? detailsData.stones : [];

      const formattedStones = rawStones.map(stone => ({
        Type: stone.Type || stone.type || stoneType || '',
        Color: stone.Color || stone.color || '',
        Shape: stone.Shape || stone.shape || '',
        MmSize: (stone.MmSize || stone.mmSize || stone.MM || stone.mm || '0').toString(),
        SieveSize: (stone.SieveSize || stone.sieveSize || stone.Sieve || stone.sieve || '0').toString(),
        CtWeight: parseFloat(stone.CtWeight || stone.ctWeight || stone.CaratWeight || stone.caratWeight || 0) || 0,
        Weight: parseFloat(stone.Weight || stone.weight || 0) || 0,
        Pcs: parseInt(stone.Pcs || stone.pcs || stone.Pieces || stone.pieces || 0, 10) || 0,
        Price: parseFloat(stone.Price || stone.price || 0) || 0,
      })).filter(s => s.Type);

      const payloadDetails = {
        Metal: {
          Weight: parseFloat(detailsData.Metal?.Weight || detailsData.metalWeight || 0) || 0,
          Quality: detailsData.Metal?.Quality || detailsData.metalQuality || metalKt,
        },
        Stones: formattedStones,
        Quantity: parseInt(detailsData.Quantity || detailsData.quantity || 1, 10) || 1,
      };

      const result = await calculatePricing({
        details: payloadDetails,
        clientId,
      }).unwrap();

      const finalPrice = result?.TotalPrice !== undefined ? result.TotalPrice : (result?.totalPrice || 'N/A');
      showAlert('Calculation Complete', `Total Price: $${finalPrice}\n\nPlease check the console for detailed pricing breakdown.`, 'success', [{ text: 'OK' }]);
      
      console.log('💰 Pricing Result:', result);
    } catch (error) {
      console.error('❌ Pricing calculation error:', error);
      const errorMsg = error?.data?.message || error?.message || 'Failed to calculate pricing. Please ensure the client has pricing configuration set up.';
      showAlert('Calculation Failed', errorMsg, 'error');
    }
  };

  // Reusable Dropdown Render Function
  const renderDropdown = (
    label,
    placeholder,
    value,
    options,
    isVisible,
    setVisible,
    onSelect,
    extraElement = null
  ) => {
    const selectedLabel = options.find((o) => o.value === value)?.label || placeholder;

    return (
      <View style={styles.inputContainer}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {extraElement}
        </View>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={[styles.dropdownText, !value && styles.placeholderText]}>
            {selectedLabel}
          </Text>
          <Icon name="arrow-drop-down" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <Modal
          visible={isVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setVisible(false)}
          >
            <View style={styles.modalContent}>
              <ScrollView showsVerticalScrollIndicator={true}>
                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.dropdownOption,
                      value === opt.value && styles.dropdownOptionSelected,
                    ]}
                    onPress={() => {
                      onSelect(opt.value);
                      setVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        value === opt.value && styles.dropdownOptionTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {value === opt.value && (
                      <Icon name="check" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Text style={styles.title}>Pricing Calculator</Text>

          {renderDropdown(
            'Client*',
            'Select a client...',
            clientId,
            clientOptions,
            showClientModal,
            setShowClientModal,
            setClientId
          )}

          {renderDropdown(
            'Stone Type*',
            'Select stone type...',
            stoneType,
            stoneOptions,
            showStoneModal,
            setShowStoneModal,
            setStoneType
          )}

          {renderDropdown(
            'Metal Kt*',
            'Select Metal Kt...',
            metalKt,
            metalQualityOptions,
            showMetalModal,
            setShowMetalModal,
            setMetalKt,
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.extraText}>Today: {todayPriceDisplay}</Text>
              <TouchableOpacity onPress={() => setShowAllPricesModal(true)} style={{ marginLeft: 8 }}>
                <Icon name="monetization-on" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Image*</Text>
            <TouchableOpacity
              style={styles.uploadArea}
              onPress={handleImagePick}
              activeOpacity={0.7}
              disabled={isExtracting || isImageLoading}
            >
              {isExtracting || isImageLoading ? (
                <View style={styles.loadingContainer}>
                  <Icon name="hourglass-empty" size={40} color={colors.primary} />
                  <Text style={styles.uploadText}>Extracting pricing data...</Text>
                  <Text style={styles.uploadSubText}>Please wait while we analyze the image</Text>
                </View>
              ) : imageFile ? (
                <View style={styles.filePreview}>
                  <Image source={{ uri: imageFile.uri }} style={styles.previewImage} />
                  <Text style={styles.fileName} numberOfLines={1}>{imageFile.name}</Text>
                  <TouchableOpacity onPress={() => { setImageFile(null); setImageData(null); }}>
                    <Icon name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Icon name="cloud-upload" size={40} color={colors.primary} />
                  <Text style={styles.uploadText}>No file chosen</Text>
                  <Text style={styles.uploadSubText}>Select client & stone type first, then upload (max 20 MB)</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Excel (optional)</Text>
            <TouchableOpacity
              style={styles.uploadArea}
              onPress={handleExcelPick}
              activeOpacity={0.7}
            >
              {excelFile ? (
                <View style={styles.filePreview}>
                  <Icon name="insert-drive-file" size={40} color={colors.primary} />
                  <Text style={styles.fileName} numberOfLines={1}>{excelFile.name}</Text>
                  <TouchableOpacity onPress={() => setExcelFile(null)}>
                    <Icon name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Icon name="file-upload" size={40} color={colors.primary} />
                  <Text style={styles.uploadText}>No file chosen</Text>
                  <Text style={styles.uploadSubText}>Drag & drop .xlsx (overrides image data)</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Card>

        {imageData && imageData.pricing && editableStones && editableStones.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Extracted Details</Text>

            {/* Display extracted data summary */}
            {imageData.extractedData && (
              <View style={styles.summaryContainer}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Pieces:</Text>
                  <Text style={styles.summaryValue}>{imageData.extractedData.TotalPieces || 0}</Text>
                </View>
                {imageData.pricing && (
                  <>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Diamond Weight:</Text>
                      <Text style={styles.summaryValue}>{imageData.pricing.DiamondWeight || 0} ct</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Stone Type:</Text>
                      <Text style={styles.summaryValue}>{imageData.pricing.Stones?.[0]?.Type || stoneType || 'N/A'}</Text>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* ---- Stones Table (fixed width, no horizontal scroll) ---- */}
            <Text style={styles.subSectionTitle}>Stones ({editableStones.length})</Text>
            <View style={styles.compactTableWrapper}>
              {/* Header */}
              <View style={styles.compactTableHeader}>
                <Text style={[styles.compactTableHeaderText, { width: 45 }]}>MM</Text>
                <Text style={[styles.compactTableHeaderText, { width: 40 }]}>Col</Text>
                <Text style={[styles.compactTableHeaderText, { width: 40 }]}>Shp</Text>
                <Text style={[styles.compactTableHeaderText, { width: 45 }]}>Sieve</Text>
                <Text style={[styles.compactTableHeaderText, { width: 45 }]}>Wt</Text>
                <Text style={[styles.compactTableHeaderText, { width: 40 }]}>Pcs</Text>
                <Text style={[styles.compactTableHeaderText, { width: 45 }]}>CtWt</Text>
                <Text style={[styles.compactTableHeaderText, { width: 50 }]}>$/Ct</Text>
                <Text style={[styles.compactTableHeaderText, { width: 10 }]}></Text>
              </View>
              
              {/* Body */}
              <ScrollView style={styles.compactTableBody} nestedScrollEnabled>
                {editableStones.map((stone, i) => (
                  <View key={i} style={styles.compactTableRowWrapper}>
                    <TouchableOpacity
                      style={styles.compactTableRow}
                      onPress={() => { setEditingStoneIndex(i); setEditModalVisible(true); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.compactTableCell, { width: 45 }]}>{stone.MmSize || '-'}</Text>
                      <Text style={[styles.compactTableCell, { width: 40 }]}>{stone.Color || '-'}</Text>
                      <Text style={[styles.compactTableCell, { width: 40 }]}>{stone.Shape || '-'}</Text>
                      <Text style={[styles.compactTableCell, { width: 45 }]}>{stone.SieveSize || '-'}</Text>
                      <Text style={[styles.compactTableCell, { width: 45 }]}>{stone.Weight ?? 0}</Text>
                      <Text style={[styles.compactTableCell, { width: 40 }]}>{stone.Pcs ?? 0}</Text>
                      <Text style={[styles.compactTableCell, { width: 45 }]}>{stone.CtWeight ?? 0}</Text>
                      <Text style={[styles.compactTableCell, { width: 50, color: (!stone.Price || parseFloat(stone.Price) <= 0) ? colors.error : colors.textPrimary, fontFamily: (!stone.Price || parseFloat(stone.Price) <= 0) ? fonts.bold : fonts.regular }]}>{stone.Price ?? 0}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.deleteIconButton} 
                      onPress={() => deleteStone(i)}
                    >
                      <Icon name="delete" size={14} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
            <TouchableOpacity style={styles.addStoneButton} onPress={addStone}>
              <Icon name="add" size={18} color={colors.textWhite} />
              <Text style={styles.addStoneButtonText}>Add Stone</Text>
            </TouchableOpacity>

            {/* ---- Metal ---- */}
            {editableMetal && (
              <>
                <Text style={styles.subSectionTitle}>Metal</Text>
                <View style={styles.chargesRow}>
                  <View style={styles.chargeField}>
                    <Text style={styles.fieldLabel}>Weight (g)</Text>
                    <TextInput style={styles.fieldInput} keyboardType="decimal-pad" value={String(editableMetal.Weight || 0)} onChangeText={v => setEditableMetal(p => ({ ...p, Weight: v }))} />
                  </View>
                  <View style={styles.chargeField}>
                    <Text style={styles.fieldLabel}>Quality</Text>
                    <TextInput style={styles.fieldInput} value={editableMetal.Quality || ''} onChangeText={v => setEditableMetal(p => ({ ...p, Quality: v }))} />
                  </View>
                  <View style={styles.chargeField}>
                    <Text style={[styles.fieldLabel, (!editableMetal.Rate || parseFloat(editableMetal.Rate) <= 0) && styles.fieldLabelError]}>Rate ($/g) *</Text>
                    <TextInput 
                      style={[styles.fieldInput, (!editableMetal.Rate || parseFloat(editableMetal.Rate) <= 0) && styles.fieldInputError]} 
                      keyboardType="decimal-pad" 
                      value={String(editableMetal.Rate || 0)} 
                      onChangeText={v => setEditableMetal(p => ({ ...p, Rate: v }))} 
                    />
                    {(!editableMetal.Rate || parseFloat(editableMetal.Rate) <= 0) && (
                      <Text style={styles.errorText}>Required</Text>
                    )}
                  </View>
                </View>
              </>
            )}

            {/* ---- Charges ---- */}
            {editableCharges && (
              <>
                <Text style={styles.subSectionTitle}>Charges & Duties</Text>
                <View style={styles.chargesRow}>
                  <View style={styles.chargeField}>
                    <Text style={styles.fieldLabel}>Loss (%)</Text>
                    <TextInput style={styles.fieldInput} keyboardType="decimal-pad" value={String(editableCharges.Loss || 0)} onChangeText={v => setEditableCharges(p => ({ ...p, Loss: v }))} />
                  </View>
                  <View style={styles.chargeField}>
                    <Text style={styles.fieldLabel}>Labour ($/g)</Text>
                    <TextInput style={styles.fieldInput} keyboardType="decimal-pad" value={String(editableCharges.Labour || 0)} onChangeText={v => setEditableCharges(p => ({ ...p, Labour: v }))} />
                  </View>
                  <View style={styles.chargeField}>
                    <Text style={styles.fieldLabel}>Extra (%)</Text>
                    <TextInput style={styles.fieldInput} keyboardType="decimal-pad" value={String(editableCharges.ExtraCharges || 0)} onChangeText={v => setEditableCharges(p => ({ ...p, ExtraCharges: v }))} />
                  </View>
                  <View style={styles.chargeField}>
                    <Text style={styles.fieldLabel}>Undercut ($/ct)</Text>
                    <TextInput style={styles.fieldInput} keyboardType="decimal-pad" value={String(editableCharges.UndercutPrice || 0)} onChangeText={v => setEditableCharges(p => ({ ...p, UndercutPrice: v }))} />
                  </View>
                </View>
              </>
            )}

            {/* ---- Pricing Summary ---- */}
            {pricingResult && (
              <>
                <Text style={styles.subSectionTitle}>Pricing Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Metal Price</Text>
                  <Text style={styles.summaryValue}>${(pricingResult.MetalPrice || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Diamonds Price</Text>
                  <Text style={styles.summaryValue}>${(pricingResult.DiamondsPrice || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Duties Amount</Text>
                  <Text style={styles.summaryValue}>${(pricingResult.DutiesAmount || 0).toFixed(2)}</Text>
                </View>
                
                {/* Show applicable duties */}
                {pricingResult.Applicable && (
                  <View style={styles.dutiesContainer}>
                    <Text style={styles.dutiesTitle}>Applicable Duties:</Text>
                    {Object.entries(pricingResult.Applicable).map(([key, value]) => (
                      value && (
                        <View key={key} style={styles.dutyRow}>
                          <Icon name="check-circle" size={14} color={colors.success} />
                          <Text style={styles.dutyText}>{key.replace(/([A-Z])/g, ' $1').trim()}</Text>
                        </View>
                      )
                    ))}
                  </View>
                )}
                
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total Price</Text>
                  <Text style={styles.totalValue}>${(pricingResult.TotalPrice || 0).toFixed(2)}</Text>
                </View>
                
                {/* Show client charges */}
                {pricingResult.Client && (
                  <View style={styles.clientChargesContainer}>
                    <Text style={styles.clientChargesTitle}>Client Charges Applied:</Text>
                    <View style={styles.chargeDetailRow}>
                      <Text style={styles.chargeDetailLabel}>Loss:</Text>
                      <Text style={styles.chargeDetailValue}>{pricingResult.Client.Loss || 0}%</Text>
                    </View>
                    <View style={styles.chargeDetailRow}>
                      <Text style={styles.chargeDetailLabel}>Labour:</Text>
                      <Text style={styles.chargeDetailValue}>${pricingResult.Client.Labour || 0}/g</Text>
                    </View>
                    <View style={styles.chargeDetailRow}>
                      <Text style={styles.chargeDetailLabel}>Extra Charges:</Text>
                      <Text style={styles.chargeDetailValue}>{pricingResult.Client.ExtraCharges || 0}%</Text>
                    </View>
                    {pricingResult.Client.UndercutPrice > 0 && (
                      <View style={styles.chargeDetailRow}>
                        <Text style={styles.chargeDetailLabel}>Undercut Price:</Text>
                        <Text style={styles.chargeDetailValue}>${pricingResult.Client.UndercutPrice || 0}/ct</Text>
                      </View>
                    )}
                  </View>
                )}
                
                <View style={styles.actionButtonRow}>
                  <TouchableOpacity 
                    style={[styles.recalcButton, !canRecalculate && styles.recalcButtonDisabled]} 
                    onPress={handleRecalculate} 
                    disabled={isRecalculating || !canRecalculate}
                  >
                    {isRecalculating ? (
                      <ActivityIndicator size="small" color={colors.textWhite} />
                    ) : (
                      <>
                        <Text style={styles.actionButtonText}>Recalculate</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                {!canRecalculate && (
                  <View style={styles.validationWarning}>
                    <Icon name="warning" size={16} color={colors.warning} />
                    <Text style={styles.validationWarningText}>
                      Please fill metal rate and all stone prices before recalculating
                    </Text>
                  </View>
                )}
              </>
            )}
          </Card>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {imageData && pricingResult ? (
          <View style={styles.footerActions}>
            <TouchableOpacity style={[styles.footerRecalcBtn, !canRecalculate && styles.recalcButtonDisabled]} onPress={handleRecalculate} disabled={isRecalculating || !canRecalculate}>
              {isRecalculating ? (
                <ActivityIndicator size="small" color={colors.textWhite} />
              ) : (
                <>
                  <Icon name="refresh" size={20} color={colors.textWhite} />
                  <Text style={styles.calculateButtonText}>Recalculate</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerShareBtn} onPress={handleSharePDF}>
              <Icon name="share" size={20} color={colors.textWhite} />
              <Text style={styles.calculateButtonText}>Share</Text>
            </TouchableOpacity>
            {/* <TouchableOpacity style={styles.footerExportBtn} onPress={handleExportDownload}>
              <Icon name="file-download" size={20} color={colors.textWhite} />
              <Text style={styles.calculateButtonText}>Export</Text>
            </TouchableOpacity> */}
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => handleCalculate()}
            disabled={isCalculating || isExtracting || isImageLoading || !imageData}
            style={[
              styles.calculateButton,
              (isCalculating || isExtracting || isImageLoading || !imageData) && styles.calculateButtonDisabled,
            ]}
            activeOpacity={0.8}
          >
            <Icon name="calculate" size={20} color={colors.textWhite} />
            <Text style={styles.calculateButtonText}>
              {isCalculating ? 'Calculating...' : isExtracting || isImageLoading ? 'Extracting...' : 'Calculate'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={showAllPricesModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAllPricesModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAllPricesModal(false)}
        >
          <View style={styles.pricesModalContent}>
            <Text style={styles.pricesModalTitle}>Current Metal Prices</Text>
            <ScrollView style={styles.pricesList}>
              {metalPricesData?.prices ? (
                Object.entries(metalPricesData.prices).map(([metal, data]) => (
                  <View key={metal} style={styles.priceRow}>
                    <Text style={styles.priceMetal}>{metal.charAt(0).toUpperCase() + metal.slice(1)}</Text>
                    <Text style={styles.priceValue}>${data?.price?.toFixed(2)} / {data?.unit || 'g'}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noPricesText}>No prices available</Text>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.closePricesButton}
              onPress={() => setShowAllPricesModal(false)}
            >
              <Text style={styles.closePricesButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ---- Edit Stone Modal ---- */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>
                Edit Stone {editingStoneIndex !== null ? editingStoneIndex + 1 : ''}
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Icon name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {editingStoneIndex !== null && (() => {
                const stone = editableStones[editingStoneIndex];
                if (!stone) return null;
                return (
                  <View style={styles.editModalFields}>
                    <View style={styles.editFieldRow}>
                      <View style={styles.editFieldHalf}>
                        <Text style={styles.editFieldLabel}>MM</Text>
                        <TextInput style={styles.editFieldInput} value={stone.MmSize} onChangeText={v => updateStone(editingStoneIndex, 'MmSize', v)} />
                      </View>
                      <View style={styles.editFieldHalf}>
                        <Text style={styles.editFieldLabel}>Color</Text>
                        <TextInput style={styles.editFieldInput} value={stone.Color} onChangeText={v => updateStone(editingStoneIndex, 'Color', v)} />
                      </View>
                    </View>
                    <View style={styles.editFieldRow}>
                      <View style={styles.editFieldHalf}>
                        <Text style={styles.editFieldLabel}>Shape</Text>
                        <TextInput style={styles.editFieldInput} value={stone.Shape} onChangeText={v => updateStone(editingStoneIndex, 'Shape', v)} />
                      </View>
                      <View style={styles.editFieldHalf}>
                        <Text style={styles.editFieldLabel}>Sieve</Text>
                        <TextInput style={styles.editFieldInput} value={stone.SieveSize} onChangeText={v => updateStone(editingStoneIndex, 'SieveSize', v)} />
                      </View>
                    </View>
                    <View style={styles.editFieldRow}>
                      <View style={styles.editFieldHalf}>
                        <Text style={styles.editFieldLabel}>Avg Wt</Text>
                        <TextInput style={styles.editFieldInput} keyboardType="decimal-pad" value={String(stone.Weight ?? 0)} onChangeText={v => updateStone(editingStoneIndex, 'Weight', v)} />
                      </View>
                      <View style={styles.editFieldHalf}>
                        <Text style={styles.editFieldLabel}>Pcs</Text>
                        <TextInput style={styles.editFieldInput} keyboardType="number-pad" value={String(stone.Pcs ?? 0)} onChangeText={v => updateStone(editingStoneIndex, 'Pcs', v)} />
                      </View>
                    </View>
                    <View style={styles.editFieldRow}>
                      <View style={styles.editFieldHalf}>
                        <Text style={styles.editFieldLabel}>Ct Wt</Text>
                        <TextInput style={styles.editFieldInput} keyboardType="decimal-pad" value={String(stone.CtWeight ?? 0)} onChangeText={v => updateStone(editingStoneIndex, 'CtWeight', v)} />
                      </View>
                      <View style={styles.editFieldHalf}>
                        <Text style={styles.editFieldLabel}>Markup</Text>
                        <TextInput style={styles.editFieldInput} keyboardType="decimal-pad" value={String(stone.Markup ?? 0)} onChangeText={v => updateStone(editingStoneIndex, 'Markup', v)} />
                      </View>
                    </View>
                    <View style={styles.editFieldRow}>
                      <View style={styles.editFieldFull}>
                        <Text style={[styles.editFieldLabel, (!stone.Price || parseFloat(stone.Price) <= 0) && styles.fieldLabelError]}>$/Ct *</Text>
                        <TextInput 
                          style={[styles.editFieldInput, (!stone.Price || parseFloat(stone.Price) <= 0) && styles.fieldInputError]} 
                          keyboardType="decimal-pad" 
                          value={String(stone.Price ?? 0)} 
                          onChangeText={v => updateStone(editingStoneIndex, 'Price', v)} 
                        />
                        {(!stone.Price || parseFloat(stone.Price) <= 0) && (
                          <Text style={styles.errorText}>Required</Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })()}
            </ScrollView>
            <TouchableOpacity style={styles.editModalSaveButton} onPress={() => setEditModalVisible(false)}>
              <Text style={styles.editModalSaveText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BrandedAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    padding: 20,
    borderRadius: 12,
  },
  title: {
    fontSize: fonts.xl,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  label: {
    fontSize: fonts.md,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  extraText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: colors.background,
  },
  dropdownText: {
    fontSize: fonts.md,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  placeholderText: {
    color: colors.textLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 12,
    minWidth: 250,
    maxWidth: '80%',
    maxHeight: '60%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight || colors.border,
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
  uploadArea: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface || colors.backgroundSecondary,
    minHeight: 120,
  },
  uploadText: {
    fontSize: fonts.md,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    marginTop: 8,
  },
  uploadSubText: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  previewImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
  },
  fileName: {
    flex: 1,
    marginHorizontal: 10,
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  calculateButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 8,
    height: 50,
  },
  calculateButtonDisabled: {
    opacity: 0.6,
  },
  calculateButtonText: {
    color: colors.textWhite,
    fontFamily: fonts.bold,
    fontSize: fonts.md,
  },
  pricesModalContent: {
    backgroundColor: colors.background,
    borderRadius: 12,
    width: '80%',
    maxHeight: '60%',
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  pricesModalTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  pricesList: {
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight || colors.border,
  },
  priceMetal: {
    fontSize: fonts.md,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  priceValue: {
    fontSize: fonts.md,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  noPricesText: {
    fontSize: fonts.md,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  closePricesButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closePricesButtonText: {
    color: colors.textWhite,
    fontFamily: fonts.bold,
    fontSize: fonts.md,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  footerRecalcBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 6,
    paddingVertical:10,
    paddingHorizontal:20
  },
  footerShareBtn: {
    
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 6,
     paddingVertical:10,
    paddingHorizontal:20
  },
  footerExportBtn: {
    
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 6,
     paddingVertical:10,
    paddingHorizontal:20
  },

  // ---- Results Form Styles ----
  sectionTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  subSectionTitle: {
    fontSize: fonts.md,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 10,
  },
  stoneRow: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  stoneRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stoneRowLabel: {
    fontSize: fonts.sm,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  stoneFieldsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stoneField: {
    width: '30%',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  addStoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: 4,
  },
  addStoneButtonText: {
    color: colors.textWhite,
    fontFamily: fonts.medium,
    fontSize: fonts.sm,
  },
  chargesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chargeField: {
    width: '46%',
    marginBottom: 10,
  },
  summaryContainer: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight || colors.border,
  },
  summaryLabel: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: fonts.sm,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  totalRow: {
    borderBottomWidth: 0,
    marginTop: 4,
    paddingVertical: 10,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 6,
    paddingHorizontal: 8,
  },
  totalLabel: {
    fontSize: fonts.md,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: fonts.md,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  actionButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  recalcButton: {
    flex: 1,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  recalcButtonDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.5,
  },
  whatsappButton: {
    flex: 1,
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  pdfButton: {
    flex: 1,
    backgroundColor: '#E74C3C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: colors.textWhite,
    fontFamily: fonts.bold,
    fontSize: fonts.sm,
  },

  // ---- Compact Table Styles (No Horizontal Scroll) ----
  compactTableWrapper: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.background,
    marginHorizontal: -20,
    marginVertical: 10,
  },
  compactTableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 10,
  },
  compactTableHeaderText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.textWhite,
    textAlign: 'center',
  },
  compactTableBody: {
    maxHeight: 300,
  },
  compactTableRowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight || colors.border,
    backgroundColor: colors.background,
  },
  compactTableRow: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
  },
  deleteIconButton: {
    width: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactTableCell: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    textAlign: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dutiesContainer: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  dutiesTitle: {
    fontSize: fonts.sm,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  dutyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  dutyText: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  clientChargesContainer: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  clientChargesTitle: {
    fontSize: fonts.sm,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  chargeDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  chargeDetailLabel: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  chargeDetailValue: {
    fontSize: fonts.xs,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },

  // ---- Edit Modal Styles ----
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  editModalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingBottom: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  editModalTitle: {
    fontSize: fonts.md,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  editModalFields: {
    padding: 16,
  },
  editFieldRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  editFieldHalf: {
    flex: 1,
  },
  editFieldFull: {
    flex: 1,
  },
  editFieldLabel: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  editFieldInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundSecondary,
  },
  editModalSaveButton: {
    marginHorizontal: 16,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  editModalSaveText: {
    color: colors.textWhite,
    fontFamily: fonts.bold,
    fontSize: fonts.md,
  },
  fieldLabelError: {
    color: colors.error,
  },
  fieldInputError: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  errorText: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.error,
    marginTop: 2,
  },
  validationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  validationWarningText: {
    flex: 1,
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: '#E65100',
  },
});