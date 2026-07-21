import { useAuth } from './AuthProvider';

export function useIsGuest() {
  const { user } = useAuth();
  return user?.isAnonymous ?? false;
}
