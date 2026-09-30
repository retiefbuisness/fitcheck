import { Shirt, Sparkles, Star, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const FEATURES = [
  { icon: Shirt, text: 'Build a digital closet of the clothes you own' },
  { icon: Sparkles, text: 'Get outfit ideas for any occasion' },
  { icon: Star, text: 'Get your fit rated with tips to level it up' },
  { icon: Users, text: 'Share fits, tag friends, and get inspired' },
];

export default function Welcome() {
  return (
    <div className="hero">
      <div className="stack" style={{ gap: 6 }}>
        <div className="logo">
          Fit<span>Check</span>
        </div>
        <p className="muted">Your closet, your fits, your people.</p>
      </div>
      <div className="stack">
        {FEATURES.map(({ icon: Icon, text }) => (
          <div key={text} className="feature">
            <Icon size={22} />
            <span>{text}</span>
          </div>
        ))}
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <Link to="/sign-up" className="btn primary block">
          Create account
        </Link>
        <Link to="/sign-in" className="btn block">
          I already have an account
        </Link>
        <p className="muted small center">For adults 18+ only.</p>
      </div>
    </div>
  );
}
