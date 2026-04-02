export default function HomeWorkspace({
  onOpenDocument,
  onResumeReview,
  onGoMatter,
}) {
  return (
    <section className="workspace-screen workspace-home">
      <div className="workspace-hero">
        <div className="workspace-hero-copy">
          <div className="workspace-eyebrow">Home</div>
          <h2>Resume document work without reassembling context.</h2>
          <p>
            Open a document, jump back into review, or organize the matter before
            you start editing.
          </p>
        </div>
        <div className="workspace-hero-actions">
          <button type="button" className="btn-primary" onClick={onOpenDocument}>
            Open document
          </button>
          <button type="button" className="btn-secondary" onClick={onResumeReview}>
            Resume review
          </button>
          <button type="button" className="btn-secondary" onClick={onGoMatter}>
            Open matter workspace
          </button>
        </div>
      </div>
    </section>
  );
}
