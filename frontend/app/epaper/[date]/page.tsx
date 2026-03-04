import PDFViewer from "../../../components/PDFViewer";

const API = process.env.NEXT_PUBLIC_API;

async function getData(date: string) {
  const res = await fetch(`${API}/epapers/${date}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;

  return res.json();
}

export default async function EpaperPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  const data = await getData(date);

  if (!data || !data.images) {
    return <div style={{ padding: 20 }}>اخبار دستیاب نہیں</div>;
  }

  return <PDFViewer pdfUrl={data.pdf} thumbnailPages={data.images} />;
}
