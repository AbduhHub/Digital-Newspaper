export async function fetchAds(placement: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API}/ads/${placement}`);

  if (!res.ok) return [];

  return res.json();
}
