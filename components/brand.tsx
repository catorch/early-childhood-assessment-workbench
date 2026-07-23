import Image from "next/image";

// Shine brand graphic devices (see docs/BrandGuide_Product_ShineEarlyLearning_July2025):
// sparkle "shines" echo the logo, looping lines add energy, and every interior
// page carries the Shine logo bottom-left with the product line bottom-right.

export function Sparkle({ className }: { readonly className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c1.1 6.9 4.9 10.5 12 12-7.1 1.5-10.9 5.1-12 12-1.1-6.9-4.9-10.5-12-12C7.1 10.5 10.9 6.9 12 0Z" />
    </svg>
  );
}

export function LoopLine({ className }: { readonly className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 160 56">
      <path
        d="M4 44C26 14 48 8 58 20c8 10-2 24-12 18-9-6 0-24 22-28 26-5 44 8 60 14 10 4 18 2 24-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="5"
      />
    </svg>
  );
}

export function BrandFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex min-h-[72px] w-[min(calc(100%_-_40px),1180px)] flex-wrap items-center justify-between gap-x-6 gap-y-2.5 py-5 max-sm:w-[min(calc(100%_-_24px),1120px)]">
        <Image
          alt="Shine Early Learning"
          className="h-10 w-auto"
          height={345}
          src="/brand/shine-early-learning-logo.png"
          width={1007}
        />
        <p className="text-xs font-semibold text-muted-foreground">
          <span className="font-extrabold text-primary-strong">HELP®</span> AI Crediting Companion · © Shine Early Learning {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
