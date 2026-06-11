// Password-protect a PDF using MuPDF (AES-256). mupdf is loaded lazily so its
// wasm only downloads when the user actually encrypts.
//
// NOTE: MuPDF takes encryption settings as a comma/equals-delimited options
// string, so passwords cannot contain ',' or '=' — validate before calling.
export const PASSWORD_FORBIDDEN = /[,=]/;

// PDF /P permission bitfield. Base -4 = all allowed; clear bit 3 (4) to deny
// printing, bit 5 (16) to deny copy/extract.
function computePermissions({ allowPrint = true, allowCopy = true }) {
  let p = -4;
  if (!allowPrint) p &= ~4;
  if (!allowCopy) p &= ~16;
  return p;
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
  const mupdf = await import('mupdf');
  const doc = mupdf.PDFDocument.openDocument(bytes, 'application/pdf');
  const permissions = computePermissions({ allowPrint, allowCopy });
  const opts = ['encrypt=aes-256'];
  if (userPassword) opts.push(`user-password=${userPassword}`);
  // An owner password is what actually enforces permissions; fall back to the
  // user password so the document is never left with a trivial owner.
  opts.push(`owner-password=${ownerPassword || userPassword}`);
  opts.push(`permissions=${permissions}`);
  const out = doc.saveToBuffer(opts.join(','));
  return out.asUint8Array();
}
