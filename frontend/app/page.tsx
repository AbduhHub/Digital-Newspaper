import "pdfjs-dist/legacy/web/pdf_viewer.css";
import Link from "next/link";
import Header from "../components/Header";
import Container from "../components/Container";
import styles from "./home.module.css";
import Image from "next/image";
import HomeAd from "../components/HomeAd";
import ArticleCard from "../components/ArticleCard";

async function getLatest() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API}/epapers?page=1&limit=5`,
      { cache: "no-store" },
    );

    if (!res.ok) return [];

    return res.json();
  } catch {
    return [];
  }
}

async function getArticles() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API}/articles?page=1&limit=6`,
      { cache: "no-store" },
    );

    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function Home() {
  const [papers, articles] = await Promise.all([getLatest(), getArticles()]);

  if (!papers.length) {
    return (
      <>
        <Header />
        <p style={{ textAlign: "center" }}>کوئی اخبار دستیاب نہیں</p>
      </>
    );
  }

  const today = papers[0];
  return (
    <>
      <Header headlines={articles.slice(0, 3)} />
      <div className={styles.pageWrapper}>
        {/* MAIN CENTER CONTENT */}
        <Container>
          {/* E-PAPER SECTION */}
          <section className={styles.glassSection}>
            <div className={styles.epaperLayout}>
              {/* TODAY */}
              <Link
                href={`/epaper/${today.date}`}
                className={`${styles.paperCard} ${styles.todayCard}`}
              >
                {today?.cover_image ? (
                  <Image
                    src={today.cover_image}
                    alt="Today's Newspaper"
                    width={800}
                    height={1100}
                    style={{ width: "100%", height: "auto" }}
                    priority
                  />
                ) : null}
                <div className={styles.headlineBlue}>
                  {today.headline || "آج کا اخبار"}
                </div>

                <div className={styles.overlay}>
                  <span>Open E-Paper</span>
                </div>

                <span className={styles.ripple}></span>
              </Link>

              {/* PREVIOUS COLUMN */}
              <div className={styles.previousColumn}>
                <div className={styles.previousGrid}>
                  {papers.slice(1, 5).map((p: any) => (
                    <Link
                      key={p.date}
                      href={`/epaper/${p.date}`}
                      className={`${styles.paperCard} ${styles.previousCard}`}
                    >
                      {p?.cover_image ? (
                        <Image
                          src={p.cover_image}
                          alt="Previous Newspaper"
                          width={400}
                          height={600}
                          style={{ width: "100%", height: "auto" }}
                          loading="lazy"
                        />
                      ) : null}

                      <div className={styles.headlineRed}>
                        {p.headline || p.date}
                      </div>

                      <span className={styles.ripple}></span>
                    </Link>
                  ))}
                </div>

                <Link href="/archive" className={styles.moreButton}>
                  مزید اخبارات
                </Link>
              </div>
            </div>
          </section>

          <HomeAd placement="article_top" />

          {/* ARTICLES SECTION */}
          {articles.length > 0 && (
            <section className={styles.articlesSection}>
              <h2 className={styles.sectionTitle}>اہم خبریں</h2>

              <div className={styles.newsGrid}>
                {articles.slice(0, 6).map((a: any) => (
                  <ArticleCard key={a.slug} article={a} />
                  // {a.image && (
                  //   <img
                  //     src={a.image}
                  //     alt={a.title}
                  //     className={styles.newsImage}
                  //   />
                  // )}

                  // <div className={styles.newsContent}>
                  //   <h3>{a.title}</h3>

                  //   <p>{a.content.slice(0, 140)}...</p>

                  //   <Link
                  //     href={`/articles/${a.slug}`}
                  //     className={styles.readMore}
                  //   >
                  //     مزید پڑھیں →
                  //   </Link>
                  // </div>
                ))}
              </div>
            </section>
          )}
        </Container>

        <div className={styles.floatingSidebar}>
          <HomeAd placement="homepage" />
        </div>
      </div>
      <footer
        style={{
          background: "#111",
          color: "#fff",
          padding: "40px 0",
          textAlign: "center",
        }}
      >
        <p>© 2026 Inquilab-e-Deccan. All Rights Reserved</p>
      </footer>
      ;
    </>
  );
}
