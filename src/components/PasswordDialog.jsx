import { useState } from 'react';
import { PASSWORD_FORBIDDEN } from '../utils/encrypt';

export default function PasswordDialog({ onApply, onClose }) {
  const [userPassword, setUserPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [useOwner, setUseOwner] = useState(false);
  const [ownerPassword, setOwnerPassword] = useState('');
  const [allowPrint, setAllowPrint] = useState(true);
  const [allowCopy, setAllowCopy] = useState(true);

  const forbidden = PASSWORD_FORBIDDEN.test(userPassword) || PASSWORD_FORBIDDEN.test(ownerPassword);
  const mismatch = confirm.length > 0 && userPassword !== confirm;
  const valid = userPassword.length > 0 && userPassword === confirm && !forbidden;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal numbering-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Password Protect &amp; Save</h3>
        <p className="modal-hint">Saves an encrypted (AES-256) copy that requires a password to open.</p>

        <label className="numbering-field">
          <span>Password</span>
          <input type="password" value={userPassword} autoComplete="new-password"
            onChange={(e) => setUserPassword(e.target.value)} />
        </label>
        <label className="numbering-field">
          <span>Confirm</span>
          <input type="password" value={confirm} autoComplete="new-password"
            onChange={(e) => setConfirm(e.target.value)} />
        </label>

        <label className="stamp-date-toggle">
          <input type="checkbox" checked={useOwner} onChange={(e) => setUseOwner(e.target.checked)} />
          <span>Set a separate owner password (to change permissions)</span>
        </label>
        {useOwner ? (
          <label className="numbering-field">
            <span>Owner password</span>
            <input type="password" value={ownerPassword} autoComplete="new-password"
              onChange={(e) => setOwnerPassword(e.target.value)} />
          </label>
        ) : null}

        <h4 className="insert-section-label">Permissions</h4>
        <label className="stamp-date-toggle">
          <input type="checkbox" checked={allowPrint} onChange={(e) => setAllowPrint(e.target.checked)} />
          <span>Allow printing</span>
        </label>
        <label className="stamp-date-toggle">
          <input type="checkbox" checked={allowCopy} onChange={(e) => setAllowCopy(e.target.checked)} />
          <span>Allow copying text</span>
        </label>

        {forbidden ? <p className="password-warn">Passwords can&apos;t contain commas or equals signs.</p> : null}
        {mismatch ? <p className="password-warn">Passwords don&apos;t match.</p> : null}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!valid}
            onClick={() => onApply({ userPassword, ownerPassword: useOwner ? ownerPassword : '', allowPrint, allowCopy })}
          >
            Protect &amp; Save
          </button>
        </div>
      </div>
    </div>
  );
}
