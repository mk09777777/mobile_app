import { useCallback, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  useUpdateEnquiryMutation,
  useApproveDesignVersionMutation,
  useRejectDesignVersionMutation,
  useGetUsersQuery,
  useLazyGetEnquiryByIdQuery,
} from '../store/api';
import { STATUS, SUBSTATUS, DESIGN_TYPE, resolveRoleCode, ROLE } from '../constants/enquiry';

const getEnquiryId = (enquiry) =>
  enquiry?.Id || enquiry?._id || enquiry?.id || enquiry?._originalData?._id;

const getClientId = (enquiry) =>
  enquiry?.ClientId || enquiry?.clientId;

const getAssignedTo = (enquiry) => {
  const raw = enquiry._originalData || enquiry;
  return raw.AssignedTo || raw.assignedTo || null;
};

const ROLE_ALIAS = {
  co:  [ROLE.CO, 'coral', 'coral designer'],
  cd:  [ROLE.CD, 'cad', 'cad designer'],
};

const matchRole = (user, targetCode) => {
  const code = resolveRoleCode(user);
  if (!code) return false;
  const lower = code.toLowerCase();
  const aliases = ROLE_ALIAS[targetCode.toLowerCase()] || [targetCode];
  return aliases.some(a => lower === a.toLowerCase());
};

export const useEnquiryActions = ({ onAlert } = {}) => {
  const [alertCfg, setAlertCfg] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const hideAlert = useCallback(() => setAlertCfg(p => ({ ...p, visible: false })), []);

  const showAlert = useCallback((title, message, type = 'info', buttons = []) => {
    if (onAlert) { onAlert(title, message, type, buttons); return; }
    setAlertCfg({ visible: true, title, message, type, buttons });
  }, [onAlert]);
  const navigation = useNavigation();
  const [updateEnquiry, { isLoading: isUpdating }] = useUpdateEnquiryMutation();
  const [approveDesignVersion, { isLoading: isApproving }] = useApproveDesignVersionMutation();
  const [rejectDesignVersion, { isLoading: isRejecting }] = useRejectDesignVersionMutation();
  const [triggerGetEnquiry] = useLazyGetEnquiryByIdQuery();
  const { data: users } = useGetUsersQuery();

  const coralDesigners = useMemo(
    () => (users || []).filter(u => matchRole(u, ROLE.CO)),
    [users],
  );

  const cadDesigners = useMemo(
    () => (users || []).filter(u => matchRole(u, ROLE.CD)),
    [users],
  );

  const handleAssign = useCallback(async (enquiry, assignType, assignee, options = {}) => {
    const enquiryId = getEnquiryId(enquiry);
    const clientId = getClientId(enquiry);
    if (!enquiryId || !assignee) return null;

    const targetStatus = assignType === DESIGN_TYPE.CORAL ? STATUS.CORAL : STATUS.CAD;

    // Check whether this is a first CAD or a re-assign after a CAD cycle
    const src = enquiry?._originalData || enquiry;
    const hasExistingCad = Array.isArray(src?.Cad) && src.Cad.length > 0;
    const isFinalCadLoop = assignType === DESIGN_TYPE.CAD && hasExistingCad;

    try {
      const result = await updateEnquiry({
        id: enquiryId,
        Status: targetStatus,
        CurrentStatus: targetStatus,
        CurrentSubStatus: isFinalCadLoop ? SUBSTATUS.FU : SUBSTATUS.AS,
        AssignedTo: assignee.id,
        ClientId: clientId,
      }).unwrap();
      return result;
    } catch (e) {
      throw e;
    }
  }, [updateEnquiry]);

  const handleUpload = useCallback((enquiry, designType) => {
    const enquiryId = getEnquiryId(enquiry);
    if (!enquiryId) return;
    
    const src = enquiry?._originalData || enquiry;
    const currentSubStatus = src?.CurrentSubStatus || enquiry?.CurrentSubStatus;
    
    const isFinalVersion = designType === DESIGN_TYPE.CAD && currentSubStatus === SUBSTATUS.FU;
    
    navigation.navigate('UploadDesign', {
      enquiryId,
      designType,
      enquiry,
      isFinalVersion,
    });
  }, [navigation]);

  const handleUploadCoral = useCallback((enquiry) => {
    handleUpload(enquiry, DESIGN_TYPE.CORAL);
  }, [handleUpload]);

  const handleUploadCad = useCallback((enquiry) => {
    handleUpload(enquiry, DESIGN_TYPE.CAD);
  }, [handleUpload]);

  const handleUploadFinalCad = useCallback((enquiry) => {
    handleUpload(enquiry, DESIGN_TYPE.CAD);
  }, [handleUpload]);

  const handleChat = useCallback((enquiry) => {
    const enquiryId = getEnquiryId(enquiry);
    if (!enquiryId) return;
    navigation.navigate('ChatDetail', { enquiryId });
  }, [navigation]);

  const handleUpdateQuotation = useCallback((enquiry, onOpenQuotation) => {
    if (onOpenQuotation) {
      onOpenQuotation(enquiry);
    }
  }, []);

  const handleRejectQuotation = useCallback(async (enquiry, reason) => {
    const enquiryId = getEnquiryId(enquiry);
    if (!enquiryId || !reason?.trim()) return null;

    const src = enquiry._originalData || enquiry;
    const cadVersions = Array.isArray(src?.Cad) ? src.Cad : [];
    const coralVersions = Array.isArray(src?.Coral) ? src.Coral : [];
    const pool = [
      ...(cadVersions.length > 0 ? [{ ...cadVersions[cadVersions.length - 1], type: 'cad' }] : []),
      ...(coralVersions.length > 0 ? [{ ...coralVersions[coralVersions.length - 1], type: 'coral' }] : []),
    ];
    pool.sort((a, b) => new Date(b.CreatedDate || 0) - new Date(a.CreatedDate || 0));
    const latest = pool[0];
    if (!latest || !latest.Version) return null;

    try {
      await rejectDesignVersion({
        enquiryId,
        designType: latest.type,
        version: latest.Version,
        reason: reason.trim(),
      }).unwrap();

      const currentStatus = enquiry.CurrentStatus;
      const result = await updateEnquiry({
        id: enquiryId,
        Status: currentStatus,
        CurrentStatus: currentStatus,
        CurrentSubStatus: SUBSTATUS.RR,
        ClientId: getClientId(enquiry),
      }).unwrap();
      return result;
    } catch (e) {
      throw e;
    }
  }, [rejectDesignVersion, updateEnquiry]);

  const handleViewQuotation = useCallback((enquiry, onViewQuotation) => {
    if (onViewQuotation) {
      onViewQuotation(enquiry);
    }
  }, []);

  const handleMoveToApproval = useCallback(async (enquiry) => {
    const enquiryId = getEnquiryId(enquiry);
    if (!enquiryId) return null;

    try {
      const src = enquiry._originalData || enquiry;
      const currentSubStatus = src?.CurrentSubStatus || enquiry?.CurrentSubStatus;
      const isFinalCadCycle = currentSubStatus === SUBSTATUS.FU;

      if (isFinalCadCycle) {
        const cadVersions = Array.isArray(src?.Cad) ? src.Cad : [];
        const latestCad = cadVersions.length > 0 ? cadVersions[cadVersions.length - 1] : null;
        if (latestCad?.Version) {
          try {
            await approveDesignVersion({
              enquiryId,
              designType: 'cad',
              version: latestCad.Version,
              intent: 'final',
            }).unwrap();
          } catch (e) {
            console.warn('Failed to mark CAD version as final:', e);
          }
        }
      }

      const currentAssignedTo = getAssignedTo(enquiry);
      const result = await updateEnquiry({
        id: enquiryId,
        Status: STATUS.DESIGN_APPROVAL_PENDING,
        CurrentStatus: STATUS.DESIGN_APPROVAL_PENDING,
        CurrentSubStatus: isFinalCadCycle ? 'Final' : null,
        ClientId: getClientId(enquiry),
        ...(currentAssignedTo ? { AssignedTo: currentAssignedTo } : {}),
      }).unwrap();
      return result;
    } catch (e) {
      throw e;
    }
  }, [updateEnquiry, approveDesignVersion]);

  const handleAcceptApproval = useCallback(async (enquiry) => {
    const enquiryId = getEnquiryId(enquiry);
    if (!enquiryId) return null;

    let src2 = getLatestDesignVersion(enquiry);
    if (!src2) {
      try {
        const fullEnquiry = await triggerGetEnquiry(enquiryId).unwrap();
        src2 = getLatestDesignVersion(fullEnquiry);
      } catch {
        showAlert('Error', 'Could not fetch design version data. Please try again.', 'error', [{ text: 'OK', onPress: () => {} }]);
        return null;
      }
    }
    if (!src2) {
      showAlert('Error', 'No design version found to approve.', 'error', [{ text: 'OK', onPress: () => {} }]);
      return null;
    }

    try {
      if (src2.type === 'coral') {
        await approveDesignVersion({
          enquiryId,
          designType: 'coral',
          version: src2.version,
        }).unwrap();

        showAlert('Approved', 'Coral design approved. Assign a CAD designer to proceed.', 'success', [{ text: 'Continue', onPress: () => {} }]);
        return {
          status: 'needs_cad_assign',
          message: 'Coral approved. CAD assignment needed.',
        };
      } else {
        let freshEnquiry = enquiry;
        try {
          freshEnquiry = await triggerGetEnquiry(enquiryId).unwrap();
        } catch (e) {
          console.warn("Could not sync backend state", e);
        }

        const src = freshEnquiry?._originalData || freshEnquiry;
        const currentSubStatus = src?.CurrentSubStatus || freshEnquiry?.CurrentSubStatus;
        const isFinalCad = currentSubStatus === 'Final';

        const currentAssignedTo = getAssignedTo(freshEnquiry);
        const originalAssignedTo = getAssignedTo(enquiry);
        const assignedTo = currentAssignedTo || originalAssignedTo;

        if (isFinalCad) {
          await approveDesignVersion({
            enquiryId,
            designType: 'cad',
            version: src2.version,
            intent: 'final',
          }).unwrap();

          await updateEnquiry({
            id: enquiryId,
            Status: 'production',
            CurrentStatus: 'production',
            CurrentSubStatus: null,
            ClientId: getClientId(freshEnquiry),
            ...(assignedTo ? { AssignedTo: assignedTo } : {}),
            ApprovedDate: new Date().toISOString(),
          }).unwrap();

          showAlert('Approved', 'Final CAD approved. Moving to Production.', 'success', [{ text: 'Continue', onPress: () => {} }]);
          return { status: 'production', message: 'Final CAD approved.' };
        } else {
          const result = await updateEnquiry({
            id: enquiryId,
            Status: STATUS.CAD,
            CurrentStatus: STATUS.CAD,
            CurrentSubStatus: SUBSTATUS.FU,
            ClientId: getClientId(freshEnquiry),
            ...(assignedTo ? { AssignedTo: assignedTo } : {}),
          }).unwrap();
          showAlert('Approved', 'CAD approved. Upload the final CAD version to proceed.', 'success', [{ text: 'Continue', onPress: () => {} }]);
          return { status: 'needs_final_cad', message: 'CAD approved. Final CAD upload required.', result };
        }
      }
    } catch (e) {
      showAlert('Error', e?.data?.message || 'Failed to approve design. Please try again.', 'error', [{ text: 'OK', onPress: () => {} }]);
      return null;
    }
  }, [approveDesignVersion, updateEnquiry, triggerGetEnquiry, showAlert]);

  const handleAssignCadOnAccept = useCallback(async (enquiry, assignee) => {
    const enquiryId = getEnquiryId(enquiry);
    const clientId = getClientId(enquiry);
    if (!enquiryId) return null;

    const subStatus = assignee ? SUBSTATUS.AS : SUBSTATUS.AP;
    try {
      const payload = {
        id: enquiryId,
        Status: STATUS.CAD,
        CurrentSubStatus: subStatus,
        ClientId: clientId,
      };
      if (assignee) {
        payload.AssignedTo = assignee.id;
      }
      const result = await updateEnquiry(payload).unwrap();
      return { result, assigned: !!assignee, subStatus };
    } catch (e) {
      throw e;
    }
  }, [updateEnquiry]);

  const handleRejectApproval = useCallback(async (enquiry, reason) => {
    const enquiryId = getEnquiryId(enquiry);
    if (!enquiryId) return null;

    let latest = null;
    let src = enquiry._originalData || enquiry;
    let cadVersions = Array.isArray(src?.Cad) ? src.Cad : [];
    let coralVersions = Array.isArray(src?.Coral) ? src.Coral : [];

    if (cadVersions.length === 0 && coralVersions.length === 0) {
      try {
        const fullEnquiry = await triggerGetEnquiry(enquiryId).unwrap();
        src = fullEnquiry._originalData || fullEnquiry;
        cadVersions = Array.isArray(src?.Cad) ? src.Cad : [];
        coralVersions = Array.isArray(src?.Coral) ? src.Coral : [];
      } catch {
        // skip version rejection if arrays cannot be found
      }
    }

    const pool = [
      ...(cadVersions.length > 0 ? [{ ...cadVersions[cadVersions.length - 1], type: 'cad' }] : []),
      ...(coralVersions.length > 0 ? [{ ...coralVersions[coralVersions.length - 1], type: 'coral' }] : []),
    ];
    pool.sort((a, b) => new Date(b.CreatedDate || 0) - new Date(a.CreatedDate || 0));
    latest = pool[0];

    try {
      if (latest && latest.Version) {
        await rejectDesignVersion({
          enquiryId,
          designType: latest.type,
          version: latest.Version,
          reason: reason?.trim() || 'Rejected',
        }).unwrap();
      }

      const currentAssignedTo = getAssignedTo(enquiry);
      const result = await updateEnquiry({
        id: enquiryId,
        Status: STATUS.CAD,
        CurrentStatus: STATUS.CAD,
        CurrentSubStatus: SUBSTATUS.RR,
        ClientId: getClientId(enquiry),
        ...(currentAssignedTo ? { AssignedTo: currentAssignedTo } : {}),
      }).unwrap();
      return result;
    } catch (e) {
      throw e;
    }
  }, [rejectDesignVersion, updateEnquiry, triggerGetEnquiry]);

  const handleFinalLook = useCallback((enquiry, onFinalLook) => {
    if (onFinalLook) {
      onFinalLook(enquiry);
    }
  }, []);

  return {
    handleAssign,
    handleUploadCoral,
    handleUploadCad,
    handleUploadFinalCad,
    handleChat,
    handleUpdateQuotation,
    handleRejectQuotation,
    handleViewQuotation,
    handleMoveToApproval,
    handleAcceptApproval,
    handleAssignCadOnAccept,
    handleRejectApproval,
    handleFinalLook,
    coralDesigners,
    cadDesigners,
    isLoading: isUpdating || isApproving || isRejecting,
    isUpdating,
    isApproving,
    isRejecting,
    alertCfg,
    hideAlert,
    showAlert,
  };
};

const getLatestDesignVersion = (enquiry) => {
  const src = enquiry._originalData || enquiry;
  const cad = Array.isArray(src?.Cad) && src.Cad.length > 0
    ? src.Cad[src.Cad.length - 1]
    : null;
  const coral = Array.isArray(src?.Coral) && src.Coral.length > 0
    ? src.Coral[src.Coral.length - 1]
    : null;

  if (cad?.Version) return { type: 'cad', version: cad.Version };
  if (coral?.Version) return { type: 'coral', version: coral.Version };
  return null;
};

const ACTION_MESSAGES = {
  ASSIGN: 'Assign this designer?',
  ASSIGN_CAD: 'Assign CAD designer?',
  UPLOAD_CORAL: 'Proceed to upload Coral design?',
  UPLOAD_CAD: 'Proceed to upload CAD design?',
  UPLOAD_FINAL_CAD: 'Proceed to upload Final CAD design?',
  CHAT: 'Open chat for this enquiry?',
  UPDATE_QUOTATION: 'Update the quotation?',
  REJECT_QUOTATION: 'Reject the quotation?',
  VIEW_QUOTATION: 'View the quotation?',
  MOVE_TO_APPROVAL: 'Move this enquiry to Design Approval Pending?',
  ACCEPT_APPROVAL: 'Accept and approve this design?',
  REJECT_APPROVAL: 'Reject this design?',
  FINAL_LOOK: 'View the final design look?',
};

export const useEnquiryButtonHandler = ({ onAlert } = {}) => {
  const actions = useEnquiryActions({ onAlert });
  const { showAlert } = actions;

  const confirmThen = useCallback((action, callback, customMsg) => {
    const msg = customMsg || ACTION_MESSAGES[action] || 'Proceed with this action?';
    showAlert('Confirm Action', msg, 'info', [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => {},
      },
      {
        text: 'Confirm',
        onPress: () => callback(),
      },
    ]);
  }, [showAlert]);

  const getHandler = useCallback((action, enquiry, callbacks = {}) => {
    const {
      onOpenQuotation,
      onViewQuotation,
      onFinalLook,
      onAssign,
      onAssignCad,
      onRejectQuotation,
      onRejectApproval,
    } = callbacks;

    switch (action) {
      case 'ASSIGN':
        return () => onAssign ? onAssign(enquiry) : null;
      case 'ASSIGN_CAD':
        return () => onAssignCad ? onAssignCad(enquiry) : null;
      case 'UPLOAD_CORAL':
        return () => actions.handleUploadCoral(enquiry);
      case 'UPLOAD_CAD':
        return () => actions.handleUploadCad(enquiry);
      case 'UPLOAD_FINAL_CAD':
        return () => actions.handleUploadFinalCad(enquiry);
      case 'CHAT':
        return () => confirmThen(action, () => actions.handleChat(enquiry));
      case 'UPDATE_QUOTATION':
        return () => actions.handleUpdateQuotation(enquiry, onOpenQuotation);
      case 'REJECT_QUOTATION':
        return () => onRejectQuotation ? onRejectQuotation(enquiry) : null;
      case 'VIEW_QUOTATION':
        return () => actions.handleViewQuotation(enquiry, onViewQuotation);
      case 'MOVE_TO_APPROVAL':
        return () => confirmThen(action, () => actions.handleMoveToApproval(enquiry));
      case 'ACCEPT_APPROVAL':
        return () => {
          const src = enquiry?._originalData || enquiry;
          const cadVersions = Array.isArray(src?.Cad) ? src.Cad : [];
          const latestCad = cadVersions.length > 0 ? cadVersions[cadVersions.length - 1] : null;
          const isFinalCad = latestCad?.IsFinalVersion === true || latestCad?.IsFinalVersion === 'true';
          const msg = isFinalCad ? 'Do you want to move to Production?' : null;
          return confirmThen(action, () => actions.handleAcceptApproval(enquiry), msg);
        };
      case 'REJECT_APPROVAL':
        return () => confirmThen(action, () => onRejectApproval ? onRejectApproval(enquiry) : null);
      case 'FINAL_LOOK':
        return () => actions.handleFinalLook(enquiry, onFinalLook);
      default:
        return () => {};
    }
  }, [actions, confirmThen]);

  return { ...actions, getHandler };
};