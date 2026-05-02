import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TopNavbar from '../../components/common/TopNavbar';
import CatalogFlowProgressBar from '../../components/client/CatalogFlowProgressBar';
import CatalogBottomTabs from '../../navigation/CatalogBottomTabs';
import { colors } from '../../constants/colors';

const CatalogShellScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <TopNavbar navigation={navigation} />
      <CatalogFlowProgressBar />
      <CatalogBottomTabs />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
});

export default CatalogShellScreen;
