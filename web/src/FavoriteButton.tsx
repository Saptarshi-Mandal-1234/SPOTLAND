import type { FavoritePlace } from '../../shared/accounts';
import { useAccount } from './AccountContext';
export default function FavoriteButton({ place }: { place: FavoritePlace }) {
  const account = useAccount(); const saved = account.saved.some(row => row.place.id === place.id);
  return <div className="favorite-control"><button disabled={account.loading || account.busy} aria-pressed={!!account.user && saved} onClick={() => account.user ? void account.toggle(place) : account.setOpen(true)}>{account.loading ? 'Checking saved places…' : !account.user ? 'Sign in to save this spot ↗' : saved ? 'Saved ✓ · Remove favorite' : 'Save this spot ♡'}</button>{account.user && account.message && <p role="status">{account.message}</p>}</div>;
}
