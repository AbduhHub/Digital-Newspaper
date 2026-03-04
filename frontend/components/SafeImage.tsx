import Image from "next/image";

interface Props {
  src?: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
}

export default function SafeImage({ src, alt, ...props }: Props) {
  if (!src) return null;

  return <Image src={src} alt={alt} {...props} />;
}
