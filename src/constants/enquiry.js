export const ROLE = {
  AD: 'AD',
  CO: 'CO',
  CD: 'CD',
  CL: 'CL',
  CH: 'CH',
};

export const ROLE_ID_TO_CODE = {
  1: ROLE.AD,
  2: ROLE.CO,
  3: ROLE.CD,
  4: ROLE.CL,
  5: ROLE.CH,
};

export const resolveRoleCode = (user) => {
  if (!user) return null;
  if (user.RoleCode) return user.RoleCode;
  if (user.Role && typeof user.Role === 'string') return user.Role;
  const id = user.RoleId ?? user.roleId ?? user.role;
  return ROLE_ID_TO_CODE[id] ?? null;
};

export const STATUS = {
  ENQUIRY_CREATED: 'Enquiry Created',
  CORAL: 'Coral',
  CAD: 'Cad',
  DESIGN_APPROVAL_PENDING: 'Design Approval Pending',
  ORDER_PLACEMENT: 'Order Placement',
  PRODUCTION: 'Production',
};

export const SUBSTATUS = {
  AP: 'Assign Pending',
  AS: 'Assigned',
  RR: 'Rejected - Redo',
  DS: 'Design Submitted',
  CM: 'Cost Missing',
  QR: 'Quotation Review',
  FU: 'Final Cad Upload',
};

export const TAB = {
  UNASSIGNED: 'unassigned',
  WIP: 'wip',
  APPROVAL: 'approval',
  PRODUCTION: 'production',
};

export const paramsForTab = (tab) => {
  switch (tab) {
    case TAB.UNASSIGNED:
      return [{ unassigned: true }, { subStatus: SUBSTATUS.AP }, { status: STATUS.ENQUIRY_CREATED }];
    case TAB.WIP:
      return [{ status: [STATUS.CORAL, STATUS.CAD, STATUS.ENQUIRY_CREATED] }];
    case TAB.APPROVAL:
      return [{ status: STATUS.DESIGN_APPROVAL_PENDING }];
    case TAB.PRODUCTION:
      return [{ status: STATUS.PRODUCTION }];
    default:
      return [{}];
  }
};

export const ACTION = {
  ASSIGN: 'ASSIGN',
  ASSIGN_CAD: 'ASSIGN_CAD',
  UPLOAD_CORAL: 'UPLOAD_CORAL',
  UPLOAD_CAD: 'UPLOAD_CAD',
  UPLOAD_FINAL_CAD: 'UPLOAD_FINAL_CAD',
  CHAT: 'CHAT',
  UPDATE_QUOTATION: 'UPDATE_QUOTATION',
  REJECT_QUOTATION: 'REJECT_QUOTATION',
  VIEW_QUOTATION: 'VIEW_QUOTATION',
  MOVE_TO_APPROVAL: 'MOVE_TO_APPROVAL',
  ACCEPT_APPROVAL: 'ACCEPT_APPROVAL',
  REJECT_APPROVAL: 'REJECT_APPROVAL',
  FINAL_LOOK: 'FINAL_LOOK',
};

export const MODAL_PHASE = {
  EDIT: 'edit',
  REVIEW: 'review',
};

export const DESIGN_TYPE = {
  CORAL: 'coral',
  CAD: 'cad',
};

const can = (roleCode, allowed) => allowed.includes(roleCode);

export const NEXT_STATE = {
  [STATUS.CORAL]: {
    [SUBSTATUS.AP]: { assign: { status: STATUS.CORAL, subStatus: SUBSTATUS.AS } },
    [SUBSTATUS.AS]: { upload: { status: STATUS.CORAL, subStatus: SUBSTATUS.CM } },
    [SUBSTATUS.RR]: { upload: { status: STATUS.CORAL, subStatus: SUBSTATUS.CM } },
    [SUBSTATUS.CM]: { saveQuotation: { status: STATUS.CORAL, subStatus: SUBSTATUS.QR }, reject: { status: STATUS.CORAL, subStatus: SUBSTATUS.RR } },
    [SUBSTATUS.QR]: { moveToApproval: { status: STATUS.DESIGN_APPROVAL_PENDING, subStatus: null } },
  },
  [STATUS.CAD]: {
    [SUBSTATUS.AP]: { assign: { status: STATUS.CAD, subStatus: SUBSTATUS.AS } },
    [SUBSTATUS.AS]: { upload: { status: STATUS.CAD, subStatus: SUBSTATUS.CM } },
    [SUBSTATUS.FU]: { upload: { status: STATUS.CAD, subStatus: SUBSTATUS.CM } },
    [SUBSTATUS.RR]: { upload: { status: STATUS.CAD, subStatus: SUBSTATUS.CM } },
    [SUBSTATUS.CM]: { saveQuotation: { status: STATUS.CAD, subStatus: SUBSTATUS.QR }, reject: { status: STATUS.CAD, subStatus: SUBSTATUS.RR } },
    [SUBSTATUS.QR]: { moveToApproval: { status: STATUS.DESIGN_APPROVAL_PENDING, subStatus: null } },
  },
  [STATUS.DESIGN_APPROVAL_PENDING]: {
    accept: {
      coral: { action: 'assignCad', status: STATUS.CAD, subStatus: SUBSTATUS.AP },
      cad: { action: 'uploadFinalCad', status: STATUS.CAD, subStatus: SUBSTATUS.FU },
    },
    reject: { status: STATUS.CAD, subStatus: SUBSTATUS.RR },
  },
};

export const actionsFor = (enquiry, roleCode) => {
  const status = enquiry?.CurrentStatus;
  const sub = enquiry?.CurrentSubStatus;
  const isAdmin = can(roleCode, [ROLE.AD]);
  const isClientHandler = can(roleCode, [ROLE.CH]);
  const isAdminCh = isAdmin || isClientHandler;
  const isCoral = can(roleCode, [ROLE.CO]);
  const isCad = can(roleCode, [ROLE.CD]);

  if (status === STATUS.ENQUIRY_CREATED) {
    return {
      buttons: isAdminCh ? [ACTION.ASSIGN] : [],
      primaryAction: ACTION.ASSIGN,
      tab: TAB.WIP,
    };
  }

  if (status === STATUS.CORAL) {
    const isAssigned = !!(enquiry.AssignedTo || enquiry.assignedTo);

    if (!sub) {
      if (isAssigned) {
        return {
          buttons: isAdmin || isCoral ? [ACTION.CHAT, ACTION.UPLOAD_CORAL] : isCad ? [ACTION.CHAT] : [],
          primaryAction: ACTION.UPLOAD_CORAL,
          tab: TAB.WIP,
        };
      }
      return {
        buttons: isAdminCh ? [ACTION.CHAT, ACTION.ASSIGN] : [],
        primaryAction: ACTION.ASSIGN,
        assignType: DESIGN_TYPE.CORAL,
        tab: TAB.WIP,
      };
    }
    if (sub === SUBSTATUS.AP) {
      if (isAssigned) {
        return {
          buttons: isAdmin || isCoral ? [ACTION.CHAT, ACTION.UPLOAD_CORAL] : isCad ? [ACTION.CHAT] : [],
          primaryAction: ACTION.UPLOAD_CORAL,
          tab: TAB.WIP,
        };
      }
      return {
        buttons: isAdminCh ? [ACTION.CHAT, ACTION.ASSIGN] : [],
        primaryAction: ACTION.ASSIGN,
        assignType: DESIGN_TYPE.CORAL,
        tab: TAB.WIP,
      };
    }
    if (sub === SUBSTATUS.AS) {
      return {
        buttons: isAdmin || isCoral ? [ACTION.CHAT, ACTION.UPLOAD_CORAL] : isCad ? [ACTION.CHAT] : [],
        primaryAction: ACTION.UPLOAD_CORAL,
        tab: TAB.WIP,
      };
    }
    if (sub === SUBSTATUS.RR) {
      return {
        buttons: isAdmin || isCoral ? [ACTION.CHAT, ACTION.UPLOAD_CORAL] : isCad ? [ACTION.CHAT] : [],
        primaryAction: ACTION.UPLOAD_CORAL,
        tab: TAB.WIP,
      };
    }
    if (sub === SUBSTATUS.CM) {
      return {
        buttons: isAdminCh ? [ACTION.UPDATE_QUOTATION, ACTION.REJECT_QUOTATION] : [],
        primaryAction: ACTION.UPDATE_QUOTATION,
        modalPhase: MODAL_PHASE.EDIT,
        tab: TAB.WIP,
      };
    }
    if (sub === SUBSTATUS.QR) {
      return {
        buttons: isAdminCh ? [ACTION.VIEW_QUOTATION, ACTION.MOVE_TO_APPROVAL] : [],
        primaryAction: ACTION.MOVE_TO_APPROVAL,
        modalPhase: MODAL_PHASE.REVIEW,
        tab: TAB.WIP,
      };
    }
  }

  if (status === STATUS.CAD) {
    const isAssigned = !!(enquiry.AssignedTo || enquiry.assignedTo);

    if (!sub) {
      if (isAssigned) {
        return {
          buttons: isAdmin || isCad ? [ACTION.CHAT, ACTION.UPLOAD_CAD] : isCoral ? [ACTION.CHAT] : [],
          primaryAction: ACTION.UPLOAD_CAD,
          tab: TAB.WIP,
        };
      }
      return {
        buttons: isAdminCh ? [ACTION.CHAT, ACTION.ASSIGN] : [],
        primaryAction: ACTION.ASSIGN,
        assignType: DESIGN_TYPE.CAD,
        tab: TAB.WIP,
      };
    }
    if (sub === SUBSTATUS.AP) {
      if (isAssigned) {
        return {
          buttons: isAdmin || isCad ? [ACTION.CHAT, ACTION.UPLOAD_CAD] : isCoral ? [ACTION.CHAT] : [],
          primaryAction: ACTION.UPLOAD_CAD,
          tab: TAB.WIP,
        };
      }
      return {
        buttons: isAdminCh ? [ACTION.CHAT, ACTION.ASSIGN] : [],
        primaryAction: ACTION.ASSIGN,
        assignType: DESIGN_TYPE.CAD,
        tab: TAB.WIP,
      };
    }
    if (sub === SUBSTATUS.AS) {
      return {
        buttons: isAdmin || isCad ? [ACTION.CHAT, ACTION.UPLOAD_CAD] : isCoral ? [ACTION.CHAT] : [],
        primaryAction: ACTION.UPLOAD_CAD,
        tab: TAB.WIP,
      };
    }
    if (sub === SUBSTATUS.FU) {
      return {
        buttons: isAdmin ? [ACTION.CHAT, ACTION.UPLOAD_FINAL_CAD] : isCoral || isCad ? [ACTION.CHAT] : [],
        primaryAction: ACTION.UPLOAD_FINAL_CAD,
        tab: TAB.WIP,
      };
    }
    if (sub === SUBSTATUS.RR) {
      return {
        buttons: isAdmin || isCad ? [ACTION.CHAT, ACTION.UPLOAD_CAD] : isCoral ? [ACTION.CHAT] : [],
        primaryAction: ACTION.UPLOAD_CAD,
        tab: TAB.WIP,
      };
    }
    if (sub === SUBSTATUS.CM) {
      return {
        buttons: isAdminCh ? [ACTION.UPDATE_QUOTATION, ACTION.REJECT_QUOTATION] : [],
        primaryAction: ACTION.UPDATE_QUOTATION,
        modalPhase: MODAL_PHASE.EDIT,
        tab: TAB.WIP,
      };
    }
    if (sub === SUBSTATUS.QR) {
      return {
        buttons: isAdminCh ? [ACTION.VIEW_QUOTATION, ACTION.MOVE_TO_APPROVAL] : [],
        primaryAction: ACTION.MOVE_TO_APPROVAL,
        modalPhase: MODAL_PHASE.REVIEW,
        tab: TAB.WIP,
      };
    }
  }

  if (status === STATUS.DESIGN_APPROVAL_PENDING) {
    return {
      buttons: isAdminCh ? [ACTION.FINAL_LOOK, ACTION.ACCEPT_APPROVAL, ACTION.REJECT_APPROVAL] : [],
      primaryAction: ACTION.ACCEPT_APPROVAL,
      tab: TAB.APPROVAL,
    };
  }

  if (status === STATUS.ORDER_PLACEMENT) {
    return {
      buttons: isAdminCh ? [ACTION.CHAT] : [],
      tab: TAB.PRODUCTION,
    };
  }

  if (status === STATUS.PRODUCTION) {
    return {
      buttons: isAdminCh ? [ACTION.CHAT] : [],
      tab: TAB.PRODUCTION,
    };
  }

  return { buttons: [], tab: null };
};
