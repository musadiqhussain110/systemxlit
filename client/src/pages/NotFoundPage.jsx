import { Link } from 'react-router-dom';
export function NotFoundPage() { return <div className="not-found"><strong>404</strong><h1>Page not found</h1><p>The page you requested does not exist.</p><Link className="primary-button" to="/">Back to dashboard</Link></div>; }
