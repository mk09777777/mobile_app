import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';

const screenWidth = Dimensions.get('window').width;
const chartWidth = screenWidth - 64; // Account for padding

const MetalPriceHistoryChart = ({ historyData, metalType = 'gold' }) => {
  // Process history data for the chart
  const chartData = useMemo(() => {
    if (!historyData || !Array.isArray(historyData) || historyData.length === 0) {
      return {
        labels: [],
        datasets: [
          {
            data: [],
            color: (opacity = 1) => `rgba(184, 134, 11, ${opacity})`, // Gold color
            strokeWidth: 2,
          },
        ],
      };
    }

    // Sort by date (oldest first for chart)
    const sortedData = [...historyData].sort((a, b) => {
      const dateA = new Date(a.date || a.Date || 0);
      const dateB = new Date(b.date || b.Date || 0);
      return dateA - dateB;
    });

    // Limit to last 30 entries for better readability
    const recentData = sortedData.slice(-30);

    // Format labels (show date in MM/DD format)
    const labels = recentData.map((item) => {
      const date = new Date(item.date || item.Date);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${month}/${day}`;
    });

    // Extract prices
    const prices = recentData.map((item) =>
      parseFloat(item.price || item.Price || 0)
    );

    // Determine color based on metal type
    const getColor = (opacity = 1) => {
      switch (metalType.toLowerCase()) {
        case 'gold':
          return `rgba(184, 134, 11, ${opacity})`; // Gold
        case 'silver':
          return `rgba(192, 192, 192, ${opacity})`; // Silver
        case 'platinum':
          return `rgba(229, 228, 226, ${opacity})`; // Platinum
        default:
          return `rgba(184, 134, 11, ${opacity})`;
      }
    };

    return {
      labels: labels.length > 10 ? labels.filter((_, i) => i % Math.ceil(labels.length / 10) === 0) : labels,
      datasets: [
        {
          data: prices,
          color: getColor,
          strokeWidth: 3,
        },
      ],
    };
  }, [historyData, metalType]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!historyData || !Array.isArray(historyData) || historyData.length === 0) {
      return { min: 0, max: 0, current: 0, change: 0, changePercent: 0 };
    }

    const sortedData = [...historyData].sort((a, b) => {
      const dateA = new Date(a.date || a.Date || 0);
      const dateB = new Date(b.date || b.Date || 0);
      return dateA - dateB;
    });

    const prices = sortedData.map((item) => parseFloat(item.price || item.Price || 0));
    const current = prices[prices.length - 1] || 0;
    const previous = prices.length > 1 ? prices[prices.length - 2] : current;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const change = current - previous;
    const changePercent = previous > 0 ? ((change / previous) * 100) : 0;

    return { min, max, current, change, changePercent };
  }, [historyData]);

  if (!historyData || !Array.isArray(historyData) || historyData.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No price history available for {metalType.charAt(0).toUpperCase() + metalType.slice(1)}</Text>
        <Text style={styles.emptySubtext}>Add price entries to see the chart</Text>
      </View>
    );
  }

  const metalColor = metalType.toLowerCase() === 'gold'
    ? 'rgba(184, 134, 11, 1)'
    : metalType.toLowerCase() === 'silver'
      ? 'rgba(192, 192, 192, 1)'
      : 'rgba(229, 228, 226, 1)';

  // Format currency as USD
  const formatUSD = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <View style={styles.container}>
      {/* Statistics Row */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Current</Text>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {formatUSD(stats.current)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Min</Text>
          <Text style={[styles.statValue, { color: colors.textSecondary }]}>
            {formatUSD(stats.min)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Max</Text>
          <Text style={[styles.statValue, { color: colors.textSecondary }]}>
            {formatUSD(stats.max)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Change</Text>
          <Text style={[
            styles.statValue,
            { color: stats.change >= 0 ? colors.success : colors.error }
          ]}>
            {stats.change >= 0 ? '+' : ''}{formatUSD(stats.change)} ({stats.changePercent >= 0 ? '+' : ''}{stats.changePercent.toFixed(2)}%)
          </Text>
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        <LineChart
          data={chartData}
          width={chartWidth}
          height={220}
          chartConfig={{
            backgroundColor: colors.background,
            backgroundGradientFrom: colors.background,
            backgroundGradientTo: colors.backgroundSecondary,
            decimalPlaces: 0,
            color: (opacity = 1) => metalColor,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: 16,
            },
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: metalColor,
            },
            propsForBackgroundLines: {
              strokeDasharray: '', // solid lines
              stroke: colors.border,
              strokeWidth: 1,
            },
          }}
          bezier
          style={styles.chart}
          withVerticalLabels={true}
          withHorizontalLabels={true}
          withInnerLines={true}
          withOuterLines={true}
          withDots={true}
          withShadow={false}
          segments={4}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: fonts.sm,
    fontFamily: fonts.bold,
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: fonts.base,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
});

export default MetalPriceHistoryChart;

