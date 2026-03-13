import {
  FileText, Shield, PenTool, Scissors, Layers, FileSearch,
  Merge, Crop, Highlighter, Pencil, Droplets, Type,
  Download, Globe, ChevronRight, Lock, Eye, Users,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const IC = { strokeWidth: 1.4 };

const features = [
  { Icon: FileText, title: 'Open & Save', desc: 'Load any PDF. Save with all edits embedded.' },
  { Icon: Type, title: 'Text Annotations', desc: 'Click anywhere to type directly onto a page.' },
  { Icon: PenTool, title: 'E-Signatures', desc: 'Draw or upload your signature. Place it anywhere.' },
  { Icon: Highlighter, title: 'Highlight & Markup', desc: 'Highlight text with semi-transparent overlays.' },
  { Icon: Pencil, title: 'Freehand Drawing', desc: 'Draw freely on any page with precision.' },
  { Icon: Shield, title: 'Redaction', desc: 'Permanently black out SSNs, sensitive data.' },
  { Icon: Crop, title: 'Crop Pages', desc: 'Draw a crop box and trim any page.' },
  { Icon: Layers, title: 'Add & Delete Pages', desc: 'Insert blanks, remove pages, rotate.' },
  { Icon: Merge, title: 'Merge PDFs', desc: 'Combine multiple documents into one.' },
  { Icon: Scissors, title: 'Split & Extract', desc: 'Pull a page range into a new PDF.' },
  { Icon: Droplets, title: 'Watermarks', desc: 'Stamp DRAFT, CONFIDENTIAL across all pages.' },
  { Icon: FileSearch, title: 'Export to Word', desc: 'Extract text into a clean .docx file.' },
];

const pillars = [
  { Icon: Lock, title: 'Zero Data Collection', desc: 'Everything runs in your browser. No uploads, no servers, no tracking. Your documents never leave your machine.' },
  { Icon: Eye, title: 'Full Transparency', desc: 'Open source. No hidden analytics, no telemetry, no ads. Inspect every line of code yourself.' },
  { Icon: Users, title: 'Built for Veterans', desc: 'Designed to handle VA paperwork, DD-214s, medical records, benefits forms — the documents that matter most.' },
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
            Military-grade PDF editing. Free. Private. No compromises.
          </p>
          <p className="hero-desc">
            Built for those who served. A full-featured PDF editor that runs
            entirely in your browser — no uploads, no accounts, no data collection.
            Your documents stay on your machine. Period.
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
            Every tool you need. Nothing you don't.
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
            Privacy is not a feature. It's the foundation.
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
