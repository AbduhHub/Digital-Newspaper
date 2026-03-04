import "./globals.css";
import "pdfjs-dist/legacy/web/pdf_viewer.css";
import { Noto_Nastaliq_Urdu } from "next/font/google";

const urduFont = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400", "700"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ur" dir="rtl">
      <body className={urduFont.className}>{children}</body>
      {/* <body
        className="nastaliq"
        style={{
          background: "#f4f4f4",
          margin: 0,
        }}
      >
        {children}
      </body> */}
    </html>
  );
}
