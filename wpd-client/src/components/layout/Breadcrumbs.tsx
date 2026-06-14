import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { processApi } from '../../api/processApi';
import './Breadcrumbs.css';

export default function Breadcrumbs() {
  const location = useLocation();
  const { id } = useParams();
  const processId = id ? Number(id) : null;

  const { data: process } = useQuery({
    queryKey: ['process', processId],
    queryFn: () => processApi.getProcess(processId!),
    enabled: processId !== null && Number.isFinite(processId) && processId > 0,
  });

  const getBreadcrumbs = () => {
    const path = location.pathname;

    // Dashboard
    if (path === '/dashboard') {
      return [
        { label: 'Home', href: '/', active: false },
        { label: 'Dashboard', href: '/dashboard', active: true },
      ];
    }

    // Create process
    if (path === '/processes/create') {
      return [
        { label: 'Home', href: '/', active: false },
        { label: 'Dashboard', href: '/dashboard', active: false },
        { label: 'Create Process', href: '/processes/create', active: true },
      ];
    }

    // Process detail
    if (path.startsWith('/processes/') && processId) {
      return [
        { label: 'Home', href: '/', active: false },
        { label: 'Dashboard', href: '/dashboard', active: false },
        {
          label: process?.name || 'Process',
          href: `/processes/${processId}`,
          active: true,
        },
      ];
    }

    return [];
  };

  const breadcrumbs = getBreadcrumbs();

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {breadcrumbs.map((crumb, index) => (
          <li key={index}>
            {crumb.active ? (
              <span className="breadcrumb-active">{crumb.label}</span>
            ) : (
              <>
                <Link to={crumb.href}>{crumb.label}</Link>
                <span className="breadcrumb-separator">/</span>
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
