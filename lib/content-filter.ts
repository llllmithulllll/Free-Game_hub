export function ageFromDateOfBirth(value: string, now = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dob = new Date(year, month - 1, day);
  if (
    dob.getFullYear() !== year ||
    dob.getMonth() !== month - 1 ||
    dob.getDate() !== day ||
    dob > now
  ) return null;

  let age = now.getFullYear() - year;
  if (
    now.getMonth() < month - 1 ||
    (now.getMonth() === month - 1 && now.getDate() < day)
  ) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

export function dateOfBirthFromStorage(value: any): string {
  if (typeof value === "string") return value;
  const date = value instanceof Date ? value : value?.toDate?.();
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

const SEXUAL_CONTENT_PATTERN =
  /\b(sexual|sex\s+content|sexual\s+themes?|nudity|nude|hentai|erotic|porn(?:ographic)?|nsfw|adult[-\s]?only|strip(?:ping)?)\b/i;

/** Conservative metadata/title check; catalog providers may omit content tags. */
export function isSexualContentGame(game: any): boolean {
  const esrb = game?.esrbRating ?? game?.esrb_rating;
  const rating = `${esrb?.name ?? ""} ${esrb?.slug ?? ""}`;
  if (/adults?\s*only|adults-only|ao\b/i.test(rating)) return true;

  const metadata = [
    game?.title,
    game?.name,
    game?.description,
    game?.description_raw,
    ...(Array.isArray(game?.genres) ? game.genres.map((item: any) => typeof item === "string" ? item : item?.name) : []),
    ...(Array.isArray(game?.tags) ? game.tags.map((item: any) => typeof item === "string" ? item : item?.name) : []),
  ].filter(Boolean).join(" ");

  return SEXUAL_CONTENT_PATTERN.test(metadata);
}

export function shouldFilterSexualContent(
  dateOfBirth: any,
  preference: boolean | undefined,
): boolean {
  const dob = dateOfBirthFromStorage(dateOfBirth);
  const age = dob ? ageFromDateOfBirth(dob) : null;
  // Unknown or under-18 accounts stay filtered; adults may opt out.
  return age === null || age < 18 || preference !== false;
}
