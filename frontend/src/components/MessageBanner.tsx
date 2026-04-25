import type { RouteDecision } from '../types';

interface Props {
  decision: RouteDecision;
  onClose: () => void;
}

export function MessageBanner({ decision, onClose }: Props) {
  const { message, destinations, sms_sent, routed_at } = decision;
  const time = new Date(routed_at).toLocaleTimeString();

  return (
    <div className="message-banner" role="alert" aria-live="assertive">
      <button className="message-banner__close" onClick={onClose} aria-label="Dismiss">✕</button>
      <p className="message-banner__text">"{message.text}"</p>
      <div className="message-banner__meta">
        <span>{time}</span>
        {destinations.map(d => (
          <span key={d} className={`badge badge--${d}`}>{d}</span>
        ))}
        {sms_sent && <span className="badge badge--sms">SMS sent</span>}
      </div>
    </div>
  );
}
