import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SystemBrand } from '../components/SystemBrand';
import { Loader } from '../components/Loader';

const features = [
  ['01', 'The right space. The right tools.', 'Explore laboratories and equipment by department, category, and availability. Find a resource that fits your next idea.', 'Discover'],
  ['02', 'Less back-and-forth. More progress.', 'Get suitable lab recommendations, check time conflicts, and send your request to the people who can approve it.', 'Reserve'],
  ['03', 'Every handover, accounted for.', 'Follow approvals, equipment issue, returns, and maintenance in one shared workspace. Keep your campus moving.', 'Track'],
];
export function HomePage() {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <div className="home-page">
    <a className="skip-link" href="#home-main">Skip to content</a>
    <header className="home-nav"><Link to="/" aria-label="SystemXLit home"><SystemBrand subtitle="" /></Link><nav aria-label="Main navigation"><a href="#possibilities">The platform</a><a href="#workflow">How it works</a><Link to="/login">Sign in</Link><Link to="/register" className="primary-button">Get started <span aria-hidden="true">↗</span></Link></nav></header>
    <main id="home-main">
      <section className="home-hero">
        <div className="hero-copy"><div className="home-kicker"><span /> ONE CAMPUS. ENDLESS POSSIBILITIES.</div><h1>Big ideas deserve<br />the <em>right space.</em></h1><p>From your first experiment to your next breakthrough. Discover labs, reserve equipment, and bring your ideas to life — all in one place.</p><div className="hero-actions"><Link className="primary-button" to="/register">Find your next possibility <span aria-hidden="true">↗</span></Link><Link className="home-text-link" to="/login">Enter your workspace →</Link></div><div className="hero-audience"><span className="audience-marks"><b>S</b><b>F</b><b>L</b></span><span>Built for students, faculty<br />and the teams behind them.</span></div></div>
        <div className="hero-stage" aria-label="Illustration of the booking workflow">
          <div className="stage-grid" /><span className="stage-caption">YOUR NEXT BREAKTHROUGH, ORGANIZED.</span>
          <div className="resource-preview"><div className="preview-top"><span className="preview-symbol">⌘</span><span>THE CONNECTED LAB</span><span className="preview-dots">•••</span></div><div className="lab-illustration" aria-hidden="true"><div className="illustration-orbit" /><div className="lab-monitor"><span /><i /><b /></div><div className="lab-flask"><span /></div><div className="lab-base" /></div><div className="preview-description"><span className="eyebrow">SPACE TO EXPLORE</span><h2>Your idea. A place to begin.</h2><p>Laboratories + equipment + possibility</p></div><div className="preview-bottom"><span>Discover</span><i>→</i><span>Reserve</span><i>→</i><span>Create</span></div></div>
          <div className="floating-note note-match"><span className="note-icon">✧</span><div><strong>A smarter match</strong><span>Resources that fit your needs</span></div></div><div className="floating-note note-track"><span className="note-icon">✓</span><div><strong>Clarity at every step</strong><span>From request to return</span></div></div><span className="stage-footnote">A glimpse of a more connected campus</span>
        </div>
      </section>
      <div className="home-principles"><span>Less coordination. More discovery.</span><strong>Conflict-aware booking</strong><strong>Smart recommendations</strong><strong>Complete resource tracking</strong></div>
      <section className="home-features" id="possibilities"><div className="section-heading"><div><span className="eyebrow">MADE FOR CAMPUS LIFE</span><h2>Everything you need.<br />Room for what’s next.</h2></div><p>One thoughtful system for the people, spaces,<br />and tools that make great work possible.</p></div><div className="feature-grid">{features.map(([number, title, text, label]) => <article key={number}><div className="feature-label"><span>{label}</span><b>{number}</b></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <section className="home-workflow" id="workflow"><div><span className="eyebrow">FROM IDEA TO IMPACT</span><h2>A clear path<br />to getting things done.</h2><Link className="primary-button" to="/register">Make your first booking ↗</Link></div><ol>{[['Find your resources', 'Choose your lab, equipment, date, and time.'], ['Send your request', 'Availability and university rules are checked for you.'], ['Get the go-ahead', 'Track your approval and reservation in your workspace.'], ['Create. Return. Repeat.', 'Collect your resources and close the loop with a recorded return.']].map(([title, text], i) => <li key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
    </main><footer className="home-footer"><SystemBrand subtitle="Campus resources, connected." /><p>Built for the work that moves your university forward.</p><Link to="/login">Go to workspace ↗</Link></footer>
  </div>;
}
