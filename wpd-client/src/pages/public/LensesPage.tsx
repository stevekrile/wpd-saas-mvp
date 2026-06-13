import { useQuery } from '@tanstack/react-query';
import { publicApi } from '../../api/publicApi';

const lensIcons: Record<string, string> = {
  BUSINESS: '/images/lens-business-systems.svg',
  INFORMATION: '/images/lens-information-systems.svg',
  HUMAN: '/images/lens-human-systems.svg',
  ORGANIZATIONAL: '/images/lens-organizational-systems.svg',
};

export default function LensesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public', 'lenses'],
    queryFn: publicApi.getLenses,
  });

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (isError || !data) {
    return (
      <div className="marketing-page">
        <section className="marketing-section">
          <h1>Four System Lenses</h1>
          <p>We couldn't load lens content right now. Please refresh and try again.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="marketing-page">
      <section className="marketing-section">
        <h1>Four System Lenses</h1>
        <p>Use these lenses together to find where your process is healthy and where it is under tension.</p>
      </section>
      <section className="lens-grid">
        {data.map((lens) => (
          <article key={lens.id} className="lens-card">
            <div className="lens-card-header">
              <img
                src={lensIcons[lens.code] ?? '/images/wpd-logo-primary-color.png'}
                alt={`${lens.name} icon`}
                className="lens-icon"
              />
            </div>
            <h2>{lens.name}</h2>
            <p>{lens.publicDescription}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
