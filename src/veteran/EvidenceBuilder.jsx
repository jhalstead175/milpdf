import { useMemo, useState } from 'react';
import { PACKET_TEMPLATES, createPacketSection } from './evidencePacket';
import { assembleEvidencePacket } from './packetAssembler';
import { saveWithDialog } from '../utils/pdfUtils';

const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

export default function EvidenceBuilder({ profile, onClose }) {
  const [packetType, setPacketType] = useState('disability');
  const [sections, setSections] = useState(() =>
    PACKET_TEMPLATES.disability.sections.map(s => createPacketSection(s))
  );
  const [claimSummary, setClaimSummary] = useState('');
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState(0);
  const outputName = useMemo(() => {
    const name = profile.member.lastName || 'VETERAN';
    return `evidence_packet_${name}_` + new Date().toISOString().slice(0, 10) + '.pdf';
  }, [profile]);

  const template = PACKET_TEMPLATES[packetType];

  const resetSections = (nextType) => {
    const nextTemplate = PACKET_TEMPLATES[nextType];
    setSections(nextTemplate.sections.map(s => createPacketSection(s)));
    setClaimSummary('');
  };

  const updateSection = (id, updates) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const addFiles = async (id, fileList) => {
    const files = Array.from(fileList || []);
    const entries = await Promise.all(files.map(async (file) => ({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })));
    setSections(prev => prev.map(s => s.id === id
      ? { ...s, files: [...(s.files || []), ...entries] }
      : s));
  };

  const removeFile = (id, index) => {
    setSections(prev => prev.map(s => s.id === id
      ? { ...s, files: s.files.filter((_, i) => i !== index) }
      : s));
  };

  const buildPacket = async () => {
    setBuilding(true);
    try {
      const withSummary = sections.map(s =>
        s.id === 'cover' ? { ...s, claimSummary } : s
      );
      const bytes = await assembleEvidencePacket(withSummary, profile, template.name, setProgress);
      if (isElectron) {
        const base64 = btoa(new Uint8Array(bytes).reduce((s, b) => s + String.fromCharCode(b), ''));
        await window.electronAPI.saveFileDialog(outputName, base64);
      } else {
        await saveWithDialog(bytes, outputName);
      }
      onClose();
    } catch (err) {
      alert('Failed to build packet: ' + err.message);
    } finally {
      setBuilding(false);
      setProgress(0);
    }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal evidence-modal" onClick={e => e.stopPropagation()}>
        <h3>Evidence Packet Builder</h3>
        <p className="modal-hint">Assemble a clean packet for VA submission.</p>

        <div className="evidence-controls">
          <label>
            Claim Type
            <select
              value={packetType}
              onChange={(e) => { setPacketType(e.target.value); resetSections(e.target.value); }}
            >
              {Object.entries(PACKET_TEMPLATES).map(([key, value]) => (
                <option key={key} value={key}>{value.name}</option>
              ))}
            </select>
          </label>
          <label>
            Output Name
            <input value={outputName} readOnly />
          </label>
        </div>

        <div className="evidence-sections">
          {sections.map(section => (
            <div key={section.id} className="evidence-section">
              <div className="evidence-section-header">
                <div>
                  <strong>{section.label}</strong>
                  {section.required && <span className="required-pill">Required</span>}
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={section.enabled}
                    onChange={(e) => updateSection(section.id, { enabled: e.target.checked })}
                  />
                  <span>Include</span>
                </label>
              </div>

              {section.generated ? (
                <div className="generated-note">Auto-generated</div>
              ) : (
                <div className="section-files">
                  <div className="file-list">
                    {(section.files || []).map((file, idx) => (
                      <div key={`${file.name}-${idx}`} className="file-item">
                        <span>{file.name}</span>
                        <button className="btn-secondary" onClick={() => removeFile(section.id, idx)}>Remove</button>
                      </div>
                    ))}
                  </div>
                  <label className="btn-primary">
                    Add PDF
                    <input
                      type="file"
                      accept=".pdf"
                      multiple={section.multi}
                      onChange={(e) => {
                        addFiles(section.id, e.target.files);
                        e.target.value = '';
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              )}

              {section.id === 'cover' && (
                <textarea
                  className="summary-input"
                  placeholder="Claim summary (optional)"
                  value={claimSummary}
                  onChange={(e) => setClaimSummary(e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        {building && (
          <div className="build-progress">
            <span>Building packet...</span>
            <progress value={progress} max={1} />
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={building}>Cancel</button>
          <button className="btn-primary" onClick={buildPacket} disabled={building}>Build Packet</button>
        </div>
      </div>
    </div>
  );
}
