export default function Container({ children }: any) {
  return (
    <div
      style={{
        maxWidth: "980px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      {children}
    </div>
  );
}
