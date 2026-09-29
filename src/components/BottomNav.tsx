import { NavLink } from 'react-router';
import { AppIcon } from './AppIcon';

const items = [
  { to: '/', label: '好物', icon: 'assets' as const, end: true },
  { to: '/categories', label: '分类', icon: 'categories' as const },
  { to: '/stats', label: '统计', icon: 'stats' as const },
  { to: '/settings', label: '设置', icon: 'settings' as const },
];

export function BottomNav() {
  return <div className="bottom-shell">
    <nav className="bottom-nav" aria-label="主要导航">
      {items.map(item => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}><AppIcon name={item.icon} size={20}/><span>{item.label}</span></NavLink>)}
    </nav>
    <NavLink className="floating-add" to="/assets/new" aria-label="记下一件好物"><AppIcon name="plus" size={30}/></NavLink>
  </div>;
}
