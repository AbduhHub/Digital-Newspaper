import Link from "next/link";
import Header from "../../components/Header";

async function getPapers() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API}/epapers?page=1&limit=24`,
    { cache: "no-store" },
  );
  return res.json();
}

export default async function ArchivePage() {
  const papers = await getPapers();

  return (
    <>
      <Header />

      <main
        style={{
          maxWidth: "1000px",
          margin: "20px auto",
        }}
      >
        <h2>پرانے اخبارات</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "20px",
          }}
        >
          {papers.map((paper: any) => (
            <Link
              key={paper.date}
              href={`/epaper/${paper.date}`}
              style={{
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #ccc",
                  padding: "10px",
                }}
              >
                <img src={paper.cover_image} style={{ width: "100%" }} />
                <p
                  style={{
                    textAlign: "center",
                    fontSize: "14px",
                  }}
                >
                  {paper.date}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
