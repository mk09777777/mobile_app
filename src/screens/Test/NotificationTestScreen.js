/**
 * Notification Test Screen
 * 
 * Test screen to verify notification navigation for all notification types.
 * 
 * Usage:
 * 1. Navigate to this screen from Test menu or add to StackNavigator
 * 2. Tap any test button to simulate a notification
 * 3. Verify the app navigates to the correct screen
 * 4. Check console logs for navigation details
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Button } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { Heading, BodyText } from '../../components/common/Text';
import { navigateFromNotification } from '../../utils/notificationNavigation';

const NotificationTestScreen = ({ navigation }) => {
  const [lastTest, setLastTest] = useState(null);

  // Real IDs for testing
  const REAL_IDS = {
    enquiryIds: [
      '688c68cef4c6b085221fd3cd',
      '688dd1f335a47c27a20ac857',
      '68a2ed0157ce9d1a41c7f9cb',
    ],
    chatIds: [
      '691606401589b83595d823ff',
      '691606401589b83595d82402',
      '691619571589b83595d82482',
    ],
    clientIds: [
      '6871535a0798b31bfa7fe5e4',
      '687153c50798b31bfa7fe5e5',
      '687153fc0798b31bfa7fe5e6',
    ],
  };

  const triggerNotification = (testName, notificationData) => {
    try {
      setLastTest(testName);
      console.log(`[Notification Test] Testing: ${testName}`);
      console.log(`[Notification Test] Data:`, JSON.stringify(notificationData, null, 2));
      
      // Simulate notification data format
      const remoteMessage = {
        data: notificationData,
      };
      
      // Trigger navigation
      navigateFromNotification(remoteMessage);
      
      Alert.alert(
        'Test Notification Triggered',
        `Testing: ${testName}\n\n✅ Using real IDs - Navigation and data should work correctly.\n\nCheck if navigation occurred correctly.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error(`[Notification Test] Error:`, error);
      Alert.alert('Test Error', error.message);
    }
  };

  const testCases = [
    // Enquiry Notifications
    {
      category: 'Enquiry Notifications',
      tests: [
        {
          name: 'Enquiry Created (Link)',
          description: 'Navigate to single enquiry screen',
          data: {
            link: `enquiries/${REAL_IDS.enquiryIds[0]}`,
            type: 'enquiry_created',
            enquiryId: REAL_IDS.enquiryIds[0],
          },
        },
        {
          name: 'Enquiry Assigned (Link)',
          description: 'Navigate to single enquiry screen',
          data: {
            link: `enquiries/${REAL_IDS.enquiryIds[1]}`,
            type: 'enquiry_assigned',
            enquiryId: REAL_IDS.enquiryIds[1],
          },
        },
        {
          name: 'Enquiry Updated (Link)',
          description: 'Navigate to single enquiry screen',
          data: {
            link: `enquiries/${REAL_IDS.enquiryIds[2]}`,
            type: 'enquiry_updated',
            enquiryId: REAL_IDS.enquiryIds[2],
          },
        },
        {
          name: 'Enquiry (Type-based)',
          description: 'Navigate using type field only',
          data: {
            type: 'enquiry',
            enquiryId: REAL_IDS.enquiryIds[0],
          },
        },
        {
          name: 'Enquiries List',
          description: 'Navigate to enquiries tab',
          data: {
            link: 'enquiries',
          },
        },
      ],
    },
    // Chat Notifications
    {
      category: 'Chat Notifications',
      tests: [
        {
          name: 'Chat Message (Link)',
          description: 'Navigate to chat detail screen',
          data: {
            link: `chats/${REAL_IDS.chatIds[0]}`,
            type: 'new_message',
            chatId: REAL_IDS.chatIds[0],
            enquiryId: REAL_IDS.enquiryIds[0],
            chatType: 'admin-client',
          },
        },
        {
          name: 'Chat (Type-based)',
          description: 'Navigate using type field',
          data: {
            type: 'chat',
            chatId: REAL_IDS.chatIds[1],
            enquiryId: REAL_IDS.enquiryIds[1],
            chatType: 'client',
          },
        },
        {
          name: 'Chat Groups',
          description: 'Navigate to chat groups screen',
          data: {
            link: 'chat-groups',
          },
        },
        {
          name: 'Chat without chatId',
          description: 'Navigate to chats tab (fallback)',
          data: {
            type: 'chat',
            enquiryId: REAL_IDS.enquiryIds[0],
          },
        },
      ],
    },
    // Design Notifications
    {
      category: 'Design Notifications',
      tests: [
        {
          name: 'Design Uploaded (Link)',
          description: 'Navigate to design viewer',
          data: {
            link: `designs/${REAL_IDS.enquiryIds[0]}`,
            type: 'asset_upload',
            enquiryId: REAL_IDS.enquiryIds[0],
            designType: 'cad',
          },
        },
        {
          name: 'Design (Type-based)',
          description: 'Navigate using type field',
          data: {
            type: 'design_uploaded',
            enquiryId: REAL_IDS.enquiryIds[1],
            designType: 'coral',
          },
        },
        {
          name: 'Design with Version',
          description: 'Navigate to specific design version',
          data: {
            link: `designs/${REAL_IDS.enquiryIds[2]}`,
            enquiryId: REAL_IDS.enquiryIds[2],
            designType: 'cad',
            versionIndex: '1',
          },
        },
      ],
    },
    // Pricing Notifications
    {
      category: 'Pricing Notifications',
      tests: [
        {
          name: 'Pricing Update (Link)',
          description: 'Navigate to pricing screen',
          data: {
            link: `pricing/${REAL_IDS.enquiryIds[0]}`,
            type: 'pricing_update',
            enquiryId: REAL_IDS.enquiryIds[0],
            designType: 'coral',
          },
        },
        {
          name: 'Pricing (Type-based)',
          description: 'Navigate using type field',
          data: {
            type: 'pricing',
            enquiryId: REAL_IDS.enquiryIds[1],
            designType: 'cad',
          },
        },
      ],
    },
    // Client Notifications
    {
      category: 'Client Notifications',
      tests: [
        {
          name: 'Client Updated (Link)',
          description: 'Navigate to client pricing',
          data: {
            link: `clients/${REAL_IDS.clientIds[0]}`,
            type: 'client_updated',
            clientId: REAL_IDS.clientIds[0],
            clientName: 'Client Company',
          },
        },
        {
          name: 'Clients List',
          description: 'Navigate to clients list',
          data: {
            link: 'clients',
          },
        },
        {
          name: 'Create Client',
          description: 'Navigate to create client screen',
          data: {
            link: 'create-client',
          },
        },
        {
          name: 'Client (Type-based)',
          description: 'Navigate using type field',
          data: {
            type: 'client',
            clientId: REAL_IDS.clientIds[1],
            clientName: 'Client Company',
          },
        },
        {
          name: 'Client without clientId',
          description: 'Navigate to clients list (fallback)',
          data: {
            type: 'client',
          },
        },
      ],
    },
    // Other Notifications
    {
      category: 'Other Notifications',
      tests: [
        {
          name: 'Metal Prices',
          description: 'Navigate to metal prices screen',
          data: {
            link: 'metal-prices',
            type: 'metal_price_update',
          },
        },
        {
          name: 'Dashboard',
          description: 'Navigate to dashboard tab',
          data: {
            link: 'dashboard',
          },
        },
        {
          name: 'Notifications Screen',
          description: 'Navigate to notifications screen',
          data: {
            link: 'notifications',
          },
        },
        {
          name: 'No Link/Type (Fallback)',
          description: 'Should navigate to notifications screen',
          data: {
            someField: 'someValue',
          },
        },
        {
          name: 'Invalid Link (Fallback)',
          description: 'Should navigate to notifications screen',
          data: {
            link: 'invalid/path',
          },
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Heading style={styles.title}>Notification Navigation Test</Heading>
        <BodyText style={styles.description}>
          Tap any button below to simulate a notification and verify navigation.
          Check the console for detailed logs.
        </BodyText>

        <View style={styles.successSection}>
          <Text style={styles.successTitle}>✅ Using Real IDs</Text>
          <Text style={styles.successText}>
            This test uses real IDs from your database.{'\n\n'}
            • ✅ Navigation will work correctly{'\n'}
            • ✅ Data should load successfully{'\n'}
            • ✅ No "Internal server error" expected{'\n\n'}
            All test cases use actual enquiry, chat, and client IDs.
          </Text>
        </View>

        {lastTest && (
          <View style={styles.lastTestSection}>
            <Text style={styles.lastTestText}>
              Last Test: <Text style={styles.lastTestName}>{lastTest}</Text>
            </Text>
          </View>
        )}

        {testCases.map((category, categoryIndex) => (
          <View key={categoryIndex} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category.category}</Text>
            {category.tests.map((test, testIndex) => (
              <View key={testIndex} style={styles.testItem}>
                <Text style={styles.testTitle}>{test.name}</Text>
                <Text style={styles.testDescription}>{test.description}</Text>
                <View style={styles.dataPreview}>
                  <Text style={styles.dataLabel}>Data:</Text>
                  <Text style={styles.dataText}>
                    {JSON.stringify(test.data, null, 2)}
                  </Text>
                </View>
                <Button
                  title={`Test: ${test.name}`}
                  onPress={() => triggerNotification(test.name, test.data)}
                  variant="primary"
                  style={styles.button}
                />
              </View>
            ))}
          </View>
        ))}

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Testing Instructions:</Text>
          <Text style={styles.infoText}>
            1. Tap any test button above{'\n'}
            2. ✅ Check if app navigates to correct screen{'\n'}
            3. ✅ Verify data loads correctly (enquiry, chat, client details){'\n'}
            4. ✅ No errors should appear - using real IDs{'\n'}
            5. Check console logs for navigation details{'\n'}
            6. Test with app in foreground, background, and killed states
          </Text>
        </View>

        <View style={styles.noteSection}>
          <Text style={styles.noteText}>
            💡 Tip: Test with real notifications from backend for complete verification
          </Text>
        </View>

        <View style={styles.actionButtons}>
          <Button
            title="Get FCM Token"
            onPress={() => navigation.navigate('GetFCMToken')}
            variant="primary"
            style={styles.actionButton}
          />
          <Button
            title="Go Back"
            onPress={() => navigation.goBack()}
            variant="secondary"
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: fonts.xl,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: fonts.md,
    color: colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  lastTestSection: {
    backgroundColor: colors.success + '20',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  lastTestText: {
    fontSize: fonts.sm,
    color: colors.textSecondary,
  },
  lastTestName: {
    fontFamily: fonts.bold,
    color: colors.success,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.primary,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  testItem: {
    backgroundColor: colors.backgroundSecondary,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  testTitle: {
    fontSize: fonts.md,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  testDescription: {
    fontSize: fonts.sm,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  dataPreview: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dataLabel: {
    fontSize: fonts.xs,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  dataText: {
    fontSize: fonts.xs,
    fontFamily: 'monospace',
    color: colors.textPrimary,
  },
  button: {
    marginTop: 4,
  },
  infoSection: {
    backgroundColor: colors.info + '10',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
  },
  infoTitle: {
    fontSize: fonts.md,
    fontFamily: fonts.bold,
    color: colors.info,
    marginBottom: 8,
  },
  infoText: {
    fontSize: fonts.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  noteSection: {
    backgroundColor: colors.warning + '10',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  noteText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  warningSection: {
    backgroundColor: colors.warning + '15',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  warningTitle: {
    fontSize: fonts.md,
    fontFamily: fonts.bold,
    color: colors.warning,
    marginBottom: 8,
  },
  warningText: {
    fontSize: fonts.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  successSection: {
    backgroundColor: colors.success + '15',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  successTitle: {
    fontSize: fonts.md,
    fontFamily: fonts.bold,
    color: colors.success,
    marginBottom: 8,
  },
  successText: {
    fontSize: fonts.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
  },
  backButton: {
    marginTop: 8,
  },
});

export default NotificationTestScreen;

