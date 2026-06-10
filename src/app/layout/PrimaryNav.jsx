import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export default function PrimaryNav({
  items = [],
  activeItem,
  onChange,
  collapsed = false,
  onToggleCollapse,
}) {
  return (
    <nav
      className={`primary-nav ${collapsed ? 'collapsed' : ''}`}
      aria-label="Primary workspace navigation"
    >
      <div className="primary-nav-brand">
        <span className="primary-nav-logo">M</span>
        {collapsed ? null : (
          <div>
            <div className="primary-nav-title">MilPDF</div>
            <div className="primary-nav-subtitle">Workspace</div>
          </div>
        )}
        {onToggleCollapse ? (
          <button
            type="button"
            className="primary-nav-collapse"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        ) : null}
      </div>
      <div className="primary-nav-items">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`primary-nav-item ${activeItem === item.id ? 'active' : ''}`}
              onClick={() => onChange(item.id)}
              title={item.label}
              aria-label={item.label}
            >
              {Icon ? <Icon size={18} strokeWidth={1.9} className="primary-nav-icon" /> : null}
              {collapsed ? null : <span className="primary-nav-label">{item.label}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
