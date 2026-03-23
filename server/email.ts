// Email sending via Microsoft Graph API (OAuth2 client credentials)
// Falls back to silent skip if env vars are not configured.

const TENANT_ID  = process.env.MS_TENANT_ID;
const CLIENT_ID  = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const SEND_FROM  = process.env.SMTP_USER || "hr@lucentrenewables.com";
const APP_URL    = process.env.APP_URL || "http://localhost:5000";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    console.log("[email] Microsoft Graph not configured — emails disabled");
    return null;
  }
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.value;
  }
  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph token error: ${err}`);
  }
  const data = await res.json() as any;
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.value;
}

export function resetTransporter() {
  cachedToken = null; // force re-auth on next send
}

async function sendGraphEmail(to: string, subject: string, html: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) return; // not configured — skip silently

  const url = `https://graph.microsoft.com/v1.0/users/${SEND_FROM}/sendMail`;
  const payload = {
    message: {
      subject,
      body: { contentType: "HTML", content: html },
      toRecipients: [{ emailAddress: { address: to } }],
      from: { emailAddress: { address: SEND_FROM, name: "Lucent Renewables HR" } },
    },
    saveToSentItems: true,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph sendMail error ${res.status}: ${err}`);
  }
  console.log("[email] Sent via Graph API to", to);
}

/** Wraps any email send — catches errors so they never block API responses */
async function safeSend(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error("[email] Send failed (non-blocking):", e);
  }
}

export async function sendInviteEmail(to: string, firstName: string, token: string) {
  const link = `${APP_URL}/#/accept-invite?token=${token}`;
  await safeSend(() => sendGraphEmail(
    to,
    "You're invited to Lucent Renewables HR",
    `<div style="font-family:sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#1a6b72">Welcome to Lucent Renewables HR</h2>
      <p>Hi ${firstName},</p>
      <p>You've been invited to join the Lucent Renewables leave management platform.</p>
      <p><a href="${link}" style="background:#1a6b72;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Set up your account →</a></p>
      <p style="color:#888;font-size:12px">This invite link expires in 7 days.</p>
    </div>`,
  ));
}

export async function sendLeaveRequestEmail(
  managerEmail: string,
  managerName: string,
  employeeName: string,
  startDate: string,
  endDate: string,
  days: number,
  requestId: number,
) {
  const link = `${APP_URL}/#/approvals`;
  await safeSend(() => sendGraphEmail(
    managerEmail,
    `Leave request pending approval – ${employeeName}`,
    `<div style="font-family:sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#1a6b72">Leave Request Awaiting Your Approval</h2>
      <p>Hi ${managerName},</p>
      <p><strong>${employeeName}</strong> has submitted a leave request that requires your approval:</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Period</td><td style="padding:8px">${startDate} → ${endDate}</td></tr>
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Working days</td><td style="padding:8px">${days}</td></tr>
      </table>
      <p><a href="${link}" style="background:#1a6b72;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Review & Approve →</a></p>
    </div>`,
  ));
}

export async function sendStatusUpdateEmail(
  employeeEmail: string,
  employeeName: string,
  status: "approved" | "rejected",
  startDate: string,
  endDate: string,
  days: number,
  managerNote?: string | null,
) {
  const color = status === "approved" ? "#2e7d32" : "#c62828";
  const label = status === "approved" ? "Approved ✓" : "Rejected ✗";
  await safeSend(() => sendGraphEmail(
    employeeEmail,
    `Your leave request has been ${status}`,
    `<div style="font-family:sans-serif;max-width:520px;margin:auto">
      <h2 style="color:${color}">Leave Request ${label}</h2>
      <p>Hi ${employeeName},</p>
      <p>Your leave request has been <strong>${status}</strong>.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Period</td><td style="padding:8px">${startDate} → ${endDate}</td></tr>
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Working days</td><td style="padding:8px">${days}</td></tr>
        ${managerNote ? `<tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Note from manager</td><td style="padding:8px">${managerNote}</td></tr>` : ""}
      </table>
      <p><a href="${APP_URL}" style="background:#1a6b72;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">View in Lucent Renewables HR →</a></p>
    </div>`,
  ));
}

export async function sendReminderEmail(
  managerEmail: string,
  managerName: string,
  pendingCount: number,
) {
  const link = `${APP_URL}/#/approvals`;
  await safeSend(() => sendGraphEmail(
    managerEmail,
    `Reminder: ${pendingCount} leave request${pendingCount > 1 ? "s" : ""} awaiting your approval`,
    `<div style="font-family:sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#1a6b72">Pending Leave Approvals</h2>
      <p>Hi ${managerName},</p>
      <p>You have <strong>${pendingCount} leave request${pendingCount > 1 ? "s" : ""}</strong> waiting for your review.</p>
      <p><a href="${link}" style="background:#1a6b72;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Review Requests →</a></p>
    </div>`,
  ));
}
