/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

export function Photo({ src, alt = "", className }: { src: string; alt?: string; className?: string }) {
  return <img className={cn(className)} src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" />;
}
