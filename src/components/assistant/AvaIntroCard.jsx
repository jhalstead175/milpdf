export default function AvaIntroCard() {
  return (
    <div className="ava-intro">
      <img
        className="ava-intro-avatar"
        src="/images/ava_bridgestone.png"
        alt="Ava Bridgestone"
      />
      <h2>Hello, I'm Ava Bridgestone.</h2>
      <p>
        I volunteered from Advocate's Bridge to help veterans here in MilPDF.
      </p>
      <p>
        I can help you organize documents, complete VA forms, and prepare claim evidence.
      </p>
      <div className="actions">
        <button>Upload Documents</button>
        <button>Start Claim Packet</button>
        <button>Open Editor</button>
      </div>
    </div>
  );
}
