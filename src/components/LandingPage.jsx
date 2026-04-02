import {
  FileText, Shield, PenTool, Scissors, Layers, FileSearch,
  Merge, Crop, Highlighter, Pencil, Droplets, Type,
  Download, Globe, ChevronRight, Lock, Eye, Users,
  ImagePlus, RotateCw,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const IC = { strokeWidth: 1.4 };

const features = [
  { Icon: FileText, title: 'Open & Save', desc: 'Load a PDF, review it, and save with edits embedded.' },
  { Icon: ImagePlus, title: 'Create PDF from Images', desc: 'Turn photos or scans into a clean working PDF.' },
  { Icon: Merge, title: 'Merge & Insert PDFs', desc: 'Append another PDF or insert pages exactly where you need them.' },
  { Icon: Layers, title: 'Page Organization', desc: 'Insert blanks, delete pages, and manage packet structure.' },
  { Icon: RotateCw, title: 'Rotate & Reorder', desc: 'Fix orientation and rearrange page order for production.' },
  { Icon: Scissors, title: 'Split & Extract', desc: 'Pull a page range into a new PDF for filing or sharing.' },
  { Icon: Type, title: 'Text Annotations', desc: 'Type directly onto the page with precise placement.' },
  { Icon: PenTool, title: 'E-Signatures', desc: 'Draw or place a signature anywhere on the document.' },
  { Icon: Highlighter, title: 'Highlight & Markup', desc: 'Mark important passages for review, findings, or evidence.' },
  { Icon: Pencil, title: 'Freehand Drawing', desc: 'Add quick visual notes and markups during review.' },
  { Icon: Shield, title: 'Redaction', desc: 'Identify and permanently remove sensitive data from exports.' },
  { Icon: Crop, title: 'Crop Pages', desc: 'Trim page view for cleaner production-ready packets.' },
  { Icon: Droplets, title: 'Watermarks', desc: 'Apply draft or confidentiality marks before distribution.' },
  { Icon: FileSearch, title: 'Export to Word', desc: 'Convert the current PDF into a clean .docx document.' },
];

const pillars = [
  { Icon: Lock, title: 'Private by Default', desc: 'Your PDFs stay on your machine. No accounts, no uploads, and no document handoff to a third-party service.' },
  { Icon: Eye, title: 'Operational Clarity', desc: 'The interface is built for review work: clear status, visible tools, and export actions that are easy to audit.' },
  { Icon: Users, title: 'Built for Serious Document Work', desc: 'MilPDF is designed for legal, veteran, and structured-document workflows where speed, traceability, and reliability matter.' },
];

export default function LandingPage({ onLaunchEditor, onDownloadDesktop }) {
  const [downloadCount, setDownloadCount] = useState(null);

  useEffect(() => {
    fetch('https://api.github.com/repos/jhalstead175/milpdf/releases')
      .then(r => r.ok ? r.json() : [])
      .then(releases => {
        const total = releases.reduce((sum, rel) =>
          sum + rel.assets.reduce((s, a) => s + (a.download_count || 0), 0), 0);
        if (total > 0) setDownloadCount(total);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="landing">
      {/* ===== NAV ===== */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-nav-brand">
            <img src="./images/milpdf_offwht_500x500.png" alt="MilPDF" className="landing-nav-logo" />
            <span className="landing-nav-wordmark">MilPDF</span>
          </div>
          <div className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#mission">Mission</a>
            <a href="#download">Download</a>
            <button className="landing-btn-sm" onClick={onLaunchEditor}>
              Launch Editor <ChevronRight size={14} {...IC} />
            </button>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="landing-hero">
        <div className="hero-grid-overlay" />
        <div className="hero-glow" />
        <div className="hero-content">
          <img
            src="./images/milpdf_offwht_1000x1000.svg"
            alt="MilPDF"
            className="hero-logo"
          />
          <h1 className="hero-title">
            <span className="hero-title-mil">Mil</span>PDF
          </h1>
          <p className="hero-subtitle">
            A professional PDF workbench for review, annotation, and export.
          </p>
          <p className="hero-desc">
            Built for legal, veteran, and structured-document workflows. Open, combine,
            mark up, redact, and export with a private local-first workflow that keeps
            your documents on your machine.
          </p>
          <div className="hero-actions">
            <button className="landing-btn-primary" onClick={onLaunchEditor}>
              Launch Editor <ChevronRight size={16} {...IC} />
            </button>
            <button className="landing-btn-secondary" onClick={onDownloadDesktop}>
              <Download size={16} {...IC} /> Download for Windows
            </button>
          </div>
          <p className="hero-note">
            No sign-up required. No data ever leaves your device.
          </p>
        </div>
        <div className="hero-scan-line" />
      </section>

      {/* ===== FEATURES ===== */}
      <section className="landing-features" id="features">
        <div className="section-inner">
          <h2 className="section-heading">
            <span className="heading-accent">//</span> Capabilities
          </h2>
          <p className="section-subheading">
            Core PDF workflows for serious document preparation.
          </p>
          <div className="features-grid">
            {features.map((feature) => (
              <div className="feature-card" key={feature.title}>
                <div className="feature-icon-wrap">
                  <feature.Icon size={24} {...IC} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== MISSION / TRUST ===== */}
      <section className="landing-mission" id="mission">
        <div className="section-inner">
          <h2 className="section-heading">
            <span className="heading-accent">//</span> Mission
          </h2>
          <p className="section-subheading">
            Private local work, with clear production-ready tools.
          </p>
          <div className="pillars-grid">
            {pillars.map((pillar) => (
              <div className="pillar-card" key={pillar.title}>
                <pillar.Icon size={32} {...IC} className="pillar-icon" />
                <h3>{pillar.title}</h3>
                <p>{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== DOWNLOAD CTA ===== */}
      <section className="landing-download" id="download">
        <div className="section-inner download-inner">
          <div className="download-text">
            <h2>Deploy Locally</h2>
            <p>
              Install MilPDF as a native Windows app. Associate it with .pdf files
              so every document opens directly in your editor. Fully offline.
            </p>
          </div>
          <div className="download-actions">
            <button className="landing-btn-primary" onClick={onDownloadDesktop}>
              <Download size={16} {...IC} /> Download for Windows
            </button>
            <button className="landing-btn-secondary" onClick={onLaunchEditor}>
              Use in Browser <ChevronRight size={16} {...IC} />
            </button>
          </div>
          {downloadCount !== null && (
            <p className="download-counter">
              <Download size={14} {...IC} /> <strong>{downloadCount.toLocaleString()}</strong> desktop downloads
            </p>
          )}
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="landing-footer">
        <div className="section-inner footer-inner">
          <div className="footer-brand">
            <img src="./images/milpdf_offwht_500x500.png" alt="MilPDF" className="footer-logo" />
            <span>MilPDF</span>
          </div>
          <p className="footer-copy">
            &copy; {new Date().getFullYear()} MilPDF &mdash; Free &amp; open source.
            Built with purpose for those who served.
          </p>
          <div className="footer-links">
            <a href="https://github.com/jhalstead175/milpdf" target="_blank" rel="noopener noreferrer">
              <Globe size={14} {...IC} /> GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
