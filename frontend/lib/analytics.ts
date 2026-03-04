export function trackEvent(event: string, meta: any = {}) {
  fetch(`${process.env.NEXT_PUBLIC_API}/analytics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event, meta }),
  }).catch(() => {});
}
