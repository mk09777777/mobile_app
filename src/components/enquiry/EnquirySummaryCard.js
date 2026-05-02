import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import IconComponent from '../common/Icon';

export const isEnquiryClientUser = (user) =>
  user?.role?.toLowerCase() === 'client' ||
  user?.role === 'cl' ||
  user?.roleId === 4 ||
  user?.roleNumber === 4;

/** Shared chat CTA — use standalone on Step 2; embedded inside EnquirySummaryCard */
const enquiryChatCtaStyles = StyleSheet.create({
  wrapEmbedded: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  wrapStandalone: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  hint: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  btnText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textWhite,
    flexShrink: 1,
    textAlign: 'center',
  },
});

export const EnquiryChatCta = ({ user, onPress, visible = true, embedded = false }) => {
  if (!visible || !onPress) return null;
  const wrapStyle = embedded
    ? enquiryChatCtaStyles.wrapEmbedded
    : enquiryChatCtaStyles.wrapStandalone;
  const isClient = isEnquiryClientUser(user);
  const buttonLabel = isClient
    ? 'Have more instruction? Chat with Us'
    : 'Add additional info on chat';
  return (
    <View style={wrapStyle}>
      <TouchableOpacity
        style={enquiryChatCtaStyles.btn}
        onPress={onPress}
        activeOpacity={0.88}
      >
        <IconComponent name="chat" size={20} color={colors.textWhite} />
        <Text style={enquiryChatCtaStyles.btnText}>{buttonLabel}</Text>
      </TouchableOpacity>
    </View>
  );
};

const dash = (v) => {
  if (v === null || v === undefined) return '—';
  const s = String(v).trim();
  return s === '' ? '—' : s;
};

const formatDateSafe = (dateString) => {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return String(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(dateString);
  }
};

const formatWeightBlock = (from, to, exact) => {
  if (exact) return `${exact} g`;
  if (from && to) return `${from} – ${to} g`;
  if (from) return `From ${from} g`;
  if (to) return `Up to ${to} g`;
  return '—';
};

const SectionHeader = ({ title, icon }) => (
  <View style={styles.sectionHeaderRow}>
    {icon ? (
      <View style={styles.sectionHeaderIconWrap}>
        <IconComponent name={icon} size={16} color={colors.primary} />
      </View>
    ) : null}
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
);

const FieldBlock = ({ label, value, multiline }) => (
  <View style={styles.fieldBlock}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text
      style={[styles.fieldValue, multiline && styles.fieldValueMultiline]}
      numberOfLines={multiline ? undefined : 3}
    >
      {value}
    </Text>
  </View>
);

const FieldPair = ({ left, right }) => (
  <View style={styles.pairRow}>
    <View style={[styles.pairHalf, styles.pairHalfLeft]}>{left}</View>
    <View style={[styles.pairHalf, styles.pairHalfRight]}>{right}</View>
  </View>
);

const Pill = ({ text, variant = 'neutral' }) => {
  const pillStyles = [styles.pill];
  const textStyles = [styles.pillText];
  if (variant === 'primary') {
    pillStyles.push(styles.pillPrimary);
    textStyles.push(styles.pillTextOnPrimary);
  } else if (variant === 'accent') {
    pillStyles.push(styles.pillAccent);
    textStyles.push(styles.pillTextDark);
  }
  return (
    <View style={pillStyles}>
      <Text style={textStyles} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
};

/**
 * Professional enquiry summary for Step 2 (upload) flows.
 */
const EnquirySummaryCard = ({
  formData = {},
  user,
  getUserName,
  onChatPress,
  showChat,
  existingImagesCount,
}) => {
  const isClient = isEnquiryClientUser(user);

  const assignedLabel =
    formData.assignedToName ||
    (getUserName && formData.assignedTo
      ? getUserName(formData.assignedTo)
      : null) ||
    (formData.assignedTo ? String(formData.assignedTo) : null);

  const priorityDisplay = formData.priority
    ? `${formData.priority.charAt(0).toUpperCase()}${formData.priority.slice(1)}`
    : '—';

  const metalLine = [formData.metalColor, formData.metalQuality]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View style={styles.iconBadge}>
            <IconComponent name="assignment" size={22} color={colors.primary} />
          </View>
          <View style={styles.cardTitleTextWrap}>
            <Text style={styles.cardTitle}>Enquiry summary</Text>
            <Text style={styles.cardSubtitle}>
              Review all details before uploading references
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <SectionHeader title="Overview" icon="person" />
      <FieldBlock label="Piece name" value={dash(formData.title)} />
      <FieldPair
        left={
          <FieldBlock label="Client" value={dash(formData.clientName)} />
        }
        right={
          <FieldBlock label="Category" value={dash(formData.category)} />
        }
      />
      <FieldPair
        left={
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Status</Text>
            <Pill text={dash(formData.status)} variant="primary" />
          </View>
        }
        right={
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Priority</Text>
            <Pill text={priorityDisplay} variant="accent" />
          </View>
        }
      />
      {!isClient && (
        <FieldBlock
          label="Assigned to"
          value={dash(assignedLabel)}
        />
      )}

      <View style={styles.sectionSpacer} />
      <SectionHeader title="Product & logistics" icon="category" />
      <FieldPair
        left={
          <FieldBlock label="Quantity" value={dash(formData.quantity)} />
        }
        right={
          <FieldBlock
            label="Shipping date"
            value={formatDateSafe(formData.deadline)}
          />
        }
      />
      <FieldPair
        left={
          <FieldBlock label="Style number" value={dash(formData.styleNumber)} />
        }
        right={
          <FieldBlock
            label="Gati order no."
            value={dash(formData.GatiOrderNumber)}
          />
        }
      />
      <FieldBlock label="Stamping" value={dash(formData.stamping)} />

      <View style={styles.sectionSpacer} />
      <SectionHeader title="Materials" icon="star" />
      <FieldBlock label="Stone type" value={dash(formData.stoneType)} />
      <FieldBlock
        label="Metal"
        value={metalLine ? metalLine : '—'}
      />
      <FieldPair
        left={
          <FieldBlock
            label="Metal weight"
            value={formatWeightBlock(
              formData.metalWeightFrom,
              formData.metalWeightTo,
              formData.metalWeightExact,
            )}
          />
        }
        right={
          <FieldBlock
            label="Diamond weight"
            value={formatWeightBlock(
              formData.diamondWeightFrom,
              formData.diamondWeightTo,
              formData.diamondWeightExact,
            )}
          />
        }
      />

      <View style={styles.sectionSpacer} />
      <SectionHeader title="Commercial" icon="attach-money" />
      <FieldBlock
        label="Budget"
        value={dash(formData.budget)}
      />

      <View style={styles.sectionSpacer} />
      <SectionHeader title="Notes" icon="note" />
      {isClient ? (
        <FieldBlock
          label="Remark"
          value={dash(formData.remark || formData.description)}
          multiline
        />
      ) : (
        <>
          <FieldBlock
            label="Internal remark"
            value={dash(formData.remark)}
            multiline
          />
          <FieldBlock
            label="Special remarks"
            value={dash(formData.specialRemarks)}
            multiline
          />
          {formData.description?.trim() ? (
            <FieldBlock
              label="Remarks"
              value={dash(formData.description)}
              multiline
            />
          ) : null}
        </>
      )}
      {!isClient ? (
        <FieldBlock
          label="Approved date"
          value={formatDateSafe(formData.approvedDate)}
        />
      ) : null}

      {typeof existingImagesCount === 'number' ? (
        <>
          <View style={styles.sectionSpacer} />
          <View style={styles.mediaRow}>
            <IconComponent name="photo-library" size={18} color={colors.textSecondary} />
            <Text style={styles.mediaRowText}>
              Existing reference files:{' '}
              <Text style={styles.mediaRowCount}>{existingImagesCount}</Text>
            </Text>
          </View>
        </>
      ) : null}

      {showChat && onChatPress ? (
        <EnquiryChatCta user={user} onPress={onChatPress} visible embedded />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 18,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryExtraLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitleTextWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
    opacity: 0.9,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderIconWrap: {
    marginRight: 8,
  },
  sectionHeaderText: {
    fontSize: fonts.sm,
    fontFamily: fonts.bold,
    color: colors.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionSpacer: {
    height: 20,
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 4,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  fieldValueMultiline: {
    fontStyle: 'normal',
    color: colors.textSecondary,
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pairHalf: {
    flex: 1,
  },
  pairHalfLeft: {
    paddingRight: 6,
  },
  pairHalfRight: {
    paddingLeft: 6,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '100%',
  },
  pillPrimary: {
    backgroundColor: colors.primaryExtraLight,
    borderColor: colors.primaryLight,
  },
  pillAccent: {
    backgroundColor: '#FEF9E7',
    borderColor: colors.accent,
  },
  pillText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  pillTextOnPrimary: {
    color: colors.primary,
  },
  pillTextDark: {
    color: colors.textPrimary,
  },
  mediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  mediaRowText: {
    marginLeft: 10,
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    flex: 1,
  },
  mediaRowCount: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },
});

export default EnquirySummaryCard;
