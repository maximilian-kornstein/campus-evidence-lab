function base64url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export async function gmailAccessToken(env) {
  for (const key of ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "GMAIL_SENDER_EMAIL"]) if (!env[key]) throw new Error(`missing_${key.toLowerCase()}`);
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env.GMAIL_CLIENT_ID, client_secret: env.GMAIL_CLIENT_SECRET, refresh_token: env.GMAIL_REFRESH_TOKEN, grant_type: "refresh_token" }) });
  if (!response.ok) throw new Error(`gmail_token_${response.status}`);
  return (await response.json()).access_token;
}

async function gmail(token, path, init = {}) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) } });
  if (!response.ok) throw new Error(`gmail_api_${response.status}`);
  return response.json();
}

export async function gmailSearch(token, query) {
  const url = `/messages?q=${encodeURIComponent(query)}&maxResults=20`;
  return gmail(token, url);
}

export async function gmailThread(token, threadId) {
  return gmail(token, `/threads/${encodeURIComponent(threadId)}?format=metadata`);
}

export async function sendPartnerEmail(token, env, row, followup = false) {
  const subject = followup ? `Re: A source-backed campus evidence feed for ${row.organization_name}` : `A source-backed campus evidence feed for ${row.organization_name}`;
  const greeting = row.contact_name ? `Hi ${row.contact_name},` : "Hello,";
  const body = followup
    ? `${greeting}\n\nOne brief follow-up: would a source-backed CEL Signals feed or live Context Note be useful for ${row.organization_name}? ${row.feed_url}\n\nNo response is needed if it is not relevant; there will be no further follow-up.\n\nCampus Evidence Lab`
    : `${greeting}\n\nCampus Evidence Lab is piloting CEL Signals, an automated public-interest wire connecting current campus developments to bounded primary-source evidence. It does not rank schools or infer misconduct.\n\nA relevant feed for ${row.organization_name}: ${row.feed_url}\n\nWould you be willing to try the feed or embed one Context Note and tell us whether it is useful? Every Signal includes sources, unknowns, and a correction route.\n\nCampus Evidence Lab`;
  const raw = [`From: Campus Evidence Lab <${env.GMAIL_SENDER_EMAIL}>`, `To: ${row.contact_email}`, `Subject: ${subject}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "", body].join("\r\n");
  return gmail(token, "/messages/send", { method: "POST", body: JSON.stringify({ raw: base64url(raw), ...(row.gmail_thread_id ? { threadId: row.gmail_thread_id } : {}) }) });
}

export function threadHasInboundReply(thread, senderEmail) {
  return (thread.messages ?? []).some((message) => {
    const from = message.payload?.headers?.find((header) => header.name.toLowerCase() === "from")?.value?.toLowerCase() ?? "";
    return from && !from.includes(senderEmail.toLowerCase());
  });
}
