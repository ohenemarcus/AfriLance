export function withoutPrivateNameFields<T extends { legalName?: string | null; nameChangedAt?: Date | null }>(profile: T) {
  const { legalName: _legalName, nameChangedAt: _nameChangedAt, ...publicProfile } = profile;
  return publicProfile;
}
