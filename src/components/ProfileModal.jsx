import { useState } from 'react';
import { normalizeProfile } from '../veteran/profile';

export default function ProfileModal({ profile, onSave, onClose }) {
  const [draft, setDraft] = useState(() => normalizeProfile(profile));

  const update = (path, value) => {
    setDraft(prev => {
      const next = { ...prev };
      const parts = path.split('.');
      let cursor = next;
      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        cursor[key] = { ...cursor[key] };
        cursor = cursor[key];
      }
      cursor[parts[parts.length - 1]] = value;
      return next;
    });
  };

  const handleSubmit = () => {
    onSave(draft);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal profile-modal" onClick={e => e.stopPropagation()}>
        <h3>Veteran Profile</h3>
        <p className="modal-hint">Saved locally for auto-fill and DD214 detection.</p>

        <div className="profile-grid">
          <label>
            First Name
            <input value={draft.member.firstName} onChange={e => update('member.firstName', e.target.value)} />
          </label>
          <label>
            Middle Name
            <input value={draft.member.middleName} onChange={e => update('member.middleName', e.target.value)} />
          </label>
          <label>
            Last Name
            <input value={draft.member.lastName} onChange={e => update('member.lastName', e.target.value)} />
          </label>
          <label>
            Branch
            <input value={draft.member.branch} onChange={e => update('member.branch', e.target.value)} />
          </label>
          <label>
            Rank
            <input value={draft.member.rank} onChange={e => update('member.rank', e.target.value)} />
          </label>
          <label>
            Pay Grade
            <input value={draft.member.payGrade} onChange={e => update('member.payGrade', e.target.value)} />
          </label>
          <label>
            Unit
            <input value={draft.member.unit} onChange={e => update('member.unit', e.target.value)} />
          </label>
          <label>
            SSN (optional)
            <input value={draft.member.ssn} onChange={e => update('member.ssn', e.target.value)} />
          </label>
          <label>
            Date of Birth
            <input value={draft.member.dob} onChange={e => update('member.dob', e.target.value)} />
          </label>
          <label>
            DoD ID
            <input value={draft.member.dodId} onChange={e => update('member.dodId', e.target.value)} />
          </label>
          <label>
            Email
            <input value={draft.member.email} onChange={e => update('member.email', e.target.value)} />
          </label>
          <label>
            Phone
            <input value={draft.member.phone} onChange={e => update('member.phone', e.target.value)} />
          </label>
          <label>
            Address
            <input value={draft.contact.address} onChange={e => update('contact.address', e.target.value)} />
          </label>
          <label>
            City
            <input value={draft.contact.city} onChange={e => update('contact.city', e.target.value)} />
          </label>
          <label>
            State
            <input value={draft.contact.state} onChange={e => update('contact.state', e.target.value)} />
          </label>
          <label>
            ZIP
            <input value={draft.contact.zip} onChange={e => update('contact.zip', e.target.value)} />
          </label>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit}>Save Profile</button>
        </div>
      </div>
    </div>
  );
}
