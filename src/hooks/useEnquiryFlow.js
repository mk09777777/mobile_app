import { useMemo } from 'react';
import {
  STATUS,
  SUBSTATUS,
  ACTION,
  DESIGN_TYPE,
  actionsFor,
  NEXT_STATE,
  resolveRoleCode,
} from '../constants/enquiry';

const ACTION_LABELS = {
  [ACTION.ASSIGN]: 'Assign',
  [ACTION.ASSIGN_CAD]: 'Assign CAD',
  [ACTION.UPLOAD_CORAL]: 'Upload Coral',
  [ACTION.UPLOAD_CAD]: 'Upload CAD',
  [ACTION.UPLOAD_FINAL_CAD]: 'Upload Final CAD',
  [ACTION.CHAT]: 'Chat',
  [ACTION.UPDATE_QUOTATION]: 'Update Quotation',
  [ACTION.REJECT_QUOTATION]: 'Reject',
  [ACTION.VIEW_QUOTATION]: 'View Quotation',
  [ACTION.MOVE_TO_APPROVAL]: 'Move to Approval Pending',
  [ACTION.ACCEPT_APPROVAL]: 'Accept',
  [ACTION.REJECT_APPROVAL]: 'Reject',
  [ACTION.FINAL_LOOK]: 'Final Look',
};

const ACTION_ICONS = {
  [ACTION.ASSIGN]: 'person-add',
  [ACTION.ASSIGN_CAD]: 'person-add',
  [ACTION.UPLOAD_CORAL]: 'cloud-upload',
  [ACTION.UPLOAD_CAD]: 'cloud-upload',
  [ACTION.UPLOAD_FINAL_CAD]: 'cloud-upload',
  [ACTION.CHAT]: 'chat',
  [ACTION.UPDATE_QUOTATION]: 'edit-note',
  [ACTION.REJECT_QUOTATION]: 'cancel',
  [ACTION.VIEW_QUOTATION]: 'picture-as-pdf',
  [ACTION.MOVE_TO_APPROVAL]: 'check-circle',
  [ACTION.ACCEPT_APPROVAL]: 'check-circle',
  [ACTION.REJECT_APPROVAL]: 'cancel',
  [ACTION.FINAL_LOOK]: 'visibility',
};

const ACTION_COLORS = {
  [ACTION.ASSIGN]: '#143F45',
  [ACTION.ASSIGN_CAD]: '#143F45',
  [ACTION.UPLOAD_CORAL]: '#143F45',
  [ACTION.UPLOAD_CAD]: '#143F45',
  [ACTION.UPLOAD_FINAL_CAD]: '#10B981',
  [ACTION.CHAT]: 'outline',
  [ACTION.UPDATE_QUOTATION]: '#F59E0B',
  [ACTION.REJECT_QUOTATION]: '#EF4444',
  [ACTION.VIEW_QUOTATION]: 'outline',
  [ACTION.MOVE_TO_APPROVAL]: '#059669',
  [ACTION.ACCEPT_APPROVAL]: '#059669',
  [ACTION.REJECT_APPROVAL]: '#EF4444',
  [ACTION.FINAL_LOOK]: 'outline',
};

export const useEnquiryFlowConfig = () => {
  const config = useMemo(() => ({
    ACTION_LABELS,
    ACTION_ICONS,
    ACTION_COLORS,
    STATUS,
    SUBSTATUS,
    ACTION,
    DESIGN_TYPE,
    NEXT_STATE,
  }), []);

  return config;
};

export const useEnquiryState = (enquiry) => {
  const status = enquiry?.CurrentStatus;
  const subStatus = enquiry?.CurrentSubStatus;

  const state = useMemo(() => {
    if (!enquiry) return null;
    return {
      status,
      subStatus,
      statusLower: (status || '').toLowerCase(),
      subStatusLower: (subStatus || '').toLowerCase(),
    };
  }, [enquiry, status, subStatus]);

  return state;
};

export const useEnquiryFlow = (enquiry, user) => {
  const roleCode = useMemo(() => resolveRoleCode(user), [user]);
  const enquiryState = useEnquiryState(enquiry);

  // If CurrentSubStatus is not set but enquiry has an assigned user,
  // treat it as "Assigned" — the backend may not persist CurrentSubStatus.
  const assignedTo = useMemo(() => enquiry?.AssignedTo || enquiry?.assignedTo, [enquiry]);
  const inferredSubStatus = useMemo(
    () => !enquiryState?.subStatus && assignedTo ? SUBSTATUS.AS : enquiryState?.subStatus,
    [enquiryState?.subStatus, assignedTo],
  );

  const config = useMemo(() => {
    if (!enquiryState || !roleCode) {
      return {
        buttons: [],
        primaryAction: null,
        actions: [],
        tab: null,
        modalPhase: null,
        assignType: null,
        actionConfigs: [],
        enquiryState: null,
        nextState: null,
        displaySubStatus: null,
      };
    }

    const miniEnquiry = {
      CurrentStatus: enquiryState.status,
      CurrentSubStatus: inferredSubStatus,
    };

    const flow = actionsFor(miniEnquiry, roleCode);
    let buttons = flow.buttons || [];

    // Check if substatus is FU (Final Cad Upload) — backend sets this after first CAD acceptance
    const isFinalCadUpload = inferredSubStatus === SUBSTATUS.FU;

    // Show Final Look in Design Approval Pending status.
    // handleAcceptApproval independently determines first-vs-final CAD cycle
    // using StatusHistory fetched via getEnquiryById.
    const src = enquiry?._originalData || enquiry;
    const cadVersions = Array.isArray(src?.Cad) ? src.Cad : [];
    const hasCadVersions = cadVersions.length > 0;
    const isDesignApprovalPending =
      enquiry?.CurrentStatus === STATUS.DESIGN_APPROVAL_PENDING ||
      enquiry?.status === 'approval_pending';
    const hasFinalCadVersion = isDesignApprovalPending
      ? true
      : cadVersions.some(v => v.IsFinalVersion === true || v.IsFinalVersion === 'true');

    // If substatus is FU, swap Upload CAD → Upload Final CAD
    if (isFinalCadUpload) {
      buttons = buttons.map(a => (a === ACTION.UPLOAD_CAD ? ACTION.UPLOAD_FINAL_CAD : a));
    }

    // Show Final Look only when a Final CAD version has been uploaded
    if (!hasFinalCadVersion) {
      buttons = buttons.filter(a => a !== ACTION.FINAL_LOOK);
    }
    const actionConfigs = (buttons || []).map(action => ({
      action,
      label: ACTION_LABELS[action] || action,
      icon: ACTION_ICONS[action] || 'help',
      color: ACTION_COLORS[action] || '#6B7280',
    }));

    const finalPrimaryAction = flow.primaryAction === ACTION.UPLOAD_CAD && hasCadVersions
      ? ACTION.UPLOAD_FINAL_CAD
      : flow.primaryAction;

    const primaryActionConfig = finalPrimaryAction
      ? {
          action: finalPrimaryAction,
          label: ACTION_LABELS[finalPrimaryAction] || finalPrimaryAction,
          icon: ACTION_ICONS[finalPrimaryAction] || 'help',
          color: ACTION_COLORS[finalPrimaryAction] || '#6B7280',
        }
      : null;

    let nextState = null;
    if (enquiryState.status && NEXT_STATE[enquiryState.status]) {
      nextState = NEXT_STATE[enquiryState.status];
    }

    return {
      buttons,
      primaryAction: finalPrimaryAction,
      actions: buttons,
      tab: flow.tab,
      modalPhase: flow.modalPhase || null,
      assignType: flow.assignType || null,
      actionConfigs,
      primaryActionConfig,
      enquiryState,
      nextState,
      displaySubStatus: inferredSubStatus,
      displayStatus: enquiryState.status,
    };
  }, [enquiryState, roleCode, inferredSubStatus]);

  return config;
};

export const getActionLabel = (action) => ACTION_LABELS[action] || action;
export const getActionIcon = (action) => ACTION_ICONS[action] || 'help';
export const getActionColor = (action) => ACTION_COLORS[action] || '#6B7280';
