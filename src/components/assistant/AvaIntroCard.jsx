export default function AvaIntroCard({
  actions = [],
  hasDocument = false,
  documentName = 'No document loaded',
}) {
  return (
    <section className="ava-intro-card">
      <div className="ava-intro-header">
        <img
          className="ava-intro-avatar"
          src="/images/ava_bridgestone.png"
          alt="Ava Bridgestone"
        />
        <div className="ava-intro-copy">
          <div className="ava-intro-eyebrow">Ava Assistant</div>
          <h2>Hello. I&apos;m Ava Bridgestone.</h2>
          <p>
            I volunteered from Advocate&apos;s Bridge to help veterans here in MilPDF.
          </p>
        </div>
      </div>
      <div className="ava-intro-status">
        <span className={`ava-intro-status-dot ${hasDocument ? 'ready' : 'idle'}`} />
        <div>
          <strong>{hasDocument ? 'Document ready' : 'Waiting for a document'}</strong>
          <span>{documentName}</span>
        </div>
      </div>
      <div className="ava-intro-actions" role="group" aria-label="Ava quick actions">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className={action.variant === 'primary' ? 'btn-primary' : 'btn-secondary'}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
