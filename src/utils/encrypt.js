// Password-protect a PDF using MuPDF (AES-256). In Electron, encryption runs in
// the main process (Node.js) where the native mupdf addon is available.
// NOTE: passwords cannot contain ',' or '=' — validate before calling.
export const PASSWORD_FORBIDDEN = /[,=]/;

function toBase64(bytes) {
  let binary = '';
  const chunk = 32768;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function encryptPdf(bytes, {
  userPassword = '',
  ownerPassword = '',
  allowPrint = true,
  allowCopy = true,
} = {}) {
  if (PASSWORD_FORBIDDEN.test(userPassword) || PASSWORD_FORBIDDEN.test(ownerPassword)) {
    throw new Error("Passwords cannot contain ',' or '=' characters.");
  }
  if (typeof window !== 'undefined' && window.electronAPI?.encryptPdf) {
    const result = await window.electronAPI.encryptPdf(
      toBase64(bytes),
      { userPassword, ownerPassword, allowPrint, allowCopy },
    );
    if (!result) throw new Error('Encryption failed in main process.');
    return Uint8Array.from(atob(result), c => c.charCodeAt(0));
  }
  throw new Error('PDF encryption requires the MilPDF desktop app.');
}
