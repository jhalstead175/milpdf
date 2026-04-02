export default function PrimaryNav({
  items = [],
  activeItem,
  onChange,
}) {
  return (
    <nav className="primary-nav" aria-label="Primary workspace navigation">
      <div className="primary-nav-brand">
        <span className="primary-nav-logo">M</span>
        <div>
          <div className="primary-nav-title">MilPDF</div>
          <div className="primary-nav-subtitle">Workspace</div>
        </div>
      </div>
      <div className="primary-nav-items">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`primary-nav-item ${activeItem === item.id ? 'active' : ''}`}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
