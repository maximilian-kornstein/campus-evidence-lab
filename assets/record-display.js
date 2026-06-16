function normalizedInstitutionalResponse(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'");
}

function isLimitedResponseNote(value) {
  const response = normalizedInstitutionalResponse(value);
  if (!response) return false;
  if (response.startsWith("the record summarizes ")) return true;
  if (response.startsWith("the record currently summarizes ")) return true;
  if (response.includes("does not independently evaluate investigative, disciplinary, or institutional response outcomes")) return true;
  if (response.includes("does not independently evaluate the institution's completed response")) return true;
  if (response.includes("does not evaluate the university's completed response")) return true;
  if (response.includes("does not evaluate harvard's response")) return true;
  return false;
}

function isAgencyDescribedResponse(value) {
  const response = normalizedInstitutionalResponse(value);
  if (!response) return false;
  if (/^(ocr|the office for civil rights|the department of education|department of education|justice department|the justice department|a federal agency|the agency|the court|court|prosecutors?)\b/.test(response)) {
    return /\b(announced|said|entered|resolved|resolution agreement|agreement|finding|case|investigation|compliance obligation)\b/.test(response);
  }
  return /\b(according to ocr|according to the department of education|ocr announced|federal officials announced)\b/.test(response);
}

export function hasSubstantiveInstitutionalResponse(record) {
  const response = normalizedInstitutionalResponse(record.institutional_response);
  return Boolean(response) && !isLimitedResponseNote(record.institutional_response);
}

export function responseDisplayProfile(record) {
  const response = String(record.institutional_response ?? "").trim();
  if (!response) {
    return {
      shouldShow: false,
      heading: "",
      response: ""
    };
  }

  if (hasSubstantiveInstitutionalResponse(record)) {
    return {
      shouldShow: true,
      heading: "Public institutional response",
      response
    };
  }

  if (record.response_date) {
    return {
      shouldShow: true,
      heading: "Public response note",
      response
    };
  }

  return {
    shouldShow: false,
    heading: "",
    response: ""
  };
}

export function responseDepthDisplayProfile(record) {
  const response = String(record.institutional_response ?? "").trim();
  if (!response) {
    return {
      code: "no_public_response_found",
      label: "No public response found",
      description: "No stored public response text is available for this record."
    };
  }

  if (isLimitedResponseNote(response)) {
    return {
      code: "limited_public_response_note",
      label: "Limited public response note",
      description: "This record stores a bounded note rather than a substantive public institutional response."
    };
  }

  if (isAgencyDescribedResponse(response)) {
    return {
      code: "agency_described_institutional_action",
      label: "Agency-described institutional action",
      description: "The stored response text describes institutional action through a public agency or legal source."
    };
  }

  return {
    code: "direct_institutional_response",
    label: "Direct institutional response",
    description: "The stored response text is treated as a direct public institutional statement or commitment."
  };
}
