export default function ArticleLayout({
  children,
  sidebar,
}: {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}) {
  return (
    <div className="article-layout">
      <main className="article-main">{children}</main>
      <aside className="article-sidebar">{sidebar}</aside>
    </div>
  );
}
